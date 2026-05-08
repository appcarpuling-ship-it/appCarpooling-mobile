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
  Animated
} from 'react-native';
import { useIsFocused } from '@react-navigation/native';
import { useHeaderHeight } from '@react-navigation/elements';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useUnreadMessages } from '../../../hooks/useUnreadMessages';
import { useColors } from '../../../hooks/useColors';
import apiService, { buildImageUri } from '../../../services/apiService';
import socketService from '../../../services/socketService';

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
  const { colors } = useColors();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const isFocused = useIsFocused();
  const isFocusedRef = useRef(isFocused);
  
  const { loadUnreadCount, setActiveConversation, clearActiveConversation } = useUnreadMessages();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  /** Android usa adjustResize + softwareKeyboardLayoutMode: no sumar altura del teclado a mano (duplica y sube el input). Solo scroll. */
  useEffect(() => {
    if (Platform.OS !== 'android') return undefined;
    const onShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 120);
    });
    return () => onShow.remove();
  }, []);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvt, () => setKeyboardOpen(true));
    const hide = Keyboard.addListener(hideEvt, () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

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
        backgroundColor: colors.background
      },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: {
        color: colors.textPrimary
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
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      ),
      headerTitle: () => (
        <View style={styles.headerContainer}>
          <View style={styles.headerAvatarContainer}>
            {otherUser?.avatar && buildImageUri(otherUser.avatar) ? (
              <Image
                source={{ uri: buildImageUri(otherUser.avatar) }}
                style={styles.headerAvatar}
              />
            ) : (
              <LinearGradient
                colors={[colors?.messagePrimary, colors?.messageSecondary]}
                style={styles.headerAvatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={[styles.headerAvatarText, { color: '#FFFFFF' }]}>
                  {displayInitials}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
              {displayName}
            </Text>
            <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
              {typing ? 'Escribiendo...' : 'En linea'}
            </Text>
          </View>
        </View>
      )
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
  }, [conversationId, navigation, otherUser, typing, colors.background, colors.textPrimary, colors.textSecondary, colors?.messagePrimary, colors?.messageSecondary]);

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
          <LinearGradient
            colors={[colors?.messagePrimary, colors?.messageSecondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.messageBubble, styles.ownMessage]}
          >
            <Text style={[styles.messageText, { color: '#FFFFFF' }]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, { color: 'rgba(255, 255, 255, 0.6)' }]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </LinearGradient>
        ) : (
          <View style={[
            styles.messageBubble, 
            styles.otherMessage,
            { backgroundColor: colors.cardBackground }
          ]}>
            <Text style={[styles.messageText, styles.otherMessageText, { color: colors.textPrimary }]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, styles.otherMessageTime, { color: colors.textMuted }]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  if (!conversationId) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const inputBottomPadding = keyboardOpen
    ? COMPOSER_VERTICAL_INSET
    : COMPOSER_VERTICAL_INSET + insets.bottom;

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
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
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          showsVerticalScrollIndicator={false}
        />

        {typing && (
          <View style={[styles.typingIndicator, { backgroundColor: colors.background }]}>
            <View
              style={[styles.typingDot, { backgroundColor: colors?.messagePrimary }]}
            />
            <Text style={[styles.typingText, { color: colors.textSecondary }]}>
              {displayName} esta escribiendo...
            </Text>
          </View>
        )}

        <View style={[
          styles.inputContainer,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            paddingTop: COMPOSER_VERTICAL_INSET,
            paddingBottom: inputBottomPadding,
          },
        ]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.inputBackground,
                borderColor: colors.inputBorder,
                color: colors.textPrimary,
              },
            ]}
            placeholder="Escribe un mensaje..."
            placeholderTextColor={colors.placeholder}
            value={newMessage}
            onChangeText={handleTyping}
            multiline
            maxLength={1000}
          />
          <TouchableOpacity
            onPress={handleSendMessage}
            disabled={!newMessage.trim() || sending}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={(!newMessage.trim() || sending) ? [colors?.textTertiary, colors?.textMuted] : [colors?.messagePrimary, colors?.messageSecondary]}
              style={styles.sendButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {sending ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="send" size={22} color="#FFFFFF" />
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
    fontWeight: 'bold'
  },
  headerTextContainer: {
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
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
    fontWeight: 'bold'
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
    paddingTop: 10,
    marginRight: 8,
    fontSize: 15,
    maxHeight: 100
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
