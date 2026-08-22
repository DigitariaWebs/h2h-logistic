import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { InterstitialAd } from '@/components/dashboard/InterstitialAd';
import { STEP_LABELS } from '@/types/route';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouteStore } from '@/stores/useRouteStore';
import { useAuthStore } from '@/stores/useAuthStore';

const DAYS_MAP: Record<number, string> = { 1: 'Lun', 2: 'Mar', 3: 'Mer', 4: 'Jeu', 5: 'Ven', 6: 'Sam', 7: 'Dim' };

export default function PublishReviewScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { form, publishRoute, isPublishing } = useRouteStore();
  const { user } = useAuthStore();

  const [showSuccess, setShowSuccess] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);

  // Success animation
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const goToStep = (step: number) => {
    const routes = ['type', 'cities', 'hub-pickup', 'hub-delivery', 'schedule', 'capacity', 'options'];
    const target = routes[step - 1];
    if (target) router.push(`/publish/${target}` as any);
  };

  const handlePublish = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    try {
      // ⚠️ PLUS D'IDENTIFIANT EN PARAMÈTRE : le serveur le déduit du jeton.
      // `publier_trajet` écrit `transporter_id = app.uid()`. L'ancien repli
      // `?? 'user-1'` publiait au nom d'un compte de démonstration.
      await publishRoute();

      // Show success
      setShowSuccess(true);
      checkOpacity.value = withTiming(1, { duration: 300 });
      checkScale.value = withSequence(
        withTiming(1.3, { duration: 300 }),
        withTiming(1, { duration: 200 }),
      );

      setTimeout(() => {
        setShowToast(true);
      }, 500);

      // Short interstitial after the success beat; we continue to the routes
      // tab when the user skips or taps through it (see onClose below).
      setTimeout(() => {
        setShowInterstitial(true);
      }, 1800);
    } catch {
      Alert.alert('Erreur', 'Impossible de publier le trajet. Veuillez réessayer.');
    }
  };

  if (showSuccess) {
    return (
      <View style={[styles.successScreen, { backgroundColor: colors.background }]}>
        <Animated.View style={[styles.successContent, checkStyle]}>
          <View style={[styles.successCircle, { backgroundColor: colors.success }]}>
            <Text style={styles.successCheck}>✓</Text>
          </View>
          <Text style={[styles.successTitle, { color: colors.text }]}>Trajet publié !</Text>
          <Text style={[styles.successSub, { color: colors.textSecondary }]}>
            Vous serez notifié lorsqu'une co-livraison compatible est proposée.
          </Text>
        </Animated.View>
        <Toast
          message="Trajet publié ! Vous serez notifié lorsqu'une co-livraison compatible est proposée."
          type="success"
          visible={showToast}
          onHide={() => setShowToast(false)}
          duration={2000}
        />
        {showInterstitial && (
          <InterstitialAd skipAfter={3} onClose={() => router.replace('/(tabs)/routes')} />
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title="Publier un trajet" showBack />
        <ProgressSteps current={8} total={8} label={STEP_LABELS[7]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.text }]}>Récapitulatif de votre trajet</Text>

        {/* Summary sections */}
        <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Type */}
          <ReviewRow
            label="Type"
            value={form.type === 'recurring' ? 'Trajet récurrent' : 'Trajet ponctuel'}
            onEdit={() => goToStep(1)}
            colors={colors}
          />

          {/* Corridor */}
          <ReviewRow
            label="Corridor"
            value={`${form.departureCity ?? '-'} → ${form.arrivalCity ?? '-'}`}
            onEdit={() => goToStep(2)}
            colors={colors}
          />

          {/* Pickup hub */}
          <ReviewRow
            label="Hub récupération"
            value={form.pickupHub?.hubName ?? '-'}
            sub={form.pickupHub?.city}
            onEdit={() => goToStep(3)}
            colors={colors}
          />

          {/* Delivery hubs */}
          <ReviewRow
            label={`Hub${form.deliveryHubs.length > 1 ? 's' : ''} co-livraison`}
            value={form.deliveryHubs.map((h) => h.hubName).join('\n')}
            onEdit={() => goToStep(4)}
            colors={colors}
          />

          {/* Schedule */}
          <ReviewRow
            label="Horaires"
            value={[
              form.pickupTime ? `Collecte : ${form.pickupTime}` : null,
              ...form.deliveryHubs.map((h) => {
                const t = form.deliveryTimes[h.hubId];
                return t ? `${h.hubName} : ${t}` : null;
              }),
            ].filter(Boolean).join('\n')}
            onEdit={() => goToStep(5)}
            colors={colors}
          />

          {/* Recurring days */}
          {form.type === 'recurring' && form.recurringDays.length > 0 && (
            <ReviewRow
              label="Jours"
              value={form.recurringDays.sort((a, b) => a - b).map((d) => DAYS_MAP[d] ?? d).join(', ')}
              onEdit={() => goToStep(5)}
              colors={colors}
            />
          )}

          {/* Capacity */}
          <ReviewRow
            label="Capacité"
            value={`${form.maxPackages} colis, taille ${form.maxSize ?? '-'}, ${form.maxWeight} kg max`}
            onEdit={() => goToStep(6)}
            colors={colors}
          />

          {/* Hors hub */}
          <ReviewRow
            label="Hors hub"
            value={form.horsHub ? 'Oui' : 'Non'}
            onEdit={() => goToStep(7)}
            colors={colors}
            isLast
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button
          title="Publier le trajet"
          onPress={handlePublish}
          variant="gradient"
          loading={isPublishing}
          style={{ minHeight: 52 }}
        />
      </View>
    </View>
  );
}

function ReviewRow({
  label,
  value,
  sub,
  onEdit,
  colors,
  isLast,
}: {
  label: string;
  value: string;
  sub?: string;
  onEdit: () => void;
  colors: any;
  isLast?: boolean;
}) {
  return (
    <View style={[reviewStyles.row, !isLast && { borderBottomWidth: 0.5, borderBottomColor: colors.border }]}>
      <View style={reviewStyles.rowContent}>
        <Text style={[reviewStyles.label, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[reviewStyles.value, { color: colors.text }]}>{value}</Text>
        {sub && <Text style={[reviewStyles.sub, { color: colors.textSecondary }]}>{sub}</Text>}
      </View>
      <TouchableOpacity onPress={onEdit} hitSlop={12}>
        <Text style={[reviewStyles.edit, { color: colors.primary }]}>Modifier</Text>
      </TouchableOpacity>
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: Spacing.md, gap: Spacing.md },
  rowContent: { flex: 1, gap: 2 },
  label: { ...Typography.caption },
  value: { ...Typography.bodyMedium },
  sub: { ...Typography.caption },
  edit: { ...Typography.captionMedium },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, paddingBottom: Spacing.lg, gap: Spacing.lg },
  title: { ...Typography.h1 },
  summaryCard: { borderWidth: 1, borderRadius: BorderRadius.lg, paddingHorizontal: Spacing.lg },
  footer: { paddingHorizontal: Spacing.xxl },
  // Success
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  successContent: { alignItems: 'center', gap: Spacing.lg },
  successCircle: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center' },
  successCheck: { color: '#FFFFFF', fontSize: 40, fontWeight: '700', lineHeight: 44 },
  successTitle: { ...Typography.h1 },
  successSub: { ...Typography.body, textAlign: 'center', paddingHorizontal: Spacing.xxxl },
});
