// L'entrée par adresse e-mail — le jumeau visuel de `phone.tsx`.
//
// 🔴 POURQUOI L'E-MAIL ET PAS LE SMS. H2H Logistic partage l'instance Clerk de
// la place de marché — elle DOIT la partager : `app.uid()` traduit le `sub` du
// jeton en `profiles.auth_user_id`, et une seconde application Clerk frapperait
// des sujets d'un autre espace, où plus aucune policy ne reconnaîtrait
// personne. Or cette instance n'accepte pas les numéros français.
//
// ⚠️ `phone.tsx` RESTE EN PLACE, DORMANT — exactement comme sur la place de
// marché. Le jour où le SMS sera ouvert sur l'instance, l'écran est déjà
// dessiné et n'attend qu'un lien depuis l'écran d'accueil.
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Header } from '@/components/layout/Header';
import { Button } from '@/components/ui/Button';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * ⚠️ VALIDATION DE CONFORT, PAS D'AUTORITÉ. C'est Clerk qui décide si l'adresse
 * existe et si le code part ; on évite seulement d'envoyer une requête sur une
 * saisie manifestement incomplète.
 */
function adresseValide(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());
}

export default function EmailScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { sendOTP, isLoading } = useAuthStore();

  const [adresse, setAdresse] = useState('');
  const [focus, setFocus] = useState(false);
  const [erreur, setErreur] = useState('');

  const valide = adresseValide(adresse);

  const continuer = useCallback(async () => {
    if (!valide) return;
    setErreur('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await sendOTP(adresse.trim().toLowerCase());
      router.push('/(auth)/otp');
    } catch (e) {
      // ⚠️ ON MONTRE LE REFUS DU SERVEUR TEL QUEL. « Rien ne se passe » après
      // un appui est la pire réponse possible sur un écran de connexion.
      console.error('[auth] envoi du code impossible', e);
      setErreur(
        e instanceof Error ? e.message : "Impossible d'envoyer le code pour le moment.",
      );
    }
  }, [adresse, valide, sendOTP, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <Header title="" showBack />
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}
      >
        <View style={styles.inner}>
          <Text style={[styles.title, { color: colors.text }]}>Votre adresse e-mail</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Nous vous enverrons un code de vérification à six chiffres.
          </Text>

          <View
            style={[
              styles.champ,
              {
                backgroundColor: colors.surface,
                borderColor: focus ? colors.primary : colors.border,
              },
            ]}
          >
            <TextInput
              style={[styles.saisie, { color: colors.text }]}
              value={adresse}
              onChangeText={setAdresse}
              placeholder="prenom@exemple.fr"
              placeholderTextColor={colors.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              autoFocus
              onFocus={() => setFocus(true)}
              onBlur={() => setFocus(false)}
            />
          </View>

          {erreur ? (
            <Text style={[styles.hint, { color: colors.error }]}>{erreur}</Text>
          ) : adresse.length > 3 && !valide ? (
            <Text style={[styles.hint, { color: colors.textSecondary }]}>
              Entrez une adresse e-mail valide
            </Text>
          ) : valide ? (
            <Text style={[styles.hint, { color: colors.success }]}>✓ Adresse valide</Text>
          ) : null}

          {/* ⚠️ ON DIT QUE LE COMPTE EST COMMUN. Quelqu'un qui achète déjà sur
              HandtoHand se connecte ici avec la MÊME adresse et retrouve son
              profil : ne pas le dire ferait créer un second compte, donc un
              second profil, donc une identité coupée en deux. */}
          <Text style={[styles.note, { color: colors.textSecondary }]}>
            Si vous avez déjà un compte HandtoHand, utilisez la même adresse : c’est
            le même compte.
          </Text>
        </View>

        <View style={[styles.bas, { paddingBottom: insets.bottom + Spacing.lg }]}>
          <Button
            title="Continuer"
            onPress={continuer}
            variant="gradient"
            disabled={!valide}
            loading={isLoading}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xxxl,
    gap: Spacing.lg,
  },
  title: { ...Typography.h1 },
  subtitle: { ...Typography.body, marginTop: -Spacing.sm, lineHeight: 22 },
  champ: {
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    height: 52,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  saisie: { ...Typography.h3 },
  hint: { ...Typography.caption, marginTop: -Spacing.sm },
  note: { ...Typography.caption, lineHeight: 18, marginTop: Spacing.sm },
  bas: { paddingHorizontal: Spacing.xxl },
});
