// LES HUBS DE REMISE — même correction que pour la récupération.
//
// 🔴 CET ÉCRAN LISAIT LES VINGT-CINQ HUBS INVENTÉS de `services/mock/hubs.ts`.
// `public.hubs` est vide : les points relais sont des gens qui se portent
// candidats, et le recrutement se fait au lancement.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { ProgressSteps } from '@/components/ui/ProgressSteps';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { STEP_LABELS } from '@/types/route';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useRouteStore } from '@/stores/useRouteStore';
import { Icon } from '@/components/ui/Icon';
import { chargerHubsParVille } from '@/services/hubs';
import { iconeHub } from '@/constants/HubTypes';
import type { Hub } from '@/types/hub';
import type { RouteHub } from '@/types/route';

const MAX_HUBS = 3;

export default function HubDeliveryScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { form, setFormField, setStep } = useRouteStore();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [chargement, setChargement] = useState(true);
  const ville = form.arrivalCity ?? '';

  useEffect(() => {
    let annule = false;
    setChargement(true);
    chargerHubsParVille(ville)
      .then((h) => { if (!annule) setHubs(h); })
      .catch((e: unknown) => {
        console.error('[hubs] lecture impossible', e);
        if (!annule) setHubs([]);
      })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [ville]);

  // 🔴 UNE REMISE SANS HUB EST LÉGITIME : `route_stops.hub_id` est nullable, et
  // la remise se fait alors en main propre — ce que l'application sait déjà
  // gérer (`off_hub_possible`, `is_off_hub`).
  const continuerSansHub = useCallback(() => {
    setFormField('deliveryHubs', [
      { hubId: '', hubName: ville, city: ville, arrivalTime: '' },
    ]);
    setStep(5);
    router.push('/publish/schedule');
  }, [setFormField, setStep, router, ville]);

  const selectedIds = form.deliveryHubs.map((h) => h.hubId);
  const atMax = selectedIds.length >= MAX_HUBS;

  const toggleHub = (hub: Hub) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (selectedIds.includes(hub.id)) {
      setFormField('deliveryHubs', form.deliveryHubs.filter((h) => h.hubId !== hub.id));
    } else if (!atMax) {
      const newHub: RouteHub = { hubId: hub.id, hubName: hub.name, city: hub.city, arrivalTime: '' };
      setFormField('deliveryHubs', [...form.deliveryHubs, newHub]);
    }
  };

  const removeHub = (hubId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormField('deliveryHubs', form.deliveryHubs.filter((h) => h.hubId !== hubId));
  };

  const handleNext = () => {
    setStep(5);
    router.push('/publish/schedule');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title="Publier un trajet" showBack />
        <ProgressSteps current={4} total={8} label={STEP_LABELS[3]} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Hubs de remise</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Où pourrez-vous remettre les colis ? (1 à {MAX_HUBS} hubs)
        </Text>
        <Text style={[styles.info, { color: colors.textSecondary }]}>
          Sélectionnez uniquement les hubs compatibles avec votre trajet prévu.
        </Text>

        {/* Selected chips */}
        {form.deliveryHubs.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
            {form.deliveryHubs.map((hub) => (
              <TouchableOpacity key={hub.hubId} onPress={() => removeHub(hub.hubId)} style={[styles.chip, { backgroundColor: colors.primary + '12', borderColor: colors.primary }]}>
                <Text style={[styles.chipText, { color: colors.primary }]}>{hub.hubName}</Text>
                <Text style={[styles.chipX, { color: colors.primary }]}>✕</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Counter */}
        <Text style={[styles.counter, { color: colors.primary }]}>
          {selectedIds.length}/{MAX_HUBS} hubs sélectionnés
        </Text>

        <FlatList
          data={hubs}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
          ListEmptyComponent={
            chargement ? (
              <Text style={[styles.info, { color: colors.textSecondary }]}>
                Recherche des points relais…
              </Text>
            ) : (
              /* 🔴 MÊME ÉTAT VIDE QU'À LA RÉCUPÉRATION, et pour la même raison :
                 le réseau se constitue au lancement. Une étape obligatoire sur
                 une liste vide est une impasse, pas une exigence. */
              <View style={{ gap: Spacing.md }}>
                <Text style={[styles.info, { color: colors.textSecondary }]}>
                  Aucun point relais à {ville} pour l’instant. Le réseau se
                  constitue — des habitants se portent candidats pour accueillir
                  les colis.
                </Text>
                <Button
                  title="Continuer sans point relais"
                  onPress={continuerSansHub}
                  variant="outline"
                />
              </View>
            )
          }
          renderItem={({ item }) => {
            const selected = selectedIds.includes(item.id);
            const dimmed = atMax && !selected;
            return (
              <TouchableOpacity onPress={() => toggleHub(item)} activeOpacity={0.8} disabled={dimmed}>
                <View style={[
                  styles.hubCard,
                  { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border, opacity: dimmed ? 0.45 : 1 },
                  selected && { borderWidth: 2 },
                ]}>
                  <View style={styles.hubTop}>
                    <View style={styles.hubNameRow}>
                      <Icon name={iconeHub(item.type)} size={20} color={colors.textSecondary} />
                      <Text style={[styles.hubName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    </View>
                    {selected && (
                      <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                        <Text style={styles.checkIcon}>✓</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.hubAddress, { color: colors.textSecondary }]}>{item.address}</Text>
                  {dimmed && <Text style={[styles.maxLabel, { color: colors.textSecondary }]}>Maximum atteint</Text>}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button title="Suivant" onPress={handleNext} variant="gradient" disabled={selectedIds.length === 0} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, paddingHorizontal: Spacing.xxl, paddingTop: Spacing.xl, gap: Spacing.md },
  title: { ...Typography.h1 },
  subtitle: { ...Typography.body, marginTop: -Spacing.xs },
  info: { ...Typography.caption, lineHeight: 18 },
  chipsRow: { gap: Spacing.sm, paddingVertical: Spacing.xs },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, gap: Spacing.xs },
  chipText: { ...Typography.captionMedium },
  chipX: { fontSize: 12, fontWeight: '700' },
  counter: { ...Typography.captionMedium },
  list: { paddingBottom: Spacing.md },
  hubCard: { borderWidth: 1.5, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.xs },
  hubTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hubNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, marginRight: Spacing.sm },
  hubTypeIcon: { fontSize: 20 },
  hubName: { ...Typography.bodyMedium, flex: 1 },
  hubAddress: { ...Typography.caption, paddingLeft: 28 },
  maxLabel: { ...Typography.caption, fontStyle: 'italic', paddingLeft: 28 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  footer: { paddingHorizontal: Spacing.xxl },
});
