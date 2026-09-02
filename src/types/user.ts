export interface User {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  avatar?: string;
  role: 'transporter';
  isVerified: boolean;
  isOnline: boolean;
  /**
   * La note moyenne reçue, ou `null` tant que PERSONNE n'a noté.
   *
   * 🔴 CE CHAMP VALAIT `5.0` PAR DÉFAUT. Un cotransporteur inscrit depuis une
   * heure, sans une seule co-livraison, s'affichait « 5.0 note moyenne » — et
   * c'est exactement le chiffre sur lequel un acheteur décide à qui confier son
   * colis. `null` n'est pas un détail de typage : c'est la différence entre
   * « personne ne l'a encore noté » et « tout le monde l'a trouvé parfait ».
   */
  rating: number | null;
  totalDeliveries: number;
  createdAt: string;
}

export interface TransporterProfile extends User {
  transportTypes: string[];
  favoriteHubs: string[];
  vehicleInfo?: string;
  documentsVerified: boolean;
  city?: string;
  convention?: ConventionAcceptance;
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  city: string;
  transportType: string;
  avatar?: string;
}

// 🔴 `iban`, `wantsBankTransfer` ET `signatureData` ONT DISPARU DE CE TYPE, et
// c'est le cœur du changement, pas un détail de forme.
//
//   • `iban` : on ne demande plus de coordonnées bancaires. Elles étaient
//     rangées EN CLAIR dans AsyncStorage. Le compte de versement s'ouvre chez
//     Stripe, sur sa page hébergée — nous ne voyons jamais l'IBAN. La base
//     porte `iban_tail` et `stripe_external_account_id`, écrits par le serveur
//     à partir de ce que Stripe rend, et qu'un client ne peut pas écrire.
//   • `signatureData` : le tracé vit dans le stockage privé `signatures`, pas
//     dans l'objet en mémoire. La ligne n'en garde que le chemin.
//   • `wantsBankTransfer` : il n'y a plus de choix à faire — il n'y a qu'un
//     seul chemin de versement.
export type ConventionAcceptance = {
  version: string;
  representative: string;
  debitAuthorized: boolean;
  acceptedAt: string;
  /** Le compte de versement, quand Stripe l'aura rendu. Nul jusque-là. */
  compteVersement: string | null;
};
