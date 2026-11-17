/* Connexion au serveur Supabase (voir README, « Comptes en ligne »).
   Ces deux valeurs sont publiques par nature : la sécurité vient des règles de la base (supabase/schema.sql).
   Laissées vides, l'application fonctionne sans compte : les saisies restent sur l'appareil. */
window.CONFIG_COMPTE = {
  url: "",        // Project URL, par exemple "https://abcdefghijkl.supabase.co"
  cle: "",        // Publishable key, par exemple "sb_publishable_..."
  urlSite: ""     // Adresse du site (GitHub Pages), pour les liens reçus par e-mail
};
