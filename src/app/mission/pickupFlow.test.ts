// Le parcours de récupération — ce que chaque page montre, et dans quel ordre.
//
// 🔴 POURQUOI DES TESTS QUI LISENT DU JSX. Ces règles ne vivent dans aucun
// module pur : elles sont dans l'agencement des écrans. Elles se cassent donc
// en silence — l'application compile, s'affiche, et se comporte mal. Trois
// d'entre elles ont déjà été introduites ET corrigées le 12/08/2026 :
//   • un « Je suis au hub » en double, dont un seul déclarait vraiment ;
//   • des signalements d'absence ouverts pendant le créneau ;
//   • un bouton qui annonçait le scanner et ouvrait autre chose.
// Aucune n'aurait été rattrapée par `tsc`.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (chemin: string): string =>
  readFileSync(join(process.cwd(), chemin), 'utf8');

/** Le fichier SANS ses commentaires.
 *
 *  ⚠️ INDISPENSABLE ICI. Ces écrans expliquent en commentaire ce qu'ils ont
 *  RETIRÉ — « le bouton Valider ma présence au hub a été retiré d'ici ». Une
 *  recherche sur le fichier entier retrouverait donc la phrase dans la note qui
 *  justifie sa disparition, et le test tomberait pour la raison même qui prouve
 *  qu'il est satisfait. */
const codeSeul = (chemin: string): string =>
  lire(chemin)
    .split('\n')
    .filter((l) => {
      const t = l.trimStart();
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('/*') && !t.startsWith('{/*');
    })
    .join('\n');

const PICKUP = 'src/app/mission/pickup.tsx';
const DELIVERY = 'src/app/mission/delivery.tsx';
const TIMELINE = 'src/components/mission/MissionTimeline.tsx';
const BANDEAU = 'src/components/mission/DirectionHubButton.tsx';

// ── La page 1 est la déclaration de présence ───────────────────────────────

test('🔴 LE PARCOURS S’OUVRE SUR LA DÉCLARATION DE PRÉSENCE', () => {
  // Demande client du 12/08/2026 : l'écran ouvert par « ACTION SUIVANTE » est
  // celui que le vendeur et l'acheteur voient de leur côté, sur la marketplace.
  const src = lire(PICKUP);
  assert.ok(/'presence' \| 'approach'/.test(src), '« presence » précède « approach »');
  assert.ok(
    /useState<PickupStep>\(offHubPickup \? 'approach' : 'presence'\)/.test(src),
    'la première étape est la présence — sauf hors hub',
  );
});

test('⚠️ HORS HUB, LA PAGE 1 EST SAUTÉE — sinon elle est sans issue', () => {
  // Un rendez-vous hors hub n'a ni zone ni point central : la carte de présence
  // n'aurait rien à montrer, et son bouton rien à vérifier.
  const src = lire(PICKUP);
  assert.ok(/const offHubPickup = .*pickupHub\.isOffHub === true/.test(src));
});

test('🔴 UN SEUL « JE SUIS AU HUB » — le bouton a QUITTÉ la page 2', () => {
  // ⚠️ Le doublon corrigé le 12/08 : deux boutons du même nom, dont un seul
  // enregistrait l'arrivée. Le second ne faisait qu'avancer d'étape.
  const src = codeSeul(PICKUP);
  const page2 = src.slice(src.indexOf("if (step === 'approach')"));
  assert.ok(
    !/Valider ma présence au hub/.test(page2),
    'la page 2 ne porte plus de bouton de présence',
  );
  // Et la déclaration fait AVANCER : sans cela, la page 1 serait sans sortie.
  assert.ok(/setPresenceValidated\(true\);[\s\S]{0,200}setStep\('approach'\)/.test(src));
});

// ── Les signalements d'absence ─────────────────────────────────────────────

test('🔴 ABSENCE ET BLOCAGE N’OUVRENT QU’APRÈS LA TOLÉRANCE', () => {
  // Règle client du 12/08/2026. Pendant le créneau, l'autre partie a le droit
  // d'arriver.
  for (const chemin of [PICKUP, DELIVERY]) {
    const src = lire(chemin);
    assert.ok(
      /const absenceUnlocked = isAfterTolerance\(/.test(src),
      `${chemin} : la condition d'ouverture manque`,
    );
    assert.ok(
      /\{absenceUnlocked && \(|\{absenceUnlocked \? \(/.test(src),
      `${chemin} : les liens ne sont pas conditionnés`,
    );
  }
});

test('⚠️ « REFUSER LE COLIS » RESTE OUVERT PENDANT LE CRÉNEAU', () => {
  // 🔴 Il ne parle pas d'un retard mais de ce qu'on a sous les yeux : un colis
  // non conforme l'est dès la première seconde. Le fermer avec les autres
  // bloquerait un refus légitime.
  const src = lire(PICKUP);
  const bloc = src.slice(
    src.indexOf("<View style={s.incidentLinks}>"),
    src.indexOf('</ScrollView>', src.indexOf('<View style={s.incidentLinks}>')),
  );
  const refus = bloc.indexOf("openIncident('refuse_package')");
  assert.ok(refus > 0, 'le refus de colis est présent');
  // Il n'est PAS dans une branche conditionnée par `absenceUnlocked` : on
  // vérifie qu'aucune garde ne s'ouvre entre le début du bloc et lui sans se
  // refermer avant.
  const avant = bloc.slice(0, refus);
  const ouvertes = (avant.match(/\{absenceUnlocked && \(/g) ?? []).length;
  const fermees = (avant.match(/\)\}/g) ?? []).length;
  assert.ok(ouvertes <= fermees, 'le refus de colis n’est pas sous la garde d’absence');
});

test('🔴 UN BATTEMENT FAIT VIVRE LA RÈGLE', () => {
  // ⚠️ SANS LUI, LA RÈGLE SERAIT JUSTE ET INUTILE. La page se calcule au
  // montage : le cotransporteur particulier qui ATTEND — c'est-à-dire celui à
  // qui la règle s'adresse — ne verrait jamais les liens apparaître. Il lui
  // faudrait quitter l'écran et y revenir.
  for (const chemin of [PICKUP, DELIVERY]) {
    const src = lire(chemin);
    assert.ok(
      /setInterval\(\(\) => setTick\(/.test(src),
      `${chemin} : aucun réveil, la règle resterait figée`,
    );
    assert.ok(/clearInterval\(id\)/.test(src), `${chemin} : minuterie non nettoyée`);
  }
});

// ── Les boutons disent ce qu'ils ouvrent ───────────────────────────────────

test('🔴 LES DEUX ENTRÉES VERS UNE PHASE SE LISENT PAREIL', () => {
  // ⚠️ Corrigé le 12/08 : la timeline disait « Scanner le QR du vendeur » et
  // « Entrer le code acheteur » — deux étapes qu'elle ne montre pas —, et le
  // bandeau disait « Remise » là où il disait « Valider la récupération ».
  // Trois formulations pour deux destinations.
  const timeline = lire(TIMELINE);
  const bandeau = lire(BANDEAU);

  for (const libelle of ['Valider la récupération', 'Valider la remise']) {
    assert.ok(timeline.includes(libelle), `timeline : « ${libelle} » manquant`);
    assert.ok(bandeau.includes(libelle), `bandeau : « ${libelle} » manquant`);
  }

  // Et les anciens libellés ont disparu — ils annonçaient le scanner.
  assert.ok(!/Scanner le QR du vendeur'/.test(timeline));
  assert.ok(!/Entrer le code acheteur/.test(timeline));
});
