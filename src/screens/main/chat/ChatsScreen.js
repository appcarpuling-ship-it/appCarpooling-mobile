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
  Modal,
  Pressable,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import apiService, { buildImageUri, post_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import socketService from '../../../services/socketService';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';

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
  const insets = useSafeAreaInsets();
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [convPage, setConvPage] = useState(1);
  const [convHasMore, setConvHasMore] = useState(false);
  const [loadingMoreConv, setLoadingMoreConv] = useState(false);
  const convFetchLock = useRef(false);
  const lastConvLoadRef = useRef(0);
  const [filter, setFilter] = useState('all'); // 'all', 'trips', 'direct'
  const [searchTerm, setSearchTerm] = useState('');
  const conversationsRef = useRef([]);
  const [chatActionsTarget, setChatActionsTarget] = useState(null);
  const [blockingFromList, setBlockingFromList] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const loadConversations = async (pageNum = 1, { append = false } = {}) => {
    if (convFetchLock.current && append) return;
    convFetchLock.current = true;
    const limit = LIST_PAGE_SIZE;
    if (append) setLoadingMoreConv(true);
    try {
      const response = await apiService.get('/chat/conversations', { params: { page: pageNum, limit } });
      const body = response.data;
      if (body.success && Array.isArray(body.data)) {
        const rows = body.data;
        if (append) {
          setConversations((prev) => {
            const byId = new Map(prev.map((c) => [String(c._id), c]));
            rows.forEach((r) => {
              const id = String(r._id);
              if (!byId.has(id)) byId.set(id, r);
            });
            return Array.from(byId.values()).sort(
              (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
            );
          });
        } else {
          setConversations(rows);
          conversationsRef.current = rows;
        }
        setConvPage(pageNum);
        setConvHasMore(body.hasMore === true);
      }
    } catch (error) {
      console.error('Error al cargar conversaciones:', error);
    } finally {
      convFetchLock.current = false;
      setLoading(false);
      setLoadingMoreConv(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Animación de entrada
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();

    loadConversations(1);

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
        loadConversations(1);
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
        loadConversations(1);
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
      const shouldReload =
        !conversations.length || Date.now() - lastConvLoadRef.current > 30000;

      if (shouldReload) {
        console.log('📱 [ChatsScreen] Recargando conversaciones por focus');
        loadConversations(1);
        lastConvLoadRef.current = Date.now();
      } else {
        console.log('📱 [ChatsScreen] No es necesario recargar conversaciones');
      }
    }, [conversations.length])
  );

  const onEndReachedConversations = useCallback(() => {
    if (!convHasMore || loadingMoreConv || convFetchLock.current || loading) return;
    loadConversations(convPage + 1, { append: true });
  }, [convHasMore, loadingMoreConv, loading, convPage]);

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
          const uid = user._id || user.id;
          const currentReadBy = conv.lastMessage.readBy || [];
          const isAlreadyRead = currentReadBy.some(id => (id?._id || id)?.toString() === (uid || '').toString());
          if (!isAlreadyRead) {
            const updatedLastMessage = {
              ...conv.lastMessage,
              readBy: [...currentReadBy, uid]
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
    loadConversations(1);
  }, []);

  const getOtherParticipant = (conversation) => {
    if (!user) return null;
    const userId = user._id || user.id;
    return conversation.participants.find(p => p._id !== userId);
  };

  const closeChatActions = useCallback(() => setChatActionsTarget(null), []);

  const openChatActions = useCallback((conversation, otherUser) => {
    if (!otherUser?._id) return;
    setChatActionsTarget({ conversation, otherUser });
  }, []);

  const navigateToPeerProfile = useCallback(
    (conversation, otherUser, openReportParam) => {
      closeChatActions();
      navigation.navigate('UserProfile', {
        userId: otherUser._id,
        conversationId: conversation._id,
        fromChat: false,
        ...(openReportParam ? { openReport: true } : {}),
      });
    },
    [closeChatActions, navigation],
  );

  const runBlockFromList = useCallback(
    async (conversationId, peerId) => {
      setBlockingFromList(true);
      try {
        await post_withauth(ENDPOINTS.BLOCK_USER(peerId), {});
        await refreshUser();
        setConversations((prev) => {
          const next = prev.filter((c) => c._id !== conversationId);
          conversationsRef.current = next;
          return next;
        });
        showAlert('Listo', 'Usuario bloqueado.');
      } catch (e) {
        const msg = e?.response?.data?.message || e?.message || 'No se pudo bloquear';
        showAlert('Error', msg);
      } finally {
        setBlockingFromList(false);
      }
    },
    [refreshUser, showAlert],
  );

  const confirmBlockFromList = useCallback(
    (conversation, otherUser) => {
      closeChatActions();
      showAlert(
        'Bloquear usuario',
        'No podrán enviarse mensajes y el chat desaparecerá para ambos. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Bloquear',
            style: 'destructive',
            onPress: () => runBlockFromList(conversation._id, otherUser._id),
          },
        ],
      );
    },
    [closeChatActions, runBlockFromList, showAlert],
  );

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

    const hasLastMessage = !!item.lastMessage;
    const hasUserId = !!userId;
    const readBy = item.lastMessage?.readBy || [];
    const messageSenderId = item.lastMessage?.sender?._id || item.lastMessage?.sender;
    const isInReadBy = readBy.some(id => (id?._id || id)?.toString() === (userId || '').toString());
    const isFromOtherUser = messageSenderId && messageSenderId.toString() !== (userId || '').toString();

    const isUnread = hasLastMessage && hasUserId && !isInReadBy && isFromOtherUser;

    return (
      <TouchableOpacity
        style={styles.conversationItem}
        onPress={() => navigation.navigate('ChatDetail', {
          conversation: item,
          otherUser
        })}
        onLongPress={() => otherUser?._id && openChatActions(item, otherUser)}
        delayLongPress={380}
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
                }]} />
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
                <Text style={[styles.tripInfo, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>
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
        <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#000000'} />
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
                <Ionicons name="close" size={22} color={isDarkMode ? '#9CA3AF' : '#6B7280'} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Filtros */}
        <View style={[styles.filterContainer, { backgroundColor: isDarkMode ? '#292929' : '#F3F4F6' }]}>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filter === 'all' && [styles.filterButtonActive, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]
            ]}
            onPress={() => setFilter('all')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: filter === 'all' ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                fontWeight: filter === 'all' ? '600' : '500'
              }
            ]}>
              Todos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filter === 'trips' && [styles.filterButtonActive, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]
            ]}
            onPress={() => setFilter('trips')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: filter === 'trips' ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                fontWeight: filter === 'trips' ? '600' : '500'
              }
            ]}>
              Viajes
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.filterButton, 
              filter === 'direct' && [styles.filterButtonActive, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]
            ]}
            onPress={() => setFilter('direct')}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.filterButtonText,
              { 
                color: filter === 'direct' ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280'),
                fontWeight: filter === 'direct' ? '600' : '500'
              }
            ]}>
              Directos
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
                tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
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
            {/* <Text style={[styles.emptySubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                {conversations.length === 0
                  ? 'En el detalle de un viaje, usá «Chatear con el conductor» (arriba del botón Reservar o de tu estado de reserva)'
                  : searchTerm
                    ? 'Intenta con otro término de búsqueda'
                    : 'Intenta cambiar el filtro para ver más conversaciones'}
            </Text> */}
          </View>
          </ScrollView>
        ) : (
          <FlatList
            data={filteredConversations}
            renderItem={renderConversation}
            keyExtractor={item => item._id}
            contentContainerStyle={styles.listContent}
            onEndReached={onEndReachedConversations}
            onEndReachedThreshold={0.35}
            ListFooterComponent={
              loadingMoreConv ? (
                <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                  <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
                  <Text style={{ fontSize: 13, color: isDarkMode ? '#9CA3AF' : '#6B7280' }}>Cargando más…</Text>
                </View>
              ) : null
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
              />
            }
          />
        )}
      </Animated.View>

      <Modal
        visible={!!chatActionsTarget}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeChatActions}
      >
        <Pressable style={styles.chatActionsOverlay} onPress={closeChatActions}>
          <View
            style={[
              styles.chatActionsSheet,
              {
                backgroundColor: isDarkMode ? '#292929' : '#FFFFFF',
                paddingBottom: Math.max(insets.bottom, spacing.md),
              },
            ]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.chatActionsHandle} />
            <Text
              style={[styles.chatActionsTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}
              numberOfLines={2}
            >
              {chatActionsTarget
                ? `${chatActionsTarget.otherUser?.firstName || ''} ${chatActionsTarget.otherUser?.lastName || ''}`.trim() ||
                  'Conversación'
                : ''}
            </Text>

            <TouchableOpacity
              style={styles.chatActionRow}
              onPress={() =>
                chatActionsTarget &&
                navigateToPeerProfile(chatActionsTarget.conversation, chatActionsTarget.otherUser, false)
              }
              activeOpacity={0.75}
            >
              <Ionicons name="person-outline" size={22} color={isDarkMode ? '#E5E7EB' : '#374151'} />
              <Text style={[styles.chatActionLabel, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Ver perfil
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.chatActionDivider,
                { backgroundColor: isDarkMode ? '#404040' : '#E5E7EB' },
              ]}
            />

            <TouchableOpacity
              style={styles.chatActionRow}
              onPress={() =>
                chatActionsTarget &&
                navigateToPeerProfile(chatActionsTarget.conversation, chatActionsTarget.otherUser, true)
              }
              activeOpacity={0.75}
            >
              <Ionicons name="flag-outline" size={22} color={isDarkMode ? '#E5E7EB' : '#374151'} />
              <Text style={[styles.chatActionLabel, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>
                Reportar
              </Text>
            </TouchableOpacity>

            <View
              style={[
                styles.chatActionDivider,
                { backgroundColor: isDarkMode ? '#404040' : '#E5E7EB' },
              ]}
            />

            <TouchableOpacity
              style={styles.chatActionRow}
              onPress={() =>
                chatActionsTarget && confirmBlockFromList(chatActionsTarget.conversation, chatActionsTarget.otherUser)
              }
              activeOpacity={0.75}
              disabled={blockingFromList}
            >
              <Ionicons name="ban-outline" size={22} color="#DC2626" />
              <Text style={[styles.chatActionLabel, { color: '#DC2626' }]}>
                {blockingFromList ? 'Bloqueando…' : 'Bloquear'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.chatActionCancel, { marginTop: spacing.sm }]}
              onPress={closeChatActions}
              activeOpacity={0.75}
            >
              <Text style={[styles.chatActionCancelText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                Cancelar
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
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
  chatActionsOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  chatActionsSheet: {
    borderTopLeftRadius: borderRadius.xl,
    borderTopRightRadius: borderRadius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
    maxHeight: '55%',
  },
  chatActionsHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(150,150,150,0.5)',
    marginBottom: spacing.md,
  },
  chatActionsTitle: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.semiBold,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  chatActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  chatActionLabel: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.medium,
    fontWeight: '500',
  },
  chatActionDivider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 30,
  },
  chatActionCancel: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  chatActionCancelText: {
    fontSize: fontSize.md,
    fontFamily: SORA_FONTS.medium,
    fontWeight: '500',
  },
});

export default ChatsScreen;
