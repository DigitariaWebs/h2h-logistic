import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { impactCo2 } from '@/utils/impactEcologique';
import { useMissionStore } from '@/stores/useMissionStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { equivalence, formatCo2 } from '@/utils/carbon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';

const MONTH_LABELS_FR: Record<string, string> = {
  '01': 'Jan',
  '02': 'Fév',
  '03': 'Mar',
  '04': 'Avr',
  '05': 'Mai',
  '06': 'Juin',
  '07': 'Juil',
  '08': 'Août',
  '09': 'Sep',
  '10': 'Oct',
  '11': 'Nov',
  '12': 'Déc',
};

function shortMonth(key: string): string {
  const [, m] = key.split('-');
  return MONTH_LABELS_FR[m] ?? m;
}

export default function EcoImpactScreen() {
  const { colors } = useColorScheme();
  // 🔴 CALCULÉ SUR LES VRAIES CO-LIVRAISONS TERMINÉES — voir `impactEcologique`.
  const { getCompletedMissions } = useMissionStore();
  const { routes } = useRouteStore();
  const impact = impactCo2(getCompletedMissions(), routes);
  const totalKgSavedAllTime = impact.total;
  const totalKgSavedThisMonth = impact.ceMois;
  const monthlyHistory = impact.parMois;
  const deliveriesAllTime = impact.livraisons;

  const history = [...monthlyHistory].sort((a, b) => a.month.localeCompare(b.month)).slice(-6);
  const maxKg = Math.max(0.1, ...history.map((h) => h.kgSaved));

  const CHART_WIDTH = 320;
  const CHART_HEIGHT = 160;
  const BAR_GAP = 12;
  const BAR_WIDTH = history.length
    ? (CHART_WIDTH - BAR_GAP * (history.length - 1)) / history.length
    : 0;

  return (
    <SafeAreaWrapper>
      <Header title="Impact écologique" showBack />
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <LinearGradient
          colors={[colors.success, '#34A882']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroHeader}>
            <Image source={require('@/assets/images/leaf.webp')} style={styles.heroLeaf} contentFit="contain" />
            <Text style={styles.heroLabel}>Depuis votre inscription</Text>
          </View>
          <Text style={styles.heroAmount}>{formatCo2(totalKgSavedAllTime)}</Text>
          <Text style={styles.heroSub}>estimés sur {deliveriesAllTime} co-livraisons</Text>
          <Text style={styles.heroEq}>{equivalence(totalKgSavedAllTime)}</Text>
        </LinearGradient>

        {/* This month */}
        <Card style={{ backgroundColor: colors.success + '10', borderColor: colors.success + '30' }}>
          <Text style={[styles.smallLabel, { color: colors.textSecondary }]}>Ce mois</Text>
          <Text style={[styles.smallAmount, { color: colors.success }]}>
            {formatCo2(totalKgSavedThisMonth)} évités
          </Text>
          <Text style={[styles.smallEq, { color: colors.textSecondary }]}>
            {equivalence(totalKgSavedThisMonth)}
          </Text>
        </Card>

        {/* Monthly chart */}
        {history.length > 0 && (
          <Card>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>6 derniers mois</Text>
            <View style={{ marginTop: Spacing.md, alignSelf: 'center' }}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT + 24}>
                {history.map((h, i) => {
                  const barH = Math.max(4, (h.kgSaved / maxKg) * CHART_HEIGHT);
                  const x = i * (BAR_WIDTH + BAR_GAP);
                  const y = CHART_HEIGHT - barH;
                  return (
                    <React.Fragment key={h.month}>
                      <Rect
                        x={x}
                        y={y}
                        width={BAR_WIDTH}
                        height={barH}
                        rx={6}
                        fill={colors.success}
                        opacity={0.85}
                      />
                      <SvgText
                        x={x + BAR_WIDTH / 2}
                        y={CHART_HEIGHT + 16}
                        fill={colors.textSecondary}
                        fontSize={11}
                        fontFamily="Poppins_500Medium"
                        textAnchor="middle"
                      >
                        {shortMonth(h.month)}
                      </SvgText>
                    </React.Fragment>
                  );
                })}
              </Svg>
            </View>
          </Card>
        )}

        {/* How it's calculated */}
        <Card style={{ backgroundColor: colors.primary + '06' }}>
          <View style={styles.howHeader}>
            <Icon name="info" size={18} color={colors.primary} />
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Comment on calcule</Text>
          </View>
          <Text style={[styles.howBody, { color: colors.textSecondary }]}>
            L'estimation compare une co-livraison effectuée sur un trajet déjà prévu avec un trajet dédié
            équivalent. Le résultat est indicatif et peut varier selon le mode de déplacement, la distance
            et les paramètres retenus.
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.lg,
    paddingBottom: Spacing.section,
  },

  hero: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    gap: 4,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  heroLeaf: {
    width: 34,
    height: 34,
  },
  heroLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
    lineHeight: 44,
    color: '#FFFFFF',
  },
  heroSub: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroEq: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
    fontStyle: 'italic',
    marginTop: Spacing.sm,
  },

  smallLabel: {
    ...Typography.caption,
  },
  smallAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 22,
    lineHeight: 30,
    marginTop: 2,
  },
  smallEq: {
    ...Typography.caption,
    marginTop: 4,
  },

  sectionTitle: {
    ...Typography.h3,
  },
  howHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  howBody: {
    ...Typography.body,
    lineHeight: 22,
  },
});
