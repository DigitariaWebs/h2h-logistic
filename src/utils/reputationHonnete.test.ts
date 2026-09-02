// LE TABLEAU DE BORD ANNONÇAIT UNE ACTIVITÉ QUI N'EXISTAIT PAS.
//
// 🔴 CE QUE L'ÉMULATEUR A MONTRÉ LE 02/09/2026. Compte de Marc Dubois, créé une
// heure plus tôt, zéro mission, zéro trajet effectué. L'écran d'accueil
// affichait, sur la même ligne :
//
//     0,00 €
//     12 co-livraisons • 5.0 note moyenne
//
// Le montant était juste. Les deux autres chiffres étaient inventés.
//
// 🔴 LE NOMBRE VENAIT D'UN LITTÉRAL. `earningsDeliveries` valait `2` sur la
// journée, `5` sur la semaine, `12` sur le mois — écrits en dur, sans rapport
// avec quoi que ce soit. À côté, `getEarningsForPeriod` faisait déjà le vrai
// calcul sur le journal des participations, et personne ne l'appelait.
//
// 🔴 LA NOTE VENAIT D'UN DÉFAUT DE TYPE. `rating: precedent?.rating ?? 5.0`
// offrait un sans-faute à qui venait de s'inscrire. Et trois écrans repliaient
// différemment sur l'absence de note — `'4.9'` deux fois, `'4.8'` une fois,
// `'—'` une fois. Seul le dernier disait la vérité.
//
// ⚠️ POURQUOI CELUI-LÀ COMPTE PLUS QUE LES AUTRES CHIFFRES DE DÉMONSTRATION.
// Un acheteur choisit à qui confier un colis en regardant une note et un nombre
// de livraisons. Un compte neuf crédité de « 12 co-livraisons · 5.0 » n'est pas
// une donnée de remplissage : c'est une réputation fabriquée, montrée à
// quelqu'un qui s'apprête à décider avec.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function sansCommentaires(...morceaux: string[]): string {
  return readFileSync(join(process.cwd(), ...morceaux), 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

const ACCUEIL = ['src', 'app', '(tabs)', 'index.tsx'];
const PROFIL = ['src', 'app', '(tabs)', 'profile.tsx'];
const MAGASIN_AUTH = ['src', 'stores', 'useAuthStore.ts'];

test('🔴 LE NOMBRE DE CO-LIVRAISONS VIENT DU JOURNAL, PAS D’UN LITTÉRAL', () => {
  const code = sansCommentaires(...ACCUEIL);

  assert.match(
    code,
    /getEarningsForPeriod\(/,
    'le tableau de bord n appelle plus getEarningsForPeriod : les chiffres redeviennent decoratifs',
  );

  // 🔴 LA FORME EXACTE QUI MENTAIT. Un ternaire sur la période qui rend des
  // nombres écrits à la main.
  assert.doesNotMatch(
    code,
    /earningsPeriod === 'day' \? \d/,
    'un litteral est revenu dans les chiffres de participation',
  );
});

test('🔴 UNE NOTE ABSENTE N’EST PAS UNE NOTE PARFAITE', () => {
  const magasin = sansCommentaires(...MAGASIN_AUTH);

  // 🔴 ET LE STOCKAGE LOCAL N'EST PAS UNE SOURCE NON PLUS. Le premier correctif
  // écrivait `precedent?.rating ?? null` : il reprenait au stockage la note
  // inventée par la version précédente, donc « 5.0 » survivait au correctif.
  // Vérifié à l'émulateur — Marc l'affichait encore.
  assert.doesNotMatch(
    magasin,
    /rating:\s*precedent\?\.rating/,
    'la note est relue du stockage local : le 5,0 fabrique par l ancienne version revient a chaque demarrage',
  );

  assert.match(
    magasin,
    /rating:\s*null/,
    'le magasin ne pose plus null : la seule valeur honnete tant que courier_profiles n est pas lu',
  );
});

test('⚠️ AUCUN ÉCRAN N’INVENTE DE NOTE DE REPLI', () => {
  // Trois écrans repliaient sur `'4.9'`, `'4.9'` et `'4.8'`. Des valeurs
  // plausibles, donc invisibles — c'est ce qui les rendait durables.
  for (const ecran of [ACCUEIL, PROFIL]) {
    const code = sansCommentaires(...ecran);
    assert.doesNotMatch(
      code,
      /rating[^\n]*\?\?\s*'[0-9]/,
      `${ecran.join('/')} invente une note de repli`,
    );
  }
});
