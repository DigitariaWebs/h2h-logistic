// « 6,8 kg CO₂ ÉVITÉS » POUR QUELQU'UN QUI N'AVAIT RIEN TRANSPORTÉ.
//
// 🔴 CE QUE L'APPAREIL A MONTRÉ LE 02/09/2026, build natif, connecté en
// `transporteur+clerk_test` (Marc Dubois, compte créé le matin même, ZÉRO
// co-livraison) : « Impact écologique — Ce mois : 6,8 kg CO₂ évités / Depuis le
// début : 25 kg / ≈ 12 mois de CO₂ absorbé par un arbre ».
//
// Les chiffres venaient d'un `MOCK_SEED` du magasin — 24,7 kg, 6,8 kg, 47
// co-livraisons — chargé au montage de l'accueil et de l'écran des
// participations par `loadMockData()`.
//
// ⚠️ CE N'EST PAS UN COMPTEUR FLATTEUR, C'EST UNE ALLÉGATION ENVIRONNEMENTALE.
// Un chiffre de CO₂ évité affiché à quelqu'un qui n'a rien transporté n'est pas
// une donnée de démonstration comme une autre.
//
// 🔴 ET TOUT EXISTAIT POUR LE CALCULER VRAIMENT : `utils/carbon.ts` porte un
// modèle documenté (250 g/km pour une tournée dédiée en fourgon, moins les
// grammes réels du mode emprunté). Seule la graine était inventée.
import test from 'node:test';
import assert from 'node:assert/strict';
import { impactCo2 } from './impactEcologique';
import { calculateCo2Saved } from './carbon';

const NICE_ANTIBES = 22; // table de `carbon.ts`
const trajets = [{ id: 'r-voiture', transportType: 'car' }];

const mission = (quand: string, route = 'r-voiture') => ({
  routeId: route,
  updatedAt: quand,
  pickupHub: { city: 'Antibes' },
  deliveryHub: { city: 'Nice' },
});

test('🔴 SANS CO-LIVRAISON, L’IMPACT EST NUL — PAS 6,8 KG', () => {
  // Le cas exact vu sur l'appareil.
  const i = impactCo2([], trajets);
  assert.equal(i.total, 0);
  assert.equal(i.ceMois, 0);
  assert.equal(i.moisDernier, 0);
  assert.equal(i.livraisons, 0);
  assert.deepEqual(i.parMois, []);
});

test('🔴 UNE CO-LIVRAISON RÉELLE COMPTE POUR CE QU’ELLE VAUT', () => {
  // ⚠️ ON N'INVENTE PAS DE FACTEUR : la valeur attendue est celle que rend le
  // modele deja documente dans `carbon.ts`, pas un nombre choisi ici.
  const attendu = calculateCo2Saved(NICE_ANTIBES, 'car');
  const maintenant = new Date('2026-09-02T12:00:00Z');
  const i = impactCo2([mission('2026-09-02T10:00:00Z')], trajets, maintenant);

  assert.equal(i.total, attendu);
  assert.equal(i.ceMois, attendu, 'une co-livraison de ce mois ne compte pas dans le mois');
  assert.equal(i.livraisons, 1);
});

test('⚠️ LES MOIS SE SÉPARENT — L’ANNEAU DE PROGRESSION EN DÉPEND', () => {
  const un = calculateCo2Saved(NICE_ANTIBES, 'car');
  const maintenant = new Date('2026-09-02T12:00:00Z');
  const i = impactCo2(
    [mission('2026-09-01T10:00:00Z'), mission('2026-08-15T10:00:00Z'), mission('2026-07-01T10:00:00Z')],
    trajets,
    maintenant,
  );

  assert.equal(i.ceMois, un);
  assert.equal(i.moisDernier, un, 'le mois precedent est mal decoupe : l anneau compare n importe quoi');
  assert.equal(i.total, Math.round(un * 3 * 100) / 100);
  assert.equal(i.livraisons, 3);
});

test('⚠️ LE GRAPHIQUE REÇOIT DES MOIS ORDONNÉS ET ÉTIQUETABLES', () => {
  // 🔴 L'ÉCRAN DE DÉTAIL DÉCOUPE LA CLEF SUR « - » pour retrouver son libelle
  // (`MONTH_LABELS_FR['09']`). Un mois non comble — « 2026-9 » — rendrait
  // `undefined` et afficherait le chiffre brut a la place du nom.
  const maintenant = new Date('2026-09-02T12:00:00Z');
  const i = impactCo2(
    [mission('2026-09-01T10:00:00Z'), mission('2026-07-01T10:00:00Z')],
    trajets,
    maintenant,
  );

  assert.deepEqual(i.parMois.map((m) => m.month), ['2026-07', '2026-09']);
  for (const m of i.parMois) {
    assert.match(m.month, /^\d{4}-\d{2}$/, 'la clef de mois n est plus decoupable par l ecran');
  }
});

test('🔴 UNE MISSION SANS VILLES N’INVENTE PAS DE KILOMÈTRES', () => {
  // 🔴 `estimateDistanceKm` RETOMBE SUR 25 KM par defaut. Sur des villes vides,
  // cela fabriquerait de l impact a partir de rien — exactement ce qu on corrige.
  const i = impactCo2(
    [{ routeId: 'r-voiture', updatedAt: '2026-09-01T10:00:00Z', pickupHub: { city: '' }, deliveryHub: { city: 'Nice' } }],
    trajets,
  );
  assert.equal(i.total, 0);
  assert.equal(i.livraisons, 0, 'une mission sans villes est comptee comme une co-livraison');
});

test('⚠️ UN MODE NON POLLUANT NE CRÉE PAS D’IMPACT NÉGATIF', () => {
  // Le velo evite tout le fourgon ; l utilitaire en evite moins. Aucun des deux
  // ne doit rendre un nombre negatif.
  const velo = impactCo2([mission('2026-09-01T10:00:00Z', 'r-velo')], [{ id: 'r-velo', transportType: 'bike' }]);
  const utilitaire = impactCo2([mission('2026-09-01T10:00:00Z', 'r-u')], [{ id: 'r-u', transportType: 'utilitaire' }]);
  assert.ok(velo.total > utilitaire.total, 'le velo n evite pas plus qu un utilitaire');
  assert.ok(utilitaire.total >= 0);
});

test('⚠️ UN TRAJET SUPPRIMÉ RETOMBE SUR LA VOITURE, PAS SUR ZÉRO', () => {
  // Le mode vient du trajet ; si celui-ci n existe plus, on prend le mode le
  // plus courant plutot que d effacer la co-livraison.
  const i = impactCo2([mission('2026-09-01T10:00:00Z', 'trajet-disparu')], trajets);
  assert.equal(i.total, calculateCo2Saved(NICE_ANTIBES, 'car'));
  assert.equal(i.livraisons, 1);
});
