import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { constaterAbsence, televerserPhotoDeGarde } from '@/services/scans';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import dayjs from 'dayjs';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { CommonFormFields, type CommonExtras } from '@/components/incident/CommonFormFields';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMissionStore } from '@/stores/useMissionStore';
import { useIncidentsStore } from '@/stores/useIncidentsStore';
import { canCancelFree, contestationDeadline, DELAYS } from '@/constants/delaysRules';
import { computeSettlement } from '@/utils/settlement';
import { getIncidentFormSpec, roleFromAnswer, type SpecField } from '@/services/mock/incidentFormSpecs';
import { SETTLEMENT_PARTY_LABELS } from '@/types/settlement';
import type { CommonFormData, MissionFormStatus } from '@/types/incident';
import type { Mission } from '@/types/mission';

/** Incident types that apply a mission outcome on submit. */
const OUTCOME_TYPES = [
  'buyer_absent', 'transporter_absent', 'seller_absent', 'hub_blocked',
  'collect_absent', 'refuse_package', 'cancel_seller', 'cancel_buyer', 'cancel_transporter',
];

function computeStatus(m?: Mission): MissionFormStatus {
  if (!m) return 'pending';
  if (m.supportHold) return 'support_review';
  if (['cancelled', 'delivered', 'completed'].includes(m.status)) return 'closed';
  return 'pending';
}

export default function IncidentFormScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ type: string; missionId?: string }>();
  const spec = getIncidentFormSpec(params.type ?? '');
  const mission = useMissionStore((s) => s.missions.find((m) => m.id === (params.missionId ?? '')));
  const applyIncidentOutcome = useMissionStore((s) => s.applyIncidentOutcome);
  const { submitIncident, getIncidentsForMission, isSubmitting } = useIncidentsStore();

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [fieldPhotos, setFieldPhotos] = useState<Record<string, string>>({});
  const [extras, setExtras] = useState<CommonExtras>({ accuracyConfirmed: false });
  const [toast, setToast] = useState<string | null>(null);

  if (!spec) {
    return (
      <SafeAreaWrapper>
        <Header title="Formulaire" showBack />
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Formulaire introuvable</Text>
      </SafeAreaWrapper>
    );
  }

  const technicalId = mission?.id ?? params.missionId ?? '';
  const setAnswer = (id: string, v: string) => setAnswers((a) => ({ ...a, [id]: v }));

  const addFieldPhoto = async (fieldId: string) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Accès aux photos', "Autorisez l'accès aux photos pour joindre une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      Haptics.selectionAsync();
      setFieldPhotos((p) => ({ ...p, [fieldId]: result.assets[0].uri }));
    }
  };
  const removeFieldPhoto = (fieldId: string) =>
    setFieldPhotos((p) => {
      const next = { ...p };
      delete next[fieldId];
      return next;
    });

  // Auto-fill (§ Formulaire commun)
  const hub = spec.hub === 'delivery' ? mission?.deliveryHub : mission?.pickupHub;
  const declarantRole = (spec.roleFieldId && roleFromAnswer(answers[spec.roleFieldId])) || spec.role;
  const info: CommonFormData = {
    transactionId: mission ? `TX-${mission.id.slice(-6).toUpperCase()}` : '—',
    missionId: mission ? `HTH-${mission.id.slice(-4).toUpperCase()}` : (params.missionId ?? '—'),
    declarantRole,
    hubName: hub?.name ?? '—',
    rendezvousAt: hub?.scheduledTime ?? new Date().toISOString(),
    declaredAt: new Date().toISOString(),
    missionStatus: computeStatus(mission),
    accuracyConfirmed: extras.accuracyConfirmed,
  };

  // Contestation gating — D1/D2/D3 (prior declaration) or D4 (support decision).
  let contestDeadline: string | undefined;
  if (spec.contestsType) {
    const priorDecl = getIncidentsForMission(technicalId).find((i) => i.type === spec.contestsType);
    contestDeadline = priorDecl?.contestationDeadline;
  } else if (spec.contestsDecision && mission?.supportResolvedAt) {
    contestDeadline = contestationDeadline(mission.supportResolvedAt);
  }
  const windowClosed =
    (!!spec.contestsType || !!spec.contestsDecision) && !!contestDeadline && dayjs().isAfter(contestDeadline);

  // D8 — voluntary cancellation locked once the mission is engaged (colis remis).
  const ENGAGED_STATUSES = ['picked_up', 'in_transit', 'deposited', 'delivery_pending'];
  const engagedLocked = !!spec.cancellation && !!mission && ENGAGED_STATUSES.includes(mission.status);

  // F11 — only during the collect window. Past scheduled + tolerance without a
  // finalized pickup, the form is unavailable and the flow switches to F13.
  const pickupFinalized = !!mission && [...ENGAGED_STATUSES, 'delivered', 'completed'].includes(mission.status);
  const collectExpired =
    !!spec.collectWindowOnly && !!mission && !pickupFinalized &&
    dayjs().isAfter(dayjs(mission.pickupHub.scheduledTime).add(DELAYS.toleranceMinutes, 'minute'));
  const openF13 = () =>
    router.replace({ pathname: '/incident/[type]' as any, params: { type: 'collect_absent', missionId: technicalId } });

  const primaryVal = spec.primaryChoiceFieldId ? answers[spec.primaryChoiceFieldId] : undefined;
  const isWait = spec.waitValue !== undefined && primaryVal === spec.waitValue;
  const requiredAnswered = spec.fields.filter((f) => f.required).every((f) => !!answers[f.id]);
  const canSubmit = !isWait && !windowClosed && !engagedLocked && !collectExpired && extras.accuracyConfirmed && requiredAnswered && !isSubmitting;

  // D7 — pick the annulation text based on the >1h / <1h délai.
  const lateCancel = !canCancelFree(info.rendezvousAt, declarantRole);
  let preValidationText = spec.preValidation;
  if (spec.preValidationVariants) {
    preValidationText = lateCancel ? spec.preValidationVariants.lessThan1h : spec.preValidationVariants.moreThan1h;
  }

  // § Principe financier — computed settlement preview for this case.
  const settlement = computeSettlement(spec.type, { late: lateCancel });

  const handleSubmit = async () => {
    if (!canSubmit) return;

    // 🔴 UN SEUL DE CES DOUZE FORMULAIRES ATTEINT LA BASE AUJOURD'HUI, et c'est
    // dit ici plutôt que caché : `constater_absence` existe, testée, accordée —
    // et personne ne l'appelait. Les onze autres restent locaux ; le protocole
    // d'incidents complet est hors périmètre de cette tranche.
    //
    // 🔴 LA PHOTO EST OBLIGATOIRE, ET C'EST LE SERVEUR QUI L'EXIGE : un constat
    // sans preuve ferait facturer l'acheteur sur la seule parole du
    // cotransporteur particulier.
    if (spec.type === 'buyer_absent' && mission?.shipmentId) {
      const preuve = Object.values(fieldPhotos)[0] ?? extras.photoLieu;
      if (!preuve) {
        setToast("Une photo du lieu est requise pour constater l'absence.");
        return;
      }
      try {
        const chemin = await televerserPhotoDeGarde(mission.shipmentId, preuve, 'absence');
        await constaterAbsence(mission.shipmentId, chemin);
      } catch (e) {
        // ⚠️ ON N'ENVOIE PAS LE FORMULAIRE SI LE CONSTAT ÉCHOUE. Le refus du
        // serveur est une règle — « cette expedition a deja ete remise »,
        // « seul le cotransporteur particulier assigne constate l absence » —
        // et un formulaire local qui part quand même ferait croire au
        // cotransporteur que l'absence est enregistrée.
        setToast(e instanceof Error ? e.message : "Constat d'absence impossible.");
        return;
      }
    }

    await submitIncident({
      type: spec.type,
      transactionId: info.transactionId,
      missionId: technicalId,
      declarantRole,
      hubName: info.hubName,
      rendezvousAt: info.rendezvousAt,
      declaredAt: info.declaredAt,
      missionStatus: info.missionStatus,
      accuracyConfirmed: true,
      comment: extras.comment,
      photoLieu: extras.photoLieu,
      captureStatut: extras.captureStatut,
      photoColis: extras.photoColis,
      geo: extras.geo,
      reason: spec.reasonFieldId ? answers[spec.reasonFieldId] : undefined,
      answers,
      proofUris: Object.values(fieldPhotos),
    });
    // Apply the mission outcome (money + disposition) for outcome-bearing forms.
    if (OUTCOME_TYPES.includes(spec.type) && !isWait && technicalId) {
      applyIncidentOutcome(technicalId, spec.type);
    }
    setToast('Formulaire envoyé.');
    setTimeout(() => router.back(), 1600);
  };

  return (
    <SafeAreaWrapper>
      <Header title={spec.title} showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <Text style={[styles.message, { color: colors.text }]}>{spec.message}</Text>

        {/* Delays live in the separate « Règles de délais » screen — forms only reference. */}
        {spec.delayRuleId && (
          <Pressable
            onPress={() => router.push('/delays-rules' as any)}
            accessibilityRole="link"
            accessibilityLabel="Voir les règles de délais et d'intervention"
            style={({ pressed }) => [styles.ruleNote, { backgroundColor: colors.primary + '0A', borderColor: colors.primary + '30', opacity: pressed ? 0.85 : 1 }]}
          >
            <Icon name="time" size={14} color={colors.primary} />
            <Text style={[styles.ruleNoteText, { color: colors.textSecondary }]}>
              {"Délais applicables — voir les Règles de délais et d'intervention"}
            </Text>
            <Icon name="chevron-right" size={14} color={colors.textSecondary} />
          </Pressable>
        )}

        {/* D8 — engaged phase lock (voluntary cancellation disabled) */}
        {engagedLocked && (
          <View style={[styles.ruleNote, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
            <Icon name="shield" size={14} color={colors.error} />
            <Text style={[styles.ruleNoteText, { color: colors.error }]}>
              {"Phase engagée — plus d'annulation volontaire ; les incidents sont traités selon le protocole."}
            </Text>
          </View>
        )}

        {/* Contestation window closed */}
        {windowClosed && (
          <View style={[styles.ruleNote, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
            <Icon name="alert-circle" size={14} color={colors.error} />
            <Text style={[styles.ruleNoteText, { color: colors.error }]}>
              {`Le délai de contestation (règle ${spec.delayRuleId}) est dépassé. Aucune réclamation n'est possible.`}
            </Text>
          </View>
        )}

        {/* F11 — collect window expired: form unavailable, switch to F13 */}
        {collectExpired && (
          <View style={[styles.expiredCard, { backgroundColor: colors.error + '10', borderColor: colors.error + '30' }]}>
            <View style={styles.expiredRow}>
              <Icon name="alert-circle" size={14} color={colors.error} />
              <Text style={[styles.ruleNoteText, { color: colors.error }]}>
                {"Le créneau de collecte et la tolérance sont dépassés. Ce formulaire n'est plus disponible ; la procédure d'absence ou de blocage est lancée."}
              </Text>
            </View>
            <Button title="Ouvrir le formulaire de blocage" onPress={openF13} variant="gradient" />
          </View>
        )}

        {/* Specific fields */}
        {!collectExpired && spec.fields.map((field) => (
          <FieldRenderer
            key={field.id}
            field={field}
            value={answers[field.id]}
            onSelect={(v) => setAnswer(field.id, v)}
            photoUri={fieldPhotos[field.id]}
            onAddPhoto={() => addFieldPhoto(field.id)}
            onRemovePhoto={() => removeFieldPhoto(field.id)}
            colors={colors}
          />
        ))}

        {/* Common auto-fill + attestation + optional proofs */}
        {!collectExpired && (
          <CommonFormFields
            info={info}
            value={extras}
            onChange={setExtras}
            showGeo={!spec.cancellation}
            showProofs={!spec.cancellation}
          />
        )}

        {/* Settlement preview (§ Principe financier) */}
        {settlement && !isWait && !collectExpired && (
          <View style={[styles.settlement, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.settlementTitle, { color: colors.text }]}>{settlement.title}</Text>
            {settlement.lines.map((line, i) => {
              const positive = line.kind === 'refund' || line.kind === 'pay';
              const amountColor = line.kind === 'unpaid' || line.kind === 'fee' ? colors.error : positive ? colors.success : colors.textSecondary;
              return (
                <View key={i} style={styles.settlementRow}>
                  <Text style={[styles.settlementParty, { color: colors.textSecondary }]}>{SETTLEMENT_PARTY_LABELS[line.party]}</Text>
                  <Text style={[styles.settlementLabel, { color: colors.text }]}>{line.label}</Text>
                  {line.amountEur != null && (
                    <Text style={[styles.settlementAmount, { color: amountColor }]}>{line.amountEur} €</Text>
                  )}
                </View>
              );
            })}
            {settlement.note && <Text style={[styles.settlementNote, { color: colors.textSecondary }]}>{settlement.note}</Text>}
          </View>
        )}

        {/* Pre-validation text (variant-aware; hidden in « continuer d'attendre » mode) */}
        {preValidationText && !isWait && !collectExpired && (
          <View style={[styles.preValidation, { backgroundColor: colors.warning + '10', borderColor: colors.warning + '30' }]}>
            <Text style={[styles.preValidationText, { color: colors.textSecondary }]}>{preValidationText}</Text>
          </View>
        )}
      </ScrollView>

      {!collectExpired && (
        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          {isWait ? (
            <Button title="Continuer d'attendre" onPress={() => router.back()} variant="outline" />
          ) : (
            <Button
              title={spec.submitLabel}
              onPress={handleSubmit}
              variant={spec.danger ? 'danger' : 'gradient'}
              loading={isSubmitting}
              disabled={!canSubmit}
            />
          )}
        </View>
      )}

      {toast && <Toast message={toast} type="success" visible onHide={() => setToast(null)} duration={2500} />}
    </SafeAreaWrapper>
  );
}

function FieldRenderer({
  field,
  value,
  onSelect,
  photoUri,
  onAddPhoto,
  onRemovePhoto,
  colors,
}: {
  field: SpecField;
  value?: string;
  onSelect: (v: string) => void;
  photoUri?: string;
  onAddPhoto?: () => void;
  onRemovePhoto?: () => void;
  colors: any;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.text }]}>
        {field.label}
        {field.required ? <Text style={{ color: colors.error }}> *</Text> : null}
      </Text>

      {field.type === 'radio' && (
        <View style={styles.radioList}>
          {(field.options ?? []).map((opt) => {
            const selected = value === opt;
            return (
              <Pressable
                key={opt}
                onPress={() => onSelect(opt)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={({ pressed }) => [
                  styles.radioRow,
                  { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + '08' : colors.surface, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.border }]}>
                  {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                </View>
                <Text style={[styles.radioLabel, { color: colors.text }]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {(field.type === 'text' || field.type === 'textarea') && (
        <TextInput
          value={value ?? ''}
          onChangeText={onSelect}
          placeholder={field.placeholder ?? ''}
          placeholderTextColor={colors.textSecondary}
          multiline={field.type === 'textarea'}
          style={[
            field.type === 'textarea' ? styles.textArea : styles.textInput,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityLabel={field.label}
        />
      )}

      {field.type === 'photo' && (
        photoUri ? (
          <View style={[styles.photo, { borderColor: colors.border }]}>
            <Image source={{ uri: photoUri }} style={styles.photoImg} contentFit="cover" />
            <Pressable onPress={onRemovePhoto} style={[styles.photoRemove, { backgroundColor: colors.surface }]} hitSlop={6} accessibilityLabel="Retirer cette photo">
              <Icon name="close" size={14} color={colors.text} />
            </Pressable>
          </View>
        ) : (
          <Pressable onPress={onAddPhoto} style={[styles.photoAdd, { borderColor: colors.border, backgroundColor: colors.surface }]} accessibilityRole="button" accessibilityLabel={field.label}>
            <Icon name="camera" size={22} color={colors.textSecondary} />
            <Text style={[styles.photoAddLabel, { color: colors.textSecondary }]}>Ajouter</Text>
          </Pressable>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: Spacing.lg, gap: Spacing.lg, paddingBottom: Spacing.section },
  notFound: { ...Typography.body, textAlign: 'center', marginTop: Spacing.section },
  message: { ...Typography.body, lineHeight: 22 },

  ruleNote: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  ruleNoteText: { ...Typography.caption, lineHeight: 18, flex: 1 },
  expiredCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.md },
  expiredRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },

  field: { gap: Spacing.sm },
  fieldLabel: { ...Typography.bodyMedium },
  radioList: { gap: Spacing.sm },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioLabel: { ...Typography.body, flex: 1 },

  textInput: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, ...Typography.body },
  textArea: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, minHeight: 90, textAlignVertical: 'top', ...Typography.body },

  photo: { width: 96, height: 96, borderRadius: BorderRadius.md, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  photoImg: { width: '100%', height: '100%' },
  photoRemove: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  photoAdd: { width: 96, height: 96, borderRadius: BorderRadius.md, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', gap: 2 },
  photoAddLabel: { ...Typography.caption, fontSize: 11 },

  preValidation: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  preValidationText: { ...Typography.caption, lineHeight: 18 },

  settlement: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm },
  settlementTitle: { ...Typography.bodyMedium },
  settlementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  settlementParty: { ...Typography.caption, width: 92 },
  settlementLabel: { ...Typography.caption, flex: 1, lineHeight: 18 },
  settlementAmount: { ...Typography.captionMedium },
  settlementNote: { ...Typography.caption, fontStyle: 'italic', lineHeight: 18, marginTop: 2 },

  footer: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: 0.5 },
});
