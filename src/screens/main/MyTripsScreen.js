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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socketService';

const MyTripsScreen = ({ navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const { refreshUser } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' or 'past'
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadMyTrips();
  }, []);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadMyTrips = async () => {
    try {
      const response = await get_withauth(ENDPOINTS.MY_TRIPS_DRIVER);
      if (response.success) {
        setTrips(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMyTrips();
  };

  const handleCancelTrip = (tripId) => {
    Alert.alert(
      'Cancelar Viaje',
      '¿Estás seguro que deseas cancelar este viaje? Esto cancelará automáticamente todas las reservas asociadas.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🚫 Cancelando viaje:', tripId);
              const response = await put_withauth(ENDPOINTS.CANCEL_TRIP(tripId));

              console.log('🚫 Respuesta de cancelación:', response);

              if (response.success) {
                // Notificar via socket para sincronización en tiempo real
                if (socketService.socket && socketService.isConnected) {
                  console.log('📡 Emitiendo evento trip:cancelled para sincronización');
                  socketService.socket.emit('trip:cancelled', {
                    tripId: tripId,
                    cancelledBy: 'driver',
                    timestamp: new Date().toISOString()
                  });
                }

                Alert.alert(
                  'Viaje Cancelado',
                  'El viaje y todas las reservas asociadas han sido canceladas exitosamente.',
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // Actualizar la lista de viajes
                        loadMyTrips();
                        // Actualizar datos del usuario por si hay contadores
                        refreshUser();
                        console.log('✅ Cancelación completada y datos actualizados');
                      }
                    }
                  ]
                );
              } else {
                Alert.alert('Error', response.message || 'No se pudo cancelar el viaje');
              }
            } catch (error) {
              console.error('❌ Error cancelando viaje:', error);
              Alert.alert('Error', error.message || 'Error de conexión al cancelar el viaje');
            }
          },
        },
      ]
    );
  };

  const handleCompleteTrip = (tripId) => {
    Alert.alert(
      'Completar Viaje',
      '¿Confirmas que este viaje se ha completado?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Sí',
          onPress: async () => {
            try {
              const response = await put_withauth(`/trips/${tripId}/complete`);
              if (response.success) {
                Alert.alert('Éxito', 'Viaje marcado como completado');
                loadMyTrips();
                // Actualizar contador de viajes completados en el perfil
                await refreshUser();
                console.log('✅ Usuario actualizado después de completar viaje');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#10b981';
      case 'completed':
        return '#2563eb';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'active':
        return 'Activo';
      case 'completed':
        return 'Completado';
      case 'cancelled':
        return 'Cancelado';
      default:
        return status;
    }
  };

  const getFilteredTrips = () => {
    const now = new Date();
    if (activeTab === 'upcoming') {
      return (Array.isArray(trips) ? trips : []).filter(trip => {
        const tripDate = new Date(trip.departureDate);
        return tripDate >= now && trip.status !== 'cancelled' && trip.status !== 'completed';
      });
    } else {
      return (Array.isArray(trips) ? trips : []).filter(trip => {
        const tripDate = new Date(trip.departureDate);
        return tripDate < now || trip.status === 'cancelled' || trip.status === 'completed';
      });
    }
  };

  const renderTripItem = ({ item }) => (
    <TouchableOpacity
      style={styles.tripCardWrapper}
      onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item._id })}
      activeOpacity={0.8}
    >
      <LinearGradient
        colors={gradients.card || ['#FFFFFF', '#F8F9FA']}
        style={styles.tripCard}
      >
        <View style={styles.cardBorder} />

        <View style={styles.tripHeader}>
          <LinearGradient
            colors={createColorArray(getStatusColor(item.status) + '20', getStatusColor(item.status) + '10')}
            style={styles.statusBadge}
          >
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor(item.status) }]}
            />
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {getStatusText(item.status)}
            </Text>
          </LinearGradient>

          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.priceContainer}
          >
            <Text style={styles.price}>${item.pricePerSeat}</Text>
          </LinearGradient>
        </View>

        <View style={styles.routeContainer}>
          <View style={styles.routePoint}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.iconCircle}
            >
              <Ionicons name="location" size={16} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.origin.city}
            </Text>
          </View>

          <Ionicons name="arrow-forward" size={16} color="#D1D5DB" />

          <View style={styles.routePoint}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.iconCircle}
            >
              <Ionicons name="location" size={16} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.routeText} numberOfLines={1}>
              {item.destination.city}
            </Text>
          </View>
        </View>

        <View style={styles.tripFooter}>
          <View style={styles.footerItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.tripDate}>
              {new Date(item.departureDate).toLocaleDateString('es-ES')} • {item.departureTime}
            </Text>
          </View>
          <View style={styles.footerItem}>
            <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.seats}>
              {item.availableSeats} asientos disponibles
            </Text>
          </View>
        </View>

        {item.status === 'active' && (
          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryActionButton}
              onPress={() => navigation.navigate('TripRequests', { tripId: item._id })}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#1F2937', '#111827']}
                style={styles.primaryActionGradient}
              >
                <Ionicons name="people" size={18} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>
                  Ver Reservas
                </Text>
                {item.bookingsCount > 0 && (
                  <View style={styles.primaryBadge}>
                    <Text style={styles.primaryBadgeText}>
                      {item.bookingsCount > 99 ? '99+' : item.bookingsCount}
                    </Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.secondaryActionsRow}>
              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => navigation.navigate('EditTrip', { tripId: item._id })}
                activeOpacity={0.7}
              >
                <View style={[styles.iconActionCircle, { backgroundColor: '#1F2937' + '20' }]}>
                  <Ionicons name="create-outline" size={18} color="#1F2937" />
                </View>
                <Text style={[styles.iconActionText, { color: '#1F2937' }]}>Editar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => handleCompleteTrip(item._id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconActionCircle, { backgroundColor: '#10b981' + '20' }]}>
                  <Ionicons name="checkmark-circle-outline" size={18} color="#10b981" />
                </View>
                <Text style={[styles.iconActionText, { color: '#10b981' }]}>Completar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.iconActionButton}
                onPress={() => handleCancelTrip(item._id)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconActionCircle, { backgroundColor: '#EF4444' + '20' }]}>
                  <Ionicons name="close-circle-outline" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.iconActionText, { color: '#EF4444' }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <LinearGradient colors={['#FFFFFF', '#F8F9FA']} style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#1F2937" />
      </LinearGradient>
    );
  }

  const filteredTrips = getFilteredTrips();

  return (
    <LinearGradient colors={['#FFFFFF', '#F8F9FA']} style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {/* Tab Navigation */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
            onPress={() => setActiveTab('upcoming')}
            activeOpacity={0.8}
          >
            {activeTab === 'upcoming' ? (
              <LinearGradient colors={['#1F2937', '#111827']} style={styles.tabGradient}>
                <Ionicons name="time-outline" size={18} color="#FFFFFF" />
                <Text style={styles.tabTextActive}>Próximos</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Ionicons name="time-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.tabText}>Próximos</Text>
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'past' && styles.tabActive]}
            onPress={() => setActiveTab('past')}
            activeOpacity={0.8}
          >
            {activeTab === 'past' ? (
              <LinearGradient colors={['#1F2937', '#111827']} style={styles.tabGradient}>
                <Ionicons name="checkmark-done-outline" size={18} color="#FFFFFF" />
                <Text style={styles.tabTextActive}>Pasados</Text>
              </LinearGradient>
            ) : (
              <View style={styles.tabInactive}>
                <Ionicons name="checkmark-done-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.tabText}>Pasados</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Trips List */}
        {filteredTrips.length > 0 ? (
          <FlatList
            data={filteredTrips}
            renderItem={renderTripItem}
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
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <LinearGradient
              colors={['#1F2937', '#111827']}
              style={styles.emptyIconContainer}
            >
              <Ionicons name="car-outline" size={48} color="#FFFFFF" />
            </LinearGradient>
            <Text style={styles.emptyText}>
              {activeTab === 'upcoming' ? 'No tienes viajes próximos' : 'No tienes viajes pasados'}
            </Text>
            <Text style={styles.emptySubtext}>
              {activeTab === 'upcoming'
                ? 'Crea tu primer viaje y comparte tus gastos'
                : 'Tus viajes completados aparecerán aquí'
              }
            </Text>
          </View>
        )}
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    padding: 16,
    paddingBottom: 12,
    gap: 12,
  },
  tab: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F8F9FA',
  },
  tabActive: {
    backgroundColor: 'transparent',
  },
  tabGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  tabInactive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 8,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F3F4F6',
  },

  // List
  listContent: {
    padding: 16,
    paddingTop: 4,
  },

  // Trip Card
  tripCardWrapper: {
    marginBottom: 16,
  },
  tripCard: {
    borderRadius: 16,
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
  },
  cardBorder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },

  // Trip Header
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  priceContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#F3F4F6',
  },

  // Route
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  routePoint: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  routeText: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
    flex: 1,
  },

  // Trip Footer
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  footerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tripDate: {
    fontSize: 13,
    color: '#6B7280',
  },
  seats: {
    fontSize: 13,
    color: '#6B7280',
  },

  // Actions Container
  actionsContainer: {
    gap: 10,
    marginTop: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  actionButtonLarge: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 6,
  },
  actionButtonGradientLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
    gap: 8,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  actionButtonTextLarge: {
    fontSize: 14,
    fontWeight: '600',
  },
  primaryActionButton: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
  },
  primaryActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  primaryActionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F3F4F6',
  },
  primaryBadge: {
    backgroundColor: '#000000',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  primaryBadgeText: {
    color: '#6366F1',
    fontSize: 11,
    fontWeight: 'bold',
  },
  secondaryActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  iconActionButton: {
    alignItems: 'center',
    gap: 6,
  },
  iconActionCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestsBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: '#F8F9FA',
  },
  requestsBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: 'bold',
  },

  // Empty State
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default MyTripsScreen;
