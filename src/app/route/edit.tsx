import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, TextInput, StyleSheet, Alert, Image } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { TRANSPORT_TYPES, PACKAGE_SIZES, type TransportTypeId, type PackageSize } from '@/constants/TransportTypes';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouteStore } from '@/stores/useRouteStore';

const WEIGHT_OPTIONS = [1, 2, 5, 10, 15, 20] as const;

export default function EditRouteScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { routes, updateRoute, hasActiveMission } = useRouteStore();

  const route = routes.find((r) => r.id === id);

  // 🔴 CES SIX `useState` ÉTAIENT DÉCLARÉS APRÈS LE `if (!route) return`, ce qui
  // faisait varier le nombre de hooks d'un rendu à l'autre : React lève
  // « Rendered more hooks than during the previous render » dès que le trajet
  // arrive. C'était le cas le plus net des quatre écrans concernés — six hooks
  // d'un coup.
  //
  // ⚠️ ILS S'INITIALISENT DEPUIS UN TRAJET QUI PEUT ÊTRE ABSENT. On donne donc
  // une valeur de repli ; elle ne s'affiche jamais, puisque la garde juste en
  // dessous rend l'écran « introuvable » dans ce cas.
  const [transportType, setTransportType] = useState<TransportTypeId>(
    route?.transportType ?? 'car',
  );
  const [maxPackages, setMaxPackages] = useState(route?.maxPackages ?? 1);
  const [maxSize, setMaxSize] = useState<PackageSize>(route?.maxSize ?? 'M');
  const [maxWeight, setMaxWeight] = useState(route?.maxWeight ?? 5);
  const [horsHub, setHorsHub] = useState(route?.horsHub ?? false);
  const [showToast, setShowToast] = useState(false);

  if (!route) {
    return (
      <View style={[s.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={{ paddingHorizontal: Spacing.lg }}><Header title="Modifier" showBack /></View>
        <Text style={[s.notFound, { color: colors.textSecondary }]}>Trajet introuvable</Text>
      </View>
    );
  }

  const hasMission = hasActiveMission(route.id);

  const handleSave = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    updateRoute(route.id, { transportType, maxPackages, maxSize, maxWeight, horsHub });
    setShowToast(true);
    setTimeout(() => router.back(), 1500);
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title="Modifier le trajet" showBack />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Mission lock banner */}
        {hasMission && (
          <View style={[s.lockBanner, { backgroundColor: colors.warning + '12', borderColor: colors.warning + '40' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Icon name="alert-circle" size={16} color={colors.warning} /><Text style={[s.lockTitle, { color: colors.warning }]}>Co-livraison en cours — modifications limitées</Text></View>
            <Text style={[s.lockDesc, { color: colors.textSecondary }]}>
              Les hubs et horaires ne peuvent pas être modifiés pendant une co-livraison active.
            </Text>
          </View>
        )}

        {/* Route info (read-only) */}
        <Card>
          <Text style={[s.sectionTitle, { color: colors.text }]}>Itinéraire</Text>
          <View style={s.readonlyRow}>
            <Text style={[s.readonlyLabel, { color: colors.textSecondary }]}>Corridor</Text>
            <Text style={[s.readonlyValue, { color: colors.text }]}>
              {route.departureCity} → {route.arrivalCity}
            </Text>
          </View>
          <View style={s.readonlyRow}>
            <Text style={[s.readonlyLabel, { color: colors.textSecondary }]}>Hub collecte</Text>
            <View style={s.readonlyValueRow}>
              <Text style={[s.readonlyValue, { color: colors.text }]}>{route.pickupHub.hubName}</Text>
              {hasMission && <Icon name="lock" size={12} color={colors.warning} />}
            </View>
          </View>
          {route.deliveryHubs.map((hub) => (
            <View key={hub.hubId} style={s.readonlyRow}>
              <Text style={[s.readonlyLabel, { color: colors.textSecondary }]}>Hub co-livraison</Text>
              <View style={s.readonlyValueRow}>
                <Text style={[s.readonlyValue, { color: colors.text }]}>{hub.hubName}</Text>
                {hasMission && <Icon name="lock" size={12} color={colors.warning} />}
              </View>
            </View>
          ))}
          <View style={s.readonlyRow}>
            <Text style={[s.readonlyLabel, { color: colors.textSecondary }]}>Horaire collecte</Text>
            <View style={s.readonlyValueRow}>
              <Text style={[s.readonlyValue, { color: colors.text }]}>{route.schedule.pickupTime}</Text>
              {hasMission && <Icon name="lock" size={12} color={colors.warning} />}
            </View>
          </View>
        </Card>

        {/* Transport type (editable) */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Moyen de transport</Text>
        <View style={s.grid}>
          {TRANSPORT_TYPES.map((t) => {
            const selected = transportType === t.id;
            return (
              <TouchableOpacity
                key={t.id}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setTransportType(t.id); }}
                style={s.gridItem}
              >
                <View style={[
                  s.gridCard,
                  { backgroundColor: selected ? colors.primary + '10' : colors.surface, borderColor: selected ? colors.primary : colors.border },
                  selected && { borderWidth: 2 },
                ]}>
                  <Image source={t.image} style={s.gridImage} resizeMode="contain" />
                  <Text style={[s.gridLabel, { color: selected ? colors.primary : colors.text }]}>{t.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Capacity (editable) */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Capacité</Text>
        <Card>
          {/* Packages stepper */}
          <View style={s.stepperSection}>
            <Text style={[s.fieldLabel, { color: colors.text }]}>Nombre max de colis</Text>
            <View style={s.stepperRow}>
              <TouchableOpacity
                onPress={() => maxPackages > 1 && setMaxPackages(maxPackages - 1)}
                style={[s.stepperBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.stepperIcon, { color: colors.text }]}>−</Text>
              </TouchableOpacity>
              <Text style={[s.stepperValue, { color: colors.primary }]}>{maxPackages}</Text>
              <TouchableOpacity
                onPress={() => maxPackages < 3 && setMaxPackages(maxPackages + 1)}
                style={[s.stepperBtn, { borderColor: colors.border }]}
              >
                <Text style={[s.stepperIcon, { color: colors.text }]}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Size */}
          <Text style={[s.fieldLabel, { color: colors.text, marginTop: Spacing.lg }]}>Taille max</Text>
          <View style={s.sizesRow}>
            {PACKAGE_SIZES.map((size) => {
              const selected = maxSize === size;
              return (
                <TouchableOpacity
                  key={size}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMaxSize(size); }}
                  style={[s.sizeChip, { backgroundColor: selected ? colors.primary : 'transparent', borderColor: selected ? colors.primary : colors.border }]}
                >
                  <Text style={[s.sizeText, { color: selected ? '#FFFFFF' : colors.text }]}>{size}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Weight */}
          <Text style={[s.fieldLabel, { color: colors.text, marginTop: Spacing.lg }]}>Poids max</Text>
          <View style={s.weightRow}>
            {WEIGHT_OPTIONS.map((w) => {
              const selected = maxWeight === w;
              return (
                <TouchableOpacity
                  key={w}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setMaxWeight(w); }}
                  style={[s.weightChip, { backgroundColor: selected ? colors.primary : 'transparent', borderColor: selected ? colors.primary : colors.border }]}
                >
                  <Text style={[s.weightText, { color: selected ? '#FFFFFF' : colors.text }]}>{w}{w === 20 ? '+' : ''} kg</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Card>

        {/* Hors hub toggle */}
        <Text style={[s.sectionTitle, { color: colors.text }]}>Options</Text>
        <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, marginRight: Spacing.md }}>
            <Text style={[s.fieldLabel, { color: colors.text }]}>Hors hub possible</Text>
            <Text style={[s.fieldHint, { color: colors.textSecondary }]}>Accepter des remises hors hub</Text>
          </View>
          <Switch
            value={horsHub}
            onValueChange={(v) => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setHorsHub(v); }}
            trackColor={{ false: colors.border, true: colors.success }}
            thumbColor="#FFFFFF"
          />
        </Card>
      </ScrollView>

      {/* Save button */}
      <View style={[s.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button title="Enregistrer" onPress={handleSave} variant="gradient" style={{ minHeight: 52 }} />
      </View>

      <Toast message="Trajet mis à jour !" type="success" visible={showToast} onHide={() => setShowToast(false)} duration={1500} />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  notFound: { ...Typography.body, textAlign: 'center', marginTop: Spacing.section },
  scroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg, gap: Spacing.xl },

  // Lock banner
  lockBanner: { padding: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.xs },
  lockTitle: { ...Typography.captionMedium },
  lockDesc: { ...Typography.caption, lineHeight: 18 },

  sectionTitle: { ...Typography.h3 },

  // Readonly
  readonlyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm },
  readonlyLabel: { ...Typography.caption },
  readonlyValue: { ...Typography.captionMedium },
  readonlyValueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  lockIcon: { fontSize: 12 },

  // Transport grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  gridItem: { width: '31%' },
  gridCard: { alignItems: 'center', paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1.5, gap: Spacing.xs },
  gridImage: { width: 36, height: 36 },
  gridLabel: { ...Typography.caption },

  // Capacity
  stepperSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  fieldLabel: { ...Typography.bodyMedium },
  fieldHint: { ...Typography.caption, marginTop: 2 },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  stepperBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  stepperIcon: { fontSize: 18, lineHeight: 20 },
  stepperValue: { fontFamily: 'Poppins_700Bold', fontSize: 22, minWidth: 30, textAlign: 'center' },
  sizesRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  sizeChip: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  sizeText: { ...Typography.captionMedium },
  weightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  weightChip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1.5 },
  weightText: { ...Typography.captionMedium },

  footer: { paddingHorizontal: Spacing.lg },
});
