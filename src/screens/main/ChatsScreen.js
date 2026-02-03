import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
  Image,
  Animated
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import apiService, { buildImageUri } from '../../services/apiService';
import socketService from '../../services/socketService';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const ChatsScreen = ({ navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const conversationsRef = useRef([]);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animación de entrada
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    loadConversations();

    // Conectar socket
    socketService.connect();

    // Escuchar mensajes recibidos para detectar nuevas conversaciones
    const handleMessageReceived = (message) => {
      console.log('📨 [ChatsScreen] Mensaje recibido:', message);
      const conversationId = message.conversation;
      
      // Verificar si la conversación existe en la lista usando el ref
      const conversationExists = conversationsRef.current.some(conv => conv._id === conversationId);
      
      if (!conversationExists) {
        console.log('🆕 [ChatsScreen] Nueva conversación detectada, recargando lista...');
        // Recargar todas las conversaciones para incluir la nueva
        loadConversations();
      } else {
        // Si existe, actualizar con el último mensaje
        updateConversation(conversationId, message);
      }
    };

    // Escuchar actualizaciones de conversaciones
    const handleConversationUpdated = (data) => {
      console.log('🔄 [ChatsScreen] Conversación actualizada:', data);
      const conversationId = data.conversationId;
      
      // Verificar si la conversación existe en la lista usando el ref
      const conversationExists = conversationsRef.current.some(conv => conv._id === conversationId);
      
      if (!conversationExists) {
        console.log('🆕 [ChatsScreen] Nueva conversación en actualización, recargando lista...');
        // Recargar todas las conversaciones para incluir la nueva
        loadConversations();
      } else {
        // Si existe, actualizar con el último mensaje
        updateConversation(conversationId, data.lastMessage);
      }
    };

    // Escuchar cuando se marcan mensajes como leídos
    const handleMessagesRead = (data) => {
      console.log('👀 [ChatsScreen] Mensajes marcados como leídos:', data);
      markConversationAsRead(data.conversationId);
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onConversationUpdated(handleConversationUpdated);
    socketService.onMessagesRead(handleMessagesRead);

    return () => {
      socketService.removeListener('message:received');
      socketService.removeListener('conversation:updated');
      socketService.removeListener('messages:read');
    };
  }, []);

  // Mantener el ref actualizado cuando cambien las conversaciones
  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Recargar conversaciones cuando la pantalla se enfoca (solo si es necesario)
  useFocusEffect(
    useCallback(() => {
      // Solo recargar si han pasado más de 30 segundos desde la última carga
      const shouldReload = !conversations.length ||
        (Date.now() - (window.lastConversationLoad || 0)) > 30000;

      if (shouldReload) {
        console.log('📱 [ChatsScreen] Recargando conversaciones por focus');
        loadConversations();
        window.lastConversationLoad = Date.now();
      } else {
        console.log('📱 [ChatsScreen] No es necesario recargar conversaciones');
      }
    }, [conversations.length])
  );

  const loadConversations = async () => {
    try {
      const response = await apiService.get('/chat/conversations');
      if (response.data.success) {
        setConversations(response.data.data);
        conversationsRef.current = response.data.data;
      }
    } catch (error) {
      console.error('Error al cargar conversaciones:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const updateConversation = (conversationId, lastMessage) => {
    setConversations(prevConversations => {
      const updated = prevConversations.map(conv => {
        if (conv._id === conversationId) {
          return { ...conv, lastMessage, updatedAt: new Date() };
        }
        return conv;
      });
      // Reordenar por fecha de actualización
      const sorted = updated.sort((a, b) =>
        new Date(b.updatedAt) - new Date(a.updatedAt)
      );
      // Actualizar el ref también
      conversationsRef.current = sorted;
      return sorted;
    });
  };

  const markConversationAsRead = (conversationId) => {
    setConversations(prevConversations => {
      return prevConversations.map(conv => {
        if (conv._id === conversationId && conv.lastMessage) {
          const userId = user._id || user.id;
          const currentReadBy = conv.lastMessage.readBy || [];

          // Solo agregar si no está ya en la lista
          const isAlreadyRead = currentReadBy.includes(userId);
          if (!isAlreadyRead) {
            console.log(`✅ [ChatsScreen] Marcando conversación ${conversationId} como leída`);
            const updatedLastMessage = {
              ...conv.lastMessage,
              readBy: [...currentReadBy, userId]
            };
            return { ...conv, lastMessage: updatedLastMessage };
          }
        }
        return conv;
      });
    });
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadConversations();
  }, []);

  const getOtherParticipant = (conversation) => {
    if (!user) return null;
    const userId = user._id || user.id;
    return conversation.participants.find(p => p._id !== userId);
  };

  const formatTime = (date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diff = now - messageDate;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (hours < 1) return 'Hace un momento';
    if (hours < 24) return `Hace ${hours}h`;
    if (days === 1) return 'Ayer';
    if (days < 7) return `Hace ${days}d`;
    return messageDate.toLocaleDateString();
  };

  const renderConversation = ({ item }) => {
    const otherUser = getOtherParticipant(item);
    const lastMessagePreview = item.lastMessage?.content || 'Sin mensajes';
    const userId = user?._id || user?.id;

    // Debug unread logic
    const hasLastMessage = !!item.lastMessage;
    const hasUserId = !!userId;
    const readBy = item.lastMessage?.readBy || [];
    const isInReadBy = readBy.includes(userId);
    const isFromOtherUser = item.lastMessage?.sender !== userId;

    const isUnread = hasLastMessage && hasUserId && !isInReadBy && isFromOtherUser;

    console.log('🔍 [ChatsScreen] Unread debug:', {
      conversationId: item._id,
      hasLastMessage,
      hasUserId,
      userId,
      readBy,
      isInReadBy,
      messageSender: item.lastMessage?.sender,
      isFromOtherUser,
      isUnread
    });

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('ChatDetail', {
          conversation: item,
          otherUser
        })}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={createColorArray(colors.surfaceElevated, colors.surface)}
          style={styles.conversationGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.conversationInner}>
            <View style={styles.avatarContainer}>
              {otherUser?.avatar && buildImageUri(otherUser.avatar) ? (
                <Image
                  source={{ uri: buildImageUri(otherUser.avatar) }}
                  style={styles.avatar}
                  onError={() => console.log('Error loading chat avatar from:', otherUser.avatar)}
                />
              ) : (
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={[styles.avatar, styles.avatarPlaceholder]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Text style={styles.avatarText}>
                    {otherUser?.firstName?.[0]}{otherUser?.lastName?.[0]}
                  </Text>
                </LinearGradient>
              )}
              {isUnread && (
                <View style={styles.unreadDot}>
                  {/* Debug: Red dot is rendering */}
                  <Text style={{ fontSize: 8, color: 'white', textAlign: 'center' }}>●</Text>
                </View>
              )}
            </View>

            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={styles.userName}>
                  {otherUser?.firstName} {otherUser?.lastName}
                </Text>
                {item.lastMessage && (
                  <Text style={styles.time}>
                    {formatTime(item.updatedAt)}
                  </Text>
                )}
              </View>

              {item.trip && (
                <Text style={styles.tripInfo}>
                  {item.trip.origin?.city} → {item.trip.destination?.city}
                </Text>
              )}

              <Text
                style={[styles.lastMessage, isUnread && styles.unreadMessage]}
                numberOfLines={1}
              >
                {lastMessagePreview}
              </Text>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
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
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {conversations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No tienes conversaciones</Text>
            <Text style={styles.emptySubtext}>
              Comienza a chatear con otros usuarios desde los detalles de un viaje
            </Text>
          </View>
        ) : (
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContent}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  header: {
    padding: 24,
    paddingTop: 80,
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingTop: spacing.sm,
  },
  conversationItem: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  conversationGradient: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 3,
  },
  conversationInner: {
    flexDirection: 'row',
    padding: spacing.md,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    marginRight: spacing.md,
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  avatarPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: spacing.md,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#EF4444',
    borderWidth: 2,
    borderColor: '#F8F9FA',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 4,
    elevation: 3,
  },
  conversationContent: {
    flex: 1,
    justifyContent: 'center',
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  time: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
  },
  tripInfo: {
    fontSize: fontSize.xs,
    color: '#1F2937',
    marginBottom: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  lastMessage: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  unreadMessage: {
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyIcon: {
    fontSize: 40,
  },
  emptyText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginBottom: spacing.sm,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
});

export default ChatsScreen;
