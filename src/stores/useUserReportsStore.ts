import { create } from 'zustand';
import type { UserReportPayload, UserReportReason } from '@/services/mock/userReports';
// 🔴 `submitUserReport` ATTENDAIT UNE SECONDE ET RENDAIT UN IDENTIFIANT
// FABRIQUÉ. Rien n'était envoyé ; le signalant voyait un ecran de succès et une
// référence qui n'existe nulle part. Les libellés et le routage support, eux,
// restent : ce sont des données d'écran, et elles n'ont jamais été le défaut.
import { getUserReportReason, isSupportReason } from '@/services/mock/userReports';
import { signalerUtilisateur } from '@/services/signalements';
import { useMissionStore } from '@/stores/useMissionStore';

export type SupportStatus = 'new' | 'in_review' | 'resolved';

export interface UserReportRecord extends UserReportPayload {
  id: string;
  createdAt: string;
  supportStatus: SupportStatus;
  /** true for a 'support_priority' motif (danger grave) → immediate analysis. */
  priority: boolean;
  /** true when the motif routes to HandtoHand support (support_priority | support). */
  routedToSupport: boolean;
}

/** Build a record from a payload + the mock submit result. Centralises the
 *  routing logic so seeds and live submissions stay consistent. */
function buildRecord(
  payload: UserReportPayload,
  meta: { id: string; createdAt: string; supportStatus?: SupportStatus },
): UserReportRecord {
  const type = getUserReportReason(payload.reason)?.type;
  return {
    ...payload,
    id: meta.id,
    createdAt: meta.createdAt,
    supportStatus: meta.supportStatus ?? 'new',
    priority: type === 'support_priority',
    routedToSupport: isSupportReason(payload.reason),
  };
}

// ─── Seeds — one danger-grave dossier in review + one classic, for the demo ───
function seedReports(): UserReportRecord[] {
  return [
    buildRecord(
      {
        reportedUserId: 'buyer-thomas',
        reportedUserName: 'Thomas Petit',
        reportedRole: 'buyer',
        missionId: 'mission-a3',
        reason: 'danger' as UserReportReason,
        description: 'Comportement agressif au point de rendez-vous, menaces verbales.',
        goodFaith: true,
      },
      { id: 'ureport-seed-1', createdAt: '2026-07-11T16:40:00.000Z', supportStatus: 'in_review' },
    ),
    buildRecord(
      {
        reportedUserId: 'seller-marie',
        reportedUserName: 'Marie Laurent',
        reportedRole: 'seller',
        missionId: 'mission-a5',
        reason: 'disrespect' as UserReportReason,
        description: 'Ton irrespectueux dans les messages.',
        goodFaith: true,
      },
      { id: 'ureport-seed-2', createdAt: '2026-07-10T09:15:00.000Z', supportStatus: 'new' },
    ),
  ];
}

interface UserReportsState {
  reports: UserReportRecord[];
  isSubmitting: boolean;
  submit: (payload: UserReportPayload) => Promise<UserReportRecord>;
  getReportsForUser: (userId: string) => UserReportRecord[];
  getReportsForMission: (missionId: string) => UserReportRecord[];
}

export const useUserReportsStore = create<UserReportsState>((set, get) => ({
  reports: seedReports(),
  isSubmitting: false,

  submit: async (payload) => {
    set({ isSubmitting: true });
    try {
      // 🔴 LE SIGNALEMENT PART VRAIMENT, et on garde l'identifiant que la BASE
      // a écrit : une référence fabriquée localement ne permet ni de retrouver le
      // dossier, ni de prouver qu'on a signalé.
      const envoye = await signalerUtilisateur({
        utilisateurId: payload.reportedUserId,
        motif: payload.reason,
        explication: payload.description ?? '',
        conversationId: payload.conversationId ?? null,
        // ⚠️ ON NE BLOQUE PAS DANS LE MÊME GESTE : l'écran ne le propose pas,
        // et bloquer sans l'avoir demandé fermerait un fil dont le support
        // peut avoir besoin.
        bloquerEnsuite: false,
      });
      const result = { id: envoye.id, createdAt: envoye.creeLe };
      // Support/priority motifs open a « dossier support »; classic ones don't
      // block the mission — they're logged for a simple review.
      const record = buildRecord(payload, {
        id: result.id,
        createdAt: result.createdAt,
        supportStatus: 'new',
      });
      set((state) => ({ reports: [record, ...state.reports], isSubmitting: false }));

      // §4 step 2 — a support-routed motif (danger prioritaire / fraude /
      // problème sérieux / RDV suspect) on a mission opens the support review:
      // mission on hold + payments held. Classic motifs never hold the mission.
      if (record.routedToSupport && record.missionId) {
        useMissionStore.getState().openSupportReview(record.missionId, record.id, record.reportedUserId);
      }

      return record;
    } catch (e) {
      set({ isSubmitting: false });
      throw e;
    }
  },

  getReportsForUser: (userId) => get().reports.filter((r) => r.reportedUserId === userId),
  getReportsForMission: (missionId) => get().reports.filter((r) => r.missionId === missionId),
}));
