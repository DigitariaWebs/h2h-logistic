import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Card } from '@/components/ui/Card';
import { StatusToggle } from '@/components/logistics/StatusToggle';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuthStore } from '@/stores/useAuthStore';

export default function ProfileScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();
  const { user, toggleOnline, logout } = useAuthStore();

  const menuItems = [
    { iconName: 'clipboard' as const, label: t('profile.editProfile'), route: '/settings' },
    { iconName: 'history' as const, label: 'Historique', route: '/history' },
    { iconName: 'wallet' as const, label: t('earnings.title'), route: '/earnings' },
    { iconName: 'star-outline' as const, label: t('profile.favoriteClients'), route: '/settings/favorite-clients' },
    { iconName: 'bell' as const, label: t('profile.notifications'), route: '/notifications' },
    { iconName: 'info' as const, label: 'En savoir plus', route: '/responsabilites' },
    { iconName: 'shield' as const, label: 'Protocole incidents', route: '/incidents-protocol' },
    { iconName: 'time' as const, label: 'Règles de délais', route: '/delays-rules' },
    { iconName: 'location-filled' as const, label: 'Je suis au hub', route: '/hub-presence' },
    { iconName: 'navigate' as const, label: 'Démo Navigation', route: '/navigate/demo' },
    { iconName: 'settings' as const, label: t('profile.settings'), route: '/settings' },
  ];

  return (
    <SafeAreaWrapper>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <Text style={[styles.title, { color: colors.text }]}>{t('profile.title')}</Text>

        <Card style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.firstName?.[0] ?? 'T'}{user?.lastName?.[0] ?? 'R'}
            </Text>
          </View>
          <Text style={[styles.name, { color: colors.text }]}>
            {user?.firstName ?? 'Cotransporteur particulier'} {user?.lastName ?? ''}
          </Text>
          <Text style={[styles.stats, { color: colors.textSecondary }]}>
            {user?.totalDeliveries ?? 0} co-livraisons — {user?.rating ? `${user.rating.toFixed(1)}/5` : 'pas encore note'}
          </Text>
        </Card>

        <StatusToggle isOnline={user?.isOnline ?? false} onToggle={toggleOnline} />

        <View style={styles.menu}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={[styles.menuItem, { borderBottomColor: colors.border }]}
              onPress={() => router.push(item.route as any)}
            >
              <Icon name={item.iconName} size={20} color={colors.textSecondary} />
              <Text style={[styles.menuLabel, { color: colors.text }]}>{item.label}</Text>
              <Icon name="chevron-right" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.logoutButton, { borderColor: colors.error }]}
          onPress={() => {
            logout();
            router.replace('/');
          }}
        >
          <Text style={[styles.logoutText, { color: colors.error }]}>{t('profile.logout')}</Text>
        </TouchableOpacity>

        <Text style={[styles.version, { color: colors.textSecondary }]}>
          {t('profile.version')} 1.0.0
        </Text>
      </ScrollView>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingVertical: Spacing.lg,
    gap: Spacing.lg,
  },
  title: {
    ...Typography.h1,
  },
  profileCard: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007BA7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    ...Typography.h1,
    color: '#FFFFFF',
  },
  name: {
    ...Typography.h2,
  },
  stats: {
    ...Typography.body,
  },
  menu: {
    gap: 0,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderBottomWidth: 0.5,
    gap: Spacing.md,
  },
  menuIcon: {
    fontSize: 20,
  },
  menuLabel: {
    ...Typography.body,
    flex: 1,
  },
  chevron: {
    fontSize: 20,
  },
  logoutButton: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  logoutText: {
    ...Typography.button,
  },
  version: {
    ...Typography.caption,
    textAlign: 'center',
  },
});
