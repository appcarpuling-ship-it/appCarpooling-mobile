import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Alert,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Notifications from 'expo-notifications';
import { useNotifications } from '../../context/NotificationContext';
import { colors as staticColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const NotificationsScreen = ({ navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const insets = useSafeAreaInsets();
  const {
    notifications = [],
    unreadCount = 0,
    loading,
    markAsRead,
    markAllAsRead,
    loadNotifications,
  } = useNotifications();

  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!loading) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  };

  const handleNotificationPress = async (notification) => {
    // Marcar como leída - usar isRead (backend usa isRead)
    if (!notification.isRead) {
      await markAsRead(notification._id);
    }

    // Navegar según el tipo de notificación
    switch (notification.type) {
      case 'booking':
      case 'booking_update':
        if (notification.data?.tripId) {
          navigation.navigate('TripDetail', { tripId: notification.data.tripId });
        } else if (notification.data?.bookingId) {
          navigation.navigate('TripRequests', { tripId: notification.data.tripId });
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
      'Marcar todas como leídas',
      '¿Estás seguro de marcar todas las notificaciones como leídas?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Confirmar',
          onPress: async () => {
            await markAllAsRead();
          },
        },
      ]
    );
  };

  const sendTestNotification = async () => {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '🧪 Notificación de Prueba',
          body: 'Esta es una notificación de prueba para verificar que todo funciona correctamente.',
          badge: 1,
          sound: 'default',
          data: {
            type: 'test',
            timestamp: new Date().toISOString(),
          },
        },
        trigger: {
          seconds: 1, // Dispara en 1 segundo
        },
      });
      Alert.alert('✅ Notificación programada', 'Deberías recibirla en 1 segundo');
    } catch (error) {
      console.error('Error enviando notificación de prueba:', error);
      Alert.alert('❌ Error', 'No se pudo enviar la notificación de prueba');
    }
  };

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'booking':
      case 'booking_update':
        return 'calendar';
      case 'trip':
        return 'car';
      case 'payment':
        return 'cash';
      case 'review':
        return 'star';
      case 'message':
      case 'new_message':
        return 'chatbubble';
      case 'user':
        return 'person';
      case 'system':
        return 'settings';
      default:
        return 'notifications';
    }
  };

  const getNotificationGradient = (type, isRead) => {
    if (isRead) {
      return ['#F8F9FA', '#E5E7EB'];
    }

    switch (type) {
      case 'booking':
        return ['#E0E7FF', '#C7D2FE'];
      case 'trip':
        return ['#D1FAE5', '#A7F3D0'];
      case 'payment':
        return ['#FEF3C7', '#FDE68A'];
      case 'review':
        return ['#E0E7FF', '#C7D2FE'];
      case 'message':
        return ['#DBEAFE', '#BFDBFE'];
      case 'user':
        return ['#E0E7FF', '#C7D2FE'];
      case 'system':
        return ['#F3F4F6', '#E5E7EB'];
      default:
        return ['#E0E7FF', '#C7D2FE'];
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

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
    });
  };

  // Componente separado para evitar problemas con hooks
  const NotificationItem = React.memo(({ item, index, onPress, getNotificationIcon, getNotificationGradient, getRelativeTime, createColorArray, colors }) => {
    const itemFadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
      Animated.timing(itemFadeAnim, {
        toValue: 1,
        duration: 600,
        delay: index * 50,
        useNativeDriver: true,
      }).start();
    }, [index]);

    return (
      <Animated.View style={{ opacity: itemFadeAnim }}>
        <TouchableOpacity
          style={styles.notificationCard}
          onPress={() => onPress(item)}
          activeOpacity={0.9}
        >
          <LinearGradient
            colors={getNotificationGradient(item.type, item.isRead)}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.notificationGradient}
          >
            <View style={styles.notificationRow}>
              <View style={[styles.iconContainer, item.isRead && styles.iconContainerRead]}>
                <Ionicons
                  name={getNotificationIcon(item.type)}
                  size={24}
                  color={item.isRead ? '#1F2937' : '#3B82F6'}
                />
              </View>

              <View style={styles.notificationContent}>
                <Text style={[styles.title, { color: item.isRead ? '#000000' : '#1F2937' }]}>{item.title}</Text>
                <Text style={[styles.message, { color: item.isRead ? '#6B7280' : '#374151' }]}>{item.message}</Text>
                <Text style={[styles.time, { color: item.isRead ? '#9CA3AF' : '#6B7280' }]}>{getRelativeTime(item.createdAt)}</Text>
              </View>

              {!item.isRead && (
                <View style={styles.unreadBadge}>
                  <View style={styles.unreadGlow} />
                </View>
              )}
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>
    );
  });

  const renderNotificationItem = ({ item, index }) => (
    <NotificationItem
      item={item}
      index={index}
      onPress={handleNotificationPress}
      getNotificationIcon={getNotificationIcon}
      getNotificationGradient={getNotificationGradient}
      getRelativeTime={getRelativeTime}
      createColorArray={createColorArray}
      colors={colors}
    />
  );

  if (loading) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </LinearGradient>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" translucent={false} />
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.gradientContainer}>
        <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim }]}>
          <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.closeButton}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={24} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.headerButtons}>
            {notifications.length > 0 && (
              <TouchableOpacity
                style={styles.markAllButton}
                onPress={handleMarkAllAsRead}
              >
                <LinearGradient
                  colors={createColorArray(colors.primary, colors.primaryDark || '#111827')}
                  style={styles.markAllGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-done" size={16} color="#FFF" />
                  <Text style={styles.markAllText}>Marcar todas</Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>
        </View>

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
                tintColor={colors.primary}
                colors={createColorArray(colors.primary)}
              />
            }
          />
        ) : (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.emptyIconContainer}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons
                name="notifications-outline"
                size={48}
                color="#FFFFFF"
              />
            </LinearGradient>
            <Text style={styles.emptyText}>No tienes notificaciones</Text>
            <Text style={styles.emptySubtext}>
              Cuando recibas notificaciones, apareceran aqui
            </Text>
          </View>
        )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  gradientContainer: {
    flex: 1,
  },
  contentWrapper: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.lg,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    flex: 1,
    textAlign: 'center',
    marginLeft: -40, // Compensar el espacio del botón de cerrar para centrar el título
  },
  headerButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  testButton: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#1F2937',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  testButtonText: {
    color: '#1F2937',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
  },
  markAllButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  markAllGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  markAllText: {
    color: '#FFFFFF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
  },
  listContent: {
    padding: spacing.md,
  },
  notificationCard: {
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
  },
  notificationGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  iconContainerRead: {
    backgroundColor: 'rgba(31, 41, 55, 0.1)',
  },
  notificationContent: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#1F2937',
    marginBottom: spacing.xs,
  },
  titleRead: {
    color: '#000000',
  },
  message: {
    fontSize: fontSize.sm,
    color: '#374151',
    marginBottom: spacing.xs,
  },
  messageRead: {
    color: '#6B7280',
  },
  time: {
    fontSize: fontSize.xs,
    color: '#6B7280',
  },
  timeRead: {
    color: '#9CA3AF',
  },
  unreadBadge: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: spacing.sm,
    backgroundColor: '#3B82F6',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
    elevation: 3,
  },
  unreadGlow: {
    width: '100%',
    height: '100%',
    borderRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
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
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default NotificationsScreen;
