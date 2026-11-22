-- =====================================================================
-- Mise à jour « Finances » (novembre 2026) — à lancer une fois dans
-- Supabase > SQL Editor > New query > Run. Le script peut être relancé sans risque.
--
-- Les finances sont PRIVÉES : chaque personne ne lit et n'écrit que les siennes.
-- Ni le faiseur de disciple ni le dirigeant d'assemblée n'y ont accès.
-- =====================================================================
create table if not exists public.finances (
  user_id  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  cle      text not null check (cle ~ '^finance/(reglages|mois/[0-9]{4}-[0-9]{2})$'),
  donnees  jsonb not null check (jsonb_typeof(donnees) = 'object' and pg_column_size(donnees) < 400000),
  maj      timestamptz not null default now(),
  primary key (user_id, cle)
);
create index if not exists finances_maj on public.finances (user_id, maj);

drop trigger if exists date_finance on public.finances;
create trigger date_finance before insert or update on public.finances
  for each row execute function public.dater_entree();

alter table public.finances enable row level security;
revoke all on public.finances from public, anon, authenticated;
grant select, insert, update, delete on public.finances to authenticated;

drop policy if exists finances_lecture on public.finances;
create policy finances_lecture on public.finances for select to authenticated using (user_id = auth.uid());
drop policy if exists finances_creation on public.finances;
create policy finances_creation on public.finances for insert to authenticated with check (user_id = auth.uid());
drop policy if exists finances_modification on public.finances;
create policy finances_modification on public.finances for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists finances_suppression on public.finances;
create policy finances_suppression on public.finances for delete to authenticated using (user_id = auth.uid());
