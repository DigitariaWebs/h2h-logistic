import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Icon, type IconName } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Button } from './Button';

interface EmptyStateProps {
  iconName?: IconName;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ iconName, title, description, actionLabel, onAction }: EmptyStateProps) {
  const { colors } = useColorScheme();

  return (
    <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.container} accessibilityRole="text">
      {iconName && <Icon name={iconName} size={48} color={colors.textSecondary} />}
      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">{title}</Text>
      {description && (
        <Text style={[styles.description, { color: colors.textSecondary }]}>{description}</Text>
      )}
      {actionLabel && onAction && (
        <View style={styles.actionWrap}>
          <Button title={actionLabel} onPress={onAction} variant="outline" fullWidth={false} />
        </View>
      )}
    </Animated.View>
  );
}

/** Pre-defined warm empty state messages */
export const EMPTY_MESSAGES = {
  missions: {
    title: 'Aucune co-livraison pour le moment',
    description: 'Restez actif pour recevoir des propositions ! De nouvelles co-livraisons arrivent régulièrement.',
  },
  routes: {
    title: 'Publiez votre premier trajet',
    // ⚠️ « participation aux frais », JAMAIS « revenus » : le cotransportage
    // (L. 3232-1) est un partage des frais, pas une rémunération. Le mot promet
    // le cadre juridique autant qu'il décrit l'écran.
    description: 'Transformez vos déplacements quotidiens en participation aux frais.',
  },
  history: {
    title: 'Aucune co-livraison effectuée',
    description: 'Votre historique apparaîtra ici après votre première co-livraison.',
  },
  notifications: {
    title: 'Tout est calme pour le moment',
    description: 'Vous serez notifié dès qu\'une nouvelle co-livraison correspond à vos trajets.',
  },
  favorites: {
    title: 'Aucun client favori',
    description: 'Vos contacts favoris apparaîtront ici après vos premières co-livraisons.',
  },
  earnings: {
    title: 'Pas encore de participations',
    description: 'Acceptez votre première co-livraison pour commencer à gagner !',
  },
} as const;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.section,
    gap: Spacing.md,
  },
  title: {
    ...Typography.h3,
    textAlign: 'center',
  },
  description: {
    ...Typography.body,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  actionWrap: {
    marginTop: Spacing.sm,
  },
});
