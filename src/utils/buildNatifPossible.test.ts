// L'APPLICATION NE POUVAIT PAS SE CONSTRUIRE EN NATIF.
//
// 🔴 CE QUE GRADLE A RENDU LE 02/09/2026, au premier `assembleDebug` de ce dépôt :
//
//     Execution failed for task ':app:mergeDebugJavaResource'.
//     > 2 files found with path 'META-INF/versions/9/OSGI-INF/MANIFEST.MF':
//         - com.squareup.okhttp3:logging-interceptor:5.4.0
//         - org.jspecify:jspecify:1.0.0
//
// Deux dépendances transitives apportent le même fichier de métadonnées OSGi, et
// l'empaqueteur Android refuse de trancher. Sept minutes de compilation pour
// s'arrêter à l'avant-dernière étape.
//
// ⚠️ LA PLACE DE MARCHÉ AVAIT DÉJÀ LE CORRECTIF, ET C'EST TOUT L'INTÉRÊT DE LE
// NOTER. Son `app.json` exclut ce chemin exact depuis longtemps ; celui-ci
// déclarait `expo-build-properties` avec le seul `minSdkVersion`. Le même
// obstacle, résolu d'un côté, intact de l'autre — parce que personne n'avait
// jamais construit cette application-ci en natif.
//
// 🔴 ET C'EST LA VRAIE LEÇON : « ça marche dans Expo Go » NE DIT RIEN du build.
// Expo Go embarque ses propres dépendances natives ; il ne fait jamais tourner
// `mergeDebugJavaResource` sur celles du projet. Une application peut vivre des
// mois en développement sans que personne découvre qu'elle ne s'empaquette pas.
//
// ⚠️ CE TEST LIT `app.json`, PAS LE DOSSIER `android/`. Ce dernier est
// gitignoré et régénéré par `expo prebuild` : y vérifier quoi que ce soit
// reviendrait à tester un artefact absent du dépôt. La source de vérité est la
// configuration qui le produit.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CHEMIN_EN_DOUBLE = 'META-INF/versions/9/OSGI-INF/MANIFEST.MF';

function appJson(): any {
  return JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8'));
}

/** Le bloc de configuration passé à `expo-build-properties`, s'il existe. */
function buildProperties(): any {
  const plugins: unknown[] = appJson().expo?.plugins ?? [];
  for (const p of plugins) {
    if (Array.isArray(p) && p[0] === 'expo-build-properties') return p[1];
  }
  return null;
}

test('🔴 LE CONFLIT D’EMPAQUETAGE QUI CASSAIT LE BUILD EST EXCLU', () => {
  const props = buildProperties();
  assert.ok(props, 'expo-build-properties n est plus configure : minSdkVersion part avec');

  const exclus: string[] = props.android?.packagingOptions?.exclude ?? [];
  assert.ok(
    exclus.includes(CHEMIN_EN_DOUBLE),
    `« ${CHEMIN_EN_DOUBLE} » n est plus exclu : mergeDebugJavaResource echouera de nouveau, ` +
      'apres sept minutes de compilation',
  );
});

test('⚠️ LE RESTE DE LA CONFIGURATION DE BUILD TIENT TOUJOURS', () => {
  const props = buildProperties();

  // `minSdkVersion` etait la seule chose que ce bloc portait avant ; l'ajout de
  // `packagingOptions` ne doit pas l'avoir chassee.
  assert.equal(
    props.android?.minSdkVersion,
    24,
    'minSdkVersion a disparu ou change : les appareils vises ne sont plus les memes',
  );
  assert.equal(
    props.ios?.deploymentTarget,
    '15.1',
    'la cible iOS a change',
  );
});
