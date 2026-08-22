// L'ATTENTE DE VALIDATION — et ce que cet écran faisait avant.
//
// 🔴 IL S'AUTO-VALIDAIT. Au bout de quatre secondes, un `setTimeout` appelait
// `validateAccount()`, qui posait `documentsVerified = true` depuis le
// téléphone, et ouvrait l'application. Le commentaire d'origine le disait sans
// détour : « No real backend: the platform "review" is simulated ».
//
// Le badge « pièces vérifiées » était donc auto-attribué — la même faute que
// celle refermée côté base sur `courier_profiles`, où la policy `for all`
// laissait un cotransporteur écrire lui-même `documents_verified = true`.
//
// ⚠️ CE QUE CET ÉCRAN FAIT MAINTENANT : il CONSTATE. La décision appartient au
// support (`trancher_role()`, `app.is_admin()` requis), et l'application se
// contente de relire `user_roles.status`. Tant que le rôle n'est pas `active`,
// on attend — et on le dit honnêtement, sans faire croire que c'est imminent.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';

/**
 * ⚠️ ON RELIT PÉRIODIQUEMENT, ET PAS TROP SOUVENT. La décision est humaine :
 * elle tombe en minutes ou en jours, pas en secondes. Une relecture toutes les
 * vingt secondes suffit à ce que l'écran s'ouvre tout seul quand elle arrive,
 * sans marteler la base pour rien.
 */
const INTERVALLE_MS = 20_000;

export default function PendingValidationScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const rafraichir = useAuthStore((s) => s.rafraichir);
  const verifie = useAuthStore((s) => s.user?.documentsVerified ?? false);
  const [enCours, setEnCours] = useState(false);

  const relire = useCallback(async () => {
    setEnCours(true);
    try {
      await rafraichir();
    } finally {
      setEnCours(false);
    }
  }, [rafraichir]);

  useEffect(() => {
    void relire();
    const t = setInterval(() => void relire(), INTERVALLE_MS);
    return () => clearInterval(t);
  }, [relire]);

  // 🔴 L'OUVERTURE SUIT L'ÉTAT, ELLE NE LE DEVANCE PAS. C'est la relecture qui
  // décide, jamais une horloge.
  useEffect(() => {
    if (verifie) router.replace('/(tabs)');
  }, [verifie, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
          <Feather name="clock" size={40} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>Compte en cours de validation</Text>
        {/* ⚠️ ON NE PROMET PLUS « UN INSTANT ». Une personne relit le dossier ;
            annoncer l'immédiat fabriquerait une déception à chaque minute qui
            passe, et ferait conclure à une panne. */}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Votre convention et vos informations sont en cours de vérification par
          notre équipe. Vous serez prévenu dès que votre compte est ouvert, et
          vous pourrez alors recevoir des co-livraisons.
        </Text>

        <ActivityIndicator color={colors.primary} style={{ marginTop: Spacing.xl }} />

        {/* ⚠️ UN BOUTON POUR RELIRE MAINTENANT. Attendre sans pouvoir rien faire
            est ce qui pousse à fermer l'application — et à ne pas la rouvrir. */}
        <TouchableOpacity
          onPress={relire}
          disabled={enCours}
          style={[
            styles.bouton,
            { borderColor: colors.border },
            enCours && { opacity: 0.5 },
          ]}
          activeOpacity={0.8}
        >
          <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
          <Text style={[styles.boutonTexte, { color: colors.textSecondary }]}>
            {enCours ? 'Vérification…' : 'Vérifier maintenant'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  title: { ...Typography.h1, textAlign: 'center' },
  subtitle: { ...Typography.body, textAlign: 'center', lineHeight: 22 },
  bouton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderRadius: BorderRadius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  boutonTexte: { ...Typography.caption },
});
