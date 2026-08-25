# Anniv Charlotte & Antoine

Liste d'invités partagée pour l'anniversaire de Charlotte et Antoine, le **samedi 17 octobre**.

## Comment ça marche

- `index.html` est une page unique, publiée comme artifact sur claude.ai et partagée
  via le lien dans la conversation WhatsApp.
- La liste des invités est stockée dans la page elle-même (bloc JSON `#state`).
- À chaque modification, la page se republie via la capacité `artifact` du runtime
  claude.ai (`claude.use("artifact")` puis `artifact.publish(html)`) : la nouvelle
  version est enregistrée pour tout le monde et toutes les vues ouvertes se rechargent.
- Chaque invité·e est rattaché·e à un « camp » : copains de Charlotte, copains
  d'Antoine, ou les deux, avec des compteurs en haut de page.

## Droits d'accès

- **Les invités consultent seulement** : la page s'ouvre en vue lecture (liste des
  participants avec leur statut Présent·e / Peut-être / Absent·e). Pour changer leur
  réponse, ils font signe dans le groupe WhatsApp.
- **Les organisateurs éditent** : le lien « Espace organisateurs » en bas de page
  active le mode édition (ajout, statut, renommage, suppression), mémorisé sur
  l'appareil.
- Le vrai contrôle d'accès est celui du partage claude.ai : le lien diffusé aux
  invités est en lecture seule ; seuls les comptes invités en édition
  (Charlotte, propriétaire, et antoinejeux92@gmail.com) peuvent réellement
  enregistrer — pour tout autre viewer, l'enregistrement est refusé (`not_writer`)
  et la page repasse en lecture seule.
