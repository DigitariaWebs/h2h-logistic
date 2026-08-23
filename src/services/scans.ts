// LES SCANS — la garde d'un colis, écrite en base.
//
// 🔴 CE QUE ÇA REMPLACE, ET POURQUOI C'ÉTAIT GRAVE. La vérification vivait
// ENTIÈREMENT sur ce téléphone : `matchesSeller()` acceptait n'importe quel code
// commençant par `SEL-` ou `HTH-` — c'est-à-dire l'étiquette que le
// cotransporteur particulier tient déjà en main — et deux boutons de
// développement sautaient le contrôle en entier. Rien de tout cela ne remontait
// nulle part : `record_scan_event` existait, testée, accordée, et personne ne
// l'appelait.
//
// 🔴 LA COMPARAISON A DÉMÉNAGÉ EN BASE (`20260822270000`). Ce module n'envoie
// plus un verdict, il envoie un CODE : c'est le serveur qui dit si c'est le bon.
// Un contrôle qui vit chez l'appelant n'est pas un contrôle.
//
// ⚠️ ET DEUX VERROUS, PAS UN. Le code doit être celui de l'expédition, ET une
// transition qui suppose une rencontre exige la preuve de cette rencontre :
// l'identité d'en face, scannée avant. L'étiquette du colis ne prouve que le
// colis — or le cotransporteur le porte depuis la récupération.
import { File } from 'expo-file-system';
import { supabase } from '@/lib/supabase';

/** Ce que la base répond à un scan. */
export type ResultatScan =
  | 'success'
  | 'package_mismatch'
  | 'wrong_code'
  | 'no_eligible'
  | 'expired_qr'
  | 'out_of_window'
  | 'duplicate';

/** Le genre de scan, tel que `handoff_kind` le nomme. */
export type GenreScan = 'seller_qr' | 'buyer_qr' | 'tracking_qr' | 'photo' | 'geo_presence' | 'system';

export type EtatColis =
  | 'created' | 'awaiting_transporter' | 'accepted' | 'seller_confirmed'
  | 'pickup_pending' | 'picked_up' | 'in_transit' | 'at_relay'
  | 'awaiting_collection' | 'out_for_delivery' | 'delivered' | 'completed'
  | 'redelivery_pending' | 'return_pending' | 'returned' | 'cancelled'
  | 'disputed' | 'expired';

export type Scan = {
  shipmentId: string;
  genre: GenreScan;
  /** Le code lu ou tapé. `null` pour une photo ou une présence GPS. */
  code?: string | null;
  /** L'état visé, ou rien quand le scan ne fait qu'identifier. */
  versEtat?: EtatColis | null;
  /** 1 ou 2 dans une séquence de récupération / remise. */
  etape?: number | null;
  cheminPhoto?: string | null;
  hubId?: string | null;
  /**
   * 🔴 LA CLÉ D'IDEMPOTENCE, ET ELLE DOIT SURVIVRE À LA TENTATIVE.
   * Le réseau d'un téléphone coupe au hub : le client rejoue son scan, et la
   * base doit rendre le MÊME événement plutôt que d'en écrire un second. La
   * clé se fabrique donc au moment où l'utilisateur appuie, pas à chaque appel.
   */
  cle: string;
};

/**
 * Une clé d'idempotence pour UNE tentative.
 *
 * ⚠️ ELLE SE FABRIQUE UNE FOIS ET SE GARDE. La régénérer à chaque essai
 * transformerait un rejeu réseau en second événement — et un litige lirait deux
 * scans là où le cotransporteur n'a appuyé qu'une fois.
 */
export function nouvelleCle(prefixe: string): string {
  return `${prefixe}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Enregistre un scan et rend le verdict du serveur.
 *
 * ⚠️ ON ENVOIE TOUJOURS `success` COMME RÉSULTAT PROPOSÉ. Ce n'est pas une
 * affirmation : c'est l'intention. Le serveur la rétrograde en `wrong_code`,
 * `package_mismatch` ou `no_eligible` selon ce qu'il constate — et c'est SA
 * réponse qu'on affiche.
 */
export async function enregistrerScan(s: Scan): Promise<ResultatScan> {
  const { data, error } = await supabase.rpc('record_scan_event', {
    p_shipment_id: s.shipmentId,
    p_app: 'logistic',
    p_actor_role: 'transporter',
    p_kind: s.genre,
    p_result: 'success',
    p_client_event_id: s.cle,
    p_step: s.etape ?? null,
    p_scanned_code: s.code?.trim() || null,
    p_photo_path: s.cheminPhoto ?? null,
    p_hub_id: s.hubId ?? null,
    p_to_state: s.versEtat ?? null,
  });
  // 🔴 LE REFUS DU SERVEUR EST UNE RÈGLE, PAS UNE PANNE : « cette expedition ne
  // vous concerne pas », « le role declare n est pas le votre ». On le remonte
  // tel quel plutôt qu'en « erreur », qui laisserait réessayer la même chose.
  if (error) throw new Error(error.message);
  const ligne = (Array.isArray(data) ? data[0] : data) as { result: ResultatScan } | null;
  return ligne?.result ?? 'no_eligible';
}

/** Ce qu'un résultat veut dire pour le cotransporteur particulier, en clair. */
export function messageDeScan(r: ResultatScan, genre: GenreScan): string {
  switch (r) {
    case 'success':
      return 'Vérifié ✓';
    case 'package_mismatch':
      return "Ce colis n'est pas celui de la co-livraison. Vérifiez l'étiquette.";
    case 'wrong_code':
      return genre === 'seller_qr'
        ? "Ce n'est pas le code du vendeur de cette co-livraison."
        : "Ce n'est pas le code de l'acheteur de cette co-livraison.";
    case 'no_eligible':
      // ⚠️ LE CAS LE PLUS SUBTIL, ET IL MÉRITE SES MOTS : le code était bon,
      // mais l'étape ne l'était pas — le plus souvent parce que l'identité d'en
      // face n'a pas encore été scannée.
      return "Cette étape n'est pas ouverte : identifiez d'abord la personne en face.";
    case 'expired_qr':
      return 'Ce code a expiré. Demandez-en un nouveau.';
    case 'out_of_window':
      return 'Nous sommes hors du créneau prévu pour ce rendez-vous.';
    case 'duplicate':
      return 'Ce scan a déjà été enregistré.';
  }
}

/**
 * Téléverse une photo de garde et rend son CHEMIN (pas son URL).
 *
 * 🔴 LA FORME DU CHEMIN EST CONTRACTUELLE : `{shipment_id}/{nom}`. La policy du
 * bucket lit `storage.foldername(name)[1]` et le compare à `shipments.id` —
 * ranger la photo ailleurs la fait refuser, et le bucket est privé.
 *
 * ⚠️ SURTOUT PAS `fetch(uri).then(r => r.blob())`. Sous React Native, le Blob
 * rendu par `fetch` sur une URI `file://` n'expose pas ses octets à
 * `supabase-js` : le téléversement RÉUSSIT et dépose un objet de 0 octet. La
 * panne est silencieuse et ne se voit qu'à la relecture, sur une image vide.
 */
export async function televerserPhotoDeGarde(
  shipmentId: string,
  uri: string,
  nom: string,
): Promise<string> {
  const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
  const mime =
    ext === 'png' ? 'image/png'
      : ext === 'webp' ? 'image/webp'
        : ext === 'heic' || ext === 'heif' ? 'image/heic'
          : 'image/jpeg';
  const chemin = `${shipmentId}/${nom}.${ext === 'heif' ? 'heic' : ext}`;
  const octets = (await new File(uri).bytes()).buffer as ArrayBuffer;
  const { error } = await supabase.storage
    .from('handoff-photos')
    .upload(chemin, octets, { contentType: mime, upsert: true });
  if (error) throw new Error(`photo : ${error.message}`);
  return chemin;
}

/**
 * Constate l'absence de l'acheteur au rendez-vous.
 *
 * 🔴 LA PHOTO EST OBLIGATOIRE, ET C'EST LE SERVEUR QUI L'EXIGE : « une photo est
 * requise pour constater une absence ». Un constat sans preuve déclencherait une
 * facturation de l'acheteur sur la seule parole du cotransporteur.
 *
 * ⚠️ ET LE CONSTAT NE FACTURE RIEN À LUI SEUL. Il horodate l'absence ; le
 * barème, lui, se règle ailleurs.
 */
export async function constaterAbsence(
  shipmentId: string,
  cheminPhoto: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('constater_absence', {
    p_shipment_id: shipmentId,
    p_photo_path: cheminPhoto,
  });
  if (error) throw new Error(error.message);
  return (data as string | null) ?? null;
}
