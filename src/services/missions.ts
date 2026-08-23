// LES CO-LIVRAISONS — proposées, acceptées, refusées en base.
//
// 🔴 CE QUE ÇA REMPLACE. `services/mock/missions.ts` : sept missions écrites à
// la main, avec des noms, des hubs et des montants inventés. Le cotransporteur
// particulier voyait des propositions que personne ne lui avait faites, pour des
// colis qui n'existent pas — et « accepter » ne remontait nulle part.
//
// 🔴 ET `public.missions` N'ÉTAIT MÊME PAS LISIBLE : la policy
// `missions_member_read` existe depuis l'origine, mais la table ne portait aucun
// droit `select`. Toute lecture rendait `permission denied for table missions`.
// Corrigé par la migration `20260822260000`.
//
// ⚠️ LE STATUT NE S'ENVOIE JAMAIS. `missions.status` est une PROJECTION de
// `shipments.state`, forcée par un trigger : même une fonction `security
// definer` ne peut pas y écrire autre chose. Le client le LIT, point.
import { supabase } from '@/lib/supabase';
import type { Mission, MissionParticipant, MissionStatus } from '@/types/mission';

/** Ce que la base rend pour une mission. `platform_fee_cents` n'est pas lisible. */
type LigneMission = {
  id: string;
  order_id: string | null;
  shipment_id: string | null;
  route_id: string | null;
  group_id: string | null;
  tracking_number: string | null;
  status: MissionStatus;
  seller_id: string;
  buyer_id: string;
  transporter_id: string | null;
  package_description: string | null;
  parcel_format: string | null;
  package_weight_kg: number | string | null;
  package_photo: string | null;
  pickup_hub_id: string | null;
  delivery_hub_id: string | null;
  pickup_scheduled_at: string | null;
  delivery_scheduled_at: string | null;
  tolerance_minutes: number;
  /** ⚠️ PostgREST rend les `bigint` en TEXTE. Toujours passer par `Number`. */
  price_cents: number | string;
  transporter_earning_cents: number | string;
  seller_timer_end: string | null;
  proposal_expires_at: string | null;
  is_return: boolean;
  off_hub_address: string | null;
  is_off_hub: boolean;
  created_at: string;
  updated_at: string;
};

const CHAMPS = `
  id, order_id, shipment_id, route_id, group_id, tracking_number, status,
  seller_id, buyer_id, transporter_id,
  package_description, parcel_format, package_weight_kg, package_photo,
  pickup_hub_id, delivery_hub_id, pickup_scheduled_at, delivery_scheduled_at,
  tolerance_minutes, price_cents, transporter_earning_cents,
  seller_timer_end, proposal_expires_at, is_return,
  off_hub_address, is_off_hub, created_at, updated_at
`;

type LigneProfil = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number | string | null;
};

type LigneHub = { id: string; name: string; city: string | null };

const euros = (c: number | string | null | undefined): number => Number(c ?? 0) / 100;

/**
 * ⚠️ ON PASSE PAR `profils_publics`, PAS PAR `profiles`.
 * `profiles_self_read` ne laisse lire QUE sa propre ligne : un cotransporteur
 * ne peut pas lire le profil du vendeur ni celui de l'acheteur. La vue publique
 * rend le pseudonyme, l'avatar et la note — l'identité PUBLIQUE, et rien
 * d'autre.
 *
 * 🔴 ET PAS DE TÉLÉPHONE. Il n'est dans aucune vue publique, délibérément : le
 * contact passe par la messagerie de la plateforme, où il laisse une trace.
 */
async function chargerProfils(ids: string[]): Promise<Map<string, LigneProfil>> {
  const uniques = [...new Set(ids.filter(Boolean))];
  if (uniques.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profils_publics')
    .select('id, username, avatar_url, rating')
    .in('id', uniques);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as LigneProfil[]).map((p) => [p.id, p]));
}

async function chargerHubs(ids: (string | null)[]): Promise<Map<string, LigneHub>> {
  const uniques = [...new Set(ids.filter((i): i is string => Boolean(i)))];
  if (uniques.length === 0) return new Map();
  const { data, error } = await supabase
    .from('hubs')
    .select('id, name, city')
    .in('id', uniques);
  if (error) throw new Error(error.message);
  return new Map(((data ?? []) as LigneHub[]).map((h) => [h.id, h]));
}

const participant = (
  id: string,
  role: MissionParticipant['role'],
  profils: Map<string, LigneProfil>,
): MissionParticipant => {
  const p = profils.get(id);
  return {
    id,
    // ⚠️ LE PSEUDONYME EST LA SEULE IDENTITÉ PUBLIQUE — jamais prénom ni nom.
    name: p?.username ?? 'Membre HandtoHand',
    avatar: p?.avatar_url ?? undefined,
    rating: p?.rating == null ? undefined : Number(p.rating),
    role,
  };
};

/**
 * ⚠️ UN POINT DE RENDEZ-VOUS SANS HUB EST LÉGITIME : `public.hubs` est vide, le
 * réseau se recrute. La remise se fait alors en main propre, et l'écran doit le
 * dire plutôt que d'afficher un nom vide.
 */
const pointDeRencontre = (
  hubId: string | null,
  quand: string | null,
  tolerance: number,
  hors: boolean,
  adresse: string | null,
  hubs: Map<string, LigneHub>,
) => {
  const h = hubId ? hubs.get(hubId) : undefined;
  return {
    id: hubId ?? '',
    name: h?.name ?? (hors && adresse ? adresse : 'Remise en main propre'),
    city: h?.city ?? '',
    scheduledTime: quand ?? '',
    toleranceMinutes: tolerance,
    isOffHub: hors || !hubId,
    offHubAddress: adresse ?? undefined,
  };
};

function versMission(
  l: LigneMission,
  profils: Map<string, LigneProfil>,
  hubs: Map<string, LigneHub>,
): Mission {
  const price = euros(l.price_cents);
  const part = euros(l.transporter_earning_cents);
  return {
    id: l.id,
    shipmentId: l.shipment_id ?? '',
    routeId: l.route_id ?? '',
    status: l.status,
    seller: participant(l.seller_id, 'seller', profils),
    buyer: participant(l.buyer_id, 'buyer', profils),
    transporter: l.transporter_id
      ? participant(l.transporter_id, 'transporter', profils)
      : { id: '', name: '—', role: 'transporter' },
    package: {
      id: l.shipment_id ?? l.id,
      description: l.package_description ?? 'Colis',
      size: l.parcel_format ?? 'M',
      weight: Number(l.package_weight_kg ?? 0),
      photo: l.package_photo ?? undefined,
      trackingNumber: l.tracking_number ?? undefined,
    },
    pickupHub: pointDeRencontre(
      l.pickup_hub_id, l.pickup_scheduled_at, l.tolerance_minutes,
      l.is_off_hub, l.off_hub_address, hubs,
    ),
    deliveryHub: pointDeRencontre(
      l.delivery_hub_id, l.delivery_scheduled_at, l.tolerance_minutes,
      l.is_off_hub, l.off_hub_address, hubs,
    ),
    price,
    transporterEarning: part,
    // 🔴 CALCULÉE, PAS LUE. `missions.platform_fee_cents` n'est pas accordée aux
    // clients : c'est une donnée comptable interne. L'écart entre le tarif et la
    // participation la donne de toute façon — mais depuis des chiffres que le
    // cotransporteur a le droit de voir.
    platformFee: Math.round((price - part) * 100) / 100,
    sellerTimerEnd: l.seller_timer_end ?? undefined,
    proposalExpiresAt: l.proposal_expires_at ?? undefined,
    isReturn: l.is_return,
    createdAt: l.created_at,
    updatedAt: l.updated_at,
  };
}

/**
 * Toutes les co-livraisons qui me concernent.
 *
 * ⚠️ LA POLICY `missions_member_read` FILTRE DÉJÀ sur vendeur / acheteur /
 * cotransporteur. Refiltrer ici serait redondant et finirait par diverger.
 */
export async function chargerMissions(): Promise<Mission[]> {
  const { data, error } = await supabase
    .from('missions')
    .select(CHAMPS)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);

  const lignes = (data ?? []) as unknown as LigneMission[];
  if (lignes.length === 0) return [];

  const [profils, hubs] = await Promise.all([
    chargerProfils(lignes.flatMap((l) => [l.seller_id, l.buyer_id, l.transporter_id ?? ''])),
    chargerHubs(lignes.flatMap((l) => [l.pickup_hub_id, l.delivery_hub_id])),
  ]);
  return lignes.map((l) => versMission(l, profils, hubs));
}

/**
 * Accepter une proposition.
 *
 * 🔴 LE SERVEUR REFUSE PLUS DE CAS QUE L'ÉCRAN N'EN PRÉVOIT : proposition
 * adressée à quelqu'un d'autre, délai de quinze minutes passé, colis déjà pris,
 * trajet complet ou mis en pause, rôle suspendu depuis l'envoi. L'appelant doit
 * MONTRER le message — griser un bouton ne suffit pas.
 */
export async function accepterMission(missionId: string): Promise<void> {
  const { error } = await supabase.rpc('accepter_mission', { p_mission_id: missionId });
  if (error) throw new Error(error.message);
}

/**
 * Refuser une proposition.
 *
 * ⚠️ REFUSER N'ANNULE PAS LA CO-LIVRAISON. Le colis repart vers un autre
 * cotransporteur ; le refus est mémorisé pour que la proposition suivante n'aille
 * pas au même. Rien n'est perdu pour l'acheteur.
 */
export async function refuserMission(missionId: string, motif?: string): Promise<void> {
  const { error } = await supabase.rpc('refuser_mission', {
    p_mission_id: missionId,
    p_motif: motif?.trim() || null,
  });
  if (error) throw new Error(error.message);
}
