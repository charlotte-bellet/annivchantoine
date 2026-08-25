# Anniv Charlotte & Antoine

Liste d'invités partagée pour l'anniversaire de Charlotte et Antoine, le **samedi 17 octobre**.

## Comment ça marche

- `index.html` est une page unique, publiée comme artifact sur claude.ai et partagée
  via le lien dans la conversation WhatsApp.
- La liste des invités est stockée dans la page elle-même (bloc JSON `#state`).
- À chaque modification (ajout, statut Oui / Peut-être / Non, renommage, suppression),
  la page se republie via la capacité `artifact` du runtime claude.ai
  (`claude.use("artifact")` puis `artifact.publish(html)`) : la nouvelle version est
  enregistrée pour tout le monde et toutes les vues ouvertes se rechargent.
- Chaque invité·e est rattaché·e à un « camp » : copains de Charlotte, copains
  d'Antoine, ou les deux, avec des compteurs en haut de page.

## Édition

Toute personne ayant accès en écriture au lien partagé peut modifier la liste depuis
l'app. Les conflits d'édition simultanée sont gérés par le runtime (la version la plus
récente gagne, les vues se rechargent). Un lien en lecture seule affiche la liste sans
permettre de la modifier.
