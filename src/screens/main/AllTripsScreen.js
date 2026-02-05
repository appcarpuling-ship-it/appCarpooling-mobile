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
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_public } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { ARGENTINA_PROVINCES } from '../../constants/provinces';
import { spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const AllTripsScreen = ({ navigation }) => {
  const { colors, createColorArray } = useColors();

  const [trips, setTrips] = useState([]);
  const [filteredTrips, setFilteredTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [originProvince, setOriginProvince] = useState('');
  const [destinationProvince, setDestinationProvince] = useState('');
  const [selectedDate, setSelectedDate] = useState(null);

  // Picker modals
  const [showOriginPicker, setShowOriginPicker] = useState(false);
  const [showDestinationPicker, setShowDestinationPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempDate, setTempDate] = useState(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadTrips();
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [trips, originProvince, destinationProvince, selectedDate]);

  const loadTrips = async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const response = await get_public(ENDPOINTS.GET_TRIPS);
      if (response.success && Array.isArray(response.data)) {
        const sorted = [...response.data].sort((a, b) => {
          const aDate = new Date(a.departureDate).getTime();
          const bDate = new Date(b.departureDate).getTime();
          if (aDate !== bDate) return aDate - bDate;
          const aTime = (a.departureTime || '00:00').replace(':', '');
          const bTime = (b.departureTime || '00:00').replace(':', '');
          return parseInt(aTime, 10) - parseInt(bTime, 10);
        });
        setTrips(sorted);
      } else {
        setTrips([]);
      }
    } catch (error) {
      console.error('Error loading trips:', error);
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let result = [...trips];

    if (originProvince) {
      result = result.filter((t) => {
        const city = t.origin?.city || t.origin?.name || '';
        const province = t.origin?.province || '';
        return (
          province.toLowerCase().includes(originProvince.toLowerCase()) ||
          city.toLowerCase().includes(originProvince.toLowerCase())
        );
      });
    }

    if (destinationProvince) {
      result = result.filter((t) => {
        const city = t.destination?.city || t.destination?.name || '';
        const province = t.destination?.province || '';
        return (
          province.toLowerCase().includes(destinationProvince.toLowerCase()) ||
          city.toLowerCase().includes(destinationProvince.toLowerCase())
        );
      });
    }

    if (selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      result = result.filter((t) => {
        if (!t.departureDate) return false;
        const tripDate = new Date(t.departureDate).toISOString().split('T')[0];
        return tripDate === dateStr;
      });
    }

    setFilteredTrips(result);
  };

  const clearFilters = () => {
    setOriginProvince('');
    setDestinationProvince('');
    setSelectedDate(null);
  };

  const hasActiveFilters = originProvince || destinationProvince || selectedDate;

  const handleDateChange = (event, date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
      if (date) {
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
      const originCity = item.origin?.city || item.origin?.name || 'Origen';
      const destCity = item.destination?.city || item.destination?.name || 'Destino';

      return (
        <TouchableOpacity
          style={styles.tripCard}
          onPress={() => navigation.navigate('TripDetail', { tripId: item._id })}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={createColorArray(colors.surfaceElevated, colors.surface)}
            style={styles.cardGradient}
          >
            <View style={styles.tripHeader}>
              <View style={styles.routeRow}>
                <Text style={styles.cityText} numberOfLines={1}>{originCity}</Text>
                <Ionicons name="arrow-forward" size={18} color="#1F2937" />
                <Text style={styles.cityText} numberOfLines={1}>{destCity}</Text>
              </View>
              {/* <Text style={styles.priceText}>
                {item.pricePerSeat ? `$${item.pricePerSeat}` : 'Gratis'}
              </Text> */}
            </View>

            <View style={styles.driverRow}>
              <LinearGradient
                colors={createColorArray('#1F2937', '#111827')}
                style={styles.avatarSmall}
              >
                <Text style={styles.avatarText}>
                  {driver.firstName?.[0]}{driver.lastName?.[0]}
                </Text>
              </LinearGradient>
              <Text style={styles.driverName} numberOfLines={1}>
                {driver.firstName || 'Conductor'} {driver.lastName || ''}
              </Text>
            </View>

            <View style={styles.tripMeta}>
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>
                  {item.departureDate
                    ? new Date(item.departureDate).toLocaleDateString('es-ES')
                    : 'Sin fecha'}
                </Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>{item.departureTime || 'Sin hora'}</Text>
              </View>
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={14} color="#6B7280" />
                <Text style={styles.metaText}>
                  {item.availableSeats} disponible{item.availableSeats !== 1 ? 's' : ''}
                </Text>
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      );
    },
    [colors, navigation],
  );

  const renderProvinceModal = (visible, onClose, selected, onSelect, title) => (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.pickerContainer}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#000" />
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
                  selected === province && styles.provinceOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.provinceOptionText,
                    selected === province && styles.provinceOptionTextSelected,
                  ]}
                >
                  {province}
                </Text>
                {selected === province && (
                  <Ionicons name="checkmark" size={20} color="#1F2937" />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={createColorArray(colors.background, colors.surface)}
        style={styles.gradient}
      >
        <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
          {/* Filters */}
          <View style={styles.filtersSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filtersRow}>
              {/* Origin */}
              <TouchableOpacity
                style={[styles.filterChip, originProvince && styles.filterChipActive]}
                onPress={() => setShowOriginPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="radio-button-on" size={14} color={originProvince ? '#FFF' : '#1F2937'} />
                <Text style={[styles.filterChipText, originProvince && styles.filterChipTextActive]} numberOfLines={1}>
                  {originProvince || 'Origen'}
                </Text>
              </TouchableOpacity>

              {/* Destination */}
              <TouchableOpacity
                style={[styles.filterChip, destinationProvince && styles.filterChipActive]}
                onPress={() => setShowDestinationPicker(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="location" size={14} color={destinationProvince ? '#FFF' : '#1F2937'} />
                <Text style={[styles.filterChipText, destinationProvince && styles.filterChipTextActive]} numberOfLines={1}>
                  {destinationProvince || 'Destino'}
                </Text>
              </TouchableOpacity>

              {/* Date */}
              <TouchableOpacity
                style={[styles.filterChip, selectedDate && styles.filterChipActive]}
                onPress={() => {
                  setTempDate(selectedDate || new Date());
                  setShowDatePicker(true);
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="calendar-outline" size={14} color={selectedDate ? '#FFF' : '#1F2937'} />
                <Text style={[styles.filterChipText, selectedDate && styles.filterChipTextActive]}>
                  {selectedDate ? selectedDate.toLocaleDateString('es-ES') : 'Fecha'}
                </Text>
              </TouchableOpacity>

              {/* Clear */}
              {hasActiveFilters && (
                <TouchableOpacity style={styles.clearChip} onPress={clearFilters} activeOpacity={0.7}>
                  <Ionicons name="close-circle" size={14} color="#EF4444" />
                  <Text style={styles.clearChipText}>Limpiar</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <Text style={styles.resultsCount}>
              {filteredTrips.length} viaje{filteredTrips.length !== 1 ? 's' : ''} encontrado{filteredTrips.length !== 1 ? 's' : ''}
            </Text>
          </View>

          {/* Trip List */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>Cargando viajes...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredTrips}
              renderItem={renderTripItem}
              keyExtractor={(item) => item._id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => loadTrips(true)}
                  tintColor={colors.primary}
                  colors={createColorArray(colors.primary)}
                />
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Ionicons name="car-outline" size={64} color="#9CA3AF" />
                  <Text style={styles.emptyText}>No se encontraron viajes</Text>
                  <Text style={styles.emptySubtext}>
                    {hasActiveFilters
                      ? 'Intenta ajustar los filtros'
                      : 'No hay viajes disponibles por el momento'}
                  </Text>
                  {hasActiveFilters && (
                    <TouchableOpacity style={styles.clearButton} onPress={clearFilters} activeOpacity={0.7}>
                      <Text style={styles.clearButtonText}>Limpiar filtros</Text>
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

        {/* Date Picker */}
        {showDatePicker && (
          <Modal transparent animationType="fade" onRequestClose={() => { setTempDate(null); setShowDatePicker(false); }}>
            <View style={styles.modalOverlay}>
              <View style={styles.pickerContainer}>
                <View style={styles.pickerHeader}>
                  <Text style={styles.pickerTitle}>Seleccionar Fecha</Text>
                  <TouchableOpacity onPress={() => { setTempDate(null); setShowDatePicker(false); }}>
                    <Ionicons name="close" size={24} color="#000" />
                  </TouchableOpacity>
                </View>
                <View style={styles.datePickerWrapper}>
                  <DateTimePicker
                    value={tempDate || selectedDate || new Date()}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={handleDateChange}
                    minimumDate={new Date(new Date().setHours(0, 0, 0, 0))}
                    textColor="#000000"
                  />
                </View>
                {Platform.OS === 'ios' && (
                  <View style={styles.pickerButtons}>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => {
                        setSelectedDate(null);
                        setTempDate(null);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerButtonText}>Limpiar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pickerButton, styles.pickerButtonConfirm]}
                      onPress={() => {
                        if (tempDate) {
                          setSelectedDate(tempDate);
                        }
                        setTempDate(null);
                        setShowDatePicker(false);
                      }}
                    >
                      <Text style={styles.pickerButtonConfirmText}>Confirmar</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          </Modal>
        )}
      </LinearGradient>
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
  clearChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 4,
  },
  clearChipText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#EF4444',
  },
  resultsCount: {
    fontSize: fontSize.xs,
    color: '#6B7280',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },

  // List
  listContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    flexGrow: 1,
  },

  // Trip Card
  tripCard: {
    marginBottom: spacing.md,
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
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  cityText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: '#000000',
    flexShrink: 1,
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
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
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
