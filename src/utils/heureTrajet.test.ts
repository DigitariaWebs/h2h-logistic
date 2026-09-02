// « 7h30 » PUBLIAIT UN TRAJET, PUIS FAISAIT PLANTER L'ACCUEIL.
//
// 🔴 LA CHAÎNE COMPLÈTE, mesurée le 02/09/2026. Les deux champs d'heure de
// l'application ne vérifiaient qu'une chose : `time.trim().length >= 4`. Ni
// format, ni bornes. « 7h30 » — la façon dont on écrit une heure en français —
// fait quatre caractères, passait donc, et partait tel quel en base. Plus tard,
// `DailyConfirmation` construit l'horaire du jour :
//
//     const [hours, mins] = (route.schedule.pickupTime ?? '07:00').split(':').map(Number);
//     today.setHours(hours, mins, 0, 0);
//     const scheduledTime = today.toISOString();
//
// `'7h30'.split(':')` vaut `['7h30']` : `hours` est NaN, `mins` undefined, la
// date devient invalide, et `toISOString()` LÈVE UN RangeError. La carte
// « Trajet du jour » de l'écran d'accueil ne s'affichait pas — elle jetait.
//
// 🔴 ET LES SAISIES QUI NE PLANTAIENT PAS ÉTAIENT PIRES, parce qu'elles ne
// disaient rien :
//
//     '1234'   -> RangeError
//     '7h30'   -> RangeError
//     '99:99'  -> 2026-09-06T03:39   (quatre jours plus loin, en silence)
//     '::::'   -> la veille a 23:00
//     '07:5'   -> 07:05, alors que l'utilisateur voulait sans doute 07:50
//
// Une heure de passage n'est pas un libellé : c'est l'heure à laquelle un
// vendeur et un acheteur se déplacent réellement vers un hub.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normaliserHeure, heureValide, minutesDepuisMinuit } from './heureTrajet';

test('🔴 « 7h30 » EST UNE HEURE, PAS UNE ERREUR DE L’UTILISATEUR', () => {
  // La saisie qui faisait planter l'accueil. On l'accepte, on ne la refuse pas :
  // refuser toutes les formes sauf une transformerait un defaut d analyse en
  // lecon de saisie.
  assert.equal(normaliserHeure('7h30'), '07:30');
  assert.equal(normaliserHeure('07h30'), '07:30');
  assert.equal(normaliserHeure('7:30'), '07:30');
  assert.equal(normaliserHeure('07:30'), '07:30');
  assert.equal(normaliserHeure('730'), '07:30');
  assert.equal(normaliserHeure('0730'), '07:30');
  assert.equal(normaliserHeure('7.30'), '07:30');
  assert.equal(normaliserHeure(' 7H30 '), '07:30');
  // L'heure pile, ecrite comme on la dit.
  assert.equal(normaliserHeure('7h'), '07:00');

  // 🔴 « 1234 » LEVAIT UN RangeError ; il vaut desormais 12:34 — ce que veut
  // dire quelqu'un qui tape quatre chiffres au pave numerique. Le correctif ne
  // se contente pas d'empecher la panne, il lit correctement la saisie.
  assert.equal(normaliserHeure('1234'), '12:34');
  assert.equal(heureValide('1234'), true);
});

test('🔴 CE QUI N’EST PAS UNE HEURE EST REFUSÉ AVANT LA BASE', () => {
  assert.equal(normaliserHeure('midi'), null);
  assert.equal(normaliserHeure('7h3'), null);
  assert.equal(normaliserHeure('-7:30'), null);

  // Celles qui passaient EN SILENCE, ce qui etait pire.
  assert.equal(normaliserHeure('99:99'), null, '« 99:99 » repasse : le trajet part a quatre jours de la');
  assert.equal(normaliserHeure('24:00'), null, '24:00 n existe pas : c est 00:00 du lendemain');
  assert.equal(normaliserHeure('::::'), null);
  assert.equal(normaliserHeure('12:60'), null);

  assert.equal(normaliserHeure(''), null);
  assert.equal(normaliserHeure(null), null);
  assert.equal(normaliserHeure(undefined), null);
});

test('🔴 « 07:5 » EST AMBIGU, DONC REFUSÉ — ON NE DEVINE PAS', () => {
  // 🔴 IL PASSAIT, ET DEVENAIT 07:05. Or il veut dire 07:05 ou 07:50, et rien
  // ne permet de trancher : deviner, c est se tromper une fois sur deux sans
  // que personne ne le sache. Un refus se corrige ; un mauvais rendez-vous non.
  assert.equal(normaliserHeure('07:5'), null);
  assert.equal(normaliserHeure('7:5'), null);
  // Deux chiffres seuls sont incomplets, pas une heure pile.
  assert.equal(normaliserHeure('7'), null);
  assert.equal(normaliserHeure('07'), null);
});

test('⚠️ LES BORNES SONT GARDÉES AUX EXTRÊMES', () => {
  assert.equal(normaliserHeure('00:00'), '00:00');
  assert.equal(normaliserHeure('23:59'), '23:59');
  assert.equal(normaliserHeure('0:00'), '00:00');
});

test('⚠️ `heureValide` EST CE QUE LISENT LES DEUX ÉCRANS', () => {
  // `canNext` de l assistant de publication et `canSend` du rendez-vous hors
  // hub s appuient dessus : c est ce qui remplace « longueur >= 4 ».
  assert.equal(heureValide('7h30'), true);
  assert.equal(heureValide('99:99'), false);
  assert.equal(heureValide(''), false);
});

test('⚠️ `minutesDepuisMinuit` REND `null`, JAMAIS `NaN`', () => {
  // 🔴 UN NaN NE REND AUCUNE COMPARAISON FAUSSE : `NaN < x` est faux et
  // `NaN > x` aussi, donc une borne calculee dessus s accepte toujours. C est
  // exactement ainsi qu une heure illisible traversait tout l ecran.
  assert.equal(minutesDepuisMinuit('7h30'), 450);
  assert.equal(minutesDepuisMinuit('00:00'), 0);
  assert.equal(minutesDepuisMinuit('23:59'), 1439);
  assert.equal(minutesDepuisMinuit('99:99'), null);
  assert.equal(minutesDepuisMinuit('nimportequoi'), null);
});

test('🔴 CE QUI EST ACCEPTÉ SE RELIT SANS JETER — LA PANNE D’ORIGINE', () => {
  // Le calcul exact de `DailyConfirmation`, sur tout ce que le champ accepte
  // desormais. C est l assertion qui compte : la validation ne sert que si elle
  // garantit que l aval ne peut plus tomber.
  for (const saisie of ['7h30', '07:30', '730', '0730', '7h', '00:00', '23:59']) {
    const hhmm = normaliserHeure(saisie)!;
    const [h, m] = hhmm.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    assert.doesNotThrow(
      () => d.toISOString(),
      `« ${saisie} » est accepte mais fait encore lever toISOString()`,
    );
  }
});
