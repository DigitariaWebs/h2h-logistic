// LA « PARTICIPATION MOYENNE » D'UN TRAJET ÉTAIT ÉCRITE EN DUR.
//
// 🔴 `route/[id].tsx`, ligne 69, et le commentaire ne s'en cachait pas :
//
//     const avgEarnings = route.missionsCount > 0 ? 4.5 : 0; // mock average
//
// Deux valeurs possibles pour tous les trajets de tous les cotransporteurs :
// 4,50 € dès qu'une co-livraison existe, 0 € sinon. Le montant ne dépendait ni
// des missions du trajet, ni de leurs participations réelles — que la base
// connaît pourtant, mission par mission (`transporterEarning`).
//
// 🔴 ET LA TUILE D'À CÔTÉ EST VRAIE, ce qui est le pire arrangement. « 3
// Co-livraisons » lit `route.missionsCount` ; juste à droite, « 4,50 €
// Participation moyenne » est inventé. Rien ne distingue les deux à l'écran :
//
//     [ Co-livraisons : 3 ]   [ Participation moyenne : 4,50 € ]
//              vrai                        faux
//
// ⚠️ C'EST LA MÊME FAMILLE QUE LE « 96% TAUX RÉUSSITE » corrigé le 02/09/2026,
// et la règle qu'on y a posée vaut ici : une valeur qu'on ne mesure pas
// s'affiche « — », elle ne se remplace pas par un chiffre plausible.
//
// ⚠️ MAIS ICI C'EST DE L'ARGENT, ET ÇA CHANGE L'ENJEU. Un taux de réussite est
// une réputation ; une participation moyenne est ce qu'un cotransporteur croit
// avoir gagné sur ce trajet, et ce sur quoi il décide de le republier. Le vrai
// montant vaut 3,83 € sur la co-livraison menée de bout en bout le 03/09/2026 —
// pas 4,50 €.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { participationMoyenne, participationMoyenneLabel } from './participationMoyenne';

const m = (status: string, transporterEarning: number) => ({ status, transporterEarning });

test('🔴 LA MOYENNE VIENT DES PARTICIPATIONS RÉELLEMENT PERÇUES', () => {
  // 3,83 € et 4,79 € : deux participations réelles observées sur le projet.
  assert.equal(participationMoyenne([m('delivered', 3.83), m('completed', 4.79)]), 4.31);
});

test('🔴 SANS RIEN À MESURER, ON N’INVENTE PAS — MÊME PAS ZÉRO', () => {
  // 🔴 `null`, PAS `0`. Un trajet neuf n'a pas « une participation moyenne de
  // 0 € » — il n'en a pas encore. Afficher 0 € annoncerait au cotransporteur
  // que ce trajet ne rapporte rien, ce qui est une information, et elle est
  // fausse. L'écran montre « — », comme la tuile « Note moyenne » à côté.
  assert.equal(participationMoyenne([]), null);
  assert.equal(participationMoyenneLabel([]), '—');
});

test('🔴 UNE CO-LIVRAISON EN COURS N’EST PAS ENCORE UNE PARTICIPATION', () => {
  // 🔴 ELLE N'EST PAS PERÇUE. La participation se libère à la remise — vérifié
  // le 03/09/2026 : les écritures comptables naissent au scan de livraison, pas
  // à l'acceptation. La compter d'avance annoncerait un gain qui peut encore ne
  // jamais arriver (refus du colis, annulation, absence).
  assert.equal(
    participationMoyenne([m('accepted', 5), m('picked_up', 5), m('in_transit', 5)]),
    null,
    'des missions en cours comptent comme des gains percus',
  );
  // Et elles ne diluent pas non plus celles qui sont perçues.
  assert.equal(
    participationMoyenne([m('delivered', 4), m('accepted', 0), m('in_transit', 0)]),
    4,
    'les missions en cours entrent au denominateur et ecrasent la moyenne',
  );
});

test('⚠️ UNE ANNULATION NE COMPTE PAS NON PLUS', () => {
  // ⚠️ RIEN N'A ÉTÉ VERSÉ. Une co-livraison annulée au dénominateur ferait
  // baisser la moyenne d'un trajet dont les remises effectuées, elles, ont bien
  // payé le montant annoncé.
  assert.equal(participationMoyenne([m('delivered', 4), m('cancelled', 0)]), 4);
});

test('⚠️ LE LIBELLÉ EST UN MONTANT, PAS UN NOMBRE NU', () => {
  assert.match(participationMoyenneLabel([m('delivered', 3.83)]), /3[.,]83/);
});

test('🔴 ET L’ÉCRAN NE PORTE PLUS DE MOYENNE ÉCRITE EN DUR', () => {
  // ⚠️ TEST DE STRUCTURE, ET IL EST JUSTIFIÉ : la fonction peut être exacte et
  // l'écran continuer d'afficher son littéral. C'était exactement l'état d'avant.
  // ⚠️ ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER. La correction NOMME le
  // littéral qu'elle remplace — c'est le récit du défaut — et un test qui lirait
  // la prose se déclencherait sur sa propre explication.
  const src = readFileSync(join(process.cwd(), 'src', 'app', 'route', '[id].tsx'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(
    !/missionsCount\s*>\s*0\s*\?\s*4\.5/.test(code),
    'la moyenne inventee est revenue dans l ecran du trajet',
  );
  assert.ok(
    /participationMoyenneLabel/.test(src),
    'l ecran ne calcule plus la participation moyenne a partir des missions',
  );
});
