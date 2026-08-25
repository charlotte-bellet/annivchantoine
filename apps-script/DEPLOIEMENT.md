# Déployer l'app sur Google Apps Script (~5 minutes)

L'app tourne dans le compte Google de Charlotte : la page est servie par une
« Web App » Apps Script et la liste est stockée dans un Google Sheet du Drive,
créé automatiquement au premier lancement. Les invités n'ont besoin d'aucun
compte : ils ouvrent le lien, c'est tout.

## Étapes

1. Connecté·e au compte Google (charlottebellet0@gmail.com), ouvre
   **https://script.google.com** et clique **Nouveau projet**.
2. Renomme le projet (en haut à gauche) : `Anniv Chantoine`.
3. Dans l'éditeur, remplace tout le contenu du fichier **Code.gs** par le
   contenu de [`Code.gs`](Code.gs).
4. Ajoute le fichier HTML : bouton **+** à côté de « Fichiers » → **HTML** →
   nomme-le exactement `Index` (sans extension). Remplace son contenu par celui
   de [`Index.html`](Index.html).
5. **Déployer** (bouton bleu en haut à droite) → **Nouveau déploiement** →
   type **Application Web**, puis :
   - *Exécuter en tant que* : **Moi** ;
   - *Qui a accès* : **Tout le monde** (⚠️ pas « Tout le monde disposant d'un
     compte Google » — il faut l'option sans connexion).
6. Clique **Déployer**, autorise les accès demandés (le script a besoin de
   Sheets/Drive pour son classeur), puis copie l'**URL de l'application Web**
   (elle se termine par `/exec`).
7. Colle cette URL dans la conversation WhatsApp — c'est le nouveau lien de la
   liste. Ouvre-la une première fois : le classeur
   **« Anniv Charlotte & Antoine — invités »** apparaît dans ton Drive, déjà
   rempli avec Charlotte B et Antoine B.

## Au quotidien

- **Code organisateurs** : `anniv1710` (à changer depuis l'app, en bas de page,
  après avoir activé l'Espace organisateurs). Il est vérifié côté serveur
  (hash SHA-256 stocké dans les propriétés du script) — contrairement à la
  version claude.ai, un invité ne peut pas le contourner.
- **Voir/modifier les données à la main** : ouvre le Sheet dans Drive, onglet
  `invites` (colonnes id / nom / camp / statut / maj ; camp ∈ charlotte,
  antoine, deux ; statut ∈ oui, peutetre, non).
- **Mettre à jour le code plus tard** : modifie les fichiers dans l'éditeur,
  puis **Déployer → Gérer les déploiements → ✎ → Version : Nouvelle version →
  Déployer**. L'URL ne change pas.

## Notes

- Google affiche un petit bandeau « Cette application a été créée par un autre
  utilisateur » en haut de la page : c'est normal pour les Web Apps Apps
  Script, sans incidence.
- Les écritures simultanées sont sérialisées par un verrou côté serveur
  (LockService) : pas de conflit ni de réponse perdue.
- Quotas Google largement suffisants pour un anniversaire (des dizaines de
  milliers de requêtes par jour).
