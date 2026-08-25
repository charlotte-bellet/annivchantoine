# Anniv Charlotte & Antoine

Liste d'invités partagée pour l'anniversaire de Charlotte et Antoine, le **samedi 17 octobre**.

## Comment ça marche

- `index.html` est une page unique, publiée comme artifact sur claude.ai et partagée
  via le lien dans la conversation WhatsApp.
- La « base de données », c'est la page elle-même : la liste des invités et la
  configuration sont stockées dans un bloc JSON (`#state`) embarqué dans la page.
- À chaque modification, la page se republie via la capacité `artifact` du runtime
  claude.ai (`claude.use("artifact")` puis `artifact.publish(html)`) : la nouvelle
  version est enregistrée pour tout le monde et toutes les vues ouvertes se rechargent.
  Les conflits d'édition simultanée sont gérés par le runtime (la version la plus
  récente gagne).

## Rôles

- **Tout le monde peut éditer son inscription** (onglet « Moi ») : cliquer sur son
  nom s'il est déjà dans la liste, sinon s'ajouter (prénom + camp Charlotte /
  Antoine / les deux), puis mettre à jour son statut Présent·e / Peut-être /
  Absent·e. L'identité est retenue en `localStorage`.
- **Rôle organisateurs (admin)** : « Espace organisateurs » en bas de page demande
  un code secret. Le code est vérifié contre un hash SHA-256 stocké dans l'état de
  la page ; une fois déverrouillé (mémorisé sur l'appareil), l'onglet « La liste »
  donne la gestion complète : ajouter, renommer, changer statut/camp, supprimer
  n'importe qui, et changer le code admin.
- Pour que chacun puisse enregistrer sa réponse, le partage claude.ai du lien doit
  autoriser l'édition. Le code admin protège les actions de gestion dans
  l'interface ; c'est une protection de confort adaptée à une liste d'anniversaire,
  pas un contrôle d'accès cryptographique côté serveur.
