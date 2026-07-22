import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  Modal,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import apiService from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { TAB_BAR_SPACE } from '../../../components/ui/FloatingTabBar';
import { useUI } from '../../../theme/ui';

const RUMBO_AVATAR_DARK = require('../../../../assets/agent/rumbo_128.png');
const RUMBO_AVATAR_LIGHT = require('../../../../assets/agent/rumbo_black_128.png');
const BOT_NAME = 'Rumbo';

const THINKING_MSGS = [
  'Pensando...',
  'Investigando...',
  'Un momento...',
  'Buscando información...',
  'Déjame ver...',
];

const RUMBO_CAPABILITIES = [
  { icon: 'search-outline',      label: 'Buscar un viaje' },
  { icon: 'calendar-outline',    label: 'Ver mis reservas' },
  { icon: 'help-circle-outline', label: '¿Cómo funciona Carpuling?' },
  { icon: 'warning-outline',     label: 'Resolver problemas' },
  { icon: 'card-outline',        label: 'Pagos y tarifas' },
];

function RumboProfileModal({ visible, onClose, isDarkMode }) {
  const ui = useUI();
  const slideAnim = useRef(new Animated.Value(400)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const insets = useSafeAreaInsets();
  const avatarSrc = isDarkMode ? RUMBO_AVATAR_DARK : RUMBO_AVATAR_LIGHT;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, bounciness: 4 }),
        Animated.timing(backdropAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }),
        Animated.timing(backdropAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, { opacity: backdropAnim }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View
        style={[
          styles.profileSheet,
          {
            backgroundColor: ui.bg,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <View style={[styles.sheetHandle, { backgroundColor: ui.border }]} />

        <View style={styles.profileAvatarWrapper}>
          <Image source={avatarSrc} style={styles.profileAvatar} />
        </View>

        <Text style={[styles.profileName, { color: ui.text, fontFamily: 'Sora_800ExtraBold' }]}>
          {BOT_NAME}
        </Text>
        <Text style={[styles.profileRole, { color: ui.textMuted, fontFamily: 'Sora_400Regular' }]}>
          Asistente virtual de Carpuling
        </Text>

        <Text style={[styles.profileBio, { color: ui.textMuted, fontFamily: 'Sora_400Regular' }]}>
          Hola, soy Rumbo. Estoy aquí para ayudarte con todo lo que necesites dentro de Carpuling. Desde buscar viajes hasta resolver dudas sobre pagos.
        </Text>

        <Text style={[styles.profileSectionTitle, { color: ui.textMuted, fontFamily: 'Sora_600SemiBold' }]}>
          ¿En qué puedo ayudarte?
        </Text>

        <View style={styles.capabilitiesList}>
          {RUMBO_CAPABILITIES.map((cap) => (
            <View key={cap.label} style={[styles.capabilityRow, { backgroundColor: ui.surface }]}>
              <Ionicons name={cap.icon} size={18} color={ui.text} />
              <Text style={[styles.capabilityText, { color: ui.text, fontFamily: 'Sora_500Medium' }]}>
                {cap.label}
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.closeBtn, { backgroundColor: ui.invertBg }]}
          onPress={onClose}
          activeOpacity={0.8}
        >
          <Text style={[styles.closeBtnText, { color: ui.invertText, fontFamily: 'Sora_600SemiBold' }]}>
            Cerrar
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

function ThinkingBubble({ color }) {
  const [msgIndex, setMsgIndex] = useState(0);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let current = 0;
    let cancelled = false;

    const cycle = () => {
      if (cancelled) return;
      Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
        if (cancelled) return;
        current = (current + 1) % THINKING_MSGS.length;
        setMsgIndex(current);
        Animated.timing(opacity, { toValue: 1, duration: 250, useNativeDriver: true }).start(() => {
          if (cancelled) return;
          setTimeout(cycle, 700);
        });
      });
    };

    const timer = setTimeout(cycle, 900);
    return () => {
      cancelled = true;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, []);

  return (
    <Animated.Text style={[styles.bubbleText, styles.thinkingText, { color, fontFamily: 'Sora_400Regular', opacity }]}>
      {THINKING_MSGS[msgIndex]}
    </Animated.Text>
  );
}

export default function AssistantScreen() {
  const insets = useSafeAreaInsets();
  const ui = useUI();
  const { isDarkMode } = useTheme();
  const flatListRef = useRef(null);
  const msgIdRef = useRef(0);
  const nextId = useCallback(() => String(++msgIdRef.current), []);

  const [items, setItems] = useState([]);
  const [activeOptionsId, setActiveOptionsId] = useState(null);
  const [disabled, setDisabled] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const scrollToEnd = useCallback(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, []);

  const fetchNode = useCallback(async (nodeId, userLabel) => {
    setDisabled(true);
    setActiveOptionsId(null);

    if (userLabel) {
      setItems((prev) => [...prev, { id: nextId(), type: 'user', text: userLabel }]);
      scrollToEnd();
    }

    const typingId = nextId();
    const isInitial = !userLabel;

    if (!isInitial) {
      setItems((prev) => [...prev, { id: typingId, type: 'typing' }]);
      scrollToEnd();
    }

    try {
      const [res] = await Promise.all([
        apiService.post(ENDPOINTS.BOT_MESSAGE, { nodeId }),
        isInitial
          ? Promise.resolve()
          : new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 200)),
      ]);
      const { message, options } = res.data.data;
      const botId = nextId();

      setItems((prev) => [
        ...prev.filter((i) => isInitial || i.id !== typingId),
        { id: botId, type: 'bot', text: message, options: options || [] },
      ]);
      if (options?.length) setActiveOptionsId(botId);
    } catch {
      const botId = nextId();
      setItems((prev) => [
        ...prev.filter((i) => isInitial || i.id !== typingId),
        {
          id: botId,
          type: 'bot',
          text: 'Ocurrió un error. Por favor, intentá de nuevo.',
          options: [{ id: 'start', label: 'Volver al inicio' }],
        },
      ]);
      setActiveOptionsId(botId);
    } finally {
      setDisabled(false);
      scrollToEnd();
    }
  }, [scrollToEnd]);

  useEffect(() => {
    fetchNode('start', null);
  }, []);

  const handleOption = useCallback((option) => {
    if (disabled) return;
    fetchNode(option.id, option.label);
  }, [disabled, fetchNode]);

  const renderItem = useCallback(({ item }) => {
    const avatarSrc = isDarkMode ? RUMBO_AVATAR_DARK : RUMBO_AVATAR_LIGHT;
    const avatarStyle = [styles.avatarWrapper, !isDarkMode && styles.avatarShadow];
    const avatarEl = (
      <TouchableOpacity onPress={() => setShowProfile(true)} activeOpacity={0.75}>
        <View style={avatarStyle}>
          <Image source={avatarSrc} style={styles.avatar} />
        </View>
      </TouchableOpacity>
    );

    if (item.type === 'typing') {
      return (
        <View style={[styles.row, styles.botRow]}>
          {avatarEl}
          <View style={styles.botContent}>
            <View style={[styles.bubble, styles.botBubble, { backgroundColor: ui.surface, borderColor: ui.border }]}>
              <ThinkingBubble color={ui.textMuted} />
            </View>
          </View>
        </View>
      );
    }

    if (item.type === 'bot') {
      const showOptions = item.id === activeOptionsId && item.options?.length > 0;
      return (
        <View style={[styles.row, styles.botRow]}>
          {avatarEl}
          <View style={styles.botContent}>
            <View style={[styles.bubble, styles.botBubble, { backgroundColor: ui.surface, borderColor: ui.border }]}>
              <Text style={[styles.bubbleText, { color: ui.text, fontFamily: 'Sora_500Medium' }]}>
                {item.text}
              </Text>
            </View>
            {showOptions && item.options.map((opt) => (
              <TouchableOpacity
                key={opt.id}
                style={[
                  styles.optionBtn,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                  disabled && styles.optionDisabled,
                ]}
                onPress={() => handleOption(opt)}
                activeOpacity={0.7}
                disabled={disabled}
              >
                <Text style={[styles.optionText, { color: ui.text, fontFamily: 'Sora_400Regular' }]}>
                  {opt.label}
                </Text>
                <Ionicons name="chevron-forward" size={14} color={ui.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </View>
      );
    }

    if (item.type === 'user') {
      return (
        <View style={[styles.row, styles.userRow]}>
          <View style={[styles.bubble, styles.userBubble, { backgroundColor: ui.invertBg }]}>
            <Text style={[styles.bubbleText, { color: ui.invertText, fontFamily: 'Sora_400Regular' }]}>
              {item.text}
            </Text>
          </View>
        </View>
      );
    }

    return null;
  }, [ui, isDarkMode, activeOptionsId, disabled, handleOption]);

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <RumboProfileModal
        visible={showProfile}
        onClose={() => setShowProfile(false)}
        isDarkMode={isDarkMode}
      />
      {/* El header estaba vacío: solo pintaba una barra. Ahora identifica a Rumbo
          y es el acceso a su perfil, que antes solo se abría tocando un avatar
          suelto entre los mensajes. */}
      <TouchableOpacity
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: ui.bg,
            borderBottomColor: ui.border,
          },
        ]}
        onPress={() => setShowProfile(true)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel="Ver el perfil de Rumbo"
      >
        <Image source={isDarkMode ? RUMBO_AVATAR_DARK : RUMBO_AVATAR_LIGHT} style={styles.headerAvatar} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerName, { color: ui.text, fontFamily: 'Sora_700Bold' }]}>Rumbo</Text>
          <Text style={[styles.headerRole, { color: ui.textMuted, fontFamily: 'Sora_400Regular' }]}>Tu asistente de viajes</Text>
        </View>
      </TouchableOpacity>

      <FlatList
        ref={flatListRef}
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={[styles.chatContent, { paddingBottom: insets.bottom + TAB_BAR_SPACE }]}
        onContentSizeChange={scrollToEnd}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 999,
  },
  headerName: {
    fontSize: 18,
    letterSpacing: -0.4,
  },
  headerRole: {
    fontSize: 12,
    marginTop: 1,
  },
  chatContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  row: {
    flexDirection: 'row',
    marginVertical: 3,
  },
  botRow: {
    alignSelf: 'flex-start',
    maxWidth: '88%',
    gap: 8,
  },
  userRow: {
    alignSelf: 'flex-end',
    maxWidth: '75%',
  },
  avatarWrapper: {
    width: 32,
    height: 32,
    borderRadius: 16,
    flexShrink: 0,
    marginTop: 2,
  },
  avatarShadow: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  botContent: {
    flexShrink: 1,
    gap: 6,
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  botBubble: { borderBottomLeftRadius: 6 },
  userBubble: { borderWidth: 0, borderBottomRightRadius: 6 },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  thinkingText: {
    fontStyle: 'italic',
  },
  optionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 999,
    borderWidth: 1,
    gap: 8,
  },
  optionDisabled: { opacity: 0.5 },
  optionText: {
    fontSize: 14,
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  profileSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    alignItems: 'center',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  profileAvatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    overflow: 'hidden',
    marginBottom: 12,
  },
  profileAvatar: {
    width: 90,
    height: 90,
  },
  profileName: {
    fontSize: 26,
    letterSpacing: -0.6,
    marginBottom: 4,
  },
  profileRole: {
    fontSize: 13,
    marginBottom: 16,
  },
  profileBio: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
    marginBottom: 20,
  },
  profileSectionTitle: {
    fontSize: 13,
    alignSelf: 'flex-start',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  capabilitiesList: {
    width: '100%',
    gap: 8,
    marginBottom: 24,
  },
  capabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  capabilityText: {
    fontSize: 14,
  },
  closeBtn: {
    width: '100%',
    height: 58,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 16,
  },
});
