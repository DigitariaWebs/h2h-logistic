// L'APPLICATION DÉMARRAIT SUR « PUBLIER UN TRAJET », SANS PASSER PAR LA CONNEXION.
//
// 🔴 CE QUE L'ÉMULATEUR A MONTRÉ LE 02/09/2026, AU PREMIER LANCEMENT. Expo Go,
// projet neuf, aucune session : l'écran d'accueil de l'application était
// « Publier un trajet — 1/8 — Type ». Pas d'onboarding, pas d'écran de
// connexion, pas de convention, pas d'attente de validation. Un inconnu
// arrivait directement dans le formulaire de publication d'un trajet.
//
// 🔴 LA CAUSE TENAIT À L'ORDRE DE DÉCLARATION. Le `Stack` racine ne déclarait
// que trois écrans — `publish`, `navigate`, `call` — et expo-router prend LE
// PREMIER écran déclaré comme route d'ancrage. `index` n'était pas déclaré du
// tout, donc `index.tsx` ne s'exécutait jamais.
//
// ⚠️ ET C'EST `index.tsx` QUI PORTE TOUTE LA CHAÎNE D'ACCÈS :
//
//     !isOnboarded          -> /(onboarding)
//     !isAuthenticated      -> /(auth)
//     !user.firstName       -> /(auth)/complete-profile
//     !user.convention      -> /(auth)/convention
//     !user.documentsVerified -> /(auth)/pending-validation
//     sinon                 -> /(tabs)
//
// Cinq portes, toutes contournées par une ligne manquante. C'est aussi
// `complete-profile` qui appelle `request_role('transporter')` : sans lui,
// aucune ligne `user_roles` n'existe, donc le support n'a rien à examiner.
//
// ⚠️ LA PLACE DE MARCHÉ NE SOUFFRE PAS DU DÉFAUT, et la comparaison a suffi à
// le trouver : son `Stack` racine déclare `<Stack.Screen name="index" />` en
// premier. C'était la seule différence entre les deux applications.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { readFileSync } from 'node:fs';

const RACINE = join(process.cwd(), 'src', 'app', '_layout.tsx');

function sansCommentaires(chemin: string): string {
  return readFileSync(chemin, 'utf8')
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

test('🔴 LE PREMIER ÉCRAN DÉCLARÉ EST « index », PAS « publish »', () => {
  const code = sansCommentaires(RACINE);

  const noms = [...code.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)].map((m) => m[1]);

  assert.ok(noms.length > 0, 'plus aucun Stack.Screen declare : l ancrage redevient implicite');

  assert.equal(
    noms[0],
    'index',
    `le premier ecran declare est « ${noms[0]} » : l application demarre la et saute onboarding, connexion, convention et validation`,
  );
});

test('⚠️ LA CHAÎNE D’ACCÈS EXISTE TOUJOURS DANS L’ÉCRAN D’ENTRÉE', () => {
  // Le correctif ne sert à rien si les portes disparaissent de `index.tsx`.
  const entree = sansCommentaires(join(process.cwd(), 'src', 'app', 'index.tsx'));

  for (const porte of [
    "'/\\(onboarding\\)'",
    "'/\\(auth\\)'",
    "'/\\(auth\\)/complete-profile'",
    "'/\\(auth\\)/convention'",
    "'/\\(auth\\)/pending-validation'",
    "'/\\(tabs\\)'",
  ]) {
    assert.match(
      entree,
      new RegExp(porte),
      `la destination ${porte} a disparu de l ecran d entree : une porte de moins avant les onglets`,
    );
  }
});
