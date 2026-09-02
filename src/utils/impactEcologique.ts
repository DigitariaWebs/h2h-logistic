// L'IMPACT ÉCOLOGIQUE, CALCULÉ SUR DE VRAIES CO-LIVRAISONS.
//
// 🔴 CE QU'IL AFFICHAIT AVANT. `useEcoImpactStore` portait un `MOCK_SEED` —
// 24,7 kg au total, 6,8 kg ce mois-ci, 47 co-livraisons — chargé au montage de
// l'accueil et de l'écran des participations par `loadMockData()`. Sur
// l'appareil le 02/09/2026, connecté en `transporteur+clerk_test` (compte créé
// le matin, ZÉRO co-livraison), la carte annonçait « Ce mois : 6,8 kg CO₂
// évités / Depuis le début : 25 kg / ≈ 12 mois de CO₂ absorbé par un arbre ».
//
// ⚠️ CE N'EST PAS UN COMPTEUR FLATTEUR, C'EST UNE ALLÉGATION ENVIRONNEMENTALE.
// Un chiffre de CO₂ évité affiché à quelqu'un qui n'a rien transporté n'est pas
// une donnée de démonstration comme une autre : c'est exactement le genre
// d'affirmation qu'une plateforme ne peut pas se permettre d'inventer.
//
// 🔴 ET TOUT EXISTAIT DÉJÀ POUR LE CALCULER VRAIMENT. `utils/carbon.ts` porte
// un modèle documenté — 250 g/km pour une tournée dédiée en fourgon, moins les
// grammes réels du mode emprunté — et `mission/delivery.tsx` s'en servait déjà
// après chaque remise. Seule la GRAINE était inventée.
//
// ⚠️ ON DÉRIVE PLUTÔT QUE D'ACCUMULER, et c'est ce qui change tout : le magasin
// n'avait aucune persistance, donc ce que `registerDelivery` ajoutait en
// mémoire disparaissait au redémarrage. Recalculer depuis les missions
// terminées donne un total qui SURVIT, et qui se corrige tout seul si une
// mission change d'état.
import { calculateCo2Saved, estimateDistanceKm } from '@/utils/carbon';

/** Le strict nécessaire d'une mission terminée. */
export type MissionPourImpact = {
  routeId?: string;
  updatedAt?: string;
  pickupHub?: { city?: string };
  deliveryHub?: { city?: string };
};

/** Le strict nécessaire d'un trajet : son mode de transport. */
export type TrajetPourImpact = { id: string; transportType?: string };

/** Un mois du graphique — même forme que celle que l'écran de détail dessinait. */
export type MoisImpact = { month: string; kgSaved: number; deliveries: number };

export type ImpactCo2 = {
  /** Kilogrammes évités sur le mois calendaire en cours. */
  ceMois: number;
  /** Le mois calendaire précédent — sert de repère à l'anneau de progression. */
  moisDernier: number;
  /** Tout ce qui a été évité depuis l'inscription. */
  total: number;
  /** Le détail mensuel, du plus ancien au plus récent. */
  parMois: MoisImpact[];
  /** Le nombre de co-livraisons réellement comptées. */
  livraisons: number;
};

const arrondi = (kg: number) => Math.round(kg * 100) / 100;
// 'YYYY-MM' zéro-comblé : c'est la clef que l'écran de détail découpe pour en
// retrouver le libellé de mois.
const clef = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

/**
 * L'impact des co-livraisons RÉELLEMENT terminées.
 *
 * ⚠️ LA DATE RETENUE EST `updatedAt`, ET C'EST UNE APPROXIMATION ASSUMÉE. La
 * vraie date de remise (`delivery_validated_at`) n'est pas dans les colonnes
 * que l'application lit ; pour une mission terminée, sa dernière modification
 * est l'instant où elle l'est devenue. L'écart possible ne déplace un kilo que
 * d'un mois à l'autre, jamais le total.
 *
 * ⚠️ UNE MISSION SANS VILLES NE COMPTE PAS POUR ZÉRO PAR HASARD :
 * `estimateDistanceKm` rendrait sa valeur par défaut (25 km) sur des chaînes
 * vides et inventerait des kilos. On l'écarte explicitement.
 */
export function impactCo2(
  missionsTerminees: readonly MissionPourImpact[],
  trajets: readonly TrajetPourImpact[],
  maintenant: Date = new Date(),
): ImpactCo2 {
  const modes = new Map(trajets.map((t) => [t.id, t.transportType]));

  const moisCourant = clef(maintenant);
  const precedent = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
  const moisPrecedent = clef(precedent);

  let ceMois = 0;
  let moisDernier = 0;
  let total = 0;
  let livraisons = 0;
  const mois = new Map<string, MoisImpact>();

  for (const m of missionsTerminees) {
    const depart = m.pickupHub?.city?.trim();
    const arrivee = m.deliveryHub?.city?.trim();
    if (!depart || !arrivee) continue;

    const km = estimateDistanceKm(depart, arrivee);
    // ⚠️ LE MODE VIENT DU TRAJET, PAS DE LA MISSION. Un trajet supprimé depuis
    // laisse `undefined` ; `calculateCo2Saved` retombe alors sur la voiture,
    // qui est le mode le plus courant et le plus prudent des trois.
    const kg = calculateCo2Saved(km, (modes.get(m.routeId ?? '') ?? 'car') as never);
    if (kg <= 0) continue;

    total += kg;
    livraisons += 1;

    const quand = m.updatedAt ? new Date(m.updatedAt) : null;
    if (!quand || Number.isNaN(quand.getTime())) continue;
    const k = clef(quand);
    if (k === moisCourant) ceMois += kg;
    else if (k === moisPrecedent) moisDernier += kg;

    const cumul = mois.get(k) ?? { month: k, kgSaved: 0, deliveries: 0 };
    cumul.kgSaved = arrondi(cumul.kgSaved + kg);
    cumul.deliveries += 1;
    mois.set(k, cumul);
  }

  return {
    ceMois: arrondi(ceMois),
    moisDernier: arrondi(moisDernier),
    total: arrondi(total),
    parMois: [...mois.values()].sort((a, b) => a.month.localeCompare(b.month)),
    livraisons,
  };
}
