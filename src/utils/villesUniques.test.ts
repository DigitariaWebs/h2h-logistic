// DEUX LISTES DE VILLES ÉCRITES À LA MAIN, POUR LE MÊME CONCEPT.
//
// 🔴 CE QUE L'ÉMULATEUR A MONTRÉ LE 02/09/2026. À l'inscription, « Ville
// principale » proposait sept villes : Nice, Cannes, Marseille, Toulon, Antibes,
// Fréjus, Monaco. À la publication d'un trajet, le corridor en proposait DIX —
// les mêmes plus Menton, Grasse et Saint-Raphaël.
//
// 🔴 CE N'EST PAS UN DÉTAIL D'AFFICHAGE. La ville principale sert à proposer des
// missions à un cotransporteur. Quelqu'un de Menton pouvait déclarer un trajet
// QUI PART de Menton, mais pas se déclarer habitant de Menton — donc le réseau
// le connaissait mal à l'endroit où ça compte.
//
// ⚠️ `constants/Cities.ts` EXISTAIT DÉJÀ, et `publish/cities.tsx` l'utilisait.
// Seul l'écran d'inscription gardait sa copie privée. Deux listes du même
// concept finissent toujours par diverger ; celle-ci l'avait déjà fait.
//
// ⚠️ CE QUE CE TEST NE DIT PAS. Il ne dit pas que dix villes suffisent — la
// couverture reste une décision produit, et la ville est ici une CHAÎNE, là où
// la place de marché porte un code INSEE (`commune_code`). Il dit seulement
// qu'il n'y en a plus qu'une seule à faire évoluer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CITIES } from '@/constants/Cities';

function sansCommentaires(...morceaux: string[]): string {
  return readFileSync(join(process.cwd(), ...morceaux), 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const ECRANS = [
  ['src', 'app', '(auth)', 'complete-profile.tsx'],
  ['src', 'app', 'publish', 'cities.tsx'],
];

test('🔴 AUCUN ÉCRAN NE REDÉFINIT SA PROPRE LISTE DE VILLES', () => {
  for (const ecran of ECRANS) {
    const code = sansCommentaires(...ecran);

    assert.doesNotMatch(
      code,
      /const CITIES\s*=\s*\[/,
      `${ecran.join('/')} redefinit CITIES : les deux listes vont diverger`,
    );
    assert.match(
      code,
      /import \{ CITIES \} from '@\/constants\/Cities'/,
      `${ecran.join('/')} n importe pas la liste partagee`,
    );
  }
});

test('⚠️ LA LISTE PARTAGÉE CONTIENT LES TROIS VILLES QUI MANQUAIENT', () => {
  // Menton, Grasse et Saint-Raphaël n'existaient que côté trajet.
  for (const ville of ['Menton', 'Grasse', 'Saint-Raphaël']) {
    assert.ok(
      (CITIES as readonly string[]).includes(ville),
      `${ville} a disparu de la liste partagee : l ecart d origine revient`,
    );
  }

  // Et pas de doublon — une liste écrite à la main en accumule vite.
  assert.equal(
    new Set(CITIES).size,
    CITIES.length,
    'la liste de villes contient un doublon',
  );
});
