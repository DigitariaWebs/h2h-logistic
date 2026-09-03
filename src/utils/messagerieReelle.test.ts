// LE CHAT DU COTRANSPORTEUR FABRIQUAIT LES RÉPONSES DE L'AUTRE.
//
// 🔴 CE QUE `chat/[id].tsx` FAISAIT. `sendMessage` empilait le texte dans l'état
// local, puis, deux secondes plus tard :
//
//     setTimeout(() => {
//       const replies = [
//         'Bien reçu, merci !',
//         "D'accord, pas de souci.",
//         'Je vous attends au hub.',
//         'Parfait !',
//       ];
//       setMessages((prev) => [...prev, reply]);
//     }, 2000);
//
// Rien ne partait. Personne ne recevait. Et l'écran écrivait, au nom du vendeur,
// une phrase que le vendeur n'avait pas écrite. Un cotransporteur qui lit
// « Je vous attends au hub » va au hub.
//
// 🔴 ET TROIS MESSAGES DE DÉMONSTRATION OUVRAIENT CHAQUE CONVERSATION —
// « Bonjour ! Le colis est prêt au hub. » — y compris celles où personne n'avait
// jamais écrit. L'onglet Messages, lui, tirait ses aperçus de
// `getConversationPreview`, un dernier message inventé par ligne.
//
// 🔴 CE N'ÉTAIT PAS UN DÉFAUT DE BRANCHEMENT : IL N'Y AVAIT RIEN À BRANCHER. La
// messagerie de la plateforme ne connaissait que deux personnes autour d'une
// annonce, et `app.in_conversation` — la clé de toute la RLS — lit
// `conversation_members`, où un cotransporteur ne figurait jamais. La migration
// `20260903020000` ouvre le fil qui manquait ; ce test garde le côté écran.
//
// ⚠️ ET LA PLATEFORME PROMET CE CANAL : « Votre numéro n'est jamais partagé avec
// les cotransporteurs », « les co-livraisons se font uniquement par chat et scan
// QR ». C'est le seul moyen de contact prévu entre trois personnes qui doivent se
// retrouver à une heure et un endroit précis.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const lire = (p: string) => readFileSync(join(process.cwd(), ...p.split('/')), 'utf8');
/** Le code seul : la correction NOMME ce qu'elle remplace. */
const codeSeul = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

const CHAT = codeSeul(lire('src/app/chat/[id].tsx'));
const ONGLET = codeSeul(lire('src/app/(tabs)/messages.tsx'));

test('🔴 L’ÉCRAN N’ÉCRIT PLUS À LA PLACE DE L’AUTRE', () => {
  // 🔴 LE CŒUR DU DÉFAUT. Toute réponse composée par le client est une réponse
  // que personne n'a donnée — et elle s'affiche du côté « reçu » de l'écran,
  // là où l'on croit lire quelqu'un d'autre.
  assert.ok(
    !/const replies\s*=/.test(CHAT),
    'le chat rejoue une liste de réponses toutes faites',
  );
  assert.ok(
    !/fromMe:\s*false/.test(CHAT.slice(CHAT.indexOf('const sendMessage'))),
    'l’envoi fabrique encore un message attribué à l’autre partie',
  );
});

test('🔴 ET AUCUNE CONVERSATION NE S’OUVRE DÉJÀ PLEINE', () => {
  assert.ok(!/MOCK_MESSAGES/.test(CHAT), 'les messages de démonstration sont revenus');
  assert.ok(
    !/Le colis est prêt au hub/.test(CHAT),
    'un message inventé est réapparu dans l’écran',
  );
});

test('🔴 LE FIL ET LES MESSAGES VIENNENT DU SERVEUR', () => {
  // ⚠️ TEST DE STRUCTURE, ET IL EST JUSTIFIÉ : le service peut être parfait et
  // l'écran continuer de vivre dans son état local. C'était l'état d'avant.
  assert.ok(/ouvrirFil\(/.test(CHAT), 'le chat n’ouvre plus le fil de co-livraison');
  assert.ok(/chargerMessages\(/.test(CHAT), 'le chat ne charge plus l’historique');
  assert.ok(/await envoyerMessage\(/.test(CHAT), 'l’envoi ne passe plus par la base');
});

test('⚠️ UN ENVOI REFUSÉ SE DIT, ET REND SON TEXTE', () => {
  // ⚠️ LA RLS PEUT REFUSER — fil étranger, contact bloqué. Afficher quand même
  // le message reproduirait le défaut d'origine sous une autre forme : un
  // message visible que personne n'a reçu.
  const envoi = CHAT.slice(CHAT.indexOf('const sendMessage'), CHAT.indexOf('const sendMessage') + 1400);
  assert.ok(/catch/.test(envoi), 'un envoi refusé passe en silence');
  assert.ok(/setInput\(propre\)/.test(envoi), 'le texte refusé est perdu : il faut le retaper');
});

test('🔴 LES APERÇUS DE L’ONGLET MESSAGES NE SONT PLUS INVENTÉS', () => {
  assert.ok(
    !/getConversationPreview/.test(ONGLET),
    'l’onglet Messages rejoue des derniers messages de démonstration',
  );
  assert.ok(/apercuFil\(/.test(ONGLET), 'l’onglet ne lit plus les vrais fils');
});

test('⚠️ ET LA LISTE NE CRÉE PAS DE FIL EN S’AFFICHANT', () => {
  // ⚠️ OUVRIR, C'EST CRÉER. Une liste qui ouvrirait chaque fil pour l'afficher
  // fabriquerait une conversation par mission visible, presque toutes vides —
  // et enverrait une notification pour chacune.
  assert.ok(
    !/ouvrirFil\(/.test(ONGLET),
    'la liste ouvre les fils au lieu de lire ceux qui existent',
  );
});

test('⚠️ PLUS AUCUN ÉCRAN NE TIRE SES MESSAGES DE `services/mock/chat`', () => {
  for (const f of ['src/app/chat/[id].tsx', 'src/app/(tabs)/messages.tsx']) {
    assert.ok(
      !/services\/mock\/chat/.test(lire(f)),
      f + ' lit encore la messagerie de démonstration',
    );
  }
});
