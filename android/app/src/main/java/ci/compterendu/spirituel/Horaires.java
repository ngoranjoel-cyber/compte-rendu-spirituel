package ci.compterendu.spirituel;

import java.util.Calendar;

/** Calcul des horaires de rappel (sans dépendance Android, pour pouvoir être testé seul). */
public final class Horaires {
    private Horaires() {
    }

    /**
     * Prochain horaire de rappel strictement après {@code maintenant}, en millisecondes.
     * Les horaires d'un jour sont debut, debut + pas, debut + 2 pas… sans dépasser fin
     * (debut et fin en minutes depuis minuit, pas en heures).
     */
    public static long prochain(long maintenant, int debut, int pasHeures, int fin) {
        int pas = Math.max(1, pasHeures) * 60;
        int dernier = Math.max(debut, fin);
        for (int jour = 0; jour <= 1; jour++) {
            for (int t = debut; t <= dernier; t += pas) {
                Calendar cal = Calendar.getInstance();
                cal.setTimeInMillis(maintenant);
                cal.add(Calendar.DAY_OF_YEAR, jour);
                cal.set(Calendar.HOUR_OF_DAY, t / 60);
                cal.set(Calendar.MINUTE, t % 60);
                cal.set(Calendar.SECOND, 0);
                cal.set(Calendar.MILLISECOND, 0);
                if (cal.getTimeInMillis() > maintenant) {
                    return cal.getTimeInMillis();
                }
            }
        }
        return maintenant + 24L * 60L * 60L * 1000L;
    }
}
