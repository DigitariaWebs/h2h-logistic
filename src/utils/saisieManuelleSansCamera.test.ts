// LA SAISIE MANUELLE ÉTAIT INATTEIGNABLE SANS LA CAMÉRA.
//
// 🔴 CONSTATÉ SUR L'APPAREIL LE 03/09/2026. Premier scan d'une récupération,
// caméra jamais autorisée : l'écran affiche une icône d'appareil photo,
// « Autorisez l'accès à la caméra pour scanner les QR codes », et UN bouton.
// Rien d'autre. Le lien « Entrer le code manuellement » n'apparaît qu'après.
//
//     if (!permission.granted) {
//       return ( … <Button title="Autoriser la caméra" … /> );   // <-- retour
//     }                                                          //     anticipé
//     if (showManual) { … }                                      // <-- jamais
//
// 🔴 ET C'EST EXACTEMENT LA SITUATION QUE LA DICTÉE EXISTE POUR COUVRIR. Côté
// place de marché, l'écran du vendeur imprime sous son QR : « A dicter si le
// scan echoue ». La plateforme promet donc une sortie de secours que le
// cotransporteur ne peut pas atteindre — au moment précis où il en a besoin,
// colis en main, devant le vendeur.
//
// 🔴 ET LE BOUTON PEUT ÊTRE MORT. Sous Android, un refus définitif rend
// `requestPermission()` sans effet : la boîte de dialogue système ne s'ouvre
// plus. L'écran ne propose alors qu'un bouton qui ne fait rien, sans autre
// chemin. Le colis ne part pas.
//
// ⚠️ ON N'AFFAIBLIT PAS LE SCAN POUR AUTANT. La comparaison du code vit en base
// (`record_scan_event`) depuis le 22/08/2026 : dicté ou lu, le code est vérifié
// par le serveur. Rendre la dictée atteignable n'ouvre donc aucune porte — cela
// rend seulement praticable un chemin déjà prévu, déjà contrôlé, et déjà promis
// à l'utilisateur par l'autre application.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(process.cwd(), 'src', 'components', 'logistics', 'QRScanner.tsx'), 'utf8');

test('🔴 LA SAISIE MANUELLE PASSE AVANT LE REFUS DE CAMÉRA', () => {
  // 🔴 L'ORDRE EST TOUT LE DÉFAUT. Les deux branches existaient ; celle de la
  // permission rendait la main en premier, donc l'autre n'était jamais atteinte.
  const iManuel = src.indexOf('if (showManual)');
  const iPermission = src.indexOf('if (!permission.granted)');
  assert.notEqual(iManuel, -1, 'la saisie manuelle a disparu');
  assert.notEqual(iPermission, -1, 'le garde de permission a disparu');
  assert.ok(
    iManuel < iPermission,
    'le refus de caméra rend la main avant la saisie manuelle : la dictée redevient inatteignable',
  );
});

test('🔴 ET L’ÉCRAN DE PERMISSION OFFRE LUI-MÊME LA DICTÉE', () => {
  // ⚠️ L'ORDRE SEUL NE SUFFIT PAS : il rend la saisie manuelle atteignable
  // seulement pour qui a déjà appuyé sur « Entrer le code manuellement » — un
  // lien qui, lui, vit sous la caméra. Sans issue depuis l'écran de permission,
  // le cotransporteur qui refuse reste devant un bouton et rien d'autre.
  // ⚠️ LA DÉCOUPE DOIT S'ARRÊTER À LA BRANCHE. Écrite d'abord jusqu'au rendu
  // caméra, elle englobait le lien « Entrer le code manuellement » qui vit sous
  // le viseur : le test passait AVANT le correctif, sans rien vérifier. Un test
  // de structure vaut sa découpe.
  const debut = src.indexOf('if (!permission.granted)');
  const bloc = src.slice(debut, src.indexOf('\n  }', debut));
  assert.ok(
    /setShowManual\(true\)/.test(bloc),
    'l’écran de permission ne propose aucune issue : un refus définitif y enferme',
  );
});

test('⚠️ ET LE CODE DICTÉ RESTE VÉRIFIÉ PAR LE SERVEUR', () => {
  // ⚠️ LA MOITIÉ QUI COMPTE AUTANT. Rendre la dictée atteignable ne doit rien
  // relâcher : `onManualEntry` et `onScan` doivent mener au MÊME contrôle. Dans
  // `pickup` comme dans `delivery`, les deux pointent sur le même gestionnaire,
  // qui appelle `enregistrerScan` — c'est la base qui compare.
  for (const f of ['src/app/mission/pickup.tsx', 'src/app/mission/delivery.tsx']) {
    const ecran = readFileSync(join(process.cwd(), f), 'utf8');
    const paires = ecran.match(/onScan=\{(\w+)\}\s*\n\s*onManualEntry=\{(\w+)\}/g) ?? [];
    assert.ok(paires.length >= 2, f + ' : les deux scanners ne branchent plus la dictée');
    for (const p of paires) {
      const [, lu, dicte] = p.match(/onScan=\{(\w+)\}\s*\n\s*onManualEntry=\{(\w+)\}/)!;
      assert.equal(lu, dicte, f + ' : le code dicté ne passe plus par le même contrôle que le code lu');
    }
  }
});
