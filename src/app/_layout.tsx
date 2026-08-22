import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { ClerkProvider, useClerk } from '@clerk/expo';
import { tokenCache } from '@clerk/expo/token-cache';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { useColorScheme } from '@/hooks/useColorScheme';
import { setClerk } from '@/lib/clerkBridge';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  clesDeTest,
  clesLive,
  messageClesDeTest,
  messageClesLive,
  type CleNommee,
} from '@/utils/clesDeProduction';

SplashScreen.preventAutoHideAsync();

// 🔴 LA MÊME INSTANCE CLERK QUE LA PLACE DE MARCHÉ, ET CE N'EST PAS NÉGOCIABLE.
// `app.uid()` traduit le `sub` du jeton en `profiles.auth_user_id`. Une seconde
// application Clerk frapperait des sujets d'un autre espace : `app.uid()`
// rendrait NULL et TOUTES les policies échoueraient — en silence, sans message
// d'erreur, avec des écrans simplement vides.
const publishableKey = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '';

if (!publishableKey) {
  throw new Error(
    'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY manquante. Reprendre la MÊME valeur que ' +
      'hand-to-hand/.env.local — les deux applications partagent une seule ' +
      'instance Clerk, sinon app.uid() ne resout plus personne.',
  );
}

// ⚠️ LE GARDE DANS LES DEUX SENS. Une build de production avec des clés de test
// authentifie contre l'instance de développement ; une build de développement
// avec des clés live fait l'inverse — et ici la seconde est la plus grave : un
// cotransporteur particulier d'essai se verrait proposer de VRAIS colis, avec
// l'adresse de vraies personnes.
const clesEmbarquees: CleNommee[] = [['Clerk', publishableKey]];

if (!__DEV__) {
  const enTest = clesDeTest(clesEmbarquees);
  if (enTest.length) throw new Error(messageClesDeTest(enTest));
} else if (process.env.EXPO_PUBLIC_AUTORISER_CLES_LIVE_EN_DEV !== '1') {
  const enLive = clesLive(clesEmbarquees);
  if (enLive.length) throw new Error(messageClesLive(enLive));
}

/**
 * Sort l'instance Clerk de React pour que le store zustand puisse s'en servir.
 *
 * ⚠️ MONTÉ SOUS LE `ClerkProvider` — c'est la seule position où `useClerk()`
 * répond. Ne rend rien : il n'existe que pour ce branchement.
 *
 * ⚠️ ET IL REPREND LA SESSION. Clerk garde la session dans le trousseau, mais
 * zustand redémarre vide : sans cette reprise, l'application se croirait
 * déconnectée à chaque lancement alors que la session est valide. On attend
 * `loaded` — avant, `clerk.session` est encore nul et on conclurait à tort que
 * personne n'est connecté.
 */
function PontClerk() {
  const clerk = useClerk();
  const hydrate = useAuthStore((s) => s.hydrate);

  useEffect(() => {
    setClerk(clerk);
    return () => setClerk(null);
  }, [clerk]);

  useEffect(() => {
    if (clerk?.loaded) void hydrate();
  }, [clerk?.loaded, clerk?.session?.id, hydrate]);

  return null;
}

export default function RootLayout() {
  const { isDark, colors } = useColorScheme();

  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ClerkProvider publishableKey={publishableKey} tokenCache={tokenCache}>
      <PontClerk />
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? 'light' : 'dark'} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.background },
              animation: 'slide_from_right',
            }}
          >
            <Stack.Screen name="publish" options={{ animation: 'slide_from_bottom' }} />
            <Stack.Screen name="navigate" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
            <Stack.Screen name="call" options={{ animation: 'slide_from_bottom', gestureEnabled: false }} />
          </Stack>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ClerkProvider>
  );
}
