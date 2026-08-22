import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { Redirect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useClerk } from '@clerk/expo';
import { Typography } from '@/constants/Typography';
import { Spacing } from '@/constants/Spacing';
import { useAuthStore } from '@/stores/useAuthStore';

const LOGO = require('@/assets/images/logo.png');

type Target =
  | '/(onboarding)'
  | '/(auth)'
  | '/(auth)/complete-profile'
  | '/(auth)/convention'
  | '/(auth)/iban'
  | '/(auth)/pending-validation'
  | '/(tabs)';

export default function SplashScreen() {
  const hydrate = useAuthStore((s) => s.hydrate);
  // 🔴 ON ATTEND QUE CLERK SOIT CHARGÉ AVANT DE DÉCIDER. `hydrate()` lit la
  // session via `peekClerk()` : appelée trop tôt, elle ne voit rien et conclut
  // « personne n'est connecté ». L'application renverrait alors à l'écran de
  // connexion une personne dont la session est parfaitement valide.
  const clerk = useClerk();
  const [target, setTarget] = useState<Target | null>(null);

  const logoOpacity = useSharedValue(0);
  const logoScale = useSharedValue(0.8);
  const subtitleOpacity = useSharedValue(0);
  const subtitleTranslateY = useSharedValue(10);

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });
    logoScale.value = withTiming(1, { duration: 800, easing: Easing.out(Easing.cubic) });

    subtitleOpacity.value = withDelay(
      400,
      withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );
    subtitleTranslateY.value = withDelay(
      400,
      withTiming(0, { duration: 600, easing: Easing.out(Easing.cubic) }),
    );

    if (!clerk?.loaded) return;
    let cancelled = false;
    (async () => {
      // Wait for storage hydration AND a minimum splash duration. Then render
      // <Redirect> so expo-router handles the transition declaratively — using
      // imperative router.replace from a useEffect on the root screen triggers
      // a spurious GO_BACK dispatch warning.
      const minDelay = new Promise((r) => setTimeout(r, 2000));
      await Promise.all([hydrate(), minDelay]);
      if (cancelled) return;
      const { isOnboarded, isAuthenticated, user } = useAuthStore.getState();
      if (!isOnboarded) setTarget('/(onboarding)');
      else if (!isAuthenticated) setTarget('/(auth)');
      // ⚠️ « PROFIL INCOMPLET » SE MESURE AU PRÉNOM, pas à un drapeau de Clerk.
      // C'est aussi l'écran qui appelle `request_role('transporter')` : sans lui,
      // aucune ligne `user_roles` n'existe, donc rien à examiner pour le
      // support, donc l'attente serait éternelle.
      else if (!user?.firstName) setTarget('/(auth)/complete-profile');
      else if (!user.convention) setTarget('/(auth)/convention');
      else if (!user.convention.iban) setTarget('/(auth)/iban');
      else if (!user.documentsVerified) setTarget('/(auth)/pending-validation');
      else setTarget('/(tabs)');
    })();

    return () => {
      cancelled = true;
    };
  }, [clerk?.loaded]);

  const logoAnimatedStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleTranslateY.value }],
  }));

  if (target) {
    return <Redirect href={target as never} />;
  }

  return (
    <LinearGradient
      colors={['#007BA7', '#2A8A6A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <View style={styles.content}>
        <Animated.View style={[styles.logoContainer, logoAnimatedStyle]}>
          <Image source={LOGO} style={styles.logoImage} contentFit="contain" />
        </Animated.View>

        <Animated.View style={subtitleAnimatedStyle}>
          <Text style={styles.logoH2H}>H2H</Text>
          <Text style={styles.logoLogistic}>Logistic</Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, subtitleAnimatedStyle]}>
        <Text style={styles.tagline}>L'app des cotransporteurs particuliers</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoImage: {
    width: 120,
    height: 120,
  },
  logoH2H: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 42,
    lineHeight: 50,
    color: '#FFFFFF',
    letterSpacing: 4,
    textAlign: 'center',
  },
  logoLogistic: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 18,
    lineHeight: 24,
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: Spacing.section + 20,
  },
  tagline: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
  },
});
