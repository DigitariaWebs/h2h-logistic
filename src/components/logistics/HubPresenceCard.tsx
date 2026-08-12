import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import dayjs from 'dayjs';
import { Icon } from '@/components/ui/Icon';
import { HubZoneMap } from '@/components/logistics/HubZoneMap';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useHubPresence } from '@/hooks/useHubPresence';
import { getToleranceWindow, isWithinTolerance, DEFAULT_TOLERANCE_MINUTES } from '@/utils/tolerance';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import type { Hub } from '@/types/hub';

/**
 * « Déclarer ma présence au hub » — LE MÊME BLOC QUE LA MARKETPLACE.
 *
 * Demande client du 12/08/2026 : l'écran qui s'ouvre sous « Action suivante »
 * doit être celui que le vendeur et l'acheteur voient de leur côté. Les trois
 * parties se retrouvent au même endroit, à la même minute — leur donner trois
 * mises en page différentes de la même attente n'aide personne.
 *
 * ⚠️ MÊME ORDRE, MÊME VOCABULAIRE, MÊMES GARDES que
 * `hand-to-hand/src/components/logistics/HubPresence.tsx` : titre, consigne,
 * créneau, bouton, message essentiel, plan de zone, note de confidentialité.
 *
 * ⚠️ CE N'EST PAS UN COPIER-COLLER DU CODE, et ça ne peut pas l'être : les deux
 * apps ont des socles différents (thème, i18n, et surtout la carte — la
 * marketplace a `react-native-maps`, pas cette app, qui dessine sa zone en SVG).
 * Ce qui est repris, c'est la MISE EN PAGE et les MOTS, pas les composants.
 *
 * 🟢 LE BOUTON RESTE DANS LA CARTE ICI. Côté marketplace il en est sorti le
 * même jour, parce que le bouton d'étape y portait le même libellé. Ici le
 * bouton d'étape est « Scanner le QR… » : la carte est le SEUL endroit où le
 * cotransporteur particulier peut déclarer sa présence.
 */
interface HubPresenceCardProps {
  hub: Hub;
  scheduledTime: string;
  toleranceMinutes?: number;
  /** Présence déjà enregistrée — la carte montre l'état confirmé. */
  confirmed?: boolean;
  /** Enregistre la présence. Reçoit l'horodatage ISO. */
  onConfirm: (isoTimestamp: string) => void;
}

export function HubPresenceCard({
  hub,
  scheduledTime,
  toleranceMinutes = DEFAULT_TOLERANCE_MINUTES,
  confirmed = false,
  onConfirm,
}: HubPresenceCardProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { coords, distanceMeters, inZone, loading } = useHubPresence(hub);

  const { start, end } = getToleranceWindow(scheduledTime, toleranceMinutes);
  const withinWindow = isWithinTolerance(scheduledTime, toleranceMinutes);

  // Statut du créneau, dans les mots de la marketplace : « Préparation » avant
  // l'heure, « Tolérance » après, « En retard » une fois la fenêtre passée.
  const minutesToScheduled = dayjs(scheduledTime).diff(dayjs(), 'minute', true);
  const past = minutesToScheduled < -toleranceMinutes;
  const statusLabel = past
    ? t('presence.statusLate')
    : minutesToScheduled >= 0
      ? t('presence.statusPreparation')
      : t('presence.statusTolerance');
  const statusColor = past ? colors.error : minutesToScheduled >= 0 ? colors.primary : colors.warning;

  const handleConfirm = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(new Date().toISOString());
  };

  return (
    <View style={[s.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {/* Titre — pastille + intitulé, comme la marketplace */}
      <View style={s.titleRow}>
        <View style={[s.titleIcon, { backgroundColor: colors.primary + '12' }]}>
          <Icon name="location-filled" size={18} color={colors.primary} />
        </View>
        <Text style={[s.title, { color: colors.text }]}>{t('presence.title')}</Text>
      </View>

      <Text style={[s.intro, { color: colors.textSecondary }]}>{t('presence.subText')}</Text>

      {/* Créneau + statut, sur une ligne */}
      <View style={[s.windowRow, { backgroundColor: statusColor + '10' }]}>
        <Icon name="time" size={14} color={statusColor} />
        <Text style={[s.windowText, { color: statusColor }]}>
          {start} – {end}
        </Text>
        <View style={{ flex: 1 }} />
        <View style={[s.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[s.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>

      {/* Déclaration — ou son état confirmé */}
      {confirmed ? (
        <View style={[s.confirmedBox, { backgroundColor: colors.success + '12' }]}>
          <Icon name="checkmark-circle" size={16} color={colors.success} />
          <Text style={[s.confirmedText, { color: colors.success }]}>
            {t('presence.registered')}
          </Text>
        </View>
      ) : (
        <>
          {/* ⚠️ Désactivé HORS CRÉNEAU seulement — pas hors zone. Une présence
              déclarée trop tôt n'a pas de sens ; une présence déclarée à 30 m du
              point central en a un, et le plan ci-dessous le montre déjà. */}
          <Pressable
            onPress={handleConfirm}
            disabled={!withinWindow}
            style={{ opacity: withinWindow ? 1 : 0.5 }}
            accessibilityRole="button"
            accessibilityLabel={t('presence.button')}
          >
            <LinearGradient
              colors={[colors.primary, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.primaryBtn}
            >
              <Icon name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={s.primaryBtnText}>{t('presence.button')}</Text>
            </LinearGradient>
          </Pressable>

          <View style={[s.essentialRow, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '30' }]}>
            <Icon name="alert-circle" size={14} color={colors.warning} />
            <Text style={[s.essentialText, { color: colors.text }]}>
              {t('presence.essentialMessage')}
            </Text>
          </View>

          {!withinWindow && !past && (
            <Text style={[s.hint, { color: colors.textSecondary }]}>{t('presence.earlyRecommend')}</Text>
          )}
        </>
      )}

      {/* Plan de la zone — position PROPRE uniquement. */}
      <HubZoneMap hub={hub} userCoords={coords} inZone={inZone} />

      {/* Distance, quand elle est connue et qu'on n'est pas dans la zone. */}
      {!loading && !inZone && distanceMeters != null && (
        <View style={[s.distanceRow, { backgroundColor: colors.warning + '12' }]}>
          <Icon name="location-filled" size={14} color={colors.warning} />
          <Text style={[s.distanceText, { color: colors.warning }]}>
            {t('presence.distanceAway').replace('{distance}', String(Math.round(distanceMeters)))}
          </Text>
        </View>
      )}

      <View style={s.confidentialityRow}>
        <Icon name="lock" size={13} color={colors.textSecondary} />
        <Text style={[s.confidentialityText, { color: colors.textSecondary }]}>
          {t('presence.confidentiality')}
        </Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  titleIcon: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...Typography.bodyMedium, fontFamily: 'Poppins_600SemiBold', flex: 1 },
  intro: { ...Typography.caption },

  windowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  windowText: { ...Typography.captionMedium, fontFamily: 'Poppins_600SemiBold' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { ...Typography.captionMedium },

  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.md,
  },
  primaryBtnText: { ...Typography.button, color: '#FFFFFF' },

  essentialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
  },
  essentialText: { ...Typography.caption, flex: 1, fontFamily: 'Poppins_500Medium' },

  hint: { ...Typography.caption },

  confirmedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  confirmedText: { ...Typography.bodyMedium, fontFamily: 'Poppins_600SemiBold' },

  distanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  distanceText: { ...Typography.captionMedium },

  confidentialityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  confidentialityText: { ...Typography.caption, fontSize: 11, flex: 1 },
});
