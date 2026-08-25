/**
 * Anniv Charlotte & Antoine — backend Google Apps Script.
 *
 * Déployé en Web App ("Exécuter en tant que : moi", "Accès : Tout le monde"),
 * ce script sert la page Index.html et stocke la liste des invités dans un
 * Google Sheet créé automatiquement dans le Drive du compte au premier accès.
 * Colonnes : id / nom / camp / statut / plusuns / maj (les classeurs créés
 * avant la colonne "plusuns" sont migrés automatiquement).
 */

var SHEET_GUESTS = "invites";
var SHEET_CONFIG = "config";
// sha256("anniv1710") — code organisateurs par défaut, modifiable depuis l'app.
var DEFAULT_ADMIN_HASH = "7201071f636b8d7a7999d358e018fe7ac891685d8ffe3f336e1e8541c09acd58";
var CAMPS = ["charlotte", "antoine", "deux"];
var STATUSES = ["oui", "peutetre", "non"];
var MAX_PLUS = 2;

function doGet() {
  return HtmlService.createHtmlOutputFromFile("Index")
    .setTitle("Anniv Charlotte & Antoine")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty("SPREADSHEET_ID");
  if (id) {
    try {
      return SpreadsheetApp.openById(id);
    } catch (e) {
      // Le classeur a été supprimé : on en recrée un.
    }
  }
  var ss = SpreadsheetApp.create("Anniv Charlotte & Antoine — invités");
  var g = ss.getActiveSheet();
  g.setName(SHEET_GUESTS);
  g.getRange(1, 1, 1, 6).setValues([["id", "nom", "camp", "statut", "plusuns", "maj"]]);
  var now = new Date().toISOString();
  g.getRange(2, 1, 2, 6).setValues([
    [Utilities.getUuid(), "Charlotte B", "charlotte", "oui", 0, now],
    [Utilities.getUuid(), "Antoine B", "antoine", "oui", 0, now]
  ]);
  var c = ss.insertSheet(SHEET_CONFIG);
  c.getRange(1, 1, 2, 2).setValues([["cle", "valeur"], ["note", "Le code organisateurs est stocké (haché) dans les propriétés du script."]]);
  props.setProperty("SPREADSHEET_ID", ss.getId());
  return ss;
}

function guestsSheet_() {
  var sh = getSpreadsheet_().getSheetByName(SHEET_GUESTS);
  // Migration : les anciens classeurs n'ont pas la colonne "plusuns".
  if (sh.getRange(1, 5).getValue() === "maj") {
    sh.insertColumnBefore(5);
    sh.getRange(1, 5).setValue("plusuns");
    var last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 5, last - 1, 1).setValue(0);
  }
  return sh;
}

function clampPlus_(v) {
  var n = parseInt(v, 10);
  if (isNaN(n) || n < 0) n = 0;
  if (n > MAX_PLUS) n = MAX_PLUS;
  return n;
}

function readGuests_() {
  var sh = guestsSheet_();
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 6).getValues()
    .filter(function (r) { return r[0] && r[1]; })
    .map(function (r) {
      return {
        id: String(r[0]),
        name: String(r[1]),
        camp: CAMPS.indexOf(String(r[2])) >= 0 ? String(r[2]) : "deux",
        status: STATUSES.indexOf(String(r[3])) >= 0 ? String(r[3]) : "peutetre",
        plus: clampPlus_(r[4]),
        updated: String(r[5] || "")
      };
    });
}

function writeGuests_(guests) {
  var sh = guestsSheet_();
  var last = sh.getLastRow();
  if (last > 1) sh.getRange(2, 1, last - 1, 6).clearContent();
  if (guests.length) {
    sh.getRange(2, 1, guests.length, 6).setValues(guests.map(function (g) {
      return [g.id, g.name, g.camp, g.status, g.plus || 0, g.updated || ""];
    }));
  }
}

function norm_(s) {
  return String(s).trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function sha256Hex_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8);
  return bytes.map(function (b) {
    var v = (b + 256) % 256;
    return (v < 16 ? "0" : "") + v.toString(16);
  }).join("");
}

function adminHash_() {
  return PropertiesService.getScriptProperties().getProperty("ADMIN_HASH") || DEFAULT_ADMIN_HASH;
}

function stateFor_(guests) {
  var updated = "";
  guests.forEach(function (g) { if (g.updated > updated) updated = g.updated; });
  return { guests: guests, updated: updated };
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

/* ------------------------- API appelée par la page ------------------------ */

function apiGetState() {
  return stateFor_(readGuests_());
}

// L'invité tape son nom : si un nom identique existe on le lui rattache,
// sinon on crée un nouveau participant (statut "oui" par défaut).
function apiJoin(name, camp, plus) {
  name = String(name || "").trim().slice(0, 60);
  if (norm_(name).length < 2) throw new Error("Écris ton prénom (au moins 2 lettres).");
  if (CAMPS.indexOf(camp) < 0) camp = "deux";
  return withLock_(function () {
    var guests = readGuests_();
    var existing = null;
    for (var i = 0; i < guests.length; i++) {
      if (norm_(guests[i].name) === norm_(name)) { existing = guests[i]; break; }
    }
    if (existing) return { meId: existing.id, state: stateFor_(guests) };
    var g = {
      id: Utilities.getUuid(),
      name: name,
      camp: camp,
      status: "oui",
      plus: clampPlus_(plus),
      updated: new Date().toISOString()
    };
    guests.push(g);
    writeGuests_(guests);
    return { meId: g.id, state: stateFor_(guests) };
  });
}

// L'invité met à jour sa propre carte (statut, camp et/ou +1).
// Passer null pour un champ le laisse inchangé.
function apiSetSelf(id, status, camp, plus) {
  return withLock_(function () {
    var guests = readGuests_();
    var g = null;
    for (var i = 0; i < guests.length; i++) {
      if (guests[i].id === id) { g = guests[i]; break; }
    }
    if (!g) throw new Error("Invité·e introuvable — recharge la page.");
    if (status && STATUSES.indexOf(status) >= 0) g.status = status;
    if (camp && CAMPS.indexOf(camp) >= 0) g.camp = camp;
    if (plus !== null && plus !== undefined) g.plus = clampPlus_(plus);
    g.updated = new Date().toISOString();
    writeGuests_(guests);
    return stateFor_(guests);
  });
}

function apiVerifyAdmin(code) {
  return sha256Hex_(String(code || "")) === adminHash_();
}

// Actions organisateurs : le code est vérifié côté serveur à chaque appel.
function apiAdmin(code, op, payload) {
  if (!apiVerifyAdmin(code)) throw new Error("Code organisateurs incorrect.");
  payload = payload || {};
  if (op === "code") {
    var newCode = String(payload.code || "").trim();
    if (newCode.length < 4) throw new Error("Le code doit faire au moins 4 caractères.");
    PropertiesService.getScriptProperties().setProperty("ADMIN_HASH", sha256Hex_(newCode));
    return stateFor_(readGuests_());
  }
  return withLock_(function () {
    var guests = readGuests_();
    var now = new Date().toISOString();
    function find(id) {
      for (var i = 0; i < guests.length; i++) if (guests[i].id === id) return guests[i];
      throw new Error("Invité·e introuvable — recharge la page.");
    }
    if (op === "add") {
      var name = String(payload.name || "").trim().slice(0, 60);
      if (!name) throw new Error("Il manque le prénom.");
      guests.push({
        id: Utilities.getUuid(),
        name: name,
        camp: CAMPS.indexOf(payload.camp) >= 0 ? payload.camp : "deux",
        status: "oui",
        plus: 0,
        updated: now
      });
    } else if (op === "rename") {
      var g1 = find(payload.id);
      var n = String(payload.name || "").trim().slice(0, 60);
      if (!n) throw new Error("Le nom ne peut pas être vide.");
      g1.name = n;
      g1.updated = now;
    } else if (op === "status") {
      var g2 = find(payload.id);
      if (STATUSES.indexOf(payload.status) < 0) throw new Error("Statut inconnu.");
      g2.status = payload.status;
      g2.updated = now;
    } else if (op === "camp") {
      var g3 = find(payload.id);
      if (CAMPS.indexOf(payload.camp) < 0) throw new Error("Camp inconnu.");
      g3.camp = payload.camp;
      g3.updated = now;
    } else if (op === "plus") {
      var g4 = find(payload.id);
      g4.plus = clampPlus_(payload.plus);
      g4.updated = now;
    } else if (op === "del") {
      var before = guests.length;
      guests = guests.filter(function (x) { return x.id !== payload.id; });
      if (guests.length === before) throw new Error("Invité·e introuvable — recharge la page.");
    } else {
      throw new Error("Action inconnue.");
    }
    writeGuests_(guests);
    return stateFor_(guests);
  });
}
