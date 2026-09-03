import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { Icon } from '@/components/ui/Icon';
import { Toast } from '@/components/ui/Toast';
import { Typography } from '@/constants/Typography';
import { Spacing, BorderRadius } from '@/constants/Spacing';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuthStore } from '@/stores/useAuthStore';
import {
  ouvrirFil,
  chargerMessages,
  envoyerMessage,
  marquerLu,
  type Interlocuteur,
} from '@/services/messagerie';

type MessageType = 'text' | 'call-summary' | 'image';

interface Message {
  id: string;
  type: MessageType;
  text: string;
  fromMe: boolean;
  time: string;
  callDuration?: string; // for call-summary
  imageUri?: string; // for image
}

const QUICK_REPLIES = [
  'Je suis en route',
  'Je suis au hub',
  'Combien de temps encore ?',
  'Merci !',
];

// 🔴 TROIS MESSAGES DE DÉMONSTRATION OUVRAIENT CHAQUE CONVERSATION —
// « Bonjour ! Le colis est prêt au hub. » — y compris celles où personne
// n'avait jamais écrit. On part d'un fil vide, et on charge ce qui existe.

const heure = (iso: string) =>
  new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

export default function ChatScreen() {
  const params = useLocalSearchParams<{
    id: string;
    name: string;
    role: string;
    avatar?: string;
    callDuration?: string;
    missionId?: string;
  }>();
  const { id, name, role, avatar } = params;
  const { colors } = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const flatListRef = useRef<FlatList>(null);

  const moiId = useAuthStore((e) => e.user?.id ?? null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [filId, setFilId] = useState<string | null>(null);
  const [chargement, setChargement] = useState(true);
  const [erreur, setErreur] = useState<string | null>(null);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [input, setInput] = useState('');
  const [showVideoTip, setShowVideoTip] = useState(false);

  // 🔴 LE FIL VIENT DE LA BASE. `ouvrir_fil_colivraison` le crée à la
  // première ouverture et le retrouve ensuite ; le serveur décide qui a le
  // droit de l'ouvrir, et refuse plutôt que de rediriger.
  //
  // ⚠️ UNE ERREUR SE DIT. Un fil vide et un fil refusé finissent tous deux sur
  // une liste vide : sans ce message, le cotransporteur conclurait que
  // personne ne lui a répondu.
  useEffect(() => {
    if (!params.missionId || (role !== 'seller' && role !== 'buyer')) {
      setChargement(false);
      setErreur('Conversation indisponible pour cette co-livraison.');
      return;
    }
    let vivant = true;
    setChargement(true);
    (async () => {
      try {
        const fil = await ouvrirFil(params.missionId as string, role as Interlocuteur);
        const lignes = await chargerMessages(fil, moiId);
        if (!vivant) return;
        setFilId(fil);
        setMessages(
          lignes.map((l) => ({
            id: l.id,
            type: 'text' as MessageType,
            text: l.texte ?? '',
            fromMe: l.deMoi,
            time: heure(l.envoyeLe),
          })),
        );
        setErreur(null);
        void marquerLu(fil).catch(() => {
          /* ⚠️ NE PAS FAIRE ÉCHOUER L'AFFICHAGE POUR UNE PASTILLE. */
        });
      } catch (e) {
        console.error('[chat] fil indisponible', e);
        if (vivant) setErreur(e instanceof Error ? e.message : 'Conversation indisponible.');
      } finally {
        if (vivant) setChargement(false);
      }
    })();
    return () => { vivant = false; };
  }, [params.missionId, role, moiId]);

  // When returning from a call, append a call-summary message
  useEffect(() => {
    if (params.callDuration) {
      const summary: Message = {
        id: `call-${Date.now()}`,
        type: 'call-summary',
        text: 'Appel audio',
        fromMe: false,
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        callDuration: params.callDuration,
      };
      setMessages((prev) => [...prev, summary]);
      // Clear the param so back-and-forth doesn't re-add
      router.setParams({ callDuration: undefined } as any);
    }
  }, [params.callDuration]);

  // 🔴 L'ÉCRAN FABRIQUAIT LA RÉPONSE DE L'AUTRE. Deux secondes après l'envoi,
  // un `setTimeout` ajoutait « Bien reçu, merci ! » ou « Je vous attends au hub »
  // au nom du vendeur. Rien n'était parti, personne n'avait répondu — et un
  // cotransporteur qui lit « Je vous attends au hub » va au hub.
  //
  // ⚠️ ON AFFICHE CE QUE LA BASE A ÉCRIT, pas ce qu'on a tapé : la RLS peut
  // refuser l'envoi (fil étranger, contact bloqué), et l'écran doit l'apprendre
  // plutôt que de montrer un message que personne ne recevra.
  const sendMessage = async (text: string) => {
    const propre = text.trim();
    if (!propre || !filId || !moiId || envoiEnCours) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEnvoiEnCours(true);
    setInput('');
    try {
      const envoye = await envoyerMessage(filId, moiId, propre);
      setMessages((prev) => [
        ...prev,
        {
          id: envoye.id,
          type: 'text' as MessageType,
          text: envoye.texte ?? propre,
          fromMe: true,
          time: heure(envoye.envoyeLe),
        },
      ]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      // ⚠️ ON REND SON TEXTE À L'EXPÉDITEUR. Le perdre en même temps que
      // l'envoi obligerait à le retaper, souvent sous la pluie.
      console.error('[chat] envoi impossible', e);
      setInput(propre);
      Alert.alert('Message non envoyé', e instanceof Error ? e.message : 'Réessayez.');
    } finally {
      setEnvoiEnCours(false);
    }
  };

  const appendImage = (uri: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMsg: Message = {
      id: `img-${Date.now()}`,
      type: 'image',
      text: '',
      imageUri: uri,
      fromMe: true,
      time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, newMsg]);
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const pickFromLibrary = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Autorisation requise', "Autorisez l'accès aux photos pour envoyer une image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: false,
    });
    if (!result.canceled && result.assets[0]) appendImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Autorisation requise', "Autorisez l'accès à l'appareil photo pour prendre une photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets[0]) appendImage(result.assets[0].uri);
  };

  // Bouton photo de la barre de saisie — propose appareil photo ou galerie.
  const sendPhoto = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert('Envoyer une photo', 'Choisissez une source', [
      { text: 'Appareil photo', onPress: takePhoto },
      { text: 'Galerie', onPress: pickFromLibrary },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const startAudioCall = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push({
      pathname: '/call/[id]' as any,
      params: { id, name: name ?? '', role: role ?? '', avatar: avatar ?? '' },
    });
  };

  const roleLabel = role === 'seller' ? 'Vendeur' : 'Acheteur';

  const handleReportUser = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({
      pathname: '/report/user' as any,
      params: {
        reportedUserId: id ?? '',
        reportedUserName: name ?? '',
        reportedRole: role === 'seller' ? 'seller' : 'buyer',
        missionId: params.missionId ?? '',
        conversationId: filId ?? '',
      },
    });
  };

  return (
    <View style={[s.screen, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[s.headerBar, { paddingTop: insets.top, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} hitSlop={12} accessibilityLabel="Retour">
          <Icon name="back" size={24} color={colors.text} />
        </TouchableOpacity>
        {avatar ? (
          <Image source={{ uri: avatar }} style={s.headerAvatarImg} contentFit="cover" />
        ) : (
          <View style={[s.headerAvatar, { backgroundColor: role === 'seller' ? colors.primary + '20' : colors.accent + '30' }]}>
            <Text style={[s.headerAvatarText, { color: role === 'seller' ? colors.primary : colors.accent }]}>{(name ?? 'U')[0]}</Text>
          </View>
        )}
        <View style={s.headerInfo}>
          <Text style={[s.headerName, { color: colors.text }]} numberOfLines={1}>{name ?? 'Contact'}</Text>
          <Text style={[s.headerRole, { color: colors.textSecondary }]}>{roleLabel}</Text>
        </View>
        <TouchableOpacity
          onPress={startAudioCall}
          style={s.headerAction}
          hitSlop={8}
          accessibilityLabel={`Appeler ${name ?? 'le contact'}`}
        >
          <Icon name="call" size={22} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => setShowVideoTip(true)}
          style={s.headerAction}
          hitSlop={8}
          accessibilityLabel="Appel vidéo, bientôt disponible"
          accessibilityState={{ disabled: true }}
        >
          <Icon name="video" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={handleReportUser}
          style={s.headerAction}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Signaler ${name ?? 'l\'utilisateur'}`}
        >
          <Icon name="flag" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={s.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item, index }) => {
            if (item.type === 'call-summary') {
              return (
                <Animated.View entering={FadeIn.duration(250)} style={s.callSummary}>
                  <Icon name="call" size={14} color={colors.textSecondary} />
                  <Text style={[s.callSummaryText, { color: colors.textSecondary }]}>
                    Appel audio · {item.callDuration ?? '00:00'} · Terminé
                  </Text>
                </Animated.View>
              );
            }
            if (item.type === 'image' && item.imageUri) {
              return (
                <Animated.View entering={FadeInDown.delay(index * 30).duration(200)}>
                  <View
                    style={[
                      s.imageBubble,
                      item.fromMe ? s.bubbleMe : s.bubbleThem,
                      { borderColor: item.fromMe ? colors.primary : colors.border },
                    ]}
                  >
                    <Image source={{ uri: item.imageUri }} style={s.messageImage} contentFit="cover" />
                    <Text
                      style={[
                        s.imageTime,
                        { color: '#FFFFFF', backgroundColor: 'rgba(0,0,0,0.45)' },
                      ]}
                    >
                      {item.time}
                    </Text>
                  </View>
                </Animated.View>
              );
            }
            return (
              <Animated.View entering={FadeInDown.delay(index * 30).duration(200)}>
                <View style={[s.bubble, item.fromMe ? s.bubbleMe : s.bubbleThem, {
                  backgroundColor: item.fromMe ? colors.primary : colors.surface,
                  borderColor: item.fromMe ? colors.primary : colors.border,
                }]}>
                  <Text style={[s.bubbleText, { color: item.fromMe ? '#FFFFFF' : colors.text }]}>
                    {item.text}
                  </Text>
                  <Text style={[s.bubbleTime, { color: item.fromMe ? 'rgba(255,255,255,0.6)' : colors.textSecondary }]}>
                    {item.time}
                  </Text>
                </View>
              </Animated.View>
            );
          }}
        />

        {/* Quick replies */}
        <View style={s.quickRow}>
          <FlatList
            data={QUICK_REPLIES}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item}
            contentContainerStyle={s.quickList}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => sendMessage(item)}
                style={[s.quickPill, { borderColor: colors.border, backgroundColor: colors.surface }]}
              >
                <Text style={[s.quickText, { color: colors.primary }]}>{item}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Input bar */}
        <View style={[s.inputBar, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: insets.bottom + Spacing.sm }]}>
          <TouchableOpacity
            onPress={sendPhoto}
            style={[s.photoBtn, { backgroundColor: colors.background, borderColor: colors.border }]}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Envoyer une photo"
          >
            <Icon name="photo" size={20} color={colors.primary} />
          </TouchableOpacity>
          <TextInput
            style={[s.input, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            value={input}
            onChangeText={setInput}
            placeholder="Écrire un message..."
            placeholderTextColor={colors.textSecondary}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            onPress={() => sendMessage(input)}
            style={[s.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.border }]}
            disabled={!input.trim()}
          >
            <Icon name="send" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Toast
        message="Appel vidéo bientôt disponible"
        type="success"
        visible={showVideoTip}
        onHide={() => setShowVideoTip(false)}
        duration={1800}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },

  // Header
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 0.5,
    gap: Spacing.md,
  },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  headerAvatarImg: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarText: { fontFamily: 'Poppins_600SemiBold', fontSize: 14 },
  headerInfo: { flex: 1 },
  headerName: { ...Typography.bodyMedium },
  headerRole: { ...Typography.caption, fontSize: 11 },
  headerAction: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },

  callSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    alignSelf: 'center',
  },
  callSummaryText: { ...Typography.caption },

  // Messages
  messageList: { padding: Spacing.lg, gap: Spacing.sm },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: 4,
  },
  bubbleMe: { alignSelf: 'flex-end', borderBottomRightRadius: 4 },
  bubbleThem: { alignSelf: 'flex-start', borderBottomLeftRadius: 4 },
  bubbleText: { ...Typography.body, lineHeight: 20 },
  bubbleTime: { ...Typography.caption, fontSize: 10, alignSelf: 'flex-end' },

  // Image message
  imageBubble: {
    maxWidth: '70%',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  messageImage: { width: 200, height: 200 },
  imageTime: {
    ...Typography.caption,
    fontSize: 10,
    position: 'absolute',
    bottom: 6,
    right: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },

  // Quick replies
  quickRow: { paddingVertical: Spacing.sm },
  quickList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  quickPill: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  quickText: { ...Typography.captionMedium },

  // Input
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 0.5,
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    maxHeight: 100,
    ...Typography.body,
  },
  photoBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
});
