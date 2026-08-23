// LES PARTICIPATIONS DU COTRANSPORTEUR PARTICULIER.
//
// 🔴 ELLES VIENNENT DE LA BASE DEPUIS LE 22/08/2026. `services/mock/earnings.ts`
// affichait un solde, un histogramme et un historique entièrement inventés — et
// le bouton « Retirer » n'avait aucun `onPress`, avec la mention « les retraits
// seront disponibles prochainement ». Elle était exacte : rien, dans toute la
// base, ne payait un cotransporteur pour une co-livraison réussie.
//
// ⚠️ TROIS NOMBRES DISTINCTS, ET LES CONFONDRE SERAIT MENTIR :
//   • `balance`          — tout ce qui est dû ;
//   • `availableBalance` — ce qui passerait au virement MAINTENANT ;
//   • `pendingBalance`   — le reste : co-livraisons faites, fenêtre de
//     réclamation encore ouverte.
// Une co-livraison remise hier est due, pas encore versable.
//
// ⚠️ VOCABULAIRE : « participation », jamais « gains » ni « revenu ».
import { create } from 'zustand';
import type { EarningsSummary, DailyEarning } from '@/types/earnings';
import {
  chargerParticipations,
  chargerJournalParticipations,
  type LigneParticipation,
} from '@/services/participations';

type Period = 'today' | 'week' | 'month' | 'total';

interface EarningsState {
  summary: EarningsSummary | null;
  dailyEarnings: DailyEarning[];
  /** Le grand livre du cotransporteur, ligne à ligne. */
  journal: LigneParticipation[];
  isLoading: boolean;
  erreur: string | null;

  charger: () => Promise<void>;
  getEarningsForPeriod: (period: Period) => { amount: number; deliveries: number };
}

const JOUR_MS = 86_400_000;

/** Les crédits du journal, regroupés par jour, sur les sept derniers jours. */
function parJour(journal: LigneParticipation[]): DailyEarning[] {
  const debut = new Date();
  debut.setHours(0, 0, 0, 0);
  const jours: DailyEarning[] = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date(debut.getTime() - i * JOUR_MS);
    const cle = d.toISOString().slice(0, 10);
    const lignes = journal.filter(
      (l) => l.sens === 'C' && l.survenuLe.slice(0, 10) === cle,
    );
    jours.push({
      date: cle,
      amount: Math.round(lignes.reduce((s, l) => s + l.montantEuros, 0) * 100) / 100,
      deliveries: lignes.length,
    });
  }
  return jours;
}

/** Ce qui a été porté au crédit depuis `depuis`. */
function depuis(journal: LigneParticipation[], quand: Date) {
  const lignes = journal.filter(
    (l) => l.sens === 'C' && new Date(l.survenuLe).getTime() >= quand.getTime(),
  );
  return {
    amount: Math.round(lignes.reduce((s, l) => s + l.montantEuros, 0) * 100) / 100,
    deliveries: lignes.length,
  };
}

export const useEarningsStore = create<EarningsState>((set, get) => ({
  summary: null,
  dailyEarnings: [],
  journal: [],
  isLoading: false,
  erreur: null,

  charger: async () => {
    set({ isLoading: true, erreur: null });
    try {
      const [p, journal] = await Promise.all([
        chargerParticipations(),
        chargerJournalParticipations(200),
      ]);
      const credits = journal.filter((l) => l.sens === 'C');
      const total = Math.round((p.soldeEuros + p.verseEuros) * 100) / 100;
      set({
        journal,
        dailyEarnings: parJour(journal),
        isLoading: false,
        summary: {
          balance: p.soldeEuros,
          availableBalance: p.versableEuros,
          pendingBalance: p.enAttenteEuros,
          withdrawnTotal: p.verseEuros,
          totalEarnings: total,
          totalMissions: credits.length,
          // ⚠️ CES QUATRE-LÀ SE CALCULENT DU JOURNAL, pas d'un chiffre stocké :
          // la base n'agrège rien par période, et une somme recopiée dérive.
          todayEarnings: depuis(journal, debutDeJournee()).amount,
          weekEarnings: depuis(journal, new Date(Date.now() - 7 * JOUR_MS)).amount,
          monthEarnings: depuis(journal, new Date(Date.now() - 30 * JOUR_MS)).amount,
          thisMonth: depuis(journal, new Date(Date.now() - 30 * JOUR_MS)).amount,
          lastMonth: 0,
        },
      });
    } catch (e) {
      set({
        isLoading: false,
        erreur: e instanceof Error ? e.message : 'Participations indisponibles',
      });
    }
  },

  getEarningsForPeriod: (period) => {
    const { journal, summary } = get();
    switch (period) {
      case 'today': return depuis(journal, debutDeJournee());
      case 'week': return depuis(journal, new Date(Date.now() - 7 * JOUR_MS));
      case 'month': return depuis(journal, new Date(Date.now() - 30 * JOUR_MS));
      case 'total':
        return {
          amount: summary?.totalEarnings ?? 0,
          deliveries: summary?.totalMissions ?? 0,
        };
    }
  },
}));

function debutDeJournee(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
