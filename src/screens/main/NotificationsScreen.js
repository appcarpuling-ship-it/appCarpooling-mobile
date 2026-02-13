import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../../context/NotificationContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';
import { useTheme } from '../../context/ThemeContext';

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { showAlert } = useAlert();
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
      setOptimisticRead(prev => new Set([...prev, notification._id]));
      markAsRead(notification._id);
    }

    // Obtener IDs de referencias (pueden ser objeto poblado o string)
    const getTripId = () => {
      if (notification.relatedTrip) return notification.relatedTrip._id || notification.relatedTrip;
      if (notification.data?.tripId) return notification.data.tripId;
      return null;
    };
    const getBookingId = () => {
      if (notification.relatedBooking) return notification.relatedBooking._id || notification.relatedBooking;
      if (notification.data?.bookingId) return notification.data.bookingId;
      return null;
    };
    const getConversationId = () => {
      if (notification.data?.conversationId) return notification.data.conversationId;
      if (notification.actionUrl?.startsWith('/chat/')) {
        const match = notification.actionUrl.match(/\/chat\/([^/]+)/);
        return match ? match[1] : null;
      }
      return null;
    };

    const tripId = getTripId();
    const bookingId = getBookingId();
    const conversationId = getConversationId();

    // Prioridad: actionUrl > relatedTrip/relatedBooking > type + data
    if (notification.actionUrl) {
      const path = notification.actionUrl.replace(/^\//, '');
      const parts = path.split('/');
      if (path.startsWith('trips/')) {
        const id = parts[1];
        if (parts[2] === 'requests' && id) {
          navigation.navigate('CarpoolingsTab', {
            screen: 'TripRequests',
            params: { tripId: id },
          });
        } else if (parts[2] === 'review' && id) {
          navigation.navigate('CarpoolingsTab', {
            screen: 'CreateReviewFromTrip',
            params: { tripId: id },
          });
        } else if (id) {
          navigation.navigate('HomeTab', {
            screen: 'TripDetail',
            params: { tripId: id },
          });
        }
      } else if (path.startsWith('bookings/')) {
        const id = parts[1];
        if (id) {
          navigation.navigate('CarpoolingsTab', {
            screen: 'MyBookings',
          });
        }
      } else if (path.startsWith('chat/')) {
        const id = parts[1];
        if (id) {
          navigation.navigate('ChatsTab', {
            screen: 'ChatDetail',
            params: {
              conversation: { _id: id },
              otherUser: notification.relatedUser || {},
            },
          });
        }
      } else if (path === 'seat-reservations' || path.startsWith('seat-reservations/')) {
        navigation.navigate('CarpoolingsTab', {
          screen: 'MySeatReservations',
        });
      } else if (path === 'profile') {
        navigation.navigate('ProfileTab', {
          screen: 'Profile',
        });
      }
      return;
    }

    // Fallback: usar relatedTrip, relatedBooking, type
    if (tripId) {
      const type = notification.type || '';
      if (type.includes('booking_created') || type.includes('seat_reservation_request')) {
        navigation.navigate('CarpoolingsTab', {
          screen: 'TripRequests',
          params: { tripId },
        });
      } else if (type.includes('review')) {
        navigation.navigate('CarpoolingsTab', {
          screen: 'CreateReviewFromTrip',
          params: { tripId },
        });
      } else {
        navigation.navigate('HomeTab', {
          screen: 'TripDetail',
          params: { tripId },
        });
      }
      return;
    }
    if (conversationId) {
      navigation.navigate('ChatsTab', {
        screen: 'ChatDetail',
        params: {
          conversation: { _id: conversationId },
          otherUser: notification.relatedUser || notification.data?.sender || {},
        },
      });
      return;
    }
    if (bookingId) {
      navigation.navigate('CarpoolingsTab', {
        screen: 'MyBookings',
      });
      return;
    }
    if (notification.type === 'review_received') {
      navigation.navigate('ProfileTab', { screen: 'Profile' });
    }
  };

  const handleMarkAllAsRead = () => {
    showAlert(
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
    const t = type || '';
    if (t.includes('booking') || t.includes('seat_reservation')) return 'calendar-outline';
    if (t.includes('trip')) return 'car-outline';
    if (t.includes('payment')) return 'card-outline';
    if (t.includes('review')) return 'star-outline';
    if (t.includes('message')) return 'chatbubble-outline';
    if (t.includes('user') || t.includes('referral')) return 'person-outline';
    if (t.includes('profile') || t.includes('verified')) return 'checkmark-circle-outline';
    return 'notifications-outline';
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
            style={[styles.markAllButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#161616' }]}
            onPress={handleMarkAllAsRead}
          >
            <Text style={[styles.markAllText, { color: isDarkMode ? '#161616' : '#FFFFFF' }]}>Leer todas</Text>
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
