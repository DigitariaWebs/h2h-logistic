import React, { useMemo } from 'react';
import { View, Text, ScrollView, Alert, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { LiveDot } from '@/components/ui/LiveDot';
import { HubParticipantChip, type HubParticipantInfo } from '@/components/route/HubParticipantChip';
import { TRANSPORT_TYPES } from '@/constants/TransportTypes';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouteStore } from '@/stores/useRouteStore';
import { useMissionStore } from '@/stores/useMissionStore';
import { ACTIVE_STATUSES } from '@/types/mission';
import { formatCurrency, formatDate } from '@/utils/formatting';

const DAYS_SHORT: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam', 7: 'Dim' };

export default function RouteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useColorScheme();
  const router = useRouter();
  const { routes, updateRoute, deleteRoute, hasActiveMission, toggleRouteStatus } = useRouteStore();
  // 🔴 CE HOOK ET LE `useMemo` PLUS BAS ÉTAIENT DÉCLARÉS APRÈS LE
  // `if (!route) return`. Le nombre de hooks changeait donc d'un rendu à
  // l'autre, et React lève « Rendered more hooks than during the previous
  // render » dès que le trajet apparaît — c'est-à-dire dès que l'écran sert.
  // Ils remontent ici, avant toute sortie anticipée.
  const { missions } = useMissionStore();

  const route = routes.find((r) => r.id === id);

  // ⚠️ IL TOLÈRE UN TRAJET ABSENT, puisqu'il s'exécute maintenant AVANT la
  // garde. Sans trajet, il n'y a personne à afficher : une table vide.
  const participantsByHubId = useMemo(() => {
    const map: Record<string, HubParticipantInfo[]> = {};
    if (!route) return map;
    const routeMissions = missions.filter(
      (m) => m.routeId === route.id && ACTIVE_STATUSES.includes(m.status),
    );
    for (const m of routeMissions) {
      const sellerKey = m.pickupHub.id;
      if (!map[sellerKey]) map[sellerKey] = [];
      map[sellerKey].push({ participant: m.seller, role: 'seller' });
      const buyerKey = m.deliveryHub.id;
      if (!map[buyerKey]) map[buyerKey] = [];
      map[buyerKey].push({ participant: m.buyer, role: 'buyer' });
    }
    return map;
  }, [missions, route]);

  if (!route) {
    return (
      <SafeAreaWrapper>
        <Header title="Trajet" showBack />
        <Text style={[styles.notFound, { color: colors.textSecondary }]}>Trajet introuvable</Text>
      </SafeAreaWrapper>
    );
  }

  const transport = TRANSPORT_TYPES.find((t) => t.id === route.transportType);
  const isActive = route.status === 'active';
  const hasMission = hasActiveMission(route.id);
  const avgEarnings = route.missionsCount > 0 ? 4.5 : 0; // mock average

  // ─── Participants per hubId from active missions on this route ───
  // (calculé plus haut, avant la garde — voir la note.)

  const handleChipPress = (info: HubParticipantInfo) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: info.participant.id,
        name: info.participant.name,
        role: info.role,
        avatar: info.participant.avatar ?? '',
      },
    });
  };

  const handleReportHub = (hubId: string, hubName: string, city: string) => {
    router.push({
      pathname: '/hub/report' as any,
      params: { hubId, hubName, hubAddress: city },
    });
  };

  const handleChipMore = (extras: HubParticipantInfo[]) => {
    Alert.alert(
      'Participants à ce hub',
      extras
        .map((e, idx) => `${idx + 1}. ${e.participant.name} — ${e.role === 'seller' ? 'Vendeur' : 'Acheteur'}`)
        .join('\n'),
      [{ text: 'OK', style: 'default' }],
    );
  };

  const handleDelete = () => {
    if (hasMission) {
      Alert.alert('Impossible', 'Ce trajet a une co-livraison en cours. Terminez-la d\'abord.');
      return;
    }
    Alert.alert('Supprimer ce trajet ?', 'Cette action est irréversible.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Supprimer', style: 'destructive', onPress: () => { deleteRoute(route.id); router.back(); } },
    ]);
  };

  // Schedule text
  const daysText = route.schedule.recurringDays?.length
    ? route.schedule.recurringDays.sort((a, b) => a - b).map((d) => DAYS_SHORT[d]).join(', ')
    : null;

  return (
    <SafeAreaWrapper>
      <Header title={`${route.departureCity} → ${route.arrivalCity}`} showBack />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Active mission warning */}
        {hasMission && (
          <View style={[styles.warningBanner, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '40' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Icon name="alert-circle" size={16} color={colors.warning} />
              <Text style={[styles.warningText, { color: colors.warning, flex: 1 }]}>
                Ce trajet a une co-livraison en cours. Certaines modifications sont limitées.
              </Text>
            </View>
          </View>
        )}

        {/* Status + transport */}
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <LiveDot pulsing={isActive} size={8} color={isActive ? colors.online : colors.offline} />
            <Badge label={isActive ? 'Actif' : 'Hors ligne'} variant={isActive ? 'success' : 'default'} />
          </View>
          <View style={styles.transportBadge}>
            <Text style={[styles.transportLabel, { color: colors.textSecondary }]}>{transport?.label}</Text>
          </View>
        </View>

        {/* Info card */}
        <Card>
          <InfoRow label="Type" value={route.type === 'recurring' ? 'Récurrent' : 'Ponctuel'} colors={colors} />
          <InfoRow label="Capacité" value={`${route.maxPackages} colis — Taille ${route.maxSize} max — ${route.maxWeight} kg`} colors={colors} />
          <InfoRow label="Hors hub" value={route.horsHub ? 'Oui' : 'Non'} colors={colors} />
          {daysText && <InfoRow label="Jours" value={daysText} colors={colors} />}
          <InfoRow label="Horaire collecte" value={route.schedule.pickupTime} colors={colors} />
          {Object.entries(route.schedule.deliveryTimes).map(([hubId, time]) => {
            const hub = route.deliveryHubs.find((h) => h.hubId === hubId);
            return <InfoRow key={hubId} label={`Remise au hub ${hub?.hubName ?? ''}`} value={time} colors={colors} />;
          })}
          <InfoRow label="Créé le" value={formatDate(route.createdAt)} colors={colors} />
        </Card>

        {/* Stats */}
        <View style={styles.statsRow}>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{route.missionsCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Co-livraisons</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={[styles.statValue, { color: colors.success }]}>{formatCurrency(avgEarnings)}</Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Participation moyenne</Text>
          </Card>
        </View>

        {/* Route timeline with hub locking */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Itinéraire</Text>
        <Card>
          {/* Pickup hub */}
          <View style={styles.hubRow}>
            <View style={[styles.hubDot, { backgroundColor: colors.primary }]} />
            <View style={styles.hubInfo}>
              <View style={styles.hubNameRow}>
                <Text style={[styles.hubName, { color: colors.text, flex: 1 }]}>{route.pickupHub.hubName}</Text>
                <Pressable
                  onPress={() => handleReportHub(route.pickupHub.hubId, route.pickupHub.hubName, route.pickupHub.city)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Signaler le hub ${route.pickupHub.hubName}`}
                  style={({ pressed }) => [styles.reportInline, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Icon name="flag" size={12} color={colors.textSecondary} />
                  <Text style={[styles.reportInlineText, { color: colors.textSecondary }]}>Signaler</Text>
                </Pressable>
              </View>
              <Text style={[styles.hubMeta, { color: colors.textSecondary }]}>
                {route.pickupHub.city} — {route.schedule.pickupTime}
              </Text>
              {hasMission && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="lock" size={11} color={colors.warning} /><Text style={[styles.lockLabel, { color: colors.warning }]}>Verrouillé — co-livraison en cours</Text></View>}
            </View>
            {participantsByHubId[route.pickupHub.hubId]?.length > 0 && (
              <HubParticipantChip
                participants={participantsByHubId[route.pickupHub.hubId]}
                onPress={handleChipPress}
                onPressMore={handleChipMore}
              />
            )}
          </View>

          {/* Delivery hubs */}
          {route.deliveryHubs.map((hub, idx) => {
            const time = route.schedule.deliveryTimes[hub.hubId] ?? '';
            const isLocked = hasMission && idx === 0; // First hub locked during mission
            const isDimmed = hasMission && idx > 0;
            const hubParticipants = participantsByHubId[hub.hubId] ?? [];

            return (
              <View key={hub.hubId} style={styles.hubRow}>
                <View style={[styles.hubDot, { backgroundColor: colors.primaryGradientEnd, opacity: isDimmed ? 0.4 : 1 }]} />
                <View style={[styles.hubInfo, isDimmed && { opacity: 0.4 }]}>
                  <View style={styles.hubNameRow}>
                    <Text style={[styles.hubName, { color: colors.text, flex: 1 }]}>{hub.hubName}</Text>
                    <Pressable
                      onPress={() => handleReportHub(hub.hubId, hub.hubName, hub.city)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={`Signaler le hub ${hub.hubName}`}
                      style={({ pressed }) => [styles.reportInline, { opacity: pressed ? 0.6 : 1 }]}
                    >
                      <Icon name="flag" size={12} color={colors.textSecondary} />
                      <Text style={[styles.reportInlineText, { color: colors.textSecondary }]}>Signaler</Text>
                    </Pressable>
                  </View>
                  <Text style={[styles.hubMeta, { color: colors.textSecondary }]}>
                    {hub.city} — {time}
                  </Text>
                  {isLocked && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="lock" size={11} color={colors.warning} /><Text style={[styles.lockLabel, { color: colors.warning }]}>Hub verrouillé — co-livraison en cours</Text></View>}
                  {isDimmed && <Text style={[styles.lockLabel, { color: colors.textSecondary }]}>Désactivé pendant la co-livraison</Text>}
                </View>
                {hubParticipants.length > 0 && (
                  <HubParticipantChip
                    participants={hubParticipants}
                    onPress={handleChipPress}
                    onPressMore={handleChipMore}
                  />
                )}
              </View>
            );
          })}
        </Card>
      </ScrollView>

      {/* Bottom actions */}
      <View style={styles.actions}>
        <View style={styles.actionsRow}>
          <Button
            title="Modifier"
            onPress={() => router.push({ pathname: '/route/edit', params: { id: route.id } })}
            variant="outline"
            fullWidth={false}
            style={styles.actionBtn}
          />
          <Button
            title={isActive ? 'Mettre hors ligne' : 'Activer'}
            onPress={() => toggleRouteStatus(route.id)}
            variant={isActive ? 'outline' : 'gradient'}
            fullWidth={false}
            style={styles.actionBtn}
          />
        </View>
        <Button title="Supprimer le trajet" onPress={handleDelete} variant="danger" />
      </View>
    </SafeAreaWrapper>
  );
}

function InfoRow({ label, value, colors }: { label: string; value: string; colors: any }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  notFound: { ...Typography.body, textAlign: 'center', marginTop: Spacing.section },

  // Warning
  warningBanner: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1 },
  warningText: { ...Typography.captionMedium, textAlign: 'center', lineHeight: 18 },

  // Status
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  transportBadge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  transportIcon: { fontSize: 18 },
  transportLabel: { ...Typography.bodyMedium },

  // Info
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: '#E5E7EB20' },
  infoLabel: { ...Typography.caption },
  infoValue: { ...Typography.captionMedium },

  // Stats
  statsRow: { flexDirection: 'row', gap: Spacing.md },
  statCard: { flex: 1, alignItems: 'center', gap: Spacing.xs },
  statValue: { fontFamily: 'Poppins_700Bold', fontSize: 24, lineHeight: 30 },
  statLabel: { ...Typography.caption },

  // Section
  sectionTitle: { ...Typography.h3 },

  // Hubs
  hubRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md },
  hubDot: { width: 12, height: 12, borderRadius: 6, marginTop: 4 },
  hubInfo: { flex: 1, gap: 2 },
  hubName: { ...Typography.bodyMedium },
  hubNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  hubMeta: { ...Typography.caption },
  lockLabel: { ...Typography.caption, fontSize: 11, marginTop: 2 },
  reportInline: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 4 },
  reportInlineText: { ...Typography.caption, fontSize: 11 },

  // Actions
  actions: { paddingVertical: Spacing.lg, gap: Spacing.md },
  actionsRow: { flexDirection: 'row', gap: Spacing.md },
  actionBtn: { flex: 1 },
});
