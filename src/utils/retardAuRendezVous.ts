// Quand l'autre partie n'est pas venue — et quand on a le droit de le dire.
//
// 🔴 LES DEUX ALERTES DE `mission/group.tsx` NE POUVAIENT PAS S'AFFICHER :
//
//     const isPickupLate   = mission.status === 'pickup_pending'   && …
//     const isDeliveryLate = mission.status === 'delivery_pending' && …
//
// • `pickup_pending` n'est écrit par RIEN — ni la place de marché, ni cette
//   application, ni une routine serveur. `app.statut_mission` ne le produit que
//   depuis l'état d'expédition du même nom, montré inatteignable le 03/09/2026 :
//   la récupération va de `seller_confirmed` droit à `picked_up`.
//
// • `delivery_pending` vient de `out_for_delivery`, `redelivery_pending` ou
//   `return_pending`. Une co-livraison va de `in_transit` droit à `delivered`.
//
// 🔴 CE QUE ÇA COÛTAIT. Le vendeur ne vient pas ; le cotransporteur attend,
// l'heure et la tolérance passées — et l'écran se tait. Le message était écrit
// pour cet instant précis : « Le vendeur ne s'est pas présenté — Pas
// d'inquiétude, aucune pénalité pour vous. »
//
// ⚠️ ET LE MÊME FICHIER SAIT DÉJÀ ÉCRIRE LA BONNE CONDITION : partout ailleurs
// il apparie `group_created` et `pickup_pending`. Ces deux lignes-là étaient les
// seules à ne nommer que le statut orphelin — un oubli, pas une intention.

/** Le rendez-vous concerné : celui du vendeur, ou celui de l'acheteur. */
export type Rendezvous = 'pickup' | 'delivery';

export type EtatRendezVous = {
  /** Le statut de la mission, tel que `app.statut_mission` le projette. */
  statut: string;
  /** L'heure convenue, en ISO. */
  heurePrevue: string;
  /** La tolérance accordée, en minutes, avant qu'on parle de retard. */
  toleranceMinutes: number;
};

/**
 * Les statuts pendant lesquels on ATTEND encore la partie d'en face.
 *
 * ⚠️ ON GARDE LES STATUTS ORPHELINS DANS LA LISTE. `pickup_pending` et
 * `delivery_pending` restent des statuts légaux du domaine ; s'ils devenaient un
 * jour écrits, l'alerte doit marcher aussi. Le défaut n'était pas de les citer,
 * c'était d'en faire la SEULE porte.
 */
const EN_ATTENTE: Record<Rendezvous, readonly string[]> = {
  // Une co-livraison confirmée par le vendeur attend sa récupération.
  pickup: ['group_created', 'pickup_pending'],
  // Une fois le colis pris, on attend l'acheteur.
  delivery: ['picked_up', 'in_transit', 'deposited', 'delivery_pending'],
};

/**
 * L'attente a-t-elle dépassé l'heure convenue ET la tolérance ?
 *
 * ⚠️ LA TOLÉRANCE PROTÈGE L'AUTRE PARTIE. Annoncer « le vendeur ne s'est pas
 * présenté » à l'heure pile accuserait quelqu'un qui arrive dans les temps
 * convenus. On attend donc la fin de la fenêtre, strictement.
 */
export function attenteDepassee(e: EtatRendezVous, quand: Rendezvous): boolean {
  if (!EN_ATTENTE[quand].includes(e.statut)) return false;
  const limite = new Date(e.heurePrevue).getTime() + e.toleranceMinutes * 60_000;
  if (Number.isNaN(limite)) return false;
  return Date.now() > limite;
}
