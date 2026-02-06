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

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
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
        style={[styles.card, !isRead && styles.cardUnread]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        <View style={[styles.iconContainer, !isRead && styles.iconContainerUnread]}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={22}
            color={isRead ? '#6B7280' : '#000000'}
          />
        </View>

        <View style={styles.content}>
          <Text style={[styles.title, !isRead && styles.titleUnread]}>
            {item.title}
          </Text>
          <Text style={styles.message} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.time}>{getRelativeTime(item.createdAt)}</Text>
        </View>

        {!isRead && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="close" size={24} color="#000000" />
        </TouchableOpacity>

        {notifications.some(n => !n.isRead && !optimisticRead.has(n._id)) && (
          <TouchableOpacity
            style={styles.markAllButton}
            onPress={handleMarkAllAsRead}
          >
            <Text style={styles.markAllText}>Leer todas</Text>
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
              tintColor="#000000"
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="notifications-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Sin notificaciones</Text>
          <Text style={styles.emptySubtitle}>
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
    backgroundColor: '#F9FAFB',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  markAllButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#000000',
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // List
  listContent: {
    padding: 16,
  },
  // Card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  cardUnread: {
    backgroundColor: '#F0F9FF',
    borderColor: '#BAE6FD',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerUnread: {
    backgroundColor: '#E0F2FE',
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 4,
  },
  titleUnread: {
    fontWeight: '600',
    color: '#000000',
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 4,
    lineHeight: 20,
  },
  time: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3B82F6',
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
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
});

export default NotificationsScreen;
