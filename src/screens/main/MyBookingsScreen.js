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

  const getStatusGradient = (status) => {
    switch (status) {
      case 'pending':
        return ['#F59E0B', '#D97706'];
      case 'confirmed':
        return ['#10B981', '#059669'];
      case 'cancelled':
        return ['#EF4444', '#DC2626'];
      case 'completed':
        return ['#3B82F6', '#2563EB'];
      default:
        return ['#6B7280', '#4B5563'];
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pendiente';
      case 'confirmed':
        return 'Confirmado';
      case 'cancelled':
        return 'Cancelado';
      case 'completed':
        return 'Completado';
      default:
        return status;
    }
  };

  const renderBookingItem = ({ item, index }) => {
    // No mostrar la reserva si no hay datos del conductor
    if (!item.trip?.driver?.firstName || !item.trip?.driver?.lastName) {
      console.warn('⚠️ [MyBookings] Reserva sin datos de conductor:', item._id);
      return null;
    }

    return (
      <Animated.View style={{ opacity: fadeAnim }}>
        <LinearGradient
          colors={safeGradients.card}
          style={styles.bookingCard}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.cardBorder}>
            <View style={styles.bookingHeader}>
              <LinearGradient
                colors={Array.isArray(getStatusGradient(item.status)) && getStatusGradient(item.status).length > 0 ? getStatusGradient(item.status) : ['#6B7280', '#4B5563']}
                style={styles.statusBadge}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>
                  {getStatusText(item.status)}
                </Text>
              </LinearGradient>
            </View>

            <View style={styles.routeContainer}>
              <View style={styles.routePoint}>
                <LinearGradient
                  colors={['#1F2937', '#111827']}
                  style={styles.iconGradient}
                >
                  <Ionicons name="location" size={16} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.trip?.origin?.city}
                </Text>
              </View>
              <Ionicons name="arrow-forward" size={16} color={staticColors.textTertiary} />
              <View style={styles.routePoint}>
                <LinearGradient
                  colors={createColorArray('#EF4444', '#DC2626')}
                  style={styles.iconGradient}
                >
                  <Ionicons name="location" size={16} color={staticColors.textPrimary} />
                </LinearGradient>
                <Text style={styles.routeText} numberOfLines={1}>
                  {item.trip?.destination?.city}
                </Text>
              </View>
            </View>

            <View style={styles.driverInfo}>
                <LinearGradient
                  colors={safeGradients.primary}
                  style={styles.avatarPlaceholder}
                >
                <Text style={styles.avatarText}>
                  {item.trip.driver.firstName[0]}{item.trip.driver.lastName[0]}
                </Text>
              </LinearGradient>
              <View style={styles.driverDetails}>
                <Text style={styles.driverName}>
                  {item.trip.driver.firstName} {item.trip.driver.lastName}
                </Text>
                <Text style={styles.tripDate}>
                  {new Date(item.trip?.departureDate).toLocaleDateString('es-ES')} •{' '}
                  {item.trip?.departureTime}
                </Text>
              </View>
              <View style={styles.seatsContainer}>
                <Ionicons name="people" size={14} color={staticColors.textSecondary} />
                <Text style={styles.seats}>{item.seats}</Text>
              </View>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={() =>
                  navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id })
                }
              >
                <LinearGradient
                  colors={safeGradients.primary}
                  style={styles.detailButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.detailButtonText}>Ver Detalles</Text>
                </LinearGradient>
              </TouchableOpacity>

              {item.status === 'pending' && (
                <TouchableOpacity onPress={() => handleCancelBooking(item._id)}>
                  <LinearGradient
                    colors={createColorArray('#EF4444', '#DC2626')}
                    style={styles.cancelButton}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.cancelButtonText}>Cancelar</Text>
                  </LinearGradient>
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
  bookingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: staticColors.textPrimary,
    marginRight: spacing.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semiBold,
    color: staticColors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  priceContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  price: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#FFFFFF',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeText: {
    marginLeft: spacing.sm,
    fontSize: fontSize.sm,
    color: staticColors.textPrimary,
    fontWeight: fontWeight.medium,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
    padding: spacing.sm,
    backgroundColor: staticColors.surfaceElevated,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: staticColors.border,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  driverDetails: {
    flex: 1,
    marginLeft: spacing.md,
  },
  driverName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: staticColors.textPrimary,
  },
  tripDate: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
    marginTop: 2,
  },
  seatsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: staticColors.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  seats: {
    fontSize: fontSize.sm,
    color: staticColors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  detailButton: {
    flex: 1,
    borderRadius: borderRadius.md,
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    color: '#FFFFFF',
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
