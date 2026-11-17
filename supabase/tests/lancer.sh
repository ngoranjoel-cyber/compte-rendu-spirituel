#!/bin/sh
# Teste les règles d'accès de supabase/schema.sql sur une base PostgreSQL qui imite Supabase.
# Connexion : variables PGHOST, PGUSER, PGPASSWORD (par défaut : serveur local, utilisateur postgres).
# Usage : sh supabase/tests/lancer.sh
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
SCHEMA="$ICI/../schema.sql"
export PGUSER="${PGUSER:-postgres}"
psql -q -d postgres -c "drop database if exists essai_compte_rendu" -c "create database essai_compte_rendu" >/dev/null 2>&1
psql -q -d essai_compte_rendu -v ON_ERROR_STOP=1 -f "$ICI/supabase_simule.sql"
psql -q -d essai_compte_rendu -v ON_ERROR_STOP=1 -f "$SCHEMA" >/dev/null 2>&1
# Une deuxième fois : le script doit pouvoir être relancé sans erreur.
psql -q -d essai_compte_rendu -v ON_ERROR_STOP=1 -f "$SCHEMA" >/dev/null 2>&1
SORTIE="$(psql -d essai_compte_rendu -v ON_ERROR_STOP=1 -f "$ICI/tests_regles.sql" 2>&1)" || { echo "$SORTIE" | grep -E "ÉCHEC|ERROR"; exit 1; }
echo "$SORTIE" | grep -E "NOTICE:  ok" | sed 's/^.*NOTICE:  //'
echo "Toutes les règles d'accès sont respectées."
