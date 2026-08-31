/**
 * Anniv Charlotte & Antoine — backend Google Apps Script.
 *
 * Déployé en Web App ("Exécuter en tant que : moi", "Accès : Tout le monde"),
 * ce script sert la page Index.html avec l'état initial embarqué, et stocke la
 * liste des invités dans un Google Sheet créé automatiquement dans le Drive.
 * Colonnes : id / nom / camp / statut / plusuns / maj. Les écritures ne
 * touchent que la ligne concernée, et l'état est mis en cache (CacheService)
 * pour accélérer les lectures.
 */

var SHEET_GUESTS = "invites";
var SHEET_CONFIG = "config";
// sha256("anniv1710") — code organisateurs par défaut, modifiable depuis l'app.
var DEFAULT_ADMIN_HASH = "7201071f636b8d7a7999d358e018fe7ac891685d8ffe3f336e1e8541c09acd58";
var CAMPS = ["charlotte", "antoine", "deux"];
var STATUSES = ["oui", "peutetre", "non"];
var MAX_PLUS = 2;
var CACHE_KEY = "state-v2";
var CACHE_TTL = 120; // secondes — une modif faite à la main dans le Sheet met au plus 2 min à apparaître.

function doGet() {
  var t = HtmlService.createTemplateFromFile("Index");
  var json = '{"guests":[],"updated":""}';
  try {
    json = JSON.stringify(apiGetState());
  } catch (e) {
    // La page se rabattra sur un chargement via apiGetState.
  }
  t.initialJson = json.replace(/</g, "\\u003c");
  return t.evaluate()
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

function guestFromRow_(r) {
  return {
    id: String(r[0]),
    name: String(r[1]),
    camp: CAMPS.indexOf(String(r[2])) >= 0 ? String(r[2]) : "deux",
    status: STATUSES.indexOf(String(r[3])) >= 0 ? String(r[3]) : "peutetre",
    plus: clampPlus_(r[4]),
    updated: String(r[5] || "")
  };
}

function rowValues_(g) {
  return [g.id, g.name, g.camp, g.status, g.plus || 0, g.updated || ""];
}

// Une seule lecture du Sheet : les invités + le numéro de ligne de chacun,
// pour pouvoir réécrire uniquement la ligne modifiée ensuite.
function readAll_() {
  var sh = guestsSheet_();
  var out = { sh: sh, guests: [], rows: [] };
  var last = sh.getLastRow();
  if (last < 2) return out;
  var vals = sh.getRange(2, 1, last - 1, 6).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (!vals[i][0] || !vals[i][1]) continue;
    out.guests.push(guestFromRow_(vals[i]));
    out.rows.push(i + 2);
  }
  return out;
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

function cacheGet_() {
  try {
    var c = CacheService.getScriptCache().get(CACHE_KEY);
    return c ? JSON.parse(c) : null;
  } catch (e) { return null; }
}
function cachePut_(state) {
  try {
    CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(state), CACHE_TTL);
  } catch (e) {}
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

function findIndex_(all, id) {
  for (var i = 0; i < all.guests.length; i++) {
    if (all.guests[i].id === id) return i;
  }
  throw new Error("Invité·e introuvable — recharge la page.");
}

function saveRow_(all, idx) {
  all.sh.getRange(all.rows[idx], 1, 1, 6).setValues([rowValues_(all.guests[idx])]);
}

function finish_(all) {
  var s = stateFor_(all.guests);
  cachePut_(s);
  return s;
}

/* ------------------------- API appelée par la page ------------------------ */

function apiGetState() {
  var cached = cacheGet_();
  if (cached) return cached;
  var s = stateFor_(readAll_().guests);
  cachePut_(s);
  return s;
}

// Réponse d'un invité (upsert) : si le prénom (ou l'id client) est déjà dans
// la liste, on met à jour son statut / team / +1 ; sinon on l'ajoute.
// clientId (optionnel) : identifiant généré côté client pour l'affichage
// optimiste — réutilisé tel quel, et idempotent en cas de renvoi.
function apiRsvp(name, camp, plus, clientId, status) {
  name = String(name || "").trim().slice(0, 60);
  if (norm_(name).length < 2) throw new Error("Écris ton prénom (au moins 2 lettres).");
  if (STATUSES.indexOf(status) < 0) status = "oui";
  var okId = (typeof clientId === "string" && /^[0-9A-Za-z-]{8,64}$/.test(clientId));
  return withLock_(function () {
    var all = readAll_();
    var now = new Date().toISOString();
    for (var i = 0; i < all.guests.length; i++) {
      if ((okId && all.guests[i].id === clientId) ||
          norm_(all.guests[i].name) === norm_(name)) {
        var g0 = all.guests[i];
        g0.status = status;
        if (CAMPS.indexOf(camp) >= 0) g0.camp = camp;
        if (plus !== null && plus !== undefined) g0.plus = clampPlus_(plus);
        g0.updated = now;
        saveRow_(all, i);
        return { meId: g0.id, state: finish_(all) };
      }
    }
    var g = {
      id: okId ? clientId : Utilities.getUuid(),
      name: name,
      camp: CAMPS.indexOf(camp) >= 0 ? camp : "deux",
      status: status,
      plus: clampPlus_(plus),
      updated: now
    };
    all.sh.appendRow(rowValues_(g));
    all.guests.push(g);
    return { meId: g.id, state: finish_(all) };
  });
}

// Compatibilité avec les pages encore ouvertes sur l'ancienne version.
function apiJoin(name, camp, plus, clientId) {
  return apiRsvp(name, camp, plus, clientId, "oui");
}

// L'invité met à jour sa propre carte (statut, camp et/ou +1).
// Passer null pour un champ le laisse inchangé.
function apiSetSelf(id, status, camp, plus) {
  return withLock_(function () {
    var all = readAll_();
    var idx = findIndex_(all, id);
    var g = all.guests[idx];
    if (status && STATUSES.indexOf(status) >= 0) g.status = status;
    if (camp && CAMPS.indexOf(camp) >= 0) g.camp = camp;
    if (plus !== null && plus !== undefined) g.plus = clampPlus_(plus);
    g.updated = new Date().toISOString();
    saveRow_(all, idx);
    return finish_(all);
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
    return apiGetState();
  }
  return withLock_(function () {
    var all = readAll_();
    var now = new Date().toISOString();
    if (op === "add") {
      var name = String(payload.name || "").trim().slice(0, 60);
      if (!name) throw new Error("Il manque le prénom.");
      var g = {
        id: Utilities.getUuid(),
        name: name,
        camp: CAMPS.indexOf(payload.camp) >= 0 ? payload.camp : "deux",
        status: "oui",
        plus: 0,
        updated: now
      };
      all.sh.appendRow(rowValues_(g));
      all.guests.push(g);
    } else if (op === "rename") {
      var i1 = findIndex_(all, payload.id);
      var n = String(payload.name || "").trim().slice(0, 60);
      if (!n) throw new Error("Le nom ne peut pas être vide.");
      all.guests[i1].name = n;
      all.guests[i1].updated = now;
      saveRow_(all, i1);
    } else if (op === "status") {
      var i2 = findIndex_(all, payload.id);
      if (STATUSES.indexOf(payload.status) < 0) throw new Error("Statut inconnu.");
      all.guests[i2].status = payload.status;
      all.guests[i2].updated = now;
      saveRow_(all, i2);
    } else if (op === "camp") {
      var i3 = findIndex_(all, payload.id);
      if (CAMPS.indexOf(payload.camp) < 0) throw new Error("Camp inconnu.");
      all.guests[i3].camp = payload.camp;
      all.guests[i3].updated = now;
      saveRow_(all, i3);
    } else if (op === "plus") {
      var i4 = findIndex_(all, payload.id);
      all.guests[i4].plus = clampPlus_(payload.plus);
      all.guests[i4].updated = now;
      saveRow_(all, i4);
    } else if (op === "del") {
      var i5 = findIndex_(all, payload.id);
      all.sh.deleteRow(all.rows[i5]);
      all.guests.splice(i5, 1);
    } else {
      throw new Error("Action inconnue.");
    }
    return finish_(all);
  });
}
