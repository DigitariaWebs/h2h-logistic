// « 96% DE RÉUSSITE » POUR QUELQU'UN QUI N'AVAIT JAMAIS RIEN LIVRÉ.
//
// 🔴 CE QUE L'APPAREIL A MONTRÉ LE 02/09/2026, build natif, connecté en
// `transporteur+clerk_test@handtohand.pro` (Marc Dubois, compte créé le jour
// même, zéro co-livraison, aucune mission) :
//
//     [ Co-livraisons : 0 ]  [ Taux réussite : 96% ]  [ Note moyenne : — ]
//               vrai                   faux                   vrai
//
// La valeur était un LITTÉRAL de chaîne dans `(tabs)/index.tsx` —
// `value="96%"` — sans calcul ni source. Et elle se tenait entre deux tuiles
// honnêtes : « Co-livraisons » lit le vrai compte, « Note moyenne » affiche
// « — » faute de note (corrigé le même jour, pour cette raison exacte).
//
// ⚠️ CE N'EST PAS UNE STATISTIQUE FLATTEUSE, C'EST UNE PROMESSE. Un taux de
// réussite est ce qu'un expéditeur regarde avant de confier un colis, et ce
// qu'un cotransporteur croit avoir gagné. Et le jour où la vraie valeur passe
// sous 96%, un littéral ne le dira jamais.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tauxReussite, tauxReussiteLabel } from './tauxReussite';

test('🔴 UN COMPTE NEUF N’AFFICHE AUCUN TAUX — NI 96%, NI 0%, NI 100%', () => {
  // Le cas exact vu sur l'appareil.
  assert.equal(tauxReussite([]), null);
  assert.equal(tauxReussiteLabel([]), '—');

  // 🔴 `0` ET `100` MENTIRAIENT AUSSI. Un compte neuf n'a echoue a rien, et n'a
  // rien reussi non plus : les deux chiffres affirment quelque chose de faux.
  assert.notEqual(tauxReussite([]), 0);
  assert.notEqual(tauxReussite([]), 100);
});

test('🔴 LE TAUX SUIT LES VRAIES MISSIONS', () => {
  assert.equal(tauxReussite([{ status: 'completed' }]), 100);
  assert.equal(tauxReussite([{ status: 'cancelled' }]), 0);
  assert.equal(
    tauxReussite([{ status: 'completed' }, { status: 'delivered' }, { status: 'cancelled' }]),
    67,
  );
  assert.equal(tauxReussiteLabel([{ status: 'completed' }, { status: 'cancelled' }]), '50%');
});

test('⚠️ UNE MISSION EN COURS NE COMPTE PAS COMME UN ÉCHEC', () => {
  // 🔴 SINON TRAVAILLER FERAIT BAISSER SON PROPRE TAUX. Une co-livraison
  // acceptee ce matin n'est pas ratee parce qu'elle n'est pas encore arrivee ;
  // la mettre au denominateur punirait chaque nouvelle mission acceptee.
  const enCours = [
    { status: 'accepted' },
    { status: 'in_transit' },
    { status: 'pickup_pending' },
    { status: 'proposal' },
  ];
  assert.equal(tauxReussite(enCours), null, 'des missions en cours produisent un taux');

  assert.equal(
    tauxReussite([{ status: 'completed' }, ...enCours]),
    100,
    'accepter des missions fait chuter le taux de reussite',
  );
});

test('⚠️ « delivered » COMPTE AUTANT QUE « completed »', () => {
  // Les deux sont dans `COMPLETED_STATUSES` cote application : un colis remis
  // est un colis remis, meme si la cloture administrative n'a pas suivi.
  assert.equal(tauxReussite([{ status: 'delivered' }, { status: 'cancelled' }]), 50);
});

test('⚠️ AUCUN LITTÉRAL NE SUBSISTE DANS L’ÉCRAN', () => {
  // 🔴 LE DÉFAUT ÉTAIT UNE CHAÎNE ÉCRITE À LA MAIN, pas une formule fausse —
  // aucun test sur le calcul ne l'aurait attrape. On verifie donc l'ecran.
  const code = readFileSync(join(process.cwd(), 'src', 'app', '(tabs)', 'index.tsx'), 'utf8');

  assert.doesNotMatch(
    code,
    /value="96%"/,
    'le taux de reussite est de nouveau ecrit en dur',
  );
  assert.match(
    code,
    /value=\{tauxReussiteLabel\(/,
    'la tuile « Taux reussite » ne lit plus les missions reelles',
  );
});
