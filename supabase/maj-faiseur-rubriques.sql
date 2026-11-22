-- =====================================================================
-- Mise à jour (novembre 2026) — à lancer une fois dans Supabase > SQL Editor > New query > Run.
--  1. Rubriques et objectifs personnels enregistrés avec le compte (et la photo de profil).
--  2. Le faiseur de disciple peut être d'une autre assemblée : le disciple saisit le code
--     personnel de son faiseur. Le lien ne dépend plus de l'assemblée.
--  3. Les comptes rendus d'un disciple restent visibles par deux personnes seulement :
--     son faiseur de disciple et le dirigeant de son assemblée.
-- Le script peut être relancé sans risque.
-- =====================================================================

-- 1. Clés autorisées dans les saisies
alter table public.entrees drop constraint if exists entrees_cle_check;
alter table public.entrees add constraint entrees_cle_check check (
  cle ~ '^(jours/[0-9]{4}-[0-9]{2}-[0-9]{2}|semaines/[0-9]{4}-[0-9]{2}-[0-9]{2}|mois/[0-9]{4}-[0-9]{2}|reglages/(dons|rubriques|objectifs)|profil/photo)$'
);

-- 2. Codes personnels de faiseur (lisibles seulement par leur propriétaire, via mon_code_faiseur)
create table if not exists public.codes_faiseur (
  user_id uuid primary key references public.profils (id) on delete cascade,
  code    text not null unique
);
alter table public.codes_faiseur enable row level security;
revoke all on public.codes_faiseur from public, anon, authenticated;

-- Contrôle des profils : un faiseur choisi dans la liste doit être de la même assemblée ;
-- un faiseur choisi par son code personnel peut être d'une autre assemblée.
create or replace function public.controler_profil()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.maj := now();
  if new.faiseur_id is not null then
    if (tg_op = 'INSERT' or new.faiseur_id is distinct from old.faiseur_id)
       and coalesce(current_setting('crs.faiseur_par_code', true), '') <> 'oui'
       and (new.assemblee_id is null or not exists (
         select 1 from profils f where f.id = new.faiseur_id and f.assemblee_id = new.assemblee_id)) then
      raise exception 'Le faiseur de disciple doit être membre de la même assemblée, ou être choisi avec son code.' using errcode = '22023';
    end if;
    new.faiseur_nom := '';
  end if;
  return new;
end $$;

-- Quitter ou changer d'assemblée ne touche plus au lien faiseur ↔ disciple.
create or replace function public.detacher(personne uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update profils set assemblee_id = null, role = 'membre' where id = personne;
end $$;
revoke all on function public.detacher(uuid) from public, anon, authenticated;

-- Mon code de faiseur (créé à la première demande).
create or replace function public.mon_code_faiseur()
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select code into c from codes_faiseur where user_id = auth.uid();
  while c is null loop
    begin
      insert into codes_faiseur (user_id, code) values (auth.uid(), nouveau_code_aleatoire()) returning code into c;
    exception when unique_violation then
      select code into c from codes_faiseur where user_id = auth.uid();
    end;
  end loop;
  return c;
end $$;

-- Remplace mon code (si l'ancien a trop circulé). Les disciples déjà liés le restent.
create or replace function public.changer_code_faiseur()
returns text language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  delete from codes_faiseur where user_id = auth.uid();
  return mon_code_faiseur();
end $$;

-- Le disciple choisit son faiseur avec le code que celui-ci lui a donné.
create or replace function public.choisir_faiseur(code text)
returns table (id uuid, nom text, prenoms text)
language plpgsql security definer set search_path = public as $$
declare f uuid;
begin
  if auth.uid() is null then raise exception 'Connexion requise.' using errcode = '42501'; end if;
  select c.user_id into f from codes_faiseur c where c.code = upper(btrim(choisir_faiseur.code));
  if f is null then raise exception 'Code de faiseur inconnu.' using errcode = 'P0002'; end if;
  if f = auth.uid() then raise exception 'Vous ne pouvez pas être votre propre faiseur de disciple.' using errcode = '22023'; end if;
  perform set_config('crs.faiseur_par_code', 'oui', true);
  update profils set faiseur_id = f where profils.id = auth.uid();
  perform set_config('crs.faiseur_par_code', '', true);
  return query select p.id, p.nom, p.prenoms from profils p where p.id = f;
end $$;

-- Pour chaque personne que je peux voir : le nom de son assemblée et celui de son faiseur
-- (même quand ils sont dans une autre assemblée que la mienne).
create or replace function public.liens_visibles()
returns table (personne uuid, assemblee text, faiseur text)
language sql stable security definer set search_path = public as $$
  select p.id,
         coalesce(a.nom, nullif(p.assemblee_nom, ''), ''),
         coalesce(nullif(btrim(coalesce(f.nom, '') || ' ' || coalesce(f.prenoms, '')), ''), p.faiseur_nom, '')
  from profils p
  left join assemblees a on a.id = p.assemblee_id
  left join profils f on f.id = p.faiseur_id
  where peut_voir(p.id);
$$;

revoke all on function public.mon_code_faiseur(), public.changer_code_faiseur(), public.choisir_faiseur(text), public.liens_visibles()
  from public, anon, authenticated;
grant execute on function public.mon_code_faiseur(), public.changer_code_faiseur(), public.choisir_faiseur(text), public.liens_visibles()
  to authenticated;
