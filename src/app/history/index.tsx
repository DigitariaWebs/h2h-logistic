// L'HISTORIQUE DES PARTICIPATIONS — le grand livre, et rien d'autre.
//
// 🔴 CET ÉCRAN MONTRAIT DES CHIFFRES INVENTÉS À CÔTÉ D'ARGENT RÉEL. Il lisait
// `services/mock/earnings.ts` : un taux de réussite, une note moyenne, un
// itinéraire, un vendeur, un acheteur et une note par co-livraison — aucun de
// ces champs n'existe dans `ledger_entries`, et le solde affiché juste
// au-dessus, lui, est désormais vrai. Mélanger les deux sur un écran d'argent
// est la pire des situations : rien ne distingue ce qui engage la plateforme.
//
// ⚠️ CE QUI RESTE EST CE QUE LA BASE SAIT : la date, le montant, le sens
// (participation portée au crédit / versement effectué), le numéro de suivi du
// colis. La note et le nombre de co-livraisons viennent de `courier_profiles`,
// qui les porte pour de vrai. Le « taux de réussite » a disparu : aucune source.
//
// ⚠️ VOCABULAIRE : « participation », jamais « gains » ni « revenu ».
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { useEarningsStore } from '@/stores/useEarningsStore';
import { formatCurrency, formatDate } from '@/utils/formatting';
import type { LigneParticipation } from '@/services/participations';

type FilterTab = 'all' | 'participations' | 'versements';

export default function HistoryScreen() {
  const { colors } = useColorScheme();
  const insets = useSafeAreaInsets();
  const { journal, summary, erreur, isLoading, charger } = useEarningsStore();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<FilterTab>('all');

  useEffect(() => { void charger(); }, [charger]);

  const filtrer = useCallback(
    (l: LigneParticipation) =>
      filter === 'all'
        ? true
        : filter === 'participations'
          ? l.sens === 'C'
          : l.sens === 'D',
    [filter],
  );
  const lignes = journal.filter(filtrer);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Tout' },
    { key: 'participations', label: 'Participations' },
    { key: 'versements', label: 'Versements' },
  ];

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <Header title="Historique des participations" showBack />
      </View>

      <FlatList
        data={lignes}
        keyExtractor={(item, i) => `${item.survenuLe}-${i}`}
        contentContainerStyle={s.list}
        refreshing={isLoading}
        onRefresh={() => { void charger(); }}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListHeaderComponent={
          <View style={s.headerContent}>
            <LinearGradient
              colors={[colors.primary, colors.primaryGradientEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.statsCard}
            >
              <Text style={s.statsTitle}>Vos co-livraisons</Text>
              <View style={s.statsRow}>
                <StatMetric
                  label="Co-livraisons"
                  value={`${user?.totalDeliveries ?? summary?.totalMissions ?? 0}`}
                  iconName="package"
                />
                <StatMetric
                  label="Participations"
                  value={formatCurrency(summary?.totalEarnings ?? 0)}
                  iconName="cash"
                />
                <StatMetric
                  label="Versé"
                  value={formatCurrency(summary?.withdrawnTotal ?? 0)}
                  iconName="card"
                />
                {/* ⚠️ LA NOTE VIENT DE `courier_profiles`, qui la porte pour de
                    vrai. Le « taux de réussite » a disparu : rien ne le
                    calcule, et un pourcentage inventé sur un écran d'argent
                    est pire qu'une case vide. */}
                <StatMetric
                  label="Note"
                  value={user?.rating ? user.rating.toFixed(1) : '—'}
                  iconName="star"
                />
              </View>
            </LinearGradient>

            {!!erreur && (
              <View style={[s.erreur, { borderColor: colors.error, backgroundColor: colors.error + '10' }]}>
                <Text style={[s.erreurTexte, { color: colors.error }]}>{erreur}</Text>
              </View>
            )}

            <View style={[s.tabs, { backgroundColor: colors.border + '30' }]}>
              {tabs.map((t) => {
                const active = filter === t.key;
                return (
                  <TouchableOpacity
                    key={t.key}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setFilter(t.key);
                    }}
                    style={[s.tab, active && { backgroundColor: colors.surface }]}
                  >
                    <Text style={[s.tabText, { color: active ? colors.text : colors.textSecondary }]}>
                      {t.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item, index }) => (
          <Animated.View entering={FadeInDown.delay(Math.min(index, 8) * 40).duration(250)}>
            <View style={[s.ligne, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Icon
                name={item.sens === 'C' ? 'cash' : 'card'}
                size={22}
                color={item.sens === 'C' ? colors.success : colors.primary}
              />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[s.ligneTitre, { color: colors.text }]} numberOfLines={1}>
                  {item.libelle ?? (item.sens === 'C' ? 'Participation' : 'Versement')}
                </Text>
                {!!item.numeroSuivi && (
                  <Text style={[s.ligneSous, { color: colors.textSecondary }]}>
                    {item.numeroSuivi}
                  </Text>
                )}
                <Text style={[s.ligneSous, { color: colors.textSecondary }]}>
                  {formatDate(item.survenuLe)}
                </Text>
              </View>
              <Text
                style={[s.montant, { color: item.sens === 'C' ? colors.success : colors.primary }]}
              >
                {item.sens === 'C' ? '+' : '−'}{formatCurrency(item.montantEuros)}
              </Text>
            </View>
          </Animated.View>
        )}
        ListEmptyComponent={
          isLoading ? null : (
            <EmptyState
              iconName="document"
              title="Aucune participation"
              description="Vos co-livraisons apparaîtront ici une fois remises."
            />
          )
        }
      />
    </View>
  );
}

function StatMetric({
  label, value, iconName,
}: { label: string; value: string; iconName: IconName }) {
  return (
    <View style={s.metric}>
      <Icon name={iconName} size={18} color="#FFFFFF" />
      <Text style={s.metricValue}>{value}</Text>
      <Text style={s.metricLabel}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl },
  headerContent: { gap: Spacing.lg, paddingBottom: Spacing.lg },
  statsCard: { borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.md },
  statsTitle: { fontFamily: 'Poppins_600SemiBold', fontSize: 15, color: '#FFFFFF' },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', gap: 2, flex: 1 },
  metricValue: { fontFamily: 'Poppins_700Bold', fontSize: 15, color: '#FFFFFF' },
  metricLabel: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.7)' },
  erreur: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md },
  erreurTexte: { ...Typography.caption, lineHeight: 18 },
  tabs: { flexDirection: 'row', borderRadius: BorderRadius.full, padding: 3 },
  tab: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, alignItems: 'center' },
  tabText: { ...Typography.captionMedium },
  ligne: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    borderWidth: 1, borderRadius: BorderRadius.lg, padding: Spacing.lg,
  },
  ligneTitre: { ...Typography.bodyMedium },
  ligneSous: { ...Typography.caption },
  montant: { ...Typography.bodyMedium },
});
