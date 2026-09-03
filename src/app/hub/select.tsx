// LA LISTE DES HUBS — LA VRAIE, MÊME QUAND ELLE EST VIDE.
//
// 🔴 CET ÉCRAN AFFICHAIT `mockHubs` : VINGT-SIX ADRESSES INVENTÉES. C'est
// exactement ce contre quoi `services/hubs.ts` met en garde — « mieux vaut une
// liste vide que vingt-cinq adresses où un cotransporteur irait pour rien ».
// Un hub ne se place pas, il se recrute (`candidater_hub`) ; `public.hubs` est
// donc vide tant que personne n'a candidaté, et cet écran le montrait plein.
//
// ⚠️ IL RESTE DORMANT, ET C'EST ASSUMÉ. Aucun écran n'y mène aujourd'hui : il
// n'existe pas encore de geste où l'on CHOISIT un hub — les trajets affichent
// les leurs en lecture seule. On le garde prêt pour le jour où les hubs
// embarqueront, comme `(auth)/phone` est gardé dessiné et dormant en attendant
// que Clerk accepte les numéros français. La différence qui compte : un écran
// dormant a le droit d'attendre, pas de mentir.
import React, { useEffect, useState } from 'react';
import { View, FlatList, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { HubCard } from '@/components/logistics/HubCard';
import { Spacing } from '@/constants/Spacing';
import { useTranslation } from '@/hooks/useTranslation';
import { chargerHubs } from '@/services/hubs';
import type { Hub } from '@/types/hub';

export default function HubSelectScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [hubs, setHubs] = useState<Hub[]>([]);

  // ⚠️ UNE LISTE VIDE N'EST PAS UNE PANNE, c'est l'état exact du réseau tant
  // qu'aucun hub n'a candidaté. On trace quand même l'erreur : sans cela, un
  // refus de lecture serait indiscernable de ce vide légitime.
  useEffect(() => {
    let vivant = true;
    chargerHubs()
      .then((l) => { if (vivant) setHubs(l); })
      .catch((e: unknown) => console.error('[hub] liste indisponible', e));
    return () => { vivant = false; };
  }, []);

  const filtered = hubs.filter(
    (h) =>
      h.name.toLowerCase().includes(search.toLowerCase()) ||
      h.city.toLowerCase().includes(search.toLowerCase()),
  );

  const handleSelect = (hub: Hub) => {
    router.back();
  };

  const handleLongPress = (hub: Hub) => {
    Alert.alert(hub.name, undefined, [
      { text: 'Voir détails', onPress: () => handleSelect(hub) },
      {
        text: 'Signaler',
        onPress: () =>
          router.push({
            pathname: '/hub/report' as any,
            params: { hubId: hub.id, hubName: hub.name, hubAddress: `${hub.address}, ${hub.city}` },
          }),
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaWrapper>
      <Header title={t('hub.selectHub')} showBack />
      <Input
        placeholder={t('common.search')}
        value={search}
        onChangeText={setSearch}
      />
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HubCard hub={item} onPress={handleSelect} onLongPress={handleLongPress} />
        )}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
      />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.section,
  },
});
