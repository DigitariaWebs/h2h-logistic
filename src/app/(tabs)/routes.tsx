import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { StatusToggle } from '@/components/logistics/StatusToggle';
import { RouteCard } from '@/components/route/RouteCard';
import { EmptyState } from '@/components/ui/EmptyState';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useRouteStore } from '@/stores/useRouteStore';

type FilterTab = 'active' | 'paused' | 'all';

export default function RoutesScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { transporterStatus, toggleOnline } = useAuthStore();
  const { routes, hydrate } = useRouteStore();
  const [filter, setFilter] = useState<FilterTab>('active');

  const isOnline = transporterStatus === 'active';

  // ⚠️ ON RELIT LA BASE, ON NE CHARGE PLUS DE DONNÉES DE DÉMONSTRATION. Les
  // trois trajets de `mock/routes.ts` s'affichaient pour tout le monde, y
  // compris pour un compte qui n'avait jamais rien publié.
  useEffect(() => { void hydrate(); }, [hydrate]);

  const filtered = filter === 'all'
    ? routes
    : routes.filter((r) => (filter === 'active' ? r.status === 'active' : r.status === 'paused'));

  const activeCount = routes.filter((r) => r.status === 'active').length;
  const pausedCount = routes.filter((r) => r.status === 'paused').length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: 'active', label: 'Actifs', count: activeCount },
    { key: 'paused', label: 'Hors ligne', count: pausedCount },
    { key: 'all', label: 'Tous', count: routes.length },
  ];

  // FAB
  const fabScale = useSharedValue(1);
  const fabStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));
  const handleFab = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    fabScale.value = withSpring(0.9, {}, () => { fabScale.value = withSpring(1); });
    router.push('/publish/type');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Mes trajets</Text>
        <StatusToggle isOnline={isOnline} onToggle={toggleOnline} />
      </View>

      {/* Segmented control */}
      <View style={[styles.segmented, { backgroundColor: colors.border + '40' }]}>
        {tabs.map((t) => {
          const active = filter === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFilter(t.key); }}
              style={[styles.segment, active && { backgroundColor: colors.surface }]}
            >
              <Text style={[styles.segmentText, { color: active ? colors.text : colors.textSecondary }]}>
                {t.label}
              </Text>
              {t.count > 0 && (
                <View style={[styles.segmentBadge, { backgroundColor: active ? colors.primary : colors.textSecondary + '30' }]}>
                  <Text style={[styles.segmentBadgeText, { color: active ? '#FFFFFF' : colors.textSecondary }]}>{t.count}</Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Offline banner */}
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.warning + '12' }]}>
          <Text style={[styles.offlineText, { color: colors.warning }]}>
            Vous êtes hors ligne, vos trajets ne sont pas proposés aux utilisateurs
          </Text>
        </View>
      )}

      {/* Route list */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(index * 80).duration(300)}>
            <RouteCard route={item} />
          </Animated.View>
        )}
        ListEmptyComponent={
          <EmptyState
            iconName="tab-routes"
            title="Aucun trajet publié"
            description={filter === 'active'
              ? 'Publiez votre premier trajet pour commencer à recevoir des co-livraisons.'
              : filter === 'paused'
                ? 'Aucun trajet hors ligne.'
                : 'Vous n\'avez pas encore de trajet.'}
            actionLabel="Publier un trajet"
            onAction={() => router.push('/publish/type')}
          />
        }
      />

      {/* FAB */}
      <Animated.View style={[styles.fab, { bottom: insets.bottom + 70 }, fabStyle]}>
        <TouchableOpacity onPress={handleFab} activeOpacity={0.85}>
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

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { ...Typography.h1 },

  // Segmented
  segmented: { flexDirection: 'row', marginHorizontal: Spacing.lg, borderRadius: BorderRadius.md, padding: 3, marginBottom: Spacing.md },
  segment: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm, gap: 4 },
  segmentText: { ...Typography.captionMedium },
  segmentBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: BorderRadius.full, minWidth: 20, alignItems: 'center' },
  segmentBadgeText: { fontSize: 10, fontWeight: '700' },

  // Offline banner
  offlineBanner: { marginHorizontal: Spacing.lg, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.sm, marginBottom: Spacing.md },
  offlineText: { ...Typography.captionMedium, textAlign: 'center' },

  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.section + 80 },

  // FAB
  fab: { position: 'absolute', right: Spacing.xl, zIndex: 20 },
  fabGradient: {
    width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#007BA7', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 8, elevation: 8,
  },
  fabIcon: { color: '#FFFFFF', fontSize: 28, fontWeight: '300', lineHeight: 30, marginTop: -1 },
});
