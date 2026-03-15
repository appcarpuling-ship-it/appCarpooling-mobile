import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, put_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';
import socketService from '../../services/socketService';

const MyTripsScreen = ({ navigation }) => {
  const { refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useColors();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('upcoming');
  const [startingTripId, setStartingTripId] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [completingTripId, setCompletingTripId] = useState(null);
  const [actualCost, setActualCost] = useState('');
  const [driverPay, setDriverPay] = useState('');

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
      showAlert('Error', 'No se pudieron cargar los viajes');
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
    showAlert(
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
                showAlert('Viaje Cancelado', 'El viaje ha sido cancelado.', [
                  { text: 'OK', onPress: () => { loadMyTrips(); refreshUser(); } }
                ]);
              } else {
                showAlert('Error', response.message || 'No se pudo cancelar el viaje');
              }
            } catch (error) {
              showAlert('Error', error.message || 'Error al cancelar el viaje');
            }
          },
        },
      ]
    );
  };

  const handleStartTrip = (tripId) => {
    showAlert(
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
                showAlert('Viaje Iniciado', 'El viaje ha comenzado.');
                loadMyTrips();
              } else {
                showAlert('Error', response.message || 'No se pudo iniciar el viaje');
              }
            } catch (error) {
              showAlert('Error', error.message || 'Error al iniciar el viaje');
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
    setDriverPay('');
    setShowCostModal(true);
  };

  const formatNumber = (num) => {
    if (typeof num !== 'number') num = parseFloat(num);
    if (isNaN(num)) return num;
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const submitCompleteTrip = async () => {
    const cost = parseFloat(actualCost);
    if (!actualCost || isNaN(cost) || cost <= 0) {
      showAlert('Error', 'Ingresa un costo valido mayor a 0');
      return;
    }
    const pay = parseFloat(driverPay) || 0;

    try {
      const response = await put_withauth(ENDPOINTS.COMPLETE_TRIP(completingTripId), { actualCost: cost, driverPay: pay });
      if (response.success) {
        setShowCostModal(false);
        const total = cost + pay;
        showAlert('Viaje Completado', pay > 0 ? `Costo: $${formatNumber(cost)} + Tu paga: $${formatNumber(pay)} = $${formatNumber(total)}` : `Costo final: $${formatNumber(cost)}`);
        loadMyTrips();
        await refreshUser();
      } else {
        showAlert('Error', response.message || 'No se pudo completar el viaje');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al completar el viaje');
    }
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'active':
        return { color: isDarkMode ? '#34D399' : '#10B981', bg: isDarkMode ? '#064E3B' : '#D1FAE5', text: 'Activo' };
      case 'started':
        return { color: isDarkMode ? '#FBBF24' : '#F59E0B', bg: isDarkMode ? '#78350F' : '#FEF3C7', text: 'Viaje iniciado' };
      case 'completed':
        return { color: isDarkMode ? '#60A5FA' : '#3B82F6', bg: isDarkMode ? '#1E3A5F' : '#DBEAFE', text: 'Completado' };
      case 'cancelled':
        return { color: isDarkMode ? '#F87171' : '#EF4444', bg: isDarkMode ? '#7F1D1D' : '#FEE2E2', text: 'Cancelado' };
      default:
        return { color: colors.textTertiary, bg: colors.borderLight, text: status };
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
      const filtered = tripsArray.filter(trip =>
        trip.status === 'completed' || trip.status === 'cancelled'
      );
      return filtered.sort((a, b) => new Date(b.departureDate) - new Date(a.departureDate));
    }
  };

  const renderTripItem = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: colors.border }]}
        onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item._id })}
        activeOpacity={0.7}
      >
        {/* Status Badge */}
        <View style={styles.statusContainer}>
          <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
            <View style={[styles.statusDot, { backgroundColor: statusConfig.color }]} />
            <Text style={[styles.statusText, { color: statusConfig.color }]}>
              {statusConfig.text}
            </Text>
          </View>

          {/* Reservas pendientes badge - solo para trips próximos con reservas */}
          {activeTab === 'upcoming' && item.passengers && item.passengers.length > 0 && (
            <View style={[styles.pendingBadge, { backgroundColor: isDarkMode ? '#312E81' : '#EEF2FF' }]}>
              <Ionicons name="person" size={10} color={isDarkMode ? '#A5B4FC' : '#6366F1'} />
              <Text style={[styles.pendingBadgeText, { color: isDarkMode ? '#A5B4FC' : '#6366F1' }]}>{item.passengers.length}</Text>
            </View>
          )}
        </View>

        {/* Route */}
        <View style={styles.routeSection}>
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, { backgroundColor: colors.textPrimary }]} />
            <Text style={[styles.cityText, { color: colors.textPrimary }]} numberOfLines={1}>
              {[item.origin?.address, item.origin?.city, item.origin?.province].filter(Boolean).join(', ')}
            </Text>
          </View>
          <View style={[styles.routeLine, { backgroundColor: colors.border }]} />
          <View style={styles.routeRow}>
            <View style={[styles.routeDot, styles.routeDotDestination, { backgroundColor: colors.background, borderColor: colors.textPrimary }]} />
            <Text style={[styles.cityText, { color: colors.textPrimary }]} numberOfLines={1}>
              {[item.destination?.address, item.destination?.city, item.destination?.province].filter(Boolean).join(', ')}
            </Text>
          </View>
        </View>

        {/* Trip Info */}
        <View style={[styles.infoSection, { borderBottomColor: colors.borderLight }]}>
          <View style={styles.infoItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.infoText, { color: colors.textTertiary }]}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.infoText, { color: colors.textTertiary }]}>{item.departureTime}</Text>
          </View>
          <View style={styles.infoItem}>
            <Ionicons name="people-outline" size={16} color={colors.textTertiary} />
            <Text style={[styles.infoText, { color: colors.textTertiary }]}>{item.availableSeats} disponibles</Text>
          </View>
        </View>

        {/* Actions for Active Trips */}
        {item.status === 'active' && (
          <View style={styles.actionsSection}>
            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.textPrimary }]}
              onPress={() => navigation.navigate('TripRequests', { tripId: item._id })}
            >
              <Ionicons name="people" size={18} color={colors.background} />
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Ver Reservas</Text>
              {item.passengers && item.passengers.length > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.background }]}>
                  <Text style={[styles.badgeText, { color: colors.textPrimary }]}>{item.passengers.length}</Text>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.secondaryActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => navigation.navigate('EditTrip', { tripId: item._id })}
              >
                <Ionicons name="create-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.actionButtonText, { color: colors.textSecondary }]}>Editar</Text>
              </TouchableOpacity>

              {item.occupiedSeats > 0 && (
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleStartTrip(item._id)}
                  disabled={startingTripId === item._id}
                >
                  <Ionicons name="play" size={20} color={colors.warning} />
                  <Text style={[styles.actionButtonText, { color: colors.warning }]}>
                    {startingTripId === item._id ? 'Iniciando...' : 'Iniciar'}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleCancelTrip(item._id)}
              >
                <Ionicons name="close" size={20} color={colors.error} />
                <Text style={[styles.actionButtonText, { color: colors.error }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Actions for Started Trips */}
        {item.status === 'started' && (
          <View style={styles.actionsSection}>
            <View style={[styles.inProgressBanner, { backgroundColor: isDarkMode ? '#78350F' : '#FEF3C7' }]}>
              <Ionicons name="car" size={18} color={colors.warning} />
              <Text style={[styles.inProgressText, { color: isDarkMode ? '#FBBF24' : '#92400E' }]}>Viaje en progreso</Text>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, { backgroundColor: colors.textPrimary }]}
              onPress={() => handleCompleteTrip(item._id)}
            >
              <Ionicons name="checkmark-circle" size={18} color={colors.background} />
              <Text style={[styles.primaryButtonText, { color: colors.background }]}>Completar Viaje</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  const filteredTrips = getFilteredTrips();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tabs */}
      <View style={[styles.tabsContainer, { backgroundColor: colors.background, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: isDarkMode ? '#292929' : colors.borderLight }, activeTab === 'upcoming' && { backgroundColor: colors.textPrimary }]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, { color: colors.textTertiary }, activeTab === 'upcoming' && { color: colors.background }]}>
            Proximos
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, { backgroundColor: isDarkMode ? '#292929' : colors.borderLight }, activeTab === 'past' && { backgroundColor: colors.textPrimary }]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, { color: colors.textTertiary }, activeTab === 'past' && { color: colors.background }]}>
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
              tintColor={colors.textPrimary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.borderLight }]}>
            <Ionicons name="car-outline" size={48} color={colors.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
            {activeTab === 'upcoming' ? 'Sin viajes proximos' : 'Sin viajes pasados'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: colors.textTertiary }]}>
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
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Completar Viaje</Text>
            <Text style={[styles.modalSubtitle, { color: colors.textTertiary }]}>
              Ingresa el costo real del viaje
            </Text>

            <TextInput
              style={[styles.costInput, { borderColor: colors.inputBorder, color: colors.textPrimary, backgroundColor: colors.inputBackground }]}
              placeholder="Ej: 1500"
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              value={actualCost}
              onChangeText={setActualCost}
              autoFocus
            />

            <Text style={[styles.modalSubtitle, { color: colors.textTertiary, marginTop: 12 }]}>
              Contribución extra (tu paga)
            </Text>
            <TextInput
              style={[styles.costInput, { borderColor: colors.inputBorder, color: colors.textPrimary, backgroundColor: colors.inputBackground, marginTop: 4 }]}
              placeholder={actualCost ? `Ej: ${Math.round(parseFloat(actualCost) * 0.15)} (~15%)` : 'Ej: 500'}
              placeholderTextColor={colors.placeholder}
              keyboardType="decimal-pad"
              value={driverPay}
              onChangeText={setDriverPay}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelButton, { borderColor: colors.border }]}
                onPress={() => setShowCostModal(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textTertiary }]}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalConfirmButton, { backgroundColor: colors.textPrimary }]}
                onPress={submitCompleteTrip}
              >
                <Text style={[styles.modalConfirmText, { color: colors.background }]}>Completar</Text>
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
    gap: 12,
    borderBottomWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // List
  listContent: {
    padding: 16,
  },
  // Card
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  // Status
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginBottom: 16,
    gap: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
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
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  pendingBadgeText: {
    fontSize: 10,
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
  },
  routeDotDestination: {
    borderWidth: 2,
  },
  routeLine: {
    width: 2,
    height: 20,
    marginLeft: 4,
    marginVertical: 4,
  },
  cityText: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  // Info
  infoSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  infoText: {
    fontSize: 14,
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
    paddingVertical: 14,
    borderRadius: 8,
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  badge: {
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
  },
  // In Progress
  inProgressBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  inProgressText: {
    fontSize: 14,
    fontWeight: '600',
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  costInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
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
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  modalConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default MyTripsScreen;
