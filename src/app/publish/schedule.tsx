import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Button } from '@/components/ui/Button';
import { STEP_LABELS } from '@/types/route';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouteStore } from '@/stores/useRouteStore';
import { normaliserHeure, heureValide } from '@/utils/heureTrajet';

const DAYS = [
  { key: 1, short: 'L', label: 'Lun' },
  { key: 2, short: 'Ma', label: 'Mar' },
  { key: 3, short: 'Me', label: 'Mer' },
  { key: 4, short: 'J', label: 'Jeu' },
  { key: 5, short: 'V', label: 'Ven' },
  { key: 6, short: 'S', label: 'Sam' },
  { key: 7, short: 'D', label: 'Dim' },
];

function toleranceStr(time: string): string {
  // ⚠️ ON NE FAIT PLUS CONFIANCE AU TEXTE BRUT. Auparavant « 99:99 » donnait
  // une fenêtre « 04:29 — 04:49 » affichée avec aplomb.
  const hhmm = normaliserHeure(time);
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const totalMin = h * 60 + m;
  const from = totalMin - 10;
  const to = totalMin + 10;
  const fmt = (mins: number) => {
    const hh = Math.floor(mins / 60) % 24;
    const mm = mins % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  return `${fmt(from)} — ${fmt(to)}`;
}

export default function PublishScheduleScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { form, setFormField, setStep } = useRouteStore();

  const isRecurring = form.type === 'recurring';
  const [pickupTime, setPickupTime] = useState(form.pickupTime ?? '');
  const [deliveryTimes, setDeliveryTimes] = useState<Record<string, string>>(form.deliveryTimes);
  const [days, setDays] = useState<number[]>(form.recurringDays);

  const toggleDay = useCallback((day: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDays((prev) => prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]);
  }, []);

  const setDeliveryTime = (hubId: string, time: string) => {
    setDeliveryTimes((prev) => ({ ...prev, [hubId]: time }));
  };

  // 🔴 « LONGUEUR >= 4 » LAISSAIT PASSER « 7h30 », QUI FAISAIT PLANTER L ACCUEIL.
  const allTimesSet =
    heureValide(pickupTime) && form.deliveryHubs.every((h) => heureValide(deliveryTimes[h.hubId]));
  const daysOk = !isRecurring || days.length > 0;
  const canNext = allTimesSet && daysOk;

  const handleNext = () => {
    // ⚠️ ON ENREGISTRE LA FORME NORMALISÉE. « 7h30 » saisi devient « 07:30 »
    // stocké : tout ce qui lit `schedule.pickupTime` en aval fait `split(':')`.
    setFormField('pickupTime', normaliserHeure(pickupTime)!);
    setFormField(
      'deliveryTimes',
      Object.fromEntries(
        Object.entries(deliveryTimes).map(([id, t]) => [id, normaliserHeure(t) ?? t]),
      ),
    );
    if (isRecurring) setFormField('recurringDays', days);
    setStep(6);
    router.push('/publish/capacity');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title="Publier un trajet" showBack />
        <ProgressSteps current={5} total={8} label={STEP_LABELS[4]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Vos horaires de passage</Text>

        {/* Pickup hub time */}
        <View style={[styles.hubSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.hubLabel, { color: colors.textSecondary }]}>Hub de récupération</Text>
          <Text style={[styles.hubName, { color: colors.text }]}>{form.pickupHub?.hubName ?? '-'}</Text>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: colors.text }]}>Heure de passage</Text>
            <TextInput
              style={[styles.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
              value={pickupTime}
              onChangeText={setPickupTime}
              placeholder="07:05"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
          </View>
          {heureValide(pickupTime) && (
            <View style={[styles.toleranceBar, { backgroundColor: colors.primary + '10' }]}>
              <Text style={[styles.toleranceText, { color: colors.primary }]}>
                Fenêtre : {toleranceStr(pickupTime)}
              </Text>
            </View>
          )}
        </View>

        {/* Delivery hub times */}
        {form.deliveryHubs.map((hub) => (
          <View key={hub.hubId} style={[styles.hubSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.hubLabel, { color: colors.textSecondary }]}>Hub de remise</Text>
            <Text style={[styles.hubName, { color: colors.text }]}>{hub.hubName}</Text>
            <View style={styles.timeRow}>
              <Text style={[styles.timeLabel, { color: colors.text }]}>Heure de passage</Text>
              <TextInput
                style={[styles.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                value={deliveryTimes[hub.hubId] ?? ''}
                onChangeText={(t) => setDeliveryTime(hub.hubId, t)}
                placeholder="12:30"
                placeholderTextColor={colors.textSecondary}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
            {heureValide(deliveryTimes[hub.hubId]) && (
              <View style={[styles.toleranceBar, { backgroundColor: colors.primary + '10' }]}>
                <Text style={[styles.toleranceText, { color: colors.primary }]}>
                  Fenêtre : {toleranceStr(deliveryTimes[hub.hubId])}
                </Text>
              </View>
            )}
          </View>
        ))}

        <Text style={[styles.info, { color: colors.textSecondary }]}>
          Indiquez l'heure à laquelle vous serez réellement au hub. Pas l'heure de départ de chez vous.
        </Text>

        {/* Recurring days */}
        {isRecurring && (
          <View style={styles.daysSection}>
            <Text style={[styles.daysTitle, { color: colors.text }]}>Jours de trajet</Text>
            <View style={styles.daysRow}>
              {DAYS.map((d) => {
                const active = days.includes(d.key);
                return (
                  <TouchableOpacity
                    key={d.key}
                    onPress={() => toggleDay(d.key)}
                    style={[styles.dayChip, { backgroundColor: active ? colors.primary : 'transparent', borderColor: active ? colors.primary : colors.border }]}
                  >
                    <Text style={[styles.dayText, { color: active ? '#FFFFFF' : colors.text }]}>{d.short}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={[styles.daysHint, { color: colors.textSecondary }]}>
              Ces horaires s'appliqueront chaque jour sélectionné.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button title="Suivant" onPress={handleNext} variant="gradient" disabled={!canNext} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.lg },
  title: { ...Typography.h1 },
  hubSection: { borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm },
  hubLabel: { ...Typography.caption },
  hubName: { ...Typography.bodyMedium },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: Spacing.xs },
  timeLabel: { ...Typography.body },
  timeInput: { width: 80, borderWidth: 1.5, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, textAlign: 'center', ...Typography.bodyMedium },
  toleranceBar: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm },
  toleranceText: { ...Typography.captionMedium, textAlign: 'center' },
  info: { ...Typography.caption, textAlign: 'center', lineHeight: 18 },
  daysSection: { gap: Spacing.md },
  daysTitle: { ...Typography.h3 },
  daysRow: { flexDirection: 'row', gap: Spacing.sm },
  dayChip: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dayText: { ...Typography.captionMedium },
  daysHint: { ...Typography.caption },
  footer: { paddingHorizontal: Spacing.xxl },
});
