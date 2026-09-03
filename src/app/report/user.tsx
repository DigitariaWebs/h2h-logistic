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
import { Button } from '@/components/ui/Button';
import { Toast } from '@/components/ui/Toast';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useTranslation } from '@/hooks/useTranslation';
import { useUserReportsStore } from '@/stores/useUserReportsStore';
import { USER_REPORT_REASONS, type UserReportReason } from '@/services/mock/userReports';

const MAX_PHOTOS = 3;
const MAX_NOTE_LENGTH = 600;

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export default function UserReportScreen() {
  const { colors } = useColorScheme();
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{
    reportedUserId: string;
    reportedUserName: string;
    reportedRole: string;
    missionId?: string;
    conversationId?: string;
  }>();
  const reportedUserId = params.reportedUserId ?? '';
  const reportedUserName = params.reportedUserName ?? '';
  const reportedRole: 'seller' | 'buyer' = params.reportedRole === 'seller' ? 'seller' : 'buyer';
  const missionId = params.missionId || undefined;
  // 🔴 LA CONVERSATION D'OÙ VIENT LE SIGNALEMENT. Sans elle, le support
  // reçoit « comportement agressif » sans une ligne de ce qui a été écrit.
  const conversationId = params.conversationId || undefined;

  const { submit, isSubmitting } = useUserReportsStore();

  const [reason, setReason] = useState<UserReportReason | null>(null);
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [goodFaith, setGoodFaith] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const addPhoto = async () => {
    if (photos.length >= MAX_PHOTOS) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('report.photoPermTitle'), t('report.photoPermBody'));
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

  const canSubmit = !!reason && goodFaith && !isSubmitting;

  const handleSubmit = async () => {
    if (!reason || !goodFaith || !reportedUserId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    // 🔴 ON NE FÉLICITE PLUS AVANT DE SAVOIR. Le succès était annoncé sans
    // condition — ce qui allait de soi tant que l'envoi était simulé et ne
    // pouvait pas échouer. Maintenant qu'il part vraiment, un refus doit se
    // voir : annoncer « signalement envoyé » sur un envoi refusé serait
    // exactement le défaut qu'on vient de corriger, sous une autre forme.
    try {
      await submit({
        reportedUserId,
        reportedUserName,
        reportedRole,
        missionId,
        conversationId,
        reason,
        description: description.trim() || undefined,
        photoUris: photos.length > 0 ? photos : undefined,
        goodFaith: true,
      });
    } catch (e) {
      // ⚠️ ON GARDE CE QUI A ÉTÉ SAISI. Vider le formulaire après un échec
      // obligerait à tout réécrire — et on ne signale pas deux fois de bon coeur.
      console.error('[signalement] envoi impossible', e);
      setToast(e instanceof Error ? e.message : t('report.errorToast'));
      return;
    }
    setToast(t('report.successToast'));
    setReason(null);
    setDescription('');
    setPhotos([]);
    setGoodFaith(false);
    setTimeout(() => router.back(), 1600);
  };

  return (
    <SafeAreaWrapper>
      <Header title={t('report.title')} showBack />

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{t('report.subtitle')}</Text>

        {/* Section 1 — Reason */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('report.reasonSection')}</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{t('report.reasonHint')}</Text>
          <View style={styles.radioList}>
            {USER_REPORT_REASONS.map((r) => {
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
                  <View style={[styles.radioOuter, { borderColor: selected ? colors.primary : colors.border }]}>
                    {selected && <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />}
                  </View>
                  <View style={styles.radioBody}>
                    <Text style={[styles.radioLabel, { color: colors.text }]}>{r.label}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Section 2 — Description */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('report.descriptionSection')}</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>{t('report.descriptionHint')}</Text>
          <TextInput
            value={description}
            onChangeText={(txt) => setDescription(txt.slice(0, MAX_NOTE_LENGTH))}
            placeholder={t('report.descriptionPlaceholder')}
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            style={[
              styles.textArea,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLabel={t('report.descriptionSection')}
          />
          <Text style={[styles.counter, { color: colors.textSecondary }]}>
            {fill(t('report.counter'), { count: description.length, max: MAX_NOTE_LENGTH })}
          </Text>
        </View>

        {/* Section 3 — Proof photos */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('report.proofSection')}</Text>
          <Text style={[styles.sectionHint, { color: colors.textSecondary }]}>
            {fill(t('report.proofHint'), { max: MAX_PHOTOS })}
          </Text>
          <View style={styles.photoGrid}>
            {photos.map((uri) => (
              <View key={uri} style={[styles.photo, { borderColor: colors.border }]}>
                <Image source={{ uri }} style={styles.photoImg} contentFit="cover" />
                <Pressable
                  onPress={() => removePhoto(uri)}
                  style={[styles.photoRemove, { backgroundColor: colors.surface }]}
                  hitSlop={6}
                  accessibilityLabel={t('report.removePhoto')}
                >
                  <Icon name="close" size={14} color={colors.text} />
                </Pressable>
              </View>
            ))}
            {photos.length < MAX_PHOTOS && (
              <Pressable
                onPress={addPhoto}
                style={[styles.photoAdd, { borderColor: colors.border, backgroundColor: colors.surface }]}
                accessibilityLabel={t('report.addPhoto')}
                accessibilityRole="button"
              >
                <Icon name="camera" size={22} color={colors.textSecondary} />
                <Text style={[styles.photoAddLabel, { color: colors.textSecondary }]}>{t('report.addPhoto')}</Text>
              </Pressable>
            )}
          </View>
        </View>

        {/* Section 4 — Good-faith attestation (mandatory) */}
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            setGoodFaith((v) => !v);
          }}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: goodFaith }}
          accessibilityLabel={t('report.goodFaith')}
          style={({ pressed }) => [
            styles.goodFaithRow,
            {
              borderColor: goodFaith ? colors.primary : colors.border,
              backgroundColor: goodFaith ? colors.primary + '08' : colors.surface,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: goodFaith ? colors.primary : colors.border,
                backgroundColor: goodFaith ? colors.primary : 'transparent',
              },
            ]}
          >
            {goodFaith && <Icon name="checkmark" size={14} color="#FFFFFF" />}
          </View>
          <Text style={[styles.goodFaithText, { color: colors.text }]}>{t('report.goodFaith')}</Text>
        </Pressable>
      </ScrollView>

      {/* Submit */}
      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Button
          title={t('report.submit')}
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
  subtitle: {
    ...Typography.caption,
    lineHeight: 18,
  },

  section: { gap: Spacing.sm },
  sectionTitle: { ...Typography.h3 },
  sectionHint: { ...Typography.caption, lineHeight: 18 },

  // Radio
  radioList: { gap: Spacing.sm, marginTop: Spacing.xs },
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
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  radioBody: { flex: 1 },
  radioLabel: { ...Typography.body, flexShrink: 1 },

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
  counter: { ...Typography.caption, alignSelf: 'flex-end' },

  // Photos
  photoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.xs },
  photo: {
    width: 84,
    height: 84,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  photoImg: { width: '100%', height: '100%' },
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
  photoAddLabel: { ...Typography.caption, fontSize: 11 },

  // Good faith
  goodFaithRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goodFaithText: { ...Typography.body, flex: 1 },

  // Footer
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 0.5,
  },
});
