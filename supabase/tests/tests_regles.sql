\set ON_ERROR_STOP 1
\set QUIET 1
begin;
-- Personnes : R responsable de l'assemblée A, F faiseur, D1 disciple de F, D2 membre de A,
-- X responsable d'une autre assemblée B.
insert into auth.users (id, email, raw_user_meta_data) values
 ('00000000-0000-0000-0000-0000000000a1','r@test','{"nom":"RESP","prenoms":"Rita","contact":"0101","zone":"Abidjan"}'),
 ('00000000-0000-0000-0000-0000000000f1','f@test','{"nom":"FAISEUR","prenoms":"Fred","contact":"0202","zone":"Abidjan"}'),
 ('00000000-0000-0000-0000-0000000000d1','d1@test','{"nom":"DISCIPLE","prenoms":"Un","contact":"0303","zone":"Abidjan"}'),
 ('00000000-0000-0000-0000-0000000000d2','d2@test','{"nom":"DISCIPLE","prenoms":"Deux","contact":"0404","zone":"Abidjan"}'),
 ('00000000-0000-0000-0000-0000000000b1','x@test','{"nom":"AUTRE","prenoms":"Xavier","contact":"0505","zone":"Bouaké"}');

create temp table t_code (code text);
grant all on t_code to authenticated;

create or replace function pg_temp.ok(cond boolean, nom text) returns void language plpgsql as $$
begin
  if not coalesce(cond, false) then raise exception 'ÉCHEC : %', nom; end if;
  raise notice 'ok - %', nom;
end $$;
-- Exécute une requête en tant que « qui » et renvoie le message d'erreur (null si elle passe).
create or replace function pg_temp.erreur(qui uuid, requete text) returns text language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(qui::text, ''), true);
  execute 'set local role ' || case when qui is null then 'anon' else 'authenticated' end;
  begin
    execute requete;
  exception when others then
    reset role;
    return sqlerrm;
  end;
  reset role;
  return null;
end $$;
-- Compte les lignes visibles par « qui ».
create or replace function pg_temp.voit(qui uuid, requete text) returns bigint language plpgsql as $$
declare n bigint;
begin
  perform set_config('request.jwt.claim.sub', qui::text, true);
  set local role authenticated;
  execute 'select count(*) from (' || requete || ') x' into n;
  reset role;
  return n;
end $$;

\set R '\'00000000-0000-0000-0000-0000000000a1\'::uuid'
\set F '\'00000000-0000-0000-0000-0000000000f1\'::uuid'
\set D1 '\'00000000-0000-0000-0000-0000000000d1\'::uuid'
\set D2 '\'00000000-0000-0000-0000-0000000000d2\'::uuid'
\set X '\'00000000-0000-0000-0000-0000000000b1\'::uuid'

select pg_temp.ok((select count(*) from profils) = 5 and (select contact from profils where id = :D1) = '0303', 'inscription : profil créé avec nom, prénoms, contact, zone');

-- Création et adhésion aux assemblées
select pg_temp.ok(pg_temp.erreur(:R, $q$insert into t_code select code from creer_assemblee('Chez les Test', 'Abidjan')$q$) is null, 'R crée l''assemblée A');
select pg_temp.ok((select role from profils where id = :R) = 'responsable', 'R devient responsable');
select pg_temp.ok((select length(code) from t_code) = 8, 'code d''invitation de 8 caractères');
select pg_temp.ok(pg_temp.erreur(:X, $q$select creer_assemblee('Assemblée B', 'Bouaké')$q$) is null, 'X crée l''assemblée B');
select pg_temp.ok(pg_temp.erreur(:F, $q$select rejoindre_assemblee('ZZZZZZZZ')$q$) like '%Code d''assemblée inconnu%', 'mauvais code refusé');
select pg_temp.ok(pg_temp.erreur(:F, $q$select rejoindre_assemblee((select lower(code) from t_code))$q$) is null, 'F rejoint A (code en minuscules accepté)');
select pg_temp.ok(pg_temp.erreur(:D1, $q$select rejoindre_assemblee((select code from t_code))$q$) is null, 'D1 rejoint A');
select pg_temp.ok(pg_temp.erreur(:D2, $q$select rejoindre_assemblee((select code from t_code))$q$) is null, 'D2 rejoint A');

-- Choix du faiseur de disciple
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set faiseur_id = '00000000-0000-0000-0000-0000000000b1' where id = auth.uid()$q$) like '%même assemblée%', 'faiseur d''une autre assemblée refusé');
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set faiseur_id = id where id = auth.uid()$q$) is not null, 'être son propre faiseur refusé');
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set faiseur_id = '00000000-0000-0000-0000-0000000000f1', faiseur_nom = 'x' where id = auth.uid()$q$) is null, 'D1 choisit F comme faiseur');
select pg_temp.ok((select faiseur_nom from profils where id = :D1) = '', 'le nom libre du faiseur est vidé quand il est lié');

-- Saisies de chacun (insertion puis mise à jour par upsert)
select pg_temp.ok(pg_temp.erreur(p, $q$insert into entrees (cle, donnees) values ('jours/2026-11-16', '{"moi":30}'), ('mois/2026-11', '{"revenu":100}')
   on conflict (user_id, cle) do update set donnees = excluded.donnees$q$) is null, 'saisie enregistrée')
  from unnest(array[:R, :F, :D1, :D2, :X]) p;
select pg_temp.ok(pg_temp.erreur(:D1, $q$insert into entrees (user_id, cle, donnees) values (auth.uid(), 'jours/2026-11-16', '{"moi":45}')
   on conflict (user_id, cle) do update set donnees = excluded.donnees$q$) is null, 'upsert accepté');
select pg_temp.ok((select donnees->>'moi' from entrees where user_id = :D1 and cle = 'jours/2026-11-16') = '45', 'upsert : la journée est mise à jour');
select pg_temp.ok(pg_temp.erreur(:D1, $q$insert into entrees (cle, donnees) values ('autre/chose', '{}')$q$) is not null, 'clé de saisie invalide refusée');

-- Qui voit quoi
select pg_temp.ok(pg_temp.voit(:D1, 'select * from entrees') = 2, 'D1 ne voit que ses saisies');
select pg_temp.ok(pg_temp.voit(:D2, 'select * from entrees') = 2, 'D2 ne voit que ses saisies');
select pg_temp.ok(pg_temp.voit(:F, 'select * from entrees') = 4
  and pg_temp.voit(:F, 'select * from entrees where user_id = ''00000000-0000-0000-0000-0000000000d1''') = 2, 'F voit ses saisies et celles de D1');
select pg_temp.ok(pg_temp.voit(:F, 'select * from entrees where user_id = ''00000000-0000-0000-0000-0000000000d2''') = 0, 'F ne voit pas D2 (pas son disciple)');
select pg_temp.ok(pg_temp.voit(:R, 'select * from entrees') = 8, 'R voit toute l''assemblée A (4 personnes)');
select pg_temp.ok(pg_temp.voit(:R, 'select * from entrees where user_id = ''00000000-0000-0000-0000-0000000000b1''') = 0, 'R ne voit pas l''autre assemblée');
select pg_temp.ok(pg_temp.voit(:X, 'select * from entrees') = 2, 'X ne voit que ses saisies');
select pg_temp.ok(pg_temp.voit(:F, 'select * from profils') = 2 and pg_temp.voit(:D1, 'select * from profils') = 1 and pg_temp.voit(:R, 'select * from profils') = 4, 'profils visibles : soi, ses disciples, l''assemblée pour le responsable');
select pg_temp.ok(pg_temp.erreur(null, 'select * from entrees') like '%permission denied%' and pg_temp.erreur(null, 'select * from profils') like '%permission denied%', 'visiteur non connecté : aucun accès');
select pg_temp.ok(pg_temp.erreur(null, $q$select mon_assemblee()$q$) like '%permission denied%', 'visiteur non connecté : fonctions refusées');

-- Personne ne modifie les saisies d'un autre
select pg_temp.ok(pg_temp.erreur(:F, $q$insert into entrees (user_id, cle, donnees) values ('00000000-0000-0000-0000-0000000000d1', 'jours/2026-11-17', '{}')$q$) like '%row-level security%', 'F ne peut pas écrire chez D1');
select pg_temp.erreur(:R, $q$update entrees set donnees = '{"pirate":1}' where user_id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.erreur(:R, $q$delete from entrees where user_id = '00000000-0000-0000-0000-0000000000d1'$q$);
select pg_temp.ok((select count(*) from entrees where user_id = :D1 and donnees ? 'pirate') = 0 and (select count(*) from entrees where user_id = :D1) = 2, 'le responsable ne modifie ni ne supprime les saisies d''un membre');

-- Les profils : rôle et assemblée ne se changent que par les fonctions prévues
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set role = 'responsable' where id = auth.uid()$q$) like '%permission denied%', 'D1 ne peut pas se nommer responsable');
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set assemblee_id = null where id = auth.uid()$q$) like '%permission denied%', 'D1 ne change pas d''assemblée sans code');
select pg_temp.erreur(:D1, $q$update profils set contact = 'pirate' where id = '00000000-0000-0000-0000-0000000000f1'$q$);
select pg_temp.ok((select contact from profils where id = :F) = '0202', 'D1 ne modifie pas le profil de F');
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set contact = '0999' where id = auth.uid()$q$) is null, 'D1 modifie son propre contact');
select pg_temp.ok((select contact from profils where id = :D1) = '0999', 'nouveau contact enregistré');
select pg_temp.ok(pg_temp.erreur(:D1, 'select * from assemblees') like '%permission denied%', 'la table des assemblées (et ses codes) n''est pas lisible');

-- Fonctions d'assemblée
select pg_temp.ok(pg_temp.voit(:D1, 'select * from mon_assemblee() where code is null and nom = ''Chez les Test''') = 1, 'un membre voit son assemblée sans le code');
select pg_temp.ok(pg_temp.voit(:R, 'select * from mon_assemblee() where code is not null') = 1, 'le responsable voit le code');
select pg_temp.ok(pg_temp.voit(:D1, 'select * from membres_assemblee()') = 4, 'liste des membres pour choisir son faiseur (4)');
select pg_temp.ok(pg_temp.voit(:X, 'select * from membres_assemblee()') = 1, 'X ne voit que son assemblée');
select pg_temp.ok(pg_temp.erreur(:D1, $q$select detacher('00000000-0000-0000-0000-0000000000f1')$q$) like '%permission denied%', 'fonction interne detacher non appelable');
select pg_temp.ok(pg_temp.erreur(:F, $q$select definir_responsable('00000000-0000-0000-0000-0000000000d2', true)$q$) like '%Réservé au responsable%', 'F ne peut pas nommer de responsable');
select pg_temp.ok(pg_temp.erreur(:X, $q$select definir_responsable('00000000-0000-0000-0000-0000000000d2', true)$q$) like '%pas membre%', 'un responsable d''une autre assemblée non plus');
select pg_temp.ok(pg_temp.erreur(:R, $q$select definir_responsable('00000000-0000-0000-0000-0000000000f1', true)$q$) is null and pg_temp.voit(:F, 'select * from entrees') = 8, 'R nomme F responsable : F voit toute l''assemblée');
select pg_temp.ok(pg_temp.erreur(:R, $q$select definir_responsable('00000000-0000-0000-0000-0000000000f1', false)$q$) is null and pg_temp.voit(:F, 'select * from entrees') = 4, 'R retire le rôle à F');
select pg_temp.ok(pg_temp.erreur(:D2, 'select changer_code_assemblee()') like '%Réservé%', 'un membre ne change pas le code');
select pg_temp.ok(pg_temp.erreur(:R, 'update t_code set code = changer_code_assemblee()') is null, 'R change le code');
select pg_temp.ok(pg_temp.erreur(:X, $q$select rejoindre_assemblee('ZZZZZZZZ')$q$) is not null, 'ancien code inutilisable (contrôle)');

-- Retrait d'un membre
select pg_temp.ok(pg_temp.erreur(:R, $q$select retirer_membre('00000000-0000-0000-0000-0000000000d1')$q$) is null, 'R retire D1 de l''assemblée');
select pg_temp.ok((select assemblee_id is null and faiseur_id is null and role = 'membre' from profils where id = :D1), 'D1 n''a plus d''assemblée ni de faiseur');
select pg_temp.ok(pg_temp.voit(:F, 'select * from entrees') = 2 and pg_temp.voit(:R, 'select * from entrees') = 6, 'F et R ne voient plus D1');
select pg_temp.ok(pg_temp.voit(:D1, 'select * from entrees') = 2, 'D1 garde ses saisies');
select pg_temp.ok(pg_temp.erreur(:D1, $q$select rejoindre_assemblee((select code from t_code))$q$) is null and pg_temp.voit(:D1, 'select * from mon_assemblee()') = 1, 'D1 peut revenir avec le nouveau code');

-- Quitter, puis supprimer son compte
select pg_temp.ok(pg_temp.erreur(:D2, 'select quitter_assemblee()') is null, 'D2 quitte l''assemblée');
select pg_temp.ok((select assemblee_id is null from profils where id = :D2), 'D2 n''a plus d''assemblée');
select pg_temp.ok(pg_temp.erreur(:D2, 'select supprimer_mon_compte()') is null, 'D2 supprime son compte');
select pg_temp.ok((select count(*) from auth.users where id = :D2) = 0 and (select count(*) from entrees where user_id = :D2) = 0 and (select count(*) from profils where id = :D2) = 0, 'compte, profil et saisies de D2 effacés');
-- Le responsable change d'assemblée : ses disciples perdent le lien
select pg_temp.ok(pg_temp.erreur(:D1, $q$update profils set faiseur_id = '00000000-0000-0000-0000-0000000000f1' where id = auth.uid()$q$) is null, 'D1 reprend F comme faiseur');
select pg_temp.ok(pg_temp.erreur(:F, $q$select creer_assemblee('Nouvelle', '')$q$) is null, 'F crée une autre assemblée');
select pg_temp.ok((select faiseur_id is null from profils where id = :D1), 'F change d''assemblée : le lien avec D1 est retiré');
rollback;
