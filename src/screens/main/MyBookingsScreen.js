import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import socketService from '../../services/socketService';

const MyBookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadMyBookings();
    setupTripCancellationListener();
    return () => cleanupListeners();
  }, []);

  const setupTripCancellationListener = () => {
    const handleTripCancelled = (data) => {
      setBookings(prevBookings => {
        let hasUpdates = false;
        const updatedBookings = prevBookings.map(booking => {
          const bookingTripId = booking.trip?._id || booking.trip;
          if (bookingTripId === data.tripId) {
            hasUpdates = true;
            return {
              ...booking,
              status: 'cancelled',
              cancelReason: data.reason || 'Viaje cancelado por el conductor',
            };
          }
          return booking;
        });

        if (hasUpdates) {
          setTimeout(() => loadMyBookings(), 1000);
        }
        return updatedBookings;
      });
    };

    if (!socketService.isConnected) {
      socketService.connect();
    }

    if (socketService.socket) {
      socketService.socket.on('trip:cancelled', handleTripCancelled);
    }
  };

  const cleanupListeners = () => {
    if (socketService.socket) {
      socketService.socket.off('trip:cancelled');
    }
  };

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
      'Cancelar reserva',
      'Estas seguro?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await put_withauth(ENDPOINTS.CANCEL_BOOKING(bookingId));
              if (response.success) {
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
        return { color: '#F59E0B', bg: '#FEF3C7', text: 'Pendiente' };
      case 'confirmed':
        return { color: '#10B981', bg: '#D1FAE5', text: 'Confirmado' };
      case 'cancelled':
        return { color: '#EF4444', bg: '#FEE2E2', text: 'Cancelado' };
      case 'completed':
        return { color: '#3B82F6', bg: '#DBEAFE', text: 'Completado' };
      default:
        return { color: '#6B7280', bg: '#F3F4F6', text: status };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
  };

  const renderBookingItem = ({ item }) => {
    if (!item.trip?.driver?.firstName) return null;

    const statusConfig = getStatusConfig(item.status);
    const driver = item.trip.driver;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item.trip?._id })}
        activeOpacity={0.7}
      >
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.text}
          </Text>
        </View>

        {/* Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <Text style={styles.cityText} numberOfLines={1}>
              {item.trip?.origin?.city}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDestination]} />
            <Text style={styles.cityText} numberOfLines={1}>
              {item.trip?.destination?.city}
            </Text>
          </View>
        </View>

        {/* Trip Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{formatDate(item.trip?.departureDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{item.trip?.departureTime}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="person-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>
              {item.seats || item.seatsBooked || 1} asiento{(item.seats || item.seatsBooked || 1) > 1 ? 's' : ''}
            </Text>
          </View>
        </View>

        {/* Driver */}
        <View style={styles.driverSection}>
          {driver.avatar ? (
            <Image
              source={{ uri: buildImageUri(driver.avatar) }}
              style={styles.driverAvatar}
            />
          ) : (
            <View style={styles.driverAvatarPlaceholder}>
              <Text style={styles.driverInitials}>
                {driver.firstName[0]}{driver.lastName[0]}
              </Text>
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>
              {driver.firstName} {driver.lastName}
            </Text>
            <Text style={styles.driverLabel}>Conductor</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </View>

        {/* Action Buttons */}
        {item.status === 'pending' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.payButton}
              onPress={() => navigation.navigate('TripDetailFromCarpoolings', { 
                tripId: item.trip?._id,
                openPayment: true 
              })}
            >
              <Text style={styles.payButtonText}>Ir a pagar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => handleCancelBooking(item._id)}
            >
              <Text style={styles.cancelButtonText}>Cancelar reserva</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {bookings.length > 0 ? (
        <FlatList
          data={bookings}
          renderItem={renderBookingItem}
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
            <Ionicons name="calendar-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>Sin reservas</Text>
          <Text style={styles.emptySubtitle}>
            Cuando reserves un viaje aparecera aqui
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
  listContent: {
    padding: 16,
  },
  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  // Status
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Route
  routeSection: {
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000000',
  },
  routeDotDestination: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#000000',
  },
  routeLine: {
    width: 2,
    height: 20,
    backgroundColor: '#E5E7EB',
    marginLeft: 4,
    marginVertical: 4,
  },
  cityText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  // Info
  infoSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
  },
  // Driver
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  driverAvatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInitials: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 12,
  },
  driverName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
  },
  driverLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  // Action Buttons
  actionButtons: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 16,
  },
  payButton: {
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  payButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Cancel Button
  cancelButton: {
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EF4444',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  // Empty State
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

export default MyBookingsScreen;
