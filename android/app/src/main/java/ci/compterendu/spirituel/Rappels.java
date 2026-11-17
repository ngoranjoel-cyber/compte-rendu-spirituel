package ci.compterendu.spirituel;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Réglages et programmation des rappels.
 * Par défaut : un rappel toutes les 3 heures, de 04:00 à 22:00, tant que la journée n'est pas complète.
 */
final class Rappels {
    static final String PREFS = "rappel";
    static final String PREFS_ETAT = "etat";
    static final String CANAL = "rappel_quotidien";
    /** Premier rappel, en minutes depuis minuit (04:00). */
    static final int DEBUT_DEFAUT = 4 * 60;
    /** Intervalle entre deux rappels, en heures. */
    static final int PAS_DEFAUT = 3;
    /** Dernier rappel au plus tard, en minutes depuis minuit (22:00). */
    static final int FIN_DEFAUT = 22 * 60;

    private Rappels() {
    }

    static SharedPreferences reglages(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static String cleDuJour() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    static void creerCanal(Context c) {
        NotificationChannel canal = new NotificationChannel(
                CANAL, c.getString(R.string.canal_nom), NotificationManager.IMPORTANCE_HIGH);
        canal.setDescription(c.getString(R.string.canal_description));
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.createNotificationChannel(canal);
        }
    }

    private static PendingIntent intention(Context c) {
        Intent i = new Intent(c, RappelReceiver.class);
        return PendingIntent.getBroadcast(c, 1, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** Annule l'alarme en cours et programme le prochain rappel si les rappels sont activés. */
    static void programmer(Context c) {
        AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
        if (am == null) {
            return;
        }
        PendingIntent pi = intention(c);
        am.cancel(pi);
        SharedPreferences p = reglages(c);
        if (!p.getBoolean("actif", true)) {
            return;
        }
        long quand = Horaires.prochain(System.currentTimeMillis() + 5000L,
                p.getInt("debut", DEBUT_DEFAUT), p.getInt("pas", PAS_DEFAUT), p.getInt("fin", FIN_DEFAUT));
        am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, quand, pi);
    }
}
