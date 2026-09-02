// L'heure de passage à un hub, telle qu'on la saisit vraiment.
//
// 🔴 CE QUE LES ÉCRANS VÉRIFIAIENT AVANT : `time.trim().length >= 4`. Rien
// d'autre. Pas de format, pas de bornes. Quatre caractères suffisaient à
// publier un trajet, et ce qui était saisi partait tel quel en base.
//
// 🔴 « 7h30 » FAISAIT PLANTER L'ACCUEIL. C'est la façon dont on écrit une heure
// en français, et le champ l'acceptait (quatre caractères). Plus tard,
// `DailyConfirmation` fait :
//
//     const [hours, mins] = (route.schedule.pickupTime ?? '07:00').split(':').map(Number);
//     today.setHours(hours, mins, 0, 0);
//     const scheduledTime = today.toISOString();   // <-- RangeError
//
// `'7h30'.split(':')` vaut `['7h30']` : `hours` est NaN, `mins` est undefined,
// la date devient invalide et `toISOString()` LÈVE. La carte « Trajet du jour »
// de l'écran d'accueil ne s'affichait donc pas — elle jetait.
//
// ⚠️ ET LES ENTRÉES QUI NE PLANTAIENT PAS ÉTAIENT PIRES, parce qu'elles
// passaient inaperçues. Mesuré le 02/09/2026 :
//
//     '1234'   -> RangeError
//     '7h30'   -> RangeError
//     '99:99'  -> 2026-09-06T03:39  (quatre jours plus tard, sans un mot)
//     '::::'   -> la veille 23:00
//     '07:5'   -> 07:05, quand l'utilisateur voulait sans doute 07:50
//
// Une heure de passage fausse n'est pas un détail d'affichage : c'est ce sur
// quoi un vendeur et un acheteur se déplacent.
//
// ⚠️ ON ACCEPTE CE QUE LES GENS TAPENT, on ne le leur reproche pas. « 7h30 »,
// « 7:30 », « 730 » et « 07:30 » désignent la même heure ; les refuser tous
// sauf un serait transformer un défaut d'analyse en leçon de saisie. En
// revanche « 07:5 » est REFUSÉ : il veut dire 07:05 ou 07:50 et rien ne permet
// de trancher — deviner, c'est se tromper une fois sur deux en silence.

/** `HH:MM` sur 24 heures, ou `null` si la saisie ne désigne aucune heure. */
export function normaliserHeure(saisie: string | null | undefined): string | null {
  if (!saisie) return null;
  const t = saisie.trim().toLowerCase().replace(/\s+/g, '');
  if (!t) return null;

  let h: number;
  let m: number;

  // « 7:30 », « 07h30 », « 7.30 »
  let r = /^(\d{1,2})[:h.](\d{2})$/.exec(t);
  if (r) {
    h = Number(r[1]);
    m = Number(r[2]);
  } else if ((r = /^(\d{1,2})[h:.]$/.exec(t))) {
    // « 7h » — l'heure pile, écrite comme on la dit.
    h = Number(r[1]);
    m = 0;
  } else if ((r = /^(\d{3,4})$/.exec(t))) {
    // « 730 » / « 0730 » — le pavé numérique sans séparateur.
    const n = r[1];
    h = Number(n.slice(0, n.length - 2));
    m = Number(n.slice(-2));
  } else {
    return null;
  }

  // ⚠️ LES BORNES SONT LA MOITIÉ DU TRAVAIL. Sans elles « 99:99 » repartait en
  // base et devenait une date à quatre jours de là, sans rien signaler.
  if (!Number.isInteger(h) || !Number.isInteger(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;

  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Vrai si la saisie désigne une heure réelle. */
export const heureValide = (saisie: string | null | undefined): boolean =>
  normaliserHeure(saisie) !== null;

/**
 * Minutes depuis minuit, pour comparer deux heures.
 *
 * ⚠️ `null` PLUTÔT QUE `NaN` : un NaN se propage dans une comparaison sans
 * jamais la rendre fausse (`NaN < x` est faux, `NaN > x` aussi), donc une borne
 * calculée sur un NaN s'accepte toujours. C'est exactement ainsi que « 7h30 »
 * traversait tout l'écran de publication.
 */
export function minutesDepuisMinuit(saisie: string | null | undefined): number | null {
  const hhmm = normaliserHeure(saisie);
  if (!hhmm) return null;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}
