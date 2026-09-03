import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaWrapper } from '@/components/layout/SafeAreaWrapper';
import { Header } from '@/components/layout/Header';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useHubReportsStore } from '@/stores/useHubReportsStore';
import { HUB_REPORT_REASONS, type HubReportReason } from '@/services/mock/hubReports';

const MAX_PHOTOS = 3;
const MAX_NOTE_LENGTH = 600;

export default function HubReportScreen() {
  const { colors } = useColorScheme();
  const router = useRouter();
  const { hubId, hubName, hubAddress, missionId } = useLocalSearchParams<{
    hubId: string;
    hubName: string;
    hubAddress?: string;
    missionId?: string;
  }>();
  const { submit, isSubmitting } = useHubReportsStore();

  const [reason, setReason] = useState<HubReportReason | null>(null);
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        'Accès aux photos',
        "Autorisez l'accès aux photos pour joindre une image au signalement.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((p) => [...p, result.assets[0].uri].slice(0, MAX_PHOTOS));
      Haptics.selectionAsync();
    }
  };

  const removePhoto = (uri: string) => {
    setPhotos((p) => p.filter((u) => u !== uri));
  };

  const handleSubmit = async () => {
    if (!reason || !hubId || !hubName) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // 🔴 ON NE REMERCIE PLUS AVANT DE SAVOIR. Le message de succès était
    // affiché sans condition — ce qui allait de soi tant que l'envoi était
    // simulé et ne pouvait pas échouer. Il part vraiment maintenant, et un
    // refus doit se voir : « nous vous tiendrons informé » sur un signalement
    // que personne n'a reçu est exactement le défaut qu'on vient de corriger.
    try {
      await submit({
        hubId,
        hubName,
        reason,
        missionId: missionId || undefined,
        notes: notes.trim() || undefined,
        photoUris: photos.length > 0 ? photos : undefined,
      });
    } catch (e) {
      // ⚠️ ET ON GARDE CE QUI A ÉTÉ SAISI : on ne resignale pas de bon coeur,
      // surtout debout devant une porte fermée.
      console.error('[hub] signalement impossible', e);
      setToast(e instanceof Error ? e.message : 'Signalement non envoyé. Réessayez.');
      return;
    }
    setToast('Merci, votre retour nous aide à améliorer le service. Nous vous tiendrons informé si besoin.');
    setReason(null);
    setNotes('');
    setPhotos([]);
    setTimeout(() => router.back(), 1600);
  };

  const canSubmit = !!reason && !isSubmitting;

  return (
    <SafeAreaWrapper>
      <Header title="Signaler ce hub" showBack />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Hub summary */}
        <Card style={{ backgroundColor: colors.primary + '06' }}>
          <View style={styles.summaryRow}>
            <View style={[styles.summaryIcon, { backgroundColor: colors.accentLight }]}>
              <Icon name="location-filled" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[styles.summaryName, { color: colors.text }]} numberOfLines={2}>
                {hubName ?? 'Hub'}
              </Text>
              {!!hubAddress && (
                <Text style={[styles.summaryAddress, { color: colors.textSecondary }]} numberOfLines={2}>
                  {hubAddress}
                </Text>
              )}
            </View>
          </View>
        </Card>

        {/* Section 1 — Reason */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Raison</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Choisissez ce qui correspond le mieux à votre observation.
          </Text>
          <View style={styles.radioList}>
            {HUB_REPORT_REASONS.map((r) => {
              const selected = reason === r.id;
              return (
                <Pressable
                  key={r.id}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setReason(r.id);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={r.label}
                  style={({ pressed }) => [
                    styles.radioRow,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary + '08' : colors.surface,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radioOuter,
                      { borderColor: selected ? colors.primary : colors.border },
                    ]}
                  >
                    {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <Text style={[styles.radioLabel, { color: colors.text }]}>{r.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 2 — Notes */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Détails</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Décrivez le problème (optionnel)
          </Text>
          <TextInput
            value={notes}
            onChangeText={(t) => setNotes(t.slice(0, MAX_NOTE_LENGTH))}
            placeholder="Quelques mots pour nous aider à comprendre…"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            style={[
              styles.textArea,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            accessibilityLabel="Détails du signalement"
          />
          <Text style={[styles.counter, { color: colors.textSecondary }]}>
            {notes.length}/{MAX_NOTE_LENGTH}
          </Text>
        </View>

        {/* Section 3 — Photos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Photos</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            Jusqu'à {MAX_PHOTOS} photos pour illustrer (optionnel)
          </Text>
          <View style={styles.photoGrid}>
            {photos.map((uri) => (
              <View key={uri} style={[styles.photo, { borderColor: colors.border }]}>
                <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                <Pressable
                  onPress={() => removePhoto(uri)}
                  style={[styles.photoRemove, { backgroundColor: colors.surface }]}
                  hitSlop={6}
                  accessibilityLabel="Retirer cette photo"
                >
                  <Icon name="close" size={14} color={colors.text} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable
                onPress={addPhoto}
                style={[styles.photoAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
                accessibilityLabel="Ajouter une photo"
                accessibilityRole="button"
              >
                <Icon name="camera" size={22} color={colors.textSecondary} />
                <Text style={[styles.photoAddLabel, { color: colors.textSecondary }]}>Ajouter</Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Submit */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          title="Envoyer le signalement"
          onPress={handleSubmit}
          variant="gradient"
          loading={isSubmitting}
          disabled={!canSubmit}
        />
      </View>

      {toast && (
        <Toast message={toast} type="success" visible onHide={() => setToast(null)} duration={2500} />
      )}
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    gap: Spacing.xl,
    paddingBottom: Spacing.section,
  },

  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  summaryIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryName: {
    ...Typography.bodyMedium,
  },
  summaryAddress: {
    ...Typography.caption,
  },

  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.h3,
  },
  sectionHint: {
    ...Typography.caption,
    lineHeight: 18,
  },

  // Radio
  radioList: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  radioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioLabel: {
    ...Typography.body,
    flex: 1,
  },

  // Text area
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    minHeight: 100,
    textAlignVertical: 'top',
    ...Typography.body,
    marginTop: Spacing.xs,
  },
  counter: {
    ...Typography.caption,
    alignSelf: 'flex-end',
  },

  // Photos
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  photo: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: {
    width: '100%',
    height: '100%',
  },
  photoRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoAdd: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  photoAddLabel: {
    ...Typography.caption,
    fontSize: 11,
  },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 0.5,
  },
});
