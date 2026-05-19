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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_public, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { ARGENTINA_PROVINCES } from '../../../constants/provinces';
import { spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { tripRemainingSeats } from '../../../utils/tripSeatsDisplay';

const AllTripsScreen = ({ navigation }) => {
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
  const [destinationProvince, setDestinationProvince] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [minAvailableSeats, setMinAvailableSeats] = useState('');

  // Picker modals
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
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
        destinationProvince ||
        selectedDate ||
        selectedTime ||
        minAvailableSeats
      );

      const params = { page: pageNum, limit: LIST_PAGE_SIZE };
      if (useSearch) {
        if (originProvince) params.originProvince = originProvince;
        if (destinationProvince) params.destinationProvince = destinationProvince;
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
    [originProvince, destinationProvince, selectedDate, selectedTime, minAvailableSeats],
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

  const hasActiveFilters = originProvince || destinationProvince || selectedDate || selectedTime || minAvailableSeats;

  const clearFilters = () => {
    setOriginProvince('');
    setDestinationProvince('');
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
      const freeSeats = tripRemainingSeats(item);

      return (
        <TouchableOpacity
          style={[styles.tripCard, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E5E7EB' }]}
          onPress={() => navigation.navigate('TripDetail', { tripId: item._id })}
          activeOpacity={0.7}
        >
          <View style={styles.cardGradient}>
            <View style={styles.tripHeader}>
              <View style={styles.routeRow}>
                <Text style={[styles.addressText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]} numberOfLines={2}>{originAddress}</Text>
                <Ionicons name="arrow-forward" size={18} color={isDarkMode ? '#9CA3AF' : '#6B7280'} style={styles.arrowIcon} />
                <Text style={[styles.addressText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]} numberOfLines={2}>{destAddress}</Text>
              </View>
              {/* <Text style={styles.priceText}>
                {item.pricePerSeat ? `$${item.pricePerSeat}` : 'Gratis'}
              </Text> */}
            </View>

            <View style={styles.driverRow}>
              <View style={styles.avatarContainer}>
                {driver.avatar ? (
                  <Image
                    source={{ uri: buildImageUri(driver.avatar) }}
                    style={[styles.avatarImage, { borderColor: isDarkMode ? '#404040' : '#E5E7EB' }]}
                    defaultSource={require('../../../../assets/logo/192x192-black.png')}
                  />
                ) : (
                  <View style={[styles.avatarSmall, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}>
                    <Text style={[styles.avatarText, { color: '#FFFFFF' }]}>
                      {driver.firstName?.[0]}{driver.lastName?.[0]}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={[styles.driverName, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]} numberOfLines={1}>
                {driver.firstName || 'Conductor'} {driver.lastName || ''}
              </Text>
            </View>

            <View style={[styles.tripMeta, { borderTopColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.metaText, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
                  {item.departureDate
                    ? new Date(item.departureDate).toLocaleDateString('es-ES')
                    : 'Sin fecha'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.metaText, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>{item.departureTime || 'Sin hora'}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                <Text style={[styles.metaText, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
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

  const renderProvinceModal = (visible, onClose, selected, onSelect, title) => (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
            <Text style={[styles.pickerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.provinceList}>
            {ARGENTINA_PROVINCES.map((province) => (
              <TouchableOpacity
                key={province}
                onPress={() => {
                  onSelect(province);
                  onClose();
                }}
                style={[
                  styles.provinceOption,
                  { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  selected === province && { backgroundColor: isDarkMode ? '#1E3A8A' : '#EBF4FF' },
                ]}
              >
                <Text
                  style={[
                    styles.provinceOptionText,
                    { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                    selected === province && { color: isDarkMode ? '#FFFFFF' : '#000000', fontWeight: '600' },
                  ]}
                >
                  {province}
                </Text>
                {selected === province && (
                  <Ionicons name="checkmark" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
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
          <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
            <View style={[styles.pickerHeader, { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
              <Text style={[styles.pickerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Seleccionar Hora</Text>
              <TouchableOpacity onPress={() => { setTempTime(null); setShowTimePicker(false); }}>
                <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
              </TouchableOpacity>
            </View>
            <View style={[styles.datePickerWrapper, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
              <DateTimePicker
                value={tempTime || selectedTime || new Date()}
                mode="time"
                display="spinner"
                onChange={handleTimeChange}
                textColor={isDarkMode ? '#FFFFFF' : '#1F2937'}
                themeVariant={isDarkMode ? 'dark' : 'light'}
              />
            </View>
            <View style={styles.pickerButtons}>
              <TouchableOpacity
                style={[styles.pickerButton, { borderColor: isDarkMode ? '#404040' : '#E5E7EB' }]}
                onPress={() => {
                  setSelectedTime(null);
                  setTempTime(null);
                  setShowTimePicker(false);
                }}
              >
                <Text style={[styles.pickerButtonText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Limpiar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pickerButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }]}
                onPress={() => {
                  if (tempTime) {
                    setSelectedTime(tempTime);
                  }
                  setTempTime(null);
                  setShowTimePicker(false);
                }}
              >
                <Text style={[styles.pickerButtonConfirmText, { color: '#FFFFFF' }]}>Confirmar</Text>
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
        <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
          <View style={[styles.pickerHeader, { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
            <Text style={[styles.pickerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Lugares Disponibles</Text>
            <TouchableOpacity onPress={() => setShowSeatsPicker(false)}>
              <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
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
                  { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  minAvailableSeats === option && { backgroundColor: isDarkMode ? '#1E3A8A' : '#EBF4FF' },
                ]}
              >
                <Text
                  style={[
                    styles.provinceOptionText,
                    { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                    minAvailableSeats === option && { color: isDarkMode ? '#FFFFFF' : '#000000', fontWeight: '600' },
                  ]}
                >
                  {option === '1+' ? '1 o más lugares' :
                   option === '2+' ? '2 o más lugares' :
                   option === '3+' ? '3 o más lugares' :
                   '4 o más lugares'}
                </Text>
                {minAvailableSeats === option && (
                  <Ionicons name="checkmark" size={20} color={isDarkMode ? '#FFFFFF' : '#000000'} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#161616' : '#FFFFFF' }]}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Filters */}
          <View style={[styles.filtersSection, { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              {/* Origin */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  originProvince && { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => setShowOriginPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="radio-button-on" size={14} color={originProvince ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                <Text style={[
                  styles.filterChipText,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  originProvince && { color: isDarkMode ? '#000000' : '#FFFFFF' }
                ]} numberOfLines={1}>
                  {originProvince || 'Origen'}
                </Text>
              </TouchableOpacity>

              {/* Destination */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  destinationProvince && { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => setShowDestinationPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={14} color={destinationProvince ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                <Text style={[
                  styles.filterChipText,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  destinationProvince && { color: isDarkMode ? '#000000' : '#FFFFFF' }
                ]} numberOfLines={1}>
                  {destinationProvince || 'Destino'}
                </Text>
              </TouchableOpacity>

              {/* Date */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  selectedDate && { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => {
                  setTempDate(selectedDate || new Date());
                  setShowDatePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={selectedDate ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                <Text style={[
                  styles.filterChipText,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  selectedDate && { color: isDarkMode ? '#000000' : '#FFFFFF' }
                ]}>
                  {selectedDate ? selectedDate.toLocaleDateString('es-ES') : 'Fecha'}
                </Text>
              </TouchableOpacity>

              {/* Time Range */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  selectedTime && { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => {
                  setTempTime(selectedTime || new Date());
                  setShowTimePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="time-outline" size={14} color={selectedTime ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                <Text style={[
                  styles.filterChipText,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  selectedTime && { color: isDarkMode ? '#000000' : '#FFFFFF' }
                ]}>
                  {selectedTime ? selectedTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }) : 'Hora'}
                </Text>
              </TouchableOpacity>

              {/* Available Seats */}
              <TouchableOpacity
                style={[
                  styles.filterChip,
                  { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF', borderColor: isDarkMode ? '#404040' : '#E5E7EB' },
                  minAvailableSeats && { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }
                ]}
                onPress={() => setShowSeatsPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="people-outline" size={14} color={minAvailableSeats ? (isDarkMode ? '#000000' : '#FFFFFF') : (isDarkMode ? '#9CA3AF' : '#6B7280')} />
                <Text style={[
                  styles.filterChipText,
                  { color: isDarkMode ? '#9CA3AF' : '#6B7280' },
                  minAvailableSeats && { color: isDarkMode ? '#000000' : '#FFFFFF' }
                ]}>
                  {minAvailableSeats ? `${minAvailableSeats} lugares` : 'Asientos'}
                </Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Fila siempre visible: resultados + Limpiar filtros */}
            <View style={styles.resultsRow}>
              <Text style={[styles.resultsCount, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>
                {totalTrips} viaje{totalTrips !== 1 ? 's' : ''} encontrado{totalTrips !== 1 ? 's' : ''}
              </Text>
              {hasActiveFilters && (
                <TouchableOpacity style={styles.clearFiltersButton} onPress={clearFilters} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={16} color={isDarkMode ? '#EF4444' : '#DC2626'} />
                  <Text style={[styles.clearFiltersButtonText, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}>Limpiar filtros</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Trip List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={isDarkMode ? '#FFFFFF' : '#000000'} />
              <Text style={[styles.loadingText, { color: isDarkMode ? '#6B7280' : '#9CA3AF' }]}>Cargando viajes...</Text>
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
                  tintColor={isDarkMode ? '#FFFFFF' : '#000000'}
                  colors={[isDarkMode ? '#FFFFFF' : '#000000']}
                />
              }
              onEndReached={loadMoreTrips}
              onEndReachedThreshold={0.35}
              ListFooterComponent={
                loadingMore ? (
                  <View style={styles.listFooterLoader}>
                    <ActivityIndicator size="small" color={isDarkMode ? '#FFFFFF' : '#000000'} />
                    <Text style={[styles.listFooterHint, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Cargando más…</Text>
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="car-outline" size={64} color={isDarkMode ? '#6B7280' : '#9CA3AF'} />
                  <Text style={[styles.emptyText, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>No se encontraron viajes</Text>
                  <Text style={[styles.emptySubtext, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>
                    {hasActiveFilters
                      ? 'Intenta ajustar los filtros'
                      : 'No hay viajes disponibles por el momento'}
                  </Text>
                  {hasActiveFilters && (
                    <TouchableOpacity style={[styles.clearButton, { borderColor: isDarkMode ? 'transparent' : '#000000' }]} onPress={clearFilters} activeOpacity={0.7}>
                      <Text style={[styles.clearButtonText, { color: isDarkMode ? '#FFFFFF' : '#000000' }]}>Limpiar filtros</Text>
                    </TouchableOpacity>
                  )}
                </View>
              }
            />
          )}
        </Animated.View>

        {/* Province Modals */}
        {renderProvinceModal(
          showOriginPicker,
          () => setShowOriginPicker(false),
          originProvince,
          setOriginProvince,
          'Seleccionar Origen',
        )}
        {renderProvinceModal(
          showDestinationPicker,
          () => setShowDestinationPicker(false),
          destinationProvince,
          setDestinationProvince,
          'Seleccionar Destino',
        )}

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
              <View style={[styles.pickerContainer, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
                <View style={[styles.pickerHeader, { borderBottomColor: isDarkMode ? '#404040' : '#E5E7EB' }]}>
                  <Text style={[styles.pickerTitle, { color: isDarkMode ? '#FFFFFF' : '#1F2937' }]}>Seleccionar Fecha</Text>
                  <TouchableOpacity onPress={() => { setTempDate(null); setShowDatePicker(false); }}>
                    <Ionicons name="close" size={24} color={isDarkMode ? '#FFFFFF' : '#1F2937'} />
                  </TouchableOpacity>
                </View>
                <View style={[styles.datePickerWrapper, { backgroundColor: isDarkMode ? '#292929' : '#FFFFFF' }]}>
                  <DateTimePicker
                    value={tempDate || selectedDate || new Date()}
                    mode="date"
                    display="spinner"
                    onChange={handleDateChange}
                    minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                    textColor={isDarkMode ? '#FFFFFF' : '#1F2937'}
                    themeVariant={isDarkMode ? 'dark' : 'light'}
                  />
                </View>
                <View style={styles.pickerButtons}>
                  <TouchableOpacity
                    style={[styles.pickerButton, { borderColor: isDarkMode ? '#404040' : '#E5E7EB' }]}
                    onPress={() => {
                      setSelectedDate(null);
                      setTempDate(null);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerButtonText, { color: isDarkMode ? '#9CA3AF' : '#6B7280' }]}>Limpiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.pickerButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000', borderColor: isDarkMode ? 'transparent' : '#000000' }]}
                    onPress={() => {
                      if (tempDate) {
                        setSelectedDate(tempDate);
                      }
                      setTempDate(null);
                      setShowDatePicker(false);
                    }}
                  >
                    <Text style={[styles.pickerButtonConfirmText, { color: '#FFFFFF' }]}>Confirmar</Text>
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
  filtersSection: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
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
  filterChipActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  filterChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#1F2937',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
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
    fontWeight: fontWeight.semiBold,
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
    fontWeight: fontWeight.medium,
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
    fontWeight: fontWeight.bold,
    color: '#10B981',
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
    fontWeight: fontWeight.bold,
  },
  driverName: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
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
    fontWeight: fontWeight.semiBold,
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
    borderColor: '#1F2937',
  },
  clearButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
    color: '#1F2937',
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    maxHeight: '70%',
    width: '85%',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  pickerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
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
  provinceOptionSelected: {
    backgroundColor: '#1F293715',
  },
  provinceOptionText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    flex: 1,
  },
  provinceOptionTextSelected: {
    color: '#1F2937',
    fontWeight: fontWeight.semiBold,
  },
  datePickerWrapper: {
    backgroundColor: '#FFFFFF',
    paddingVertical: spacing.md,
  },
  pickerButtons: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  pickerButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  pickerButtonText: {
    fontSize: fontSize.md,
    color: '#6B7280',
    fontWeight: fontWeight.medium,
  },
  pickerButtonConfirm: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  pickerButtonConfirmText: {
    fontSize: fontSize.md,
    color: '#FFFFFF',
    fontWeight: fontWeight.medium,
  },
});

export default AllTripsScreen;
