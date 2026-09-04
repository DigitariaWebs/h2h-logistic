// ⚠️ CE QUE L'ÉCRAN PROPOSE EST UN SOUS-ENSEMBLE DE CE QUE LA BASE ACCEPTE.
// `hub_report_reason` porte encore `partner_uncooperative`, retiré de l'écran
// le 04/09/2026, et il DOIT y rester : un signalement l'utilise déjà. Une
// valeur d'énumération PostgreSQL ne se supprime pas sans recréer le type, et
// le faire rendrait cette ligne illisible pour le support.
export type HubReportReason =
  | 'closed'
  | 'wrong_address'
  | 'saturated'
  | 'security'
  | 'other';

export const HUB_REPORT_REASONS: { id: HubReportReason; label: string }[] = [
  { id: 'closed', label: "Hub fermé à l'horaire indiqué" },
  { id: 'wrong_address', label: 'Adresse incorrecte ou introuvable' },
  { id: 'saturated', label: 'Hub saturé / pas de place' },
  { id: 'security', label: 'Problème de sécurité' },
  { id: 'other', label: 'Autre' },
];

export interface HubReportPayload {
  hubId: string;
  /**
   * La co-livraison qui a amene le signalant la, quand il y en a une.
   *
   * ⚠️ CONTEXTE, PAS IDENTITE : le support veut savoir quel rendez-vous a
   * echoue, pas seulement que le hub etait ferme un jour.
   */
  missionId?: string;
  hubName: string;
  reason: HubReportReason;
  notes?: string;
  photoUris?: string[];
}

export async function submitHubReport(payload: HubReportPayload): Promise<{ id: string; createdAt: string }> {
  await new Promise((r) => setTimeout(r, 1000));
  return {
    id: `report-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
}
