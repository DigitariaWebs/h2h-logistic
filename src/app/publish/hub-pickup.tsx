// LE HUB DE RÉCUPÉRATION — celui qui existe, pas celui qu'on invente.
//
// 🔴 CET ÉCRAN LISAIT `getHubsByCity()` DE `services/mock/hubs.ts` : vingt-cinq
// adresses inventées, de Nice à Marseille, avec des identifiants qui ne sont
// même pas des uuid. Un cotransporteur particulier pouvait donc choisir « Gare
// de Nice-Ville » et s'y rendre — pour rien.
//
// ⚠️ `public.hubs` EST VIDE, ET CE N'EST PAS UN OUBLI : les hubs ne sont pas des
// lieux qu'on choisit, ce sont des gens qui se portent candidats. Le
// recrutement se fait au lancement. La liste sera donc vide pour l'instant, et
// c'est la vérité — on la dit, et on laisse publier sans hub plutôt que de
// bloquer sur un choix impossible.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet } from 'react-native';
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
import { iconeHub, libelleHub } from '@/constants/HubTypes';
import type { Hub } from '@/types/hub';

type ViewMode = 'list' | 'map';

export default function HubPickupScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { form, setFormField, setStep } = useRouteStore();

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [chargement, setChargement] = useState(true);
  const ville = form.departureCity ?? '';

  useEffect(() => {
    let annule = false;
    setChargement(true);
    chargerHubsParVille(ville)
      .then((h) => { if (!annule) setHubs(h); })
      .catch((e: unknown) => {
        // ⚠️ SANS CETTE TRACE, une policy refusée est indiscernable d'une ville
        // sans point relais — et il n'y a aujourd'hui aucun moyen de les
        // distinguer à l'écran.
        console.error('[hubs] lecture impossible', e);
        if (!annule) setHubs([]);
      })
      .finally(() => { if (!annule) setChargement(false); });
    return () => { annule = true; };
  }, [ville]);

  const selectedId = form.pickupHub?.hubId;

  const selectHub = (hub: Hub) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFormField('pickupHub', { hubId: hub.id, hubName: hub.name, city: hub.city, arrivalTime: '' });
  };

  // 🔴 PUBLIER SANS HUB EST UN ÉTAT LÉGITIME, pas un contournement.
  // `published_routes.departure_hub_id` est nullable, `route_stops.city` aussi :
  // un trajet ville → ville reste exploitable par l'appariement, et la remise se
  // fait alors hors hub — ce que l'application sait déjà gérer
  // (`off_hub_possible`, `is_off_hub` sur les co-livraisons).
  const continuerSansHub = useCallback(() => {
    setFormField('pickupHub', { hubId: '', hubName: ville, city: ville, arrivalTime: '' });
    setStep(4);
    router.push('/publish/hub-delivery');
  }, [setFormField, setStep, router, ville]);

  const handleNext = () => {
    setStep(4);
    router.push('/publish/hub-delivery');
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top, paddingHorizontal: Spacing.lg }}>
        <Header title="Publier un trajet" showBack />
        <ProgressSteps current={3} total={8} label={STEP_LABELS[2]} />
      </View>

      <View style={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>Hub de récupération</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Où pourrez-vous récupérer les colis ?
        </Text>
        <Text style={[styles.info, { color: colors.textSecondary }]}>
          Sélectionnez un hub validé dans votre ville de départ ({form.departureCity}).
        </Text>

        {/* View mode toggle */}
        <View style={[styles.toggleRow, { backgroundColor: colors.border + '30' }]}>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={[styles.toggleBtn, viewMode === 'list' && { backgroundColor: colors.surface }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="clipboard" size={14} color={viewMode === 'list' ? colors.text : colors.textSecondary} /><Text style={[styles.toggleText, { color: viewMode === 'list' ? colors.text : colors.textSecondary }]}>Liste</Text></View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('map')}
            style={[styles.toggleBtn, viewMode === 'map' && { backgroundColor: colors.surface }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="map-overview" size={14} color={viewMode === 'map' ? colors.text : colors.textSecondary} /><Text style={[styles.toggleText, { color: viewMode === 'map' ? colors.text : colors.textSecondary }]}>Carte</Text></View>
          </TouchableOpacity>
        </View>

        {viewMode === 'map' ? (
          /* ─── Map View (MapLibre placeholder) ─── */
          <View style={[styles.mapContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Icon name="map-overview" size={48} color={colors.textSecondary} />
            <Text style={[styles.mapText, { color: colors.textSecondary }]}>
              Carte MapLibre — {hubs.length} hubs
            </Text>
            <Text style={[styles.mapHint, { color: colors.textSecondary }]}>
              Nécessite un development build
            </Text>
            {/* Hub pins as simple list below map */}
            {hubs.map((hub) => {
              const selected = hub.id === selectedId;
              return (
                <TouchableOpacity
                  key={hub.id}
                  onPress={() => selectHub(hub)}
                  style={[styles.mapPin, { backgroundColor: selected ? colors.primary + '15' : 'transparent', borderBottomColor: colors.border }]}
                >
                  <Icon name={iconeHub(hub.type)} size={18} color={colors.textSecondary} />
                  <Text style={[styles.mapPinName, { color: colors.text }]} numberOfLines={1}>{hub.name}</Text>
                  {selected && <Text style={[styles.mapPinCheck, { color: colors.primary }]}>✓</Text>}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          /* ─── List View ─── */
          <FlatList
            data={hubs}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.list}
            ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
            ListEmptyComponent={
              chargement ? (
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  Recherche des points relais…
                </Text>
              ) : (
                /* 🔴 L'ÉTAT VIDE EST L'ÉTAT NORMAL AUJOURD'HUI, et il ne doit
                   pas être une impasse. Les points relais sont des gens qui se
                   portent candidats, et le recrutement se fait au lancement :
                   dire « aucun hub trouvé » puis bloquer le bouton laisserait
                   un cotransporteur particulier devant une étape qu'il ne peut
                   pas franchir, sans comprendre pourquoi. */
                <View style={{ gap: Spacing.md }}>
                  <Text style={[styles.empty, { color: colors.textSecondary }]}>
                    Aucun point relais à {ville} pour l’instant. Le réseau se
                    constitue — des habitants se portent candidats pour accueillir
                    les colis.
                  </Text>
                  <Button
                    title="Continuer sans point relais"
                    onPress={continuerSansHub}
                    variant="outline"
                  />
                  <Text style={[styles.empty, { color: colors.textSecondary }]}>
                    La remise se fera alors directement, en main propre, à l’endroit
                    convenu avec le vendeur et l’acheteur.
                  </Text>
                </View>
              )
            }
            renderItem={({ item }) => {
              const selected = item.id === selectedId;
              return (
                <TouchableOpacity onPress={() => selectHub(item)} activeOpacity={0.8}>
                  <View style={[
                    styles.hubCard,
                    { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.border },
                    selected && { borderWidth: 2 },
                  ]}>
                    {/* Top row */}
                    <View style={styles.hubTop}>
                      <View style={styles.hubNameRow}>
                        <Icon name={iconeHub(item.type)} size={20} color={colors.textSecondary} />
                        <Text style={[styles.hubName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                      </View>
                      {selected ? (
                        <View style={[styles.checkCircle, { backgroundColor: colors.primary }]}>
                          <Text style={styles.checkIcon}>✓</Text>
                        </View>
                      ) : (
                        <Badge label={libelleHub(item.type)} variant="outline" />
                      )}
                    </View>

                    {/* Address + hours */}
                    <Text style={[styles.hubAddress, { color: colors.textSecondary }]}>{item.address}</Text>
                    <Text style={[styles.hubHours, { color: colors.textSecondary }]}>{item.openingHours}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button title="Suivant" onPress={handleNext} variant="gradient" disabled={!selectedId} />
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

  // Toggle
  toggleRow: { flexDirection: 'row', borderRadius: BorderRadius.sm, padding: 3, gap: 0 },
  toggleBtn: { flex: 1, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm - 2, alignItems: 'center' },
  toggleText: { ...Typography.captionMedium },

  // Map
  mapContainer: { flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.lg, alignItems: 'center', gap: Spacing.sm },
  mapEmoji: { fontSize: 48, marginTop: Spacing.xl },
  mapText: { ...Typography.bodyMedium },
  mapHint: { ...Typography.caption, marginBottom: Spacing.md },
  mapPin: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.md, paddingHorizontal: Spacing.sm, borderBottomWidth: 0.5, width: '100%', borderRadius: BorderRadius.sm },
  mapPinIcon: { fontSize: 18 },
  mapPinName: { ...Typography.body, flex: 1 },
  mapPinCheck: { fontSize: 16, fontWeight: '700' },

  // List
  list: { paddingBottom: Spacing.md },
  empty: { ...Typography.body, textAlign: 'center', paddingVertical: Spacing.xxl },

  // Hub card
  hubCard: { borderWidth: 1.5, borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.xs },
  hubTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hubNameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flex: 1, marginRight: Spacing.sm },
  hubTypeIcon: { fontSize: 20 },
  hubName: { ...Typography.bodyMedium, flex: 1 },
  hubAddress: { ...Typography.caption, paddingLeft: 28 },
  hubHours: { ...Typography.caption, paddingLeft: 28 },
  checkCircle: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  checkIcon: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Partner
  partnerRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs, paddingLeft: 28 },
  packageCount: { paddingHorizontal: Spacing.sm, paddingVertical: 2, borderRadius: BorderRadius.full },
  packageCountText: { ...Typography.caption, fontSize: 11 },

  footer: { paddingHorizontal: Spacing.xxl },
});
