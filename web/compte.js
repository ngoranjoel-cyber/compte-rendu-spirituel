/* Comptes en ligne et synchronisation (Supabase), sans bibliothèque externe.
   - Connexion par e-mail et mot de passe ; la session est gardée sur l'appareil.
   - Les saisies sont d'abord écrites sur l'appareil, puis envoyées dès que la connexion le permet.
   - Les saisies faites sur un autre appareil sont récupérées à l'ouverture et régulièrement. */
(function (racine) {
  "use strict";

  function creer(options) {
    var cfg = options.config || {};
    var url = String(cfg.url || "").replace(/\/+$/, "");
    var cle = cfg.cle || "";
    var urlSite = cfg.urlSite || "";
    var stock = options.stockage;        // { getItem, setItem, removeItem } (localStorage)
    var envoyer = options.fetch;          // fonction fetch
    var maintenant = options.maintenant || function () { return Date.now(); };
    var PREFIXE = "crs:";
    var ecouteurs = [];
    var refresh = null;                   // rafraîchissement de session en cours

    /* ---------- petites aides ---------- */
    function lireJson(k) { try { var v = stock.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
    function ecrireJson(k, v) { try { stock.setItem(k, JSON.stringify(v)); } catch (e) { /* mémoire pleine : on continue */ } }
    function emettre(evt, detail) { ecouteurs.slice().forEach(function (f) { try { f(evt, detail); } catch (e) { /* rien */ } }); }

    function Erreur(message, code, statut) {
      var e = new Error(message);
      e.code = code || "";
      e.statut = statut || 0;
      return e;
    }

    /* Messages compréhensibles pour les erreurs les plus courantes. */
    var MESSAGES = {
      invalid_credentials: "E-mail ou mot de passe incorrect.",
      invalid_grant: "E-mail ou mot de passe incorrect.",
      email_not_confirmed: "Confirmez d'abord votre adresse e-mail avec le lien reçu.",
      user_already_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous.",
      email_exists: "Un compte existe déjà avec cet e-mail. Connectez-vous.",
      weak_password: "Mot de passe trop court : au moins 4 caractères.",
      same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
      email_address_invalid: "Adresse e-mail invalide.",
      validation_failed: "Vérifiez l'e-mail et le mot de passe.",
      over_email_send_rate_limit: "Trop d'e-mails envoyés pour le moment. Réessayez dans une heure.",
      over_request_rate_limit: "Trop de tentatives. Patientez une minute puis réessayez.",
      email_address_not_authorized: "L'envoi d'e-mails n'est pas encore configuré pour cette application. Prévenez le dirigeant de votre assemblée.",
      signup_disabled: "Les inscriptions sont fermées pour le moment.",
      provider_disabled: "La connexion avec Google n'est pas encore activée sur le serveur.",
      validation_failed: "La connexion avec Google n'est pas encore activée sur le serveur.",
      PGRST202: "Le serveur n'est pas encore à jour : lancez le fichier SQL « maj-faiseur-rubriques.sql » dans Supabase.",
      email_provider_disabled: "Les inscriptions par e-mail sont désactivées sur le serveur (réglage Supabase > Authentication > Email).",
      session_not_found: "Votre session a expiré. Reconnectez-vous.",
      refresh_token_not_found: "Votre session a expiré. Reconnectez-vous.",
      refresh_token_already_used: "Votre session a expiré. Reconnectez-vous."
    };
    function versErreur(statut, corps) {
      corps = corps || {};
      var code = corps.error_code || corps.code || corps.error || "";
      var brut = corps.msg || corps.message || corps.error_description || "";
      if (MESSAGES[code]) return Erreur(MESSAGES[code], code, statut);
      if (/invalid login credentials/i.test(brut)) return Erreur(MESSAGES.invalid_credentials, "invalid_credentials", statut);
      if (/already registered/i.test(brut)) return Erreur(MESSAGES.user_already_exists, "user_already_exists", statut);
      if (/password should be/i.test(brut)) return Erreur(MESSAGES.weak_password, "weak_password", statut);
      if (statut === 401 || code === "PGRST301" || code === "PGRST303") return Erreur("Votre session a expiré. Reconnectez-vous.", "session", statut);
      if (statut === 429) return Erreur(MESSAGES.over_request_rate_limit, "rate_limit", statut);
      /* Les fonctions de la base (supabase/schema.sql) renvoient des messages déjà rédigés en français. */
      if (/^(P0001|P0002|22023|42501)$/.test(code) && brut && !/permission denied|row-level security/i.test(brut)) return Erreur(brut, code, statut);
      if (code === "23514") return Erreur("Une des valeurs saisies n'est pas acceptée.", code, statut);
      if (code === "42501") return Erreur("Vous n'avez pas le droit de faire cette modification.", code, statut);
      if (statut >= 500) return Erreur("Le serveur ne répond pas correctement. Réessayez plus tard.", code, statut);
      return Erreur(brut || "La demande a échoué (" + statut + ").", code, statut);
    }

    /* ---------- session ---------- */
    function session() { return lireJson(PREFIXE + "session"); }
    function garderSession(s) {
      var ancienne = session();
      if (s) ecrireJson(PREFIXE + "session", s);
      else stock.removeItem(PREFIXE + "session");
      if (!s && ancienne) emettre("deconnecte");
    }
    function depuisReponse(d) {
      if (!d || !d.access_token) return null;
      var exp = d.expires_at ? d.expires_at * 1000 : maintenant() + (Number(d.expires_in) || 3600) * 1000;
      var u = d.user || {};
      return { access_token: d.access_token, refresh_token: d.refresh_token, expire: exp, id: u.id, email: u.email };
    }
    function utilisateur() { var s = session(); return s ? { id: s.id, email: s.email } : null; }

    /* ---------- requêtes ---------- */
    function requete(chemin, o) {
      o = o || {};
      if (!url || !cle) return Promise.reject(Erreur("L'application n'est pas reliée à un serveur.", "config"));
      var entetes = { apikey: cle };
      if (o.corps !== undefined) entetes["Content-Type"] = "application/json";
      if (o.jeton) entetes.Authorization = "Bearer " + o.jeton;
      if (o.prefer) entetes.Prefer = o.prefer;
      return Promise.resolve()
        .then(function () {
          return envoyer(url + chemin, { method: o.methode || "GET", headers: entetes, body: o.corps === undefined ? undefined : JSON.stringify(o.corps) });
        })
        .catch(function () { throw Erreur("Pas de connexion internet. Réessayez quand vous serez connecté.", "reseau"); })
        .then(function (r) {
          return r.text().then(function (t) {
            var d = null;
            if (t) { try { d = JSON.parse(t); } catch (e) { d = { message: t }; } }
            if (!r.ok) throw versErreur(r.status, d);
            return d;
          });
        });
    }

    /* Renvoie un jeton valide, en rafraîchissant la session si elle expire bientôt. */
    function jeton() {
      var s = session();
      if (!s) return Promise.reject(Erreur("Connectez-vous d'abord.", "session"));
      if (s.expire - 60000 > maintenant()) return Promise.resolve(s.access_token);
      return rafraichir();
    }
    function rafraichir() {
      if (refresh) return refresh;
      var s = session();
      if (!s) return Promise.reject(Erreur("Connectez-vous d'abord.", "session"));
      refresh = requete("/auth/v1/token?grant_type=refresh_token", { methode: "POST", corps: { refresh_token: s.refresh_token } })
        .then(function (d) {
          var n = depuisReponse(d);
          if (!n) throw Erreur("Votre session a expiré. Reconnectez-vous.", "session");
          garderSession(n);
          return n.access_token;
        })
        .catch(function (e) {
          if (e.code !== "reseau") garderSession(null);
          throw e;
        })
        .then(function (t) { refresh = null; return t; }, function (e) { refresh = null; throw e; });
      return refresh;
    }
    /* Requête au nom de la personne connectée ; un refus de session déclenche un seul nouvel essai. */
    function api(chemin, o) {
      o = o || {};
      return jeton().then(function (t) {
        o.jeton = t;
        return requete(chemin, o).catch(function (e) {
          if (e.statut !== 401) throw e;
          return rafraichir().then(function (t2) { o.jeton = t2; return requete(chemin, o); });
        });
      });
    }
    function rpc(nom, params) { return api("/rest/v1/rpc/" + nom, { methode: "POST", corps: params || {} }); }
    function q(params) {
      return Object.keys(params).map(function (k) {
        return [].concat(params[k]).map(function (v) { return encodeURIComponent(k) + "=" + encodeURIComponent(v); }).join("&");
      }).join("&");
    }

    /* ---------- comptes ---------- */
    /* La personne choisit un code d'au moins 4 caractères (par exemple 4 chiffres). Supabase exige au moins
       6 caractères : l'application complète donc toujours le code de la même façon avant de l'envoyer. */
    var MIN_MOT_DE_PASSE = 4;
    var COMPLEMENT = "#crs-carnet";
    function motDePasseServeur(m) { return String(m) + COMPLEMENT; }
    function verifierLongueur(m) {
      if (String(m || "").length < MIN_MOT_DE_PASSE) return Promise.reject(Erreur(MESSAGES.weak_password, "weak_password"));
      return null;
    }
    function inscrire(d) {
      var refus = verifierLongueur(d.motDePasse);
      if (refus) return refus;
      return requete("/auth/v1/signup", {
        methode: "POST",
        corps: { email: d.email, password: motDePasseServeur(d.motDePasse),
          data: { nom: d.nom, prenoms: d.prenoms, contact: d.contact, zone: d.zone } }
      }).then(function (r) {
        var s = depuisReponse(r);
        if (s) { garderSession(s); emettre("connecte"); }
        return { connecte: !!s, confirmation: !s };
      });
    }
    function connecter(email, motDePasse) {
      function essai(m) { return requete("/auth/v1/token?grant_type=password", { methode: "POST", corps: { email: email, password: m } }); }
      var ancien = false;
      return essai(motDePasseServeur(motDePasse))
        .catch(function (e) {
          /* Compte créé avant ce réglage, avec le mot de passe tel quel : on réessaie une fois. */
          if (e.code !== "invalid_credentials" || String(motDePasse).length < 6) throw e;
          ancien = true;
          return essai(motDePasse);
        })
        .then(function (r) {
          var s = depuisReponse(r);
          if (!s) throw Erreur("Connexion impossible.", "session");
          garderSession(s); emettre("connecte");
          /* Ancien compte : on enregistre le mot de passe sous la nouvelle forme, pour les prochaines fois. */
          if (ancien) changerMotDePasse(motDePasse).catch(function () {});
          return utilisateur();
        });
    }
    function deconnecter() {
      var s = session();
      garderSession(null);
      if (s) requete("/auth/v1/logout", { methode: "POST", jeton: s.access_token }).catch(function () { /* hors connexion : la session expirera seule */ });
    }
    function motDePasseOublie(email) {
      var chemin = "/auth/v1/recover" + (urlSite ? "?redirect_to=" + encodeURIComponent(urlSite) : "");
      return requete(chemin, { methode: "POST", corps: { email: email } }).then(function () { return true; });
    }
    function changerMotDePasse(nouveau) {
      var refus = verifierLongueur(nouveau);
      if (refus) return refus;
      return api("/auth/v1/user", { methode: "PUT", corps: { password: motDePasseServeur(nouveau) } }).then(function () { return true; });
    }
    /* Lien reçu par e-mail (confirmation ou mot de passe oublié) : la session arrive dans l'adresse. */
    function lireLienEmail(hash) {
      if (!hash || hash.indexOf("access_token=") < 0 && hash.indexOf("error") < 0) return null;
      var p = {};
      hash.replace(/^#/, "").split("&").forEach(function (x) {
        var i = x.indexOf("=");
        if (i > 0) p[decodeURIComponent(x.slice(0, i))] = decodeURIComponent(x.slice(i + 1).replace(/\+/g, " "));
      });
      if (p.error || p.error_code) {
        var exp = p.error_code === "otp_expired";
        return { type: "erreur", message: exp ? "Ce lien a expiré. Demandez-en un nouveau." : (p.error_description || "Ce lien n'est pas valable.") };
      }
      var s = depuisReponse({ access_token: p.access_token, refresh_token: p.refresh_token, expires_in: p.expires_in, expires_at: p.expires_at ? Number(p.expires_at) : 0 });
      if (!s) return null;
      try {
        var charge = JSON.parse(atobUrl(p.access_token.split(".")[1]));
        s.id = charge.sub; s.email = charge.email;
      } catch (e) { return { type: "erreur", message: "Ce lien n'est pas valable." }; }
      garderSession(s); emettre("connecte");
      return { type: p.type === "recovery" ? "recuperation" : "confirmation" };
    }
    /* Connexion avec Google : la page part chez Google puis revient avec la session dans l'adresse (#access_token=…). */
    function adresseGoogle(retour) {
      return url + "/auth/v1/authorize?provider=google&redirect_to=" + encodeURIComponent(retour);
    }
    /* Nom et prénoms donnés par Google, lus dans le jeton de session. */
    function infosFournisseur() {
      var s = session();
      if (!s) return {};
      try {
        var m = JSON.parse(atobUrl(s.access_token.split(".")[1])).user_metadata || {};
        var complet = String(m.full_name || m.name || "").trim(), prenoms = m.given_name || "", nom = m.family_name || "";
        if (!nom && complet) { var i = complet.lastIndexOf(" "); nom = i > 0 ? complet.slice(i + 1) : complet; prenoms = prenoms || (i > 0 ? complet.slice(0, i) : ""); }
        return { nom: String(nom).toUpperCase(), prenoms: prenoms };
      } catch (e) { return {}; }
    }
    function atobUrl(b) {
      b = b.replace(/-/g, "+").replace(/_/g, "/");
      while (b.length % 4) b += "=";
      var bin = (typeof atob === "function" ? atob(b) : Buffer.from(b, "base64").toString("binary"));
      try { return decodeURIComponent(bin.split("").map(function (c) { return "%" + ("0" + c.charCodeAt(0).toString(16)).slice(-2); }).join("")); }
      catch (e) { return bin; }
    }
    function supprimerCompte() {
      return rpc("supprimer_mon_compte").then(function () { garderSession(null); return true; });
    }

    /* ---------- profil et assemblée ---------- */
    var CHAMPS_PROFIL = "id,nom,prenoms,contact,zone,role,assemblee_id,assemblee_nom,faiseur_id,faiseur_nom";
    function monProfil() {
      var u = utilisateur();
      if (!u) return Promise.reject(Erreur("Connectez-vous d'abord.", "session"));
      return api("/rest/v1/profils?" + q({ select: CHAMPS_PROFIL, id: "eq." + u.id })).then(function (l) { return (l && l[0]) || null; });
    }
    function majProfil(champs) {
      var u = utilisateur();
      if (!u) return Promise.reject(Erreur("Connectez-vous d'abord.", "session"));
      return api("/rest/v1/profils?" + q({ id: "eq." + u.id, select: CHAMPS_PROFIL }), { methode: "PATCH", corps: champs, prefer: "return=representation" })
        .then(function (l) {
          if (l && l[0]) return l[0];
          /* Profil absent (compte créé avant l'installation de la base) : on le crée. */
          var nouveau = { id: u.id };
          ["nom", "prenoms", "contact", "zone", "assemblee_nom", "faiseur_nom"].forEach(function (k) { if (champs[k] !== undefined) nouveau[k] = champs[k]; });
          return api("/rest/v1/profils?" + q({ select: CHAMPS_PROFIL }), { methode: "POST", corps: nouveau, prefer: "return=representation" })
            .then(function (l2) { return l2 && l2[0]; });
        });
    }
    function premier(l) { return Array.isArray(l) ? (l[0] || null) : l; }
    var assemblee = {
      mienne: function () { return rpc("mon_assemblee").then(premier); },
      membres: function () { return rpc("membres_assemblee").then(function (l) { return l || []; }); },
      creer: function (nom, zone) { return rpc("creer_assemblee", { nom: nom, zone: zone || "" }).then(premier); },
      rejoindre: function (code) { return rpc("rejoindre_assemblee", { code: code }).then(premier); },
      quitter: function () { return rpc("quitter_assemblee"); },
      changerCode: function () { return rpc("changer_code_assemblee"); },
      definirResponsable: function (id, oui) { return rpc("definir_responsable", { membre: id, responsable: !!oui }); },
      retirer: function (id) { return rpc("retirer_membre", { membre: id }); }
    };
    /* Faiseur de disciple, même d'une autre assemblée : chacun a un code personnel à donner à ses disciples. */
    var faiseur = {
      monCode: function () { return rpc("mon_code_faiseur", {}); },
      changerCode: function () { return rpc("changer_code_faiseur", {}); },
      choisir: function (code) { return rpc("choisir_faiseur", { code: code }).then(function (l) { return (l && l[0]) || null; }); }
    };
    /* Nom de l'assemblée et du faiseur de chaque personne visible (même hors de mon assemblée). */
    function liensVisibles() { return rpc("liens_visibles", {}).then(function (l) { return Array.isArray(l) ? l : []; }); }
    /* Profils que la personne peut voir : elle-même, ses disciples, l'assemblée pour un responsable. */
    function profilsVisibles() {
      return api("/rest/v1/profils?" + q({ select: CHAMPS_PROFIL, order: "nom.asc,prenoms.asc" })).then(function (l) { return l || []; });
    }
    /* Saisies de plusieurs personnes : journées entre deux dates, plus des clés précises (semaines, mois). */
    function saisiesDe(ids, du, au, autres) {
      if (!ids.length) return Promise.resolve([]);
      var conds = ["and(cle.gte.jours/" + du + ",cle.lte.jours/" + au + ")"];
      (autres || []).forEach(function (c) { conds.push("cle.eq." + c); });
      return api("/rest/v1/entrees?" + q({ select: "user_id,cle,donnees", user_id: "in.(" + ids.join(",") + ")", or: "(" + conds.join(",") + ")", limit: "5000" }))
        .then(function (l) { return l || []; });
    }

    /* ---------- synchronisation de mes saisies ---------- */
    function cleUtilisateur(k) { var u = utilisateur(); return u ? PREFIXE + u.id + ":" + k : null; }
    function enAttente() { return lireJson(cleUtilisateur("_attente")) || {}; }
    var SYNCHRONISABLE = /^(jours\/\d{4}-\d{2}-\d{2}|semaines\/\d{4}-\d{2}-\d{2}|mois\/\d{4}-\d{2}|reglages\/(dons|rubriques|objectifs))$/;
    /* À appeler après chaque enregistrement local. */
    function noter(k) {
      if (!utilisateur() || !SYNCHRONISABLE.test(k)) return;
      var a = enAttente();
      a[k] = (a[k] || 0) + 1;
      ecrireJson(cleUtilisateur("_attente"), a);
      emettre("attente", Object.keys(a).length);
    }
    var enCours = null;
    /* magasin : { lire(k), ecrire(k, v) } sur les données locales de la personne connectée. */
    function synchroniser(magasin) {
      if (enCours) return enCours;
      var u = utilisateur();
      if (!u) return Promise.resolve({ envoyes: 0, recus: 0 });
      var bilan = { envoyes: 0, recus: 0 };
      enCours = pousser(u, magasin, bilan)
        .then(function () { return tirer(u, magasin, bilan); })
        .then(function () { ecrireJson(cleUtilisateur("_derniere"), new Date(maintenant()).toISOString()); emettre("synchronise", bilan); return bilan; })
        .then(function (b) { enCours = null; return b; }, function (e) { enCours = null; emettre("erreur", e); throw e; });
      return enCours;
    }
    function pousser(u, magasin, bilan) {
      var a = enAttente(), cles = Object.keys(a);
      if (!cles.length) return Promise.resolve();
      var lot = cles.slice(0, 200), versions = {};
      var lignes = [];
      lot.forEach(function (k) {
        versions[k] = a[k];
        var v = magasin.lire(k);
        if (v && typeof v === "object") lignes.push({ user_id: u.id, cle: k, donnees: v });
      });
      var envoi = lignes.length
        ? api("/rest/v1/entrees?on_conflict=user_id,cle", { methode: "POST", corps: lignes, prefer: "resolution=merge-duplicates,return=minimal" })
        : Promise.resolve();
      return envoi.then(function () {
        var b = enAttente();
        lot.forEach(function (k) { if (b[k] === versions[k]) delete b[k]; });   // modifié pendant l'envoi : on le garde
        ecrireJson(cleUtilisateur("_attente"), b);
        bilan.envoyes += lignes.length;
        emettre("attente", Object.keys(b).length);
        if (cles.length > lot.length) return pousser(u, magasin, bilan);
      });
    }
    function tirer(u, magasin, bilan) {
      var curseur = lireJson(cleUtilisateur("_curseur")) || null;     // { maj, cle } de la dernière ligne reçue
      var p = { select: "cle,donnees,maj", user_id: "eq." + u.id, order: "maj.asc,cle.asc", limit: "500" };
      /* Les valeurs sont entre guillemets : la date contient « : », « . » et « + ». */
      if (curseur) p.or = '(maj.gt."' + curseur.maj + '",and(maj.eq."' + curseur.maj + '",cle.gt."' + curseur.cle + '"))';
      return api("/rest/v1/entrees?" + q(p)).then(function (l) {
        l = l || [];
        var attente = enAttente();
        l.forEach(function (r) {
          if (!attente[r.cle]) { magasin.ecrire(r.cle, r.donnees); bilan.recus++; }   // une modification locale non envoyée garde la main
        });
        if (l.length) {
          var der = l[l.length - 1];
          ecrireJson(cleUtilisateur("_curseur"), { maj: der.maj, cle: der.cle });
        }
        if (l.length === 500) return tirer(u, magasin, bilan);
      });
    }
    /* Une entrée envoyée à part (la photo de profil) : un refus du serveur ne bloque pas les saisies. */
    function envoyerEntree(k, donnees) {
      var u = utilisateur();
      if (!u) return Promise.reject(Erreur("Non connecté.", "session"));
      return api("/rest/v1/entrees?on_conflict=user_id,cle", { methode: "POST", corps: [{ user_id: u.id, cle: k, donnees: donnees }], prefer: "resolution=merge-duplicates,return=minimal" });
    }
    function derniereSynchro() { return lireJson(cleUtilisateur("_derniere")); }
    function oublierCurseur() { stock.removeItem(cleUtilisateur("_curseur")); }

    return {
      actif: !!(url && cle),
      MIN_MOT_DE_PASSE: MIN_MOT_DE_PASSE,
      urlSite: urlSite,
      session: utilisateur,
      ecouter: function (f) { ecouteurs.push(f); },
      inscrire: inscrire, connecter: connecter, deconnecter: deconnecter,
      motDePasseOublie: motDePasseOublie,
      adresseGoogle: adresseGoogle, infosFournisseur: infosFournisseur, changerMotDePasse: changerMotDePasse,
      lireLienEmail: lireLienEmail, supprimerCompte: supprimerCompte,
      monProfil: monProfil, majProfil: majProfil, assemblee: assemblee,
      profilsVisibles: profilsVisibles, saisiesDe: saisiesDe, faiseur: faiseur, liensVisibles: liensVisibles, envoyerEntree: envoyerEntree,
      noter: noter, synchroniser: synchroniser, enAttente: function () { return Object.keys(enAttente()).length; },
      derniereSynchro: derniereSynchro, oublierCurseur: oublierCurseur,
      _rafraichir: rafraichir
    };
  }

  var api = { creer: creer };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else racine.CompteEnLigne = api;
})(typeof self !== "undefined" ? self : this);
