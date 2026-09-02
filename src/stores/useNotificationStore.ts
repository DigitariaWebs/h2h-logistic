// LES NOTIFICATIONS DU COTRANSPORTEUR.
//
// 🔴 CE QU'IL Y AVAIT AVANT : rien. Trois écrans lisaient directement
// `mockNotifications`, une constante du bundle — le badge de l'en-tête, la
// carte « Notifications récentes » de l'accueil, et l'écran complet. Aucun ne
// touchait la base, alors que `app.notifier()` y écrit à chaque étape d'une
// co-livraison.
//
// ⚠️ LE MAGASIN NE DÉMARRE PAS SUR LA DÉMONSTRATION. Il démarre VIDE : un
// compte neuf n'a pas de notifications, et lui en montrer d'inventées est la
// même faute que le « 96% de réussite » corrigé le 02/09/2026.
import { create } from 'zustand';
import type { AppNotification } from '@/services/mock/notifications';
import { chargerNotifications, marquerLue } from '@/services/notifications';
import { sequenceur } from '@/utils/derniereLectureGagne';

// 🔴 TROIS ÉCRANS APPELLENT `charger()` — voir `derniereLectureGagne` : deux
// lectures qui se croisent s'écriraient dans l'ordre du réseau.
const lectures = sequenceur();

type NotificationState = {
  notifications: AppNotification[];
  nonLues: number;
  isLoading: boolean;
  erreur: string | null;
  charger: () => Promise<void>;
  marquerCommeLue: (id: string) => Promise<void>;
};

const compterNonLues = (l: AppNotification[]) => l.filter((n) => !n.read).length;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  nonLues: 0,
  isLoading: false,
  erreur: null,

  charger: async () => {
    const jeton = lectures.demarrer();
    set({ isLoading: true, erreur: null });
    try {
      const recues = await chargerNotifications();
      if (lectures.estPerimee(jeton)) return;
      set({ notifications: recues, nonLues: compterNonLues(recues), isLoading: false });
    } catch (e) {
      if (lectures.estPerimee(jeton)) return;
      // 🔴 UN REFUS DE LECTURE N'EST PAS UNE BOÎTE VIDE. Sans cette trace, une
      // policy refusée est indiscernable d'un compte sans notification.
      set({
        isLoading: false,
        erreur: e instanceof Error ? e.message : 'Notifications indisponibles',
      });
    }
  },

  /**
   * ⚠️ L'ÉCRAN NE DOIT PAS ATTENDRE LE SERVEUR. La pastille disparaît avec
   * l'appui ; l'échec de l'écriture ne dérange personne — la notification sera
   * simplement encore non lue au prochain lancement, ce qui est l'état vrai.
   */
  marquerCommeLue: async (id) => {
    const apres = get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n));
    set({ notifications: apres, nonLues: compterNonLues(apres) });
    try {
      await marquerLue(id);
    } catch (e) {
      console.error('[notifications] marquage impossible', e);
    }
  },
}));
