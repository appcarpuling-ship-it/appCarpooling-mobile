import React, { useState, useEffect, useRef } from 'react';
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
import { get_withauth, put_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useColors } from '../../../hooks/useColors';

const MyTripsScreen = ({ navigation }) => {
  const { refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const { colors, isDarkMode } = useColors();
  const [trips, setTrips]           = useState([]);
  const [page, setPage]             = useState(1);
  const [hasMore, setHasMore]       = useState(true);
  const [loading, setLoading]       = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab]   = useState('upcoming');
  const fetchingRef = useRef(false);
  const [startingTripId, setStartingTripId] = useState(null);
  const [showCostModal, setShowCostModal] = useState(false);
  const [completingTripId, setCompletingTripId] = useState(null);
  const [actualCost, setActualCost] = useState('');
  const [driverPay, setDriverPay] = useState('');

  useEffect(() => {
    loadMyTrips(1, true);
  }, []);

  const loadMyTrips = async (pageNum = 1, reset = false) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const response = await get_withauth(ENDPOINTS.MY_TRIPS_DRIVER, { page: pageNum, limit: LIST_PAGE_SIZE });
      if (response.success) {
        setTrips(prev => reset ? response.data : [...prev, ...response.data]);
        setPage(pageNum);
        setHasMore(response.hasMore ?? false);
      }
    } catch (error) {
      showAlert('Error', 'No se pudieron cargar los viajes');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadMyTrips(1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadMyTrips(page + 1, false);
  };

  const formatAddress = (location) => {
    if (!location) return '';
    let raw = location.address || location.street || '';
    raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
    const city = location.city || location.name || '';
    const province = location.province || '';
    // Si raw ya contiene ciudad y provincia (ej: "Bolivia, Concordia, Entre Ríos, Argentina"), no duplicar
    const rawLower = raw.toLowerCase();
    const cityInRaw = city && rawLower.includes(city.toLowerCase());
    const provinceInRaw = province && rawLower.includes(province.toLowerCase());
    if (cityInRaw && (provinceInRaw || !province)) {
      return raw.replace(/,?\s*Argentina\s*$/i, '').replace(/,\s*$/, '').trim();
    }
    return [raw, city, province].filter(Boolean).join(', ');
  };

  // handleCancelTrip movido a TripDetailScreen

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
                loadMyTrips(1, true);
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
        loadMyTrips(1, true);
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

  // Devuelve true si la fecha del viaje es hoy (comparando solo año/mes/día)
  const isTripToday = (departureDate) => {
    if (!departureDate) return false;
    const today = new Date();
    const trip  = new Date(departureDate);
    return (
      trip.getFullYear() === today.getFullYear() &&
      trip.getMonth()    === today.getMonth()    &&
      trip.getDate()     === today.getDate()
    );
  };

  const getFilteredTrips = () => {
    const tripsArray = Array.isArray(trips) ? trips : [];
    if (activeTab === 'upcoming') {
      const filtered = tripsArray.filter(trip =>
        trip.status === 'active' || trip.status === 'started'
      );
      return filtered.sort((a, b) => {
        // 1° viajes en curso
        if (a.status === 'started' && b.status !== 'started') return -1;
        if (b.status === 'started' && a.status !== 'started') return  1;
        // 2° viajes de hoy que se pueden iniciar
        const aToday = isTripToday(a.departureDate);
        const bToday = isTripToday(b.departureDate);
        if (aToday && !bToday) return -1;
        if (bToday && !aToday) return  1;
        // 3° resto por fecha ascendente
        return new Date(a.departureDate) - new Date(b.departureDate);
      });
    } else {
      const filtered = tripsArray.filter(trip =>
        trip.status === 'completed' || trip.status === 'cancelled'
      );
      return filtered.sort((a, b) => {
        // completados antes que cancelados
        if (a.status === 'completed' && b.status === 'cancelled') return -1;
        if (a.status === 'cancelled' && b.status === 'completed') return 1;
        // mismo estado → más reciente primero
        return new Date(b.departureDate) - new Date(a.departureDate);
      });
    }
  };

  const renderTripItem = ({ item }) => {
    const { color, text: statusText } = getStatusConfig(item.status);
    const textPrimary   = isDarkMode ? '#FFFFFF' : '#000000';
    const textMuted     = isDarkMode ? '#6B7280' : '#9CA3AF';
    const cardBg        = colors.cardBackground;
    const divider       = isDarkMode ? '#2A2A2A' : '#F0F0F0';
    const accent        = textPrimary;
    const accentInv     = isDarkMode ? '#000000' : '#FFFFFF';

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg }]}
        onPress={() => navigation.navigate('TripDetailFromCarpoolings', { tripId: item._id })}
        activeOpacity={0.7}
      >
        {/* Cabecera: ruta + status pill */}
        <View style={styles.cardHeader}>
          {/* Ruta con puntos */}
          <View style={styles.routeBlock}>
            <View style={styles.routeDots}>
              <View style={[styles.dotOrigin, { borderColor: accent }]} />
              <View style={[styles.routeConnector, { backgroundColor: divider }]} />
              <View style={[styles.dotDest, { backgroundColor: accent }]} />
            </View>
            <View style={styles.routeLabels}>
              <Text style={[styles.cityText, { color: textPrimary }]} numberOfLines={1}>
                {formatAddress(item.origin)}
              </Text>
              <Text style={[styles.cityText, { color: textPrimary, marginTop: 10 }]} numberOfLines={1}>
                {formatAddress(item.destination)}
              </Text>
            </View>
          </View>

          {/* Status pill */}
          <View style={[styles.statusPill, { backgroundColor: color + '18' }]}>
            <Text style={[styles.statusPillText, { color }]}>{statusText}</Text>
          </View>
        </View>

        {/* Meta row */}
        <View style={[styles.metaRow, { borderTopColor: divider, borderBottomColor: divider }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{formatDate(item.departureDate)}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{item.departureTime}</Text>
          </View>
          <View style={[styles.metaDivider, { backgroundColor: divider }]} />
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={13} color={textMuted} />
            <Text style={[styles.metaText, { color: textMuted }]}>{item.availableSeats} disponibles</Text>
          </View>
          {activeTab === 'upcoming' && item.bookingsCount > 0 && (
            <>
              <View style={[styles.metaDivider, { backgroundColor: divider }]} />
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={13} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{item.bookingsCount} pendiente{item.bookingsCount !== 1 ? 's' : ''}</Text>
              </View>
            </>
          )}
        </View>

        {/* Botones — solo viajes activos o en curso */}
        {item.status === 'active' && (
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: accent }]}
              onPress={() => navigation.navigate('TripRequests', { tripId: item._id })}
            >
              <Text style={[styles.footerBtnText, { color: accentInv }]}>Ver reservas</Text>
              {item.bookingsCount > 0 && (
                <View style={[styles.footerBadge, { backgroundColor: accentInv }]}>
                  <Text style={[styles.footerBadgeText, { color: accent }]}>{item.bookingsCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {item.occupiedSeats > 0 && isTripToday(item.departureDate) && (
              <TouchableOpacity
                style={[styles.footerBtnOutline, { borderColor: divider }]}
                onPress={() => handleStartTrip(item._id)}
                disabled={startingTripId === item._id}
              >
                <Ionicons name="play-circle-outline" size={15} color={textPrimary} />
                <Text style={[styles.footerBtnOutlineText, { color: textPrimary }]}>
                  {startingTripId === item._id ? 'Iniciando…' : 'Iniciar'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {item.status === 'started' && (
          <View style={styles.footerRow}>
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: accent, flex: 1 }]}
              onPress={() => handleCompleteTrip(item._id)}
            >
              <Ionicons name="checkmark-circle-outline" size={15} color={accentInv} />
              <Text style={[styles.footerBtnText, { color: accentInv }]}>Completar viaje</Text>
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

  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Tabs — estilo subrayado */}
      <View style={[styles.tabsContainer, { borderBottomColor: divider }]}>
        {['upcoming', 'past'].map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && { borderBottomColor: textPrimary, borderBottomWidth: 2 }]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, { color: activeTab === tab ? textPrimary : textMuted }]}>
              {tab === 'upcoming' ? 'Próximos' : 'Pasados'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Trips List */}
      {filteredTrips.length > 0 ? (
        <FlatList
          data={filteredTrips}
          renderItem={renderTripItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textPrimary} />
          }
              ListFooterComponent={
                loadingMore ? (
                  <View style={{ paddingVertical: 20, alignItems: 'center', gap: 8 }}>
                    <ActivityIndicator size="small" color={textMuted} />
                    <Text style={{ fontSize: 13, color: textMuted }}>Cargando más…</Text>
                  </View>
                ) : null
              }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Ionicons name="car-outline" size={40} color={textMuted} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>
            {activeTab === 'upcoming' ? 'Sin viajes próximos' : 'Sin viajes pasados'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            {activeTab === 'upcoming'
              ? 'Creá tu primer viaje y compartí gastos'
              : 'Tus viajes completados aparecerán aquí'}
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
  container:      { flex: 1 },
  centerContainer:{ flex: 1, justifyContent: 'center', alignItems: 'center' },

  // Tabs — estilo subrayado
  tabsContainer: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: { fontSize: 14, fontWeight: '600' },

  listContent: { padding: 16, gap: 12 },

  // Card
  card: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },

  // Cabecera: ruta + pill
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingBottom: 12,
    gap: 12,
  },
  routeBlock: { flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' },
  routeDots:  { width: 14, alignItems: 'center', paddingVertical: 2 },
  dotOrigin: {
    width: 9, height: 9, borderRadius: 5, borderWidth: 2,
  },
  routeConnector: { width: 1.5, height: 16, marginVertical: 2 },
  dotDest:   { width: 9, height: 9, borderRadius: 2 },
  routeLabels: { flex: 1 },
  cityText:  { fontSize: 14, fontWeight: '600' },

  // Status pill
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'center',
    flexShrink: 0,
  },
  statusPillText: { fontSize: 11, fontWeight: '600' },

  // Meta row
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  metaItem:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText:    { fontSize: 12 },
  metaDivider: { width: 1, height: 12 },

  // Footer botones
  footerRow: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  footerBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    borderRadius: 10,
    gap: 6,
  },
  footerBtnText: { fontSize: 13, fontWeight: '600' },
  footerBadge: {
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  footerBadgeText: { fontSize: 10, fontWeight: '700' },
  footerBtnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 11,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 5,
  },
  footerBtnOutlineText: { fontSize: 13, fontWeight: '500' },

  // Empty
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    gap: 10, padding: 32,
  },
  emptyTitle:    { fontSize: 16, fontWeight: '600', marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent:   { borderRadius: 16, padding: 24, width: '100%', maxWidth: 400 },
  modalTitle:     { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  modalSubtitle:  { fontSize: 14, marginBottom: 20 },
  costInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    marginBottom: 20,
  },
  modalActions:       { flexDirection: 'row', gap: 12 },
  modalCancelButton:  { flex: 1, paddingVertical: 14, borderRadius: 8, borderWidth: 1, alignItems: 'center' },
  modalCancelText:    { fontSize: 15, fontWeight: '600' },
  modalConfirmButton: { flex: 1, paddingVertical: 14, borderRadius: 8, alignItems: 'center' },
  modalConfirmText:   { fontSize: 15, fontWeight: '600' },
});

export default MyTripsScreen;
