// Le motif d'un signalement, dit dans le vocabulaire de la base.
//
// 🔴 SIGNALER QUELQU'UN NE FAISAIT RIEN. `submitUserReport` attendait une
// seconde et rendait un identifiant fabriqué :
//
//     export async function submitUserReport(payload) {
//       await new Promise((r) => setTimeout(r, 1000));
//       return { id: `ureport-${Date.now()}`, createdAt: … };
//     }
//
// Le signalant voyait un écran de succès et une référence qui n'existe nulle
// part. Parmi les motifs : « Danger, menace ou comportement agressif ».
//
// 🔴 ET LA PLATEFORME SAIT LES RECEVOIR. `signaler_utilisateur` écrit dans
// `user_reports`, peut bloquer le contact dans le même geste, et sert déjà la
// place de marché. Seule cette application-ci ne l'appelait pas.
//
// ⚠️ LES DEUX VOCABULAIRES NE SE RECOUVRENT PAS. L'application cotransporteur a
// six motifs, écrits pour un rendez-vous physique ; la base en connaît onze,
// écrits pour une place de marché. On traduit ici, à un seul endroit, plutôt que
// dans l'écran — c'est la règle qu'on a déjà appliquée aux types de
// notification (`typeNotification`).

/** Les motifs proposés par l'écran de signalement. */
export type MotifEcran =
  | 'danger'
  | 'fraud'
  | 'package_problem'
  | 'suspicious_meeting'
  | 'disrespect'
  | 'other';

/** Les motifs que `user_report_reason` accepte. */
export type MotifBase =
  | 'fraud' | 'harassment' | 'aggressive' | 'spam' | 'fake_profile'
  | 'hate_speech' | 'inappropriate' | 'suspicious_meeting'
  | 'rule_circumvention' | 'suspicious_behavior' | 'other';

/**
 * 🔴 CHAQUE MOTIF D'ÉCRAN A SA TRADUCTION, ET AUCUNE N'ADOUCIT LE PROPOS.
 *
 * « Danger, menace ou comportement agressif » devient `aggressive`, pas
 * `inappropriate` : un signalement traité doit garder la gravité qu'on lui a
 * donnée. Le repli est `other` — jamais un motif plus léger choisi au hasard.
 *
 * ⚠️ `package_problem` N'A PAS D'ÉQUIVALENT, et c'est normal : la base décrit
 * des comportements, pas des colis. Un colis abîmé relève des incidents, pas du
 * signalement de personne. Il part donc en `other`, avec l'explication du
 * signalant — qui, elle, est transmise mot pour mot.
 */
const TRADUCTION: Record<MotifEcran, MotifBase> = {
  danger: 'aggressive',
  fraud: 'fraud',
  package_problem: 'other',
  suspicious_meeting: 'suspicious_meeting',
  disrespect: 'harassment',
  other: 'other',
};

/**
 * Le motif de base correspondant.
 *
 * ⚠️ UN MOTIF INCONNU NE FAIT PAS ÉCHOUER LE SIGNALEMENT. Perdre un signalement
 * parce qu'un libellé a changé serait exactement le défaut qu'on répare : le
 * signalant a fait son geste, il doit arriver.
 */
export function motifDeBase(motif: string): MotifBase {
  return TRADUCTION[motif as MotifEcran] ?? 'other';
}

/** Les motifs qui appellent une analyse immédiate côté support. */
const PRIORITAIRES: readonly MotifEcran[] = ['danger', 'fraud', 'suspicious_meeting'];

/**
 * ⚠️ LA PRIORITÉ RESTE CELLE DE L'ÉCRAN, pas une déduction faite après coup sur
 * le motif traduit : `danger` et `package_problem` deviennent tous deux `other`
 * ou `aggressive` en base, et les confondre au retour ferait passer une menace
 * pour un colis abîmé.
 */
export function estPrioritaire(motif: string): boolean {
  return PRIORITAIRES.includes(motif as MotifEcran);
}
