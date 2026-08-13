import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/ui/Icon';
import { HandoffAnimation } from '@/components/mission/HandoffAnimation';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';

type Phase = 'pickup' | 'delivery';

interface DirectionHubButtonProps {
  phase: Phase;
  hubName: string;
  distanceMeters?: number;
  onPress: () => void;
  onNavigatePress: () => void;
}

function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m)} m`;
}

export function DirectionHubButton({
  phase,
  hubName,
  distanceMeters,
  onPress,
  onNavigatePress,
}: DirectionHubButtonProps) {
  const { colors } = useColorScheme();

  // ⚠️ LES DEUX PHASES SE LISENT PAREIL (12/08/2026). La remise disait
  // « Remise » quand la récupération disait « Valider la récupération » : deux
  // grammaires pour deux moments du même parcours. Et le bouton jumeau de la
  // timeline disait, lui, « Entrer le code acheteur » — il annonçait la saisie
  // alors qu'il ouvre la page d'approche. Un même endroit, trois formulations.
  const title = phase === 'pickup' ? 'Valider la récupération' : 'Valider la remise';
  const gradientColors: [string, string] =
    phase === 'pickup' ? [colors.primary, '#0C1655'] : [colors.primary, colors.primaryGradientEnd];

  const accessibilityLabel =
    phase === 'pickup'
      ? `Valider la récupération, direction hub vendeur ${hubName}`
      : `Remise, direction hub acheteur ${hubName}`;

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, { damping: 18, stiffness: 220 });
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 18, stiffness: 220 });
  };
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onPress();
  };
  const handleChevronPress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onNavigatePress();
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
      >
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          {/* Left icon — both phases play the hand-to-hand "main à main" handoff */}
          <View style={styles.iconCircle}>
            <HandoffAnimation />
          </View>

          {/* Center text */}
          <View style={styles.textCol}>
            <Text style={styles.overline}>ACTION SUIVANTE</Text>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              Hub {hubName}
              {distanceMeters != null ? `  •  à ${formatDistance(distanceMeters)}` : ''}
            </Text>
          </View>

          {/* Trailing chevron — secondary action (open navigation) */}
          <Pressable
            onPress={handleChevronPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={`Ouvrir la navigation vers ${hubName}`}
            style={({ pressed }) => [styles.chevron, pressed && { opacity: 0.7 }]}
          >
            <Icon name="chevron-right" size={32} color="#FFFFFF" />
          </Pressable>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 88,
    borderRadius: 20,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 5,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textCol: {
    flex: 1,
    paddingLeft: 14,
    gap: 2,
    justifyContent: 'center',
  },
  overline: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 1.2,
    color: 'rgba(255,255,255,0.8)',
  },
  title: {
    ...Typography.h2,
    color: '#FFFFFF',
  },
  meta: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(255,255,255,0.85)',
  },
  chevron: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
