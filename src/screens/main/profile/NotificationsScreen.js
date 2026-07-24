import { useState, useCallback, useRef, useEffect } from 'react';
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
import { useNotifications } from '../../../context/NotificationContext';
import { useColors } from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { navigateFromNotification } from '../../../utils/notificationNavigation';
import { get_withauth } from '../../../services/apiService';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useUI } from '../../../theme/ui';
import EmptyState from '../../../components/ui/EmptyState';

/** Mensajes de chat: solo push; no centro in-app (coherente con backend) */
const isInAppNotification = (n) => n && n.type !== 'new_message';

const NotificationsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDarkMode } = useColors();

  useTheme();
  const { markAsRead, markAllAsRead, loadNotifications } = useNotifications();

  const [items, setItems]           = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [optimisticRead, setOptimisticRead] = useState(new Set());
  const fetchingRef = useRef(false);

  const dark = isDarkMode;
  const bg = colors.background;
  const textPrimary = colors.textPrimary;
  const textMuted = colors.textMuted;

  const ui = useUI();  const divider = ui.bg;
  const accent = ui.invertBg;
  const accentInverse = ui.invertText;
  const unreadBg = ui.surface;
  const unreadDot = dark ? '#6B7280' : '#111111';

  // Carga inicial / refresh
  const loadPage = useCallback(async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await get_withauth(`/notifications?page=${pageNum}&limit=${LIST_PAGE_SIZE}`);
      if (response?.success) {
        const newItems = (response.data || []).filter(isInAppNotification);
        setItems(prev => reset ? newItems : [...prev, ...newItems]);
        setPage(pageNum);
        setHasMore(response.hasMore ?? false);
      }
    } catch (_) {}
    finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPage(1, true);
    // Reconcilia el badge de la campanita con el server: se calculaba una sola
    // vez al inicio y quedaba en 1 aunque ya estuvieran todas leídas.
    loadNotifications();
  }, [loadPage, loadNotifications]);

  const onRefresh = () => {
    setRefreshing(true);
    setOptimisticRead(new Set());
    loadPage(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadPage(page + 1, false);
  };

  const handleNotificationPress = (notification) => {
    if (!notification.isRead && !optimisticRead.has(notification._id)) {
      setOptimisticRead(prev => new Set([...prev, notification._id]));
      markAsRead(notification._id);
    }
    navigateFromNotification(navigation, notification, { useMainStack: false });
  };

  const handleMarkAllAsRead = () => {
    const allIds = items.map(n => n._id);
    setOptimisticRead(new Set(allIds));
    markAllAsRead();
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
    const isLast = index === items.length - 1;

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
          { backgroundColor: ui.bg },
          !isRead && { backgroundColor: dark ? '#333333' : '#E5E5E5' },
        ]}>
          <Ionicons
            name={getNotificationIcon(item.type)}
            size={18}
            color={isRead ? textMuted : textPrimary}
          />
        </View>

        {/* Content: título y mensaje pueden ocupar varias líneas (alto variable) */}
        <View style={styles.rowContent}>
          <View style={styles.rowTop}>
            <Text
              style={[
                styles.rowTitle,
                { color: isRead ? colors.textSecondary : textPrimary },
                !isRead && { fontWeight: '600' },
              ]}
            >
              {item.title}
            </Text>
            <Text style={[styles.rowTime, { color: textMuted }]}>
              {getRelativeTime(item.createdAt)}
            </Text>
          </View>
          {item.message ? (
            <Text style={[styles.rowMessage, { color: textMuted }]}>{item.message}</Text>
          ) : null}
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

  const hasUnread = items.some(n => !n.isRead && !optimisticRead.has(n._id));

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: bg }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: divider }]}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="close" size={22} color={textPrimary} />
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
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="small" color={textMuted} />
        </View>
      ) : items.length > 0 ? (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={true}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator size="small" color={textMuted} style={{ paddingVertical: 16 }} />
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon="notifications-outline"
            title="Sin notificaciones"
            subtitle="Cuando recibas notificaciones aparecerán aquí"
          />
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
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36,
    alignItems: 'flex-start',
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: 'Sora_800ExtraBold',
    letterSpacing: -0.5,
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
    fontFamily: 'Sora_600SemiBold',
  },

  // List
  listContent: {
    paddingBottom: 32,
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    flex: 1,
    flexShrink: 1,
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },
  rowTime: {
    fontSize: 12,
    flexShrink: 0,
    marginTop: 1,
  },
  rowMessage: {
    fontSize: 13,
    lineHeight: 20,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    flexShrink: 0,
    alignSelf: 'center',
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
    fontFamily: 'Sora_600SemiBold',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default NotificationsScreen;
