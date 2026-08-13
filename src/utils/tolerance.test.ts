// La fenêtre de tolérance — −10 / +10 min autour du rendez-vous.
//
// 🔴 CE QU'ELLE COMMANDE, ET POURQUOI ELLE MÉRITE DES TESTS. Trois choses en
// dépendent : quand la présence peut être déclarée, quand le signalement
// d'absence s'ouvre, et l'ensemble des règles de délais (`DELAYS.toleranceMinutes`
// lit `DEFAULT_TOLERANCE_MINUTES`). Une minute d'écart sur une borne, et un
// cotransporteur particulier ponctuel se voit refuser sa déclaration — ou un
// vendeur est déclaré absent alors qu'il lui restait du temps.
//
// ⚠️ PREMIER FICHIER DE TESTS DE CETTE APPLICATION (12/08/2026). Elle portait
// jusqu'ici des règles métier tenues par `tsc` et la relecture à l'écran seuls.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TOLERANCE_MINUTES,
  getToleranceWindow,
  isAfterTolerance,
  isWithinTolerance,
  formatToleranceLabel,
} from '@/utils/tolerance';

/** Un rendez-vous placé par rapport à MAINTENANT, en minutes. */
const rdvDans = (minutes: number): string =>
  new Date(Date.now() + minutes * 60_000).toISOString();

// ── Le socle ───────────────────────────────────────────────────────────────

test('la tolérance par défaut vaut 10 minutes', () => {
  // ⚠️ Ce nombre n'est pas décoratif : `DELAYS.toleranceMinutes` le lit, et la
  // règle D0 des délais l'énonce au cotransporteur particulier. Le changer ici
  // change ce qui est écrit dans les conditions.
  assert.equal(DEFAULT_TOLERANCE_MINUTES, 10);
  assert.equal(formatToleranceLabel(), '-10 / +10 min');
});

// ── Déclarer sa présence ───────────────────────────────────────────────────

test('la présence se déclare de −10 à +10 autour de l’heure', () => {
  assert.equal(isWithinTolerance(rdvDans(5)), true, '5 min avant');
  assert.equal(isWithinTolerance(rdvDans(0)), true, 'à l’heure');
  assert.equal(isWithinTolerance(rdvDans(-5)), true, '5 min après');
});

test('🔴 HORS FENÊTRE, ELLE NE SE DÉCLARE PAS — avant comme après', () => {
  // Trop tôt, une présence n'a pas de sens ; trop tard, ce n'est plus une
  // arrivée à l'heure mais un blocage, que le protocole d'absence traite.
  assert.equal(isWithinTolerance(rdvDans(30)), false, '30 min avant');
  assert.equal(isWithinTolerance(rdvDans(-30)), false, '30 min après');
});

test('⚠️ LES BORNES SONT DEDANS, pas dehors', () => {
  // Une inégalité stricte ici refuserait sa déclaration au cotransporteur
  // particulier arrivé pile à −10 — sans qu'aucun message ne dise pourquoi.
  assert.equal(isWithinTolerance(rdvDans(10)), true, '−10 min : dedans');
  assert.equal(isWithinTolerance(rdvDans(-10)), true, '+10 min : dedans');
});

// ── Ouvrir le signalement d'absence ────────────────────────────────────────

test('🔴 L’ABSENCE NE S’OUVRE QU’APRÈS LA TOLÉRANCE', () => {
  // Règle client du 12/08/2026. Pendant le créneau, l'autre partie a le droit
  // d'arriver : la déclarer absente à la 3ᵉ minute serait un signalement contre
  // quelqu'un qui n'est pas encore en retard.
  assert.equal(isAfterTolerance(rdvDans(30)), false, 'bien avant');
  assert.equal(isAfterTolerance(rdvDans(5)), false, 'juste avant');
  assert.equal(isAfterTolerance(rdvDans(0)), false, 'à l’heure');
  assert.equal(isAfterTolerance(rdvDans(-5)), false, 'dans la tolérance');
  assert.equal(isAfterTolerance(rdvDans(-30)), true, 'tolérance dépassée');
});

test('⚠️ `isAfterTolerance` N’EST PAS `!isWithinTolerance`', () => {
  // 🔴 LE PIÈGE. La négation est vraie AVANT le créneau comme après : s'en
  // servir pour ouvrir les signalements les rendrait disponibles la veille du
  // rendez-vous, quand personne n'est encore attendu nulle part.
  const veille = rdvDans(24 * 60);
  assert.equal(isWithinTolerance(veille), false);
  assert.equal(isAfterTolerance(veille), false, 'la veille n’est PAS « après »');
});

// ── La fenêtre affichée ────────────────────────────────────────────────────

test('la fenêtre encadre l’heure prévue, symétriquement', () => {
  const midi = new Date();
  midi.setHours(14, 30, 0, 0);
  const w = getToleranceWindow(midi.toISOString());
  assert.equal(w.start, '14:20');
  assert.equal(w.end, '14:40');
});

test('une tolérance sur mesure déplace LES DEUX bornes', () => {
  const midi = new Date();
  midi.setHours(9, 0, 0, 0);
  const w = getToleranceWindow(midi.toISOString(), 20);
  assert.equal(w.start, '08:40');
  assert.equal(w.end, '09:20');
});

test('la fenêtre franchit minuit sans se casser', () => {
  // ⚠️ Un hub ouvert 24 h/24 programme des rendez-vous à 00 h 05. Un calcul
  // naïf sur les minutes afficherait « -05:55 » ou « 24:15 ».
  const nuit = new Date();
  nuit.setHours(0, 5, 0, 0);
  const w = getToleranceWindow(nuit.toISOString());
  assert.equal(w.start, '23:55');
  assert.equal(w.end, '00:15');
});
