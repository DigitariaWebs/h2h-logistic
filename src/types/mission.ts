export type MissionStatus =
  | 'proposal'
  | 'accepted'
  | 'seller_pending'
  | 'group_created'
  | 'pickup_pending'
  | 'picked_up'
  | 'in_transit'
  | 'deposited'
  | 'delivery_pending'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired';

export type CancellationReason =
  | 'seller_no_show'
  | 'buyer_no_show'
  | 'transporter_cancelled_before_pickup'
  | 'transporter_cancelled_after_pickup'
  | 'seller_timer_expired'
  | 'other';

export interface MissionParticipant {
  id: string;
  /**
   * 🔴 LE PSEUDONYME, JAMAIS LE PRÉNOM NI LE NOM. `profiles_self_read` ne laisse
   * lire que sa propre ligne ; l'identité des autres passe par la vue
   * `profils_publics`, qui ne porte que l'identité PUBLIQUE.
   */
  name: string;
  avatar?: string;
  /**
   * ⚠️ FACULTATIF, ET TOUJOURS ABSENT AUJOURD'HUI. Il était obligatoire tant
   * que les participants étaient inventés ; aucune vue publique ne rend un
   * numéro, délibérément — le contact passe par la messagerie de la
   * plateforme, où il laisse une trace.
   */
  phone?: string;
  rating?: number;
  role: 'seller' | 'buyer' | 'transporter';
  isFavorite?: boolean;
  qrCode?: string;
}

export interface MissionPackage {
  id: string;
  description: string;
  size: string;
  weight: number;
  photo?: string;
  thumbnail?: string;
  condition?: string;
  trackingNumber?: string;
}

export interface MissionHub {
  id: string;
  name: string;
  city: string;
  scheduledTime: string;
  toleranceMinutes: number;
  actualTime?: string;
  qrCode?: string;
  otpCode?: string;
  isOffHub?: boolean;
  offHubAddress?: string;
}

export interface OffHubProposal {
  target: 'seller' | 'buyer';
  address: string;
  proposedTime: string;
  status: 'pending' | 'accepted' | 'rejected';
}

/** Support decision (§5/§7) — always taken by a human, never automatic. */
export type SupportOutcome = 'danger_confirmed' | 'good_faith' | 'abusive';

export interface Mission {
  id: string;
  routeId: string;
  status: MissionStatus;
  seller: MissionParticipant;
  buyer: MissionParticipant;
  transporter: MissionParticipant;
  package: MissionPackage;
  pickupHub: MissionHub;
  deliveryHub: MissionHub;
  price: number;
  transporterEarning: number;
  platformFee: number;
  sellerTimerEnd?: string;
  proposalExpiresAt?: string;
  cancellationReason?: CancellationReason;
  offHubProposal?: OffHubProposal;
  isReturn?: boolean;
  // ─── Support review / payment hold (danger-grave report routing) ───
  /** Mission put « en attente » by support after a serious report. */
  supportHold?: boolean;
  /** Transaction payment state; 'held' while support reviews. */
  paymentStatus?: 'pending' | 'held' | 'released' | 'refused' | 'refunded';
  /** Co-transporteur earning state; 'held' while support reviews. */
  transporterPayStatus?: 'pending' | 'held' | 'paid' | 'unpaid';
  /** Seller payment state, set at the support decision. */
  sellerPayStatus?: 'pending' | 'held' | 'paid' | 'unpaid';
  /** Buyer refund state, set at the support decision. */
  buyerRefundStatus?: 'none' | 'refused' | 'limited' | 'refunded';
  /** Id of the user report that triggered the hold. */
  reportId?: string;
  /** Id of the reported user (drives suspension + separation at resolution). */
  reportedUserId?: string;
  /** Support decision outcome (§5/§7), once resolved. */
  supportOutcome?: SupportOutcome;
  supportResolvedAt?: string;
  /** « Rappel pédagogique » shown to a good-faith co-transporteur (no sanction). */
  pedagogicalReminder?: boolean;
  /** Computed money outcome from an incident form (§ Principe financier). */
  settlement?: import('@/types/settlement').Settlement;
  createdAt: string;
  updatedAt: string;
}

export interface MissionGroup {
  id: string;
  missions: Mission[];
  routeId: string;
  totalEarnings: number;
}

export const ACTIVE_STATUSES: MissionStatus[] = [
  'accepted', 'seller_pending', 'group_created',
  'pickup_pending', 'picked_up', 'in_transit', 'deposited', 'delivery_pending',
];

export const COMPLETED_STATUSES: MissionStatus[] = ['delivered', 'completed'];
