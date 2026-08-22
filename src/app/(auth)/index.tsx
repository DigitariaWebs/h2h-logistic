import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
} from 'react-native-reanimated';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Button } from '@/components/ui/Button';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const SHEET_HEIGHT = SCREEN_HEIGHT * 0.45;

const BG_IMAGE = 'https://images.pexels.com/photos/1233313/pexels-photo-1233313.jpeg';

export default function AuthEntryScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(SHEET_HEIGHT);

  useEffect(() => {
    translateY.value = withSpring(0, {
      damping: 20,
      stiffness: 150,
      mass: 0.8,
    });
  }, []);

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <View style={styles.container}>
      {/* Background image */}
      <Image
        source={{ uri: BG_IMAGE }}
        style={styles.bgImage}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      {/* Dark overlay */}
      <View style={styles.overlay} />

      {/* Logo at top center */}
      <Animated.View entering={FadeIn.delay(200).duration(600)} style={[styles.logoArea, { top: insets.top + Spacing.xl }]}>
        <Image source={require('@/assets/images/logo.png')} style={styles.logoImage} contentFit="contain" />
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, paddingBottom: insets.bottom + Spacing.lg },
          sheetStyle,
        ]}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <Text style={[styles.title, { color: colors.text }]}>Rejoindre H2H Logistic</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Application de cotransportage de colis entre particuliers sur trajets déjà prévus.
        </Text>

        {/* ⚠️ L'E-MAIL, PAS LE NUMÉRO : l'instance Clerk est partagée avec la
            place de marché — elle doit l'être — et n'accepte pas encore les
            numéros français. `phone.tsx` reste dessiné et dormant. */}
        <Button
          title="Continuer avec un e-mail"
          onPress={() => router.push('/(auth)/email')}
          variant="gradient"
        />

        <Text style={[styles.legal, { color: colors.textSecondary }]}>
          En continuant, vous acceptez nos{' '}
          <Text style={styles.legalLink}>Conditions d'utilisation</Text> et notre{' '}
          <Text style={styles.legalLink}>Politique de confidentialité</Text>.
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bgImage: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  logoArea: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 5,
  },
  logoImage: {
    width: 56,
    height: 56,
  },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SHEET_HEIGHT,
    borderTopLeftRadius: BorderRadius.xl + 4,
    borderTopRightRadius: BorderRadius.xl + 4,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.md,
    gap: Spacing.xl,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    ...Typography.h2,
    textAlign: 'center',
  },
  subtitle: {
    ...Typography.body,
    textAlign: 'center',
    marginTop: -Spacing.sm,
  },
  legal: {
    ...Typography.caption,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: Spacing.sm,
  },
  legalLink: {
    textDecorationLine: 'underline',
  },
});
