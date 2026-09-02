// LA CONVENTION DU COTRANSPORTEUR PARTICULIER — signée, et conservée.
//
// 🔴 CE QU'ELLE REMPLACE. L'acceptation vivait dans AsyncStorage, en clair, AVEC
// L'IBAN. Trois conséquences : elle disparaissait à la déconnexion (le
// `logout()` effaçait la clé), personne d'autre que le téléphone ne pouvait la
// produire en cas de litige, et un IBAN traînait en clair sur l'appareil.
//
// 🔴 ET ON NE DEMANDE PLUS L'IBAN DU TOUT. C'est la vraie correction : plutôt
// que de protéger un secret, on cesse de l'avoir. La place de marché ne l'a
// jamais demandé — `stripe-connect` ouvre un compte Express et rend une URL
// d'inscription hébergée, où la personne saisit ses coordonnées bancaires CHEZ
// STRIPE. `convention_acceptances.iban_tail` et `stripe_external_account_id`
// existent, restent nuls, et seront écrits par le serveur à partir de ce que
// Stripe rend. Les droits colonne de `20260822240000` l'imposent : un client
// qui tenterait de les écrire est refusé.
//
// ⚠️ LA CONVENTION S'AJOUTE, ELLE NE SE MODIFIE PAS. La policy est en insertion
// seule : re-signer une nouvelle version ajoute une ligne, elle n'écrase pas la
// précédente. Un mandat de prélèvement qu'on peut retirer après coup ne vaut
// rien le jour où une pénalité tombe.
import { supabase } from '@/lib/supabase';
import { CONVENTION_TRANSPORTEUR_VERSION } from '@/constants/ConventionTransporteur';

export type ConventionEnregistree = {
  version: string;
  representative: string;
  debitAuthorized: boolean;
  acceptedAt: string;
  /** Le compte de versement, quand Stripe l'aura rendu. Nul jusque-là. */
  compteVersement: string | null;
};

type Ligne = {
  version: string;
  representative: string;
  debit_authorized: boolean;
  accepted_at: string;
  stripe_external_account_id: string | null;
};

const versConvention = (l: Ligne): ConventionEnregistree => ({
  version: l.version,
  representative: l.representative,
  debitAuthorized: l.debit_authorized,
  acceptedAt: l.accepted_at,
  compteVersement: l.stripe_external_account_id,
});

/**
 * La convention en vigueur pour ce compte, ou `null`.
 *
 * ⚠️ ON PREND LA PLUS RÉCENTE. Les acceptations s'empilent — c'est le propre
 * d'une table en insertion seule — et c'est la dernière qui fait foi.
 *
 * ⚠️ ON NE FILTRE PAS SUR SOI-MÊME : `convention_acceptances_owner_read` ne rend
 * déjà que les siennes.
 */
export async function chargerMaConvention(): Promise<ConventionEnregistree | null> {
  const { data, error } = await supabase
    .from('convention_acceptances')
    .select('version, representative, debit_authorized, accepted_at, stripe_external_account_id')
    .eq('scope', 'transporter')
    .order('accepted_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  const l = (data ?? [])[0] as Ligne | undefined;
  return l ? versConvention(l) : null;
}

/**
 * La version, réduite à ce qu'un nom d'objet de stockage accepte.
 *
 * 🔴 LA SIGNATURE NE PARTAIT PAS, ET LA CONVENTION N'ÉTAIT JAMAIS ENREGISTRÉE.
 * `CONVENTION_TRANSPORTEUR_VERSION` vaut « v1.0 — 2026-05-21 » : un tiret CADRATIN
 * (U+2014) et deux espaces. Supabase Storage refuse la clé telle quelle —
 *
 *     signature : Invalid key: <profil>/transporter/v1.0 — 2026-05-21.txt
 *
 * — et `signerConvention` s'arrêtait là, donc AUCUN cotransporteur ne pouvait
 * terminer son inscription. Constaté à l'émulateur le 02/09/2026, au premier
 * passage réel dans cet écran.
 *
 * ⚠️ `encodeURIComponent` NE SUFFISAIT PAS, et c'est ce qui rendait le défaut
 * discret : il transformait la version en `v1.0%20%E2%80%94%20…`, donc en une
 * clé pleine de `%` — refusée elle aussi. Le code AVAIT l'air de traiter le
 * problème.
 *
 * ⚠️ SEUL LE NOM DE FICHIER CHANGE. La policy de stockage compare
 * `storage.foldername(name)[1]` au profil courant : le premier segment reste le
 * `profile_id`, donc le contrôle d'accès est intact. Et `signature_path` garde
 * en base EXACTEMENT ce qui a été téléversé, donc la relecture suit.
 */
function versionPourChemin(version: string): string {
  return version
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/**
 * Signer la convention.
 *
 * 🔴 LE TRACÉ PART DANS `signatures`, PAS DANS LA LIGNE. `signature_path` est
 * `not null` et attend un chemin de stockage ; c'est aussi ce qui permet de
 * produire la signature elle-même en cas de litige, et pas seulement l'affirmer.
 *
 * ⚠️ LE CHEMIN EST CONTRACTUEL : `{profile_id}/{scope}/{version}.txt`. La policy
 * lit `storage.foldername(name)[1]` et le compare au profil courant — une autre
 * forme serait refusée, ou pire, validerait le mauvais dossier.
 *
 * ⚠️ `contentType` EST OBLIGATOIRE. Le bucket n'accepte que `text/plain` ; sans
 * en-tête, le téléversement part en `application/octet-stream` et se fait
 * refuser par le bucket — une erreur qui ne ressemble en rien à un problème de
 * droits.
 */
export async function signerConvention(input: {
  profilId: string;
  representant: string;
  trace: string;
  prelevementAutorise: boolean;
}): Promise<ConventionEnregistree> {
  const version = CONVENTION_TRANSPORTEUR_VERSION;
  const chemin = `${input.profilId}/transporter/${versionPourChemin(version)}.txt`;

  const { error: erreurDepot } = await supabase.storage
    .from('signatures')
    .upload(chemin, input.trace, { contentType: 'text/plain', upsert: false });
  // ⚠️ « DÉJÀ LÀ » N'EST PAS UNE ERREUR. `upsert: false` est voulu — une
  // signature ne se remplace pas — mais reprendre une signature interrompue
  // doit rester possible : le fichier existe déjà, on continue.
  if (erreurDepot && !/exists|dupl/i.test(erreurDepot.message)) {
    throw new Error(`signature : ${erreurDepot.message}`);
  }

  const { data, error } = await supabase
    .from('convention_acceptances')
    .insert({
      profile_id: input.profilId,
      scope: 'transporter',
      version,
      locale: 'fr',
      representative: input.representant.trim(),
      debit_authorized: input.prelevementAutorise,
      signature_path: chemin,
    })
    .select('version, representative, debit_authorized, accepted_at, stripe_external_account_id')
    .single();
  if (error) throw new Error(error.message);
  return versConvention(data as Ligne);
}
