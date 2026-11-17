package ci.compterendu.spirituel;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.InputStream;
import java.io.OutputStream;

/** Affiche l'interface (dossier assets) et lui donne accès aux fonctions du téléphone. */
public class MainActivity extends Activity {
    private static final String XLSX =
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    private static final int DEMANDE_FICHIER = 10;
    /** Adresse https fictive qui sert les fichiers du dossier assets : la page a ainsi une vraie origine
     *  https, ce qu'exige le serveur des comptes en ligne (la règle des origines refuse file://). */
    private static final String HOTE = "appassets.androidplatform.net";
    private static final String ACCUEIL = "https://" + HOTE + "/index.html";
    private WebView web;
    private ValueCallback<Uri[]> choixFichier;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Rappels.creerCanal(this);
        Rappels.programmer(this);
        demanderNotifications();

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView vue, WebResourceRequest demande) {
                Uri u = demande.getUrl();
                if (!"https".equals(u.getScheme()) || !HOTE.equals(u.getHost())) {
                    return null;                       // autres adresses (serveur des comptes) : réseau normal
                }
                String chemin = u.getPath() == null || "/".equals(u.getPath()) ? "index.html" : u.getPath().substring(1);
                try {
                    InputStream flux = getAssets().open(chemin);
                    return new WebResourceResponse(typeMime(chemin), "utf-8", flux);
                } catch (Exception e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Introuvable", null, null);
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView vue, WebResourceRequest demande) {
                Uri u = demande.getUrl();
                if (HOTE.equals(u.getHost())) {
                    return false;
                }
                // Liens vers d'autres sites ou numéros de téléphone : ouverts par l'application adaptée.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u));
                } catch (Exception e) {
                    // Aucune application pour ce lien.
                }
                return true;
            }
        });
        // Permet à la page d'ouvrir le sélecteur de fichiers (restauration d'une sauvegarde).
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView vue, ValueCallback<Uri[]> retour,
                                             FileChooserParams parametres) {
                if (choixFichier != null) {
                    choixFichier.onReceiveValue(null);
                }
                choixFichier = retour;
                try {
                    startActivityForResult(parametres.createIntent(), DEMANDE_FICHIER);
                } catch (Exception e) {
                    choixFichier = null;
                    retour.onReceiveValue(null);
                }
                return true;
            }
        });
        web.addJavascriptInterface(new Pont(), "Android");
        if (savedInstanceState == null) {
            web.loadUrl(ACCUEIL);
        } else {
            web.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    private static String typeMime(String chemin) {
        if (chemin.endsWith(".html")) return "text/html";
        if (chemin.endsWith(".js")) return "application/javascript";
        if (chemin.endsWith(".css")) return "text/css";
        if (chemin.endsWith(".json") || chemin.endsWith(".webmanifest")) return "application/json";
        if (chemin.endsWith(".svg")) return "image/svg+xml";
        if (chemin.endsWith(".png")) return "image/png";
        return "application/octet-stream";
    }

    @Override
    protected void onActivityResult(int demande, int resultat, Intent donnees) {
        super.onActivityResult(demande, resultat, donnees);
        if (demande == DEMANDE_FICHIER && choixFichier != null) {
            choixFichier.onReceiveValue(
                    WebChromeClient.FileChooserParams.parseResult(resultat, donnees));
            choixFichier = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private boolean notificationsAccordees() {
        return Build.VERSION.SDK_INT < 33
                || checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                == PackageManager.PERMISSION_GRANTED;
    }

    private void demanderNotifications() {
        if (!notificationsAccordees()) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }
    }

    /** Fonctions appelées par la page (window.Android). */
    private class Pont {
        @JavascriptInterface
        public String lireRappel() {
            SharedPreferences p = Rappels.reglages(MainActivity.this);
            return "{\"actif\":" + p.getBoolean("actif", true)
                    + ",\"debut\":" + p.getInt("debut", Rappels.DEBUT_DEFAUT)
                    + ",\"pas\":" + p.getInt("pas", Rappels.PAS_DEFAUT)
                    + ",\"fin\":" + p.getInt("fin", Rappels.FIN_DEFAUT)
                    + ",\"autorise\":" + notificationsAccordees() + "}";
        }

        @JavascriptInterface
        public void definirRappel(boolean actif, int debut, int pasHeures, int fin) {
            int d = Math.max(0, Math.min(1439, debut));
            Rappels.reglages(MainActivity.this).edit()
                    .putBoolean("actif", actif)
                    .putInt("debut", d)
                    .putInt("pas", Math.max(1, Math.min(12, pasHeures)))
                    .putInt("fin", Math.max(d, Math.min(1439, fin)))
                    .apply();
            Rappels.programmer(MainActivity.this);
            if (actif) {
                runOnUiThread(MainActivity.this::demanderNotifications);
            }
        }

        /** Mémorise ce qui est fait pour un jour (AAAA-MM-JJ), lu par le rappel. */
        @JavascriptInterface
        public void marquerJour(String date, boolean prier, boolean mediter, boolean precher) {
            if (date == null || !date.matches("\\d{4}-\\d{2}-\\d{2}")) {
                return;
            }
            String etat = (prier ? "1" : "0") + (mediter ? "1" : "0") + (precher ? "1" : "0");
            getSharedPreferences(Rappels.PREFS_ETAT, MODE_PRIVATE).edit()
                    .putString(date, etat).apply();
        }

        /** Ouvre la fenêtre d'impression d'Android (imprimante ou « Enregistrer au format PDF »). */
        @JavascriptInterface
        public void imprimer(final String titre, final boolean paysage) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                if (pm == null) {
                    return;
                }
                PrintAttributes.MediaSize format = paysage
                        ? PrintAttributes.MediaSize.ISO_A4.asLandscape()
                        : PrintAttributes.MediaSize.ISO_A4.asPortrait();
                PrintAttributes attributs = new PrintAttributes.Builder()
                        .setMediaSize(format)
                        .build();
                pm.print(titre, web.createPrintDocumentAdapter(titre), attributs);
            });
        }

        /** Enregistre un fichier dans Téléchargements. Renvoie "ok" ou un message d'erreur. */
        @JavascriptInterface
        public String enregistrerFichier(String nom, String base64, String mime) {
            final boolean excel = XLSX.equals(mime);
            try {
                byte[] octets = Base64.decode(base64, Base64.DEFAULT);
                ContentValues v = new ContentValues();
                v.put(MediaStore.MediaColumns.DISPLAY_NAME, nom);
                v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                final Uri uri = getContentResolver()
                        .insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
                if (uri == null) {
                    return "Impossible de créer le fichier.";
                }
                try (OutputStream o = getContentResolver().openOutputStream(uri)) {
                    if (o == null) {
                        return "Impossible d'écrire le fichier.";
                    }
                    o.write(octets);
                }
                runOnUiThread(() -> {
                    Toast.makeText(MainActivity.this,
                            "Fichier enregistré dans Téléchargements", Toast.LENGTH_LONG).show();
                    if (!excel) {
                        return;
                    }
                    try {
                        Intent voir = new Intent(Intent.ACTION_VIEW);
                        voir.setDataAndType(uri, XLSX);
                        voir.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(voir);
                    } catch (Exception e) {
                        // Aucune application pour ouvrir un fichier Excel : le fichier reste dans Téléchargements.
                    }
                });
                return "ok";
            } catch (Exception e) {
                return "Erreur : " + e.getMessage();
            }
        }
    }
}
