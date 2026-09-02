import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, StyleSheet } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';

export type ScannerMode = 'seller-qr' | 'buyer-qr' | 'package';

interface QRScannerProps {
  onScan: (data: string) => void;
  onManualEntry?: (code: string) => void;
  mode?: ScannerMode;
  instruction?: string;
  resetSignal?: number;
  // 🔴 `onDevBypass` A ÉTÉ RETIRÉ LE 22/08/2026. C'était un bouton qui sautait
  // le scan en entier — donc toute la preuve de garde du colis — et il ne
  // dépendait que de `__DEV__`, c'est-à-dire du type de build, pas d'un réglage
  // qu'on puisse vérifier avant publication. Depuis `20260822270000`, la base
  // COMPARE le code présenté : un raccourci client ne pourrait de toute façon
  // plus rien faire avancer, mais il continuerait d'afficher un faux succès.
}

const COPY: Record<ScannerMode, { instruction: string; subtitle: string; manualTitle: string; manualSub: string; manualLabel: string; manualPlaceholder: string }> = {
  'seller-qr': {
    instruction: 'Scannez le QR code du vendeur',
    subtitle: "Votre vendeur vous présente son code à l'écran",
    manualTitle: 'Code vendeur',
    manualSub: 'Entrez le code communiqué par le vendeur',
    manualLabel: 'Code vendeur',
    manualPlaceholder: 'HTH-XXXXX',
  },
  'buyer-qr': {
    instruction: "Scannez le QR code de l'acheteur",
    subtitle: "Votre acheteur vous présente son code à l'écran",
    manualTitle: 'Code acheteur',
    manualSub: "Entrez le code communiqué par l'acheteur",
    manualLabel: 'Code acheteur',
    manualPlaceholder: 'HTH-XXXXX',
  },
  'package': {
    instruction: "Scannez la fiche colis",
    subtitle: "Code-barres ou QR sur l'étiquette collée sur le colis",
    manualTitle: 'Numéro de colis',
    manualSub: 'Entrez le numéro inscrit sur la fiche colis',
    manualLabel: 'Numéro de colis',
    manualPlaceholder: 'HTH-XXXXX',
  },
};

export function QRScanner({ onScan, onManualEntry, mode = 'seller-qr', instruction, resetSignal }: QRScannerProps) {
  const { colors } = useColorScheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [flashOn, setFlashOn] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [flashColor, setFlashColor] = useState<string | null>(null);

  const copy = COPY[mode];

  // External reset
  useEffect(() => {
    if (resetSignal !== undefined) {
      setScanned(false);
      setManualCode('');
    }
  }, [resetSignal]);

  // 🔴 UN CODE APPARTIENT À UN SEUL SCAN. `pickup` et `delivery` rendent deux
  // `<QRScanner>` dans deux branches de retour différentes, à la même position
  // de l'arbre : React réconcilie par type et par position, donc c'est LA MÊME
  // instance qui sert les deux étapes, et `manualCode` traversait le changement.
  // Le code du vendeur (`SEL-…`) arrivait pré-rempli dans le champ « Numéro de
  // colis », et celui de l'acheteur (`BUY-…`) de même à la remise.
  //
  // 🔴 CE N'ÉTAIT PAS QU'UNE GÊNE : « Valider » est actif puisque le champ n'est
  // pas vide, et les deux écrans COMPTENT les échecs — trois, puis l'écran se
  // verrouille sur « contactez le support ». Une valeur laissée là par l'étape
  // d'avant pouvait donc consommer les essais de quelqu'un qui a le colis en
  // main, devant le vendeur.
  //
  // ⚠️ ON EFFACE LE CODE, PAS LE MODE DE SAISIE. Remonter le composant avec une
  // `key` effacerait aussi `showManual` — et renverrait vers la caméra quelqu'un
  // qui vient de dicter parce que la sienne ne lit rien. Un code appartient à un
  // scan ; le mode de saisie appartient à la personne.
  useEffect(() => {
    setManualCode('');
    setScanned(false);
  }, [mode]);

  // Scanning line animation
  const scanLineY = useSharedValue(0);
  useEffect(() => {
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(220, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const handleBarcode = useCallback(({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onScan(data);
  }, [scanned, onScan]);

  const handleManualSubmit = () => {
    if (manualCode.trim()) {
      onManualEntry?.(manualCode.trim());
    }
  };

  useEffect(() => {
    if (flashColor) {
      const timer = setTimeout(() => setFlashColor(null), 400);
      return () => clearTimeout(timer);
    }
  }, [flashColor]);

  if (!permission) return null;

  // 🔴 LA SAISIE MANUELLE PASSE AVANT LE REFUS DE CAMÉRA, et c'était tout le
  // défaut : les deux branches existaient, mais celle de la permission rendait
  // la main en premier — donc celle-ci n'était jamais atteinte. Sans caméra
  // autorisée, la dictée était inatteignable, au moment exact où elle sert.
  //
  // ⚠️ ET L'AUTRE APPLICATION LA PROMET : l'écran du vendeur imprime sous son QR
  // « A dicter si le scan echoue ». On tenait une promesse à moitié.
  if (showManual) {
    return (
      <View style={[styles.manualContainer, { backgroundColor: colors.background }]}>
        <Text
          style={[styles.manualTitle, { color: colors.text }]}
          accessibilityRole="header"
        >
          {copy.manualTitle}
        </Text>
        <Text style={[styles.manualSub, { color: colors.textSecondary }]}>{copy.manualSub}</Text>
        <Text
          style={[styles.manualFieldLabel, { color: colors.textSecondary }]}
          nativeID="manualCodeLabel"
        >
          {copy.manualLabel}
        </Text>
        <TextInput
          style={[styles.manualInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          value={manualCode}
          onChangeText={setManualCode}
          placeholder={copy.manualPlaceholder}
          placeholderTextColor={colors.textSecondary}
          autoFocus
          autoCapitalize="characters"
          accessibilityLabel={copy.manualLabel}
          accessibilityLabelledBy="manualCodeLabel"
        />
        <Button title="Valider" onPress={handleManualSubmit} variant="gradient" disabled={!manualCode.trim()} />
        <TouchableOpacity onPress={() => { setShowManual(false); setScanned(false); }}>
          <Text style={[styles.backToScan, { color: colors.primary }]}>Retour au scanner</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Icon name="camera" size={56} color={colors.textSecondary} />
        <Text style={[styles.permissionText, { color: colors.text }]}>
          Autorisez l'accès à la caméra pour scanner les QR codes.
        </Text>
        <Button title="Autoriser la caméra" onPress={requestPermission} variant="gradient" />
        {/* 🔴 UNE ISSUE DEPUIS CET ÉCRAN-CI, ET PAS SEULEMENT DEPUIS LA CAMÉRA.
            Le lien « Entrer le code manuellement » vit sous le viseur : le
            remonter au-dessus du garde ne le rend atteignable que pour qui y
            était déjà passé. Or sous Android un refus DÉFINITIF rend
            `requestPermission()` sans effet — la boîte système ne s'ouvre plus.
            Sans cette porte, l'écran ne proposait qu'un bouton mort, colis en
            main, devant le vendeur. */}
        <TouchableOpacity onPress={() => setShowManual(true)}>
          <Text style={[styles.backToScan, { color: colors.primary }]}>
            Entrer le code manuellement
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcode}
        enableTorch={flashOn}
      />

      {/* Dark overlay with transparent scan area */}
      <View style={styles.overlay}>
        <View style={styles.overlayTop} />
        <View style={styles.overlayMiddle}>
          <View style={styles.overlaySide} />
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.cornerTL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerTR, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBL, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.cornerBR, { borderColor: colors.primary }]} />
            <Animated.View style={[styles.scanLine, { backgroundColor: colors.primary }, scanLineStyle]} />
          </View>
          <View style={styles.overlaySide} />
        </View>
        <View style={styles.overlayBottom}>
          <Text style={styles.instruction}>{instruction ?? copy.instruction}</Text>
          <Text style={styles.subtitle}>{copy.subtitle}</Text>
        </View>
      </View>

      {flashColor && <View style={[styles.flashOverlay, { backgroundColor: flashColor }]} />}

      {/* Bottom controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          onPress={() => setFlashOn(!flashOn)}
          style={[styles.flashBtn, { backgroundColor: flashOn ? colors.warning : 'rgba(255,255,255,0.2)' }]}
          accessibilityLabel={flashOn ? 'Éteindre la lampe torche' : 'Allumer la lampe torche'}
        >
          <Icon name={flashOn ? 'flashlight-on' : 'flashlight'} size={22} color="#FFFFFF" />
        </TouchableOpacity>

        {scanned && (
          <Button
            title="Scanner à nouveau"
            onPress={() => setScanned(false)}
            variant="outline"
            textStyle={{ color: '#FFFFFF' }}
            style={{ borderColor: '#FFFFFF' }}
          />
        )}

        <TouchableOpacity onPress={() => setShowManual(true)}>
          <Text style={styles.manualLink}>Entrer le code manuellement</Text>
        </TouchableOpacity>

      </View>
    </View>
  );
}

const SCAN_SIZE = 250;

const styles = StyleSheet.create({
  container: { flex: 1 },
  camera: { flex: 1 },

  overlay: { ...StyleSheet.absoluteFillObject },
  overlayTop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  overlayMiddle: { flexDirection: 'row' },
  overlaySide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  scanArea: { width: SCAN_SIZE, height: SCAN_SIZE },
  overlayBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: Spacing.xxl, paddingHorizontal: Spacing.xxl, gap: 6 },

  corner: { position: 'absolute', width: 28, height: 28, borderWidth: 3 },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: BorderRadius.sm },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: BorderRadius.sm },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: BorderRadius.sm },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: BorderRadius.sm },

  scanLine: { width: '100%', height: 2, opacity: 0.8 },

  instruction: { ...Typography.bodyMedium, color: '#FFFFFF', textAlign: 'center' },
  subtitle: { ...Typography.caption, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  flashOverlay: { ...StyleSheet.absoluteFillObject },

  controls: { position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center', gap: Spacing.lg },
  flashBtn: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  manualLink: { ...Typography.captionMedium, color: 'rgba(255,255,255,0.7)', textDecorationLine: 'underline' },

  permissionContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.lg },
  permissionText: { ...Typography.body, textAlign: 'center', lineHeight: 22 },

  manualContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xxl, gap: Spacing.lg },
  manualTitle: { ...Typography.h2 },
  manualSub: { ...Typography.body, textAlign: 'center' },
  manualFieldLabel: { ...Typography.captionMedium, alignSelf: 'flex-start', marginTop: Spacing.md },
  manualInput: { width: '100%', borderWidth: 1.5, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, textAlign: 'center', ...Typography.h3, letterSpacing: 2 },
  backToScan: { ...Typography.bodyMedium, textDecorationLine: 'underline' },
});
