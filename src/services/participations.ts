// LES PARTICIPATIONS — ce que la plateforme doit au cotransporteur particulier.
//
// 🔴 CE QUE ÇA REMPLACE, ET CE QUE ÇA RÉPARE. `services/mock/earnings.ts`
// affichait un solde, un histogramme et un historique entièrement inventés. Le
// bouton « Retirer » de l'écran des participations n'avait AUCUN `onPress`, et
// portait la mention « les retraits seront disponibles prochainement ». Elle
// était exacte : rien, dans toute la base, ne payait un cotransporteur pour une
// co-livraison réussie — `post_purchase` envoyait les frais de livraison sur le
// compte des transporteurs TIERS, et le seul crédit jamais porté à
// `courier_payable` venait de la compensation d'absence.
//
// ⚠️ VOCABULAIRE : « participation », jamais « gains » ni « revenu ». Le
// cotransporteur particulier partage des frais (L. 3232-1).
import { supabase } from '@/lib/supabase';

/** Ce que la base doit, et ce qu'elle peut verser aujourd'hui. */
export type Participations = {
  /** Tout ce qui est dû, versable ou non. */
  soldeEuros: number;
  /** Ce qui passerait au virement maintenant. */
  versableEuros: number;
  /** Le reste : co-livraisons faites, fenêtre de réclamation encore ouverte. */
  enAttenteEuros: number;
  /** Cumul de ce qui a déjà été viré. */
  verseEuros: number;
  /** Nombre de co-livraisons actuellement versables. */
  colivraisons: number;
};

export type LigneParticipation = {
  survenuLe: string;
  montantEuros: number;
  /** `C` = porté au crédit du cotransporteur ; `D` = viré, donc soldé. */
  sens: 'C' | 'D';
  evenement: string;
  libelle: string | null;
  orderId: string | null;
  numeroSuivi: string | null;
};

export type Versement = {
  verse: boolean;
  montantEuros: number;
  colivraisons: number;
  /** « rien a verser pour le moment » — un refus qui n'est pas une panne. */
  motif?: string;
};

const enEuros = (c: number | string | null | undefined): number => Number(c ?? 0) / 100;

/**
 * Le motif écrit par la fonction Edge, ou rien.
 *
 * 🔴 SANS CECI, TOUS LES REFUS SE RESSEMBLENT. `functions.invoke` écrase tout
 * code non-2xx sous une seule phrase — « Edge Function returned a non-2xx status
 * code ». Or nos refus sont des RÈGLES et chacune dit quoi faire : « aucun
 * compte de versement », « Stripe n'a pas encore fini de vérifier ». Les
 * confondre laisserait l'écran incapable de distinguer « inscris-toi » de
 * « patiente ».
 */
async function motifDuRefus(error: unknown): Promise<string | null> {
  const reponse = (error as { context?: unknown })?.context;
  if (!(reponse instanceof Response)) return null;
  try {
    const corps = (await reponse.clone().json()) as { erreur?: string };
    return corps?.erreur ?? null;
  } catch {
    return null;
  }
}

/** Le solde, tel que le grand livre le connaît. */
export async function chargerParticipations(): Promise<Participations> {
  const { data, error } = await supabase.rpc('mes_participations');
  if (error) throw new Error(error.message);
  const l = (Array.isArray(data) ? data[0] : data) as {
    solde_cents: number | string;
    versable_cents: number | string;
    en_attente_cents: number | string;
    verse_cents: number | string;
    colivraisons: number;
  } | null;
  return {
    soldeEuros: enEuros(l?.solde_cents),
    versableEuros: enEuros(l?.versable_cents),
    enAttenteEuros: enEuros(l?.en_attente_cents),
    verseEuros: enEuros(l?.verse_cents),
    colivraisons: Number(l?.colivraisons ?? 0),
  };
}

/** Le détail, ligne à ligne — ce que l'écran « Historique » montre. */
export async function chargerJournalParticipations(
  limite = 50,
): Promise<LigneParticipation[]> {
  const { data, error } = await supabase.rpc('mon_journal_participations', {
    p_limite: limite,
  });
  if (error) throw new Error(error.message);
  type Ligne = {
    survenu_le: string;
    montant_cents: number | string;
    sens: 'C' | 'D';
    evenement: string;
    libelle: string | null;
    order_id: string | null;
    tracking_number: string | null;
  };
  return ((data ?? []) as unknown as Ligne[]).map((l) => ({
    survenuLe: l.survenu_le,
    montantEuros: enEuros(l.montant_cents),
    sens: l.sens,
    evenement: l.evenement,
    libelle: l.libelle,
    orderId: l.order_id,
    numeroSuivi: l.tracking_number,
  }));
}

// ⚠️ PAS DE `etatCompteVersement()` ICI, ET C'EST DÉLIBÉRÉ. Une première version
// l'exportait — puis aucun écran ne l'appelait. L'état du compte se lit très
// bien dans le refus du versement lui-même : « aucun compte de versement :
// commencez par vous inscrire », « Stripe n a pas encore fini de verifier votre
// compte ». Une fonction écrite et jamais appelée est le défaut qu'on passe la
// semaine à corriger ailleurs.
async function appelerConnect(action: 'ouvrir'): Promise<any> {
  const { data, error } = await supabase.functions.invoke('stripe-connect', {
    body: { action },
  });
  if (error) {
    throw new Error((await motifDuRefus(error)) ?? error.message ?? 'versements indisponibles');
  }
  if (data?.erreur) throw new Error(data.erreur);
  return data;
}

/**
 * Ouvre (ou reprend) l'inscription Stripe et rend l'URL à afficher.
 *
 * 🔴 C'EST ICI QUE LE COMPTE BANCAIRE SE DONNE, et nulle part chez nous.
 * L'écran IBAN de cette application a été supprimé le 22/08/2026 : il rangeait
 * un IBAN EN CLAIR dans AsyncStorage. Stripe le collecte sur sa propre page ;
 * la base ne connaît que les quatre derniers chiffres, écrits par le serveur.
 *
 * ⚠️ L'URL EST À USAGE UNIQUE ET EXPIRE VITE — on ne la met pas en cache.
 *
 * ⚠️ APPELER DEUX FOIS NE CRÉE PAS DEUX COMPTES : le serveur relit le compte
 * existant avant d'en créer un.
 */
export async function ouvrirCompteVersement(): Promise<string> {
  const r = await appelerConnect('ouvrir');
  if (!r?.url) throw new Error('lien d inscription absent');
  return r.url as string;
}

/**
 * Demande le virement de ce qui est dû.
 *
 * 🔴 ON N'ENVOIE NI MONTANT NI DESTINATAIRE — seulement le rôle. Le serveur
 * déduit QUI parle du jeton et demande à la base ce qu'elle lui doit. Un client
 * qui annoncerait la somme choisirait ce qu'il touche ; un client qui
 * annoncerait la personne se ferait payer à la place d'un autre.
 *
 * ⚠️ « RIEN À VERSER » N'EST PAS UNE ERREUR. Le serveur répond 200 avec
 * `verse: false` : lever ici afficherait un échec là où le cotransporteur doit
 * lire « pas encore ».
 *
 * ⚠️ ET LE SOLDE N'EST PAS LE VERSABLE. Une co-livraison remise hier est due,
 * pas encore versable : la fenêtre de réclamation court. Les deux nombres sont
 * distincts à l'écran pour cette raison.
 */
export async function demanderVersement(): Promise<Versement> {
  const { data, error } = await supabase.functions.invoke('stripe-versement', {
    body: { role: 'transporter' },
  });
  if (error) {
    throw new Error((await motifDuRefus(error)) ?? error.message ?? 'versement indisponible');
  }
  if (data?.erreur) throw new Error(data.erreur);
  return {
    verse: !!data?.verse,
    montantEuros: enEuros(data?.montantCents),
    colivraisons: Number(data?.commandes ?? 0),
    motif: data?.motif,
  };
}
