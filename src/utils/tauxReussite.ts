// Le taux de réussite d'un cotransporteur — le sien, pas celui d'un autre.
//
// 🔴 IL ÉTAIT ÉCRIT EN DUR : `value="96%"`, un littéral de chaîne dans
// `(tabs)/index.tsx`. Aucun calcul, aucune source, rien à rafraîchir. Un compte
// créé le jour même, avec zéro co-livraison, affichait « 96% Taux réussite ».
//
// 🔴 ET LA TUILE ÉTAIT ENCADRÉE PAR DEUX TUILES HONNÊTES, ce qui est la partie
// gênante. « Co-livraisons » lit `totalDeliveries` (0, vrai) et « Note moyenne »
// affiche « — » faute de note — corrigé le 02/09/2026, pour cette raison exacte.
// Entre les deux, un 96% inventé, et rien pour l'en distinguer.
//
//     [ Co-livraisons : 0 ]  [ Taux réussite : 96% ]  [ Note moyenne : — ]
//               vrai                   faux                   vrai
//
// ⚠️ VU SUR L'APPAREIL le 02/09/2026, connecté en `transporteur+clerk_test`
// (Marc Dubois, zéro co-livraison, aucune mission terminée).
//
// ⚠️ CE N'EST PAS UNE STATISTIQUE FLATTEUSE, C'EST UNE PROMESSE. Un taux de
// réussite est ce qu'un expéditeur regarde pour confier un colis, et ce qu'un
// cotransporteur croit avoir gagné. L'inventer, c'est mentir aux deux — et le
// jour où la vraie valeur descend sous 96%, personne ne le verra.

/** Ce dont on a besoin d'une mission pour trancher : rien d'autre. */
export type MissionJugee = { status: string };

const REUSSIES = ['delivered', 'completed'];
const ECHOUEES = ['cancelled'];

/**
 * Le taux, en pourcentage entier — ou `null` quand il n'y a rien à mesurer.
 *
 * 🔴 `null`, PAS `0` NI `100`. Les deux mentiraient : un compte neuf n'a pas
 * « 0% de réussite » (il n'a échoué à rien) ni « 100% » (il n'a rien réussi).
 * L'écran affiche « — », comme il le fait déjà pour la note moyenne — et c'est
 * exactement la même règle, appliquée à la tuile d'à côté.
 *
 * ⚠️ LES MISSIONS EN COURS NE COMPTENT NI D'UN CÔTÉ NI DE L'AUTRE. Une
 * co-livraison acceptée ce matin n'est pas un échec parce qu'elle n'est pas
 * encore arrivée ; la compter au dénominateur ferait chuter le taux à chaque
 * nouvelle mission, ce qui punirait le fait de travailler.
 */
export function tauxReussite(missions: readonly MissionJugee[]): number | null {
  let reussies = 0;
  let echouees = 0;
  for (const m of missions) {
    if (REUSSIES.includes(m.status)) reussies += 1;
    else if (ECHOUEES.includes(m.status)) echouees += 1;
  }
  const jugees = reussies + echouees;
  if (jugees === 0) return null;
  return Math.round((reussies / jugees) * 100);
}

/** Ce que la tuile affiche — « — » tant qu'il n'y a rien à montrer. */
export function tauxReussiteLabel(missions: readonly MissionJugee[]): string {
  const t = tauxReussite(missions);
  return t === null ? '—' : `${t}%`;
}
