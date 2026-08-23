import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import dayjs from 'dayjs';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { MissionTimeline } from '@/components/mission/MissionTimeline';
import { ParticipantsCard, type ActiveParty } from '@/components/mission/ParticipantsCard';
import { ActivePartyCard } from '@/components/mission/ActivePartyCard';
import { ScheduleReminderCard } from '@/components/mission/ScheduleReminderCard';
import { DirectionHubButton } from '@/components/mission/DirectionHubButton';
import { ResponsibilitiesCard } from '@/components/mission/ResponsibilitiesCard';
import { EcoImpactCard } from '@/components/mission/EcoImpactCard';
import { AdBanner } from '@/components/dashboard/AdBanner';
import { useRouteStore } from '@/stores/useRouteStore';
import { calculateCo2Saved, estimateDistanceKm } from '@/utils/carbon';
import { OffHubProposalSheet } from '@/components/logistics/OffHubProposal';
import { SupportDecisionCard } from '@/components/mission/SupportDecisionCard';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useMissionStore } from '@/stores/useMissionStore';
import { formatCurrency } from '@/utils/formatting';
import type { Mission, MissionParticipant } from '@/types/mission';

const QUICK_MESSAGES = [
  'Je suis en route',
  'Je suis arrivé au hub',
  'Le colis est prêt',
  'Un léger décalage, merci pour votre patience',
  'Tout se passe bien !',
];

// Incident forms attached to the hub de remise (F2–F6).
const INCIDENTS_REMISE: { type: string; label: string }[] = [
  { type: 'buyer_absent', label: 'Acheteur absent au hub' },
  { type: 'transporter_absent', label: 'Cotransporteur absent au hub' },
  { type: 'hub_blocked', label: 'Absence ou blocage au hub' },
  { type: 'contest_buyer_absent', label: 'Contester une absence acheteur' },
  { type: 'contest_transporter_absent', label: 'Contester une absence cotransporteur' },
];

// Cancellation forms (F9/F10/F12) — D8 locks them once the mission is engaged.
const ANNULATIONS: { type: string; label: string }[] = [
  { type: 'cancel_transporter', label: 'Annuler ma co-livraison' },
  { type: 'cancel_seller', label: 'Annulation vendeur' },
  { type: 'cancel_buyer', label: 'Annulation acheteur' },
];

export default function MissionGroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  // Use an explicit selector so the component reliably re-renders on every
  // store mutation. Subscribing to the `missions` array reference guarantees
  // re-renders because the store always rebuilds that array on every update.
  const mission = useMissionStore((s) => {
    const list = s.missions;
    return list.find((m) => m.id === (id ?? ''));
  });

  if (!mission) {
    return (
      <View style={[gs.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={{ paddingHorizontal: Spacing.lg }}><Header title="Co-livraison" showBack /></View>
        <Text style={[gs.notFound, { color: colors.textSecondary }]}>Co-livraison introuvable</Text>
      </View>
    );
  }

  return <GroupContent mission={mission} colors={colors} router={router} insets={insets} />;
}


function GroupContent({ mission, colors, router, insets }: { mission: Mission; colors: any; router: any; insets: any }) {
  // Select actions individually so we don't re-subscribe to the whole state.
  const cancelMission = useMissionStore((s) => s.cancelMission);
  const reportSellerAbsence = useMissionStore((s) => s.reportSellerAbsence);
  const reportBuyerAbsence = useMissionStore((s) => s.reportBuyerAbsence);
  const proposeOffHub = useMissionStore((s) => s.proposeOffHub);
  const resolveSupportReview = useMissionStore((s) => s.resolveSupportReview);
  const separatedPairs = useMissionStore((s) => s.separatedPairs);
  const { t } = useTranslation();
  const { routes } = useRouteStore();
  const routeForMission = routes.find((r) => r.id === mission.routeId);
  const missionTransportType = routeForMission?.transportType ?? 'car';
  const missionDistanceKm = estimateDistanceKm(mission.pickupHub.city, mission.deliveryHub.city);
  const missionKgSaved = calculateCo2Saved(missionDistanceKm, missionTransportType);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning' | 'error'>('success');
  const [packageExpanded, setPackageExpanded] = useState(false);
  const [showOffHub, setShowOffHub] = useState(false);

  const missionCode = `HTH-${mission.id.slice(-4).toUpperCase()}`;

  // ─── Current counterparty (drives arrow + ActivePartyCard) ───
  const activeParty: ActiveParty = useMemo(() => {
    if (['group_created', 'pickup_pending'].includes(mission.status)) return 'seller';
    if (['picked_up', 'in_transit', 'delivery_pending'].includes(mission.status)) return 'buyer';
    return null;
  }, [mission.status]);

  const reminderPhase: 'pickup' | 'delivery' | 'completed' = useMemo(() => {
    if (['group_created', 'pickup_pending'].includes(mission.status)) return 'pickup';
    if (['picked_up', 'in_transit', 'delivery_pending'].includes(mission.status)) return 'delivery';
    return 'completed';
  }, [mission.status]);

  const activePartyData = activeParty === 'seller' ? mission.seller : activeParty === 'buyer' ? mission.buyer : null;

  // Un battement par seconde, pour le compte à rebours ci-dessous.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ⚠️ CE LIBELLÉ EST UN COMPTE À REBOURS, ET IL NE COMPTAIT PAS. Le `useMemo`
  // ne dépendait que des heures de rendez-vous — c'est-à-dire de rien qui
  // change : « Prise en charge dans 01h23 » restait affiché tel quel pendant
  // qu'on regardait l'écran. Tant que la plus petite unité était la minute,
  // l'immobilité passait ; avec les secondes elle serait devenue criante.
  // `nowTick` remet donc le calcul en marche, une fois par seconde.
  const activePhaseLabel = useMemo(() => {
    if (!activeParty) return '';
    const targetTime = activeParty === 'seller' ? mission.pickupHub.scheduledTime : mission.deliveryHub.scheduledTime;
    const diffMs = dayjs(targetTime).diff(dayjs());
    const prefix = activeParty === 'seller' ? 'Prise en charge' : 'Co-livraison';

    if (diffMs <= 0) return `${prefix} — rendez-vous maintenant`;
    const totalSeconds = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const sec = totalSeconds % 60;
    const pad = (n: number) => String(n).padStart(2, '0');
    const duration = h > 0 ? `${pad(h)}h${pad(m)}m${pad(sec)}s` : `${m} min ${pad(sec)} s`;
    return `${prefix} dans ${duration}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeParty, mission.pickupHub.scheduledTime, mission.deliveryHub.scheduledTime, nowTick]);

  const handleOpenChat = (party: MissionParticipant, role: 'seller' | 'buyer') => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: party.id,
        name: party.name,
        role,
        avatar: party.avatar ?? '',
        missionId: mission.id,
        listingTitle: mission.package.description,
      },
    });
  };

  const canProposeOffHub = useMemo(() => {
    const targetTime = ['pickup_pending', 'group_created'].includes(mission.status)
      ? mission.pickupHub.scheduledTime
      : mission.deliveryHub.scheduledTime;
    const windowStart = dayjs(targetTime).subtract(10, 'minute');
    return dayjs().isBefore(windowStart) && !mission.offHubProposal;
  }, [mission]);

  const toast = (msg: string, type: 'success' | 'warning' | 'error' = 'success') => {
    setToastMsg(msg); setToastType(type); setShowToast(true);
  };

  const sendQuickMessage = (msg: string) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toast(`Message envoyé : "${msg}"`); };
  const handlePickup = () => router.push({ pathname: '/mission/pickup', params: { id: mission.id } });
  const handleDelivery = () => router.push({ pathname: '/mission/delivery', params: { id: mission.id } });
  const openIncident = (type: string) =>
    router.push({ pathname: '/incident/[type]' as any, params: { type, missionId: mission.id } });
  const handleNavigate = () => router.push({ pathname: '/navigate/[missionId]', params: { missionId: mission.id } });

  const handleOffHub = (target: 'seller' | 'buyer', address: string, time: string) => {
    setShowOffHub(false);
    proposeOffHub(mission.id, { target, address, proposedTime: time });
    toast('Proposition envoyée. En attente de réponse...');
    setTimeout(() => toast('Proposition acceptée ! Nouveau point confirmé.'), 3500);
  };

  const handleReportSellerAbsence = () => {
    Alert.alert('Signaler l\'absence du vendeur', 'La co-livraison sera annulée sans pénalité pour vous.', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Signaler', onPress: () => { reportSellerAbsence(mission.id); toast('Co-livraison annulée — absence du vendeur.', 'warning'); setTimeout(() => router.replace('/(tabs)/missions'), 2000); } },
    ]);
  };

  const handleReportBuyerAbsence = () => {
    Alert.alert('L\'acheteur ne s\'est pas présenté', 'Que souhaitez-vous faire ?', [
      { text: 'Attendre +5 min', onPress: () => { reportBuyerAbsence(mission.id, true); toast('Tolérance étendue.'); } },
      { text: 'Annuler', style: 'destructive', onPress: () => { reportBuyerAbsence(mission.id, false); toast('Co-livraison annulée.', 'warning'); setTimeout(() => router.replace('/(tabs)/missions'), 2000); } },
      { text: 'Patienter', style: 'cancel' },
    ]);
  };

  const handleCancelMission = () => {
    const hasPackage = ['picked_up', 'in_transit', 'delivery_pending'].includes(mission.status);
    const reason = hasPackage ? 'transporter_cancelled_after_pickup' as const : 'transporter_cancelled_before_pickup' as const;
    const msg = hasPackage
      ? 'Vous avez le colis. Veuillez le remettre au hub le plus proche.'
      : 'L\'annulation sera notée sur votre profil.';

    Alert.alert(hasPackage ? 'Vous avez le colis' : 'Annuler la co-livraison ?', msg, [
      { text: 'Retour', style: 'cancel' },
      { text: hasPackage ? 'J\'ai remis le colis' : 'Confirmer l\'annulation', style: 'destructive', onPress: () => { cancelMission(mission.id, reason); toast('Co-livraison annulée.', 'warning'); setTimeout(() => router.replace('/(tabs)/missions'), 2000); } },
    ]);
  };

  const isPickupLate = mission.status === 'pickup_pending' && dayjs().isAfter(dayjs(mission.pickupHub.scheduledTime).add(mission.pickupHub.toleranceMinutes, 'minute'));
  const isDeliveryLate = mission.status === 'delivery_pending' && dayjs().isAfter(dayjs(mission.deliveryHub.scheduledTime).add(mission.deliveryHub.toleranceMinutes, 'minute'));

  return (
    <View style={[gs.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title={`Co-livraison #${missionCode}`} showBack />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[gs.scroll, { paddingBottom: insets.bottom + Spacing.xxl }]}>

        {/* Support hold banner — mission « en attente », payments suspended */}
        {mission.supportHold && (
          <View style={[gs.banner, { backgroundColor: colors.error + '12' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <Icon name="shield" size={14} color={colors.error} />
              <Text style={[gs.bannerText, { color: colors.error }]}>{t('missions.supportHoldBanner')}</Text>
            </View>
          </View>
        )}

        {/* TODO(backend): remove before production — dev-only support decision.
            Admin UI is out of scope; this triggers the human decision's effects. */}
        {__DEV__ && mission.supportHold && !mission.supportOutcome && (
          <View style={gs.devBar}>
            <Text style={gs.devLabel}>DEV · Décision support</Text>
            <View style={gs.devBtnRow}>
              {([
                { o: 'danger_confirmed' as const, l: 'Danger confirmé' },
                { o: 'good_faith' as const, l: 'Bonne foi' },
                { o: 'abusive' as const, l: 'Abusif' },
              ]).map(({ o, l }) => (
                <TouchableOpacity
                  key={o}
                  style={[gs.devBtn, { backgroundColor: '#F5A623' }]}
                  onPress={() => resolveSupportReview(mission.id, o)}
                  accessibilityLabel={`Dev: resolve support as ${o}`}
                >
                  <Text style={gs.devBtnText}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Support decision reflected to the co-transporteur */}
        {mission.supportOutcome && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <SupportDecisionCard
              outcome={mission.supportOutcome}
              pedagogicalReminder={mission.pedagogicalReminder}
              separated={separatedPairs.some((p) => {
                const other = mission.reportedUserId ?? mission.buyer.id;
                return (
                  (p.a === mission.transporter.id && p.b === other) ||
                  (p.a === other && p.b === mission.transporter.id)
                );
              })}
            />
            <TouchableOpacity onPress={() => openIncident('contest_decision')} hitSlop={12} style={gs.contestBtn}>
              <Text style={[gs.offHubLink, { color: colors.primary }]}>Contester la décision du support (F14)</Text>
            </TouchableOpacity>
          </Animated.View>
        )}

        {/* Off-hub active banner */}
        {mission.offHubProposal?.status === 'accepted' && (
          <View style={[gs.banner, { backgroundColor: colors.warning + '12' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Icon name="location-filled" size={14} color={colors.warning} /><Text style={[gs.bannerText, { color: colors.warning }]}>{t('zone.offHubNoGps')}</Text></View>
          </View>
        )}

        {/* Participants (3 bubbles + directional gold arrow) */}
        <Animated.View entering={FadeInDown.delay(100).duration(300)}>
          <ParticipantsCard
            seller={mission.seller}
            buyer={mission.buyer}
            transporter={mission.transporter}
            activeParty={activeParty}
            onPressParticipant={handleOpenChat}
          />
        </Animated.View>

        {/* Active counterparty card (prominent, tappable to chat) */}
        {activeParty && activePartyData && (
          <Animated.View entering={FadeInDown.delay(150).duration(300)}>
            <ActivePartyCard
              party={activePartyData}
              contextLabel={activeParty === 'seller' ? 'Vendeur' : 'Acheteur'}
              phase={activePhaseLabel}
              onPress={() => handleOpenChat(activePartyData, activeParty)}
            />
          </Animated.View>
        )}

        {/* Schedule reminder with live countdown */}
        {reminderPhase !== 'completed' && (
          <Animated.View entering={FadeInDown.delay(180).duration(300)}>
            <ScheduleReminderCard
              pickupTime={mission.pickupHub.scheduledTime}
              pickupHubName={mission.pickupHub.name}
              deliveryTime={mission.deliveryHub.scheduledTime}
              deliveryHubName={mission.deliveryHub.name}
              pickupActualTime={mission.pickupHub.actualTime}
              phase={reminderPhase}
            />
          </Animated.View>
        )}

        {/* Big context-aware action button */}
        {reminderPhase !== 'completed' && (
          <Animated.View entering={FadeInDown.delay(220).duration(300)}>
            <DirectionHubButton
              phase={reminderPhase}
              hubName={reminderPhase === 'pickup' ? mission.pickupHub.name : mission.deliveryHub.name}
              onPress={() =>
                router.push({
                  pathname: reminderPhase === 'pickup' ? '/mission/pickup' : '/mission/delivery',
                  params: { id: mission.id },
                })
              }
              onNavigatePress={() =>
                router.push({
                  pathname: '/navigate/[missionId]',
                  params: { missionId: mission.id, dest: reminderPhase },
                })
              }
            />
          </Animated.View>
        )}

        {/* La validation de présence (créneau + proximité) vit désormais dans le
            flux « Action suivante » (scan QR pickup/delivery) — demande client :
            plus de section « Zone du hub » séparée sur le détail de mission. */}

        {/* No-show alerts */}
        {isPickupLate && (
          <Card style={{ backgroundColor: colors.error + '08', borderColor: colors.error + '30' }}>
            <Text style={[gs.alertTitle, { color: colors.error }]}>Le vendeur ne s'est pas présenté</Text>
            <Text style={[gs.alertDesc, { color: colors.textSecondary }]}>Pas d'inquiétude, aucune pénalité pour vous.</Text>
            <Button title="Signaler l'absence" onPress={handleReportSellerAbsence} variant="danger" />
          </Card>
        )}
        {isDeliveryLate && (
          <Card style={{ backgroundColor: colors.warning + '08', borderColor: colors.warning + '30' }}>
            <Text style={[gs.alertTitle, { color: colors.warning }]}>L'acheteur ne s'est pas présenté</Text>
            <Text style={[gs.alertDesc, { color: colors.textSecondary }]}>{"Vous pouvez attendre ou déclarer l'absence de l'acheteur."}</Text>
            <Button title="Déclarer l'absence de l'acheteur" onPress={() => openIncident('buyer_absent')} variant="danger" />
            <View style={{ height: Spacing.sm }} />
            <Button title="Options" onPress={handleReportBuyerAbsence} variant="outline" />
          </Card>
        )}

        {/* Incident forms — hub de remise (F2–F6) */}
        {reminderPhase === 'delivery' && (
          <View style={gs.incidentsBlock}>
            <Text style={[gs.section, { color: colors.text }]}>Incidents — hub de remise</Text>
            {INCIDENTS_REMISE.map((it) => (
              <TouchableOpacity
                key={it.type}
                onPress={() => openIncident(it.type)}
                style={[gs.incidentRow, { borderColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={it.label}
              >
                <Icon name="document" size={16} color={colors.textSecondary} />
                <Text style={[gs.incidentLabel, { color: colors.text }]}>{it.label}</Text>
                <Icon name="chevron-right" size={16} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Timeline */}
        <Animated.View entering={FadeInDown.delay(200).duration(300)}>
          <Text style={[gs.section, { color: colors.text }]}>Suivi de co-livraison</Text>
          <MissionTimeline mission={mission} onPickup={handlePickup} onDelivery={handleDelivery} onNavigate={handleNavigate} />
        </Animated.View>

        {/* Off-hub + report links */}
        {canProposeOffHub && (
          <TouchableOpacity onPress={() => setShowOffHub(true)} hitSlop={12}>
            <Text style={[gs.offHubLink, { color: colors.primary }]}>Proposer hors hub</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          onPress={() => {
            Alert.alert('Signaler un hub', 'Quel hub souhaitez-vous signaler ?', [
              {
                text: `Hub vendeur — ${mission.pickupHub.name}`,
                onPress: () =>
                  router.push({
                    pathname: '/hub/report' as any,
                    params: {
                      hubId: mission.pickupHub.id,
                      hubName: mission.pickupHub.name,
                      hubAddress: mission.pickupHub.city,
                    },
                  }),
              },
              {
                text: `Hub acheteur — ${mission.deliveryHub.name}`,
                onPress: () =>
                  router.push({
                    pathname: '/hub/report' as any,
                    params: {
                      hubId: mission.deliveryHub.id,
                      hubName: mission.deliveryHub.name,
                      hubAddress: mission.deliveryHub.city,
                    },
                  }),
              },
              { text: 'Annuler', style: 'cancel' },
            ]);
          }}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Signaler un hub"
        >
          <Text style={[gs.offHubLink, { color: colors.textSecondary }]}>Signaler un hub</Text>
        </TouchableOpacity>
        {!canProposeOffHub && !mission.offHubProposal && (
          <Text style={[gs.offHubDisabled, { color: colors.textSecondary }]}>Le hors hub n'est plus disponible.</Text>
        )}
        {mission.offHubProposal?.status === 'pending' && (
          <View style={[gs.banner, { backgroundColor: colors.primary + '08' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Icon name="hourglass" size={14} color={colors.primary} /><Text style={[gs.bannerText, { color: colors.primary }]}>Proposition hors hub en attente...</Text></View>
          </View>
        )}

        {/* Ad banner */}
        <Animated.View entering={FadeInDown.delay(250).duration(300)}>
          <AdBanner index={new Date().getDay() + 1} />
        </Animated.View>

        {/* Quick messages */}
        <Animated.View entering={FadeInDown.delay(300).duration(300)}>
          <Text style={[gs.section, { color: colors.text }]}>Messages rapides</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={gs.msgs}>
            {QUICK_MESSAGES.map((m, i) => (
              <TouchableOpacity key={i} onPress={() => sendQuickMessage(m)} style={[gs.msgPill, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[gs.msgText, { color: colors.text }]}>{m}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>

        {/* Responsibilities */}
        <Animated.View entering={FadeInDown.delay(400).duration(300)}>
          <ResponsibilitiesCard />
        </Animated.View>

        {/* Package */}
        <Animated.View entering={FadeInDown.delay(500).duration(300)}>
          <TouchableOpacity onPress={() => setPackageExpanded(!packageExpanded)} activeOpacity={0.8}>
            <Card>
              <View style={gs.pkgH}>
                <View style={gs.pkgHL}>
                  <View style={[gs.pkgT, { backgroundColor: colors.primary + '10' }]}><Icon name="package" size={22} color={colors.primary} /></View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[gs.pkgTitle, { color: colors.text }]} numberOfLines={1}>{mission.package.description}</Text>
                    <Text style={[gs.pkgSub, { color: colors.textSecondary }]}>Taille {mission.package.size} — {mission.package.weight} kg</Text>
                  </View>
                </View>
                <Text style={{ color: colors.textSecondary }}>{packageExpanded ? '▴' : '▾'}</Text>
              </View>
              {packageExpanded && (
                <View style={[gs.pkgD, { borderTopColor: colors.border }]}>
                  <DR l="Participation aux frais" v={formatCurrency(mission.transporterEarning)} c={colors} vc={colors.success} />
                </View>
              )}
            </Card>
          </TouchableOpacity>
        </Animated.View>

        {/* Eco impact */}
        {missionKgSaved > 0 && (
          <Animated.View entering={FadeInDown.delay(550).duration(300)}>
            <EcoImpactCard kgSaved={missionKgSaved} variant="compact" />
          </Animated.View>
        )}

        {/* Annulation & contestation forms (F9/F10/F12) */}
        <View style={gs.incidentsBlock}>
          <Text style={[gs.section, { color: colors.text }]}>Annulation & contestation</Text>
          {ANNULATIONS.map((it) => (
            <TouchableOpacity
              key={it.type}
              onPress={() => openIncident(it.type)}
              style={[gs.incidentRow, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel={it.label}
            >
              <Icon name="close" size={16} color={colors.textSecondary} />
              <Text style={[gs.incidentLabel, { color: colors.text }]}>{it.label}</Text>
              <Icon name="chevron-right" size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        {/* Cancel */}
        <TouchableOpacity onPress={handleCancelMission} hitSlop={12} style={gs.cancelBtn}>
          <Text style={[gs.cancelText, { color: colors.error }]}>Annuler la co-livraison</Text>
        </TouchableOpacity>

        {/* 🔴 LE MARCHEUR DE PHASES A ÉTÉ RETIRÉ LE 22/08/2026. Il faisait
            avancer le statut de la mission d'un cran par appui — jusqu'à
            « livré ». Depuis `20260822260000`, ce statut est une PROJECTION de
            l'état du colis, forcée par un trigger : le bouton n'aurait plus
            menti qu'À L'ÉCRAN, en affichant une remise que la base ignore.
            C'est précisément le mensonge que la projection existe pour
            empêcher, réintroduit côté client. */}
      </ScrollView>

      <OffHubProposalSheet visible={showOffHub} onClose={() => setShowOffHub(false)} onSend={handleOffHub} pickupHubName={mission.pickupHub.name} deliveryHubName={mission.deliveryHub.name} />
      <Toast message={toastMsg} type={toastType} visible={showToast} onHide={() => setShowToast(false)} duration={2500} />
    </View>
  );
}

function DR({ l, v, c, vc }: { l: string; v: string; c: any; vc?: string }) {
  return <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={[gs.pkgSub, { color: c.textSecondary }]}>{l}</Text><Text style={[gs.pkgTitle, { color: vc ?? c.text }]}>{v}</Text></View>;
}

const gs = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.xl },
  notFound: { ...Typography.body, textAlign: 'center', marginTop: Spacing.section },
  section: { ...Typography.h3, marginBottom: Spacing.md },
  banner: { paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg, borderRadius: BorderRadius.md },
  bannerText: { ...Typography.captionMedium, textAlign: 'center' },
  alertTitle: { ...Typography.bodyMedium, marginBottom: Spacing.xs },
  alertDesc: { ...Typography.caption, lineHeight: 18, marginBottom: Spacing.md },
  offHubLink: { ...Typography.captionMedium, textDecorationLine: 'underline', textAlign: 'center' },
  incidentsBlock: { gap: Spacing.sm },
  incidentRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1 },
  incidentLabel: { ...Typography.body, flex: 1 },
  contestBtn: { alignItems: 'center', paddingTop: Spacing.sm },
  offHubDisabled: { ...Typography.caption, textAlign: 'center', fontStyle: 'italic' },
  msgs: { gap: Spacing.sm, paddingRight: Spacing.lg },
  msgPill: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1 },
  msgText: { ...Typography.caption },
  pkgH: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pkgHL: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, flex: 1 },
  pkgT: { width: 44, height: 44, borderRadius: BorderRadius.sm, alignItems: 'center', justifyContent: 'center' },
  pkgTitle: { ...Typography.bodyMedium },
  pkgSub: { ...Typography.caption },
  pkgD: { borderTopWidth: 0.5, marginTop: Spacing.md, paddingTop: Spacing.md, gap: Spacing.sm },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.md },
  cancelText: { ...Typography.captionMedium, textDecorationLine: 'underline' },

  // Dev-only demo bar — TODO(backend): remove before production
  devBar: {
    marginTop: Spacing.md,
    marginHorizontal: Spacing.xs,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: '#F5A62344',
    backgroundColor: '#F5A62310',
    gap: Spacing.sm,
  },
  devLabel: { ...Typography.caption, color: '#F5A623', letterSpacing: 0.5, textAlign: 'center' },
  devBtnRow: { flexDirection: 'row', gap: Spacing.sm },
  devBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, alignItems: 'center' },
  devBtnText: { ...Typography.captionMedium, color: '#FFFFFF', letterSpacing: 0.5 },
});
