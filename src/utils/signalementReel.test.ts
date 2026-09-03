// SIGNALER QUELQU'UN NE FAISAIT RIEN.
//
// 🔴 `services/mock/userReports.ts` :
//
//     export async function submitUserReport(payload) {
//       await new Promise((r) => setTimeout(r, 1000));
//       return { id: `ureport-${Date.now()}`, createdAt: … };
//     }
//
// Une seconde d'attente, un identifiant fabriqué, et rien d'envoyé. Le signalant
// voyait « Signalement envoyé. » et une référence qui n'existe nulle part.
//
// 🔴 CE QUI ÉTAIT SIGNALÉ. Les motifs proposés sont « Danger, menace ou
// comportement agressif », « Fraude », « Rendez-vous suspect ». Ce sont les
// signalements d'une application où les gens se rencontrent physiquement, et
// aucun ne quittait le téléphone.
//
// 🔴 ET LA PLATEFORME SAVAIT LES RECEVOIR. `signaler_utilisateur` écrit dans
// `user_reports` et sert la place de marché depuis des mois. Seule cette
// application-ci ne l'appelait pas.
//
// ⚠️ LE SUCCÈS ÉTAIT ANNONCÉ SANS CONDITION, ce qui allait de soi tant que
// l'envoi ne pouvait pas échouer. Maintenant qu'il part vraiment, l'annoncer
// quand même serait le même défaut sous une autre forme.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { motifDeBase, estPrioritaire } from './motifSignalement';

const lire = (p: string) => readFileSync(join(process.cwd(), ...p.split('/')), 'utf8');
const codeSeul = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

// ── LA TRADUCTION DES MOTIFS ────────────────────────────────────────────────

test('🔴 UN DANGER RESTE UN DANGER UNE FOIS TRADUIT', () => {
  // 🔴 LA TRADUCTION NE DOIT RIEN ADOUCIR. Les deux vocabulaires ne se
  // recouvrent pas — six motifs d'écran, onze en base — et un dossier traité
  // doit garder la gravité qu'on lui a donnée.
  assert.equal(motifDeBase('danger'), 'aggressive');
  assert.equal(motifDeBase('fraud'), 'fraud');
  assert.equal(motifDeBase('suspicious_meeting'), 'suspicious_meeting');
  assert.equal(motifDeBase('disrespect'), 'harassment');
});

test('⚠️ CE QUI N’A PAS D’ÉQUIVALENT TOMBE SUR `other`, PAS SUR UN MOTIF PLUS LÉGER', () => {
  // ⚠️ `package_problem` N'EXISTE PAS EN BASE, et c'est cohérent : elle décrit
  // des comportements, pas des colis. Le rabattre sur `inappropriate` ferait
  // passer un colis abîmé pour une inconduite.
  assert.equal(motifDeBase('package_problem'), 'other');
  assert.equal(motifDeBase('other'), 'other');
});

test('⚠️ UN MOTIF INCONNU NE FAIT PAS PERDRE LE SIGNALEMENT', () => {
  // ⚠️ LE SIGNALANT A FAIT SON GESTE. Refuser l'envoi parce qu'un libellé a
  // changé, c'est perdre exactement ce qu'on vient de rendre possible.
  assert.equal(motifDeBase('motif_invente'), 'other');
  assert.equal(motifDeBase(''), 'other');
});

test('🔴 LA PRIORITÉ SE LIT SUR LE MOTIF D’ÉCRAN, PAS SUR LE MOTIF TRADUIT', () => {
  // 🔴 `danger` ET `package_problem` NE DOIVENT PAS SE CONFONDRE. Le second
  // devient `other` en base ; déduire la priorité après traduction ferait
  // passer une menace pour un colis abîmé — et l'inverse.
  assert.equal(estPrioritaire('danger'), true);
  assert.equal(estPrioritaire('fraud'), true);
  assert.equal(estPrioritaire('suspicious_meeting'), true);
  assert.equal(estPrioritaire('package_problem'), false);
  assert.equal(estPrioritaire('other'), false);
});

// ── ET LE SIGNALEMENT PART VRAIMENT ─────────────────────────────────────────

test('🔴 LE MAGASIN N’UTILISE PLUS L’ENVOI SIMULÉ', () => {
  const store = codeSeul(lire('src/stores/useUserReportsStore.ts'));
  assert.ok(
    !/submitUserReport/.test(store),
    'le magasin rappelle l’envoi simulé : le signalement ne part pas',
  );
  assert.ok(
    /signalerUtilisateur\(/.test(store),
    'le magasin n’envoie plus le signalement à la base',
  );
});

test('🔴 ET L’ÉCRAN NE FÉLICITE PLUS AVANT DE SAVOIR', () => {
  // 🔴 « Signalement envoyé. » ÉTAIT AFFICHÉ SANS CONDITION. Tant que l'envoi
  // était simulé, il ne pouvait pas échouer ; maintenant qu'il part, un refus
  // doit se voir.
  const src = codeSeul(lire('src/app/report/user.tsx'));
  const bloc = src.slice(src.indexOf('const handleSubmit'));
  const iCatch = bloc.indexOf('catch');
  const iSucces = bloc.indexOf('successToast');
  assert.notEqual(iCatch, -1, 'un envoi refusé passe en silence');
  assert.ok(iCatch < iSucces, 'le succès est annoncé hors du chemin qui peut échouer');
  assert.ok(
    /errorToast|e instanceof Error/.test(bloc),
    'un envoi refusé ne dit pas ce qui s’est passé',
  );
});

test('⚠️ UN ÉCHEC NE VIDE PAS LE FORMULAIRE', () => {
  // ⚠️ ON NE SIGNALE PAS DEUX FOIS DE BON CŒUR. Effacer le motif, le texte et
  // les photos après un refus obligerait à tout réécrire.
  const src = codeSeul(lire('src/app/report/user.tsx'));
  const bloc = src.slice(src.indexOf('const handleSubmit'));
  const catchBloc = bloc.slice(bloc.indexOf('catch'), bloc.indexOf('successToast'));
  assert.ok(!/setReason\(null\)/.test(catchBloc), 'le motif est efface apres un echec');
  assert.ok(!/setDescription\(''\)/.test(catchBloc), 'le texte saisi est perdu apres un echec');
});

test('🔴 LE SIGNALEMENT PORTE LA CONVERSATION D’OÙ IL VIENT', () => {
  // 🔴 SANS ELLE, LE SUPPORT REÇOIT « comportement agressif » ET RIEN D'AUTRE —
  // pas une ligne de ce qui a été écrit. `signaler_utilisateur` sait la
  // rattacher ; il fallait la lui donner, et le chat sait désormais laquelle
  // c'est puisque son fil est réel.
  const chat = codeSeul(lire('src/app/chat/[id].tsx'));
  assert.ok(/conversationId: filId/.test(chat), 'le chat ne transmet pas son fil au signalement');
  const ecran = codeSeul(lire('src/app/report/user.tsx'));
  assert.ok(/conversationId,/.test(ecran), 'l’écran ne transmet pas la conversation');
  const service = codeSeul(lire('src/services/signalements.ts'));
  assert.ok(/p_conversation_id/.test(service), 'la conversation n’arrive pas jusqu’à la base');
});
