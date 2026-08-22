import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMissionStore } from '@/stores/useMissionStore';
import { formatCurrency, formatTime, formatDate } from '@/utils/formatting';
import type { Mission } from '@/types/mission';

type Tab = 'new' | 'active' | 'completed';

export default function MissionsScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { charger, isLoading, erreur, getProposals, getActiveMissions, getCompletedMissions } = useMissionStore();
  const [tab, setTab] = useState<Tab>('new');

  useEffect(() => { void charger(); }, [charger]);

  const proposals = getProposals();
  const active = getActiveMissions();
  const completed = getCompletedMissions();

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'new', label: 'Nouvelles', count: proposals.length },
    { key: 'active', label: 'En cours', count: active.length },
    { key: 'completed', label: 'Terminées', count: completed.length },
  ];

  const switchTab = useCallback((t: Tab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTab(t);
  }, []);

  const data = tab === 'new' ? proposals : tab === 'active' ? active : completed;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Co-livraisons</Text>
      </View>

      {/* Segmented control */}
      <View style={[styles.segmented, { backgroundColor: colors.border + '40' }]}>
        {tabs.map((t) => {
          const isActive = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => switchTab(t.key)}
              style={[styles.segment, isActive && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.segmentText, { color: isActive ? colors.text : colors.textSecondary }]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={[styles.segmentBadge, { backgroundColor: isActive ? colors.primary : colors.textSecondary + '30' }]}>
                  <Text style={[styles.segmentBadgeText, { color: isActive ? '#FFFFFF' : colors.textSecondary }]}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* 🔴 UN REFUS DE LECTURE N'EST PAS UNE LISTE VIDE. « Aucune co-livraison
          disponible » sur une requête qui a échoué dit exactement le contraire
          de ce qui s'est passé — et laisse attendre des propositions qui ne
          viendront jamais. */}
      {erreur && (
        <View style={[styles.erreur, { borderColor: colors.error, backgroundColor: colors.error + '10' }]}>
          <Text style={[styles.erreurTexte, { color: colors.error }]}>{erreur}</Text>
        </View>
      )}

      {/* Content */}
      <FlatList
        data={data}
        refreshing={isLoading}
        onRefresh={() => { void charger(); }}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
            {tab === 'new' ? (
              <ProposalCard mission={item} colors={colors} router={router} />
            ) : tab === 'active' ? (
              <ActiveMissionCard mission={item} colors={colors} router={router} />
            ) : (
              <CompletedMissionCard mission={item} colors={colors} />
            )}
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? null : tab === 'new' ? (
            <EmptyState iconName="package" title="Aucune co-livraison disponible" description="Restez actif pour recevoir des propositions !" />
          ) : tab === 'active' ? (
            <EmptyState iconName="rocket" title="Aucune co-livraison en cours" description="Acceptez une proposition pour démarrer." />
          ) : (
            <EmptyState iconName="document" title="Aucune co-livraison terminée" description="Vos co-livraisons terminées apparaîtront ici." />
          )
        }
      />
    </View>
  );
}

// ─── Proposal card (Nouvelles tab) ─────────────────────────

function ProposalCard({ mission, colors, router }: { mission: Mission; colors: any; router: any }) {
  const isFavorite = mission.buyer.isFavorite;

  return (
    <TouchableOpacity
      onPress={() => router.push({ pathname: '/mission/accept', params: { id: mission.id } })}
      activeOpacity={0.8}
      style={{
        shadowColor: colors.gold,
        shadowOpacity: 0.25,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 2 },
        elevation: 4,
      }}
    >
      <Card
        style={{
          borderLeftWidth: 4,
          borderLeftColor: colors.gold,
          ...(isFavorite ? { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primary + '06', borderLeftWidth: 4, borderLeftColor: colors.gold } : {}),
        }}
      >
        <View style={styles.proposalTop}>
          <View
            style={{
              backgroundColor: colors.gold,
              borderColor: colors.goldBorder,
              borderWidth: 1.5,
              paddingHorizontal: Spacing.sm,
              paddingVertical: Spacing.xs,
              borderRadius: BorderRadius.full,
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{ ...Typography.captionMedium, color: '#1A1A1E' }}>Nouvelle co-livraison</Text>
          </View>
          {isFavorite && <Badge label="Client favori" variant="default" />}
        </View>

        <Text style={[styles.proposalRoute, { color: colors.text }]}>
          {mission.pickupHub.name} → {mission.deliveryHub.name}
        </Text>

        <View style={styles.proposalMeta}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Icon name="package" size={14} color={colors.textSecondary} />
            <Text style={[styles.proposalPkg, { color: colors.textSecondary }]}>
              Colis {mission.package.size} — {mission.package.weight} kg
            </Text>
          </View>
          <Text style={[styles.proposalTime, { color: colors.textSecondary }]}>
            {formatDate(mission.pickupHub.scheduledTime, 'DD/MM')} {formatTime(mission.pickupHub.scheduledTime)}
          </Text>
        </View>

        <View style={styles.proposalBottom}>
          <Text style={[styles.proposalEarning, { color: colors.primary }]}>
            {formatCurrency(mission.transporterEarning)}
          </Text>
          {mission.proposalExpiresAt && (
            <CountdownBadge expiresAt={mission.proposalExpiresAt} colors={colors} />
          )}
        </View>

        <View style={[styles.seeDetails, { borderTopColor: colors.border }]}>
          <Text style={[styles.seeDetailsText, { color: colors.primary }]}>Voir détails →</Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

function CountdownBadge({ expiresAt, colors }: { expiresAt: string; colors: any }) {
  const [remaining, setRemaining] = React.useState('');

  React.useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining('Expiré'); return; }
      const m = Math.floor(diff / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${m}:${String(s).padStart(2, '0')}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  const isLow = remaining !== 'Expiré' && parseInt(remaining) < 2;

  return (
    <View style={[styles.timerBadge, { backgroundColor: isLow ? colors.error + '15' : colors.textSecondary + '15' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        <Icon name="hourglass" size={12} color={isLow ? colors.error : colors.textSecondary} />
        <Text style={[styles.timerText, { color: isLow ? colors.error : colors.textSecondary }]}>
          {remaining}
        </Text>
      </View>
    </View>
  );
}

// ─── Active mission card (En cours tab) ────────────────────

function ActiveMissionCard({ mission, colors, router }: { mission: Mission; colors: any; router: any }) {
  const statusMap: Record<string, { label: string; variant: 'default' | 'success' | 'warning' | 'error' }> = {
    accepted: { label: 'Acceptée', variant: 'default' },
    seller_pending: { label: 'Attente vendeur', variant: 'warning' },
    group_created: { label: 'Groupe créé', variant: 'success' },
    pickup_pending: { label: 'Récupération', variant: 'warning' },
    picked_up: { label: 'Collecté', variant: 'success' },
    in_transit: { label: 'En trajet', variant: 'default' },
    deposited: { label: 'Dépôt', variant: 'success' },
    delivery_pending: { label: 'Remise prévue', variant: 'warning' },
  };
  const info = mission.isReturn
    ? { label: 'Retour à effectuer', variant: 'error' as const }
    : statusMap[mission.status] ?? { label: mission.status, variant: 'default' as const };

  return (
    <TouchableOpacity onPress={() => router.push(`/mission/${mission.id}`)} activeOpacity={0.8}>
      <Card>
        <View style={styles.activeTop}>
          <Text style={[styles.activeRoute, { color: colors.text }]}>
            {mission.pickupHub.city} → {mission.deliveryHub.city}
          </Text>
          <Badge label={info.label} variant={info.variant} />
        </View>
        <Text style={[styles.activeHubs, { color: colors.textSecondary }]}>
          {mission.pickupHub.name} → {mission.deliveryHub.name}
        </Text>
        <View style={styles.activeBottom}>
          <Text style={[styles.activeTime, { color: colors.textSecondary }]}>
            {formatTime(mission.pickupHub.scheduledTime)} → {formatTime(mission.deliveryHub.scheduledTime)}
          </Text>
          <Text style={[styles.activeEarning, { color: colors.success }]}>
            {formatCurrency(mission.transporterEarning)}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ─── Completed mission card (compact) ─────────────────────

function CompletedMissionCard({ mission, colors }: { mission: Mission; colors: any }) {
  return (
    <View style={[styles.completedRow, { borderBottomColor: colors.border }]}>
      <View style={styles.completedLeft}>
        <Text style={[styles.completedRoute, { color: colors.text }]}>
          {mission.pickupHub.city} → {mission.deliveryHub.city}
        </Text>
        <Text style={[styles.completedPkg, { color: colors.textSecondary }]}>
          {mission.package.description}
        </Text>
        <Text style={[styles.completedDate, { color: colors.textSecondary }]}>
          {formatDate(mission.updatedAt)}
        </Text>
      </View>
      <Text style={[styles.completedEarning, { color: colors.success }]}>
        +{formatCurrency(mission.transporterEarning)}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────

const styles = StyleSheet.create({
  erreur: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  erreurTexte: { ...Typography.caption, lineHeight: 18 },
  screen: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { ...Typography.h1 },

  // Segmented
  segmented: { flexDirection: 'row', marginHorizontal: Spacing.lg, borderRadius: BorderRadius.md, padding: 3, marginBottom: Spacing.lg },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, gap: 4 },
  segmentText: { ...Typography.captionMedium },
  segmentBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full, minWidth: 20, alignItems: 'center' },
  segmentBadgeText: { fontSize: 10, fontWeight: '700' },

  // List
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.section },

  // Proposal card
  proposalTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  proposalRoute: { ...Typography.bodyMedium, marginBottom: Spacing.xs },
  proposalMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: Spacing.sm },
  proposalPkg: { ...Typography.caption },
  proposalTime: { ...Typography.caption },
  proposalBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  proposalEarning: { fontFamily: 'Poppins_600SemiBold', fontSize: 18, lineHeight: 24 },
  timerBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 3, borderRadius: BorderRadius.full },
  timerText: { ...Typography.captionMedium },
  seeDetails: { borderTopWidth: 0.5, paddingTop: Spacing.md, alignItems: 'center' },
  seeDetailsText: { ...Typography.captionMedium },

  // Active card
  activeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  activeRoute: { ...Typography.h3 },
  activeHubs: { ...Typography.caption, marginBottom: Spacing.sm },
  activeBottom: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  activeTime: { ...Typography.caption },
  activeEarning: { ...Typography.bodyMedium },

  // Completed (compact)
  completedRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  completedLeft: { flex: 1, gap: 2, marginRight: Spacing.md },
  completedRoute: { ...Typography.bodyMedium },
  completedPkg: { ...Typography.caption },
  completedDate: { ...Typography.caption, fontSize: 11 },
  completedEarning: { ...Typography.bodyMedium },
});
