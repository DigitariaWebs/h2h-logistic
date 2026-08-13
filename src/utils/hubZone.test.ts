// La zone du hub — « êtes-vous vraiment au point de rendez-vous ? »
//
// 🔴 CE QU'ELLE COMMANDE : l'affichage du plan, le point qui montre la position
// du cotransporteur particulier, et la couleur qui lui dit s'il est arrivé. Une
// zone trop large valide une présence à deux rues de là ; trop étroite, elle
// refuse quelqu'un qui est devant la porte.
//
// ⚠️ ET ELLE EST EN MÈTRES, PAS EN KILOMÈTRES. `haversineDistance` rend des km ;
// `distanceToHubMeters` multiplie par 1 000. Un facteur oublié rendrait toute
// position « dans la zone » — sans erreur, sans écran cassé.

import test from 'node:test';
import assert from 'node:assert/strict';

import { distanceToHubMeters, isInHubZone } from '@/utils/hubZone';
import {
  DEFAULT_HUB_ZONE_DIAMETER_M,
  hubZoneDiameterM,
  hubZoneRadiusM,
} from '@/constants/hubZone';

// Gare de Nice-Ville, approximativement.
const HUB = { latitude: 43.7048, longitude: 7.2619 };
const METRE_EN_DEGRE_LAT = 1 / 111_320;

/** Une position décalée de `m` mètres vers le nord du point central. */
const auNord = (m: number) => ({
  latitude: HUB.latitude + m * METRE_EN_DEGRE_LAT,
  longitude: HUB.longitude,
});

// ── Le diamètre par défaut ─────────────────────────────────────────────────

test('la zone fait 60 m de diamètre, donc 30 m de rayon', () => {
  assert.equal(DEFAULT_HUB_ZONE_DIAMETER_M, 60);
  assert.equal(hubZoneDiameterM({}), 60);
  assert.equal(hubZoneRadiusM({}), 30);
});

test('⚠️ LE RAYON EST LA MOITIÉ DU DIAMÈTRE — jamais le diamètre lui-même', () => {
  // 🔴 La confusion la plus facile du module, et la plus silencieuse : elle
  // doublerait la zone. Un cotransporteur particulier à 55 m serait déclaré
  // présent, et le vendeur ne le verrait nulle part.
  assert.equal(hubZoneRadiusM({ zoneDiameterMeters: 100 }), 50);
  assert.equal(hubZoneRadiusM({ zoneDiameterMeters: 40 }), 20);
});

test('un hub peut porter SA zone — le défaut ne s’impose pas', () => {
  assert.equal(hubZoneDiameterM({ zoneDiameterMeters: 120 }), 120);
  assert.equal(hubZoneRadiusM({ zoneDiameterMeters: 120 }), 60);
});

// ── La distance ────────────────────────────────────────────────────────────

test('🔴 LA DISTANCE EST EN MÈTRES, PAS EN KILOMÈTRES', () => {
  // ⚠️ `haversineDistance` rend des km. Oublier le ×1000 rendrait toute
  // position « à 0,05 m » du hub — donc toujours dans la zone.
  const d = distanceToHubMeters(auNord(100).latitude, auNord(100).longitude, HUB);
  assert.ok(d > 90 && d < 110, `attendu ~100 m, reçu ${d}`);
});

test('sur le point central, la distance est nulle', () => {
  assert.ok(distanceToHubMeters(HUB.latitude, HUB.longitude, HUB) < 1);
});

test('la distance ne dépend pas du SENS du décalage', () => {
  const nord = distanceToHubMeters(auNord(50).latitude, auNord(50).longitude, HUB);
  const sud = distanceToHubMeters(auNord(-50).latitude, auNord(-50).longitude, HUB);
  assert.ok(Math.abs(nord - sud) < 1, 'nord et sud à 50 m donnent la même distance');
});

// ── Dedans / dehors ────────────────────────────────────────────────────────

test('à 10 m du point central, on est dans la zone', () => {
  const p = auNord(10);
  assert.equal(isInHubZone(p.latitude, p.longitude, HUB), true);
});

test('🔴 À 50 M, ON EST DEHORS — la zone fait 30 m de rayon, pas 60', () => {
  const p = auNord(50);
  assert.equal(isInHubZone(p.latitude, p.longitude, HUB), false);
});

test('un hub à grande zone accepte ce qu’un hub standard refuse', () => {
  // ⚠️ La même position, deux hubs : c'est la zone du hub qui décide, jamais
  // une constante lue ailleurs.
  const p = auNord(45);
  assert.equal(isInHubZone(p.latitude, p.longitude, HUB), false);
  assert.equal(
    isInHubZone(p.latitude, p.longitude, { ...HUB, zoneDiameterMeters: 120 }),
    true,
  );
});

test('⚠️ LA BORNE EST DEDANS : à 30 m pile, on est dans la zone', () => {
  // Une inégalité stricte refuserait la présence de quelqu'un pile au bord,
  // au mètre près, sans rien lui expliquer.
  const p = auNord(29.5);
  assert.equal(isInHubZone(p.latitude, p.longitude, HUB), true);
});
