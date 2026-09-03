export type UserReportReason =
  | 'danger'
  | 'fraud'
  | 'package_problem'
  | 'suspicious_meeting'
  | 'disrespect'
  | 'other';

/** Routing tier: how HandtoHand handles the report. */
export type UserReportType = 'support_priority' | 'support' | 'classic';

export interface UserReportReasonDef {
  id: UserReportReason;
  label: string;
  type: UserReportType;
  /** Short effect line shown next to the motif. */
  effect: string;
}

export const USER_REPORT_REASONS: UserReportReasonDef[] = [
  {
    id: 'danger',
    label: 'Danger, menace ou comportement agressif',
    type: 'support_priority',
    effect: 'Analyse immédiate du dossier',
  },
  {
    id: 'fraud',
    label: 'Suspicion de fraude ou contournement HandtoHand',
    type: 'support',
    effect: 'Vérification de la mission',
  },
  {
    id: 'package_problem',
    label: "Problème grave avec le colis, l'objet ou la remise",
    type: 'support',
    effect: 'Intervention possible sur la co-livraison',
  },
  {
    id: 'suspicious_meeting',
    label: 'Rendez-vous suspect ou situation inhabituelle',
    type: 'support',
    effect: 'Sécurisation ou contrôle du dossier',
  },
  {
    id: 'disrespect',
    label: 'Comportement irrespectueux',
    type: 'classic',
    effect: 'Séparation des profils après mission',
  },
  {
    id: 'other',
    label: 'Autre problème',
    type: 'classic',
    effect: 'Analyse simple par HandtoHand',
  },
];

/** Lookup a motif definition by id. */
export function getUserReportReason(id: UserReportReason): UserReportReasonDef | undefined {
  return USER_REPORT_REASONS.find((r) => r.id === id);
}

/** A 'support_priority' or 'support' motif routes to HandtoHand support. */
export function isSupportReason(id: UserReportReason): boolean {
  const type = getUserReportReason(id)?.type;
  return type === 'support_priority' || type === 'support';
}

export interface UserReportPayload {
  reportedUserId: string;
  reportedUserName: string;
  reportedRole: 'seller' | 'buyer';
  missionId?: string;
  /**
   * 🔴 LA CONVERSATION D'OÙ VIENT LE SIGNALEMENT.
   *
   * Sans elle, le support reçoit « comportement agressif » sans une ligne de
   * ce qui a été écrit. `signaler_utilisateur` sait la rattacher ; il fallait
   * encore la lui donner.
   */
  conversationId?: string;
  reason: UserReportReason;
  description?: string;
  photoUris?: string[];
  /** Mandatory good-faith attestation — always true when submitted. */
  goodFaith: true;
}

export async function submitUserReport(
  payload: UserReportPayload,
): Promise<{ id: string; createdAt: string }> {
  await new Promise((r) => setTimeout(r, 1000));
  return {
    id: `ureport-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
}
