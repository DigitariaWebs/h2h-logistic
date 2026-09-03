// LA MESSAGERIE DU COTRANSPORTEUR — la vraie.
//
// 🔴 CE QUE ÇA REMPLACE. `chat/[id].tsx` empilait le message dans son état
// local, puis programmait une réponse tirée d'une liste :
//
//     setTimeout(() => {
//       const replies = ['Bien reçu, merci !', 'Je vous attends au hub.', …];
//
// Rien ne partait, personne ne recevait — et l'écran fabriquait la preuve que
// l'autre avait répondu. Un cotransporteur qui lit « Je vous attends au hub »
// ira au hub.
//
// 🔴 ET IL N'Y AVAIT RIEN À BRANCHER. La messagerie de la plateforme ne
// connaissait que deux personnes autour d'une annonce : `ouvrir_conversation`
// refuse qui n'est ni acheteur ni vendeur, et `app.in_conversation` — la clé de
// toute la RLS — lit `conversation_members`, où un cotransporteur ne figurait
// jamais. La migration `20260903020000` ouvre le fil qui manquait.
//
// ⚠️ DEUX FILS PAR CO-LIVRAISON, PAS UN SALON À TROIS : l'acheteur n'a pas à
// lire ce que le vendeur écrit au porteur, ni l'inverse. C'est déjà ce que les
// écrans supposent — ils ouvrent un fil par partie et passent `missionId` +
// `role`.
//
// ⚠️ ON NE RÉ-IMPLÉMENTE PAS LA MESSAGERIE, ON S'Y RACCORDE. Les tables, la RLS,
// `marquer_lu` et le blocage de contact existent et servent déjà la place de
// marché. Ce fichier n'ajoute qu'un accès depuis cette application-ci.
import { supabase } from '@/lib/supabase';

/** Avec qui le cotransporteur parle. Il n'y a pas d'autre cas. */
export type Interlocuteur = 'seller' | 'buyer';

export type MessageFil = {
  id: string;
  texte: string | null;
  /** L'auteur, ou `null` pour un message de la plateforme. */
  auteurId: string | null;
  type: string;
  /** Vrai si c'est moi qui l'ai écrit — décidé ici, pas à l'écran. */
  deMoi: boolean;
  envoyeLe: string;
  lu: boolean;
};

type LigneMessage = {
  id: string;
  text: string | null;
  sender_id: string | null;
  type: string;
  created_at: string;
  read: boolean;
};

const CHAMPS = 'id, text, sender_id, type, created_at, read';

/**
 * Le fil de cette co-livraison avec cette partie — créé à la première ouverture.
 *
 * 🔴 LE SERVEUR DÉCIDE QUI PEUT L'OUVRIR, et il refuse plutôt que de rediriger :
 * un acheteur qui demande le fil du vendeur est éconduit, pas envoyé vers le
 * sien. Une redirection silencieuse lui ferait croire qu'il écrit au vendeur.
 */
export async function ouvrirFil(
  missionId: string,
  avec: Interlocuteur,
): Promise<string> {
  const { data, error } = await supabase.rpc('ouvrir_fil_colivraison', {
    p_mission_id: missionId,
    p_avec: avec,
  });
  if (error) throw new Error(error.message);
  const ligne = (Array.isArray(data) ? data[0] : data) as { id: string } | null;
  if (!ligne?.id) throw new Error('Fil de co-livraison indisponible');
  return ligne.id;
}

/**
 * Les messages d'un fil, du plus ancien au plus récent.
 *
 * ⚠️ `moiId` SERT À DÉCIDER `deMoi` ICI, PAS À L'ÉCRAN. Trois écrans comparaient
 * autrefois des identités chacun à leur façon ; une seule comparaison, au seul
 * endroit qui connaît la ligne, en vaut trois.
 */
export async function chargerMessages(
  conversationId: string,
  moiId: string | null,
): Promise<MessageFil[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(CHAMPS)
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LigneMessage[]).map((l) => ({
    id: l.id,
    texte: l.text,
    auteurId: l.sender_id,
    type: l.type,
    deMoi: l.sender_id != null && l.sender_id === moiId,
    envoyeLe: l.created_at,
    lu: l.read,
  }));
}

/**
 * Envoie un message, et rend celui que la base a écrit.
 *
 * 🔴 ON REND LA LIGNE DU SERVEUR, PAS CELLE QU'ON A ENVOYÉE. C'est ce qui
 * distingue un message parti d'un message affiché : `messages_member_send` et
 * `messages_expediteur_non_bloque` peuvent refuser l'insertion, et l'écran doit
 * l'apprendre plutôt que de montrer un message que personne n'a reçu.
 */
export async function envoyerMessage(
  conversationId: string,
  moiId: string,
  texte: string,
): Promise<MessageFil> {
  const propre = texte.trim();
  if (!propre) throw new Error('Message vide');
  const { data, error } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversationId,
      sender_id: moiId,
      type: 'text',
      text: propre,
    })
    .select(CHAMPS)
    .single();
  if (error) throw new Error(error.message);
  const l = data as LigneMessage;
  return {
    id: l.id,
    texte: l.text,
    auteurId: l.sender_id,
    type: l.type,
    deMoi: true,
    envoyeLe: l.created_at,
    lu: l.read,
  };
}

/**
 * Marque comme lus les messages reçus dans ce fil.
 *
 * ⚠️ UNE RPC, PAS UN UPDATE. Marquer « lu » depuis le client demanderait un
 * droit d'écriture sur les messages des AUTRES ; `marquer_lu` le fait côté
 * serveur, pour le seul appelant, et existe déjà.
 */
export async function marquerLu(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('marquer_lu', {
    p_conversation_id: conversationId,
  });
  if (error) throw new Error(error.message);
}

/** Le dernier message d'un fil, pour la liste des conversations. */
export type Apercu = {
  texte: string | null;
  envoyeLe: string | null;
  /** Messages reçus non lus — ce que la pastille compte. */
  nonLus: number;
};

/**
 * L'aperçu d'un fil SANS l'ouvrir.
 *
 * 🔴 CE QUE ÇA REMPLACE : `getConversationPreview(mission.id, 'seller')`, qui
 * rendait un dernier message inventé pour chaque ligne de l'onglet Messages.
 *
 * ⚠️ ET ON N'OUVRE PAS LE FIL POUR L'AFFICHER. Ouvrir crée le fil ; une liste qui
 * ouvre en s'affichant fabriquerait une conversation par mission visible, dont
 * la plupart resteraient vides. On lit ce qui existe, et on rend `null` sinon.
 */
export async function apercuFil(
  shipmentId: string,
  avec: Interlocuteur,
  moiId: string | null,
): Promise<Apercu | null> {
  const { data: fils, error: e1 } = await supabase
    .from('conversations')
    .select('id')
    .eq('kind', 'mission_group')
    .eq('shipment_id', shipmentId)
    .eq('dm_key', avec)
    .limit(1);
  if (e1) throw new Error(e1.message);
  const fil = (fils ?? [])[0] as { id: string } | undefined;
  if (!fil) return null;

  const { data, error } = await supabase
    .from('messages')
    .select(CHAMPS)
    .eq('conversation_id', fil.id)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  const lignes = (data ?? []) as LigneMessage[];
  if (lignes.length === 0) return null;
  return {
    texte: lignes[0].text,
    envoyeLe: lignes[0].created_at,
    nonLus: lignes.filter((l) => !l.read && l.sender_id !== moiId).length,
  };
}
