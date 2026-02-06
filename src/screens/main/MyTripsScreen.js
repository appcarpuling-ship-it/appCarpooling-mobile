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
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import socketService from '../../services/socketService';

const MyTripsScreen = ({ navigation }) => {
  const { refreshUser } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [startingTripId, setStartingTripId] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [completingTripId, setCompletingTripId] = useState(null);
  const [actualCost, setActualCost] = useState('');

  useEffect(() => {
    loadMyTrips();
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
      'Esto cancelara todas las reservas asociadas.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, cancelar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await put_withauth(ENDPOINTS.CANCEL_TRIP(tripId));
              if (response.success) {
                if (socketService.socket && socketService.isConnected) {
                  socketService.socket.emit('trip:cancelled', {
                    tripId: tripId,
                    cancelledBy: 'driver',
                    timestamp: new Date().toISOString()
                  });
                }
                Alert.alert('Viaje Cancelado', 'El viaje ha sido cancelado.', [
                  { text: 'OK', onPress: () => { loadMyTrips(); refreshUser(); } }
                ]);
              } else {
                Alert.alert('Error', response.message || 'No se pudo cancelar el viaje');
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Error al cancelar el viaje');
            }
          },
        },
      ]
    );
  };

  const handleStartTrip = (tripId) => {
    Alert.alert(
      'Iniciar Viaje',
      'Los pasajeros seran notificados.',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Si, iniciar',
          onPress: async () => {
            setStartingTripId(tripId);
            try {
              const response = await put_withauth(ENDPOINTS.START_TRIP(tripId));
              if (response.success) {
                Alert.alert('Viaje Iniciado', 'El viaje ha comenzado.');
                loadMyTrips();
              } else {
                Alert.alert('Error', response.message || 'No se pudo iniciar el viaje');
              }
            } catch (error) {
              Alert.alert('Error', error.message || 'Error al iniciar el viaje');
            } finally {
              setStartingTripId(null);
            }
          },
        },
      ]
    );
  };

  const handleCompleteTrip = (tripId) => {
    setCompletingTripId(tripId);
    setActualCost('');
    setShowCostModal(true);
  };

  const submitCompleteTrip = async () => {
    const cost = parseFloat(actualCost);
    if (!actualCost || isNaN(cost) || cost <= 0) {
      Alert.alert('Error', 'Ingresa un costo valido mayor a 0');
      return;
    }

    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(completingTripId), { actualCost: cost });
      if (response.success) {
        setShowCostModal(false);
        Alert.alert('Viaje Completado', `Costo final: $${cost.toFixed(2)}`);
        loadMyTrips();
        await refreshUser();
      } else {
        Alert.alert('Error', response.message || 'No se pudo completar el viaje');
      }
    } catch (error) {
      Alert.alert('Error', error.message || 'Error al completar el viaje');
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return { color: '#10B981', bg: '#D1FAE5', text: 'Activo' };
      case 'started':
        return { color: '#F59E0B', bg: '#FEF3C7', text: 'En progreso' };
      case 'completed':
        return { color: '#3B82F6', bg: '#DBEAFE', text: 'Completado' };
      case 'cancelled':
        return { color: '#EF4444', bg: '#FEE2E2', text: 'Cancelado' };
      default:
        return { color: '#6B7280', bg: '#F3F4F6', text: status };
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const options = { weekday: 'short', day: 'numeric', month: 'short' };
    return date.toLocaleDateString('es-ES', options);
  };

  const getFilteredTrips = () => {
    const tripsArray = Array.isArray(trips) ? trips : [];
    if (activeTab === 'upcoming') {
      const filtered = tripsArray.filter(trip =>
        trip.status === 'active' || trip.status === 'started'
      );
      return filtered.sort((a, b) => {
        if (a.status === 'started' && b.status === 'active') return -1;
        if (a.status === 'active' && b.status === 'started') return 1;
        return new Date(a.departureDate) - new Date(b.departureDate);
      });
    } else {
      return tripsArray.filter(trip =>
        trip.status === 'completed' || trip.status === 'cancelled'
      );
    }
  };

  const renderTripItem = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item._id })}
        activeOpacity={0.7}
      >
        {/* Status Badge */}
        <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
          <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.text}
          </Text>
        </View>

        {/* Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={styles.routeDot} />
            <Text style={styles.cityText} numberOfLines={1}>
              {[item.origin?.address, item.origin?.city, item.origin?.province].filter(Boolean).join(', ')}
            </Text>
          </View>
          <View style={styles.routeLine} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDestination]} />
            <Text style={styles.cityText} numberOfLines={1}>
              {[item.destination?.address, item.destination?.city, item.destination?.province].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>

        {/* Trip Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{item.departureTime}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="people-outline" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{item.availableSeats} disponibles</Text>
          </View>
        </View>

        {/* Actions for Active Trips */}
        {item.status === 'active' && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate('TripRequests', { tripId: item._id })}
            >
              <Ionicons name="people" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Ver Reservas</Text>
              {item.bookingsCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.bookingsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('EditTrip', { tripId: item._id })}
              >
                <Ionicons name="create-outline" size={20} color="#374151" />
                <Text style={styles.actionButtonText}>Editar</Text>
              </TouchableOpacity>

              {item.occupiedSeats > 0 && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleStartTrip(item._id)}
                  disabled={startingTripId === item._id}
                >
                  <Ionicons name="play" size={20} color="#F59E0B" />
                  <Text style={[styles.actionButtonText, { color: '#F59E0B' }]}>
                    {startingTripId === item._id ? 'Iniciando...' : 'Iniciar'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCancelTrip(item._id)}
              >
                <Ionicons name="close" size={20} color="#EF4444" />
                <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions for Started Trips */}
        {item.status === 'started' && (
          <View style={styles.actionsSection}>
            <View style={styles.inProgressBanner}>
              <Ionicons name="car" size={18} color="#F59E0B" />
              <Text style={styles.inProgressText}>Viaje en progreso</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => handleCompleteTrip(item._id)}
            >
              <Ionicons name="checkmark-circle" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Completar Viaje</Text>
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

  const filteredTrips = getFilteredTrips();

  return (
    <View style={styles.container}>
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Proximos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Pasados
          </Text>
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
              tintColor="#000000"
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIcon}>
            <Ionicons name="car-outline" size={48} color="#9CA3AF" />
          </View>
          <Text style={styles.emptyTitle}>
            {activeTab === 'upcoming' ? 'Sin viajes proximos' : 'Sin viajes pasados'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'upcoming'
              ? 'Crea tu primer viaje y comparte gastos'
              : 'Tus viajes completados apareceran aqui'
            }
          </Text>
        </View>
      )}

      {/* Cost Modal */}
      <Modal
        visible={showCostModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCostModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Completar Viaje</Text>
            <Text style={styles.modalSubtitle}>
              Ingresa el costo real del viaje
            </Text>

            <TextInput
              style={styles.costInput}
              placeholder="Ej: 1500"
              placeholderTextColor="#9CA3AF"
              keyboardType="decimal-pad"
              value={actualCost}
              onChangeText={setActualCost}
              autoFocus
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setShowCostModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalConfirmButton}
                onPress={submitCompleteTrip}
              >
                <Text style={styles.modalConfirmText}>Completar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: '#000000',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  // List
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
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 16,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
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
  // Actions
  actionsSection: {
    paddingTop: 16,
    gap: 12,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  badge: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  // In Progress
  inProgressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FEF3C7',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  inProgressText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 20,
  },
  costInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    color: '#000000',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: '#000000',
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});

export default MyTripsScreen;
