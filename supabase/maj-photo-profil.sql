-- Mise à jour : autorise la photo de profil (clé « profil/photo ») dans la table des saisies.
-- À lancer une fois dans Supabase > SQL Editor > New query > Run.
alter table public.entrees drop constraint if exists entrees_cle_check;
alter table public.entrees add constraint entrees_cle_check check (
  cle ~ '^(jours/[0-9]{4}-[0-9]{2}-[0-9]{2}|semaines/[0-9]{4}-[0-9]{2}-[0-9]{2}|mois/[0-9]{4}-[0-9]{2}|reglages/dons|profil/photo)$'
);
