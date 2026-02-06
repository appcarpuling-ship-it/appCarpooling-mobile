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
  Animated,
  TextInput,
  ScrollView,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import apiService, { buildImageUri } from '../../services/apiService';
import socketService from '../../services/socketService';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';

// Usar valores directos para evitar problemas de carga
const SORA_FONTS = {
  thin: 'Sora_100Thin',
  extraLight: 'Sora_200ExtraLight',
  light: 'Sora_300Light',
  regular: 'Sora_400Regular',
  medium: 'Sora_500Medium',
  semiBold: 'Sora_600SemiBold',
  bold: 'Sora_700Bold',
  extraBold: 'Sora_800ExtraBold',
};

const ChatsScreen = ({ navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const { isDarkMode } = useTheme();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all', 'trips', 'direct'
  const [searchTerm, setSearchTerm] = useState('');
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
      const userId = user?._id || user?.id;
      
      // IMPORTANTE: Cuando estás en ChatsScreen (lista de conversaciones), NO marcar como leído
      // Solo actualizar el mensaje pero preservar el estado de no leído si el mensaje es de otro usuario
      // El mensaje solo se marcará como leído cuando el usuario entre al chat específico
      
      // Verificar si la conversación existe en la lista usando el ref
      const conversationExists = conversationsRef.current.some(conv => conv._id === conversationId);
      
      if (!conversationExists) {
        console.log('🆕 [ChatsScreen] Nueva conversación detectada, recargando lista...');
        // Recargar todas las conversaciones para incluir la nueva
        loadConversations();
      } else {
        // Si existe, actualizar con el último mensaje
        // Asegurarse de que si el mensaje es de otro usuario y no está en readBy, se mantenga como no leído
        const messageSenderId = message.sender?._id || message.sender;
        const messageReadBy = message.readBy || [];
        const isFromOtherUser = messageSenderId && messageSenderId.toString() !== userId.toString();
        const isAlreadyRead = messageReadBy.some(id => id.toString() === userId.toString());
        
        if (isFromOtherUser && !isAlreadyRead) {
          // Asegurarse de que el mensaje NO se marque como leído cuando estás en la lista
          // Remover al usuario del readBy si está presente (no debería estar, pero por seguridad)
          const unreadMessage = {
            ...message,
            readBy: messageReadBy.filter(id => id.toString() !== userId.toString())
          };
          console.log('⏸️ [ChatsScreen] Preservando estado de no leído para mensaje de otro usuario');
          updateConversation(conversationId, unreadMessage);
        } else {
          // Si es del usuario actual o ya está marcado como leído, actualizar normalmente
          updateConversation(conversationId, message);
        }
      }
    };

    // Escuchar actualizaciones de conversaciones
    const handleConversationUpdated = (data) => {
      console.log('🔄 [ChatsScreen] Conversación actualizada:', data);
      const conversationId = data.conversationId;
      const userId = user?._id || user?.id;
      const lastMessage = data.lastMessage;
      
      // Verificar si la conversación existe en la lista usando el ref
      const conversationExists = conversationsRef.current.some(conv => conv._id === conversationId);
      
      if (!conversationExists) {
        console.log('🆕 [ChatsScreen] Nueva conversación en actualización, recargando lista...');
        // Recargar todas las conversaciones para incluir la nueva
        loadConversations();
      } else {
        // Si existe, actualizar con el último mensaje
        // Asegurarse de que si el mensaje es de otro usuario y no está en readBy, se mantenga como no leído
        if (lastMessage) {
          const messageSenderId = lastMessage.sender?._id || lastMessage.sender;
          const messageReadBy = lastMessage.readBy || [];
          const isFromOtherUser = messageSenderId && messageSenderId.toString() !== userId.toString();
          const isAlreadyRead = messageReadBy.some(id => id.toString() === userId.toString());
          
          if (isFromOtherUser && !isAlreadyRead) {
            // Asegurarse de que el mensaje NO se marque como leído cuando estás en la lista
            const unreadMessage = {
              ...lastMessage,
              readBy: messageReadBy.filter(id => id.toString() !== userId.toString())
            };
            console.log('⏸️ [ChatsScreen] Preservando estado de no leído en conversation:updated');
            updateConversation(conversationId, unreadMessage);
          } else {
            // Si es del usuario actual o ya está marcado como leído, actualizar normalmente
            updateConversation(conversationId, lastMessage);
          }
        } else {
          updateConversation(conversationId, lastMessage);
        }
      }
    };

    // Escuchar cuando se marcan mensajes como leídos
    const handleMessagesRead = (data) => {
      console.log('👀 [ChatsScreen] Mensajes marcados como leídos:', data);
      markConversationAsRead(data.conversationId);
    };

    // Escuchar cuando se cierran conversaciones
    const handleConversationClosed = (data) => {
      console.log('❌ [ChatsScreen] Conversación cerrada:', data);
      setConversations(prev => prev.filter(conv => conv._id !== data.conversationId));
      
      // Si la razón es que se completó el viaje, podrías mostrar una notificación
      if (data.reason === 'trip_completed') {
        console.log('Conversación cerrada por viaje completado:', data.message);
      }
    };

    socketService.onMessageReceived(handleMessageReceived);
    socketService.onConversationUpdated(handleConversationUpdated);
    socketService.onMessagesRead(handleMessagesRead);
    socketService.onConversationClosed(handleConversationClosed);

    return () => {
      socketService.removeListener('message:received');
      socketService.removeListener('conversation:updated');
      socketService.removeListener('messages:read');
      socketService.removeListener('conversation:closed');
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

  // Filtrar conversaciones según el filtro seleccionado y búsqueda
  const filteredConversations = conversations.filter(conv => {
    const otherUser = getOtherParticipant(conv);
    const matchesSearch = !searchTerm || 
      otherUser?.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      otherUser?.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      `${otherUser?.firstName} ${otherUser?.lastName}`.toLowerCase().includes(searchTerm.toLowerCase());

    // Aplicar filtro de tipo
    if (filter === 'trips') return matchesSearch && !!conv.trip; // Solo conversaciones con viaje
    if (filter === 'direct') return matchesSearch && !conv.trip; // Solo conversaciones sin viaje (directos)
    return matchesSearch; // 'all' - todas las conversaciones que coincidan con la búsqueda
  });

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
          colors={isDarkMode ? ['#292929', '#1F1F1F'] : ['#FFFFFF', '#F8F9FA']}
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
                <View style={[styles.unreadDot, { 
                  backgroundColor: isDarkMode ? '#EF4444' : '#DC2626', 
                  borderColor: isDarkMode ? '#161616' : '#FFFFFF' 
                }]}>
                  {/* Debug: Red dot is rendering */}
                  <Text style={{ fontSize: 8, color: 'white', textAlign: 'center' }}>●</Text>
                </View>
              )}
            </View>

            <View style={styles.conversationContent}>
              <View style={styles.conversationHeader}>
                <Text style={[styles.userName, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                  {otherUser?.firstName} {otherUser?.lastName}
                </Text>
                {item.lastMessage && (
                  <Text style={[styles.time, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
                    {formatTime(item.updatedAt)}
                  </Text>
                )}
              </View>

              {item.trip && (
                <Text style={[styles.tripInfo, { color: isDarkMode ? '#3B82F6' : '#6366F1' }]}>
                  {item.trip.origin?.city} → {item.trip.destination?.city}
                </Text>
              )}

              <Text
                style={[
                  styles.lastMessage, 
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  isUnread && { fontWeight: '600', color: isDarkMode ? '#FFFFFF' : '#1F2937' }
                ]}
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
      <View style={[styles.centerContainer, { backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#3B82F6' : '#6366F1'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Campo de búsqueda */}
        <View style={styles.searchContainer}>
          <View style={[
            styles.searchInputContainer,
            { 
              backgroundColor: isDarkMode ? '#292929' : '#FFFFFF',
              borderColor: isDarkMode ? '#404040' : '#E5E7EB'
            }
          ]}>
            <Ionicons name="search-outline" size={20} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={styles.searchIcon} />
            <TextInput
              style={[styles.searchInput, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}
              placeholder="Buscar conversaciones..."
              placeholderTextColor={isDarkMode ? '#6B7280' : '#9CA3AF'}
              value={searchTerm}
              onChangeText={setSearchTerm}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {searchTerm.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchTerm('')}
                style={styles.clearSearchButton}
                activeOpacity={0.7}
              >
                <Ionicons name="close-circle" size={20} color="#9CA3AF" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filtros */}
        <View style={[styles.filterContainer, { backgroundColor: isDarkMode ? '#292929' : '#F3F4F6' }]}>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filter === 'all' && [styles.filterButtonActive, { backgroundColor: isDarkMode ? '#3B82F6' : '#6366F1' }]
            ]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: filter === 'all' ? '#FFFFFF' : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                fontWeight: filter === 'all' ? '600' : '500'
              }
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filter === 'trips' && [styles.filterButtonActive, { backgroundColor: isDarkMode ? '#3B82F6' : '#6366F1' }]
            ]}
            onPress={() => setFilter('trips')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: filter === 'trips' ? '#FFFFFF' : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                fontWeight: filter === 'trips' ? '600' : '500'
              }
            ]}>
              Viajes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filter === 'direct' && [styles.filterButtonActive, { backgroundColor: isDarkMode ? '#3B82F6' : '#6366F1' }]
            ]}
            onPress={() => setFilter('direct')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: filter === 'direct' ? '#FFFFFF' : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                fontWeight: filter === 'direct' ? '600' : '500'
              }
            ]}>
              Mensajes Directos
            </Text>
          </TouchableOpacity>
        </View>

        {filteredConversations.length === 0 ? (
          <ScrollView
            contentContainerStyle={styles.emptyScrollContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDarkMode ? '#3B82F6' : '#6366F1'}
              />
            }
          >
          <View style={styles.emptyContainer}>
              <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                {conversations.length === 0 
                  ? 'No tienes conversaciones' 
                  : searchTerm
                    ? 'No se encontraron conversaciones'
                    : filter === 'trips' 
                      ? 'No tienes conversaciones de viajes'
                      : filter === 'direct'
                        ? 'No tienes mensajes directos'
                        : 'No hay conversaciones'}
              </Text>
            <Text style={[styles.emptySubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                {conversations.length === 0
                  ? 'Comienza a chatear con otros usuarios desde los detalles de un viaje'
                  : searchTerm
                    ? 'Intenta con otro término de búsqueda'
                    : 'Intenta cambiar el filtro para ver más conversaciones'}
            </Text>
          </View>
          </ScrollView>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversation}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDarkMode ? '#3B82F6' : '#6366F1'}
              />
            }
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    // backgroundColor: '#FFFFFF', // Ahora dinámico
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    // backgroundColor: '#FFFFFF', // Ahora dinámico
  },
  header: {
    padding: 24,
    paddingTop: 80,
    paddingBottom: 32,
    alignItems: 'center',
    borderBottomWidth: 1,
    // borderBottomColor: '#E5E7EB', // Ahora dinámico
    // backgroundColor: '#FFFFFF', // Ahora dinámico
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: SORA_FONTS.bold,
    fontWeight: 'bold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    // backgroundColor: '#FFFFFF', // Ahora dinámico
    borderRadius: borderRadius.lg,
    borderWidth: 1.5,
    // borderColor: '#E5E7EB', // Ahora dinámico
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.regular,
    color: '#000000',
    paddingVertical: 0,
    minHeight: 20,
  },
  clearSearchButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
    borderRadius: borderRadius.full,
  },
  filterContainer: {
    flexDirection: 'row',
    // backgroundColor: '#F3F4F6', // Ahora dinámico
    borderRadius: borderRadius.xl,
    padding: spacing.xs,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.xs,
  },
  filterButton: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterButtonActive: {
    // backgroundColor: '#FFFFFF', // Ahora dinámico
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    fontFamily: SORA_FONTS.medium,
    fontWeight: fontWeight.medium,
  },
  filterButtonTextActive: {
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: fontWeight.semiBold,
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
    borderWidth: 2,
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
  },
  time: {
    fontSize: fontSize.xs,
  },
  tripInfo: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  lastMessage: {
    fontSize: fontSize.sm,
  },
  emptyScrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
    minHeight: '100%',
  },
  emptyContainer: {
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
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: '80%',
  },
});

export default ChatsScreen;
