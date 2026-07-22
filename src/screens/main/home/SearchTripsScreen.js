import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_public } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { spacing, borderRadius, fontSize } from '../../../theme/colors';
import AdvancedFiltersModal from '../../../components/modals/AdvancedFiltersModal';
import { tripRemainingSeats } from '../../../utils/tripSeatsDisplay';
import { useUI } from '../../../theme/ui';

const SearchTripsScreen = ({ route, navigation }) => {
  const ui = useUI();

  const { origin, destination, departureDate } = route.params || {};
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Evita relanzar la búsqueda inicial en bucle
  const [hasSearched, setHasSearched] = useState(false);

  // Filtros
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    originCity: origin?.trim() || '',
    destinationCity: destination?.trim() || '',
    date: departureDate || '',
    minSeats: '',
    maxPrice: '',
    minRating: 0,
    timeOfDay: '',
    vehicleType: '',
    instantBooking: false,
    sortBy: 'departureDate',
    sortOrder: 'asc',
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!hasSearched && (origin?.trim() || destination?.trim())) {
      setHasSearched(true);
      setError(null);

      const initialSearchData = {
        originCity: origin?.trim() || '',
        destinationCity: destination?.trim() || '',
        date: departureDate || '',
        minSeats: '',
        maxPrice: '',
      };

      searchTrips(initialSearchData);
    } else if (!hasSearched) {
      setHasSearched(true);
      setError('Faltan parámetros de búsqueda. Necesitas especificar al menos el origen o destino.');
      setLoading(false);
    }

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []);

  const applyAdvancedFilters = (trips, filters) => {
    let filtered = Array.isArray(trips) ? trips : [];

    if (filters.maxPrice && !isNaN(parseFloat(filters.maxPrice))) {
      filtered = filtered.filter(trip =>
        trip.pricePerSeat && trip.pricePerSeat <= parseFloat(filters.maxPrice)
      );
    }

    if (filters.minRating && filters.minRating > 0) {
      filtered = filtered.filter(trip =>
        trip.driver?.rating && trip.driver.rating >= filters.minRating
      );
    }

    if (filters.timeOfDay) {
      filtered = filtered.filter(trip => {
        if (!trip.departureTime) return false;
        const hour = parseInt(trip.departureTime.split(':')[0]);

        switch (filters.timeOfDay) {
          case 'morning':
            return hour >= 6 && hour < 12;
          case 'afternoon':
            return hour >= 12 && hour < 18;
          case 'evening':
            return hour >= 18 && hour < 24;
          case 'night':
            return hour >= 0 && hour < 6;
          default:
            return true;
        }
      });
    }

    if (filters.vehicleType) {
      filtered = filtered.filter(trip => {
        const vehicleModel = trip.vehicle?.model?.toLowerCase() || '';
        const vehicleMake = trip.vehicle?.make?.toLowerCase() || '';
        const fullVehicle = `${vehicleMake} ${vehicleModel}`;

        switch (filters.vehicleType) {
          case 'sedan':
            return fullVehicle.includes('sedan') || vehicleModel.includes('corolla') || vehicleModel.includes('focus');
          case 'suv':
            return fullVehicle.includes('suv') || vehicleModel.includes('cr-v') || vehicleModel.includes('rav4');
          case 'hatchback':
            return fullVehicle.includes('hatchback') || vehicleModel.includes('golf') || vehicleModel.includes('fiesta');
          case 'pickup':
            return fullVehicle.includes('pickup') || vehicleModel.includes('hilux') || vehicleModel.includes('ranger');
          default:
            return true;
        }
      });
    }

    if (filters.instantBooking) {
      filtered = filtered.filter(trip => trip.allowInstantBooking === true);
    }

    return filtered;
  };

  const applySorting = (trips, filters) => {
    const sorted = [...trips];

    switch (filters.sortBy) {
      case 'price':
        sorted.sort((a, b) => {
          const priceA = a.pricePerSeat || 0;
          const priceB = b.pricePerSeat || 0;
          return filters.sortOrder === 'asc' ? priceA - priceB : priceB - priceA;
        });
        break;
      case 'rating':
        sorted.sort((a, b) => {
          const ratingA = a.driver?.rating || 0;
          const ratingB = b.driver?.rating || 0;
          return filters.sortOrder === 'asc' ? ratingA - ratingB : ratingB - ratingA;
        });
        break;
      case 'departureDate':
      default:
        sorted.sort((a, b) => {
          const dateA = new Date(`${a.departureDate} ${a.departureTime || '00:00'}`);
          const dateB = new Date(`${b.departureDate} ${b.departureTime || '00:00'}`);
          return filters.sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
        });
        break;
    }

    return sorted;
  };

  const searchTrips = async (customFilters = null) => {
    if (!isMountedRef.current) return;

    setLoading(true);
    setError(null);

    try {
      const searchData = customFilters || filters;
      const searchParams = {};

      if (searchData.originCity?.trim()) {
        searchParams.originCity = searchData.originCity.trim();
      }
      if (searchData.destinationCity?.trim()) {
        searchParams.destinationCity = searchData.destinationCity.trim();
      }
      if (searchData.date) {
        searchParams.date = searchData.date;
      }
      if (searchData.minSeats) {
        searchParams.seats = parseInt(searchData.minSeats);
      }

      const pageSize = 10;
      let aggregated = [];
      let page = 1;
      let hasMorePages = true;
      let anySuccess = false;
      while (hasMorePages && page <= 50) {
        const response = await get_public(ENDPOINTS.SEARCH_TRIPS, { ...searchParams, page, limit: pageSize });
        if (!response || !response.success || !Array.isArray(response.data)) {
          break;
        }
        anySuccess = true;
        aggregated = aggregated.concat(response.data);
        hasMorePages = response.hasMore === true;
        page += 1;
      }

      if (!isMountedRef.current) return;

      if (anySuccess) {
        let filteredResults = aggregated;
        filteredResults = applyAdvancedFilters(filteredResults, searchData);
        filteredResults = applySorting(filteredResults, searchData);

        setTrips(filteredResults);
        if (filteredResults.length === 0) {
          setError(null);
        }
      } else {
        setTrips([]);
        setError('No se encontraron resultados para tu búsqueda');
      }
    } catch (error) {
      if (isMountedRef.current) {
        setError(error.message || 'No se pudieron cargar los viajes. Verifica tu conexión e intenta de nuevo.');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  const applyFilters = (newFilters) => {
    setFilters(newFilters);
    searchTrips(newFilters);
  };

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.date) count++;
    if (filters.minSeats) count++;
    if (filters.maxPrice) count++;
    if (filters.minRating > 0) count++;
    if (filters.timeOfDay) count++;
    if (filters.vehicleType) count++;
    if (filters.instantBooking) count++;
    if (filters.sortBy !== 'departureDate' || filters.sortOrder !== 'asc') count++;
    return count;
  };

  const renderTripItem = useCallback(({ item }) => {
    if (!item || !item._id) return null;

    const driver = item.driver || {};
    const tripOrigin = item.origin || {};
    const tripDestination = item.destination || {};
    const originCity = tripOrigin.city || tripOrigin.name || tripOrigin.address || 'Ciudad origen';
    const destinationCity = tripDestination.city || tripDestination.name || tripDestination.address || 'Ciudad destino';
    const freeSeats = tripRemainingSeats(item);

    return (
      <TouchableOpacity
        style={[styles.tripCard, { backgroundColor: ui.surface, borderColor: ui.border }]}
        onPress={() => navigation.navigate('TripDetail', { tripId: item._id })}
        activeOpacity={0.7}
      >
        <View style={styles.tripHeader}>
          <View style={styles.routeRow}>
            <Text style={[styles.addressText, { color: ui.text }]} numberOfLines={1}>{originCity}</Text>
            <Ionicons name="arrow-forward" size={16} color={ui.textMuted} />
            <Text style={[styles.addressText, { color: ui.text }]} numberOfLines={1}>{destinationCity}</Text>
          </View>
        </View>

        <View style={styles.driverRow}>
          <View style={[styles.avatarSmall, { backgroundColor: ui.invertBg }]}>
            <Text style={[styles.avatarText, { color: ui.invertText }]}>
              {driver.firstName?.[0]}{driver.lastName?.[0]}
            </Text>
          </View>
          <Text style={[styles.driverName, { color: ui.textMuted }]} numberOfLines={1}>
            {driver.firstName || 'Conductor'} {driver.lastName || ''}
          </Text>
        </View>

        <View style={[styles.tripMeta, { borderTopColor: ui.border }]}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={ui.textMuted} />
            <Text style={[styles.metaText, { color: ui.textMuted }]}>
              {item.departureDate ? new Date(item.departureDate).toLocaleDateString('es-ES') : 'Sin fecha'}
            </Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="time-outline" size={14} color={ui.textMuted} />
            <Text style={[styles.metaText, { color: ui.textMuted }]}>{item.departureTime || 'Sin hora'}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="people-outline" size={14} color={ui.textMuted} />
            <Text style={[styles.metaText, { color: ui.textMuted }]}>
              {freeSeats <= 0 ? 'Completo' : `${freeSeats} disponible${freeSeats !== 1 ? 's' : ''}`}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [navigation, ui]);

  const keyExtractor = useCallback((item) => item._id || item.id, []);

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.invertBg} />
        <Text style={[styles.loadingText, { color: ui.textMuted }]}>Buscando viajes...</Text>
      </View>
    );
  }

  const activeFiltersCount = getActiveFiltersCount();

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <View style={styles.screenHeader}>
          <Text style={[styles.screenTitle, { color: ui.text }]}>
            Viajes{'\n'}
            <Text style={styles.screenTitleStrong}>encontrados</Text>
          </Text>
        </View>

        <View style={styles.searchInfo}>
          <View style={styles.searchRoute}>
            <Ionicons name="radio-button-on" size={16} color={ui.textMuted} />
            <Text style={[styles.searchText, { color: ui.text }]} numberOfLines={1}>{origin}</Text>
          </View>
          <View style={styles.searchRoute}>
            <Ionicons name="location" size={16} color={ui.textMuted} />
            <Text style={[styles.searchText, { color: ui.text }]} numberOfLines={1}>{destination}</Text>
          </View>

          <View style={styles.resultsRow}>
            <Text style={[styles.resultsCount, { color: ui.textMuted }]}>
              {trips.length} viaje{trips.length !== 1 ? 's' : ''} encontrado{trips.length !== 1 ? 's' : ''}
            </Text>
            <TouchableOpacity
              style={[
                styles.filtersButton,
                { backgroundColor: activeFiltersCount > 0 ? ui.invertBg : ui.surface, borderColor: ui.border },
              ]}
              onPress={() => setShowFilters(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeFiltersCount > 0 ? 'filter' : 'filter-outline'}
                size={16}
                color={activeFiltersCount > 0 ? ui.invertText : ui.textMuted}
              />
              <Text style={[styles.filtersButtonText, { color: activeFiltersCount > 0 ? ui.invertText : ui.textMuted }]}>
                Filtros {activeFiltersCount > 0 && `(${activeFiltersCount})`}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={{ flex: 1 }} key={`results-${trips.length}`}>
          {trips.length > 0 ? (
            <FlatList
              data={trips}
              renderItem={renderTripItem}
              keyExtractor={keyExtractor}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={styles.cardSeparator} />}
              extraData={trips}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews={false}
              initialNumToRender={10}
              maxToRenderPerBatch={10}
              windowSize={10}
            />
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name={error ? 'alert-circle-outline' : 'car-outline'} size={64} color={ui.textMuted} />
              <Text style={[styles.emptyText, { color: ui.text }]}>
                {error || 'No se encontraron viajes'}
              </Text>
              <Text style={[styles.emptySubtext, { color: ui.textMuted }]}>
                {error
                  ? 'Por favor verifica los parámetros de búsqueda e intenta de nuevo'
                  : 'Intenta buscar con diferentes ubicaciones o fechas'}
              </Text>
              {!error && (
                <TouchableOpacity
                  style={[styles.retryButton, { backgroundColor: ui.invertBg }]}
                  onPress={() => searchTrips()}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={18} color={ui.invertText} />
                  <Text style={[styles.retryButtonText, { color: ui.invertText }]}>Buscar de nuevo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </Animated.View>

      <AdvancedFiltersModal
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApplyFilters={applyFilters}
        initialFilters={filters}
      />
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
    fontFamily: 'Sora_500Medium',
  },

  screenHeader: { paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16 },
  screenTitle: { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  screenTitleStrong: { fontFamily: 'Sora_800ExtraBold' },

  searchInfo: {
    paddingHorizontal: 24,
    paddingBottom: spacing.md,
  },
  searchRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  searchText: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    flex: 1,
  },
  resultsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  resultsCount: {
    fontSize: fontSize.xs,
    fontFamily: 'Sora_500Medium',
  },
  filtersButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  filtersButtonText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
  },

  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl + 8,
  },
  cardSeparator: {
    height: 14,
  },

  tripCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: spacing.md,
  },
  tripHeader: {
    marginBottom: spacing.sm,
  },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  addressText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
    flex: 1,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  avatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontFamily: 'Sora_700Bold',
  },
  driverName: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
    flex: 1,
  },
  tripMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: fontSize.xs,
    fontFamily: 'Sora_500Medium',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontFamily: 'Sora_600SemiBold',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 999,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
  },
});

export default SearchTripsScreen;
