import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Image,
  Animated
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useUnreadMessages } from '../../hooks/useUnreadMessages';
import apiService, { buildImageUri } from '../../services/apiService';
import socketService from '../../services/socketService';
import { colors, gradients } from '../../theme/colors';


// Safe colors fallback to prevent 'colors is not defined' errors
const safeColors = (() => {
  try {
    const { colors } = require('./src/theme/colors');
    return colors;
  } catch {
    try {
      const { colors } = require('../theme/colors');
      return colors;
    } catch {
      try {
        const { colors } = require('../../theme/colors');
        return colors;
      } catch {
        return {
          background: '#FFFFFF', surface: '#F8F9FA', surfaceElevated: '#FFFFFF',
          textPrimary: '#000000', textSecondary: '#374151', textTertiary: '#6B7280',
          textMuted: '#9CA3AF', primary: '#6366F1', primaryDark: '#4F46E5',
          accent: '#A855F7', accentGreen: '#10B981', accentOrange: '#F59E0B',
          accentRed: '#EF4444', success: '#10B981', warning: '#F59E0B',
          error: '#EF4444', info: '#3B82F6', inputBackground: '#FFFFFF',
          inputBorder: '#D1D5DB', borderLight: '#F3F4F6', border: '#E5E7EB'
        };
      }
    }
  }
})();

const ChatDetailScreen = ({ route, navigation }) => {
  const { conversation, otherUser } = route.params;
  const { user } = useAuth();
  const { loadUnreadCount, setActiveConversation, clearActiveConversation } = useUnreadMessages();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const flatListRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Marcar esta conversación como activa para evitar incrementar el contador
    setActiveConversation(conversation._id);

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
        backgroundColor: colors.surface
      },
      headerTintColor: colors.textPrimary,
      headerTitleStyle: {
        color: colors.textPrimary
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
            {otherUser?.avatar ? (
              <Image
                source={{ uri: otherUser.avatar }}
                style={styles.headerAvatar}
              />
            ) : (
              <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.headerAvatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.headerAvatarText}>
                  {otherUser.firstName[0]}{otherUser.lastName[0]}
                </Text>
              </LinearGradient>
            )}
          </View>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>
              {otherUser.firstName} {otherUser.lastName}
            </Text>
            <Text style={styles.headerSubtitle}>
              {typing ? 'Escribiendo...' : 'En linea'}
            </Text>
          </View>
        </View>
      )
    });

    loadMessages();

    // Unirse a la conversación
    socketService.joinConversation(conversation._id);

    return () => {
      // Limpiar conversación activa al salir
      clearActiveConversation();

      // Salir de la conversación y limpiar listeners
      socketService.leaveConversation(conversation._id);
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
  }, [conversation._id, conversation, navigation, otherUser, typing]);

  // Separar en un useEffect para los listeners del socket
  useEffect(() => {
    // Escuchar mensajes en tiempo real
    const handleMessageReceived = async (message) => {
      if (message.conversation === conversation._id) {
        setMessages(prev => {
          // Evitar duplicados: remover mensaje temporal si existe
          const filtered = (Array.isArray(prev) ? prev : []).filter(m => !m.isTemp);
          // Evitar duplicados: verificar si el mensaje ya existe
          const exists = filtered.some(m => m._id === message._id);
          if (exists) {
            return prev;
          }
          return [...filtered, message];
        });
        scrollToBottom();

        // Marcar como leído automáticamente cuando llega un mensaje nuevo mientras está en el chat
        // Usar API directamente para asegurar que se marca correctamente
        try {
          await apiService.put(`/chat/conversation/${conversation._id}/read`);
          console.log('✅ [ChatDetailScreen] Mensaje marcado como leído al recibir');
        } catch (error) {
          console.error('❌ [ChatDetailScreen] Error al marcar mensaje como leído:', error);
          // Fallback: usar socket
          socketService.markMessagesAsRead(conversation._id);
        }

        // Recargar contador después de marcar como leído
        setTimeout(() => {
          loadUnreadCount();
        }, 500);
      }
    };

    // Escuchar cuando el otro usuario está escribiendo
    const handleTyping = (data) => {
      const userId = user?._id || user?.id;
      if (data.userId !== userId) {
        setTyping(data.isTyping);
      }
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onTyping(handleTyping);

    return () => {
      socketService.removeListener('message:received');
      socketService.removeListener('typing:user');
    };
  }, [conversation._id]);

  const loadMessages = async () => {
    try {
      const response = await apiService.get(
        `/chat/conversation/${conversation._id}/messages`
      );

      if (response.data.success) {
        setMessages(response.data.data);

        // Marcar todos los mensajes como leídos cuando se carga el chat
        try {
          await apiService.put(`/chat/conversation/${conversation._id}/read`);
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
      socketService.sendMessage(conversation._id, messageText);

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
      socketService.stopTyping(conversation._id);
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
      socketService.startTyping(conversation._id);

      // Detener después de 2 segundos sin escribir
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socketService.stopTyping(conversation._id);
      }, 2000);
    } else {
      socketService.stopTyping(conversation._id);
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
    const showAvatar = !isOwnMessage;

    return (
      <Animated.View
        style={[
          styles.messageContainer,
          isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer,
          { opacity: fadeAnim }
        ]}
      >
        {showAvatar && (
          <View style={styles.messageAvatar}>
            {otherUser?.avatar && buildImageUri(otherUser.avatar) ? (
              <Image
                source={{ uri: buildImageUri(otherUser.avatar) }}
                style={styles.smallAvatar}
                onError={() => console.log('Error loading message avatar from:', otherUser.avatar)}
              />
            ) : (
              <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.smallAvatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.smallAvatarText}>
                  {otherUser.firstName[0]}
                </Text>
              </LinearGradient>
            )}
          </View>
        )}

        {isOwnMessage ? (
          <LinearGradient
            colors={['#1F2937', '#111827']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.messageBubble, styles.ownMessage]}
          >
            <Text style={styles.messageText}>
              {item.content}
            </Text>
            <Text style={styles.messageTime}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </LinearGradient>
        ) : (
          <View style={[styles.messageBubble, styles.otherMessage]}>
            <Text style={[styles.messageText, styles.otherMessageText]}>
              {item.content}
            </Text>
            <Text style={[styles.messageTime, styles.otherMessageTime]}>
              {formatMessageTime(item.createdAt)}
            </Text>
          </View>
        )}
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={scrollToBottom}
          onLayout={scrollToBottom}
          showsVerticalScrollIndicator={false}
        />

        {typing && (
          <View style={styles.typingIndicator}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.typingDot}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            />
            <Text style={styles.typingText}>
              {otherUser.firstName} esta escribiendo...
            </Text>
          </View>
        )}

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
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
              colors={(!newMessage.trim() || sending) ? [colors.textTertiary, colors.textMuted] : ['#1F2937', '#111827']}
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
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF'
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF'
  },
  // Header styles
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8
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
    fontWeight: 'bold',
    color: '#FFFFFF'
  },
  headerTextContainer: {
    justifyContent: 'center'
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 2
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6B7280'
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
    fontWeight: 'bold',
    color: '#FFFFFF'
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
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4
  },
  messageText: {
    fontSize: 15,
    lineHeight: 21,
    marginBottom: 4,
    color: '#FFFFFF'
  },
  otherMessageText: {
    color: '#374151'
  },
  messageTime: {
    fontSize: 10,
    alignSelf: 'flex-end',
    marginTop: 2,
    color: 'rgba(255, 255, 255, 0.6)'
  },
  otherMessageTime: {
    color: '#9CA3AF'
  },
  // Typing indicator
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFFFFF'
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8
  },
  typingText: {
    fontSize: 13,
    fontStyle: 'italic',
    color: '#6B7280'
  },
  // Input area
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: Platform.OS === 'ios' ? 16 : 12,
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'flex-end'
  },
  // Back button
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginLeft: -8,
  },
  input: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    paddingTop: 10,
    marginRight: 8,
    fontSize: 15,
    maxHeight: 100,
    color: '#000000'
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
