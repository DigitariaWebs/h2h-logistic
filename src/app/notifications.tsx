import React, { useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { formatDateTime } from '@/utils/formatting';

export default function NotificationsScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const { notifications, isLoading, erreur, charger, marquerCommeLue } = useNotificationStore();

  useEffect(() => { void charger(); }, [charger]);

  return (
    <SafeAreaWrapper>
      <Header title={t('profile.notifications')} showBack />
      {erreur && (
        <View style={[styles.erreur, { borderColor: colors.error, backgroundColor: colors.error + '10' }]}>
          <Text style={[styles.erreurTexte, { color: colors.error }]}>{erreur}</Text>
        </View>
      )}
      <FlatList
        data={notifications}
        refreshing={isLoading}
        onRefresh={() => { void charger(); }}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const isNewDelivery = item.type === 'mission_new';
          return (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => { if (!item.read) void marquerCommeLue(item.id); }}
            >
            <Card
              style={
                isNewDelivery
                  ? { borderLeftWidth: 3, borderLeftColor: colors.gold }
                  : !item.read
                    ? { borderLeftWidth: 3, borderLeftColor: colors.primary }
                    : undefined
              }
            >
              <View style={styles.row}>
                {isNewDelivery && (
                  <View style={[styles.iconCircle, { backgroundColor: colors.gold }]}>
                    <Icon name="bell" size={16} color="#1A1A1E" />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
                  <Text style={[styles.body, { color: colors.textSecondary }]}>{item.body}</Text>
                  <Text style={[styles.time, { color: colors.textSecondary }]}>
                    {formatDateTime(item.createdAt)}
                  </Text>
                </View>
              </View>
            </Card>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListEmptyComponent={<EmptyState iconName="bell" title="Aucune notification" />}
      />
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  erreur: { marginHorizontal: Spacing.lg, marginBottom: Spacing.sm, borderWidth: 1, borderRadius: 8, padding: Spacing.md },
  erreurTexte: { ...Typography.caption, lineHeight: 18 },
  list: {
    paddingBottom: Spacing.section,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.xs,
  },
  body: {
    ...Typography.body,
    marginBottom: Spacing.xs,
  },
  time: {
    ...Typography.caption,
  },
});
