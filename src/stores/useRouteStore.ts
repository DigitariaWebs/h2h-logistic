// LES TRAJETS VIENNENT DE LA BASE.
//
// 🔴 CE QUE ÇA REMPLACE. `publishRoute()` fabriquait un `route-${Date.now()}`
// et le rangeait dans AsyncStorage : le trajet n'existait que sur ce téléphone,
// et l'appariement des colis — qui vit côté serveur — ne pouvait par
// construction en voir aucun. Un cotransporteur particulier publiait dans le
// vide.
//
// ⚠️ LA FORME PUBLIQUE DU STORE NE CHANGE PAS. `routes`, `publishRoute`,
// `toggleRouteStatus`, `deleteRoute`, `hasActiveMission` gardent leurs noms et
// leurs signatures : douze écrans les appellent, et le dessin n'est pas en
// cause. Seule la provenance change.
import { create } from 'zustand';
import type { PublishedRoute, PublishFormData } from '@/types/route';
import { INITIAL_FORM } from '@/types/route';
import type { TransportTypeId } from '@/constants/TransportTypes';
import { useMissionStore } from '@/stores/useMissionStore';
import { useAuthStore } from '@/stores/useAuthStore';
import { ACTIVE_STATUSES } from '@/types/mission';
import {
  basculerTrajet,
  chargerMesTrajets,
  modifierTrajet,
  publierTrajet,
  retirerTrajet,
} from '@/services/trajets';

interface RouteState {
  routes: PublishedRoute[];
  form: PublishFormData;
  currentStep: number;
  isPublishing: boolean;

  hydrate: () => Promise<void>;

  // Routes CRUD
  addRoute: (route: PublishedRoute) => void;
  updateRoute: (id: string, updates: Partial<PublishedRoute>) => void;
  deleteRoute: (id: string) => void;
  toggleRouteStatus: (id: string) => void;

  // Queries
  hasActiveMission: (routeId: string) => boolean;
  getActiveRoutes: () => PublishedRoute[];
  getPausedRoutes: () => PublishedRoute[];

  // Publish flow
  setFormField: <K extends keyof PublishFormData>(key: K, value: PublishFormData[K]) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  resetForm: () => void;
  /**
   * ⚠️ PLUS DE `transporterId` EN PARAMÈTRE. Le serveur le déduit du jeton :
   * `publier_trajet` écrit `transporter_id = app.uid()`. Le passer depuis
   * l'écran laissait croire qu'on pouvait publier au nom d'un autre — et un
   * paramètre qui ne sert à rien finit par servir à quelque chose.
   */
  publishRoute: () => Promise<PublishedRoute>;
}

export const useRouteStore = create<RouteState>((set, get) => ({
  routes: [],
  form: { ...INITIAL_FORM },
  currentStep: 1,
  isPublishing: false,

  hydrate: async () => {
    // ⚠️ SANS SESSION, PAS DE TRAJETS — et ce n'est pas une erreur : c'est le
    // cas normal au premier lancement. `published_routes_owner_read` ne rendrait
    // rien de toute façon.
    if (!useAuthStore.getState().isAuthenticated) {
      set({ routes: [] });
      return;
    }
    try {
      set({ routes: await chargerMesTrajets() });
    } catch (e) {
      // ⚠️ SANS CETTE TRACE, une policy refusée est indiscernable d'une liste
      // légitimement vide — et un cotransporteur qui ne voit plus ses trajets
      // conclut qu'ils ont été supprimés.
      console.error('[trajets] lecture impossible', e);
    }
  },

  addRoute: (route) => {
    // ⚠️ MÉMOIRE SEULE, DÉLIBÉRÉMENT. C'est la prédiction locale qui suit une
    // écriture déjà acceptée par la base — jamais la source.
    set({ routes: [route, ...get().routes] });
  },

  updateRoute: (id, updates) => {
    // Prédiction locale d'abord — l'écran répond tout de suite — puis la base
    // tranche. En cas de refus, on relit : l'état affiché ne doit jamais
    // survivre à une écriture refusée.
    set({ routes: get().routes.map((r) => (r.id === id ? { ...r, ...updates } : r)) });
    modifierTrajet(id, {
      transport: updates.transportType,
      maxColis: updates.maxPackages,
      tailleMax: updates.maxSize,
      poidsMaxKg: updates.maxWeight,
      horsHub: updates.horsHub,
    }).catch((e: unknown) => {
      console.error('[trajets] modification refusee', e);
      void get().hydrate();
    });
  },

  deleteRoute: (id) => {
    const avant = get().routes;
    set({ routes: avant.filter((r) => r.id !== id) });
    retirerTrajet(id).catch((e: unknown) => {
      // 🔴 LE SERVEUR REFUSE SI UNE CO-LIVRAISON EST EN COURS. Laisser le
      // trajet disparu à l'écran ferait croire à une suppression qui n'a pas eu
      // lieu — et le trajet réapparaîtrait au prochain lancement.
      console.error('[trajets] suppression refusee', e);
      set({ routes: avant });
    });
  },

  toggleRouteStatus: (id) => {
    const route = get().routes.find((r) => r.id === id);
    if (!route) return;
    const actif = route.status !== 'active';
    set({
      routes: get().routes.map((r) =>
        r.id === id ? { ...r, status: actif ? 'active' : 'paused' } : r,
      ),
    });
    basculerTrajet(id, actif).catch((e: unknown) => {
      console.error('[trajets] bascule refusee', e);
      void get().hydrate();
    });
  },

  hasActiveMission: (routeId) => {
    const missionState = useMissionStore.getState();
    return missionState.activeMissions.some(
      (m) => m.routeId === routeId && ACTIVE_STATUSES.includes(m.status),
    );
  },

  getActiveRoutes: () => get().routes.filter((r) => r.status === 'active'),
  getPausedRoutes: () => get().routes.filter((r) => r.status === 'paused'),

  setFormField: (key, value) =>
    set((state) => ({ form: { ...state.form, [key]: value } })),

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 8) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
  resetForm: () => set({ form: { ...INITIAL_FORM }, currentStep: 1 }),

  publishRoute: async () => {
    set({ isPublishing: true });
    try {
      const f = get().form;
      // Transport is no longer asked during publish — inherit the carrier's
      // declared profile transport (falls back to 'car'), still editable later.
      const profileTransport = useAuthStore.getState().user?.transportTypes?.[0] as
        | TransportTypeId
        | undefined;

      // 🔴 LES ARRÊTS SONT LA SEULE SOURCE. Le serveur en déduit le hub de
      // départ et les hubs de remise ; les envoyer aussi en tableau garantirait
      // qu'ils finissent par se contredire.
      //
      // ⚠️ `hubId` PEUT ÊTRE VIDE, ET C'EST LE CAS NORMAL AUJOURD'HUI :
      // `public.hubs` ne contient encore personne. Un trajet ville → ville
      // reste publiable, et c'est ce que l'appariement lira.
      const arrets = [
        {
          hubId: f.pickupHub?.hubId || null,
          ville: f.pickupHub?.city || f.departureCity || '',
          heure: f.pickupTime || null,
        },
        ...f.deliveryHubs.map((h) => ({
          hubId: h.hubId || null,
          ville: h.city,
          heure: f.deliveryTimes[h.hubId] || h.arrivalTime || null,
        })),
      ];

      const route = await publierTrajet({
        type: f.type!,
        villeDepart: f.departureCity!,
        villeArrivee: f.arrivalCity!,
        arrets,
        // ⚠️ UN TRAJET UNIQUE DOIT PORTER SA DATE — le serveur la réclame. Le
        // formulaire ne collecte qu'une heure ; on la place sur le prochain
        // jour à venir plutôt que d'envoyer un trajet qui ne se situe nulle
        // part dans le temps.
        departLe: f.type === 'one_time' ? prochainPassage(f.pickupTime) : null,
        joursRecurrents: f.type === 'recurring' ? f.recurringDays : [],
        transport: f.transportType ?? profileTransport ?? 'car',
        maxColis: f.maxPackages,
        tailleMax: f.maxSize!,
        poidsMaxKg: f.maxWeight,
        horsHub: f.horsHub,
      });

      get().addRoute(route);
      get().resetForm();
      return route;
    } finally {
      set({ isPublishing: false });
    }
  },
}));

/**
 * L'heure « HH:MM » placée sur le prochain jour où elle n'est pas déjà passée.
 *
 * ⚠️ L'ASSISTANT NE DEMANDE QU'UNE HEURE, alors que la base attend un instant.
 * Choisir « aujourd'hui » pour une heure déjà écoulée publierait un trajet
 * périmé à la seconde où il est créé.
 */
function prochainPassage(heure?: string): string {
  const [h, m] = (heure ?? '08:00').split(':').map((n) => parseInt(n, 10) || 0);
  const quand = new Date();
  quand.setSeconds(0, 0);
  quand.setHours(h, m);
  if (quand.getTime() <= Date.now()) quand.setDate(quand.getDate() + 1);
  return quand.toISOString();
}
