// Qui paie quoi, quand un rendez-vous échoue.
//
// 🔴 LE MODULE LE PLUS SENSIBLE DE L'APPLICATION. Il ne bouge aucun euro
// lui-même — il DIT ce qui va être prélevé et à qui. Une part inversée entre le
// cotransporteur particulier et la plateforme, un frais imputé à la mauvaise
// partie, et l'écran affiche un règlement parfaitement crédible qui désigne le
// mauvais responsable. Rien ne plante, personne ne le voit.
//
// ⚠️ ET LA PROTECTION ACHETEUR EST UNE PROMESSE : elle est écrite dans les
// conditions. Un cas où l'acheteur n'est ni remboursé ni explicitement
// débouté serait une promesse rompue.

import test from 'node:test';
import assert from 'node:assert/strict';

import { computeSettlement } from '@/utils/settlement';
import { DELAYS } from '@/constants/delaysRules';
import type { Settlement, SettlementParty } from '@/types/settlement';

const lignes = (s: Settlement | null) => s?.lines ?? [];
const pour = (s: Settlement | null, p: SettlementParty) =>
  lignes(s).filter((l) => l.party === p);
const total = (s: Settlement | null, p: SettlementParty) =>
  pour(s, p).reduce((n, l) => n + (l.amountEur ?? 0), 0);

// ── Vendeur absent (F7) ────────────────────────────────────────────────────

test('🔴 VENDEUR ABSENT : 4 € IMPUTÉS, RÉPARTIS 3 / 1', () => {
  // ⚠️ LA SOMME DOIT TOMBER JUSTE. Le frais imputé au vendeur se partage entre
  // le cotransporteur particulier (dédommagé de son déplacement) et la
  // plateforme. Si les deux parts ne recomposent pas le frais, quelqu'un
  // encaisse ou perd la différence sans que rien ne le signale.
  const s = computeSettlement('seller_absent');
  assert.ok(s);
  assert.equal(total(s, 'seller'), DELAYS.sellerAbsentFeeEur);
  assert.equal(total(s, 'transporter'), DELAYS.sellerAbsentSplit.transporter);
  assert.equal(total(s, 'platform'), DELAYS.sellerAbsentSplit.platform);
  assert.equal(
    DELAYS.sellerAbsentSplit.transporter + DELAYS.sellerAbsentSplit.platform,
    DELAYS.sellerAbsentFeeEur,
    'les deux parts recomposent EXACTEMENT le frais imputé',
  );
});

test('vendeur absent : le frais pèse sur LE VENDEUR, jamais sur l’acheteur', () => {
  // 🔴 L'inversion la plus coûteuse : facturer l'absence à celui qui l'a subie.
  const s = computeSettlement('seller_absent');
  assert.deepEqual(pour(s, 'seller').map((l) => l.kind), ['fee']);
  assert.deepEqual(pour(s, 'buyer').map((l) => l.kind), ['refund']);
});

// ── La protection acheteur ─────────────────────────────────────────────────

test('🔴 L’ACHETEUR EST REMBOURSÉ QUAND LA CO-LIVRAISON N’ABOUTIT PAS', () => {
  // ⚠️ C'est la promesse des conditions. Ces trois cas sont ceux où le colis
  // n'arrive pas : l'acheteur doit y être remboursé, sans exception.
  for (const cas of ['seller_absent', 'transporter_absent', 'collect_absent']) {
    const s = computeSettlement(cas);
    assert.ok(s, `${cas} doit produire un règlement`);
    assert.ok(
      pour(s, 'buyer').some((l) => l.kind === 'refund'),
      `${cas} : l'acheteur n'est pas remboursé`,
    );
  }
});

test('⚠️ SEULE L’ABSENCE DE L’ACHETEUR LUI REFUSE LE REMBOURSEMENT — et elle le dit', () => {
  // Le seul cas où il ne l'est pas est celui où c'est LUI qui n'est pas venu.
  // Et même là, la ligne annonce la voie de contestation : un refus muet
  // ressemblerait à un oubli.
  const s = computeSettlement('buyer_absent');
  const acheteur = pour(s, 'buyer');
  assert.deepEqual(acheteur.map((l) => l.kind), ['kept']);
  assert.match(acheteur[0].label, /contestation/i);
  assert.match(s!.note ?? '', /contester/i);
});

test('acheteur absent : le vendeur ET le cotransporteur sont payés', () => {
  // Ils se sont déplacés. Ne pas les payer ferait porter l'absence d'un tiers
  // à ceux qui ont tenu leur engagement.
  const s = computeSettlement('buyer_absent');
  assert.deepEqual(pour(s, 'seller').map((l) => l.kind), ['pay']);
  assert.deepEqual(pour(s, 'transporter').map((l) => l.kind), ['pay']);
});

// ── Les annulations (D7) ───────────────────────────────────────────────────

test('🔴 ANNULER À L’AVANCE NE COÛTE RIEN — annuler tard, si', () => {
  // ⚠️ LE CONTEXTE COMMANDE. Sans `late`, ces deux cas doivent être gratuits :
  // facturer une annulation faite la veille punirait un comportement correct.
  for (const cas of ['cancel_buyer', 'cancel_transporter']) {
    const tot = computeSettlement(cas);
    assert.ok(tot);
    assert.equal(
      lignes(tot).reduce((n, l) => n + (l.amountEur ?? 0), 0),
      0,
      `${cas} sans retard doit être gratuit`,
    );
    assert.ok(lignes(tot).every((l) => l.kind === 'kept'));
  }

  const tard = computeSettlement('cancel_transporter', { late: true });
  assert.equal(total(tard, 'transporter'), DELAYS.lateCancelFeeEur);
});

test('le vendeur annule toujours sans frais — même tard', () => {
  // ⚠️ Asymétrie VOULUE, pas un oubli : elle est écrite dans la règle D7.
  // Un test qui l'ignorerait laisserait quelqu'un « corriger » l'asymétrie.
  for (const ctx of [undefined, { late: true }]) {
    const s = computeSettlement('cancel_seller', ctx);
    assert.equal(lignes(s).reduce((n, l) => n + (l.amountEur ?? 0), 0), 0);
  }
});

// ── La forme des règlements ────────────────────────────────────────────────

test('un type inconnu ne rend RIEN — jamais un règlement par défaut', () => {
  // 🔴 Un règlement inventé pour un formulaire non prévu annoncerait des
  // mouvements d'argent que personne n'a décidés.
  assert.equal(computeSettlement('type_inconnu'), null);
  assert.equal(computeSettlement(''), null);
});

test('⚠️ AUCUN MONTANT N’EST ÉCRIT EN DUR — tous viennent de DELAYS', async () => {
  // Le module des délais est la source unique. Un « 4 » ou un « 2 » saisi ici
  // divergerait le jour où le barème change, et les conditions afficheraient
  // un montant que le règlement ne pratique plus.
  const fs = await import('node:fs/promises');
  const src = await fs.readFile('src/utils/settlement.ts', 'utf8');
  const code = src
    .split('\n')
    .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
    .join('\n');
  assert.ok(!/amountEur:\s*\d/.test(code), 'un montant est écrit en dur');
});

test('chaque ligne nomme SA partie et SON effet', () => {
  // Une ligne sans partie ou sans nature ne peut pas s'afficher correctement :
  // l'écran dirait « quelqu'un doit quelque chose ».
  const parties = ['buyer', 'seller', 'transporter', 'platform'];
  const natures = ['refund', 'pay', 'fee', 'kept', 'unpaid'];
  for (const cas of [
    'seller_absent',
    'transporter_absent',
    'buyer_absent',
    'collect_absent',
    'cancel_buyer',
    'cancel_transporter',
    'cancel_seller',
  ]) {
    const s = computeSettlement(cas, { late: true });
    assert.ok(s, `${cas} doit produire un règlement`);
    assert.ok(s!.title.trim().length > 0, `${cas} sans titre`);
    assert.ok(lignes(s).length > 0, `${cas} sans ligne`);
    for (const l of lignes(s)) {
      assert.ok(parties.includes(l.party), `${cas} : partie inconnue ${l.party}`);
      assert.ok(natures.includes(l.kind), `${cas} : nature inconnue ${l.kind}`);
      assert.ok(l.label.trim().length > 0, `${cas} : ligne sans libellé`);
    }
  }
});
