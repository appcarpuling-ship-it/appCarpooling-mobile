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
  const { colors, getCurrentThemeMode } = useColors();
  const { showAlert } = useAlert();
  useTheme();
  const {
    notifications = [],
    loading,
    markAsRead,
    markAllAsRead,
    loadNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const [optimisticRead, setOptimisticRead] = useState(new Set());

  const dark = getCurrentThemeMode() === 'dark';
  const bg = colors.background;
  const textPrimary = colors.textPrimary;
  const textMuted = colors.textMuted;
  const divider = dark ? '#2A2A2A' : '#F0F0F0';
  const accent = dark ? '#FFFFFF' : '#000000';
  const accentInverse = dark ? '#000000' : '#FFFFFF';
  const unreadBg = dark ? '#1A1F2E' : '#F5F7FF';
  const unreadDot = dark ? '#6B7280' : '#111111';

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

    if (notification.actionUrl) {
      const path = notification.actionUrl.replace(/^\//, '');
      const parts = path.split('/');
      if (path.startsWith('trips/')) {
        const id = parts[1];
        if (parts[2] === 'requests' && id) {
          navigation.navigate('CarpoolingsTab', { screen: 'TripRequests', params: { tripId: id } });
        } else if (parts[2] === 'review' && id) {
          navigation.navigate('CarpoolingsTab', { screen: 'CreateReviewFromTrip', params: { tripId: id } });
        } else if (id) {
          navigation.navigate('HomeTab', { screen: 'TripDetail', params: { tripId: id } });
        }
      } else if (path.startsWith('bookings/')) {
        navigation.navigate('CarpoolingsTab', { screen: 'MyBookings' });
      } else if (path.startsWith('chat/')) {
        const id = parts[1];
        if (id) {
          navigation.navigate('ChatsTab', {
            screen: 'ChatDetail',
            params: { conversation: { _id: id }, otherUser: notification.relatedUser || {} },
          });
        }
      } else if (path === 'seat-reservations' || path.startsWith('seat-reservations/')) {
        navigation.navigate('CarpoolingsTab', { screen: 'MySeatReservations' });
      } else if (path === 'profile') {
        navigation.navigate('ProfileTab', { screen: 'Profile' });
      }
      return;
    }

    if (tripId) {
      const type = notification.type || '';
      if (type.includes('booking_created') || type.includes('seat_reservation_request')) {
        navigation.navigate('CarpoolingsTab', { screen: 'TripRequests', params: { tripId } });
      } else if (type.includes('review')) {
        navigation.navigate('CarpoolingsTab', { screen: 'CreateReviewFromTrip', params: { tripId } });
      } else {
        navigation.navigate('HomeTab', { screen: 'TripDetail', params: { tripId } });
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
      navigation.navigate('CarpoolingsTab', { screen: 'MyBookings' });
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
            const allIds = notifications.map(n => n._id);
            setOptimisticRead(new Set(allIds));
            markAllAsRead();
          },
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
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };

  const renderItem = ({ item, index }) => {
    const isRead = item.isRead || optimisticRead.has(item._id);
    const isLast = index === notifications.length - 1;

    return (
      <TouchableOpacity
        style={[
          styles.row,
          !isRead && { backgroundColor: unreadBg },
          !isLast && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={0.7}
      >
        {/* Icon */}
        <View style={[
          styles.iconWrap,
          { backgroundColor: dark ? '#2A2A2A' : '#F0F0F0' },
          !isRead && { backgroundColor: dark ? '#252B3D' : '#E8ECFF' },
        ]}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={18}
            color={isRead ? textMuted : textPrimary}
          />
        </View>

        {/* Content */}
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text
              style={[
                styles.rowTitle,
                { color: isRead ? colors.textSecondary : textPrimary },
                !isRead && { fontWeight: '600' },
              ]}
              numberOfLines={1}
            >
              {item.title}
            </Text>
            <Text style={[styles.rowTime, { color: textMuted }]}>
              {getRelativeTime(item.createdAt)}
            </Text>
          </View>
          <Text style={[styles.rowMessage, { color: textMuted }]} numberOfLines={2}>
            {item.message}
          </Text>
        </View>

        {/* Unread indicator */}
        {!isRead && (
          <View style={[styles.unreadDot, { backgroundColor: unreadDot }]} />
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, backgroundColor: bg }]}>
        <ActivityIndicator size="small" color={textMuted} />
      </View>
    );
  }

  const hasUnread = notifications.some(n => !n.isRead && !optimisticRead.has(n._id));

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: divider }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="arrow-back" size={22} color={textPrimary} />
        </TouchableOpacity>

        <Text style={[styles.headerTitle, { color: textPrimary }]}>Notificaciones</Text>

        {hasUnread ? (
          <TouchableOpacity
            style={[styles.markAllBtn, { backgroundColor: accent }]}
            onPress={handleMarkAllAsRead}
          >
            <Text style={[styles.markAllText, { color: accentInverse }]}>Leer todas</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.markAllBtn} />
        )}
      </View>

      {/* List */}
      {notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textMuted}
            />
          }
        />
      ) : (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin notificaciones</Text>
          <Text style={[styles.emptyText, { color: textMuted }]}>
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
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  markAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    minWidth: 36,
    alignItems: 'center',
  },
  markAllText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // List
  listContent: {
    paddingBottom: 32,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 14,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  rowContent: {
    flex: 1,
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  rowTime: {
    fontSize: 12,
    flexShrink: 0,
  },
  rowMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
  },

  // Empty
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
