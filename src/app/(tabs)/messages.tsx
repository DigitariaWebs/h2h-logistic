import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, Pressable, TextInput, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { ConversationGroup } from '@/components/chat/ConversationGroup';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useMissionStore } from '@/stores/useMissionStore';
import { apercuFil, type Apercu } from '@/services/messagerie';
import { useAuthStore } from '@/stores/useAuthStore';
import type { Mission, MissionParticipant, MissionStatus } from '@/types/mission';

const STATUS_LABELS: Partial<Record<MissionStatus, { label: string; variant: 'default' | 'success' | 'warning' }>> = {
  accepted: { label: 'Acceptée', variant: 'default' },
  seller_pending: { label: 'Attente vendeur', variant: 'warning' },
  group_created: { label: 'Prête', variant: 'success' },
  pickup_pending: { label: 'Récupération', variant: 'warning' },
  picked_up: { label: 'En trajet', variant: 'default' },
  in_transit: { label: 'En trajet', variant: 'default' },
  delivery_pending: { label: 'Remise prévue', variant: 'warning' },
};

/**
 * L'heure d'aujourd'hui, la date sinon — ce qu'une liste de conversations
 * montre. `null` quand aucun message n'existe : la ligne n'affiche alors rien,
 * plutôt qu'une heure inventée.
 */
const quandCourt = (iso: string | null): string => {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const memeJour =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  return memeJour
    ? d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
};

interface GroupItem {
  mission: Mission;
  completed: boolean;
}

export default function MessagesScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { getActiveMissions, getCompletedMissions, charger } = useMissionStore();

  const moiId = useAuthStore((e) => e.user?.id ?? null);
  // 🔴 LES APERÇUS ÉTAIENT INVENTÉS. `getConversationPreview` rendait un
  // dernier message de démonstration pour CHAQUE ligne — y compris les
  // conversations où personne n'avait jamais écrit.
  //
  // ⚠️ ON LIT SANS OUVRIR. `apercuFil` cherche un fil existant ; ouvrir depuis
  // une liste en créerait un par mission affichée, presque tous vides.
  const [apercus, setApercus] = useState<Record<string, Apercu | null>>({});
  const [showHistory, setShowHistory] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    void charger();
  }, [charger]);

  // ⚠️ UNE LECTURE PAR FIL, ET SEULEMENT POUR LES MISSIONS AFFICHÉES. On ne
  // recharge que lorsque l'ensemble des expéditions change — pas à chaque
  // rendu, sinon la liste redemanderait le serveur en défilant.
  const missionsAffichees = showHistory
    ? [...getActiveMissions(), ...getCompletedMissions()]
    : getActiveMissions();
  const clesExpeditions = missionsAffichees.map((m) => m.shipmentId).sort().join(',');

  useEffect(() => {
    if (!moiId || !clesExpeditions) return;
    let vivant = true;
    (async () => {
      const trouves: Record<string, Apercu | null> = {};
      await Promise.all(
        clesExpeditions.split(',').flatMap((envoi) =>
          (['seller', 'buyer'] as const).map(async (avec) => {
            try {
              trouves[`${envoi}:${avec}`] = await apercuFil(envoi, avec, moiId);
            } catch (e) {
              // ⚠️ UNE LIGNE MUETTE VAUT MIEUX QU'UNE LISTE VIDE : l'aperçu est
              // un confort, la conversation reste accessible.
              console.error('[messages] apercu indisponible', e);
              trouves[`${envoi}:${avec}`] = null;
            }
          }),
        ),
      );
      if (vivant) setApercus(trouves);
    })();
    return () => { vivant = false; };
  }, [clesExpeditions, moiId]);

  const groups = useMemo<GroupItem[]>(() => {
    const active = getActiveMissions().map((m) => ({ mission: m, completed: false }));
    const past = showHistory
      ? getCompletedMissions().map((m) => ({ mission: m, completed: true }))
      : [];

    const all = [...active, ...past];

    const q = search.trim().toLowerCase();
    if (!q) return all;

    return all.filter((g) => {
      const title = g.mission.package.description.toLowerCase();
      const seller = g.mission.seller.name.toLowerCase();
      const buyer = g.mission.buyer.name.toLowerCase();
      return title.includes(q) || seller.includes(q) || buyer.includes(q);
    });
  }, [showHistory, search, getActiveMissions, getCompletedMissions]);

  const handleOpenChat = (mission: Mission, participant: MissionParticipant, role: 'seller' | 'buyer') => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: participant.id,
        name: participant.name,
        role,
        avatar: participant.avatar ?? '',
        missionId: mission.id,
        listingTitle: mission.package.description,
      },
    });
  };

  const handleOpenMission = (mission: Mission) => {
    router.push({ pathname: '/mission/[id]', params: { id: mission.id } });
  };

  const renderItem = ({ item, index }: { item: GroupItem; index: number }) => {
    const { mission, completed } = item;
    const sellerPreview = apercus[`${mission.shipmentId}:seller`] ?? null;
    const buyerPreview = apercus[`${mission.shipmentId}:buyer`] ?? null;
    const missionCode = `HTH-${mission.id.slice(-4).toUpperCase()}`;
    const routeSummary = `${mission.pickupHub.city} → ${mission.deliveryHub.city}`;
    const status = STATUS_LABELS[mission.status];

    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(250)}>
        <ConversationGroup
          missionId={mission.id}
          listingTitle={mission.package.description}
          routeSummary={routeSummary}
          missionCode={missionCode}
          seller={mission.seller}
          buyer={mission.buyer}
          sellerLastMessage={sellerPreview?.texte ?? ''}
          sellerTimestamp={sellerPreview ? quandCourt(sellerPreview.envoyeLe) : ''}
          sellerUnreadCount={sellerPreview?.nonLus ?? 0}
          buyerLastMessage={buyerPreview?.texte ?? ''}
          buyerTimestamp={buyerPreview ? quandCourt(buyerPreview.envoyeLe) : ''}
          buyerUnreadCount={buyerPreview?.nonLus ?? 0}
          statusLabel={status?.label}
          statusVariant={status?.variant}
          completed={completed}
          onOpenChat={(participant, role) => handleOpenChat(mission, participant, role)}
          onOpenMission={() => handleOpenMission(mission)}
        />
      </Animated.View>
    );
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={[s.title, { color: colors.text }]}>Messages</Text>
      </View>

      {/* Search bar */}
      <View style={[s.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Icon name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une co-livraison ou un nom"
          placeholderTextColor={colors.textSecondary}
          style={[s.searchInput, { color: colors.text }]}
          accessibilityLabel="Rechercher une conversation"
        />
      </View>

      <FlatList
        data={groups}
        keyExtractor={(item) => `${item.mission.id}-${item.completed ? 'done' : 'active'}`}
        renderItem={renderItem}
        contentContainerStyle={s.list}
        ItemSeparatorComponent={() => <View style={{ height: 28 }} />}
        ListFooterComponent={
          <Pressable
            onPress={() => setShowHistory((v) => !v)}
            accessibilityRole="switch"
            accessibilityState={{ checked: showHistory }}
            style={s.historyToggle}
            hitSlop={8}
          >
            <Text style={[s.historyText, { color: colors.primary }]}>
              {showHistory ? 'Masquer' : 'Afficher'} l'historique des conversations
            </Text>
          </Pressable>
        }
        ListEmptyComponent={
          <EmptyState
            iconName="chat"
            title="Aucune conversation pour le moment"
            description="Vos conversations apparaîtront ici dès qu'une co-livraison sera active."
          />
        }
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  title: { ...Typography.h1 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    ...Typography.body,
  },
  list: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.section,
    paddingTop: Spacing.xs,
  },
  historyToggle: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  historyText: {
    ...Typography.captionMedium,
    textDecorationLine: 'underline',
  },
});
