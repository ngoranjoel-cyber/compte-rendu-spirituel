import ci.compterendu.spirituel.Horaires;

import java.util.Calendar;

/** Vérifie les horaires de rappel : toutes les 3 heures de 04:00 à 22:00. */
public class HorairesTest {
    static long a(int heure, int minute, int jourEnPlus) {
        Calendar c = Calendar.getInstance();
        c.set(2026, Calendar.NOVEMBER, 16 + jourEnPlus, heure, minute, 0);
        c.set(Calendar.MILLISECOND, 0);
        return c.getTimeInMillis();
    }

    static void verifier(String nom, long attendu, long obtenu) {
        if (attendu != obtenu) {
            throw new AssertionError(nom + " : attendu " + attendu + ", obtenu " + obtenu);
        }
        System.out.println("ok - " + nom);
    }

    public static void main(String[] args) {
        int debut = 4 * 60, pas = 3, fin = 22 * 60;
        verifier("avant 4 h, rappel à 04:00", a(4, 0, 0), Horaires.prochain(a(1, 30, 0), debut, pas, fin));
        verifier("à 04:00 pile, rappel suivant à 07:00", a(7, 0, 0), Horaires.prochain(a(4, 0, 0), debut, pas, fin));
        verifier("à 08:15, rappel à 10:00", a(10, 0, 0), Horaires.prochain(a(8, 15, 0), debut, pas, fin));
        verifier("à 21:59, rappel à 22:00", a(22, 0, 0), Horaires.prochain(a(21, 59, 0), debut, pas, fin));
        verifier("après 22:00, rappel le lendemain à 04:00", a(4, 0, 1), Horaires.prochain(a(22, 0, 0), debut, pas, fin));
        verifier("fin avant début : un seul rappel par jour", a(4, 0, 1), Horaires.prochain(a(5, 0, 0), debut, pas, 60));
        verifier("pas invalide ramené à 1 heure", a(5, 0, 0), Horaires.prochain(a(4, 30, 0), debut, 0, fin));
    }
}
