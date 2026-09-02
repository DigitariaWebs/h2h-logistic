// Le vocabulaire des notifications : celui de la base vers celui de l'écran.
//
// ⚠️ DANS `utils`, PAS DANS LE SERVICE, ET C'EST DÉLIBÉRÉ. Cette traduction est
// la seule chose qui empêche l'écran de tomber sur un type inconnu — donc elle
// doit être éprouvée. Tant qu'elle vivait à côté de la requête, l'importer
// tirait le client Supabase, qui exige les variables d'environnement à
// l'import : un test sur une fonction pure échouait faute de `.env.local`.
import type { AppNotification } from '@/services/mock/notifications';

/**
 * Le vocabulaire de la base vers celui de l'écran.
 *
 * 🔴 CETTE TRADUCTION N'EST PAS COSMÉTIQUE, ELLE ÉVITE UN ÉCRAN BLANC.
 * `notification_type` porte VINGT-ET-UNE valeurs — les trois applications
 * partagent une seule base — alors que `NotificationRow` n'en connaît que cinq
 * et s'en sert pour choisir son icône et son animation. Passer un
 * `mission_proposal` brut donnerait `iconMap[type] === undefined`, exactement
 * la panne qui avait fait tomber l'écran de notifications de la place de marché
 * le 22/08/2026.
 *
 * ⚠️ LE REPLI EST DONC OBLIGATOIRE, PAS PRUDENTIEL : un type inconnu — ajouté
 * demain par une application sœur — doit s'afficher, pas casser la liste. On
 * préfère une cloche générique à une notification cachée.
 */
export function versTypeEcran(typeBase: string): AppNotification['type'] {
  switch (typeBase) {
    // Une co-livraison qu'on nous propose : c'est la ligne qu'on met en avant.
    case 'mission_proposal':
      return 'mission_new';
    // La vie de la mission déjà acceptée.
    case 'co_delivery':
    case 'pickup':
    case 'pickup_done':
    case 'incoming_package':
    case 'delivery':
    case 'order':
      return 'mission_update';
    // L'argent.
    case 'payout':
      return 'earning';
    default:
      return 'system';
  }
}
