// LES NOTIFICATIONS REÇUES — celles de la base, pas celles du bundle.
//
// 🔴 CE QUE CET ÉCRAN MONTRAIT JUSQU'ICI. `mockNotifications`, une constante du
// bundle : quatre lignes figées, identiques pour tout le monde, datées d'avril.
// Sur l'appareil le 02/09/2026, connecté en `transporteur+clerk_test`, la carte
// « Notifications récentes » annonçait « Nouvelle co-livraison disponible —
// il y a 146j » à un compte créé le matin même. Le badge « 2 » de l'en-tête
// comptait ces mêmes lignes inventées.
//
// 🔴 ET LES VRAIES EXISTAIENT DÉJÀ. `app.notifier()` écrit dans
// `public.notifications` à chaque étape d'une co-livraison — proposition,
// acceptation, relance du vendeur — et le même compte en avait QUATRE en base,
// dont « Une co-livraison vous est proposée » et « Le vendeur n'a pas encore
// confirmé ». Personne ne les lisait : l'application n'avait aucun service de
// notifications.
//
// ⚠️ AUCUN FILTRE PAR DESTINATAIRE ICI, ET C'EST VOULU. La policy
// `notifications_recipient_read` fait déjà `recipient_id = app.uid()`.
// Refiltrer côté client dupliquerait la règle à deux endroits qui finiraient
// par diverger — et seule celle du serveur protège vraiment.
import { supabase } from '@/lib/supabase';
import type { AppNotification } from '@/services/mock/notifications';
import { versTypeEcran } from '@/utils/typeNotification';

type LigneNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
};

const CHAMPS = 'id, type, title, body, is_read, created_at';

function versNotification(l: LigneNotification): AppNotification {
  return {
    id: l.id,
    type: versTypeEcran(l.type),
    title: l.title,
    body: l.body,
    read: l.is_read,
    createdAt: l.created_at,
  };
}

/**
 * Mes notifications, les plus récentes d'abord.
 *
 * ⚠️ PLAFONNÉ ET TRIÉ EN SQL. L'écran n'a pas de pagination ; tout charger
 * coûterait une attente proportionnelle à l'ancienneté du compte pour des
 * lignes que personne ne fait défiler.
 */
export async function chargerNotifications(limite = 100): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select(CHAMPS)
    .order('created_at', { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return ((data ?? []) as LigneNotification[]).map(versNotification);
}

/** Marque une notification comme lue. */
export async function marquerLue(id: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw new Error(error.message);
}
