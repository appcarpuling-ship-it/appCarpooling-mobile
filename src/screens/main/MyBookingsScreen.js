import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { get_withauth, put_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import socketService from '../../services/socketService';
import { colors as staticColors, gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const MyBookingsScreen = ({ navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  // Fallbacks para gradientes
  const safeGradients = {
    card: Array.isArray(gradients?.card) && gradients.card.length > 0 ? gradients.card : ['#FFFFFF', '#F8F9FA'],
    primary: ['#1F2937', '#111827'],
    dark: Array.isArray(gradients?.dark) && gradients.dark.length > 0 ? gradients.dark : ['#F8F9FA', '#E5E7EB'],
  };
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMyBookings();
    setupTripCancellationListener();

    return () => {
      cleanupListeners();
    };
  }, []);

  // Recargar reservas cuando la pantalla se enfoque
  // COMENTADO TEMPORALMENTE - useFocusEffect no disponible
  // useFocusEffect(
  //   useCallback(() => {
  //     console.log('🔄 [MyBookings] Pantalla enfocada, recargando reservas');
  //     loadMyBookings();
  //   }, [])
  // );

  const setupTripCancellationListener = () => {
    // Escuchar cuando se cancelan viajes para actualizar reservas automáticamente
    const handleTripCancelled = (data) => {
      console.log('🚫 [MyBookings] Evento trip:cancelled recibido:', {
        tripId: data.tripId,
        cancelReason: data.reason,
        timestamp: new Date().toISOString()
      });

      // Verificar si alguna de nuestras reservas corresponde a este viaje
      setBookings(prevBookings => {
        let hasUpdates = false;
        const updatedBookings = prevBookings.map(booking => {
          const bookingTripId = booking.trip?._id || booking.trip;

          if (bookingTripId === data.tripId) {
            console.log('✅ [MyBookings] Cancelando reserva automáticamente:', {
              bookingId: booking._id,
              tripId: data.tripId,
              originalStatus: booking.status
            });
            hasUpdates = true;
            return {
              ...booking,
              status: 'cancelled',
              cancelReason: data.reason || 'Viaje cancelado por el conductor',
              cancelledAt: new Date().toISOString()
            };
          }
          return booking;
        });

        if (hasUpdates) {
          console.log('📋 [MyBookings] Se actualizaron reservas localmente, recargando desde servidor...');
          // Recargar desde el servidor en 1 segundo para asegurar sincronización
          setTimeout(() => {
            loadMyBookings();
          }, 1000);
        }

        return updatedBookings;
      });
    };

    // Conectar socket si no está conectado
    if (!socketService.isConnected) {
      console.log('🔌 [MyBookings] Conectando socket...');
      socketService.connect();
    }

    // Configurar listener con retry
    const configureListener = () => {
      if (socketService.socket) {
        console.log('✅ [MyBookings] Configurando listener para trip:cancelled');
        socketService.socket.on('trip:cancelled', handleTripCancelled);
        return true;
      }
      return false;
    };

    // Intentar configurar inmediatamente
    if (!configureListener()) {
      // Si no se pudo, intentar después de un breve delay
      console.log('⏳ [MyBookings] Socket no listo, reintentando en 1 segundo...');
      setTimeout(() => {
        configureListener();
      }, 1000);
    }
  };

  const cleanupListeners = () => {
    console.log('🧹 [MyBookings] Limpiando listeners de socket');
    if (socketService.socket) {
      socketService.socket.off('trip:cancelled');
    }
  };

  useEffect(() => {
    if (!loading && bookings.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, bookings]);

  const loadMyBookings = async () => {
    try {
      const response = await get_withauth(ENDPOINTS.MY_BOOKINGS);
      if (response.success) {
        setBookings(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar las reservas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadMyBookings();
  };

  const handleCancelBooking = (bookingId) => {
    Alert.alert(
      'Cancelar Reserva',
      '¿Estás seguro que deseas cancelar esta reserva?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await put_withauth(ENDPOINTS.CANCEL_BOOKING(bookingId));
              if (response.success) {
                Alert.alert('Éxito', 'Reserva cancelada');
                loadMyBookings();
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'pending':
        return { color: '#F59E0B', text: 'Pendiente', icon: 'time-outline' };
      case 'confirmed':
        return { color: '#10B981', text: 'Confirmado', icon: 'checkmark-circle-outline' };
      case 'cancelled':
        return { color: '#EF4444', text: 'Cancelado', icon: 'close-circle-outline' };
      case 'completed':
        return { color: '#3B82F6', text: 'Completado', icon: 'checkmark-done-outline' };
      default:
        return { color: '#6B7280', text: status, icon: 'help-circle-outline' };
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  };

  const renderBookingItem = ({ item, index }) => {
    // No mostrar la reserva si no hay datos del conductor
    if (!item.trip?.driver?.firstName || !item.trip?.driver?.lastName) {
      console.warn('⚠️ [MyBookings] Reserva sin datos de conductor:', item._id);
      return null;
    }

    const statusConfig = getStatusConfig(item.status);
    const StatusIcon = statusConfig.icon;

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <LinearGradient
          colors={safeGradients.card}
          style={styles.bookingCard}
        >
          <View style={styles.cardBorder}>
            {/* Header con ruta y estado */}
            <View style={styles.reservationHeader}>
              <View style={styles.routeInfo}>
                <View style={styles.routePoint}>
                  <Ionicons name="location" size={16} color="#1F2937" />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {item.trip?.origin?.city}
                  </Text>
                </View>
                <Ionicons name="arrow-forward" size={16} color={staticColors.textTertiary} />
                <View style={styles.routePoint}>
                  <Ionicons name="location" size={16} color="#EF4444" />
                  <Text style={styles.routeText} numberOfLines={1}>
                    {item.trip?.destination?.city}
                  </Text>
                </View>
              </View>
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '20' }]}>
                <Ionicons name={StatusIcon} size={14} color={statusConfig.color} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>
                  {statusConfig.text}
                </Text>
              </View>
            </View>

            {/* Información del viaje */}
            <View style={styles.tripInfo}>
              <View style={styles.infoRow}>
                <Ionicons name="calendar-outline" size={14} color={staticColors.textSecondary} />
                <Text style={styles.infoText}>
                  {formatDate(item.trip?.departureDate)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="time-outline" size={14} color={staticColors.textSecondary} />
                <Text style={styles.infoText}>{item.trip?.departureTime}</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="people-outline" size={14} color={staticColors.textSecondary} />
                <Text style={styles.infoText}>
                  {item.seats || item.seatsBooked || 1} asiento{(item.seats || item.seatsBooked || 1) > 1 ? 's' : ''}
                </Text>
              </View>
            </View>

            {/* Información del conductor */}
            <View style={styles.driverInfo}>
              <View style={styles.driverInfoRow}>
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>
                    {item.trip.driver.firstName[0]}{item.trip.driver.lastName[0]}
                  </Text>
                </View>
                <View style={styles.driverDetails}>
                  <Text style={styles.driverName}>
                    {item.trip.driver.firstName} {item.trip.driver.lastName}
                  </Text>
                  <Text style={styles.driverSubtext}>Conductor</Text>
                </View>
              </View>
            </View>

            {/* Botones de acción */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id })
                }
                style={styles.detailButton}
              >
                <LinearGradient
                  colors={safeGradients.primary}
                  style={styles.detailButtonGradient}
                >
                  <Text style={styles.detailButtonText}>Ver Detalles</Text>
                </LinearGradient>
              </TouchableOpacity>

              {item.status === 'pending' && (
                <TouchableOpacity
                  onPress={() => handleCancelBooking(item._id)}
                  style={styles.cancelButton}
                >
                  <View style={styles.cancelButtonView}>
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <LinearGradient
        colors={safeGradients.dark} style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1F2937" />
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={safeGradients.dark} style={styles.container}>
      {bookings.length > 0 ? (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#1F2937"
              colors={['#1F2937', '#111827']}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No tienes reservas</Text>
          <Text style={styles.emptySubtext}>
            Busca y reserva viajes para comenzar
          </Text>
        </View>
      )}
    </LinearGradient>
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
  listContent: {
    padding: spacing.md,
  },
  bookingCard: {
    borderRadius: borderRadius.lg,
    padding: 1.5,
    marginBottom: spacing.md,
    shadowColor: staticColors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  cardBorder: {
    backgroundColor: staticColors.cardBackground,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: staticColors.cardBorder,
  },
  reservationHeader: {
    marginBottom: spacing.md,
  },
  routeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.xs,
  },
  routeText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    gap: spacing.xs,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
  },
  tripInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  infoText: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary || '#6B7280',
  },
  driverInfo: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  driverInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  driverDetails: {
    flex: 1,
  },
  driverName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: staticColors.textPrimary,
    marginBottom: 2,
  },
  driverSubtext: {
    fontSize: fontSize.xs,
    color: staticColors.textSecondary,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  detailButtonGradient: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailButtonText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },
  cancelButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelButtonView: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#EF4444',
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxl,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semiBold,
    color: staticColors.textPrimary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
});

export default MyBookingsScreen;
