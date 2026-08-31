# Déployer sans Google : GitHub Pages + Supabase (~10 minutes)

La page est hébergée par GitHub Pages (ce dépôt) et les données vivent dans
une base Postgres gratuite chez Supabase. Les invités n'ont besoin d'aucun
compte ; le code organisateurs est vérifié côté serveur.

## 1. Créer la base Supabase (~5 min)

1. Va sur **https://supabase.com** → *Start your project* → crée un compte
   (gratuit) → **New project**. Choisis une région Europe, un mot de passe de
   base quelconque (garde-le), plan **Free**.
2. Une fois le projet créé : menu **SQL Editor** → **New query** → colle tout
   le contenu de [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   (Le script est rejouable sans risque.)
3. Menu **Settings → API** : copie **Project URL** (forme
   `https://xxxx.supabase.co`) et la clé **anon public**.

➡️ **Envoie ces deux valeurs dans la conversation Claude.** La clé `anon` est
faite pour être publiée dans une page web : les écritures ne passent que par
les fonctions SQL du schéma, qui valident tout (le code admin reste secret
côté serveur).

Claude remplira alors les deux constantes `%%SUPABASE_URL%%` et
`%%SUPABASE_ANON_KEY%%` en tête du script de `docs/index.html` et poussera le
commit. (Tu peux aussi les remplacer toi-même dans le fichier.)

## 2. Activer GitHub Pages (~2 min)

1. Sur GitHub : dépôt `charlotte-bellet/annivchantoine` → **Settings** →
   **Pages**.
2. *Source* : **Deploy from a branch** ; *Branch* :
   `claude/birthday-guest-list-app-8x5a03` (ou `main` après merge), dossier
   **/docs** → **Save**.
3. Après ~1 minute, la page est en ligne :
   **https://charlotte-bellet.github.io/annivchantoine/**

C'est ce lien qu'on partage sur WhatsApp.

## 3. Reprendre les réponses déjà enregistrées (si besoin)

Le schéma pré-remplit seulement Charlotte B et Antoine B. Si des invités ont
déjà répondu dans l'ancienne version (Google Sheet « Anniv Charlotte &
Antoine — invités » dans ton Drive), copie-colle ses lignes dans la
conversation Claude : un SQL d'import sera généré. (Ensuite, l'ancienne Web
App Google peut être archivée.)

## Au quotidien

- **Données** : visibles/modifiables dans Supabase → **Table Editor** →
  `guests` (l'équivalent du Google Sheet).
- **Code organisateurs** : `anniv1710` par défaut — à changer depuis l'app
  (Espace organisateurs, en bas de la liste).
- **Mise à jour de la page** : il suffit de pousser un commit modifiant
  `docs/index.html` ; Pages redéploie automatiquement, même URL.
- **Limites du plan gratuit Supabase** : largement au-delà du besoin ; seul
  point d'attention, un projet inactif ~1 semaine est mis en pause — ouvrir
  l'app le réveille, et le tableau de bord Supabase permet de le relancer.
