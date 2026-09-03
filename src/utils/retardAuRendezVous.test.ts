// LES DEUX ALERTES « PERSONNE NE S'EST PRÉSENTÉ » NE POUVAIENT PAS S'AFFICHER.
//
// 🔴 `mission/group.tsx` les conditionnait à des statuts qu'une co-livraison
// n'atteint jamais :
//
//     const isPickupLate   = mission.status === 'pickup_pending'   && …
//     const isDeliveryLate = mission.status === 'delivery_pending' && …
//
// • `pickup_pending` n'est écrit par RIEN — ni la place de marché, ni cette
//   application, ni une routine serveur. La projection `app.statut_mission` ne
//   le produit que depuis l'état d'expédition du même nom, que le 03/09/2026 a
//   montré inatteignable : la récupération va de `seller_confirmed` droit à
//   `picked_up`.
//
// • `delivery_pending` vient de `out_for_delivery`, `redelivery_pending` ou
//   `return_pending`. La remise d'une co-livraison va de `in_transit` droit à
//   `delivered` (`mission/delivery.tsx` envoie `versEtat: 'delivered'`). Aucun
//   de ces trois états n'est traversé.
//
// 🔴 CE QUE ÇA COÛTE. Le vendeur ne vient pas au rendez-vous ; le cotransporteur
// attend, dépassé l'horaire et la tolérance — et l'écran ne lui dit rien. Le
// message existait pourtant, écrit pour lui : « Le vendeur ne s'est pas présenté
// — Pas d'inquiétude, aucune pénalité pour vous. » C'est exactement l'instant où
// quelqu'un se demande si l'on va lui reprocher l'attente.
//
// ⚠️ ET LE MÊME FICHIER SAIT DÉJÀ ÉCRIRE LA BONNE CONDITION. Partout ailleurs il
// apparie `group_created` et `pickup_pending` (`activeParty`, `reminderPhase`,
// la cible de navigation, le compte à rebours). Ces deux lignes-là sont les
// seules à ne nommer que le statut orphelin — un oubli, pas une intention.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { attenteDepassee, type EtatRendezVous } from './retardAuRendezVous';

const rdv = (statut: string, minutesDepuisLHeure: number): EtatRendezVous => ({
  statut,
  heurePrevue: new Date(Date.now() - minutesDepuisLHeure * 60_000).toISOString(),
  toleranceMinutes: 10,
});

test('🔴 LE VENDEUR EN RETARD EST SIGNALÉ — sur le statut que la mission a VRAIMENT', () => {
  // 🔴 `group_created` EST L'ÉTAT D'UNE CO-LIVRAISON QUI ATTEND SA RÉCUPÉRATION :
  // c'est ce que `statut_mission` produit depuis `seller_confirmed`. C'est là
  // que le cotransporteur patiente sur le trottoir.
  assert.equal(attenteDepassee(rdv('group_created', 15), 'pickup'), true);
});

test('🔴 ET LE STATUT ORPHELIN NE SUFFISAIT PAS — il n’arrive jamais', () => {
  // ⚠️ ON LE GARDE ACCEPTÉ. `pickup_pending` reste un statut légal du domaine ;
  // s'il devenait un jour écrit, l'alerte doit marcher aussi. Ce qui était faux,
  // c'est d'en faire la SEULE porte.
  assert.equal(attenteDepassee(rdv('pickup_pending', 15), 'pickup'), true);
});

test('🔴 LA REMISE EN RETARD AUSSI — depuis `in_transit`, pas `delivery_pending`', () => {
  // 🔴 UNE CO-LIVRAISON NE PASSE PAS PAR `out_for_delivery` : `mission/delivery`
  // envoie `delivered` depuis `in_transit`. Conditionner l'alerte à
  // `delivery_pending` la rendait inatteignable par le même mécanisme.
  assert.equal(attenteDepassee(rdv('in_transit', 15), 'delivery'), true);
  assert.equal(attenteDepassee(rdv('picked_up', 15), 'delivery'), true);
  assert.equal(attenteDepassee(rdv('delivery_pending', 15), 'delivery'), true);
});

test('⚠️ AVANT LA FIN DE LA TOLÉRANCE, ON NE SIGNALE PERSONNE', () => {
  // ⚠️ LA TOLÉRANCE EST LA MOITIÉ QUI PROTÈGE L'AUTRE PARTIE. Dire « le vendeur
  // ne s'est pas présenté » à l'heure pile accuserait quelqu'un qui arrive dans
  // les temps convenus.
  assert.equal(attenteDepassee(rdv('group_created', 5), 'pickup'), false);
  assert.equal(attenteDepassee(rdv('group_created', 10), 'pickup'), false, 'la limite exacte accuse deja');
  assert.equal(attenteDepassee(rdv('group_created', -30), 'pickup'), false, 'un rendez-vous a venir est « en retard »');
});

test('⚠️ ET ON NE MÉLANGE PAS LES DEUX RENDEZ-VOUS', () => {
  // Une mission qui attend sa récupération n'est pas en retard de REMISE.
  assert.equal(attenteDepassee(rdv('group_created', 60), 'delivery'), false);
  // Et un colis déjà en route n'est plus en retard de RÉCUPÉRATION.
  assert.equal(attenteDepassee(rdv('in_transit', 60), 'pickup'), false);
});

test('⚠️ UNE MISSION TERMINÉE N’EST EN RETARD DE RIEN', () => {
  for (const fini of ['delivered', 'completed', 'cancelled', 'expired']) {
    assert.equal(attenteDepassee(rdv(fini, 600), 'pickup'), false, fini);
    assert.equal(attenteDepassee(rdv(fini, 600), 'delivery'), false, fini);
  }
});

test('🔴 ET L’ÉCRAN SE SERT DE CETTE RÈGLE', () => {
  // ⚠️ TEST DE STRUCTURE, ET IL EST JUSTIFIÉ : la règle peut être juste et
  // l'écran garder sa condition morte. C'était exactement l'état d'avant.
  const src = readFileSync(join(process.cwd(), 'src', 'app', 'mission', 'group.tsx'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(/attenteDepassee/.test(code), 'l’écran ne calcule plus le retard avec la règle partagée');
  assert.ok(
    !/status === 'pickup_pending' &&/.test(code),
    'l’alerte de récupération est de nouveau conditionnée au seul statut orphelin',
  );
  assert.ok(
    !/status === 'delivery_pending' &&/.test(code),
    'l’alerte de remise est de nouveau conditionnée au seul statut inatteignable',
  );
});
