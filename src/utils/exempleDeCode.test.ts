// L'EXEMPLE AFFICHÉ DANS LE CHAMP N'ÉTAIT LE FORMAT D'AUCUN CODE.
//
// 🔴 CONSTATÉ SUR L'APPAREIL LE 03/09/2026. Le vendeur dicte `SEL-FTW73U` ; le
// champ où le cotransporteur doit l'écrire affiche en exemple `HTH-XXXXX`.
// Mauvais préfixe, mauvaise longueur. Les trois modes du scanner portaient le
// même exemple — vendeur, acheteur et colis — alors que les trois codes ont des
// formes différentes :
//
//     vendeur   SEL-FTW73U      SEL- + 6
//     acheteur  BUY-2ESBS7      BUY- + 6
//     colis     HTHCD6E43E17B   HTH  + 10, sans tiret
//
// 🔴 ET AUCUN NE RESSEMBLAIT À `HTH-XXXXX`. Le format des expéditions est
// contraint en base (`tracking_number !~ '^HTH[0-9A-F]{10}$'`, migrations
// 20260822030000 et 20260822040000) : il n'a pas de tiret et compte dix
// caractères, pas cinq. L'exemple venait d'un commentaire périmé du schéma
// d'origine — `tracking_number text not null unique, -- 'HTH-58A2F'` — recopié
// tel quel dans l'écran.
//
// ⚠️ CE N'EST PAS DE LA COSMÉTIQUE À CET ENDROIT-LÀ. On n'arrive dans ce champ
// que parce que le scan a échoué : colis en main, devant le vendeur, en train de
// se faire épeler un code. Un exemple qui contredit ce qu'on entend fait douter
// de ce qu'on entend — et l'écran compte trois essais avant de se verrouiller.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(process.cwd(), 'src', 'components', 'logistics', 'QRScanner.tsx'), 'utf8');

/** Les exemples déclarés, dans l'ordre des modes du scanner. */
const exemples = [...src.matchAll(/manualPlaceholder:\s*'([^']+)'/g)].map((m) => m[1]);

test('🔴 CHAQUE MODE MONTRE LE FORMAT DE SON PROPRE CODE', () => {
  assert.equal(exemples.length, 3, 'les trois modes du scanner n’ont plus chacun leur exemple');
  const [vendeur, acheteur, colis] = exemples;
  // ⚠️ LES FORMES VIENNENT DU SERVEUR, PAS D'UNE PRÉFÉRENCE : `SEL-`/`BUY-` +
  // six caractères sont posés par `app.code_lisible(...)`, et `HTH` + dix est
  // contraint par les migrations du 22/08/2026.
  assert.match(vendeur, /^SEL-X{6}$/, `exemple vendeur faux : ${vendeur}`);
  assert.match(acheteur, /^BUY-X{6}$/, `exemple acheteur faux : ${acheteur}`);
  assert.match(colis, /^HTHX{10}$/, `exemple colis faux : ${colis}`);
});

test('🔴 ET LE VIEUX `HTH-XXXXX` N’EST PLUS NULLE PART', () => {
  // 🔴 IL ÉTAIT SUR LES TROIS. Corriger un seul mode laisserait deux champs
  // mentir, et c'est précisément parce qu'ils étaient identiques que personne ne
  // l'avait remarqué.
  for (const e of exemples) {
    assert.notEqual(e, 'HTH-XXXXX', 'l’exemple périmé est revenu dans un des modes');
  }
});

test('⚠️ UN EXEMPLE RESTE UN EXEMPLE — il ne se tape pas', () => {
  // ⚠️ ON MONTRE LA FORME, PAS UNE VALEUR. Un exemple qui ressemble à un vrai
  // code (`HTH0123456789`) invite à l'envoyer tel quel — et brûlerait un des
  // trois essais avant verrouillage. Les `X` disent « ici, des caractères ».
  for (const e of exemples) {
    assert.ok(/X/.test(e), `${e} ne se distingue pas d’un vrai code`);
    assert.ok(!/[0-9]/.test(e), `${e} contient des chiffres : on croirait un vrai code`);
  }
});
