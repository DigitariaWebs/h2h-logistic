// Ce qu'un trajet a réellement rapporté, en moyenne, par co-livraison.
//
// 🔴 C'ÉTAIT UN LITTÉRAL. `route/[id].tsx` calculait :
//
//     const avgEarnings = route.missionsCount > 0 ? 4.5 : 0; // mock average
//
// Deux valeurs possibles, pour tous les trajets de tous les cotransporteurs :
// 4,50 € dès qu'une co-livraison existe, 0 € sinon. Le montant ne dépendait ni
// des missions du trajet, ni de leurs participations — que chaque mission porte
// pourtant (`transporterEarning`).
//
// 🔴 ET LA TUILE VOISINE EST VRAIE, ce qui est le pire arrangement : « 3
// Co-livraisons » lit `route.missionsCount`, et juste à droite « 4,50 € » est
// inventé. Rien ne les distingue à l'écran.
//
// ⚠️ MÊME FAMILLE QUE LE « 96% TAUX RÉUSSITE » (voir `tauxReussite`), et même
// règle : ce qu'on ne mesure pas s'affiche « — ». Mais ici c'est de l'argent —
// ce qu'un cotransporteur croit avoir gagné, et ce sur quoi il décide de
// republier son trajet.

/** Ce qu'on a besoin de savoir d'une mission : rien d'autre. */
export type MissionRemuneree = {
  status: string;
  /** La participation aux frais, en euros. */
  transporterEarning: number;
};

/**
 * 🔴 CE QUI COMPTE, C'EST CE QUI A ÉTÉ VERSÉ.
 *
 * La participation se libère à la REMISE — vérifié le 03/09/2026 : les écritures
 * comptables naissent au scan de livraison, pas à l'acceptation. Une mission en
 * cours n'a donc rien rapporté encore, et peut ne jamais rien rapporter.
 */
const PERCUES = ['delivered', 'completed'];

/**
 * La participation moyenne des co-livraisons ABOUTIES, ou `null` s'il n'y en a
 * aucune.
 *
 * 🔴 `null`, PAS `0`. Un trajet neuf n'a pas « une participation moyenne de
 * 0 € » — il n'en a pas encore. Annoncer 0 € dirait au cotransporteur que ce
 * trajet ne rapporte rien : c'est une information, et elle est fausse.
 *
 * ⚠️ ET LES MISSIONS EN COURS SORTENT AUSSI DU DÉNOMINATEUR. Les y laisser
 * ferait chuter la moyenne à chaque nouvelle co-livraison acceptée — donc punir
 * le fait de travailler, sur l'écran même où l'on décide de continuer.
 */
export function participationMoyenne(missions: readonly MissionRemuneree[]): number | null {
  const percues = missions.filter((m) => PERCUES.includes(m.status));
  if (percues.length === 0) return null;
  const total = percues.reduce((s, m) => s + m.transporterEarning, 0);
  // ⚠️ ARRONDI AU CENTIME : la moyenne de deux montants en centimes n'en est pas
  // un, et un écran d'argent ne montre pas 4.3100000000000005.
  return Math.round((total / percues.length) * 100) / 100;
}

/** Ce que la tuile affiche — « — » tant qu'aucune co-livraison n'a abouti. */
export function participationMoyenneLabel(missions: readonly MissionRemuneree[]): string {
  const m = participationMoyenne(missions);
  return m === null ? '—' : `${m.toFixed(2).replace('.', ',')} €`;
}
