// LE CODE DU SCAN PRÉCÉDENT RESTAIT PRÉ-REMPLI DANS LE SUIVANT.
//
// 🔴 CONSTATÉ SUR L'APPAREIL LE 03/09/2026, co-livraison HTHCD6E43E17B. Étape
// 1/2 de la récupération : je dicte le code vendeur `SEL-FTW73U`, il passe,
// « marchand_lyon identifié ✓ ». L'écran passe à l'étape 2/2, « Numéro de
// colis » — et le champ contient déjà `SEL-FTW73U`. Vérifié aussi à la remise,
// où `BUY-2ESBS7` se retrouvait dans le champ du colis.
//
// 🔴 ET UN SEUL APPUI SUFFIT À LE FAIRE PARTIR. Le bouton « Valider » est actif,
// puisque le champ n'est pas vide. Le serveur rend `package_mismatch` — il fait
// son travail — mais l'écran, lui, COMPTE :
//
//     const next = packageAttempts + 1;
//     if (next >= MAX_PACKAGE_ATTEMPTS) { setLocked(true); … }
//
// Trois essais, et l'écran se verrouille sur « contactez le support ». La valeur
// laissée là par l'étape précédente peut donc consommer les tentatives d'un
// cotransporteur qui a le colis en main, devant le vendeur.
//
// 🔴 POURQUOI ELLE SURVIT. `pickup.tsx` rend deux `<QRScanner>` dans deux
// branches de retour différentes, à la même position de l'arbre. React réconcilie
// par type et par position : c'est LA MÊME INSTANCE qui sert les deux étapes, et
// son état interne (`manualCode`) traverse le changement d'étape. Rien dans
// l'écran ne le remet à zéro : `resetScanner()` n'est appelé que sur un ÉCHEC.
//
// ⚠️ ON EFFACE LE CODE, PAS LE MODE DE SAISIE. Remonter le composant avec une
// `key` par étape effacerait aussi `showManual` — et renverrait vers la caméra
// quelqu'un qui vient précisément de dicter parce que la sienne ne lit rien
// (écran fissuré, plein soleil, code abîmé). Ce serait réparer une gêne en
// créant une impasse. Un code appartient à UN scan ; le mode de saisie
// appartient à la personne.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const SCANNER = 'src/components/logistics/QRScanner.tsx';

test('🔴 CHANGER D’ÉTAPE EFFACE LE CODE SAISI', () => {
  const src = lire(SCANNER);
  // ⚠️ TEST DE STRUCTURE, ET IL EST JUSTIFIÉ : le défaut ne vit pas dans une
  // fonction qu'on pourrait appeler, mais dans la PERSISTANCE d'un état React
  // entre deux rendus. Le reproduire demanderait un rendu complet ; la règle,
  // elle, tient en une dépendance d'effet.
  const effets = src.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];
  const surMode = effets.filter((e) => /\}, \[[^\]]*\bmode\b[^\]]*\]\);$/.test(e));
  assert.ok(
    surMode.length > 0,
    'aucun effet ne réagit au changement de `mode` : le code du scan précédent reste',
  );
  assert.ok(
    surMode.some((e) => /setManualCode\(''\)/.test(e)),
    'le changement d’étape n’efface plus le code saisi',
  );
});

test('⚠️ MAIS IL NE RENVOIE PAS À LA CAMÉRA CELUI QUI DICTE', () => {
  // ⚠️ LA MOITIÉ QUI COMPTE AUTANT. On dicte parce que le lecteur échoue ;
  // refermer la saisie manuelle à chaque étape ramènerait à l'outil qui ne
  // marche pas, une fois le colis déjà en main.
  const src = lire(SCANNER);
  const effets = src.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];
  const surMode = effets.filter((e) => /\}, \[[^\]]*\bmode\b[^\]]*\]\);$/.test(e));
  for (const e of surMode) {
    assert.ok(
      !/setShowManual\(false\)/.test(e),
      'le changement d’étape referme la saisie manuelle : celui qui dicte est renvoyé à la caméra',
    );
  }
});

test('⚠️ ET LE SCAN CAMÉRA REDEVIENT POSSIBLE À CHAQUE ÉTAPE', () => {
  // `scanned` bloque la lecture après un code lu, pour ne pas en envoyer dix.
  // S'il traversait le changement d'étape, la caméra de l'étape 2 serait morte.
  const src = lire(SCANNER);
  const effets = src.match(/useEffect\([\s\S]*?\}, \[[^\]]*\]\);/g) ?? [];
  const surMode = effets.filter((e) => /\}, \[[^\]]*\bmode\b[^\]]*\]\);$/.test(e));
  assert.ok(
    surMode.some((e) => /setScanned\(false\)/.test(e)),
    'la caméra reste bloquée à l’étape suivante',
  );
});

test('🔴 LES DEUX ÉCRANS COMPTENT LEURS ESSAIS — c’est ce qui rend le report couteux', () => {
  // ⚠️ ON NOMME LE COÛT PLUTÔT QUE DE LE SUPPOSER. Si ces écrans cessaient de
  // verrouiller, le report ne serait qu'une gêne ; tant qu'ils verrouillent, une
  // valeur héritée peut bloquer une remise sur le trottoir.
  for (const f of ['src/app/mission/pickup.tsx', 'src/app/mission/delivery.tsx']) {
    const src = lire(f);
    assert.ok(/MAX_PACKAGE_ATTEMPTS/.test(src), f + ' ne limite plus les essais');
    assert.ok(/setLocked\(true\)/.test(src), f + ' ne verrouille plus');
  }
});
