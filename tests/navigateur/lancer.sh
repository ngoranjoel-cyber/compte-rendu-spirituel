#!/bin/sh
# Essai complet dans un navigateur : trois personnes (responsable, faiseur, disciple), deux appareils,
# coupure de connexion. Le faux serveur Supabase exécute les demandes sur une vraie base PostgreSQL
# avec supabase/schema.sql, donc avec les vraies règles d'accès.
# Prérequis : PostgreSQL (psql) et Playwright avec Chromium (npm install playwright && npx playwright install chromium).
# Usage : sh tests/navigateur/lancer.sh
set -e
ICI="$(cd "$(dirname "$0")" && pwd)"
RACINE="$ICI/../.."
export PGUSER="${PGUSER:-postgres}"
TMP="$(mktemp -d)"
psql -q -d postgres -c "drop database if exists essai_e2e" -c "create database essai_e2e" >/dev/null 2>&1
psql -q -d essai_e2e -v ON_ERROR_STOP=1 -f "$RACINE/supabase/tests/supabase_simule.sql"
psql -q -d essai_e2e -v ON_ERROR_STOP=1 -f "$RACINE/supabase/schema.sql" >/dev/null 2>&1
cp -r "$RACINE/web" "$TMP/site"
printf 'window.CONFIG_COMPTE = { url: "http://localhost:54321", cle: "sb_publishable_essai", urlSite: "http://localhost:8766/" };\n' > "$TMP/site/config.js"
node "$ICI/faux-supabase.js" 54321 essai_e2e > "$TMP/serveur.log" 2>&1 &
SERVEUR=$!
(cd "$TMP/site" && python3 -m http.server 8766 >/dev/null 2>&1) &
SITE=$!
trap 'kill $SERVEUR $SITE 2>/dev/null' EXIT
sleep 1
IMAGES="${IMAGES:-$TMP/captures}" node "$ICI/parcours.js" | tee "$TMP/resultat.txt"
grep -q 'erreurs de page : \[\]' "$TMP/resultat.txt"
echo "Parcours réussi. Captures : ${IMAGES:-$TMP/captures}"
