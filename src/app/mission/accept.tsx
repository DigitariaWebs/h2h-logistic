import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMissionStore } from '@/stores/useMissionStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { EcoImpactCard } from '@/components/mission/EcoImpactCard';
import { StarsAnimation } from '@/components/mission/StarsAnimation';
import { calculateCo2Saved, estimateDistanceKm } from '@/utils/carbon';
import { formatCurrency, formatTime, formatDate } from '@/utils/formatting';

export default function AcceptMissionScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { getMissionById, acceptMission, rejectMission, isLoading } = useMissionStore();
  const { routes } = useRouteStore();

  const mission = getMissionById(id ?? '');

  if (!mission) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={{ paddingHorizontal: Spacing.lg }}><Header title="Co-livraison" showBack /></View>
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Co-livraison introuvable</Text>
      </View>
    );
  }

  const isFavorite = mission.buyer.isFavorite;
  const platformFee = Math.round((mission.price - mission.transporterEarning) * 100) / 100;

  // 🔴 LE SERVEUR REFUSE PLUS DE CAS QUE CET ÉCRAN N'EN PRÉVOIT : proposition
  // adressée à quelqu'un d'autre, délai de quinze minutes passé, colis déjà
  // pris par un autre cotransporteur, trajet complet ou mis en pause, rôle
  // suspendu depuis l'envoi. On MONTRE le message : sans cela, l'appui reste
  // sans effet visible et on recommence indéfiniment.
  const handleAccept = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      await acceptMission(mission.id);
    } catch (e) {
      Alert.alert(
        'Co-livraison non prise',
        e instanceof Error ? e.message : 'Acceptation impossible',
      );
      return;
    }
    router.replace(`/mission/${mission.id}`);
  };

  // ⚠️ REFUSER N'ANNULE RIEN POUR L'ACHETEUR : le colis repart vers un autre
  // cotransporteur particulier, et le refus est mémorisé pour que la
  // proposition suivante n'aille pas au même.
  const handleReject = async () => {
    try {
      await rejectMission(mission.id);
    } catch (e) {
      Alert.alert('Refus impossible', e instanceof Error ? e.message : 'Refus impossible');
      return;
    }
    router.back();
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title="Nouvelle co-livraison" showBack />
      </View>

      <LinearGradient
        colors={[colors.gold, colors.goldLight]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.goldBanner}
      >
        <StarsAnimation />
        <Text style={styles.goldBannerText}>Nouvelle co-livraison</Text>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Package section */}
        <Card>
          <View style={styles.packageRow}>
            <View style={[styles.packageThumb, { backgroundColor: colors.primary + '10' }]}>
              <Icon name="package" size={28} color={colors.primary} />
            </View>
            <View style={styles.packageInfo}>
              <Text style={[styles.packageTitle, { color: colors.text }]} numberOfLines={1}>
                {mission.package.description}
              </Text>
              {mission.package.condition && (
                <Text style={[styles.packageCondition, { color: colors.textSecondary }]}>
                  {mission.package.condition}
                </Text>
              )}
              <View style={styles.packageBadges}>
                <Badge label={`Taille ${mission.package.size}`} variant="outline" />
                <Badge label={`${mission.package.weight} kg`} variant="outline" />
              </View>
            </View>
          </View>

          {/* Buyer info */}
          <View style={[styles.buyerRow, { borderTopColor: colors.border }]}>
            <View style={[styles.buyerAvatar, { backgroundColor: colors.accent + '30' }]}>
              <Text style={styles.buyerInitial}>{mission.buyer.name[0]}</Text>
            </View>
            <View style={styles.buyerInfo}>
              <Text style={[styles.buyerName, { color: colors.text }]}>{mission.buyer.name}</Text>
              <Text style={[styles.buyerRating, { color: colors.textSecondary }]}>
                ★ {mission.buyer.rating?.toFixed(1) ?? '—'}
              </Text>
            </View>
            {isFavorite && <Badge label="Client favori" variant="default" />}
          </View>
        </Card>

        {/* Route section — vertical timeline */}
        <Card>
          <Text style={[styles.sectionLabel, { color: colors.text }]}>Itinéraire</Text>
          <View style={styles.timeline}>
            {/* Pickup */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineDotCol}>
                <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              </View>
              <View style={styles.timelineContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="location-filled" size={14} color={colors.primary} /><Text style={[styles.timelineHub, { color: colors.text }]}>{mission.pickupHub.name}</Text></View>
                <Text style={[styles.timelineCity, { color: colors.textSecondary }]}>{mission.pickupHub.city}</Text>
                <Text style={[styles.timelineTime, { color: colors.primary }]}>
                  {formatDate(mission.pickupHub.scheduledTime, 'DD/MM')} à {formatTime(mission.pickupHub.scheduledTime)}
                </Text>
                <Text style={[styles.timelineTolerance, { color: colors.textSecondary }]}>
                  ±{mission.pickupHub.toleranceMinutes} min
                </Text>
              </View>
            </View>

            {/* Delivery */}
            <View style={styles.timelineRow}>
              <View style={styles.timelineDotCol}>
                <View style={[styles.timelineDot, { backgroundColor: colors.success }]} />
              </View>
              <View style={styles.timelineContent}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="location-filled" size={14} color={colors.success} /><Text style={[styles.timelineHub, { color: colors.text }]}>{mission.deliveryHub.name}</Text></View>
                <Text style={[styles.timelineCity, { color: colors.textSecondary }]}>{mission.deliveryHub.city}</Text>
                <Text style={[styles.timelineTime, { color: colors.success }]}>
                  {formatDate(mission.deliveryHub.scheduledTime, 'DD/MM')} à {formatTime(mission.deliveryHub.scheduledTime)}
                </Text>
                <Text style={[styles.timelineTolerance, { color: colors.textSecondary }]}>
                  ±{mission.deliveryHub.toleranceMinutes} min
                </Text>
              </View>
            </View>
          </View>
        </Card>

        {/* Earnings section */}
        <Card style={{ backgroundColor: colors.primary + '08', borderColor: colors.primary + '20' }}>
          <Text style={[styles.earningsLabel, { color: colors.textSecondary }]}>Participation aux frais proposée</Text>
          <Text style={[styles.earningsAmount, { color: colors.primary }]}>
            {formatCurrency(mission.transporterEarning)}
          </Text>

          <View style={[styles.feeBreakdown, { borderTopColor: colors.border }]}>
            <View style={styles.feeRow}>
              <Text style={[styles.feeLabel, { color: colors.textSecondary }]}>Frais de mise en relation plateforme</Text>
              <Text style={[styles.feeValue, { color: colors.textSecondary }]}>{formatCurrency(platformFee)}</Text>
            </View>
            <View style={styles.feeRow}>
              <Text style={[styles.feeTotalLabel, { color: colors.text }]}>Total facturé au demandeur</Text>
              <Text style={[styles.feeTotalValue, { color: colors.text }]}>{formatCurrency(mission.price)}</Text>
            </View>
          </View>
        </Card>

        {/* Eco impact */}
        {(() => {
          const route = routes.find((r) => r.id === mission.routeId);
          const transportType = route?.transportType ?? 'car';
          const distanceKm = estimateDistanceKm(mission.pickupHub.city, mission.deliveryHub.city);
          const kgSaved = calculateCo2Saved(distanceKm, transportType);
          return kgSaved > 0 ? <EcoImpactCard kgSaved={kgSaved} /> : null;
        })()}

        {/* Expiry timer */}
        {mission.proposalExpiresAt && (
          <ProposalTimer expiresAt={mission.proposalExpiresAt} colors={colors} />
        )}
      </ScrollView>

      {/* Action buttons */}
      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button
          title="Accepter la co-livraison"
          onPress={handleAccept}
          variant="gradient"
          loading={isLoading}
          style={{ minHeight: 52 }}
        />
        <TouchableOpacity onPress={handleReject} hitSlop={16} style={styles.rejectButton}>
          <Text style={[styles.rejectText, { color: colors.textSecondary }]}>Refuser</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function ProposalTimer({ expiresAt, colors }: { expiresAt: string; colors: any }) {
  const [remaining, setRemaining] = useState('');

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('00:00'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isLow = remaining !== '00:00' && parseInt(remaining) < 2;

  return (
    <View style={[sty.timerCard, { backgroundColor: isLow ? colors.error + '10' : colors.surface, borderColor: isLow ? colors.error + '40' : colors.border }]}>
      <Text style={[sty.timerLabel, { color: isLow ? colors.error : colors.textSecondary }]}>
        Cette proposition expire dans :
      </Text>
      <Text style={[sty.timerValue, { color: isLow ? colors.error : colors.text }]}>
        {remaining}
      </Text>
    </View>
  );
}

const sty = StyleSheet.create({
  timerCard: { alignItems: 'center', padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.xs },
  timerLabel: { ...Typography.caption },
  timerValue: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 36 },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  goldBanner: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginHorizontal: Spacing.lg, borderRadius: BorderRadius.md, marginTop: Spacing.sm, overflow: 'hidden' },
  goldBannerText: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#1A1A1E' },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.lg },
  notFound: { ...Typography.body, textAlign: 'center', marginTop: Spacing.section },

  // Package
  packageRow: { flexDirection: 'row', gap: Spacing.lg, marginBottom: Spacing.md },
  packageThumb: { width: 64, height: 64, borderRadius: BorderRadius.md, alignItems: 'center', justifyContent: 'center' },
  packageIcon: { fontSize: 28 },
  packageInfo: { flex: 1, gap: Spacing.xs },
  packageTitle: { ...Typography.bodyMedium },
  packageCondition: { ...Typography.caption },
  packageBadges: { flexDirection: 'row', gap: Spacing.sm, marginTop: 2 },

  // Buyer
  buyerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderTopWidth: 0.5, paddingTop: Spacing.md },
  buyerAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  buyerInitial: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  buyerInfo: { flex: 1 },
  buyerName: { ...Typography.bodyMedium },
  buyerRating: { ...Typography.caption },

  // Route timeline
  sectionLabel: { ...Typography.h3, marginBottom: Spacing.md },
  timeline: { gap: 0 },
  timelineRow: { flexDirection: 'row', gap: Spacing.md },
  timelineDotCol: { alignItems: 'center', width: 16 },
  timelineDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  timelineLine: { flex: 1, width: 2, marginVertical: 4, minHeight: 24, alignSelf: 'center' },
  timelineContent: { flex: 1, paddingBottom: Spacing.lg, gap: 2 },
  timelineHub: { ...Typography.bodyMedium },
  timelineCity: { ...Typography.caption },
  timelineTime: { ...Typography.captionMedium, marginTop: 2 },
  timelineTolerance: { ...Typography.caption },

  // Earnings
  earningsLabel: { ...Typography.body, textAlign: 'center' },
  earningsAmount: { fontFamily: 'Poppins_700Bold', fontSize: 28, lineHeight: 36, textAlign: 'center' },
  feeBreakdown: { borderTopWidth: 0.5, marginTop: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm },
  feeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  feeLabel: { ...Typography.caption, flex: 1 },
  feeValue: { ...Typography.captionMedium },
  feeTotalLabel: { ...Typography.bodyMedium, flex: 1 },
  feeTotalValue: { ...Typography.bodyMedium },

  // Actions
  actions: { paddingHorizontal: Spacing.lg, gap: Spacing.md, alignItems: 'center' },
  rejectButton: { paddingVertical: Spacing.sm },
  rejectText: { ...Typography.bodyMedium, textDecorationLine: 'underline' },
});
