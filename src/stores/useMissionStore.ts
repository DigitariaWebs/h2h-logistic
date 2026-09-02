// LES CO-LIVRAISONS DU COTRANSPORTEUR PARTICULIER.
//
// 🔴 LES PROPOSITIONS ET LES MISSIONS VIENNENT DE LA BASE depuis le 22/08/2026.
// Avant, `loadMockData()` chargeait sept missions inventées : le cotransporteur
// voyait des propositions que personne ne lui avait faites, pour des colis qui
// n'existent pas, et « accepter » ne remontait nulle part.
//
// ⚠️ CE QUI RESTE LOCAL, ET POURQUOI C'EST DIT ICI. Les scans (`confirmPickup`,
// `confirmDelivery`) et tout le protocole d'incidents — absences, décisions du
// support, règlements — ne sont PAS encore persistés. Ils appartiennent aux
// tranches suivantes : les scans passeront par `record_scan_event`, l'argent par
// le grand livre. Tant qu'ils ne le sont pas, ils ne modifient que l'écran de ce
// téléphone : rien de ce qu'ils affichent n'engage la plateforme.
import { create } from 'zustand';
import type { Mission, MissionStatus, CancellationReason, OffHubProposal, SupportOutcome } from '@/types/mission';
import { ACTIVE_STATUSES, COMPLETED_STATUSES } from '@/types/mission';
import { sequenceur } from '@/utils/derniereLectureGagne';
import type { DeclarantRole } from '@/types/incident';
import { chargerMissions, accepterMission, refuserMission } from '@/services/missions';
import { computeSettlement } from '@/utils/settlement';
import { canCancelFree } from '@/constants/delaysRules';

/** Unordered pair of user ids that must no longer be matched together (§6). */
export interface SeparatedPair {
  a: string;
  b: string;
}

function samePair(p: SeparatedPair, a: string, b: string): boolean {
  return (p.a === a && p.b === b) || (p.a === b && p.b === a);
}

const MOCK_OFFHUB_ACCEPT_DELAY = 3000;
const AUTO_COMPLETE_DELAY = 2000;

interface MissionState {
  proposals: Mission[];
  activeMissions: Mission[];
  completedMissions: Mission[];
  isLoading: boolean;
  /** Le refus du serveur, tel quel — c'est une règle, pas une panne. */
  erreur: string | null;
  missions: Mission[];
  /** Users suspended by a support decision (danger confirmé / signalement abusif). */
  suspendedUserIds: string[];
  /** Pairs no longer auto-rematched after a support case (§6). */
  separatedPairs: SeparatedPair[];

  charger: () => Promise<void>;
  acceptMission: (id: string) => Promise<void>;
  rejectMission: (id: string) => Promise<void>;
  // 🔴 `updateMissionStatus`, `confirmPickup` ET `confirmDelivery` ONT DISPARU
  // LE 22/08/2026. Ils écrivaient un statut de mission à la main — or ce statut
  // est une PROJECTION de `shipments.state`, forcée par un trigger depuis
  // `20260822260000`. Ils ne pouvaient donc plus mentir qu'À L'ÉCRAN, en
  // affichant une remise que la base ignore : exactement le mensonge que la
  // projection existe pour empêcher, réintroduit côté client.
  //
  // ⚠️ CE QUI FAIT AVANCER UN COLIS, DÉSORMAIS : un scan
  // (`services/scans.ts` → `record_scan_event`), puis un `charger()`.
  cancelMission: (id: string, reason: CancellationReason) => void;
  reportSellerAbsence: (id: string) => void;
  reportBuyerAbsence: (id: string, extend?: boolean) => void;
  proposeOffHub: (id: string, proposal: Omit<OffHubProposal, 'status'>) => void;
  openSupportReview: (missionId: string, reportId: string, reportedUserId?: string) => void;
  resolveSupportReview: (missionId: string, outcome: SupportOutcome) => void;
  /** Apply the money + disposition outcome of an incident form (centralized). */
  applyIncidentOutcome: (missionId: string, type: string) => void;
  isUserSuspended: (userId: string) => boolean;
  arePairSeparated: (a: string, b: string) => boolean;
  getMissionById: (id: string) => Mission | undefined;

  getProposals: () => Mission[];
  getActiveMissions: () => Mission[];
  getCompletedMissions: () => Mission[];
  getPendingMissions: () => Mission[];
}

/** A proposal is hidden when this user (the transporter) is separated from
 *  either counterparty (§6 — « futures demandes non proposées entre eux »). */
function isProposalSeparated(m: Mission, pairs: SeparatedPair[]): boolean {
  return pairs.some(
    (p) =>
      samePair(p, m.transporter.id, m.buyer.id) ||
      samePair(p, m.transporter.id, m.seller.id),
  );
}

// 🔴 NEUF ÉCRANS APPELLENT `charger()`, ET DEUX LECTURES QUI SE CROISENT
// s'ecrivaient l'une sur l'autre dans l'ordre du RÉSEAU. Voir
// `derniereLectureGagne` : le cas couteux est le rechargement d'apres-scan,
// qu'une lecture partie plus tot pouvait annuler a l'ecran.
const lectures = sequenceur();

function rebuildMissions(state: { proposals: Mission[]; activeMissions: Mission[]; completedMissions: Mission[] }) {
  return [...state.proposals, ...state.activeMissions, ...state.completedMissions];
}

function updateActive(state: MissionState, id: string, updater: (m: Mission) => Mission) {
  const newState = {
    proposals: state.proposals,
    activeMissions: state.activeMissions.map((m) => (m.id === id ? updater(m) : m)),
    completedMissions: state.completedMissions,
  };
  return { ...newState, missions: rebuildMissions(newState) };
}

/**
 * Le tri que la base ne fait pas : une mission tombe dans l'une des trois
 * listes selon son statut — lui-même projeté depuis l'état du colis.
 */
function repartir(missions: Mission[]) {
  return {
    proposals: missions.filter((m) => m.status === 'proposal'),
    activeMissions: missions.filter((m) => ACTIVE_STATUSES.includes(m.status)),
    completedMissions: missions.filter((m) => COMPLETED_STATUSES.includes(m.status)),
  };
}

export const useMissionStore = create<MissionState>((set, get) => ({
  proposals: [],
  activeMissions: [],
  completedMissions: [],
  isLoading: false,
  erreur: null,
  missions: [],
  suspendedUserIds: [],
  separatedPairs: [],

  /**
   * 🔴 ET ON RECHARGE À CHAQUE FOIS, contrairement à l'ancien `loadMockData`
   * qui refusait d'écraser l'état une fois amorcé. La raison a disparu avec les
   * données inventées : les transitions ne vivent plus dans ce store, elles
   * vivent en base — recharger, c'est se resynchroniser, pas se réinitialiser.
   */
  charger: async () => {
    const jeton = lectures.demarrer();
    set({ isLoading: true, erreur: null });
    try {
      const missions = await chargerMissions();
      if (lectures.estPerimee(jeton)) return;
      set({ ...repartir(missions), missions, isLoading: false });
    } catch (e) {
      // ⚠️ MÊME GARDE DANS LE `catch` : l'échec d'une vieille requête ne doit
      // pas effacer le résultat d'une plus récente qui a réussi.
      if (lectures.estPerimee(jeton)) return;
      set({
        isLoading: false,
        erreur: e instanceof Error ? e.message : 'Co-livraisons indisponibles',
      });
    }
  },

  acceptMission: async (id) => {
    set({ isLoading: true, erreur: null });
    try {
      await accepterMission(id);
    } catch (e) {
      // ⚠️ LE REFUS DU SERVEUR EST UNE RÈGLE, PAS UNE PANNE : « le delai de
      // cette proposition est passe », « cette co-livraison n est plus a
      // prendre ». On le garde tel quel pour que l'écran le montre.
      set({ isLoading: false, erreur: e instanceof Error ? e.message : 'Acceptation impossible' });
      throw e;
    }
    await get().charger();
  },

  rejectMission: async (id) => {
    set({ isLoading: true, erreur: null });
    try {
      await refuserMission(id);
    } catch (e) {
      set({ isLoading: false, erreur: e instanceof Error ? e.message : 'Refus impossible' });
      throw e;
    }
    await get().charger();
  },

  cancelMission: (id, reason) => {
    const now = new Date().toISOString();
    set((state) => {
      const cancelled = state.activeMissions.find((m) => m.id === id);
      if (!cancelled) return state;
      const updated: Mission = { ...cancelled, status: 'cancelled', cancellationReason: reason, updatedAt: now };
      const newState = {
        proposals: state.proposals,
        activeMissions: state.activeMissions.filter((m) => m.id !== id),
        completedMissions: [updated, ...state.completedMissions],
      };
      return { ...newState, missions: rebuildMissions(newState) };
    });
  },

  // F7 — vendeur absent : acheteur remboursé intégral + 4 € au vendeur (3 cotransporteur / 1 H2H).
  reportSellerAbsence: (id) => {
    set((state) => updateActive(state, id, (m) => ({
      ...m,
      buyerRefundStatus: 'refunded',
      sellerPayStatus: 'unpaid',
      transporterPayStatus: 'paid',
      paymentStatus: 'refunded',
      settlement: computeSettlement('seller_absent') ?? undefined,
    })));
    get().cancelMission(id, 'seller_no_show');
  },

  // F2 — acheteur absent : vendeur + cotransporteur payés, remboursement acheteur refusé.
  reportBuyerAbsence: (id, extend) => {
    if (extend) {
      // Extend tolerance by 5 min (mock: just update the tolerance)
      set((state) => updateActive(state, id, (m) => ({
        ...m, deliveryHub: { ...m.deliveryHub, toleranceMinutes: m.deliveryHub.toleranceMinutes + 5 }, updatedAt: new Date().toISOString(),
      })));
    } else {
      set((state) => updateActive(state, id, (m) => ({
        ...m,
        sellerPayStatus: 'paid',
        transporterPayStatus: 'paid',
        buyerRefundStatus: 'refused',
        paymentStatus: 'released',
        settlement: computeSettlement('buyer_absent') ?? undefined,
      })));
      get().cancelMission(id, 'buyer_no_show');
    }
  },

  proposeOffHub: (id, proposal) => {
    const offHubProposal: OffHubProposal = { ...proposal, status: 'pending' };
    set((state) => updateActive(state, id, (m) => ({ ...m, offHubProposal, updatedAt: new Date().toISOString() })));

    // Mock auto-accept after delay
    setTimeout(() => {
      const mission = get().activeMissions.find((m) => m.id === id);
      if (!mission || mission.offHubProposal?.status !== 'pending') return;

      const acceptedProposal: OffHubProposal = { ...mission.offHubProposal!, status: 'accepted' };
      const hubKey = proposal.target === 'seller' ? 'pickupHub' : 'deliveryHub';
      set((state) => updateActive(state, id, (m) => ({
        ...m,
        offHubProposal: acceptedProposal,
        [hubKey]: { ...m[hubKey], isOffHub: true, offHubAddress: proposal.address, name: `Hors hub — ${proposal.address}` },
        updatedAt: new Date().toISOString(),
      })));
    }, MOCK_OFFHUB_ACCEPT_DELAY);
  },

  // §4 step 2 — Mise en attente: hold the mission + both payment legs while
  // support analyses the dossier. The decision (step 4) is NEVER automatic.
  openSupportReview: (missionId, reportId, reportedUserId) => {
    const now = new Date().toISOString();
    set((state) => updateActive(state, missionId, (m) => ({
      ...m,
      supportHold: true,
      paymentStatus: 'held',
      transporterPayStatus: 'held',
      reportId,
      reportedUserId: reportedUserId ?? m.reportedUserId,
      updatedAt: now,
    })));
  },

  // §5/§7 step 4 — Décision: an explicit human support action. Applies the
  // pay/refund/suspension outcome and separates the pair (§6). Not automatic.
  resolveSupportReview: (missionId, outcome) => {
    const now = new Date().toISOString();
    const m =
      get().activeMissions.find((x) => x.id === missionId) ??
      get().completedMissions.find((x) => x.id === missionId);
    if (!m) return;

    const transporterId = m.transporter.id;
    const reportedId = m.reportedUserId ?? m.buyer.id;

    let patch: Partial<Mission> = {
      supportHold: false,
      supportOutcome: outcome,
      supportResolvedAt: now,
      updatedAt: now,
    };
    const suspend: string[] = [];

    if (outcome === 'danger_confirmed') {
      // Faute acheteur : vendeur payé, co-transporteur payé, acheteur suspendu,
      // remboursement acheteur refusé.
      patch = {
        ...patch,
        sellerPayStatus: 'paid',
        transporterPayStatus: 'paid',
        paymentStatus: 'released',
        buyerRefundStatus: 'refused',
      };
      suspend.push(reportedId);
    } else if (outcome === 'good_faith') {
      // Erreur de bonne foi : co-transporteur NON suspendu (rappel pédagogique),
      // acheteur remboursé si non finalisable, vendeur selon CGU.
      patch = {
        ...patch,
        transporterPayStatus: 'paid',
        pedagogicalReminder: true,
        paymentStatus: 'refunded',
        buyerRefundStatus: 'refunded',
        sellerPayStatus: 'pending',
      };
    } else {
      // Signalement abusif : co-transporteur NON payé + suspendu, acheteur
      // remboursé si non livré, vendeur payé selon dossier.
      patch = {
        ...patch,
        transporterPayStatus: 'unpaid',
        paymentStatus: 'refunded',
        buyerRefundStatus: 'refunded',
        sellerPayStatus: 'paid',
      };
      suspend.push(transporterId);
    }

    set((state) => {
      const applyList = (list: Mission[]) =>
        list.map((x) => (x.id === missionId ? { ...x, ...patch } : x));
      const newState = {
        proposals: state.proposals,
        activeMissions: applyList(state.activeMissions),
        completedMissions: applyList(state.completedMissions),
      };
      const suspendedUserIds = Array.from(new Set([...state.suspendedUserIds, ...suspend]));
      // Any support case separates the co-transporteur ↔ reported user (§6),
      // « sauf décision contraire du support ».
      const alreadySeparated = state.separatedPairs.some((p) =>
        samePair(p, transporterId, reportedId),
      );
      const separatedPairs = alreadySeparated
        ? state.separatedPairs
        : [...state.separatedPairs, { a: transporterId, b: reportedId }];
      return { ...newState, missions: rebuildMissions(newState), suspendedUserIds, separatedPairs };
    });
  },

  // Centralized incident → outcome routing. Delegates to the extended
  // reportSellerAbsence / reportBuyerAbsence / cancelMission / openSupportReview.
  applyIncidentOutcome: (missionId, type) => {
    const m =
      get().activeMissions.find((x) => x.id === missionId) ??
      get().completedMissions.find((x) => x.id === missionId);

    if (type === 'buyer_absent') {
      get().reportBuyerAbsence(missionId, false);
      return;
    }
    if (type === 'seller_absent') {
      get().reportSellerAbsence(missionId);
      return;
    }
    if (type === 'transporter_absent') {
      // F4 — vendeur payé, cotransporteur non payé, acheteur remboursé, imputé au cotransporteur.
      set((state) => updateActive(state, missionId, (mm) => ({
        ...mm,
        sellerPayStatus: 'paid',
        transporterPayStatus: 'unpaid',
        buyerRefundStatus: 'refunded',
        paymentStatus: 'refunded',
        settlement: computeSettlement('transporter_absent') ?? undefined,
      })));
      get().cancelMission(missionId, 'other');
      return;
    }
    if (type === 'hub_blocked' || type === 'collect_absent') {
      // F6 (D5) / F13 (D6) — blocage → analyse support.
      if (type === 'collect_absent') {
        set((state) => updateActive(state, missionId, (mm) => ({
          ...mm, settlement: computeSettlement('collect_absent') ?? undefined,
        })));
      }
      get().openSupportReview(missionId, `incident-${type}`);
      return;
    }
    if (type === 'refuse_package') {
      // F11 — refus colis non conforme → co-livraison annulée, dossier analysable.
      get().cancelMission(missionId, 'other');
      return;
    }
    if (type === 'cancel_seller' || type === 'cancel_buyer' || type === 'cancel_transporter') {
      const role: DeclarantRole = type === 'cancel_seller' ? 'seller' : type === 'cancel_buyer' ? 'buyer' : 'transporter';
      const refIso = m?.pickupHub.scheduledTime ?? new Date().toISOString();
      const late = !canCancelFree(refIso, role);
      set((state) => updateActive(state, missionId, (mm) => ({
        ...mm,
        settlement: computeSettlement(type, { late }) ?? undefined,
        transporterPayStatus: type === 'cancel_transporter' && late ? 'unpaid' : mm.transporterPayStatus,
      })));
      const reason: CancellationReason =
        type === 'cancel_transporter'
          ? (late ? 'transporter_cancelled_after_pickup' : 'transporter_cancelled_before_pickup')
          : 'other';
      get().cancelMission(missionId, reason);
      return;
    }
  },

  isUserSuspended: (userId) => get().suspendedUserIds.includes(userId),
  arePairSeparated: (a, b) => get().separatedPairs.some((p) => samePair(p, a, b)),

  getMissionById: (id) => {
    const s = get();
    return s.proposals.find((m) => m.id === id) ?? s.activeMissions.find((m) => m.id === id) ?? s.completedMissions.find((m) => m.id === id);
  },

  getProposals: () => {
    const { proposals, separatedPairs } = get();
    return proposals.filter((m) => m.status === 'proposal' && !isProposalSeparated(m, separatedPairs));
  },
  getActiveMissions: () => get().activeMissions.filter((m) => ACTIVE_STATUSES.includes(m.status)),
  getCompletedMissions: () => get().completedMissions,
  getPendingMissions: () => {
    const { proposals, separatedPairs } = get();
    return proposals.filter((m) => m.status === 'proposal' && !isProposalSeparated(m, separatedPairs));
  },
}));
