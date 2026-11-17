/* Vérifie la connexion et la synchronisation contre un faux serveur Supabase. Lancer : node --test tests/compte.test.js */
const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { creer } = require(path.join(__dirname, "..", "web", "compte.js"));

const URL_API = "https://projet.supabase.co";
const UID = "11111111-1111-1111-1111-111111111111";

function stockage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
}
function jwt(charge) {
  const b = (o) => Buffer.from(JSON.stringify(o)).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  return b({ alg: "HS256" }) + "." + b(charge) + ".signature";
}

/* Faux serveur : enregistre chaque requête et répond selon des règles simples. */
function faux(options = {}) {
  const s = { appels: [], entrees: [], horloge: 1000, refreshs: 0, jetonValide: "jeton-1", panne: false, motDePasse: "bon-mot-de-passe", ...options };
  const rep = (statut, corps) => Promise.resolve({ ok: statut < 300, status: statut, text: () => Promise.resolve(corps === undefined ? "" : JSON.stringify(corps)) });
  s.fetch = (url, init) => {
    if (s.panne) return Promise.reject(new TypeError("Failed to fetch"));
    const u = new URL(url);
    const corps = init.body ? JSON.parse(init.body) : undefined;
    s.appels.push({ methode: init.method, chemin: u.pathname, params: u.searchParams, entetes: init.headers, corps });
    const auth = init.headers.Authorization;
    if (u.pathname === "/auth/v1/signup") {
      if (s.confirmation) return rep(200, { id: UID, email: corps.email });
      return rep(200, { access_token: s.jetonValide, refresh_token: "r1", expires_in: 3600, user: { id: UID, email: corps.email } });
    }
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "password") {
      const attendu = s.ancienCompte ? s.motDePasse : s.motDePasse + "#crs-carnet";   // un ancien compte a son mot de passe tel quel
      if (corps.password !== attendu) return rep(400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" });
      return rep(200, { access_token: s.jetonValide, refresh_token: "r1", expires_in: 3600, user: { id: UID, email: corps.email } });
    }
    if (u.pathname === "/auth/v1/token" && u.searchParams.get("grant_type") === "refresh_token") {
      s.refreshs++;
      if (s.refreshRefuse) return rep(400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
      s.jetonValide = "jeton-" + (s.refreshs + 1);
      return rep(200, { access_token: s.jetonValide, refresh_token: "r" + (s.refreshs + 1), expires_in: 3600, user: { id: UID, email: "a@b.c" } });
    }
    if (u.pathname === "/auth/v1/logout") return rep(204);
    if (u.pathname === "/auth/v1/user" && init.method === "PUT") { s.nouveauMdp = corps.password; return rep(200, { id: UID }); }
    if (u.pathname.startsWith("/rest/") && auth !== "Bearer " + s.jetonValide) return rep(401, { code: "PGRST303", message: "JWT expired" });
    if (u.pathname === "/rest/v1/rpc/rejoindre_assemblee") {
      if (corps.code !== "ABCD2345") return rep(400, { code: "P0002", message: "Code d'assemblée inconnu." });
      return rep(200, [{ id: "a1", nom: "Chez les Test", zone: "Abidjan" }]);
    }
    if (u.pathname === "/rest/v1/rpc/quitter_assemblee") return rep(204);
    if (u.pathname === "/rest/v1/entrees" && init.method === "POST") {
      if (s.pendantEnvoi) s.pendantEnvoi();
      corps.forEach((l) => {
        s.horloge++;
        const i = s.entrees.findIndex((e) => e.user_id === l.user_id && e.cle === l.cle);
        const ligne = { ...l, maj: "2026-11-17T10:00:" + String(s.horloge).padStart(6, "0") + "+00:00" };
        if (i >= 0) s.entrees[i] = ligne; else s.entrees.push(ligne);
      });
      return rep(201);
    }
    if (u.pathname === "/rest/v1/entrees" && init.method === "GET") {
      let l = s.entrees.filter((e) => "eq." + e.user_id === u.searchParams.get("user_id"));
      const or = u.searchParams.get("or");
      if (or) {
        const m = /^\(maj\.gt\."(.+)",and\(maj\.eq\."(.+)",cle\.gt\."(.+)"\)\)$/.exec(or);
        l = l.filter((e) => e.maj > m[1] || (e.maj === m[2] && e.cle > m[3]));
      }
      l.sort((a, b) => (a.maj < b.maj ? -1 : a.maj > b.maj ? 1 : a.cle < b.cle ? -1 : 1));
      return rep(200, l.slice(0, Number(u.searchParams.get("limit"))).map(({ cle, donnees, maj }) => ({ cle, donnees, maj })));
    }
    return rep(404, { message: "inconnu" });
  };
  return s;
}
function client(serveur, st = stockage(), maintenant = () => 1_700_000_000_000) {
  return { st, c: creer({ config: { url: URL_API + "/", cle: "sb_publishable_test", urlSite: "https://moi.github.io/app/" }, stockage: st, fetch: serveur.fetch, maintenant }) };
}
function magasin() {
  const m = {};
  return { m, lire: (k) => m[k] || null, ecrire: (k, v) => { m[k] = v; } };
}

test("inscription : session ouverte, ou confirmation par e-mail demandée", async () => {
  const s = faux();
  const { c } = client(s);
  const r = await c.inscrire({ email: "a@b.c", motDePasse: "12345678", nom: "KONAN", prenoms: "Aya", contact: "07", zone: "Abidjan" });
  assert.deepStrictEqual(r, { connecte: true, confirmation: false });
  assert.strictEqual(c.session().id, UID);
  assert.deepStrictEqual(s.appels[0].corps.data, { nom: "KONAN", prenoms: "Aya", contact: "07", zone: "Abidjan" });
  assert.strictEqual(s.appels[0].entetes.apikey, "sb_publishable_test");
  assert.strictEqual(s.appels[0].entetes.Authorization, undefined, "la clé publique ne va jamais dans Authorization");

  const s2 = faux({ confirmation: true });
  const { c: c2 } = client(s2);
  assert.deepStrictEqual(await c2.inscrire({ email: "a@b.c", motDePasse: "12345678" }), { connecte: false, confirmation: true });
  assert.strictEqual(c2.session(), null);
});

test("connexion : mauvais mot de passe expliqué en français", async () => {
  const { c } = client(faux());
  await assert.rejects(c.connecter("a@b.c", "faux"), { message: "E-mail ou mot de passe incorrect." });
  assert.strictEqual(c.session(), null);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  assert.strictEqual(c.session().email, "a@b.c");
});

test("session expirée : un seul rafraîchissement pour plusieurs requêtes simultanées", async () => {
  const s = faux();
  let heure = 1_700_000_000_000;
  const { c } = client(s, stockage(), () => heure);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  heure += 3600 * 1000;                      // une heure plus tard : le jeton a expiré
  await Promise.all([c.assemblee.quitter(), c.assemblee.quitter(), c.assemblee.quitter()]);
  assert.strictEqual(s.refreshs, 1);
  assert.ok(s.appels.filter((a) => a.chemin === "/rest/v1/rpc/quitter_assemblee").every((a) => a.entetes.Authorization === "Bearer jeton-2"));
});

test("jeton refusé par le serveur : rafraîchit puis réessaie une fois", async () => {
  const s = faux();
  const { c } = client(s);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  s.jetonValide = "jeton-changé";            // le serveur n'accepte plus l'ancien jeton
  s.refreshs = 5;                            // le prochain jeton émis sera « jeton-7 »
  await c.assemblee.quitter();
  assert.strictEqual(s.refreshs, 6);
  assert.strictEqual(s.appels.at(-1).entetes.Authorization, "Bearer jeton-7");
});

test("session définitivement expirée : déconnexion annoncée", async () => {
  const s = faux({ refreshRefuse: true });
  let heure = 1_700_000_000_000;
  const { c } = client(s, stockage(), () => heure);
  const evts = [];
  c.ecouter((e) => evts.push(e));
  await c.connecter("a@b.c", "bon-mot-de-passe");
  heure += 2 * 3600 * 1000;
  await assert.rejects(c.assemblee.quitter(), { message: "Votre session a expiré. Reconnectez-vous." });
  assert.strictEqual(c.session(), null);
  assert.deepStrictEqual(evts, ["connecte", "deconnecte"]);
});

test("messages des fonctions de la base transmis tels quels", async () => {
  const { c } = client(faux());
  await c.connecter("a@b.c", "bon-mot-de-passe");
  await assert.rejects(c.assemblee.rejoindre("MAUVAIS"), { message: "Code d'assemblée inconnu." });
  assert.deepStrictEqual(await c.assemblee.rejoindre("ABCD2345"), { id: "a1", nom: "Chez les Test", zone: "Abidjan" });
});

test("synchronisation : envoie les saisies en attente puis récupère celles des autres appareils", async () => {
  const s = faux();
  const { c, st } = client(s);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  s.entrees.push({ user_id: UID, cle: "jours/2026-11-10", donnees: { moi: 10 }, maj: "2026-11-17T09:00:000001+00:00" });
  const m = magasin();
  m.ecrire("jours/2026-11-16", { moi: 30 });
  c.noter("jours/2026-11-16");
  c.noter("reglages/profil");                 // le profil n'est pas une saisie : ignoré
  assert.strictEqual(c.enAttente(), 1);
  const b = await c.synchroniser(m);
  assert.deepStrictEqual(b, { envoyes: 1, recus: 2 });
  assert.strictEqual(c.enAttente(), 0);
  assert.deepStrictEqual(m.m["jours/2026-11-10"], { moi: 10 });
  const envoi = s.appels.find((a) => a.methode === "POST" && a.chemin === "/rest/v1/entrees");
  assert.strictEqual(envoi.params.get("on_conflict"), "user_id,cle");
  assert.match(envoi.entetes.Prefer, /resolution=merge-duplicates/);
  assert.deepStrictEqual(envoi.corps, [{ user_id: UID, cle: "jours/2026-11-16", donnees: { moi: 30 } }]);
  assert.ok(JSON.parse(st.getItem("crs:" + UID + ":_curseur")).maj);
  /* Deuxième passage : rien de neuf. */
  assert.deepStrictEqual(await c.synchroniser(m), { envoyes: 0, recus: 0 });
});

test("synchronisation : une saisie modifiée pendant l'envoi reste en attente et n'est pas écrasée", async () => {
  const s = faux();
  const { c } = client(s);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  const m = magasin();
  m.ecrire("jours/2026-11-16", { moi: 30 });
  c.noter("jours/2026-11-16");
  s.pendantEnvoi = () => { m.ecrire("jours/2026-11-16", { moi: 45 }); c.noter("jours/2026-11-16"); s.pendantEnvoi = null; };
  await c.synchroniser(m);
  assert.strictEqual(c.enAttente(), 1, "la nouvelle valeur doit encore partir");
  assert.deepStrictEqual(m.m["jours/2026-11-16"], { moi: 45 }, "la valeur du serveur n'écrase pas la saisie locale");
  await c.synchroniser(m);
  assert.strictEqual(c.enAttente(), 0);
  assert.deepStrictEqual(s.entrees.find((e) => e.cle === "jours/2026-11-16").donnees, { moi: 45 });
});

test("synchronisation : plus de 500 saisies récupérées par pages", async () => {
  const s = faux();
  const { c } = client(s);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  for (let i = 0; i < 1203; i++) s.entrees.push({ user_id: UID, cle: "jours/2020-01-" + String(i).padStart(4, "0"), donnees: { i }, maj: "2026-11-17T08:00:000000+00:00" });
  const m = magasin();
  const b = await c.synchroniser(m);
  assert.strictEqual(b.recus, 1203);
  assert.strictEqual(Object.keys(m.m).length, 1203);
});

test("sans connexion internet : message clair et saisies gardées en attente", async () => {
  const s = faux();
  const { c } = client(s);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  const m = magasin();
  m.ecrire("mois/2026-11", { revenu: 1 });
  c.noter("mois/2026-11");
  s.panne = true;
  await assert.rejects(c.synchroniser(m), { code: "reseau", message: /Pas de connexion internet/ });
  assert.strictEqual(c.enAttente(), 1);
  assert.notStrictEqual(c.session(), null, "une panne de réseau ne déconnecte pas");
  s.panne = false;
  await c.synchroniser(m);
  assert.strictEqual(c.enAttente(), 0);
});

test("lien reçu par e-mail : mot de passe oublié et lien expiré", () => {
  const { c } = client(faux());
  const jeton = jwt({ sub: UID, email: "aya@exemple.ci" });
  assert.deepStrictEqual(c.lireLienEmail("#access_token=" + jeton + "&expires_in=3600&refresh_token=r9&token_type=bearer&type=recovery"), { type: "recuperation" });
  assert.deepStrictEqual(c.session(), { id: UID, email: "aya@exemple.ci" });
  assert.deepStrictEqual(c.lireLienEmail("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid"),
    { type: "erreur", message: "Ce lien a expiré. Demandez-en un nouveau." });
  assert.strictEqual(c.lireLienEmail("#mois"), null);
});

test("mot de passe oublié : le lien renvoie vers le site", async () => {
  const s = faux();
  const { c } = client(s);
  await c.motDePasseOublie("a@b.c").catch(() => {});
  assert.strictEqual(s.appels[0].chemin, "/auth/v1/recover");
  assert.strictEqual(s.appels[0].params.get("redirect_to"), "https://moi.github.io/app/");
});

test("saisies de plusieurs personnes : une seule requête filtrée", async () => {
  const s = faux();
  const { c } = client(s);
  await c.connecter("a@b.c", "bon-mot-de-passe");
  await c.saisiesDe(["u1", "u2"], "2026-11-16", "2026-11-22", ["semaines/2026-11-16"]).catch(() => {});
  const a = s.appels.at(-1);
  assert.strictEqual(a.params.get("user_id"), "in.(u1,u2)");
  assert.strictEqual(a.params.get("or"), "(and(cle.gte.jours/2026-11-16,cle.lte.jours/2026-11-22),cle.eq.semaines/2026-11-16)");
});

test("mot de passe : 4 caractères suffisent, complétés avant l'envoi au serveur", async () => {
  const s = faux();
  const { c } = client(s);
  await assert.rejects(c.inscrire({ email: "a@b.c", motDePasse: "123" }), { message: "Mot de passe trop court : au moins 4 caractères." });
  assert.strictEqual(s.appels.length, 0, "rien n'est envoyé si le code est trop court");
  await c.inscrire({ email: "a@b.c", motDePasse: "1234" });
  assert.strictEqual(s.appels[0].corps.password, "1234#crs-carnet");
  s.motDePasse = "1234";
  await c.connecter("a@b.c", "1234");
  assert.strictEqual(s.appels.at(-1).corps.password, "1234#crs-carnet");
  await c.changerMotDePasse("5678");
  assert.strictEqual(s.nouveauMdp, "5678#crs-carnet");
});

test("mot de passe : un compte créé avant ce réglage se connecte toujours, puis passe à la nouvelle forme", async () => {
  const s = faux({ ancienCompte: true, motDePasse: "ancienmotdepasse" });
  const { c } = client(s);
  await c.connecter("a@b.c", "ancienmotdepasse");
  assert.strictEqual(c.session().id, UID);
  const essais = s.appels.filter((a) => a.chemin === "/auth/v1/token").map((a) => a.corps.password);
  assert.deepStrictEqual(essais, ["ancienmotdepasse#crs-carnet", "ancienmotdepasse"]);
  await new Promise((r) => setTimeout(r, 20));
  assert.strictEqual(s.nouveauMdp, "ancienmotdepasse#crs-carnet");
});
