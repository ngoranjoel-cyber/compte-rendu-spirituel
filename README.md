# Compte rendu spirituel

Application pour noter chaque jour sa vie de prière (prier, méditer, prêcher), puis imprimer en PDF le compte rendu de la semaine et celui du mois, ou obtenir le classeur Excel rempli.

Chacun a son compte. Le **faiseur de disciple** suit les comptes rendus de ses disciples, et le **responsable d'assemblée** ceux de toute l'assemblée.

| Version | Où | Rappels |
|---|---|---|
| **Application Android** | APK construit par GitHub Actions | Notification toutes les 3 heures à partir de 4 h, tant que la journée n'est pas complète |
| **Site web installable** (iPhone, ordinateur) | GitHub Pages (dossier `web/`) | Pas de rappel automatique |

Les deux versions partagent la même interface et le même compte : on retrouve ses saisies sur tous ses appareils.

L'interface s'adapte à l'écran : sur téléphone, des onglets en bas (Journée, Semaine, Mois, Disciples, Profil) ; sur ordinateur, un menu à gauche et les sections côte à côte. Chaque saisie est une rangée avec son icône et des boutons − / + ; la journée s'enregistre toute seule après chaque modification.

### Installer sur chaque appareil

| Appareil | Comment |
|---|---|
| Android | Ouvrir l'APK (lien de la *Release* GitHub) ; autoriser l'installation depuis cette source |
| iPhone / iPad | Ouvrir l'adresse du site dans **Safari** > bouton Partager > **Sur l'écran d'accueil** |
| Ordinateur (Windows, Mac) | Ouvrir l'adresse du site dans **Chrome** ou **Edge** > icône **Installer** dans la barre d'adresse |

Une fois installé, le site s'ouvre en plein écran comme une application, avec sa propre icône.

## Fonctions

- **Compte** : inscription avec nom, prénoms, contact, zone / ville, e-mail et mot de passe ; connexion, mot de passe oublié, changement de mot de passe, suppression du compte.
- **Assemblée** : le responsable crée l'assemblée et reçoit un **code de 8 caractères** ; chaque membre rejoint l'assemblée avec ce code, puis choisit son faiseur de disciple dans la liste des membres. Si le faiseur ou l'assemblée ne sont pas encore sur l'application, on saisit leur nom.
- **Ma journée** : la bande des sept jours de la semaine (point vert : prier, méditer et prêcher faits ; orange : en partie), trois pastilles Prier / Méditer / Prêcher, puis les rangées de saisie : trois temps de prière (pour son faiseur de disciple, pour soi, pour les autres), prière de groupe, RDQD, lecture, évangélisation, jeûne, RS, sommeil.
- **La semaine** (du lundi au dimanche) : anneau du score, objectifs avec leur jauge, liste des sept jours, « Qu'est-ce que Dieu t'a dit cette semaine ? » et trois sujets de prière. Bouton **Imprimer / PDF de la semaine**.
- **Le mois** : calendrier coloré (touchez un jour pour l'ouvrir) et chiffres du mois. Avant d'imprimer, on saisit la somme reçue dans le mois et les dons (dîme, FMI, FMN, FE, FG, RTVC… jusqu'à 8 rubriques), chacun avec son pourcentage ou son montant, l'autre étant calculé. Puis les âmes gagnées, les livres lus et les besoins de prière. Bouton **Imprimer / PDF du mois**.
- **Mes disciples / Mon assemblée** : pour chaque personne suivie, le score de la semaine, les jours remplis, les totaux, et ses PDF de la semaine et du mois. Le responsable voit aussi le code d'invitation, nomme d'autres responsables et retire des membres.
- **Hors connexion** : on saisit sans internet ; les saisies partent dès que la connexion revient. L'état s'affiche sous le nom (« Synchronisé à 10:42 », « Hors connexion : 2 saisies à envoyer »).
- **Fichier Excel** : le classeur d'origine rempli (feuille MOIS, Semaine 1 à 6, Tableau de bord), avec ses formules.
- **Sauvegarde** : export et restauration de toutes ses saisies dans un fichier `.json`.
- **Rappels (Android)** : par défaut à 04:00, 07:00, 10:00, 13:00, 16:00, 19:00 et 22:00. La notification nomme ce qui manque et ne s'affiche plus dès que prier, méditer et prêcher sont remplis. Les horaires se règlent dans l'application.

### Qui voit quoi

| | Ses propres saisies | Celles de ses disciples | Celles de toute l'assemblée |
|---|---|---|---|
| Membre | lit et modifie | – | – |
| Faiseur de disciple | lit et modifie | lit seulement | – |
| Responsable d'assemblée | lit et modifie | lit seulement | lit seulement |

Personne ne peut modifier les saisies d'un autre. Le contact d'une personne n'est visible que de son faiseur de disciple et des responsables. Ces règles sont appliquées par la base de données elle-même (`supabase/schema.sql`), pas seulement par l'application, et elles sont testées à chaque envoi de code.

### Impression et PDF

« Imprimer / PDF » ouvre un aperçu qui reprend la présentation du classeur, puis la fenêtre d'impression du téléphone ou du navigateur : choisir « Enregistrer au format PDF » ou une imprimante. La semaine s'imprime en A4 paysage, le mois en A4 portrait, sur une page.

### Ce qui change par rapport au classeur d'origine

- Les colonnes « Conquête » et « Disciple » sont masquées : il reste Faiseur, Moi, Autre.
- Le bloc « Dons au Seigneur » de la feuille MOIS accueille 8 rubriques (deux par ligne) au lieu de 3.
- Une feuille « Semaine 6 » est ajoutée : certains mois s'étalent sur six semaines, et la formule de la feuille MOIS pointait vers une feuille absente (`#REF!`).
- Les objectifs du bilan sont ceux du « Tableau de bord » : 1 h de prière seul et 3 chapitres par jour, 7 RDQD, 1 h de prière de groupe et 1 jour de jeûne par semaine.
- Le contact et la zone figurent sur les PDF ; dans le fichier Excel, la zone suit l'assemblée et le contact n'apparaît pas.

## Mise en route

Trois étapes, dans cet ordre : le serveur des comptes (Supabase), puis GitHub, puis l'installation.

### 1. Le serveur des comptes (Supabase, gratuit)

1. Créez un compte sur [supabase.com](https://supabase.com), puis un projet (*New project*). Notez le mot de passe de la base dans un endroit sûr.
2. **Créer la base** : menu *SQL Editor* > *New query*, collez tout le contenu de `supabase/schema.sql`, cliquez *Run*. Le script peut être relancé sans danger après une mise à jour.
3. **Inscriptions sans e-mail de confirmation** : menu *Authentication* > *Sign In / Providers* > *Email*, désactivez **Confirm email** et mettez la longueur minimale du mot de passe à **8**. Le service d'e-mails fourni par Supabase n'écrit qu'aux membres de l'équipe du projet, deux fois par heure au plus : sans cette étape, personne d'autre ne pourrait s'inscrire.
4. **Adresse du site** : *Authentication* > *URL Configuration* > *Site URL* : l'adresse GitHub Pages (étape 2.4), par exemple `https://votre-compte.github.io/compte-rendu-spirituel/`.
5. **Clés** : *Project Settings* > *API Keys* : copiez la **Project URL** et la **Publishable key** (`sb_publishable_…`), et collez-les dans `web/config.js` avec l'adresse du site :
   ```js
   window.CONFIG_COMPTE = {
     url: "https://abcdefghijkl.supabase.co",
     cle: "sb_publishable_…",
     urlSite: "https://votre-compte.github.io/compte-rendu-spirituel/"
   };
   ```
   Ces valeurs sont publiques par nature (elles finissent dans l'application) : ne mettez jamais la *secret key* dans ce fichier.

Les noms des menus de Supabase peuvent légèrement changer ; les réglages restent les mêmes.

**« Mot de passe oublié »** a besoin d'un vrai service d'e-mails. Branchez-en un gratuit (Brevo, Resend…) dans *Authentication* > *Emails* > *SMTP Settings*. Vous pourrez alors aussi réactiver *Confirm email*. En attendant, une personne qui a oublié son mot de passe peut être aidée depuis le tableau de bord Supabase (*Authentication* > *Users*).

**Sans `config.js` rempli**, l'application fonctionne comme avant, sans compte : les saisies restent sur l'appareil et le suivi des disciples n'existe pas.

### 2. GitHub

1. Créez un dépôt vide sur GitHub (par exemple `compte-rendu-spirituel`).
2. Dans ce dossier :
   ```bash
   git init -b main
   git add .
   git commit -m "Première version"
   git remote add origin https://github.com/VOTRE-COMPTE/compte-rendu-spirituel.git
   git push -u origin main
   ```
3. **APK** : onglet *Actions* > *Application Android* > dernière exécution > section *Artifacts* > `CompteRenduSpirituel-apk`.
4. **Site** : *Settings* > *Pages* > *Source* : **GitHub Actions**, puis relancez le workflow *Site web (GitHub Pages)*. Avec un compte gratuit, GitHub Pages demande un dépôt public ; les saisies, elles, sont dans Supabase et ne sont pas dans le dépôt.

À chaque envoi de code, GitHub vérifie le fichier Excel, la connexion, les règles d'accès de la base et un parcours complet dans un navigateur, puis construit l'APK.

#### Clé de signature (avant d'installer pour de bon)

Sans clé, chaque APK est signé différemment : Android refuse alors la mise à jour et il faut désinstaller l'application. Avec les comptes en ligne, les saisies déjà envoyées ne sont pas perdues, mais celles en attente d'envoi le seraient. Créez la clé une seule fois :

```bash
keytool -genkeypair -v -keystore cles.jks -alias compterendu -keyalg RSA -keysize 2048 -validity 10000
base64 -w0 cles.jks > cles.txt      # sous Windows : certutil -encode cles.jks cles.txt
```

Puis dans *Settings* > *Secrets and variables* > *Actions*, ajoutez quatre secrets :

| Secret | Valeur |
|---|---|
| `KEYSTORE_BASE64` | contenu de `cles.txt` (sans les lignes BEGIN/END si vous utilisez certutil) |
| `KEYSTORE_PASSWORD` | mot de passe du fichier de clés |
| `KEY_ALIAS` | `compterendu` |
| `KEY_PASSWORD` | mot de passe de la clé |

Gardez `cles.jks` et ses mots de passe en lieu sûr, hors du dépôt.

#### Publier une version

```bash
git tag v1.0.0
git push origin v1.0.0
```

L'APK est alors joint à une *Release* du dépôt : c'est le lien à partager.

### 3. Installation et premiers pas

1. **Le responsable** installe l'application (APK sur Android, site sur iPhone), crée son compte, puis « Je suis responsable d'assemblée » : il reçoit le code de l'assemblée.
2. Il partage le lien de l'application et le code (par exemple dans le groupe WhatsApp de l'assemblée).
3. **Chaque membre** crée son compte, saisit le code, puis choisit son faiseur de disciple.
4. Le faiseur de disciple voit apparaître la barre **Mes disciples** dès qu'un disciple l'a choisi.

## Ce qu'il faut savoir

- **Offre gratuite de Supabase** : 500 Mo de base (des années de comptes rendus pour une assemblée), 50 000 utilisateurs actifs par mois, **pas de sauvegarde automatique**, et le projet est mis en pause s'il n'est pas utilisé pendant 7 jours. Les données sont alors gardées et le projet se relance depuis le tableau de bord. L'offre Pro (25 $ par mois) supprime la pause et ajoute des sauvegardes quotidiennes.
- **Données personnelles** : les comptes rendus contiennent des informations personnelles, dont les revenus et les dons. Informez les membres de qui voit quoi (tableau plus haut) avant qu'ils s'inscrivent, et renseignez-vous sur les obligations de protection des données qui s'appliquent à votre assemblée.
- **Un compte par personne** : sur un téléphone partagé, chacun se connecte à son tour ; les saisies de chaque compte sont rangées séparément sur l'appareil.
- **Saisies faites avant les comptes** : à la première connexion, l'application propose de les ajouter au compte.

## Organisation

```
web/                      Interface commune (site et application)
  index.html              Écrans (structure) et jeu d'icônes
  style.css               Présentation : téléphone, ordinateur, pages imprimables
  app.js                  Logique des écrans, saisie, navigation, impression
  compte.js               Comptes en ligne et synchronisation (sans bibliothèque externe)
  config.js               Adresse et clé publique du serveur Supabase
  xl.js                   Semaines du mois et remplissage du classeur Excel
  rapport.js              Bilan, totaux et pages imprimables
  modele.js               Classeur modèle (sans donnée personnelle)
  jszip.min.js            Bibliothèque JSZip (licence MIT)
  sw.js, manifest…        Installation et usage hors connexion du site
supabase/
  schema.sql              Tables, règles d'accès et fonctions de la base
  tests/                  Tests des règles d'accès sur une base PostgreSQL qui imite Supabase
android/                  Projet Android (Java, sans bibliothèque externe)
  app/src/main/java/…     MainActivity, Rappels, Horaires, RappelReceiver, BootReceiver
outils/preparer_modele.py Fabrique web/modele.js à partir du classeur décompressé
tests/                    Classeur, pages imprimables, connexion (Node) ; horaires (Java)
  navigateur/             Parcours complet à trois personnes dans un navigateur
.github/workflows/        android.yml (tests + APK), pages.yml (site)
```

Le projet Android sert le dossier `web/` à l'adresse `https://appassets.androidplatform.net/` : une modification de l'interface vaut pour les deux versions.

## Tests

```bash
# Fichier Excel, pages imprimables, connexion et synchronisation
node --test tests/xl.test.js tests/compte.test.js

# Horaires des rappels
javac -encoding UTF-8 -d /tmp/classes android/app/src/main/java/ci/compterendu/spirituel/Horaires.java tests/HorairesTest.java && java -cp /tmp/classes HorairesTest

# Règles d'accès (PostgreSQL requis ; variables PGHOST, PGUSER, PGPASSWORD)
sh supabase/tests/lancer.sh

# Parcours complet (PostgreSQL et Playwright requis)
sh tests/navigateur/lancer.sh
```

## Si les rappels n'arrivent pas

- Autorisez les notifications de l'application.
- Sur certains téléphones (Tecno, Infinix, Xiaomi, Samsung…), mettez la batterie de l'application sur « Non restreint » et autorisez le démarrage automatique.
- Un rappel peut arriver quelques minutes après l'heure prévue quand le téléphone est en veille.

Android 10 ou plus récent est nécessaire.
