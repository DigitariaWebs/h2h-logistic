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
  rating: number;
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
