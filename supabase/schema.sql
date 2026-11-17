-- =====================================================================
-- Compte rendu spirituel : base de données Supabase
-- À exécuter une fois dans Supabase : SQL Editor > New query > coller > Run.
-- Le script peut être relancé : il remplace les fonctions et les règles.
--
-- Qui voit quoi :
--   - chacun voit et modifie ses propres saisies ;
--   - le faiseur de disciple voit (sans les modifier) les saisies de ses disciples ;
--   - le responsable d'assemblée voit celles de tous les membres de son assemblée.
-- On rejoint une assemblée avec le code que donne son responsable.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------
create table if not exists public.assemblees (
  id        uuid primary key default gen_random_uuid(),
  nom       text not null check (length(btrim(nom)) between 2 and 120),
  zone      text not null default '' check (length(zone) <= 120),
  code      text not null unique,
  cree_par  uuid references auth.users (id) on delete set null,
  cree_le   timestamptz not null default now()
);

create table if not exists public.profils (
  id            uuid primary key references auth.users (id) on delete cascade,
  nom           text not null default '' check (length(nom) <= 80),
  prenoms       text not null default '' check (length(prenoms) <= 120),
  contact       text not null default '' check (length(contact) <= 40),
  zone          text not null default '' check (length(zone) <= 120),
  assemblee_id  uuid references public.assemblees (id) on delete set null,
  assemblee_nom text not null default '' check (length(assemblee_nom) <= 120), -- si l'assemblée n'est pas encore sur l'application
  role          text not null default 'membre' check (role in ('membre', 'responsable')),
  faiseur_id    uuid references public.profils (id) on delete set null,
  faiseur_nom   text not null default '' check (length(faiseur_nom) <= 120),   -- si le faiseur n'est pas encore inscrit
  cree_le       timestamptz not null default now(),
  maj           timestamptz not null default now(),
  constraint faiseur_pas_soi_meme check (faiseur_id is null or faiseur_id <> id)
);
create index if not exists profils_assemblee on public.profils (assemblee_id);
create index if not exists profils_faiseur on public.profils (faiseur_id);

-- Les saisies : une ligne par journée, semaine, mois, plus les réglages des dons.
create table if not exists public.entrees (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cle      text not null check (cle ~ '^(jours/[0-9]{4}-[0-9]{2}-[0-9]{2}|semaines/[0-9]{4}-[0-9]{2}-[0-9]{2}|mois/[0-9]{4}-[0-9]{2}|reglages/dons)$'),
  donnees  jsonb not null check (jsonb_typeof(donnees) in ('object', 'array') and pg_column_size(donnees) < 16000),
  maj      timestamptz not null default now(),
  primary key (user_id, cle)
);
create index if not exists entrees_maj on public.entrees (user_id, maj);

-- ---------------------------------------------------------------------
-- Fonctions d'aide (security definer : elles lisent les profils sans
-- repasser par les règles, ce qui évite les boucles entre règles)
-- ---------------------------------------------------------------------

-- Vrai si la personne connectée peut voir les saisies de « cible ».
create or replace function public.peut_voir(cible uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    cible = auth.uid()
    or exists (select 1 from profils p where p.id = cible and p.faiseur_id = auth.uid())
    or exists (
      select 1 from profils p join profils moi on moi.id = auth.uid()
      where p.id = cible and moi.role = 'responsable'
        and moi.assemblee_id is not null and p.assemblee_id = moi.assemblee_id)
  );
$$;

create or replace function public.nouveau_code_aleatoire()
returns text language sql volatile set search_path = public, extensions as $$
  -- 8 caractères sans 0/O ni 1/I pour éviter les confusions à la lecture.
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + (get_byte(b, i) % 32), 1), '' order by i)
  from (select gen_random_bytes(8) as b) x, generate_series(0, 7) as i;
$$;

-- ---------------------------------------------------------------------
-- Déclencheurs
-- ---------------------------------------------------------------------

-- Crée le profil à l'inscription, avec les informations saisies dans le formulaire.
create or replace function public.creer_profil_inscription()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profils (id, nom, prenoms, contact, zone)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'nom', ''), 80),
    left(coalesce(new.raw_user_meta_data ->> 'prenoms', ''), 120),
    left(coalesce(new.raw_user_meta_data ->> 'contact', ''), 40),
    left(coalesce(new.raw_user_meta_data ->> 'zone', ''), 120))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists a_l_inscription on auth.users;
create trigger a_l_inscription after insert on auth.users
  for each row execute function public.creer_profil_inscription();

-- Contrôle des profils : le faiseur de disciple doit être de la même assemblée.
create or replace function public.controler_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.maj := now();
  if new.faiseur_id is not null then
    if new.assemblee_id is null or not exists (
      select 1 from profils f where f.id = new.faiseur_id and f.assemblee_id = new.assemblee_id) then
      raise exception 'Le faiseur de disciple doit être membre de la même assemblée.' using errcode = '22023';
    end if;
    new.faiseur_nom := '';
  end if;
  return new;
end $$;

drop trigger if exists controle_profil on public.profils;
create trigger controle_profil before insert or update on public.profils
  for each row execute function public.controler_profil();

-- L'heure de mise à jour vient du serveur : elle sert de repère à la synchronisation.
create or replace function public.dater_entree()
returns trigger language plpgsql as $$
begin
  new.maj := now();
  return new;
end $$;

drop trigger if exists date_entree on public.entrees;
create trigger date_entree before insert or update on public.entrees
  for each row execute function public.dater_entree();

-- ---------------------------------------------------------------------
-- Droits et règles d'accès (Row Level Security)
-- ---------------------------------------------------------------------
alter table public.assemblees enable row level security;
alter table public.profils enable row level security;
alter table public.entrees enable row level security;

-- Supabase donne par défaut tous les droits aux rôles anon et authenticated : on les retire.
revoke all on public.assemblees, public.profils, public.entrees from anon, authenticated;

-- Assemblées : jamais lues directement, seulement par les fonctions plus bas (le code reste caché).

-- Profils : on lit le sien, ceux de ses disciples et, pour un responsable, ceux de l'assemblée.
grant select on public.profils to authenticated;
grant insert (id, nom, prenoms, contact, zone, assemblee_nom, faiseur_nom) on public.profils to authenticated;
grant update (nom, prenoms, contact, zone, assemblee_nom, faiseur_id, faiseur_nom) on public.profils to authenticated;

drop policy if exists profils_lecture on public.profils;
create policy profils_lecture on public.profils for select to authenticated using (public.peut_voir(id));
drop policy if exists profils_creation on public.profils;
create policy profils_creation on public.profils for insert to authenticated with check (id = auth.uid());
drop policy if exists profils_modification on public.profils;
create policy profils_modification on public.profils for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Saisies : on écrit seulement les siennes ; on lit celles que peut_voir autorise.
grant select, insert, update, delete on public.entrees to authenticated;

drop policy if exists entrees_lecture on public.entrees;
create policy entrees_lecture on public.entrees for select to authenticated using (public.peut_voir(user_id));
drop policy if exists entrees_creation on public.entrees;
create policy entrees_creation on public.entrees for insert to authenticated with check (user_id = auth.uid());
drop policy if exists entrees_modification on public.entrees;
create policy entrees_modification on public.entrees for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists entrees_suppression on public.entrees;
create policy entrees_suppression on public.entrees for delete to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Fonctions appelées par l'application
-- ---------------------------------------------------------------------

-- Mon assemblée : nom, zone, mon rôle ; le code seulement pour un responsable.
create or replace function public.mon_assemblee()
returns table (id uuid, nom text, zone text, code text, role text)
language sql stable security definer set search_path = public as $$
  select a.id, a.nom, a.zone, case when p.role = 'responsable' then a.code end, p.role
  from profils p join assemblees a on a.id = p.assemblee_id
  where p.id = auth.uid();
$$;

-- Membres de mon assemblée (sans contact) : pour choisir son faiseur de disciple.
create or replace function public.membres_assemblee()
returns table (id uuid, nom text, prenoms text, role text, faiseur_id uuid)
language sql stable security definer set search_path = public as $$
  select p.id, p.nom, p.prenoms, p.role, p.faiseur_id
  from profils p join profils moi on moi.id = auth.uid()
  where moi.assemblee_id is not null and p.assemblee_id = moi.assemblee_id
  order by p.nom, p.prenoms;
$$;

-- Retire une personne de son assemblée, ainsi que les liens de faiseur qui la concernent.
create or replace function public.detacher(personne uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update profils set faiseur_id = null where faiseur_id = personne;
  update profils set assemblee_id = null, role = 'membre', faiseur_id = null where id = personne;
end $$;
revoke all on function public.detacher(uuid) from public, anon, authenticated;

-- Crée une assemblée : la personne connectée en devient responsable.
create or replace function public.creer_assemblee(nom text, zone text default '')
returns table (id uuid, code text)
language plpgsql security definer set search_path = public as $$
declare
  nouvelle assemblees;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  if not exists (select 1 from profils where profils.id = auth.uid()) then
    raise exception 'Profil introuvable.' using errcode = '22023';
  end if;
  insert into assemblees (nom, zone, code, cree_par)
  values (btrim(creer_assemblee.nom), btrim(coalesce(creer_assemblee.zone, '')), nouveau_code_aleatoire(), auth.uid())
  returning * into nouvelle;
  perform detacher(auth.uid());
  update profils set assemblee_id = nouvelle.id, role = 'responsable', assemblee_nom = '' where profils.id = auth.uid();
  return query select nouvelle.id, nouvelle.code;
end $$;

-- Rejoint une assemblée avec son code.
create or replace function public.rejoindre_assemblee(code text)
returns table (id uuid, nom text, zone text)
language plpgsql security definer set search_path = public as $$
declare
  cible assemblees;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select * into cible from assemblees a where a.code = upper(btrim(rejoindre_assemblee.code));
  if cible.id is null then raise exception 'Code d''assemblée inconnu.' using errcode = 'P0002'; end if;
  if exists (select 1 from profils p where p.id = auth.uid() and p.assemblee_id = cible.id) then
    return query select cible.id, cible.nom, cible.zone; return;
  end if;
  perform detacher(auth.uid());
  update profils set assemblee_id = cible.id, role = 'membre', assemblee_nom = '' where profils.id = auth.uid();
  return query select cible.id, cible.nom, cible.zone;
end $$;

-- Quitte son assemblée.
create or replace function public.quitter_assemblee()
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform detacher(auth.uid());
end $$;

-- Responsable : vérifie que « membre » est dans son assemblée.
create or replace function public.verifier_responsable(membre uuid)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare
  a uuid;
begin
  select moi.assemblee_id into a from profils moi where moi.id = auth.uid() and moi.role = 'responsable';
  if a is null then raise exception 'Réservé au responsable de l''assemblée.' using errcode = '42501'; end if;
  if membre is not null and not exists (select 1 from profils p where p.id = membre and p.assemblee_id = a) then
    raise exception 'Cette personne n''est pas membre de votre assemblée.' using errcode = '42501';
  end if;
  return a;
end $$;
revoke all on function public.verifier_responsable(uuid) from public, anon, authenticated;

-- Responsable : remplace le code (si l'ancien a circulé trop largement).
create or replace function public.changer_code_assemblee()
returns text language plpgsql security definer set search_path = public as $$
declare
  a uuid := verifier_responsable(null);
  nouveau text := nouveau_code_aleatoire();
begin
  update assemblees set code = nouveau where id = a;
  return nouveau;
end $$;

-- Responsable : nomme ou retire un autre responsable.
create or replace function public.definir_responsable(membre uuid, responsable boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform verifier_responsable(membre);
  if membre = auth.uid() then raise exception 'Vous ne pouvez pas changer votre propre rôle.' using errcode = '42501'; end if;
  update profils set role = case when responsable then 'responsable' else 'membre' end where id = membre;
end $$;

-- Responsable : retire une personne de l'assemblée (ses saisies restent à elle).
create or replace function public.retirer_membre(membre uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform verifier_responsable(membre);
  if membre = auth.uid() then raise exception 'Utilisez « Quitter l''assemblée ».' using errcode = '42501'; end if;
  perform detacher(membre);
end $$;

-- Supprime le compte de la personne connectée et toutes ses saisies.
create or replace function public.supprimer_mon_compte()
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  perform detacher(auth.uid());
  delete from auth.users where id = auth.uid();
end $$;

-- Seules les personnes connectées appellent ces fonctions.
revoke all on function public.peut_voir(uuid), public.nouveau_code_aleatoire(), public.mon_assemblee(),
  public.membres_assemblee(), public.creer_assemblee(text, text), public.rejoindre_assemblee(text),
  public.quitter_assemblee(), public.changer_code_assemblee(), public.definir_responsable(uuid, boolean),
  public.retirer_membre(uuid), public.supprimer_mon_compte(), public.creer_profil_inscription(),
  public.controler_profil(), public.dater_entree()
  from public, anon, authenticated;
grant execute on function public.peut_voir(uuid), public.mon_assemblee(), public.membres_assemblee(),
  public.creer_assemblee(text, text), public.rejoindre_assemblee(text), public.quitter_assemblee(),
  public.changer_code_assemblee(), public.definir_responsable(uuid, boolean), public.retirer_membre(uuid),
  public.supprimer_mon_compte()
  to authenticated;
