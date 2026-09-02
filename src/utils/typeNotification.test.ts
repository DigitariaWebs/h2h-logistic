// UN TYPE DE NOTIFICATION INCONNU FAISAIT TOMBER L'ÉCRAN ENTIER.
//
// 🔴 CE QUE L'APPAREIL MONTRAIT LE 02/09/2026, connecté en
// `transporteur+clerk_test` : « Nouvelle co-livraison disponible — il y a 146j »
// sur un compte créé le matin même. Les trois surfaces de notification — le
// badge de l'en-tête, la carte « Notifications récentes » de l'accueil et
// l'écran complet — lisaient `mockNotifications`, une constante du bundle.
//
// 🔴 ET LES VRAIES EXISTAIENT DÉJÀ. `app.notifier()` écrit dans
// `public.notifications` à chaque étape d'une co-livraison, et ce même compte
// en avait QUATRE en base. Personne ne les lisait.
//
// 🔴 POURQUOI CE FICHIER TESTE UNE TRADUCTION ET PAS UNE REQUÊTE.
// `notification_type` porte VINGT-ET-UNE valeurs — les trois applications
// partagent une seule base — alors que `NotificationRow` n'en connaît que cinq
// et s'en sert pour choisir son icône (`iconMap[notif.type]`) et son animation
// (`NOTIF_ANIM[notif.type]`). Brancher la base sans traduire aurait donné
// `undefined` sur les deux : c'est EXACTEMENT la panne qui avait fait tomber
// l'écran de notifications de la place de marché le 22/08/2026.
//
// ⚠️ LE REPLI N'EST DONC PAS UNE PRÉCAUTION, C'EST LA CONDITION. Une
// application sœur ajoutera une valeur à l'enum sans toucher à celle-ci ; ce
// jour-là, la notification doit s'afficher avec une cloche générique, pas faire
// disparaître la liste.
import test from 'node:test';
import assert from 'node:assert/strict';
import { versTypeEcran } from './typeNotification';

/** Les cinq seuls types que `NotificationRow` sait dessiner. */
const CONNUS = ['mission_new', 'mission_update', 'earning', 'route', 'system'];

/** `notification_type` en base, relevé le 02/09/2026 — les vingt-et-une. */
const ENUM_BASE = [
  'message', 'order', 'proposition', 'delivery', 'boost', 'exchange',
  'mission_proposal', 'pickup', 'payout', 'dispute', 'system',
  'incoming_package', 'pickup_done', 'co_delivery', 'price_drop',
  'access_request', 'seat_freed', 'seat_reminder', 'vip_live',
  'correction_requested', 'purchase_access',
];

test('🔴 AUCUNE VALEUR DE LA BASE NE SORT DU VOCABULAIRE DE L’ÉCRAN', () => {
  // 🔴 C'EST L'ASSERTION QUI COMPTE. Un seul type non traduit rend
  // `iconMap[type]` indefini et fait tomber la liste — pas la ligne, la LISTE.
  for (const t of ENUM_BASE) {
    assert.ok(
      CONNUS.includes(versTypeEcran(t)),
      `« ${t} » sort du vocabulaire de l ecran : iconMap rendra undefined`,
    );
  }
});

test('🔴 UN TYPE INVENTÉ DEMAIN S’AFFICHE AU LIEU DE CASSER', () => {
  // Une application soeur ajoutera une valeur sans toucher a celle-ci.
  assert.equal(versTypeEcran('un_type_qui_n_existe_pas_encore'), 'system');
  assert.equal(versTypeEcran(''), 'system');
});

test('⚠️ UNE PROPOSITION DE CO-LIVRAISON RESTE LA LIGNE MISE EN AVANT', () => {
  // 🔴 L'ÉCRAN S'EN SERT POUR LE LISERÉ DORÉ (`isNewDelivery`). Si une
  // proposition cessait d'etre un « mission_new », la seule notification sur
  // laquelle le cotransporteur doit agir se fondrait dans les autres.
  assert.equal(versTypeEcran('mission_proposal'), 'mission_new');
});

test('⚠️ LA VIE DE LA MISSION ET L’ARGENT SE DISTINGUENT', () => {
  for (const t of ['co_delivery', 'pickup', 'pickup_done', 'incoming_package', 'delivery', 'order']) {
    assert.equal(versTypeEcran(t), 'mission_update', `« ${t} » n est plus une etape de mission`);
  }
  assert.equal(versTypeEcran('payout'), 'earning');
  // Ce qui ne concerne pas directement une course tombe sur la cloche.
  assert.equal(versTypeEcran('dispute'), 'system');
  assert.equal(versTypeEcran('message'), 'system');
});
