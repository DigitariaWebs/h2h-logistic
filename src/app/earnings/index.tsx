import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useEarningsStore } from '@/stores/useEarningsStore';
import { demanderVersement, ouvrirCompteVersement } from '@/services/participations';
import { impactCo2 } from '@/utils/impactEcologique';
import { useMissionStore } from '@/stores/useMissionStore';
import { useRouteStore } from '@/stores/useRouteStore';
import { formatCo2 } from '@/utils/carbon';
import { formatCurrency, formatDate } from '@/utils/formatting';

type Period = 'today' | 'week' | 'month' | 'total';
const PERIODS: { key: Period; label: string }[] = [
  { key: 'today', label: "Aujourd'hui" },
  { key: 'week', label: 'Cette semaine' },
  { key: 'month', label: 'Ce mois' },
  { key: 'total', label: 'Total' },
];

const DAY_LABELS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export default function EarningsScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { summary, journal, dailyEarnings, erreur, charger, getEarningsForPeriod } =
    useEarningsStore();
  // 🔴 CALCULÉ SUR LES VRAIES CO-LIVRAISONS TERMINÉES — voir `impactEcologique`.
  const { getCompletedMissions } = useMissionStore();
  const { routes } = useRouteStore();
  const impact = impactCo2(getCompletedMissions(), routes);
  const [period, setPeriod] = useState<Period>('week');
  const [showEconomy, setShowEconomy] = useState(false);
  const [selectedBar, setSelectedBar] = useState<number | null>(null);
  const [retraitEnCours, setRetraitEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { void charger(); }, []);

  /**
   * 🔴 CE BOUTON N'AVAIT AUCUN `onPress`, et la mention en dessous disait vrai :
   * « les retraits seront disponibles prochainement ». Rien, dans toute la base,
   * ne payait un cotransporteur pour une co-livraison réussie — les frais de
   * livraison partaient sur le compte des transporteurs TIERS.
   *
   * ⚠️ ON N'ENVOIE NI MONTANT NI DESTINATAIRE. Le serveur déduit qui parle du
   * jeton et demande à la base ce qu'elle lui doit.
   *
   * ⚠️ ET « RIEN À VERSER » N'EST PAS UN ÉCHEC : le serveur répond 200 avec
   * `verse: false`. Le montant DÛ et le montant VERSABLE ne sont pas le même
   * nombre — la fenêtre de réclamation court entre les deux.
   */
  const retirer = useCallback(async () => {
    if (retraitEnCours) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    setRetraitEnCours(true);
    setMessage(null);
    try {
      const r = await demanderVersement();
      if (r.verse) {
        setMessage(`${formatCurrency(r.montantEuros)} en route vers votre compte.`);
        await charger();
      } else {
        setMessage(r.motif ?? 'Rien à verser pour le moment.');
      }
    } catch (e) {
      // 🔴 LES REFUS UTILES ARRIVENT ICI, ET CHACUN DIT QUOI FAIRE : « aucun
      // compte de versement : commencez par vous inscrire », « Stripe n a pas
      // encore fini de verifier votre compte ». Les écraser sous « erreur »
      // laisserait le cotransporteur réessayer indéfiniment la même chose.
      setMessage(e instanceof Error ? e.message : 'Versement indisponible');
    } finally {
      setRetraitEnCours(false);
    }
  }, [retraitEnCours, charger]);

  /** Ouvre la page Stripe où le compte bancaire se donne — jamais chez nous. */
  const ouvrirCompte = useCallback(async () => {
    try {
      const url = await ouvrirCompteVersement();
      await Linking.openURL(url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Inscription indisponible');
    }
  }, []);

  const periodCo2Kg =
    period === 'total' ? impact.total : impact.ceMois;

  const periodData = getEarningsForPeriod(period);

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={{ paddingHorizontal: Spacing.lg }}>
        <Header title="Mes participations" showBack />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {/* ─── BALANCE CARD ─── */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <LinearGradient
            colors={[colors.primary, colors.primaryGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.balanceCard}
          >
            {/* ⚠️ TROIS NOMBRES DISTINCTS, ET LES CONFONDRE SERAIT MENTIR. Le
                titre disait « Solde disponible » au-dessus du solde TOTAL : une
                co-livraison remise hier est due, pas encore versable — la
                fenêtre de réclamation court. */}
            <Text style={s.balanceLabel}>Participations à recevoir</Text>
            <Text style={s.balanceAmount}>{formatCurrency(summary?.balance ?? 0)}</Text>
            <Text style={s.withdrawNote}>
              {formatCurrency(summary?.availableBalance ?? 0)} versable maintenant
              {(summary?.pendingBalance ?? 0) > 0
                ? ` · ${formatCurrency(summary?.pendingBalance ?? 0)} en attente`
                : ''}
            </Text>
            <TouchableOpacity
              style={[s.withdrawBtn, retraitEnCours && { opacity: 0.6 }]}
              activeOpacity={0.8}
              onPress={retirer}
              disabled={retraitEnCours || (summary?.availableBalance ?? 0) <= 0}
            >
              <Text style={s.withdrawText}>
                {retraitEnCours ? 'Envoi…' : 'Retirer'}
              </Text>
            </TouchableOpacity>
            {!!message && <Text style={s.withdrawNote}>{message}</Text>}
            {/* 🔴 LE COMPTE BANCAIRE SE DONNE CHEZ STRIPE, jamais chez nous.
                L'écran IBAN de cette application a été supprimé : il rangeait
                un IBAN en clair dans AsyncStorage. */}
            <TouchableOpacity onPress={ouvrirCompte} activeOpacity={0.8}>
              <Text style={[s.withdrawNote, { textDecorationLine: 'underline' }]}>
                Gérer mon compte de versement
              </Text>
            </TouchableOpacity>
            {!!erreur && <Text style={s.withdrawNote}>{erreur}</Text>}
          </LinearGradient>
        </Animated.View>

        {/* ─── PERIOD SELECTOR ─── */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <View style={[s.periodRow, { backgroundColor: colors.border + '30' }]}>
            {PERIODS.map((p) => {
              const active = period === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setPeriod(p.key); }}
                  style={[s.periodBtn, active && { backgroundColor: colors.surface }]}
                >
                  <Text style={[s.periodText, { color: active ? colors.text : colors.textSecondary }]}>{p.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>

        {/* ─── CHART ─── */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Card>
            <EarningsChart
              data={dailyEarnings}
              colors={colors}
              selectedBar={selectedBar}
              onSelectBar={setSelectedBar}
            />
            <Text style={[s.chartTotal, { color: colors.text }]}>
              Total : {formatCurrency(periodData.amount)} ({periodData.deliveries} co-livraisons)
            </Text>
            {periodCo2Kg > 0 && (
              <View style={[s.co2Row, { borderTopColor: colors.border }]}>
                <Icon name="leaf" size={16} color={colors.success} />
                <Text style={[s.co2Label, { color: colors.textSecondary }]}>
                  CO₂ évité sur la période
                </Text>
                <Text style={[s.co2Amount, { color: colors.success }]}>
                  {formatCo2(periodCo2Kg)}
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {/* ─── TRANSACTIONS ─── */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Dernières écritures</Text>
          {/* 🔴 LE GRAND LIVRE, PAS UNE LISTE INVENTÉE. Les anciennes lignes
              portaient un itinéraire, un vendeur, un acheteur et une note —
              aucun de ces champs n'existe dans `ledger_entries`, et les afficher
              à côté d'un solde réel aurait mélangé ce qui engage la plateforme
              et ce qui ne l'engage pas. */}
          {journal.length === 0 && (
            <Text style={[s.txDate, { color: colors.textSecondary }]}>
              Aucune participation pour l’instant.
            </Text>
          )}
          {journal.slice(0, 10).map((l, i) => (
            <View key={`${l.survenuLe}-${i}`} style={[s.txRow, { borderBottomColor: colors.border }]}>
              <Icon
                name={l.sens === 'C' ? 'cash' : 'card'}
                size={20}
                color={l.sens === 'C' ? colors.success : colors.primary}
              />
              <View style={s.txInfo}>
                <Text style={[s.txTitle, { color: colors.text }]} numberOfLines={1}>
                  {l.sens === 'C' ? 'Participation' : 'Versement'}
                </Text>
                {!!l.numeroSuivi && (
                  <Text style={[s.txRoute, { color: colors.textSecondary }]}>{l.numeroSuivi}</Text>
                )}
                <Text style={[s.txDate, { color: colors.textSecondary }]}>{formatDate(l.survenuLe)}</Text>
              </View>
              <Text
                style={[s.txAmount, { color: l.sens === 'C' ? colors.success : colors.primary }]}
              >
                {l.sens === 'C' ? '+' : '−'}{formatCurrency(l.montantEuros)}
              </Text>
            </View>
          ))}
        </Animated.View>

        {/* ─── ECONOMIC MODEL ─── */}
        <Animated.View entering={FadeInDown.delay(500).duration(300)}>
          <TouchableOpacity
            onPress={() => setShowEconomy(!showEconomy)}
            activeOpacity={0.8}
          >
            <Card>
              <View style={s.economyHeader}>
                <Text style={[s.economyTitle, { color: colors.text }]}>Comment sont calculées vos participations ?</Text>
                <Text style={[s.economyChevron, { color: colors.textSecondary }]}>{showEconomy ? '▴' : '▾'}</Text>
              </View>

              {showEconomy && (
                <View style={[s.economyBody, { borderTopColor: colors.border }]}>
                  <Text style={[s.economyText, { color: colors.textSecondary }]}>
                    Chaque co-livraison propose une participation aux frais adaptée au trajet concerné.
                  </Text>
                  <View style={[s.economyHighlight, { backgroundColor: colors.primary + '08' }]}>
                    <Text style={[s.economyBold, { color: colors.primary }]}>
                      Avant acceptation, vous visualisez clairement la participation proposée ainsi que les frais de mise en relation HandtoHand.
                    </Text>
                  </View>
                  <Text style={[s.economyText, { color: colors.textSecondary }]}>
                    Le montant affiché dans cette rubrique correspond aux participations aux frais perçues pour les co-livraisons réalisées.
                  </Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </View>
  );
}

// ─── CHART COMPONENT ─────────────────────────────────────────

function EarningsChart({
  data,
  colors,
  selectedBar,
  onSelectBar,
}: {
  data: { date: string; amount: number; deliveries: number }[];
  colors: any;
  selectedBar: number | null;
  onSelectBar: (idx: number | null) => void;
}) {
  if (data.length === 0) return null;

  const maxAmount = Math.max(...data.map((d) => d.amount), 1);
  const chartW = 300;
  const chartH = 140;
  const barW = 32;
  const gap = (chartW - barW * data.length) / (data.length - 1 || 1);

  return (
    <View style={s.chartContainer}>
      {selectedBar != null && data[selectedBar] && (
        <Text style={[s.chartTooltip, { color: colors.primary }]}>
          {formatCurrency(data[selectedBar].amount)} — {data[selectedBar].deliveries} co-livraison{data[selectedBar].deliveries !== 1 ? 's' : ''}
        </Text>
      )}
      <Svg width={chartW} height={chartH + 24} viewBox={`0 0 ${chartW} ${chartH + 24}`}>
        {data.map((d, i) => {
          const barH = maxAmount > 0 ? (d.amount / maxAmount) * (chartH - 24) : 0;
          const x = i * (barW + gap);
          const y = chartH - 24 - barH;
          const isSelected = selectedBar === i;
          const dayLabel = DAY_LABELS[new Date(d.date).getDay()];

          return (
            <React.Fragment key={i}>
              <Rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 2)}
                rx={6}
                fill={isSelected ? colors.primary : d.amount > 0 ? colors.primary + '60' : colors.border}
                onPress={() => onSelectBar(isSelected ? null : i)}
              />
              {d.amount > 0 && (
                <SvgText
                  x={x + barW / 2}
                  y={y - 4}
                  fontSize={9}
                  fill={colors.textSecondary}
                  textAnchor="middle"
                  fontFamily="Poppins_500Medium"
                >
                  {d.amount.toFixed(0)}€
                </SvgText>
              )}
              <SvgText
                x={x + barW / 2}
                y={chartH + 12}
                fontSize={10}
                fill={colors.textSecondary}
                textAnchor="middle"
                fontFamily="Poppins_400Regular"
              >
                {dayLabel}
              </SvgText>
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

// ─── STYLES ──────────────────────────────────────────────────

const s = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.section, gap: Spacing.xl },

  // Balance
  balanceCard: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
  balanceLabel: { fontFamily: 'Poppins_400Regular', fontSize: 14, color: 'rgba(255,255,255,0.7)' },
  balanceAmount: { fontFamily: 'Poppins_700Bold', fontSize: 36, lineHeight: 44, color: '#FFFFFF' },
  withdrawBtn: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)', borderRadius: BorderRadius.full, paddingHorizontal: Spacing.xxl, paddingVertical: Spacing.sm, marginTop: Spacing.sm },
  withdrawText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14, color: '#FFFFFF' },
  withdrawNote: { fontFamily: 'Poppins_400Regular', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.xs },

  // Period
  periodRow: { flexDirection: 'row', borderRadius: BorderRadius.sm, padding: 3 },
  periodBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm - 2, alignItems: 'center' },
  periodText: { fontFamily: 'Poppins_500Medium', fontSize: 11 },

  // Chart
  chartContainer: { alignItems: 'center', paddingVertical: Spacing.md },
  chartTooltip: { ...Typography.captionMedium, marginBottom: Spacing.sm },
  chartTotal: { ...Typography.bodyMedium, textAlign: 'center', marginTop: Spacing.md },
  co2Row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 0.5 },
  co2Label: { ...Typography.caption, flex: 1 },
  co2Amount: { ...Typography.captionMedium },

  // Transactions
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.sm },
  txRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md, borderBottomWidth: 0.5 },
  txIcon: { fontSize: 20 },
  txInfo: { flex: 1, gap: 1 },
  txTitle: { ...Typography.bodyMedium },
  txRoute: { ...Typography.caption },
  txDate: { ...Typography.caption, fontSize: 11 },
  txAmount: { fontFamily: 'Poppins_600SemiBold', fontSize: 15 },

  // Economy
  economyHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  economyTitle: { ...Typography.bodyMedium, flex: 1 },
  economyChevron: { fontSize: 14, marginLeft: Spacing.sm },
  economyBody: { borderTopWidth: 0.5, marginTop: Spacing.md, paddingTop: Spacing.md, gap: Spacing.md },
  economyText: { ...Typography.body, lineHeight: 22 },
  economyHighlight: { padding: Spacing.md, borderRadius: BorderRadius.sm },
  economyBold: { ...Typography.bodyMedium, textAlign: 'center' },
});
