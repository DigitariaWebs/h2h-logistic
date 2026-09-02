import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActionSheetIOS,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { Image } from 'expo-image';
import { Header } from '@/components/layout/Header';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';
import { Icon } from '@/components/ui/Icon';

// 🔴 CET ÉCRAN AVAIT SA PROPRE LISTE, PLUS COURTE QUE CELLE DE LA PUBLICATION.
// Sept villes ici, dix dans `constants/Cities.ts` : Menton, Grasse et
// Saint-Raphaël existaient comme corridor de trajet mais pas comme ville
// principale. Un cotransporteur de Menton ne pouvait donc pas se déclarer chez
// lui — alors que la ville principale sert justement à lui proposer des
// missions. Deux listes écrites à la main pour le même concept finissent
// toujours par diverger ; celle-ci l'avait déjà fait.
import { CITIES } from '@/constants/Cities';

export default function CompleteProfileScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { completeProfile, isLoading } = useAuthStore();

  const [avatar, setAvatar] = useState<string | undefined>();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [city, setCity] = useState('');
  const [showCityPicker, setShowCityPicker] = useState(false);

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0;

  // Avatar picker
  const pickImage = useCallback(async (source: 'camera' | 'gallery') => {
    let result: ImagePicker.ImagePickerResult;

    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', "Autorisez l'accès à la caméra pour prendre une photo.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission requise', "Autorisez l'accès à la galerie pour choisir une photo.");
        return;
      }
      result = await ImagePicker.launchImageLibraryAsync({
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
    }

    if (!result.canceled && result.assets[0]) {
      setAvatar(result.assets[0].uri);
    }
  }, []);

  const handleAvatarPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', 'Prendre une photo', 'Choisir dans la galerie'],
          cancelButtonIndex: 0,
        },
        (buttonIndex) => {
          if (buttonIndex === 1) pickImage('camera');
          if (buttonIndex === 2) pickImage('gallery');
        },
      );
    } else {
      Alert.alert('Photo de profil', 'Choisissez une source', [
        { text: 'Caméra', onPress: () => pickImage('camera') },
        { text: 'Galerie', onPress: () => pickImage('gallery') },
        { text: 'Annuler', style: 'cancel' },
      ]);
    }
  }, []);

  // City picker
  const handleCityPress = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Annuler', ...CITIES],
          cancelButtonIndex: 0,
          title: 'Ville principale',
        },
        (buttonIndex) => {
          if (buttonIndex > 0) {
            setCity(CITIES[buttonIndex - 1]);
          }
        },
      );
    } else {
      setShowCityPicker(!showCityPicker);
    }
  }, [showCityPicker]);

  const [erreur, setErreur] = useState('');

  // 🔴 CET ÉCRAN ÉCRIT MAINTENANT DANS UN PROFIL PARTAGÉ. `profiles` est la
  // MÊME ligne que sur HandtoHand : ce prénom s'affichera aussi là-bas. C'est
  // pour ça que le bouton « Plus tard » a disparu — il appelait
  // `completeProfile` avec le prénom en dur « Cotransporteur particulier », ce
  // qui, avec une vraie base, écrirait cette chaîne comme prénom de la personne
  // sur les deux applications.
  //
  // ⚠️ C'EST AUSSI ICI QUE LE RÔLE SE DEMANDE (`request_role('transporter')`).
  // Sans cet appel, aucune ligne `user_roles` n'existe, donc le support n'a
  // rien à examiner, donc l'écran d'attente ne se rouvre jamais.
  const handleSubmit = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setErreur('');
    try {
      await completeProfile({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        city: city || 'Non renseignée',
        transportType: 'car',
        avatar,
      });
      router.replace('/(auth)/convention');
    } catch (e) {
      // ⚠️ ON NE NAVIGUE PAS SUR UN ÉCHEC. Avancer alors que rien n'a été
      // enregistré renverrait la personne à cet écran au prochain lancement,
      // sans jamais lui dire pourquoi.
      console.error('[auth] profil non enregistre', e);
      setErreur(
        e instanceof Error ? e.message : "Impossible d'enregistrer le profil pour le moment.",
      );
    }
  }, [firstName, lastName, city, avatar, completeProfile, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <View style={{ paddingHorizontal: Spacing.lg }}>
          <Header title="" showBack />
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {/* Title */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Text style={[styles.title, { color: colors.text }]}>Complétez votre profil</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            Ces informations aident les vendeurs et acheteurs à vous identifier.
          </Text>
        </Animated.View>

        {/* Avatar */}
        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.avatarSection}>
          <TouchableOpacity onPress={handleAvatarPress} style={styles.avatarWrapper}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '15' }]}>
                <Icon name="camera" size={32} color={colors.primary} />
              </View>
            )}
            <View style={[styles.avatarBadge, { backgroundColor: colors.primary }]}>
              <Text style={styles.avatarBadgeIcon}>+</Text>
            </View>
          </TouchableOpacity>
          <Text style={[styles.avatarHint, { color: colors.textSecondary }]}>
            Ajouter une photo
          </Text>
        </Animated.View>

        {/* Name inputs */}
        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.fields}>
          <Input
            label="Prénom"
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Votre prénom"
            autoFocus
          />
          <Input
            label="Nom"
            value={lastName}
            onChangeText={setLastName}
            placeholder="Votre nom"
          />
        </Animated.View>

        {/* City picker */}
        <Animated.View entering={FadeInDown.delay(400).duration(400)}>
          <Text style={[styles.fieldLabel, { color: colors.text }]}>Ville principale</Text>
          <TouchableOpacity
            onPress={handleCityPress}
            style={[
              styles.pickerButton,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Text
              style={[
                styles.pickerText,
                { color: city ? colors.text : colors.textSecondary },
              ]}
            >
              {city || 'Sélectionnez votre ville'}
            </Text>
            <Text style={[styles.pickerChevron, { color: colors.textSecondary }]}>▾</Text>
          </TouchableOpacity>

          {/* Android city list fallback */}
          {showCityPicker && Platform.OS !== 'ios' && (
            <View style={[styles.cityList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {CITIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => {
                    setCity(c);
                    setShowCityPicker(false);
                  }}
                  style={[
                    styles.cityItem,
                    c === city && { backgroundColor: colors.primary + '12' },
                  ]}
                >
                  <Text style={[styles.cityItemText, { color: colors.text }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </Animated.View>

      </ScrollView>

      {/* Bottom actions */}
      <Animated.View
        entering={FadeInDown.delay(600).duration(400)}
        style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}
      >
        <Button
          title="Continuer"
          onPress={handleSubmit}
          variant="gradient"
          disabled={!isValid}
          loading={isLoading}
        />
        {erreur ? (
          <Text style={[styles.skipText, { color: colors.error }]}>{erreur}</Text>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    gap: Spacing.xxl,
  },
  title: {
    ...Typography.h1,
  },
  subtitle: {
    ...Typography.body,
    marginTop: Spacing.xs,
    lineHeight: 22,
  },
  avatarSection: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarIcon: {
    fontSize: 32,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarBadgeIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 18,
  },
  avatarHint: {
    ...Typography.caption,
  },
  fields: {
    gap: Spacing.lg,
  },
  fieldLabel: {
    ...Typography.captionMedium,
    marginBottom: Spacing.xs,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1.5,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.lg,
    height: 48,
  },
  pickerText: {
    ...Typography.body,
  },
  pickerChevron: {
    fontSize: 12,
  },
  cityList: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.xs,
    overflow: 'hidden',
  },
  cityItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  cityItemText: {
    ...Typography.body,
  },
  actions: {
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  skipButton: {
    paddingVertical: Spacing.sm,
  },
  skipText: {
    ...Typography.bodyMedium,
    textDecorationLine: 'underline',
  },
});
