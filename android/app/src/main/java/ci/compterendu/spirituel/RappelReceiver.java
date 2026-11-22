package ci.compterendu.spirituel;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

import java.util.ArrayList;
import java.util.List;

/** Reçoit chaque alarme de rappel : notifie seulement si la journée n'est pas complète. */
public class RappelReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        try {
            notifierSiBesoin(context);
        } finally {
            Rappels.programmer(context);
        }
    }

    private void notifierSiBesoin(Context context) {
        // Trois caractères : prier, méditer, évangéliser ("1" = fait).
        String etat = context.getSharedPreferences(Rappels.PREFS_ETAT, Context.MODE_PRIVATE)
                .getString(Rappels.cleDuJour(), "000");
        if (etat == null || etat.length() < 3) {
            etat = "000";
        }
        List<String> reste = new ArrayList<>();
        if (etat.charAt(0) != '1') {
            reste.add("prier");
        }
        if (etat.charAt(1) != '1') {
            reste.add("méditer");
        }
        if (etat.charAt(2) != '1') {
            reste.add("évangéliser");
        }
        if (reste.isEmpty()) {
            return;
        }
        StringBuilder liste = new StringBuilder();
        for (int i = 0; i < reste.size(); i++) {
            if (i > 0) {
                liste.append(i == reste.size() - 1 ? " et " : ", ");
            }
            liste.append(reste.get(i));
        }
        String texte = "Il vous reste à " + liste + " aujourd'hui. Pensez à remplir votre journée.";

        Rappels.creerCanal(context);
        Intent ouvrir = new Intent(context, MainActivity.class);
        ouvrir.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent pi = PendingIntent.getActivity(context, 2, ouvrir,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        Notification n = new Notification.Builder(context, Rappels.CANAL)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle("Compte rendu spirituel")
                .setContentText(texte)
                .setStyle(new Notification.BigTextStyle().bigText(texte))
                .setContentIntent(pi)
                .setAutoCancel(true)
                .build();
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.notify(1, n);
        }
    }
}
