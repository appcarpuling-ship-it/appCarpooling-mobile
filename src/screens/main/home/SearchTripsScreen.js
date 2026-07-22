import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_public } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { colors as themeColors, spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';
import AdvancedFiltersModal from '../../../components/modals/AdvancedFiltersModal';
import { tripRemainingSeats } from '../../../utils/tripSeatsDisplay';
import { useUI } from '../../../theme/ui';

const SearchTripsScreen = ({ route, navigation }) => {
  const { colors, gradients, createColorArray } = useColors();
  const ui = useUI();
  
  // Dynamic styles that depend on colors hook
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    loadingText: {
      color: colors.textSecondary,
      marginTop: spacing.md,
      fontSize: fontSize.md,
    },
    searchInfo: {
      padding: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.borderLight,
    },
    searchText: {
      fontSize: fontSize.md,
      fontFamily: 'Sora_500Medium',
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    tripCard: {
      margin: spacing.md,
      borderRadius: borderRadius.lg,
      overflow: 'hidden',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    tripHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    routeText: {
      fontSize: fontSize.lg,
      fontFamily: 'Sora_700Bold',
      color: colors.textPrimary,
      flex: 1,
    },
    priceText: {
      fontSize: fontSize.lg,
      fontFamily: 'Sora_700Bold',
      color: colors.primary,
    },
    tripInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.xs,
    },
    infoText: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginLeft: spacing.xs,
    },
    driverSection: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.sm,
      paddingTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.borderLight,
    },
    driverInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    driverName: {
      fontSize: fontSize.md,
      fontFamily: 'Sora_500Medium',
      color: colors.textPrimary,
      marginLeft: spacing.sm,
    },
    seatsText: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
    },
    noFiltersText: {
      fontSize: fontSize.md,
      color: colors.textSecondary,
      textAlign: 'center',
      marginBottom: spacing.lg,
    },
    filtersButton: {
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    filtersButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: 'Sora_600SemiBold',
    },
    clearFiltersButton: {
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.borderLight,
    },
    clearFiltersText: {
      color: colors.textSecondary,
      fontSize: fontSize.md,
      fontFamily: 'Sora_500Medium',
    },
    retryButton: {
      borderRadius: borderRadius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    retryButtonText: {
      color: colors.textPrimary,
      fontSize: fontSize.md,
      fontFamily: 'Sora_600SemiBold',
    },
    centerContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
  const { origin, destination, departureDate } = route.params || {};
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // ✅ Estado para controlar la búsqueda inicial y evitar bucle infinito
  const [hasSearched, setHasSearched] = useState(false);

  // Estados para filtros
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
      console.log('🧹 SearchTripsScreen unmounting');
    };
  }, []);

  // Debug: Monitorear cambios en trips
  useEffect(() => {
    console.log('🔄 trips state changed:', trips.length, 'items');
    if (trips.length > 0) {
      console.log('📋 First trip ID:', trips[0]?._id);
    }
  }, [trips]);

  useEffect(() => {
    console.log('🔍 SearchTrips params:', { origin, destination, departureDate });
    console.log('🔍 hasSearched:', hasSearched, 'trips.length:', trips.length);
    
    // ✅ SOLO ejecutar la búsqueda una vez al montar el componente
    if (!hasSearched && (origin?.trim() || destination?.trim())) {
      setHasSearched(true); // Marcar que ya se hizo la búsqueda inicial
      setError(null);
      
      // Usar directamente los parámetros de ruta para la búsqueda inicial
      const initialSearchData = {
        originCity: origin?.trim() || '',
        destinationCity: destination?.trim() || '',
        date: departureDate || '',
        minSeats: '',
        maxPrice: '',
      };
      
      console.log('🎯 Initial search with direct params:', initialSearchData);
      searchTrips(initialSearchData);
    } else if (!hasSearched) {
      setHasSearched(true); // Evitar bucle infinito incluso si no hay parámetros
      console.error('❌ Missing search parameters - need at least origin or destination');
      setError('Faltan parámetros de búsqueda. Necesitas especificar al menos el origen o destino.');
      setLoading(false);
    }

    // FadeIn animation on mount (600ms)
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, []); // ✅ Dependencias VACÍAS - Solo ejecutar una vez al montar

  // Función para aplicar filtros avanzados en frontend
  const applyAdvancedFilters = (trips, filters) => {
    let filtered = Array.isArray(trips) ? trips : [];

    // Filtro por precio máximo
    if (filters.maxPrice && !isNaN(parseFloat(filters.maxPrice))) {
      filtered = (Array.isArray(filtered) ? filtered : []).filter(trip =>
        trip.pricePerSeat && trip.pricePerSeat <= parseFloat(filters.maxPrice)
      );
    }

    // Filtro por rating mínimo del conductor
    if (filters.minRating && filters.minRating > 0) {
      filtered = (Array.isArray(filtered) ? filtered : []).filter(trip =>
        trip.driver?.rating && trip.driver.rating >= filters.minRating
      );
    }

    // Filtro por horario del día
    if (filters.timeOfDay) {
      filtered = (Array.isArray(filtered) ? filtered : []).filter(trip => {
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

    // Filtro por tipo de vehículo
    if (filters.vehicleType) {
      filtered = (Array.isArray(filtered) ? filtered : []).filter(trip => {
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

    // Filtro por reserva instantánea
    if (filters.instantBooking) {
      filtered = (Array.isArray(filtered) ? filtered : []).filter(trip => trip.allowInstantBooking === true);
    }

    return filtered;
  };

  // Función para aplicar ordenamiento
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
    if (!isMountedRef.current) {
      console.log('⚠️ Component unmounted, skipping search');
      return;
    }

    setLoading(true);
    setError(null);
    
    try {
      const searchData = customFilters || filters;
      console.log('🔍 Starting search with filters:', searchData);

      const searchParams = {};

      // Solo agregar campos que tienen valor
      if (searchData.originCity?.trim()) {
        searchParams.originCity = searchData.originCity.trim();
      }
      if (searchData.destinationCity?.trim()) {
        searchParams.destinationCity = searchData.destinationCity.trim();
      }

      // Agregar fecha si está disponible
      if (searchData.date) {
        searchParams.date = searchData.date;
      }

      // Agregar filtros adicionales
      if (searchData.minSeats) {
        searchParams.seats = parseInt(searchData.minSeats);
      }

      console.log('🔍 Final search params:', searchParams);

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

      console.log('🔍 Search aggregated pages:', { trips: aggregated.length });

      // Verificar si el componente todavía está montado antes de actualizar el estado
      if (!isMountedRef.current) {
        console.log('⚠️ Component unmounted during search, skipping state update');
        return;
      }

      if (anySuccess) {
        let filteredResults = aggregated;

        // Aplicar filtros avanzados en frontend
        filteredResults = applyAdvancedFilters(filteredResults, searchData);

        // Aplicar ordenamiento
        filteredResults = applySorting(filteredResults, searchData);

        console.log(`✅ Setting trips state with ${filteredResults.length} trips`);
        setTrips(filteredResults);
        console.log(`✅ Found ${filteredResults.length} trips (${aggregated.length} before client filters)`);

        if (filteredResults.length === 0) {
          setError(null);
        }
      } else {
        console.warn('⚠️ Search unsuccessful');
        if (isMountedRef.current) {
          setTrips([]);
          setError('No se encontraron resultados para tu búsqueda');
        }
      }
    } catch (error) {
      console.error('❌ Error searching trips:', error.message || error);
      // ✅ NO resetear trips en catch para mantener resultados anteriores si los hay
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

  const resetFilters = () => {
    setFilters({
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
  };

  // Contar filtros activos
  const getActiveFiltersCount = () => {
    let count = 0;

    // No contar origin y destination porque son los parámetros básicos de búsqueda
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
    console.log('🎨 Rendering trip item:', item._id, 'Driver:', item.driver?.firstName);
    console.log('📍 Origin data:', JSON.stringify(item.origin));
    console.log('📍 Destination data:', JSON.stringify(item.destination));

    // Validar que el item tiene los datos necesarios
    if (!item || !item._id) {
      console.error('❌ Trip item is invalid:', item);
      return null;
    }

    const driver = item.driver || {};
    // Manejar diferentes estructuras de origin y destination
    const tripOrigin = item.origin || {};
    const tripDestination = item.destination || {};
    
    // Extraer ciudad de diferentes posibles estructuras
    const originCity = tripOrigin.city || tripOrigin.name || tripOrigin.address || 'Ciudad origen';
    const destinationCity = tripDestination.city || tripDestination.name || tripDestination.address || 'Ciudad destino';
    const freeSeats = tripRemainingSeats(item);

    return (
      <TouchableOpacity
        style={staticStyles.tripCard}
        onPress={() => {
          console.log('📍 Navigating to trip detail:', item._id);
          navigation.navigate('TripDetail', { tripId: item._id });
        }}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={createColorArray(colors.surfaceElevated, colors.surface)}
          style={staticStyles.cardGradient}
        >
          {/* Header del viaje */}
          <View style={staticStyles.tripHeader}>
            <View style={staticStyles.routeContainer}>
              <Text style={staticStyles.cityText}>{originCity}</Text>
              <Ionicons name="arrow-forward" size={20} color={colors.primary} />
              <Text style={staticStyles.cityText}>{destinationCity}</Text>
            </View>
            {/* <Text style={staticStyles.priceText}>
              {item.pricePerSeat ? `$${item.pricePerSeat}` : 'Gratis'}
            </Text> */}
          </View>

          {/* Info del conductor */}
          <View style={staticStyles.driverSection}>
            <View style={staticStyles.driverInfo}>
              <Ionicons name="person-circle" size={24} color={colors.primary} />
              <Text style={staticStyles.driverName}>
                {driver.firstName || 'Conductor'} {driver.lastName || ''}
              </Text>
            </View>
            <View style={staticStyles.tripMetrics}>
              <Text style={staticStyles.seatsText}>
                {freeSeats <= 0 ? 'Completo' : `${freeSeats} libres`}
              </Text>
            </View>
          </View>

          {/* Fecha y hora */}
          <View style={staticStyles.timeSection}>
            <Ionicons name="time" size={16} color={colors.textSecondary} />
            <Text style={staticStyles.timeText}>
              {item.departureDate ? new Date(item.departureDate).toLocaleDateString() : 'Fecha no especificada'} - {item.departureTime || 'Hora no especificada'}
            </Text>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    );
  }, [navigation]);

  const keyExtractor = useCallback((item) => {
    const key = item._id || item.id;
    console.log('🔑 Key extracted:', key);
    return key;
  }, []);

  if (loading) {
    return (
      <LinearGradient
        colors={createColorArray(colors.background, colors.surface)}
        style={dynamicStyles.centerContainer}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={dynamicStyles.loadingText}>Buscando viajes...</Text>
      </LinearGradient>
    );
  }

  console.log('🔄 [SearchTrips] Re-rendering. trips.length:', trips.length, 'loading:', loading, 'error:', error);

  return (
    <View style={dynamicStyles.container}>
      <LinearGradient
        colors={createColorArray(colors.background, colors.surface)}
        style={staticStyles.gradient}
      >
        {/* Search Info Header with elegant gradient */}
        <Animated.View style={{ opacity: fadeAnim }}>
          <LinearGradient
            colors={createColorArray(colors.surfaceElevated, colors.surface)}
            style={dynamicStyles.searchInfo}
          >
            <View style={staticStyles.searchRoute}>
              <Ionicons name="radio-button-on" size={18} color={colors.primary} />
              <Text style={dynamicStyles.searchText}>{origin}</Text>
            </View>
            <View style={staticStyles.searchArrow}>
              <Ionicons name="arrow-down" size={16} color={colors.textTertiary} />
            </View>
            <View style={staticStyles.searchRoute}>
              <Ionicons name="location" size={18} color={ui.text} />
              <Text style={dynamicStyles.searchText}>{destination}</Text>
            </View>
            <Text style={staticStyles.resultsText}>
              {trips.length} viaje{trips.length !== 1 ? 's' : ''} encontrado{trips.length !== 1 ? 's' : ''}
            </Text>
          </LinearGradient>

          {/* Botón de Filtros */}
          <View style={staticStyles.filtersContainer}>
            <TouchableOpacity
              style={dynamicStyles.filtersButton}
              onPress={() => setShowFilters(true)}
              activeOpacity={0.7}
            >
              <View
                style={[staticStyles.filtersButtonGradient, { backgroundColor: getActiveFiltersCount() > 0 ? ui.text : ui.textMuted }]}
              >
                <Ionicons
                  name={getActiveFiltersCount() > 0 ? "filter" : "filter-outline"}
                  size={18}
                  color={colors.textPrimary}
                />
                <Text style={staticStyles.filtersButtonText}>
                  Filtros {getActiveFiltersCount() > 0 && `(${getActiveFiltersCount()})`}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Contenedor de resultados con key para forzar re-render */}
        <View style={{ flex: 1 }} key={`results-${trips.length}`}>
          {trips.length > 0 ? (
            <>
              {console.log('📋 Rendering FlatList with', trips.length, 'trips')}
              <FlatList
                data={trips}
                renderItem={renderTripItem}
                keyExtractor={keyExtractor}
                contentContainerStyle={staticStyles.listContent}
                extraData={trips}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={10}
              />
            </>
          ) : (
            <View style={staticStyles.emptyContainer}>
              <View
                style={[staticStyles.emptyIconContainer, { backgroundColor: colors.messagePrimary }]}
              >
                <Ionicons
                  name={error ? "alert-circle-outline" : "car-outline"}
                  size={48}
                  color={colors.textPrimary}
                />
              </View>
              <Text style={staticStyles.emptyText}>
                {error || 'No se encontraron viajes'}
              </Text>
              <Text style={staticStyles.emptySubtext}>
                {error
                  ? 'Por favor verifica los parámetros de búsqueda e intenta de nuevo'
                  : 'Intenta buscar con diferentes ubicaciones o fechas'
                }
              </Text>
              {!error && (
                <TouchableOpacity
                  style={staticStyles.retryButton}
                  onPress={() => searchTrips()}
                  activeOpacity={0.7}
                >
                  <View
                    style={[staticStyles.retryButtonGradient, { backgroundColor: colors.messagePrimary }]}
                  >
                    <Ionicons name="refresh-outline" size={20} color={colors.textPrimary} />
                    <Text style={staticStyles.retryButtonText}>Buscar de nuevo</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Advanced Filters Modal */}
        <AdvancedFiltersModal
          visible={showFilters}
          onClose={() => setShowFilters(false)}
          onApplyFilters={applyFilters}
          initialFilters={filters}
        />
      </LinearGradient>
    </View>
  );
};


const staticStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    marginTop: spacing.md,
    fontSize: fontSize.md,
  },
  searchInfo: {
    padding: spacing.lg,
    borderBottomWidth: 1,
  },
  searchRoute: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  searchArrow: {
    paddingLeft: spacing.xs,
    marginBottom: spacing.xs,
  },
  searchText: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    marginLeft: spacing.sm,
  },
  resultsText: {
    fontSize: fontSize.sm,
    marginTop: spacing.sm,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  tripCardGradient: {
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  avatarText: {
    color: '#000000',
    fontSize: fontSize.lg,
    fontFamily: 'Sora_700Bold',
  },
  tripInfo: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  driverName: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    color: '#000000',
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  rating: {
    marginLeft: spacing.xs,
    fontSize: fontSize.xs,
    color: '#6B7280',
  },
  priceContainer: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs + 2,
    borderRadius: borderRadius.sm,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  price: {
    fontSize: fontSize.xl,
    fontFamily: 'Sora_700Bold',
  },
  routeContainer: {
    flexDirection: 'row',
    marginBottom: spacing.md,
  },
  routeLine: {
    width: 20,
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  routeDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 3,
    elevation: 2,
  },
  routeDotEnd: {
  },
  routePath: {
    flex: 1,
    width: 2,
    backgroundColor: '#F3F4F6',
    marginVertical: spacing.xs,
  },
  routeInfo: {
    flex: 1,
    justifyContent: 'space-between',
  },
  routePoint: {
    marginBottom: spacing.sm,
  },
  routeTime: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
    color: '#6366F1',
    marginBottom: 2,
  },
  routeCity: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    color: '#000000',
    marginBottom: 2,
  },
  routeAddress: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  tripFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  tripDate: {
    fontSize: fontSize.sm,
    color: '#6B7280',
  },
  seats: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
    color: '#6366F1',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: borderRadius.xl,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontFamily: 'Sora_600SemiBold',
    color: '#000000',
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    color: '#000000',
  },

  // Estilos para filtros
  filtersContainer: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filtersButton: {
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  filtersButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  filtersButtonText: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    color: '#000000',
    marginLeft: spacing.sm,
  },


  // Debug style
  debugText: {
    fontSize: fontSize.sm,
    color: '#F97316',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    fontFamily: 'Sora_700Bold',
  },

  // Trip Card Styles
  tripCard: {
    marginBottom: spacing.lg,
    borderRadius: borderRadius.xl,
    overflow: 'hidden',
    shadowColor: '#1F2937',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  cardGradient: {
    padding: spacing.xl,
  },
  tripHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(99, 102, 241, 0.2)',
  },
  routeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cityText: {
    fontSize: fontSize.lg,
    fontFamily: 'Sora_700Bold',
    color: '#000000',
    letterSpacing: 0.5,
  },
  driverSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
  },
  driverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  driverName: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_600SemiBold',
    color: '#000000',
  },
  tripMetrics: {
    alignItems: 'flex-end',
    backgroundColor: 'rgba(139, 92, 246, 0.15)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  seatsText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_600SemiBold',
    color: '#6366F1',
  },
  timeSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  timeText: {
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
    color: '#6B7280',
  },
});

export default SearchTripsScreen;
