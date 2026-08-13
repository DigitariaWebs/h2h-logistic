import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import type { Mission, MissionStatus } from '@/types/mission';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { ToleranceWindow } from '@/components/logistics/ToleranceWindow';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { formatTime } from '@/utils/formatting';
import { distanceBetween } from '@/utils/navigationHelpers';
import { formatRouteDistance } from '@/services/routing';

interface MissionTimelineProps {
  mission: Mission;
  onPickup?: () => void;
  onDelivery?: () => void;
  onNavigate?: () => void;
}

interface StepConfig {
  status: MissionStatus;
  iconName: IconName;
  label: string;
  getDesc: (m: Mission) => string;
  showTolerance?: 'pickup' | 'delivery';
  action?: { label: string; key: 'pickup' | 'delivery' };
  showNav?: boolean;
}

const STEPS: StepConfig[] = [
  {
    status: 'accepted',
    iconName: 'checkmark-circle',
    label: 'Co-livraison acceptée',
    getDesc: () => 'Vous avez accepté cette co-livraison',
  },
  {
    status: 'group_created',
    iconName: 'checkmark-circle',
    label: 'Vendeur confirmé',
    getDesc: (m) => `${m.seller.name} a confirmé la remise`,
  },
  {
    status: 'pickup_pending',
    iconName: 'location-filled',
    label: 'Récupération au hub vendeur',
    getDesc: (m) => m.pickupHub.name,
    showTolerance: 'pickup',
    // 🔴 LIBELLÉ CORRIGÉ LE 12/08/2026. Il disait « Scanner le QR du vendeur »
    // et sautait, de fait, à la caméra : depuis que la déclaration de présence
    // est la PREMIÈRE page du parcours, ce bouton ouvre cette page-là, pas le
    // scanner. Un bouton qui nomme une étape qu'il ne montre pas fait douter
    // de l'écran qui s'ouvre à la place.
    // ⚠️ MÊMES MOTS QUE LE BANDEAU « ACTION SUIVANTE » (`DirectionHubButton`) :
    // deux entrées vers le même endroit doivent se lire pareil, sinon on croit
    // à deux destinations.
    action: { label: 'Valider la récupération', key: 'pickup' },
    showNav: true,
  },
  {
    status: 'picked_up',
    iconName: 'package',
    label: 'Colis en trajet',
    getDesc: (m) => `En route vers ${m.deliveryHub.name}`,
  },
  {
    status: 'in_transit',
    iconName: 'rocket',
    label: 'En trajet',
    getDesc: (m) => `Direction ${m.deliveryHub.city}`,
    showNav: true,
  },
  {
    status: 'delivery_pending',
    iconName: 'location-filled',
    label: 'Remise au hub destinataire',
    getDesc: (m) => m.deliveryHub.name,
    showTolerance: 'delivery',
    // 🔴 MÊME CORRECTION QUE CÔTÉ RÉCUPÉRATION (12/08/2026). Il disait « Entrer
    // le code acheteur » et ouvre en fait la page d'approche : un bouton qui
    // nomme une étape qu'il ne montre pas fait douter de l'écran qui s'ouvre.
    // Mêmes mots que le bandeau « ACTION SUIVANTE ».
    action: { label: 'Valider la remise', key: 'delivery' },
    showNav: true,
  },
  {
    status: 'delivered',
    iconName: 'trophy',
    label: 'Co-livraison terminée',
    getDesc: (m) => `Paiement libéré : ${m.transporterEarning.toFixed(2)}€`,
  },
];

const STATUS_ORDER: MissionStatus[] = [
  'accepted', 'group_created', 'pickup_pending', 'picked_up', 'in_transit', 'delivery_pending', 'delivered',
];

export function MissionTimeline({ mission, onPickup, onDelivery, onNavigate }: MissionTimelineProps) {
  const { colors } = useColorScheme();
  const currentIdx = STATUS_ORDER.indexOf(mission.status);

  // GPS proximity
  const [proximity, setProximity] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });

        // Determine target hub
        const targetHub = ['pickup_pending', 'group_created'].includes(mission.status)
          ? mission.pickupHub
          : mission.deliveryHub;

        // We need lat/lng — use city-level mock coords since MissionHub doesn't have them
        // In production this would use the hub's real coordinates
        // For now just show a mock distance
        if (mounted) setProximity(230); // Mock: 230m
      } catch {}
    })();
    return () => { mounted = false; };
  }, [mission.status]);

  return (
    <View style={styles.container}>
      {STEPS.map((step, index) => {
        const stepIdx = STATUS_ORDER.indexOf(step.status);
        const isCompleted = stepIdx < currentIdx;
        const isCurrent = stepIdx === currentIdx;
        const isPending = stepIdx > currentIdx;
        const isLast = index === STEPS.length - 1;

        return (
          <View key={step.status} style={styles.step}>
            {/* Dot column */}
            <View style={styles.dotCol}>
              {isCurrent ? (
                <PulsingDot color={colors.primary} />
              ) : (
                <View
                  style={[
                    styles.dot,
                    isCompleted
                      ? { backgroundColor: colors.success }
                      : { backgroundColor: colors.border },
                  ]}
                >
                  {isCompleted && <Text style={styles.dotCheck}>✓</Text>}
                </View>
              )}
              {!isLast && (
                <View
                  style={[
                    styles.line,
                    {
                      backgroundColor: isCompleted
                        ? colors.success
                        : isPending
                          ? colors.border + '60'
                          : colors.border,
                      width: 2,
                    },
                  ]}
                />
              )}
            </View>

            {/* Content */}
            <View style={[styles.content, isCurrent && styles.contentExpanded]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {isCompleted && <Icon name="checkmark-circle" size={14} color={colors.success} />}
                {isPending && <Icon name="hourglass" size={14} color={colors.textSecondary} />}
                <Text style={[
                  styles.label,
                  { color: isCompleted ? colors.text : isCurrent ? colors.text : colors.textSecondary },
                  isCurrent && styles.labelCurrent,
                ]}>
                  {step.label}
                </Text>
              </View>

              {/* Description (show for current + completed) */}
              {(isCurrent || isCompleted) && (
                <Text style={[styles.desc, { color: colors.textSecondary }]}>
                  {step.getDesc(mission)}
                </Text>
              )}

              {/* Timestamps for completed */}
              {isCompleted && step.status === 'picked_up' && mission.pickupHub.actualTime && (
                <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                  {formatTime(mission.pickupHub.actualTime)}
                </Text>
              )}
              {isCompleted && step.status === 'delivered' && mission.deliveryHub.actualTime && (
                <Text style={[styles.timestamp, { color: colors.textSecondary }]}>
                  {formatTime(mission.deliveryHub.actualTime)}
                </Text>
              )}

              {/* Tolerance window (only on current step) */}
              {isCurrent && step.showTolerance === 'pickup' && (
                <View style={styles.toleranceWrap}>
                  <ToleranceWindow
                    scheduledTime={mission.pickupHub.scheduledTime}
                    toleranceMinutes={mission.pickupHub.toleranceMinutes}
                    size="compact"
                  />
                </View>
              )}
              {isCurrent && step.showTolerance === 'delivery' && (
                <View style={styles.toleranceWrap}>
                  <ToleranceWindow
                    scheduledTime={mission.deliveryHub.scheduledTime}
                    toleranceMinutes={mission.deliveryHub.toleranceMinutes}
                    size="compact"
                  />
                </View>
              )}

              {/* GPS proximity indicator (current step only) */}
              {isCurrent && step.showNav && proximity != null && (
                <View style={[styles.proximityRow, { backgroundColor: colors.primary + '08' }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Icon name="location-filled" size={14} color={colors.primary} />
                    <Text style={[styles.proximityText, { color: colors.primary }]}>
                      Vous êtes à {formatRouteDistance(proximity)} du hub
                    </Text>
                  </View>
                </View>
              )}

              {/* Action buttons (only on current step) */}
              {isCurrent && (step.action || (step.showNav && onNavigate)) && (
                <View style={styles.actionWrap}>
                  {step.action && (
                    <Button
                      title={step.action.label}
                      onPress={step.action.key === 'pickup' ? onPickup ?? (() => {}) : onDelivery ?? (() => {})}
                      variant="gradient"
                      fullWidth={false}
                      style={styles.actionBtn}
                    />
                  )}
                  {step.showNav && onNavigate && (
                    <Button
                      title="Naviguer vers le hub"
                      onPress={onNavigate}
                      variant="outline"
                      fullWidth={false}
                      style={styles.navBtn}
                    />
                  )}
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function PulsingDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 700 }),
        withTiming(1, { duration: 700 }),
      ),
      -1,
      false,
    );
  }, []);
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: 0.3,
  }));
  return (
    <View style={styles.pulseWrap}>
      <Animated.View style={[styles.pulseRing, { backgroundColor: color }, pulseStyle]} />
      <View style={[styles.dot, { backgroundColor: color }]} />
    </View>
  );
}

const DOT_SIZE = 14;

const styles = StyleSheet.create({
  container: {
    paddingLeft: Spacing.xs,
  },
  step: {
    flexDirection: 'row',
    minHeight: 44,
  },
  dotCol: {
    alignItems: 'center',
    width: 28,
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotCheck: {
    color: '#FFFFFF',
    fontSize: 8,
    fontWeight: '700',
  },
  pulseWrap: {
    width: DOT_SIZE + 8,
    height: DOT_SIZE + 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: DOT_SIZE + 8,
    height: DOT_SIZE + 8,
    borderRadius: (DOT_SIZE + 8) / 2,
  },
  line: {
    flex: 1,
    marginVertical: 2,
    minHeight: 16,
  },
  content: {
    flex: 1,
    paddingLeft: Spacing.md,
    paddingBottom: Spacing.md,
  },
  contentExpanded: {
    paddingBottom: Spacing.lg,
  },
  label: {
    ...Typography.bodyMedium,
  },
  labelCurrent: {
    fontFamily: 'Poppins_600SemiBold',
  },
  desc: {
    ...Typography.caption,
    marginTop: 2,
    lineHeight: 18,
  },
  timestamp: {
    ...Typography.caption,
    marginTop: 2,
  },
  toleranceWrap: {
    marginTop: Spacing.sm,
  },
  proximityRow: {
    marginTop: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  proximityText: {
    ...Typography.captionMedium,
  },
  actionWrap: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  navBtn: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
  },
});
