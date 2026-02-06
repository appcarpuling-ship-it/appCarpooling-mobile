import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { isDarkMode } = useTheme();
  const {
    notifications = [],
    loading,
    markAsRead,
    markAllAsRead,
    loadNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [optimisticRead, setOptimisticRead] = useState(new Set());

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setOptimisticRead(new Set());
    setRefreshing(false);
  };

  const handleNotificationPress = (notification) => {
    if (!notification.isRead && !optimisticRead.has(notification._id)) {
      // Optimistic update - show as read immediately
      setOptimisticRead(prev => new Set([...prev, notification._id]));
      // Fire and forget - don't await
      markAsRead(notification._id);
    }

    switch (notification.type) {
      case 'booking':
      case 'booking_update':
        if (notification.data?.tripId) {
          navigation.navigate('TripDetail', { tripId: notification.data.tripId });
        }
        break;
      case 'trip':
        if (notification.data?.tripId) {
          navigation.navigate('TripDetail', { tripId: notification.data.tripId });
        }
        break;
      case 'message':
      case 'new_message':
        if (notification.data?.conversationId) {
          navigation.navigate('ChatDetail', {
            conversation: { _id: notification.data.conversationId },
            otherUser: notification.data.sender || {},
          });
        }
        break;
      case 'review':
        navigation.navigate('Profile');
        break;
      case 'user':
        if (notification.data?.userId) {
          navigation.navigate('UserProfile', { userId: notification.data.userId });
        }
        break;
      default:
        break;
    }
  };

  const handleMarkAllAsRead = () => {
    Alert.alert(
      'Marcar todas como leidas',
      'Marcar todas las notificaciones como leidas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: () => {
            // Optimistic update for all
            const allIds = notifications.map(n => n._id);
            setOptimisticRead(new Set(allIds));
            markAllAsRead();
          }
        },
      ]
    );
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking':
      case 'booking_update':
        return 'calendar-outline';
      case 'trip':
        return 'car-outline';
      case 'payment':
        return 'card-outline';
      case 'review':
        return 'star-outline';
      case 'message':
      case 'new_message':
        return 'chatbubble-outline';
      case 'user':
        return 'person-outline';
      case 'system':
        return 'settings-outline';
      default:
        return 'notifications-outline';
    }
  };

  const getRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderNotificationItem = ({ item }) => {
    const isRead = item.isRead || optimisticRead.has(item._id);

    return (
      <TouchableOpacity
        style={[
          styles.card,
          { 
            backgroundColor: isDarkMode ? '#292929' : '#FFFFFF',
            borderColor: isDarkMode ? '#404040' : '#E5E7EB'
          },
          !isRead && { 
            backgroundColor: isDarkMode ? '#1F2947' : '#EBF4FF', 
            borderColor: isDarkMode ? '#3B82F6' : '#93C5FD' 
          }
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[
          styles.iconContainer, 
          { backgroundColor: isDarkMode ? '#1F1F1F' : '#F8F9FA' },
          !isRead && { backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE' }
        ]}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={22}
            color={isRead ? (isDarkMode ? '#6B7280' : '#9CA3AF') : (isDarkMode ? '#FFFFFF' : '#1F2937')}
          />
        </View>

        <View style={styles.content}>
          <Text style={[
            styles.title, 
            { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
            !isRead && { fontWeight: '600', color: isDarkMode ? '#FFFFFF' : '#1F2937' }
          ]}>
            {item.title}
          </Text>
          <Text style={[styles.message, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={[styles.time, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>{getRelativeTime(item.createdAt)}</Text>
        </View>

        {!isRead && <View style={[styles.unreadDot, { backgroundColor: isDarkMode ? '#3B82F6' : '#6366F1' }]} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top, backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
        <ActivityIndicator size="large" color={isDarkMode ? '#3B82F6' : '#6366F1'} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: isDarkMode ? '#161616' : '#FFFFFF', borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: isDarkMode ? '#1F1F1F' : '#F8F9FA' }]}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
        </TouchableOpacity>

        {notifications.some(n => !n.isRead && !optimisticRead.has(n._id)) && (
          <TouchableOpacity
            style={[styles.markAllButton, { backgroundColor: isDarkMode ? '#3B82F6' : '#6366F1' }]}
            onPress={handleMarkAllAsRead}
          >
            <Text style={[styles.markAllText, { color: '#FFFFFF' }]}>Leer todas</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* List */}
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotificationItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDarkMode ? '#3B82F6' : '#6366F1'}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: isDarkMode ? '#292929' : '#F8F9FA' }]}>
            <Ionicons name="notifications-outline" size={48} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
          </View>
          <Text style={[styles.emptyTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Sin notificaciones</Text>
          <Text style={[styles.emptySubtitle, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
            Cuando recibas notificaciones apareceran aqui
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // List
  listContent: {
    padding: 16,
  },
  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    marginBottom: 4,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginLeft: 8,
  },
  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
