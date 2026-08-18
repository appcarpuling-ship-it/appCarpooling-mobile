import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  RefreshControl,
  Modal,
  ScrollView,
  Platform,
  Image,
  Dimensions,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { get_public, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { tripDisplaySeats } from '../../../utils/tripSeatsDisplay';
import { useUI } from '../../../theme/ui';
import EmptyState from '../../../components/ui/EmptyState';
import { reportError } from '../../../utils/sentry';

const AllTripsScreen = ({ navigation }) => {
  const ui = useUI();
  const { colors, createColorArray } = useColors();
  const { isDarkMode } = useTheme();

  const [trips, setTrips] = useState([]);
  const [totalTrips, setTotalTrips] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadMoreLock = useRef(false);

  // Filters
  const [originProvince, setOriginProvince] = useState('');
  const [originCity, setOriginCity] = useState('');
  const [destinationProvince, setDestinationProvince] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [minAvailableSeats, setMinAvailableSeats] = useState('');

  // Picker modals
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSeatsPicker, setShowSeatsPicker] = useState(false);
  const [tempDate, setTempDate] = useState(null);
  const [tempTime, setTempTime] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const loadPage = useCallback(
    async (pageNum, { append = false, isRefresh = false } = {}) => {
      if (append) {
        if (loadMoreLock.current) return;
        loadMoreLock.current = true;
        setLoadingMore(true);
      } else if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const useSearch = !!(
        originProvince ||
        originCity ||
        destinationProvince ||
        destinationCity ||
        selectedDate ||
        selectedTime ||
        minAvailableSeats
      );

      const params = { page: pageNum, limit: LIST_PAGE_SIZE };
      if (useSearch) {
        if (originProvince) params.originProvince = originProvince;
        if (originCity) params.originCity = originCity;
        if (destinationProvince) params.destinationProvince = destinationProvince;
        if (destinationCity) params.destinationCity = destinationCity;
        if (selectedDate) {
          const y = selectedDate.getFullYear();
          const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
          const d = String(selectedDate.getDate()).padStart(2, '0');
          params.date = `${y}-${m}-${d}`;
        }
        if (selectedTime) {
          const pad = (n) => String(n).padStart(2, '0');
          params.departureTime = `${pad(selectedTime.getHours())}:${pad(selectedTime.getMinutes())}`;
        }
        if (minAvailableSeats) {
          const n = parseInt(String(minAvailableSeats).replace(/\+$/, ''), 10);
          if (!Number.isNaN(n) && n > 0) params.seats = n;
        }
      }

      const endpoint = useSearch ? ENDPOINTS.SEARCH_TRIPS : ENDPOINTS.GET_TRIPS;

      try {
        const response = await get_public(endpoint, params);
        if (response.success && Array.isArray(response.data)) {
          const rows = response.data;
          const total = typeof response.total === 'number' ? response.total : rows.length;
          const more = response.hasMore === true;
          if (append) {
            setTrips((prev) => [...prev, ...rows]);
          } else {
            setTrips(rows);
          }
          setTotalTrips(total);
          setHasMore(more);
          setListPage(pageNum);
        } else if (!append) {
          setTrips([]);
          setTotalTrips(0);
          setHasMore(false);
          setListPage(1);
        }
      } catch (error) {
        console.error('Error loading trips:', error);
        reportError(error, { screen: 'AllTripsScreen', action: 'loadTrips' });
        if (!append) {
          setTrips([]);
          setTotalTrips(0);
          setHasMore(false);
          setListPage(1);
        }
      } finally {
        loadMoreLock.current = false;
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [originProvince, originCity, destinationProvince, destinationCity, selectedDate, selectedTime, minAvailableSeats],
  );

  useEffect(() => {
    loadPage(1, {});
  }, [loadPage]);

  const loadMoreTrips = useCallback(() => {
    if (!hasMore || loadingMore || loading || refreshing) return;
    loadPage(listPage + 1, { append: true });
  }, [hasMore, loadingMore, loading, refreshing, listPage, loadPage]);

  const onRefresh = useCallback(() => {
    loadPage(1, { isRefresh: true });
  }, [loadPage]);

  const hasActiveFilters = originProvince || originCity || destinationProvince || destinationCity || selectedDate || selectedTime || minAvailableSeats;

  const clearFilters = () => {
    setOriginProvince('');
    setOriginCity('');
    setDestinationProvince('');
    setDestinationCity('');
    setSelectedDate(null);
    setSelectedTime(null);
    setMinAvailableSeats('');
  };

  const seatOptions = ['1+', '2+', '3+', '4+'];

  const handleTimeChange = (event, time) => {
    if (Platform.OS === 'android') {
      setShowTimePicker(false);
      if (event.type === 'set' && time) {
        setSelectedTime(time);
      }
      return;
    }
    if (time) {
      setTempTime(time);
    }
  };

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (event.type === 'set' && date) {
        setSelectedDate(date);
      }
      return;
    }
    if (date) {
      setTempDate(date);
    }
  };

  const renderTripItem = useCallback(
    ({ item }) => {
      const driver = item.driver || {};
      const formatAddress = (location) => {
        if (!location) return 'Dirección no disponible';
        
        let raw = location.street || location.address || '';
        // Quitar códigos postales argentinos (ej: E3205CUP, E3202, E3202ARN)
        raw = raw.replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
        
        const city = location.city || location.name || '';
        const province = location.province || '';
        
        let address = '';
        if (raw) {
          address = raw;
        } else if (city) {
          address = city;
        }
        
        if (province && address && !address.includes(province)) {
          address += `, ${province}`;
        } else if (province && !address) {
          address = province;
        }
        
        return address || 'Dirección no disponible';
      };
      
      const originAddress = formatAddress(item.origin);
      const destAddress = formatAddress(item.destination);
      const freeSeats = tripDisplaySeats(item);

      return (
        <TouchableOpacity
          style={[styles.tripCard, { backgroundColor: ui.surface, borderColor: ui.border }]}
          onPress={() => navigation.navigate('TripDetail', { tripId: item._id })}
          activeOpacity={0.7}
        >
          <View style={styles.cardGradient}>
            <View style={styles.tripHeader}>
              <View style={styles.routeRow}>
                <Text style={[styles.addressText, { color: ui.text }]} numberOfLines={2}>{originAddress}</Text>
                <Ionicons name="arrow-forward" size={18} color={ui.textMuted} style={styles.arrowIcon} />
                <Text style={[styles.addressText, { color: ui.text }]} numberOfLines={2}>{destAddress}</Text>
              </View>
            </View>

            {/* El precio del conductor, que es fijo del viaje (a diferencia del de la conexión,
                que depende de dónde suba cada pasajero) y es con lo que se compara un viaje
                contra otro. Por eso vuelve al listado, donde antes estaba comentado. */}
            {item.driverPrice > 0 && (
              <Text style={[styles.addressText, { color: ui.text, marginTop: 4 }]}>
                ${Number(item.driverPrice).toLocaleString('es-AR')}
                <Text style={{ color: ui.textMuted, fontSize: 12 }}> por asiento</Text>
              </Text>
            )}

            <View style={styles.driverRow}>
              <View style={styles.avatarContainer}>
                {driver.avatar ? (
                  <Image
                    source={{ uri: buildImageUri(driver.avatar) }}
                    style={[styles.avatarImage, { borderColor: ui.border }]}
                    defaultSource={require('../../../../assets/logo/192x192-black.png')}
                  />
                ) : (
                  <View style={[styles.avatarSmall, { backgroundColor: ui.invertBg }]}>
                    <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
                      {driver.firstName?.[0]}{driver.lastName?.[0]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.driverName, { color: ui.textMuted }]} numberOfLines={1}>
                {driver.firstName || 'Conductor'} {driver.lastName || ''}
              </Text>
            </View>

            <View style={[styles.tripMeta, { borderTopColor: ui.border }]}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={ui.textMuted} />
                <Text style={[styles.metaText, { color: ui.textMuted }]}>
                  {item.departureDate
                    ? new Date(item.departureDate).toLocaleDateString('es-ES')
                    : 'Sin fecha'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={ui.textMuted} />
                <Text style={[styles.metaText, { color: ui.textMuted }]}>{item.departureTime || 'Sin hora'}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color={ui.textMuted} />
                <Text style={[styles.metaText, { color: ui.textMuted }]}>
                  {freeSeats === 0 ? 'Completo' : `${freeSeats} disponible${freeSeats !== 1 ? 's' : ''}`}
                </Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      );
    },
    [isDarkMode, navigation],
  );

  const renderTimeRangeModal = () => {
    if (!showTimePicker) return null;

    // Android: solo el picker nativo (ya es un diálogo)
    if (Platform.OS === 'android') {
      return (
        <DateTimePicker
          value={tempTime || selectedTime || new Date()}
          mode="time"
          display="default"
          onChange={handleTimeChange}
        />
      );
    }

    // iOS: modal con spinner + botones
    return (
      <Modal transparent animationType="fade" visible={showTimePicker} onRequestClose={() => { setTempTime(null); setShowTimePicker(false); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pickerContainer, { backgroundColor: ui.surface }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: ui.border }]}>
              <Text style={[styles.pickerTitle, { color: ui.text }]}>Seleccionar Hora</Text>
              <TouchableOpacity onPress={() => { setTempTime(null); setShowTimePicker(false); }}>
                <Ionicons name="close" size={24} color={ui.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.datePickerWrapper, { backgroundColor: ui.surface }]}>
              <DateTimePicker
                value={tempTime || selectedTime || new Date()}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                textColor={ui.text}
                themeVariant={isDarkMode ? 'dark' : 'light'}
              />
            </View>
            <View style={styles.pickerButtons}>
              <TouchableOpacity
                style={[styles.pickerButton, { borderColor: ui.border }]}
                onPress={() => {
                  setSelectedTime(null);
                  setTempTime(null);
                  setShowTimePicker(false);
                }}
              >
                <Text style={[styles.pickerButtonText, { color: ui.textMuted }]}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }]}
                onPress={() => {
                  if (tempTime) {
                    setSelectedTime(tempTime);
                  }
                  setTempTime(null);
                  setShowTimePicker(false);
                }}
              >
                <Text style={[styles.pickerButtonConfirmText, { color: ui.invertText }]}>Confirmar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderSeatsModal = () => (
    <Modal transparent animationType="fade" visible={showSeatsPicker} onRequestClose={() => setShowSeatsPicker(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: ui.surface }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: ui.border }]}>
            <Text style={[styles.pickerTitle, { color: ui.text }]}>Lugares Disponibles</Text>
            <TouchableOpacity onPress={() => setShowSeatsPicker(false)}>
              <Ionicons name="close" size={24} color={ui.text} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.provinceList}>
            {seatOptions.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => {
                  setMinAvailableSeats(option);
                  setShowSeatsPicker(false);
                }}
                style={[
                  styles.provinceOption,
                  { borderBottomColor: ui.border },
                  minAvailableSeats === option && { backgroundColor: ui.surface },
                ]}
              >
                <Text
                  style={[
                    styles.provinceOptionText,
                    { color: ui.textMuted },
                    minAvailableSeats === option && { color: ui.invertBg, fontWeight: '600' },
                  ]}
                >
                  {option === '1+' ? '1 o más lugares' :
                   option === '2+' ? '2 o más lugares' :
                   option === '3+' ? '3 o más lugares' :
                   '4 o más lugares'}
                </Text>
                {minAvailableSeats === option && (
                  <Ionicons name="checkmark" size={20} color={ui.invertBg} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          <View style={styles.screenHeader}>
            <Text style={[styles.screenTitle, { color: ui.text }]}>
              Todos los{'\n'}
              <Text style={styles.screenTitleStrong}>viajes</Text>
            </Text>
          </View>

          {/* Filters */}
          <View style={styles.filtersSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              {/* Origin */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                  (originProvince || originCity) && { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => navigation.navigate('LocationPicker', {
                  title: 'Provincia de origen',
                  province: originProvince,
                  city: originCity,
                  onSelect: ({ province, city }) => { setOriginProvince(province); setOriginCity(city); },
                })}
                activeOpacity={0.7}
              >
                <Ionicons name="radio-button-on" size={14} color={(originProvince || originCity) ? (ui.invertText) : (ui.textMuted)} />
                <Text style={[
                  styles.filterChipText,
                  { color: ui.textMuted },
                  (originProvince || originCity) && { color: ui.invertText }
                ]} numberOfLines={1}>
                  {originCity || originProvince || 'Origen'}
                </Text>
              </TouchableOpacity>

              {/* Destination */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                  (destinationProvince || destinationCity) && { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => navigation.navigate('LocationPicker', {
                  title: 'Provincia de destino',
                  province: destinationProvince,
                  city: destinationCity,
                  onSelect: ({ province, city }) => { setDestinationProvince(province); setDestinationCity(city); },
                })}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={14} color={(destinationProvince || destinationCity) ? (ui.invertText) : (ui.textMuted)} />
                <Text style={[
                  styles.filterChipText,
                  { color: ui.textMuted },
                  (destinationProvince || destinationCity) && { color: ui.invertText }
                ]} numberOfLines={1}>
                  {destinationCity || destinationProvince || 'Destino'}
                </Text>
              </TouchableOpacity>

              {/* Date */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                  selectedDate && { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => {
                  setTempDate(selectedDate || new Date());
                  setShowDatePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={selectedDate ? (ui.invertText) : (ui.textMuted)} />
                <Text style={[
                  styles.filterChipText,
                  { color: ui.textMuted },
                  selectedDate && { color: ui.invertText }
                ]}>
                  {selectedDate ? selectedDate.toLocaleDateString('es-ES') : 'Fecha'}
                </Text>
              </TouchableOpacity>

              {/* Time Range */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                  selectedTime && { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => {
                  setTempTime(selectedTime || new Date());
                  setShowTimePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={14} color={selectedTime ? (ui.invertText) : (ui.textMuted)} />
                <Text style={[
                  styles.filterChipText,
                  { color: ui.textMuted },
                  selectedTime && { color: ui.invertText }
                ]}>
                  {selectedTime ? selectedTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Hora'}
                </Text>
              </TouchableOpacity>

              {/* Available Seats */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: ui.surface, borderColor: ui.border },
                  minAvailableSeats && { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => setShowSeatsPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={14} color={minAvailableSeats ? (ui.invertText) : (ui.textMuted)} />
                <Text style={[
                  styles.filterChipText,
                  { color: ui.textMuted },
                  minAvailableSeats && { color: ui.invertText }
                ]}>
                  {minAvailableSeats ? `${minAvailableSeats} lugares` : 'Asientos'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Fila siempre visible: resultados + Limpiar filtros */}
            <View style={styles.resultsRow}>
              <Text style={[styles.resultsCount, { color: ui.textMuted }]}>
                {totalTrips} viaje{totalTrips !== 1 ? 's' : ''} encontrado{totalTrips !== 1 ? 's' : ''}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={16} color={isDarkMode ? ui.textMuted : ui.textMuted} />
                  <Text style={[styles.clearFiltersButtonText, { color: isDarkMode ? ui.textMuted : ui.textMuted }]}>Limpiar filtros</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Trip List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={ui.invertBg} />
              <Text style={[styles.loadingText, { color: ui.textMuted }]}>Cargando viajes...</Text>
            </View>
          ) : (
            <FlatList
              data={trips}
              renderItem={renderTripItem}
              keyExtractor={(item) => String(item._id)}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={ui.invertBg}
                  colors={[ui.invertBg]}
                />
              }
              onEndReached={loadMoreTrips}
              onEndReachedThreshold={0.35}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.listFooterLoader}>
                    <ActivityIndicator size="small" color={ui.invertBg} />
                    <Text style={[styles.listFooterHint, { color: ui.textMuted }]}>Cargando más…</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <EmptyState
                    image={require('../../../../assets/icons/pngwing.com (7).png')}
                    title="No se encontraron viajes"
                    subtitle={hasActiveFilters ? 'Intenta ajustar los filtros' : 'No hay viajes disponibles por el momento'}
                    actionLabel={hasActiveFilters ? 'Limpiar filtros' : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                  />
                </View>
              }
            />
          )}
        </Animated.View>

        {/* Time Range Modal */}
        {renderTimeRangeModal()}

        {/* Seats Modal */}
        {renderSeatsModal()}

        {/* Date Picker */}
        {showDatePicker && Platform.OS === 'android' && (
          <DateTimePicker
            value={tempDate || selectedDate || new Date()}
            mode="date"
            display="default"
            onChange={handleDateChange}
            minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
          />
        )}
        {showDatePicker && Platform.OS === 'ios' && (
          <Modal transparent animationType="fade" onRequestClose={() => { setTempDate(null); setShowDatePicker(false); }}>
            <View style={styles.modalOverlay}>
              <View style={[styles.pickerContainer, { backgroundColor: ui.surface }]}>
                <View style={[styles.pickerHeader, { borderBottomColor: ui.border }]}>
                  <Text style={[styles.pickerTitle, { color: ui.text }]}>Seleccionar Fecha</Text>
                  <TouchableOpacity onPress={() => { setTempDate(null); setShowDatePicker(false); }}>
                    <Ionicons name="close" size={24} color={ui.text} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.datePickerWrapper, { backgroundColor: ui.surface }]}>
                  <DateTimePicker
                    value={tempDate || selectedDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                    textColor={ui.text}
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                  />
                </View>
                <View style={styles.pickerButtons}>
                  <TouchableOpacity
                    style={[styles.pickerButton, { borderColor: ui.border }]}
                    onPress={() => {
                      setSelectedDate(null);
                      setTempDate(null);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerButtonText, { color: ui.textMuted }]}>Limpiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerButton, { backgroundColor: ui.invertBg, borderColor: isDarkMode ? 'transparent' : '#000000' }]}
                    onPress={() => {
                      if (tempDate) {
                        setSelectedDate(tempDate);
                      }
                      setTempDate(null);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerButtonConfirmText, { color: ui.invertText }]}>Confirmar</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  gradient: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    marginTop: spacing.md,
    fontSize: fontSize.md,
  },

  // Filters
  screenHeader:      { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 22 },
  screenTitle:       { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  screenTitleStrong: { fontFamily: 'Sora_800ExtraBold' },
  filtersSection: {
    paddingBottom: spacing.md,
  },
  filtersRow: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.full || 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 6,
    maxWidth: 160,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  resultsCount: {
    fontSize: fontSize.xs,
    color: '#6B7280',
  },
  clearFiltersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  clearFiltersButtonText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
  },

  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl + 8,
    flexGrow: 1,
  },
  cardSeparator: {
    height: 14,
  },
  listFooterLoader: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  listFooterHint: { fontSize: 13 },

  // Trip Card
  tripCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  cardGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 8,
  },
  addressText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
    color: '#000000',
    flex: 1,
    lineHeight: 18,
  },
  arrowIcon: {
    marginTop: 2,
    alignSelf: 'flex-start',
  },
  priceText: {
    fontSize: fontSize.lg,
    fontFamily: 'Sora_700Bold',
    color: '#000000',
    marginLeft: spacing.sm,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatarContainer: {
    marginRight: spacing.xs,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  avatarText: {
    color: '#F3F4F6',
    fontSize: fontSize.xs,
    fontFamily: 'Sora_700Bold',
  },
  driverName: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
    color: '#374151',
    flex: 1,
  },
  tripMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    color: '#6B7280',
  },

  // Empty
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontFamily: 'Sora_600SemiBold',
    color: '#374151',
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  clearButton: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  clearButtonText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  provinceList: {
    maxHeight: 400,
  },
  provinceOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  deptAllItem: {
    marginHorizontal: 16,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  provinceGridItem: {
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 10,
  },
  provinceGridImage: {
    width: 96,
    height: 96,
    marginBottom: 10,
  },
  provinceGridAllIcon: {
    width: 96,
    height: 96,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  provinceGridLabel: {
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 17,
  },
  provinceGridCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    borderRadius: 20,
    width: '96%',
    maxHeight: '90%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  pickerTitle: {
    fontSize: 17,
    fontFamily: 'Sora_600SemiBold',
  },
  provinceOptionText: {
    fontSize: fontSize.md,
    flex: 1,
  },
  datePickerWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md,
    alignItems: 'center', // centra el spinner de fecha/hora horizontalmente
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg, // los botones no tocan los bordes de la card
  },
  pickerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pickerButtonText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    fontFamily: 'Sora_500Medium',
  },
  pickerButtonConfirmText: {
    fontSize: fontSize.md,
    color: '#FFFFFF',
    fontFamily: 'Sora_500Medium',
  },
});

export default AllTripsScreen;
