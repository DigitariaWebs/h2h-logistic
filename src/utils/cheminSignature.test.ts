// AUCUN COTRANSPORTEUR NE POUVAIT TERMINER SON INSCRIPTION.
//
// 🔴 CE QUE L'ÉMULATEUR A MONTRÉ LE 02/09/2026. Dernière porte de l'inscription,
// convention lue jusqu'au bout, mention « lu et approuvé » recopiée, signature
// tracée, les quatre étapes au vert. « Accepter et finaliser » rendait :
//
//     [convention] signature non enregistree
//     Error: signature : Invalid key: <profil>/transporter/v1.0 — 2026-05-21.txt
//
// Rien en base : `convention_acceptances` restait vide, le drapeau `convention`
// du profil restait faux, et l'application renvoyait indéfiniment sur cet écran.
//
// 🔴 LA CAUSE EST DANS LE NOM DE FICHIER. `CONVENTION_TRANSPORTEUR_VERSION` vaut
// « v1.0 — 2026-05-21 » : un tiret CADRATIN (U+2014) et deux espaces. Supabase
// Storage refuse ces caractères dans une clé d'objet.
//
// ⚠️ ET `encodeURIComponent` DONNAIT L'ILLUSION DU CONTRAIRE. Le code en
// appelait un — il transformait la version en « v1.0%20%E2%80%94%20… », donc en
// une clé pleine de `%`, refusée elle aussi. Un correctif qui a l'air d'en être
// un est plus coûteux qu'une absence de correctif : on ne le relit pas.
//
// ⚠️ CE DÉFAUT A SURVÉCU PARCE QUE PERSONNE N'ATTEIGNAIT L'ÉCRAN. L'application
// démarrait sur « Publier un trajet » (4c161ed) : les cinq portes d'accès
// étaient contournées, donc la dernière n'a jamais été franchie une seule fois.
// Deux défauts qui se cachaient l'un l'autre.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CONVENTION_TRANSPORTEUR_VERSION } from '@/constants/ConventionTransporteur';

// La règle que Supabase Storage applique aux clés d'objet, réduite à ce qui
// nous concerne : pas d'espace, pas de caractère hors ASCII, pas de `%`.
const CLE_SURE = /^[\w.-]+$/;

/** La même transformation que `services/convention.ts`, rejouée ici. */
function versionPourChemin(version: string): string {
  return version
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

test('🔴 LA VERSION AFFICHÉE N’EST PAS UNE CLÉ DE STOCKAGE VALIDE', () => {
  // Ce test dit POURQUOI la transformation existe. Si un jour la version
  // devient « v2 » sans espace ni tiret cadratin, il tombera — et c'est le bon
  // moment pour se demander si la transformation sert encore.
  assert.doesNotMatch(
    CONVENTION_TRANSPORTEUR_VERSION,
    CLE_SURE,
    'la version est deja sure : verifier si versionPourChemin a encore une raison d etre',
  );
});

test('🔴 LE CHEMIN DE SIGNATURE EST UNE CLÉ ACCEPTABLE', () => {
  const segment = versionPourChemin(CONVENTION_TRANSPORTEUR_VERSION);

  assert.match(
    segment,
    CLE_SURE,
    `« ${segment} » n est pas une cle de stockage valide : Supabase refusera le televersement`,
  );

  // Et le nom reste lisible : on doit pouvoir relier un fichier à sa version.
  assert.match(segment, /v1\.0/, 'la version n est plus reconnaissable dans le nom de fichier');
  assert.match(segment, /2026-05-21/, 'la date a disparu du nom de fichier');
});

test('⚠️ LE CODE N’UTILISE PLUS `encodeURIComponent` POUR LA CLÉ', () => {
  // 🔴 C'ÉTAIT LE FAUX CORRECTIF. Il produisait `%20` et `%E2%80%94`, donc une
  // clé avec des `%` — refusée exactement comme l'originale, mais en donnant
  // l'impression que le sujet était traité.
  const code = readFileSync(
    join(process.cwd(), 'src', 'services', 'convention.ts'),
    'utf8',
  ).replace(/\/\*[\s\S]*?\*\//g, '');

  assert.doesNotMatch(
    code,
    /encodeURIComponent\s*\(\s*version\s*\)/,
    'le chemin repasse par encodeURIComponent : la cle redevient invalide',
  );

  assert.match(
    code,
    /versionPourChemin\s*\(\s*version\s*\)/,
    'le chemin ne passe plus par versionPourChemin',
  );
});

test('⚠️ LE PREMIER SEGMENT RESTE LE PROFIL — la policy en dépend', () => {
  // La policy de stockage compare `storage.foldername(name)[1]` au profil
  // courant. Changer l'ordre des segments ouvrirait le dossier d'un autre.
  const code = readFileSync(
    join(process.cwd(), 'src', 'services', 'convention.ts'),
    'utf8',
  );

  assert.match(
    code,
    /`\$\{input\.profilId\}\/transporter\//,
    'le profil n est plus le premier segment du chemin : la policy de stockage ne protege plus rien',
  );
});
