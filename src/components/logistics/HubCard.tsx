import React from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import type { Hub } from '@/types/hub';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { HubParticipantChip, type HubParticipantInfo } from '@/components/route/HubParticipantChip';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { hubZoneDiameterM } from '@/constants/hubZone';
import { iconeHub, libelleHub } from '@/constants/HubTypes';

interface HubCardProps {
  hub: Hub;
  selected?: boolean;
  onPress?: (hub: Hub) => void;
  onLongPress?: (hub: Hub) => void;
  distance?: string;
  participants?: HubParticipantInfo[];
  onPressParticipant?: (info: HubParticipantInfo) => void;
  /** Show the small "Signaler" button (mission/route detail contexts). */
  reportable?: boolean;
}

export function HubCard({
  hub,
  selected,
  onPress,
  onLongPress,
  distance,
  participants,
  onPressParticipant,
  reportable,
}: HubCardProps) {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();

  const typeLabel = libelleHub(hub.type) ?? hub.type;
  const zoneChipLabel = t('zone.sizeChip').replace('{diameter}', String(hubZoneDiameterM(hub)));

  const openReport = () => {
    router.push({
      pathname: '/hub/report' as any,
      params: { hubId: hub.id, hubName: hub.name, hubAddress: `${hub.address}, ${hub.city}` },
    });
  };

  return (
    <TouchableOpacity
      onPress={() => onPress?.(hub)}
      onLongPress={onLongPress ? () => onLongPress(hub) : undefined}
      activeOpacity={0.7}
    >
      <Card
        style={selected ? { borderColor: colors.primary, borderWidth: 2 } : undefined}
      >
        <View style={styles.header}>
          <Text style={[styles.name, { color: colors.text }]}>{hub.name}</Text>
          {participants && participants.length > 0 ? (
            <HubParticipantChip participants={participants} onPress={onPressParticipant} />
          ) : (
            <Badge label={typeLabel} variant="outline" />
          )}
        </View>
        <Text style={[styles.address, { color: colors.textSecondary }]}>
          {hub.address}, {hub.city}
        </Text>
        <View style={styles.metaRow}>
          <View style={[styles.zoneChip, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}>
            <Icon name="location-filled" size={11} color={colors.primary} />
            <Text style={[styles.zoneChipText, { color: colors.primary }]}>{zoneChipLabel}</Text>
          </View>
        </View>
        <View style={styles.footer}>
          <Text style={[styles.hours, { color: colors.textSecondary }]}>
            {hub.openingHours}
          </Text>
          <View style={styles.footerRight}>
            {distance && (
              <Text style={[styles.distance, { color: colors.primary }]}>{distance}</Text>
            )}
            {reportable && (
              <Pressable
                onPress={openReport}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Signaler ce hub"
                style={({ pressed }) => [styles.reportBtn, { opacity: pressed ? 0.6 : 1 }]}
              >
                <Icon name="flag" size={14} color={colors.textSecondary} />
                <Text style={[styles.reportText, { color: colors.textSecondary }]}>Signaler</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  name: {
    ...Typography.bodyMedium,
    flex: 1,
    marginRight: Spacing.sm,
  },
  address: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: Spacing.sm,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  zoneChipText: {
    ...Typography.caption,
    fontSize: 11,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  hours: {
    ...Typography.caption,
  },
  distance: {
    ...Typography.captionMedium,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 36,
    minWidth: 36,
    paddingHorizontal: 4,
  },
  reportText: {
    ...Typography.caption,
    fontSize: 11,
  },
});
