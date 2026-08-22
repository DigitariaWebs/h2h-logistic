// LES TRAJETS — publiés en base, avec leurs arrêts.
//
// 🔴 CE QUE ÇA REMPLACE. `useRouteStore.publishRoute()` fabriquait un
// `route-${Date.now()}` et le rangeait dans AsyncStorage. Le trajet n'existait
// donc que sur ce téléphone : l'appariement des colis, qui vit côté serveur, ne
// pouvait par construction en voir aucun.
//
// ⚠️ LE TRAJET ET SES ARRÊTS PARTENT ENSEMBLE. `publier_trajet` les écrit dans
// une seule transaction : `route_stops` n'a aucune policy d'écriture, et c'est
// voulu. Deux appels séparés depuis un téléphone laisseraient, sur une coupure
// réseau, un trajet muet — sans dire où il passe ni à quelle heure.
//
// 🔴 AUCUN PRIX N'EST ENVOYÉ, ET LA SIGNATURE N'EN ACCEPTE PAS. La participation
// du cotransporteur particulier se calcule côté serveur depuis `ref`. Un tarif
// choisi au trajet contredirait la grille ET le cadre du partage des frais
// (L. 3232-1), où la participation couvre des frais constatés.
import { supabase } from '@/lib/supabase';
import type { PublishedRoute, RouteHub, RouteType } from '@/types/route';
import type { TransportTypeId } from '@/constants/TransportTypes';
import type { PackageSize } from '@/constants/TransportTypes';

/** Un arrêt tel que la base l'attend : ordonné, hub facultatif. */
export type ArretTrajet = {
  hubId: string | null;
  ville: string;
  /** « HH:MM », ou rien si l'heure n'est pas connue. */
  heure: string | null;
};

type LigneTrajet = {
  id: string;
  transporter_id: string;
  type: RouteType;
  departure_city: string;
  arrival_city: string;
  departure_hub_id: string | null;
  delivery_hub_ids: string[];
  departure_time: string | null;
  recurring_days: number[];
  transport_mode: string;
  max_packages: number;
  max_size: PackageSize;
  max_weight_kg: number | string;
  off_hub_possible: boolean;
  status: 'active' | 'paused' | 'expired' | 'scheduled' | 'completed' | 'cancelled';
  missions_count: number;
  created_at: string;
  route_stops?: LigneArret[] | null;
};

type LigneArret = {
  hub_id: string | null;
  city: string | null;
  position: number;
  arrival_time: string | null;
  hubs?: { name: string | null } | null;
};

const CHAMPS = `
  id, transporter_id, type, departure_city, arrival_city,
  departure_hub_id, delivery_hub_ids, departure_time, recurring_days,
  transport_mode, max_packages, max_size, max_weight_kg, off_hub_possible,
  status, missions_count, created_at,
  route_stops ( hub_id, city, position, arrival_time, hubs ( name ) )
`;

/** « 08:30:00 » → « 08:30 ». La base rend un `time`, l'écran veut des heures. */
const heureCourte = (t: string | null): string => (t ? t.slice(0, 5) : '');

const versRouteHub = (a: LigneArret): RouteHub => ({
  hubId: a.hub_id ?? '',
  hubName: a.hubs?.name ?? a.city ?? '',
  city: a.city ?? '',
  arrivalTime: heureCourte(a.arrival_time),
});

/**
 * La forme que les écrans connaissent déjà.
 *
 * ⚠️ ON NE TOUCHE PAS AU TYPE `PublishedRoute` : douze écrans le lisent, et le
 * dessin n'est pas en cause. Seule la provenance change.
 */
function versTrajet(l: LigneTrajet): PublishedRoute {
  const arrets = [...(l.route_stops ?? [])].sort((a, b) => a.position - b.position);
  const depart = arrets[0];
  const remises = arrets.slice(1);
  return {
    id: l.id,
    transporterId: l.transporter_id,
    type: l.type,
    departureCity: l.departure_city,
    arrivalCity: l.arrival_city,
    pickupHub: depart
      ? versRouteHub(depart)
      : { hubId: '', hubName: l.departure_city, city: l.departure_city, arrivalTime: '' },
    deliveryHubs: remises.map(versRouteHub),
    transportType: l.transport_mode as TransportTypeId,
    maxPackages: l.max_packages,
    maxSize: l.max_size,
    // ⚠️ `numeric` ARRIVE EN CHAÎNE par PostgREST — même conversion que pour les
    // montants du grand livre.
    maxWeight: Number(l.max_weight_kg),
    horsHub: l.off_hub_possible,
    schedule: {
      pickupTime: depart ? heureCourte(depart.arrival_time) : '',
      deliveryTimes: Object.fromEntries(
        remises.map((a) => [a.hub_id ?? a.city ?? '', heureCourte(a.arrival_time)]),
      ),
      recurringDays: l.type === 'recurring' ? l.recurring_days : undefined,
    },
    // ⚠️ L'ENUM DE LA BASE EST PLUS LARGE QUE CELUI DE L'APP (`scheduled`,
    // `completed`, `cancelled`). Tout ce qui n'est ni actif ni en pause se lit
    // « expiré » côté écran — c'est ce que l'application sait afficher.
    status: l.status === 'active' ? 'active' : l.status === 'paused' ? 'paused' : 'expired',
    missionsCount: l.missions_count,
    createdAt: l.created_at,
  };
}

/** Mes trajets, le plus récent d'abord. */
export async function chargerMesTrajets(): Promise<PublishedRoute[]> {
  // ⚠️ ON NE FILTRE PAS SUR SOI-MÊME : `published_routes_owner_read` ne rend
  // déjà que les siens.
  const { data, error } = await supabase
    .from('published_routes')
    .select(CHAMPS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as LigneTrajet[]).map(versTrajet);
}

/**
 * Publier un trajet.
 *
 * ⚠️ LES ARRÊTS SONT LA SEULE SOURCE : le serveur en DÉDUIT `departure_hub_id`
 * et `delivery_hub_ids`. Les envoyer en double garantirait qu'ils finissent par
 * se contredire.
 */
export async function publierTrajet(t: {
  type: RouteType;
  villeDepart: string;
  villeArrivee: string;
  arrets: ArretTrajet[];
  departLe?: string | null;
  joursRecurrents?: number[];
  transport: TransportTypeId;
  maxColis: number;
  tailleMax: PackageSize;
  poidsMaxKg: number;
  horsHub: boolean;
}): Promise<PublishedRoute> {
  const { data, error } = await supabase.rpc('publier_trajet', {
    p_type: t.type,
    p_departure_city: t.villeDepart.trim(),
    p_arrival_city: t.villeArrivee.trim(),
    p_arrets: t.arrets.map((a) => ({
      hub_id: a.hubId || null,
      city: a.ville,
      arrival_time: a.heure || null,
    })),
    p_departure_time: t.departLe ?? null,
    p_recurring_days: t.joursRecurrents ?? [],
    p_transport_mode: t.transport,
    p_max_packages: Math.round(t.maxColis),
    p_max_size: t.tailleMax,
    p_max_weight_kg: t.poidsMaxKg,
    p_off_hub_possible: t.horsHub,
  });
  if (error) throw new Error(error.message);
  const l = (Array.isArray(data) ? data[0] : data) as LigneTrajet | null;
  if (!l) throw new Error('trajet non enregistré');
  // La RPC rend la ligne seule ; on relit pour récupérer les arrêts.
  const tous = await chargerMesTrajets();
  return tous.find((x) => x.id === l.id) ?? versTrajet(l);
}

/**
 * Mettre en pause ou réactiver.
 *
 * ⚠️ C'EST UN `update` DIRECT, PAS UNE RPC, et c'est légitime : la policy
 * `published_routes_owner_update` encadre la ligne, et le droit colonne encadre
 * le champ. `status` est l'un des sept que le propriétaire possède vraiment.
 */
export async function basculerTrajet(
  id: string,
  actif: boolean,
): Promise<void> {
  const { error } = await supabase
    .from('published_routes')
    .update({ status: actif ? 'active' : 'paused', updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/** Modifier la capacité et le mode de transport. */
export async function modifierTrajet(
  id: string,
  m: {
    transport?: TransportTypeId;
    maxColis?: number;
    tailleMax?: PackageSize;
    poidsMaxKg?: number;
    horsHub?: boolean;
  },
): Promise<void> {
  const { error } = await supabase
    .from('published_routes')
    .update({
      ...(m.transport !== undefined ? { transport_mode: m.transport } : {}),
      ...(m.maxColis !== undefined ? { max_packages: Math.round(m.maxColis) } : {}),
      ...(m.tailleMax !== undefined ? { max_size: m.tailleMax } : {}),
      ...(m.poidsMaxKg !== undefined ? { max_weight_kg: m.poidsMaxKg } : {}),
      ...(m.horsHub !== undefined ? { off_hub_possible: m.horsHub } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

/**
 * Retirer un trajet.
 *
 * ⚠️ LE SERVEUR REFUSE SI UNE CO-LIVRAISON EST EN COURS, et son message le dit.
 * On le remonte tel quel : c'est une règle, pas une panne.
 */
export async function retirerTrajet(id: string): Promise<void> {
  const { error } = await supabase.rpc('retirer_trajet', { p_id: id });
  if (error) throw new Error(error.message);
}
