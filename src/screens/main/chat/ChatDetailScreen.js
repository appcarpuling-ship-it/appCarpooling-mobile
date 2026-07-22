import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  ActivityIndicator,
  Image,
  Animated,
  StatusBar,
  DeviceEventEmitter,
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import apiService, { buildImageUri } from '../../../services/apiService';
import socketService from '../../../services/socketService';
import { useUI } from '../../../theme/ui';

/** Misma distancia borde superior del compositor ↔ cabecera del input, e input ↔ teclado (teclado abierto). */
const COMPOSER_VERTICAL_INSET = 12;

const ChatDetailScreen = ({ route, navigation }) => {
  const params = route.params ?? {};
  const rawConversation = params.conversation;
  const otherUser = useMemo(() => {
    const o = params.otherUser;
    return o && typeof o === 'object' ? o : {};
  }, [params.otherUser]);
  const conversationId = useMemo(() => {
    if (rawConversation && typeof rawConversation === 'object' && rawConversation._id) {
      return String(rawConversation._id);
    }
    if (typeof rawConversation === 'string' && rawConversation) return rawConversation;
    return null;
  }, [rawConversation]);

  const displayName = [otherUser?.firstName, otherUser?.lastName].filter(Boolean).join(' ') || 'Usuario';
  const displayInitials =
    `${otherUser?.firstName?.[0] ?? '?'}` + `${otherUser?.lastName?.[0] ?? ''}`;

  const { user } = useAuth();
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  
  const { loadUnreadCount, setActiveConversation, clearActiveConversation } = useUnreadMessages();
  const [messages, setMessages] = useState([]);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const loadingOlderRef = useRef(false);
  // scrollToBottom se usa en la carga inicial y al mandar/recibir. NO debe dispararse
  // cuando se prependean mensajes viejos, o el chat salta al final solo.
  const didInitialScrollRef = useRef(false);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputPadBottom = useRef(new Animated.Value(COMPOSER_VERTICAL_INSET + insets.bottom)).current;

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  /** Android usa adjustResize: solo necesitamos scroll al abrir teclado. */
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const onShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => onShow.remove();
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    const show = Keyboard.addListener('keyboardWillShow', () =>
      inputPadBottom.setValue(COMPOSER_VERTICAL_INSET));
    const hide = Keyboard.addListener('keyboardWillHide', () =>
      inputPadBottom.setValue(COMPOSER_VERTICAL_INSET + insets.bottom));
    return () => { show.remove(); hide.remove(); };
  }, [insets.bottom]);

  useLayoutEffect(() => {
    if (!conversationId) {
      navigation.goBack();
    }
  }, [conversationId, navigation]);

  useEffect(() => {
    if (!conversationId) return;

    // Marcar esta conversación como activa para evitar incrementar el contador
    setActiveConversation(conversationId);

    // Animacion fadeIn
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true
    }).start();

    // Detectar si venimos de fuera del ChatsTab
    const navigationState = navigation.getState();
    const isFromOutsideChatsTab = navigationState?.routes?.some(route =>
      route.name !== 'ChatsTab' && route.state?.index !== undefined
    );

    navigation.setOptions({
      headerStyle: {
        backgroundColor: ui.bg
      },
      headerTintColor: ui.text,
      headerTitleStyle: {
        color: ui.text
      },
      headerTitleAlign: 'left',
      headerTitleContainerStyle: {
        left: 0,
        right: 0
      },
      headerBackTitleVisible: false,
      headerLeft: () => (
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            // Si venimos de fuera del ChatsTab, ir al tab anterior
            if (isFromOutsideChatsTab) {
              navigation.goBack();
            } else {
              navigation.navigate('Chats');
            }
          }}
          activeOpacity={0.7}
        >
          <Ionicons name="chevron-back" size={24} color={ui.text} />
        </TouchableOpacity>
      ),
      headerTitle: () => {
        const profileUserId = otherUser?._id || otherUser?.id;
        const openPeerProfile = () => {
          if (!profileUserId) return;
          navigation.navigate('UserProfile', {
            userId: String(profileUserId),
            conversationId,
            fromChat: true,
          });
        };
        return (
          <TouchableOpacity
            style={styles.headerTitleTouchable}
            onPress={openPeerProfile}
            activeOpacity={0.75}
            disabled={!profileUserId}
          >
            <View style={styles.headerContainer}>
              <View style={styles.headerAvatarContainer}>
                {otherUser?.avatar && buildImageUri(otherUser.avatar) ? (
                  <Image
                    source={{ uri: buildImageUri(otherUser.avatar) }}
                    style={styles.headerAvatar}
                  />
                ) : (
                  <View style={[styles.headerAvatar, { backgroundColor: ui.invertBg }]}>
                    <Text style={[styles.headerAvatarText, { color: ui.invertText }]}>
                      {displayInitials}
                    </Text>
                  </View>
                )}
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: ui.text }]}>
                  {displayName}
                </Text>
                <Text style={[styles.headerSubtitle, { color: ui.textMuted }]}>
                  {typing ? 'Escribiendo...' : 'En linea'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        );
      }
    });

    loadMessages();

    // Unirse a la conversación
    socketService.joinConversation(conversationId);

    return () => {
      // Limpiar conversación activa al salir
      clearActiveConversation();

      // Salir de la conversación y limpiar listeners
      socketService.leaveConversation(conversationId);
      socketService.removeListener('message:received');
      socketService.removeListener('typing:user');
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Recargar contador al salir
      setTimeout(() => {
        loadUnreadCount();
      }, 300);
    };
  }, [conversationId, navigation, otherUser, typing, ui.bg, ui.text, ui.textMuted, ui.invertBg, ui.invertText]);

  // Separar en un useEffect para los listeners del socket
  useEffect(() => {
    if (!conversationId) return;
    // Escuchar mensajes en tiempo real
    const handleMessageReceived = async (message) => {
      if (String(message.conversation) !== String(conversationId)) return;

      setMessages(prev => {
        // Evitar duplicados: remover mensaje temporal si existe
        const filtered = (Array.isArray(prev) ? prev : []).filter(m => !m.isTemp);
        const exists = filtered.some(m => m._id === message._id);
        if (exists) return prev;
        return [...filtered, message];
      });
      scrollToBottom();

      // Solo marcar como leído si el usuario está viendo el chat (pantalla enfocada)
      // Evita que al volver a ChatsScreen el handler "fantasma" marque mensajes como leídos
      if (!isFocusedRef.current) return;

      try {
        await apiService.put(`/chat/conversation/${conversationId}/read`);
        console.log('✅ [ChatDetailScreen] Mensaje marcado como leído al recibir');
      } catch (error) {
        console.error('❌ [ChatDetailScreen] Error al marcar mensaje como leído:', error);
        socketService.markMessagesAsRead(conversationId);
      }
      setTimeout(() => loadUnreadCount(), 500);
    };

    // Escuchar cuando el otro usuario está escribiendo
    const handleTyping = (data) => {
      const userId = user?._id || user?.id;
      if (data.userId !== userId) {
        setTyping(data.isTyping);
      }
    };

    // Escuchar cuando se cierra la conversación
    const handleConversationClosed = (data) => {
      if (String(data.conversationId) === String(conversationId)) {
        // Mostrar alerta y redirigir
        alert(`Conversación cerrada: ${data.message}`);
        
        // Redirigir a la lista de chats
        navigation.goBack();
      }
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onTyping(handleTyping);
    socketService.onConversationClosed(handleConversationClosed);

    return () => {
      socketService.removeListener('message:received');
      socketService.removeListener('typing:user');
      socketService.removeListener('conversation:closed');
    };
  }, [conversationId, user?._id, user?.id, navigation]);

  const loadMessages = async () => {
    if (!conversationId) return;
    try {
      const response = await apiService.get(
        `/chat/conversation/${conversationId}/messages`
      );

      if (response.data.success) {
        setMessages(response.data.data);
        setHasMoreOlder(response.data.hasMore ?? false);

        // Marcar todos los mensajes como leídos cuando se carga el chat
        try {
          await apiService.put(`/chat/conversation/${conversationId}/read`);
          console.log('✅ [ChatDetailScreen] Mensajes marcados como leídos al cargar');
        } catch (error) {
          console.error('❌ [ChatDetailScreen] Error al marcar mensajes como leídos:', error);
        }

        // Recargar contador de no leídos después de un delay
        setTimeout(() => {
          loadUnreadCount();
        }, 1000);
      }
    } catch (error) {
      console.error('Error al cargar mensajes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Pagina por cursor (`before` = fecha del mensaje más viejo cargado) en vez de por
  // offset: si entran mensajes nuevos mientras el usuario sube, un offset le repetiría
  // o le saltearía mensajes.
  const loadOlderMessages = async () => {
    if (loadingOlderRef.current || !hasMoreOlder || messages.length === 0) return;
    loadingOlderRef.current = true;
    setLoadingOlder(true);
    try {
      const oldest = messages[0];
      const response = await apiService.get(
        `/chat/conversation/${conversationId}/messages`,
        { params: { before: oldest.createdAt, limit: 30 } }
      );
      if (response.data.success) {
        const older = response.data.data || [];
        setMessages(prev => {
          const seen = new Set(prev.map(m => m._id));
          return [...older.filter(m => !seen.has(m._id)), ...prev];
        });
        setHasMoreOlder(response.data.hasMore ?? false);
      }
    } catch (error) {
      console.error('Error al cargar mensajes anteriores:', error);
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlder(false);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);

    try {
      // Enviar a través de WebSocket
      socketService.sendMessage(conversationId, messageText);

      // Agregar mensaje optimísticamente
      const tempMessage = {
        _id: Date.now().toString(),
        content: messageText,
        sender: user,
        createdAt: new Date(),
        isTemp: true
      };

      setMessages(prev => [...prev, tempMessage]);
      scrollToBottom();

      // Notificar a ChatsScreen para actualizar el preview sin hacer request
      DeviceEventEmitter.emit('conversationUpdated', {
        conversationId,
        message: tempMessage,
      });

      // Detener indicador de escritura
      socketService.stopTyping(conversationId);
    } catch (error) {
      console.error('Error al enviar mensaje:', error);
    } finally {
      setSending(false);
    }
  };

  const handleTyping = (text) => {
    setNewMessage(text);

    // Notificar que está escribiendo
    if (text.length > 0) {
      socketService.startTyping(conversationId);

      // Detener después de 2 segundos sin escribir
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(conversationId);
      }, 2000);
    } else {
      socketService.stopTyping(conversationId);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const formatMessageTime = (date) => {
    const messageDate = new Date(date);
    return messageDate.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const renderMessage = ({ item }) => {
    const senderId = item.sender?._id || item.sender;
    const isOwnMessage = senderId === user._id || senderId === user.id;

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          { opacity: fadeAnim }
        ]}
      >
        {isOwnMessage ? (
          <View style={[styles.messageBubble, styles.ownMessage, { backgroundColor: ui.invertBg }]}>
            <Text style={[styles.messageText, { color: ui.invertText }]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, { color: ui.invertText, opacity: 0.6 }]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        ) : (
          <View style={[
            styles.messageBubble,
            styles.otherMessage,
            { backgroundColor: ui.surface }
          ]}>
            <Text style={[styles.messageText, styles.otherMessageText, { color: ui.text }]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, styles.otherMessageTime, { color: ui.textMuted }]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  if (!conversationId) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.invertBg} />
      </View>
    );
  }


  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.invertBg} />
      </View>
    );
  }

  const keyboardVerticalOffset =
    Platform.OS === 'android'
      ? headerHeight + (StatusBar.currentHeight || 0)
      : headerHeight;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: ui.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={{ flex: 1 }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          ref={flatListRef}
          style={{ flex: 1 }}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() => {
            if (!didInitialScrollRef.current) {
              scrollToBottom();
              didInitialScrollRef.current = true;
            }
          }}
          onLayout={scrollToBottom}
          onStartReached={loadOlderMessages}
          onStartReachedThreshold={0.2}
          // Mantiene la posición visible al prependear: sin esto el contenido salta
          // hacia arriba cada vez que entra una tanda de mensajes viejos.
          maintainVisibleContentPosition={{ minIndexForVisible: 1 }}
          ListHeaderComponent={
            loadingOlder ? (
              <View style={{ paddingVertical: 12, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={ui.textMuted} />
              </View>
            ) : null
          }
          showsVerticalScrollIndicator={false}
        />

        {typing && (
          <View style={[styles.typingIndicator, { backgroundColor: ui.bg }]}>
            <View
              style={[styles.typingDot, { backgroundColor: ui.invertBg }]}
            />
            <Text style={[styles.typingText, { color: ui.textMuted }]}>
              {displayName} esta escribiendo...
            </Text>
          </View>
        )}

        <Animated.View style={[
          styles.inputContainer,
          {
            backgroundColor: ui.bg,
            borderTopColor: ui.border,
            paddingTop: COMPOSER_VERTICAL_INSET,
            paddingBottom: inputPadBottom,
          },
        ]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: ui.surface,
                borderColor: ui.border,
                color: ui.text,
              },
            ]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={ui.textMuted}
            value={newMessage}
            onChangeText={handleTyping}
            onFocus={() => { if (Platform.OS === 'android') inputPadBottom.setValue(COMPOSER_VERTICAL_INSET); }}
            onBlur={() => { if (Platform.OS === 'android') inputPadBottom.setValue(COMPOSER_VERTICAL_INSET + insets.bottom); }}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.sendButton,
                { backgroundColor: (!newMessage.trim() || sending) ? ui.surface : ui.invertBg },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={ui.invertText} />
              ) : (
                <Ionicons name="send" size={22} color={(!newMessage.trim()) ? ui.textMuted : ui.invertText} />
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  // Header styles
  headerTitleTouchable: {
    flex: 1,
    maxWidth: '100%',
  },
  headerContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    marginLeft: -16
  },
  headerAvatarContainer: {
    marginRight: 12
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center'
  },
  headerAvatarText: {
    fontSize: 16,
    fontFamily: 'Sora_700Bold'
  },
  headerTextContainer: {
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: 'Sora_600SemiBold',
    marginBottom: 2
  },
  headerSubtitle: {
    fontSize: 12
  },
  // Messages list
  messagesList: {
    padding: 16,
    paddingBottom: 8
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    maxWidth: '80%'
  },
  ownMessageContainer: {
    alignSelf: 'flex-end',
    flexDirection: 'row-reverse'
  },
  otherMessageContainer: {
    alignSelf: 'flex-start'
  },
  messageAvatar: {
    marginRight: 8
  },
  smallAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center'
  },
  smallAvatarText: {
    fontSize: 13,
    fontFamily: 'Sora_700Bold'
  },
  // Message bubbles
  messageBubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  ownMessage: {
    borderBottomRightRadius: 4
  },
  otherMessage: {
    borderBottomLeftRadius: 4
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4
  },
  otherMessageText: {
    // Color dinámico aplicado en JSX
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 2
  },
  otherMessageTime: {
    // Color dinámico aplicado en JSX
  },
  // Typing indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic'
  },
  // Input area
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderTopWidth: 1,
    alignItems: 'flex-end',
  },
  // Back button
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: -8,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    fontSize: 15,
    maxHeight: 120,
    textAlignVertical: 'top',
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4
  }
});

export default ChatDetailScreen;
