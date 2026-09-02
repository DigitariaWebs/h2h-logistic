import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { normaliserHeure, heureValide } from '@/utils/heureTrajet';

type Target = 'seller' | 'buyer';

interface OffHubProposalSheetProps {
  visible: boolean;
  onClose: () => void;
  onSend: (target: Target, address: string, time: string) => void;
  pickupHubName: string;
  deliveryHubName: string;
}

export function OffHubProposalSheet({
  visible,
  onClose,
  onSend,
  pickupHubName,
  deliveryHubName,
}: OffHubProposalSheetProps) {
  const { colors } = useColorScheme();
  const [target, setTarget] = useState<Target>('seller');
  const [address, setAddress] = useState('');
  const [time, setTime] = useState('');

  // 🔴 MÊME DÉFAUT QUE L'ASSISTANT DE PUBLICATION : « longueur >= 4 » acceptait
  // « 7h30 » et « 99:99 ». Un rendez-vous hors hub se donne à un inconnu ; une
  // heure fantaisiste s'y paie par un déplacement pour rien.
  const canSend = address.trim().length > 2 && heureValide(time);

  const handleSend = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onSend(target, address.trim(), normaliserHeure(time)!);
    setAddress('');
    setTime('');
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <View style={s.content}>
        <Text style={[s.title, { color: colors.text }]}>Proposer un rendez-vous hors hub</Text>

        {/* Warning */}
        <View style={[s.warning, { backgroundColor: colors.warning + '15' }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Icon name="alert-circle" size={16} color={colors.warning} />
            <Text style={[s.warningText, { color: colors.warning, flex: 1 }]}>
              Le hors hub est exceptionnel. Le GPS ne sera pas actif pour cette rencontre.
            </Text>
          </View>
        </View>

        {/* Target toggle */}
        <Text style={[s.label, { color: colors.text }]}>À qui proposez-vous ?</Text>
        <View style={[s.toggleRow, { backgroundColor: colors.border + '30' }]}>
          <TouchableOpacity
            onPress={() => setTarget('seller')}
            style={[s.toggleBtn, target === 'seller' && { backgroundColor: colors.surface }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="hub-partner" size={14} color={target === 'seller' ? colors.text : colors.textSecondary} />
              <Text style={[s.toggleText, { color: target === 'seller' ? colors.text : colors.textSecondary }]}>
                Vendeur
              </Text>
            </View>
            <Text style={[s.toggleHint, { color: colors.textSecondary }]} numberOfLines={1}>
              {pickupHubName}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTarget('buyer')}
            style={[s.toggleBtn, target === 'buyer' && { backgroundColor: colors.surface }]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Icon name="person-add" size={14} color={target === 'buyer' ? colors.text : colors.textSecondary} />
              <Text style={[s.toggleText, { color: target === 'buyer' ? colors.text : colors.textSecondary }]}>
                Acheteur
              </Text>
            </View>
            <Text style={[s.toggleHint, { color: colors.textSecondary }]} numberOfLines={1}>
              {deliveryHubName}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Address input */}
        <Text style={[s.label, { color: colors.text }]}>Point de rencontre proposé</Text>
        <TextInput
          style={[s.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          value={address}
          onChangeText={setAddress}
          placeholder="Adresse ou description du lieu"
          placeholderTextColor={colors.textSecondary}
          multiline
        />

        {/* Time input */}
        <Text style={[s.label, { color: colors.text }]}>Heure proposée</Text>
        <TextInput
          style={[s.timeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
          value={time}
          onChangeText={setTime}
          placeholder="14:00"
          placeholderTextColor={colors.textSecondary}
          keyboardType="numbers-and-punctuation"
          maxLength={5}
        />
        <Text style={[s.timeHint, { color: colors.textSecondary }]}>
          Doit être avant l'heure prévue au hub
        </Text>

        {/* Consent disclaimer */}
        <View style={[s.consent, { backgroundColor: colors.primary + '08' }]}>
          <Icon name="info" size={16} color={colors.primary} />
          <Text style={[s.consentText, { color: colors.textSecondary }]}>
            Cette demande reste soumise à l'accord des parties. Vous pouvez refuser toute remise hors hub non compatible avec votre trajet.
          </Text>
        </View>

        {/* Actions */}
        <Button title="Envoyer la proposition" onPress={handleSend} variant="gradient" disabled={!canSend} />
        <TouchableOpacity onPress={onClose} style={s.cancelBtn}>
          <Text style={[s.cancelText, { color: colors.textSecondary }]}>Annuler</Text>
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const s = StyleSheet.create({
  content: { gap: Spacing.lg },
  title: { ...Typography.h2, textAlign: 'center' },
  warning: { padding: Spacing.md, borderRadius: BorderRadius.sm },
  warningText: { ...Typography.caption, lineHeight: 18, textAlign: 'center' },
  label: { ...Typography.captionMedium },
  toggleRow: { flexDirection: 'row', borderRadius: BorderRadius.sm, padding: 3, gap: 0 },
  toggleBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.sm - 2, alignItems: 'center', gap: 2 },
  toggleText: { ...Typography.captionMedium },
  toggleHint: { fontSize: 10, lineHeight: 14 },
  input: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Typography.body, minHeight: 48 },
  timeInput: { borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, ...Typography.bodyMedium, width: 100, textAlign: 'center' },
  timeHint: { ...Typography.caption, marginTop: -Spacing.sm },
  consent: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, padding: Spacing.md, borderRadius: BorderRadius.sm },
  consentText: { ...Typography.caption, lineHeight: 18, flex: 1 },
  cancelBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  cancelText: { ...Typography.bodyMedium, textDecorationLine: 'underline' },
});
