import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { ToleranceWindow } from '@/components/logistics/ToleranceWindow';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { normaliserHeure } from '@/utils/heureTrajet';
import type { PublishedRoute } from '@/types/route';

interface DailyConfirmationProps {
  route: PublishedRoute;
  onConfirm: () => void;
  onSkip: () => void;
}

export function DailyConfirmation({ route, onConfirm, onSkip }: DailyConfirmationProps) {
  const { colors } = useColorScheme();

  // Build a scheduled time for today using the pickup time
  //
  // 🔴 CETTE LIGNE JETAIT. `'7h30'.split(':')` vaut `['7h30']` : `hours` NaN,
  // `mins` undefined, la date devient invalide et `toISOString()` lève un
  // RangeError — la carte « Trajet du jour » ne s'affichait pas, elle plantait.
  //
  // ⚠️ LA SAISIE EST DÉSORMAIS VALIDÉE EN AMONT, ET ON SE PROTÈGE QUAND MÊME :
  // les trajets déjà publiés portent l'ancienne saisie, et rien ne les a
  // réécrits. Un écran d'accueil ne doit pas tomber sur une ligne d'historique.
  const hhmm = normaliserHeure(route.schedule.pickupTime) ?? '07:00';
  const [hours, mins] = hhmm.split(':').map(Number);
  const today = new Date();
  today.setHours(hours, mins, 0, 0);
  const scheduledTime = today.toISOString();

  return (
    <Card style={{ borderColor: colors.primary + '30', borderWidth: 1.5 }}>
      <View style={s.header}>
        <Icon name="tab-routes" size={18} color={colors.primary} />
        <View style={s.headerText}>
          <Text style={[s.headerTitle, { color: colors.text }]}>Trajet du jour</Text>
          <Text style={[s.headerCaption, { color: colors.textSecondary }]}>
            Trajet personnel déclaré
          </Text>
        </View>
      </View>

      <View style={s.routeRow}>
        <Text style={[s.routeCities, { color: colors.text }]}>
          {route.departureCity} → {route.arrivalCity}
        </Text>
      </View>

      <View style={s.timeRow}>
        <Text style={[s.timeLabel, { color: colors.textSecondary }]}>Départ prévu</Text>
        <Text style={[s.timeValue, { color: colors.primary }]}>{route.schedule.pickupTime}</Text>
      </View>

      <ToleranceWindow scheduledTime={scheduledTime} toleranceMinutes={10} size="compact" />

      <View style={s.actions}>
        <Button
          title="Confirmer le trajet"
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onConfirm();
          }}
          variant="gradient"
        />
        <TouchableOpacity onPress={onSkip} hitSlop={12} style={s.skipBtn}>
          <Text style={[s.skipText, { color: colors.textSecondary }]}>Pas aujourd'hui</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.md },
  headerIcon: { fontSize: 18 },
  headerText: { gap: 1 },
  headerTitle: { ...Typography.h3 },
  headerCaption: { ...Typography.caption },
  routeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  routeCities: { ...Typography.bodyMedium },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  timeLabel: { ...Typography.caption },
  timeValue: { fontFamily: 'Poppins_600SemiBold', fontSize: 16 },
  actions: { gap: Spacing.md, marginTop: Spacing.md, alignItems: 'center' },
  skipBtn: { paddingVertical: Spacing.sm },
  skipText: { ...Typography.captionMedium, textDecorationLine: 'underline' },
});
