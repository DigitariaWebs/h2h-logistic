import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusToggle } from '@/components/logistics/StatusToggle';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon, type IconName } from '@/components/ui/Icon';
import { LiveDot } from '@/components/ui/LiveDot';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useMissionStore } from '@/stores/useMissionStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { useEarningsStore } from '@/stores/useEarningsStore';
import { formatCurrency, formatTime } from '@/utils/formatting';
import { mockNotifications, type AppNotification } from '@/services/mock/notifications';
import { DailyConfirmation } from '@/components/route/DailyConfirmation';
import { EcoImpactSummary } from '@/components/dashboard/EcoImpactSummary';
import { AdBanner } from '@/components/dashboard/AdBanner';
import { useEcoImpactStore } from '@/stores/useEcoImpactStore';
import type { Mission } from '@/types/mission';
import type { PublishedRoute } from '@/types/route';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Earnings Period ──────────────────────────────────────────
type EarningsPeriod = 'day' | 'week' | 'month';
const PERIOD_LABELS: Record<EarningsPeriod, string> = {
  day: 'Ce jour',
  week: 'Cette semaine',
  month: 'Ce mois',
};

export default function HomeScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, transporterStatus, toggleOnline } = useAuthStore();
  const { missions, charger: chargerMissions, getActiveMissions, getPendingMissions, getCompletedMissions } =
    useMissionStore();
  // ⚠️ TRAJETS ET CO-LIVRAISONS VIENNENT DE LA BASE. Les gains et l'impact
  // écologique restent sur leurs données de démonstration — ils seront branchés
  // avec la tranche de l'argent. Mélanger les deux est le prix de la
  // transition, et il se voit : le tableau de bord affiche des co-livraisons
  // réelles à côté d'un total de participations qui ne l'est pas encore.
  const { routes, hydrate: chargerTrajets } = useRouteStore();
  const { summary, loadMockData: loadEarnings } = useEarningsStore();
  const {
    totalKgSavedAllTime,
    totalKgSavedThisMonth,
    kgSavedLastMonth,
    loadMockData: loadEco,
  } = useEcoImpactStore();

  const [refreshing, setRefreshing] = useState(false);
  const [earningsPeriod, setEarningsPeriod] = useState<EarningsPeriod>('month');

  const [dailyConfirmed, setDailyConfirmed] = useState<Record<string, boolean>>({});

  const isOnline = transporterStatus === 'active';
  const activeMissions = [...getPendingMissions(), ...getActiveMissions()];
  const activeRoutes = routes.filter((r) => r.status === 'active');
  const completedMissions = getCompletedMissions();
  const totalDeliveries = user?.totalDeliveries ?? completedMissions.length;
  const unreadNotifs = mockNotifications.filter((n) => !n.read).length;

  // Recurring routes with today as a scheduled day
  const todayDay = new Date().getDay() || 7; // 1=Mon..7=Sun
  const todayRoutes = routes.filter(
    (r) => r.type === 'recurring' && r.status === 'active' && r.schedule.recurringDays?.includes(todayDay) && !dailyConfirmed[r.id],
  );

  // Earnings based on period (mock)
  const earningsAmount =
    earningsPeriod === 'day'
      ? 12.3
      : earningsPeriod === 'week'
        ? 34.8
        : summary?.thisMonth ?? 0;
  const earningsDeliveries =
    earningsPeriod === 'day' ? 2 : earningsPeriod === 'week' ? 5 : 12;

  useEffect(() => {
    void chargerMissions();
    void chargerTrajets();
    loadEarnings();
    loadEco();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    loadEarnings();
    loadEco();
    // ⚠️ TRAJETS ET CO-LIVRAISONS FONT UN VRAI ALLER-RETOUR ; les gains et
    // l'impact écologique, pas encore. On attend les deux premiers plutôt que
    // de simuler un délai : un « tirer pour rafraîchir » qui s'arrête avant que
    // la donnée arrive montre l'ancienne liste et laisse croire que rien n'a
    // changé.
    try {
      await Promise.all([chargerTrajets(), chargerMissions()]);
    } finally {
      setRefreshing(false);
    }
  }, [chargerTrajets, chargerMissions, loadEarnings, loadEco]);

  // FAB animation
  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const handleFabPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fabScale.value = withSpring(0.9, {}, () => {
      fabScale.value = withSpring(1);
    });
    router.push('/publish/type');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* ─── STICKY HEADER ─── */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + Spacing.xs,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View style={styles.headerBrand}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={styles.headerLogoMark}
            contentFit="contain"
          />
          <View style={styles.headerBrandText}>
            <Text style={[styles.headerLogo, { color: colors.primary }]}>H2H Logistic</Text>
            <Text style={[styles.headerTagline, { color: colors.textSecondary }]} numberOfLines={1}>
              Cotransportage entre particuliers
            </Text>
          </View>
        </View>

        <StatusToggle isOnline={isOnline} onToggle={toggleOnline} />

        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={() => router.push('/notifications')}
            style={styles.bellButton}
            hitSlop={8}
          >
            <Icon name="bell" size={20} color={colors.text} />
            {unreadNotifs > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>{unreadNotifs}</Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/(tabs)/profile')}
            style={[styles.profileBtn, { backgroundColor: colors.primary }]}
            hitSlop={8}
            accessibilityLabel="Profil"
          >
            <Text style={styles.profileInitial}>{user?.firstName?.[0] ?? 'T'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ─── 1. EARNINGS SUMMARY CARD ─── */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/earnings')}>
            <LinearGradient
              colors={[colors.primary, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.earningsCard}
            >
              <View style={styles.earningsHeader}>
                <Text style={styles.earningsTitle}>Vos participations</Text>
                {/* Period selector */}
                <TouchableOpacity
                  onPress={() => {
                    const periods: EarningsPeriod[] = ['day', 'week', 'month'];
                    const idx = periods.indexOf(earningsPeriod);
                    setEarningsPeriod(periods[(idx + 1) % periods.length]);
                  }}
                  style={styles.periodPill}
                >
                  <Text style={styles.periodText}>{PERIOD_LABELS[earningsPeriod]}</Text>
                  <Text style={styles.periodChevron}>▾</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.earningsAmount}>{formatCurrency(earningsAmount)}</Text>

              <Text style={styles.earningsMeta}>
                {earningsDeliveries} co-livraisons • {user?.rating?.toFixed(1) ?? '4.9'} note
                moyenne
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* ─── AD BANNER ─── */}
        <Animated.View entering={FadeInDown.delay(150).duration(400)}>
          <AdBanner index={new Date().getDay()} />
        </Animated.View>

        {/* ─── DAILY CONFIRMATION ─── */}
        {todayRoutes.map((route) => (
          <Animated.View key={route.id} entering={FadeInDown.delay(150).duration(300)}>
            <DailyConfirmation
              route={route}
              onConfirm={() => setDailyConfirmed((prev) => ({ ...prev, [route.id]: true }))}
              onSkip={() => setDailyConfirmed((prev) => ({ ...prev, [route.id]: true }))}
            />
          </Animated.View>
        ))}

        {/* ─── 2. ACTIVE MISSIONS ─── */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)}>
          <SectionHeader
            title="Co-livraisons en cours"
            count={activeMissions.length}
            onViewAll={() => router.push('/(tabs)/missions')}
            colors={colors}
          />

          {activeMissions.length > 0 ? (
            <FlatList
              data={activeMissions}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              renderItem={({ item }) => (
                <CompactMissionCard mission={item} colors={colors} router={router} />
              )}
            />
          ) : (
            <Card style={styles.emptyCard}>
              <Icon name="package" size={32} color={colors.textSecondary} />
              <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                Aucune co-livraison en cours.{'\n'}Vos prochaines co-livraisons apparaîtront ici.
              </Text>
            </Card>
          )}
        </Animated.View>

        {/* ─── 3. MY ROUTES ─── */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)}>
          <SectionHeader
            title="Mes trajets actifs"
            count={activeRoutes.length}
            onViewAll={() => router.push('/(tabs)/routes')}
            colors={colors}
          />

          {activeRoutes.length > 0 || true ? (
            <FlatList
              data={activeRoutes}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.horizontalList}
              ListFooterComponent={
                <TouchableOpacity
                  onPress={() => router.push('/publish/type')}
                  style={[
                    styles.addRouteCard,
                    { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
                  ]}
                >
                  <Text style={[styles.addRouteIcon, { color: colors.primary }]}>+</Text>
                  <Text style={[styles.addRouteLabel, { color: colors.primary }]}>
                    Publier un{'\n'}trajet
                  </Text>
                </TouchableOpacity>
              }
              renderItem={({ item }) => (
                <CompactRouteCard route={item} colors={colors} router={router} />
              )}
              ListEmptyComponent={
                <Card style={styles.emptyRouteCard}>
                  <Icon name="tab-routes" size={32} color={colors.textSecondary} />
                  <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Publiez votre premier trajet{'\n'}pour recevoir des co-livraisons.
                  </Text>
                </Card>
              }
            />
          ) : null}
        </Animated.View>

        {/* ─── 4. QUICK STATS ROW ─── */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <View style={styles.statsRow}>
            <StatBox
              label="Co-livraisons"
              value={String(totalDeliveries)}
              sub={summary && summary.thisMonth > summary.lastMonth ? '↑' : '↓'}
              subColor={
                summary && summary.thisMonth > summary.lastMonth ? colors.success : colors.error
              }
              colors={colors}
            />
            <StatBox
              label="Taux réussite"
              value="96%"
              sub=""
              subColor={colors.success}
              colors={colors}
              valueColor={colors.success}
            />
            <StatBox
              label="Note moyenne"
              value={`${user?.rating?.toFixed(1) ?? '4.9'}`}
              sub=""
              subColor={colors.warning}
              colors={colors}
            />
          </View>
        </Animated.View>

        {/* ─── 4b. ECO IMPACT ─── */}
        <Animated.View entering={FadeInDown.delay(450).duration(400)}>
          <EcoImpactSummary
            kgSavedThisMonth={totalKgSavedThisMonth}
            kgSavedLastMonth={kgSavedLastMonth}
            kgSavedAllTime={totalKgSavedAllTime}
          />
        </Animated.View>

        {/* ─── 5. RECENT NOTIFICATIONS ─── */}
        <Animated.View entering={FadeInDown.delay(500).duration(400)}>
          <SectionHeader
            title="Notifications récentes"
            onViewAll={() => router.push('/notifications')}
            colors={colors}
          />

          <View style={styles.notifList}>
            {mockNotifications.slice(0, 3).map((notif) => (
              <NotificationRow key={notif.id} notif={notif} colors={colors} />
            ))}
          </View>
        </Animated.View>
      </ScrollView>

      {/* ─── FAB ─── */}
      <Animated.View
        style={[
          styles.fab,
          { bottom: insets.bottom + 70 },
          fabStyle,
        ]}
      >
        <TouchableOpacity onPress={handleFabPress} activeOpacity={0.85}>
          <LinearGradient
            colors={[colors.primary, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Text style={styles.fabIcon}>+</Text>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── SUB-COMPONENTS ──────────────────────────────────────────

function SectionHeader({
  title,
  count,
  onViewAll,
  colors,
}: {
  title: string;
  count?: number;
  onViewAll: () => void;
  colors: any;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
        {count != null && count > 0 && (
          <View style={[styles.countBadge, { backgroundColor: colors.primary + '15' }]}>
            <Text style={[styles.countBadgeText, { color: colors.primary }]}>{count}</Text>
          </View>
        )}
      </View>
      <TouchableOpacity onPress={onViewAll} hitSlop={12}>
        <Text style={[styles.viewAll, { color: colors.primary }]}>Voir tout</Text>
      </TouchableOpacity>
    </View>
  );
}

function CompactMissionCard({
  mission,
  colors,
  router,
}: {
  mission: Mission;
  colors: any;
  router: any;
}) {
  const statusLabel: Record<string, string> = {
    proposal: 'Proposition',
    accepted: 'Acceptée',
    seller_pending: 'Attente vendeur',
    group_created: 'Groupe créé',
    pickup_pending: 'Récupération',
    picked_up: 'Collecté',
    in_transit: 'En trajet',
    delivery_pending: 'Remise prévue',
  };
  const statusVariant =
    mission.status === 'proposal' || mission.status === 'seller_pending'
      ? ('warning' as const)
      : mission.status === 'in_transit'
        ? ('default' as const)
        : ('success' as const);

  return (
    <TouchableOpacity
      onPress={() => router.push(`/mission/${mission.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.compactMission, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.compactMissionTop}>
          <Text style={[styles.compactMissionRoute, { color: colors.text }]}>
            {mission.pickupHub.city} → {mission.deliveryHub.city}
          </Text>
          <Badge label={statusLabel[mission.status] ?? mission.status} variant={statusVariant} />
        </View>
        <Text style={[styles.compactMissionBuyer, { color: colors.textSecondary }]} numberOfLines={1}>
          {mission.buyer.name} — {mission.package.description}
        </Text>
        <View style={styles.compactMissionBottom}>
          <Text style={[styles.compactMissionTime, { color: colors.textSecondary }]}>
            {formatTime(mission.pickupHub.scheduledTime)} → {formatTime(mission.deliveryHub.scheduledTime)}
          </Text>
          <Text style={[styles.compactMissionEarning, { color: colors.success }]}>
            {formatCurrency(mission.transporterEarning)}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function CompactRouteCard({
  route,
  colors,
  router,
}: {
  route: PublishedRoute;
  colors: any;
  router: any;
}) {
  return (
    <TouchableOpacity
      onPress={() => router.push(`/route/${route.id}`)}
      activeOpacity={0.8}
    >
      <View style={[styles.compactRoute, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.compactRouteTop}>
          <Text style={[styles.compactRouteCities, { color: colors.text }]}>
            {route.departureCity} → {route.arrivalCity}
          </Text>
        </View>
        <Text style={[styles.compactRouteMeta, { color: colors.textSecondary }]}>
          {route.pickupHub.hubName}
        </Text>
        <View style={styles.compactRouteBottom}>
          <View style={styles.compactRouteDot}>
            <LiveDot
              pulsing={route.status === 'active'}
              size={6}
              color={route.status === 'active' ? colors.online : colors.offline}
            />
            <Text style={[styles.compactRouteStatus, { color: colors.textSecondary }]}>
              {route.status === 'active' ? 'Actif' : 'Pause'}
            </Text>
          </View>
          <Text style={[styles.compactRouteCount, { color: colors.textSecondary }]}>
            {route.missionsCount} colis
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function StatBox({
  label,
  value,
  sub,
  subColor,
  colors,
  valueColor,
}: {
  label: string;
  value: string;
  sub: string;
  subColor: string;
  colors: any;
  valueColor?: string;
}) {
  return (
    <View style={[styles.statBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statValue, { color: valueColor ?? colors.text }]}>
        {value}
        {sub ? <Text style={{ color: subColor, fontSize: 14 }}> {sub}</Text> : null}
      </Text>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}

const NOTIF_ANIM: Record<string, any> = {
  mission_new: require('@/assets/lottie/delivery.json'),
  mission_update: require('@/assets/lottie/recover.json'),
  earning: require('@/assets/lottie/coin.json'),
};

function NotificationRow({ notif, colors }: { notif: AppNotification; colors: any }) {
  const iconMap: Record<string, IconName> = {
    mission_new: 'package',
    mission_update: 'refresh',
    earning: 'cash',
    route: 'tab-routes',
    system: 'bell',
  };
  const timeAgo = getTimeAgo(notif.createdAt);

  return (
    <View
      style={[
        styles.notifRow,
        { borderBottomColor: colors.border },
        !notif.read && { backgroundColor: colors.primary + '06' },
      ]}
    >
      {NOTIF_ANIM[notif.type] ? (
        <View style={styles.notifIconSlot}>
          <LottieView
            source={NOTIF_ANIM[notif.type]}
            autoPlay
            loop
            resizeMode={notif.type === 'earning' ? 'cover' : 'contain'}
            style={notif.type === 'mission_new' ? styles.notifAnimLg : styles.notifAnim}
          />
        </View>
      ) : (
        <Icon name={iconMap[notif.type] ?? 'bell'} size={20} color={colors.primary} />
      )}
      <View style={styles.notifContent}>
        <Text style={[styles.notifTitle, { color: colors.text }]} numberOfLines={1}>
          {notif.title}
        </Text>
        <Text style={[styles.notifTime, { color: colors.textSecondary }]}>{timeAgo}</Text>
      </View>
      {!notif.read && <View style={[styles.notifUnread, { backgroundColor: colors.primary }]} />}
    </View>
  );
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

// ─── STYLES ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 0.5,
    zIndex: 10,
  },
  headerBrand: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerBrandText: {
    flexShrink: 1,
  },
  headerLogoMark: {
    width: 32,
    height: 32,
  },
  headerLogo: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    lineHeight: 24,
  },
  headerTagline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 9,
    lineHeight: 12,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  bellButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 16,
  },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#EF4444',
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },

  // Scroll
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    gap: Spacing.xxl,
  },

  // Earnings card
  earningsCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  earningsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  earningsTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  periodPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  periodText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#FFFFFF',
  },
  periodChevron: {
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
  },
  earningsAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    lineHeight: 40,
    color: '#FFFFFF',
  },
  earningsMeta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    lineHeight: 18,
  },

  // Section header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  countBadgeText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
  },
  viewAll: {
    ...Typography.captionMedium,
  },

  // Horizontal lists
  horizontalList: {
    gap: Spacing.md,
    paddingRight: Spacing.sm,
  },

  // Compact mission card
  compactMission: {
    width: 280,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  compactMissionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactMissionRoute: {
    ...Typography.h3,
  },
  compactMissionBuyer: {
    ...Typography.caption,
  },
  compactMissionBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactMissionTime: {
    ...Typography.caption,
  },
  compactMissionEarning: {
    ...Typography.bodyMedium,
  },

  // Compact route card
  compactRoute: {
    width: 240,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  compactRouteTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  compactRouteCities: {
    ...Typography.bodyMedium,
  },
  compactRouteMeta: {
    ...Typography.caption,
  },
  compactRouteBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  compactRouteDot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  compactRouteStatus: {
    ...Typography.caption,
  },
  compactRouteCount: {
    ...Typography.caption,
  },

  // Add route CTA card
  addRouteCard: {
    width: 110,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  addRouteIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  addRouteLabel: {
    ...Typography.captionMedium,
    textAlign: 'center',
  },

  // Empty state cards
  emptyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyRouteCard: {
    width: 240,
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyEmoji: {
    fontSize: 32,
  },
  emptyText: {
    ...Typography.caption,
    textAlign: 'center',
    lineHeight: 18,
  },

  // Stats row
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  statValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 24,
  },
  statLabel: {
    ...Typography.caption,
    textAlign: 'center',
  },

  // Notifications
  notifList: {
    gap: 0,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 0.5,
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  notifIcon: {
    fontSize: 20,
  },
  notifIconSlot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  notifAnim: {
    width: 46,
    height: 46,
  },
  notifAnimLg: {
    width: 70,
    height: 70,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    ...Typography.captionMedium,
  },
  notifTime: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 11,
    lineHeight: 14,
  },
  notifUnread: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // FAB
  fab: {
    position: 'absolute',
    right: Spacing.xl,
    zIndex: 20,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',

    // Shadow
    shadowColor: '#007BA7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '300',
    lineHeight: 30,
    marginTop: -1,
  },
});
