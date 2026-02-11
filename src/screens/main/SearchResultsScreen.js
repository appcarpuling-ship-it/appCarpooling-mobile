import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Animated,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_public } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { colors as themeColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';
import { useAlert } from '../../context/AlertContext';
import { typography } from '../../theme/typography';

const SearchResultsScreen = ({ route, navigation }) => {
  const { colors, gradients, createColorArray, getCurrentThemeMode } = useColors();
  const { showAlert } = useAlert();
  const { origin, destination } = route.params || {};

  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortingLoading, setSortingLoading] = useState(false);
  const [sortBy, setSortBy] = useState('price'); // price, time, rating

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.lg,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTop: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    backButton: {
      padding: spacing.sm,
      marginRight: spacing.md,
    },
    headerTitle: {
      fontSize: fontSize.xl,
      fontWeight: fontWeight.bold,
      color: colors.textPrimary,
      flex: 1,
    },
    searchSummary: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginBottom: spacing.sm,
    },
    searchRoute: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semiBold,
      color: colors.textPrimary,
    },
    controlsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    sortButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sortButtonText: {
      fontSize: fontSize.sm,
      color: colors.textPrimary,
      fontWeight: fontWeight.medium,
      marginLeft: spacing.xs,
    },
    contentContainer: {
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.sm,
    },
    tripCard: {
      marginHorizontal: spacing.md,
      marginVertical: spacing.sm,
      borderRadius: borderRadius.lg,
      padding: spacing.lg,
      backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 4,
      elevation: 3,
    },
    tripCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    driverAvatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor: colors.messagePrimary,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.md,
    },
    avatarText: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: '#FFF',
    },
    driverDetailsContainer: {
      flex: 1,
    },
    driverName: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semiBold,
      color: colors.textPrimary,
      marginBottom: spacing.xs,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    starsContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: spacing.xs,
    },
    ratingText: {
      fontSize: fontSize.xs,
      color: colors.textTertiary,
    },
    priceTag: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: borderRadius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    priceValue: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.bold,
      color: '#FFF',
    },
    priceLabel: {
      fontSize: fontSize.xs,
      color: '#FFF',
      opacity: 0.9,
    },
    routeSection: {
      marginBottom: spacing.md,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    routePoint: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: spacing.sm,
    },
    routeTextContainer: {
      flex: 1,
      marginLeft: spacing.sm,
    },
    routeCity: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semiBold,
      color: colors.textPrimary,
    },
    routeAddress: {
      fontSize: fontSize.xs,
      color: colors.textTertiary,
      marginTop: 2,
    },
    routeLine: {
      height: 16,
      width: 2,
      backgroundColor: colors.border,
      marginLeft: 8,
      marginVertical: spacing.xs,
    },
    detailsSection: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    detailItem: {
      flexDirection: 'row',
      alignItems: 'center',
      width: '48%',
      marginBottom: spacing.sm,
    },
    detailText: {
      fontSize: fontSize.sm,
      color: colors.textSecondary,
      marginLeft: spacing.xs,
    },
    preferencesSection: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: spacing.md,
      paddingBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    preferenceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: borderRadius.sm,
      backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface,
      marginRight: spacing.sm,
      marginBottom: spacing.sm,
    },
    preferenceText: {
      fontSize: fontSize.xs,
      color: colors.textSecondary,
      fontWeight: fontWeight.medium,
      marginLeft: spacing.xs,
    },
    selectButton: {
      backgroundColor: colors.textMuted,
      borderRadius: borderRadius.md,
      overflow: 'hidden',
    },
    selectButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.md,
    },
    selectButtonText: {
      fontSize: fontSize.md,
      fontWeight: fontWeight.semiBold,
      color: '#FFF',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
    },
    emptyText: {
      fontSize: fontSize.lg,
      fontWeight: fontWeight.semiBold,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    emptySubtext: {
      fontSize: fontSize.sm,
      color: colors.textTertiary,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
  });

  useEffect(() => {
    loadSearchResults();
    startAnimations();
  }, []);

  useEffect(() => {
    if (trips.length > 0) {
      loadSearchResults();
    }
  }, [sortBy]);

  const startAnimations = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadSearchResults = async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (origin?.trim()) {
        params.originProvince = origin.trim();
      }
      
      if (destination?.trim()) {
        params.destinationProvince = destination.trim();
      }

      const response = await get_public(ENDPOINTS.SEARCH_TRIPS, params);
      
      if (response.success) {
        let sortedTrips = [...response.data];
        
        // Aplicar ordenamiento
        if (sortBy === 'price') {
          sortedTrips.sort((a, b) => a.pricePerSeat - b.pricePerSeat);
        } else if (sortBy === 'time') {
          sortedTrips.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
        }
        
        setTrips(sortedTrips);
      }
    } catch (error) {
      console.error('Error loading search results:', error);
      showAlert('Error', 'No se pudieron cargar los viajes');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <View style={dynamicStyles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= Math.floor(rating || 0) ? 'star' : 'star-outline'}
            size={14}
            color={colors.accentOrange}
            style={{ marginRight: 2 }}
          />
        ))}
      </View>
    );
  };

  const renderTripCard = ({ item: trip }) => (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => navigation.navigate('TripDetail', { tripId: trip._id })}
    >
      <View style={dynamicStyles.tripCard}>
        {/* Header con Conductor */}
        <View style={dynamicStyles.tripCardHeader}>
          <View style={dynamicStyles.driverAvatar}>
            <Text style={dynamicStyles.avatarText}>
              {trip.driver?.firstName?.[0]}{trip.driver?.lastName?.[0]}
            </Text>
          </View>

          <View style={dynamicStyles.driverDetailsContainer}>
            <Text style={dynamicStyles.driverName}>
              {trip.driver?.firstName} {trip.driver?.lastName}
            </Text>
            <View style={dynamicStyles.ratingRow}>
              {renderStars(trip.driver?.rating)}
              <Text style={dynamicStyles.ratingText}>
                {trip.driver?.rating?.toFixed(1) || 'N/A'} • {trip.driver?.reviews || 0} reseñas
              </Text>
            </View>
          </View>

       
        </View>

        {/* Ruta */}
        <View style={dynamicStyles.routeSection}>
          <View style={dynamicStyles.routePoint}>
            <Ionicons name="radio-button-on" size={18} color={colors.messagePrimary} />
            <View style={dynamicStyles.routeTextContainer}>
              <Text style={dynamicStyles.routeCity} numberOfLines={1}>
                {trip.origin?.city}
              </Text>
              <Text style={dynamicStyles.routeAddress} numberOfLines={1}>
                {trip.origin?.address}
              </Text>
            </View>
          </View>

          <View style={dynamicStyles.routeLine} />

          <View style={dynamicStyles.routePoint}>
            <Ionicons name="location" size={18} color={colors.messagePrimary} />
            <View style={dynamicStyles.routeTextContainer}>
              <Text style={dynamicStyles.routeCity} numberOfLines={1}>
                {trip.destination?.city}
              </Text>
              <Text style={dynamicStyles.routeAddress} numberOfLines={1}>
                {trip.destination?.address}
              </Text>
            </View>
          </View>
        </View>

        {/* Detalles */}
        <View style={dynamicStyles.detailsSection}>
          <View style={dynamicStyles.detailItem}>
            <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
            <Text style={dynamicStyles.detailText}>
              {new Date(trip.departureDate).toLocaleDateString('es-ES')}
            </Text>
          </View>

          <View style={dynamicStyles.detailItem}>
            <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
            <Text style={dynamicStyles.detailText}>{trip.departureTime}</Text>
          </View>

          <View style={dynamicStyles.detailItem}>
            <Ionicons name="people-outline" size={16} color={colors.textSecondary} />
            <Text style={dynamicStyles.detailText}>
              {trip.availableSeats} asiento{trip.availableSeats > 1 ? 's' : ''} libre
            </Text>
          </View>
        </View>

        {/* Preferencias */}
        {(trip.allowSmoking || trip.allowPets) && (
          <View style={dynamicStyles.preferencesSection}>
            {trip.allowSmoking && (
              <View style={dynamicStyles.preferenceBadge}>
                <Ionicons name="flame-outline" size={12} color={colors.messagePrimary} />
                <Text style={dynamicStyles.preferenceText}>Permitido fumar</Text>
              </View>
            )}
            {trip.allowPets && (
              <View style={dynamicStyles.preferenceBadge}>
                <Ionicons name="paw-outline" size={12} color={colors.messagePrimary} />
                <Text style={dynamicStyles.preferenceText}>Mascotas OK</Text>
              </View>
            )}
          </View>
        )}

        {/* Botón de Acción */}
        <TouchableOpacity
          style={dynamicStyles.selectButton}
          onPress={() => navigation.navigate('TripDetail', { tripId: trip._id })}
        >
          <View style={dynamicStyles.selectButtonContent}>
            <Text style={dynamicStyles.selectButtonText}>Ver Detalles</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" style={{ marginLeft: spacing.xs }} />
          </View>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={dynamicStyles.container}>
        <View style={dynamicStyles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.messagePrimary} />
          <Text style={dynamicStyles.emptyText}>Buscando viajes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={dynamicStyles.container} edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
      >
        {/* Header */}
        <Animated.View
          style={[
            dynamicStyles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={dynamicStyles.headerTop}>
            <TouchableOpacity
              style={dynamicStyles.backButton}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={dynamicStyles.headerTitle}>Resultados</Text>
            <Text style={dynamicStyles.searchSummary}>
              {trips.length} viaje{trips.length !== 1 ? 's' : ''} encontrado{trips.length !== 1 ? 's' : ''}
            </Text>
          </View>

          <Text style={dynamicStyles.searchRoute}>
            {origin} → {destination}
          </Text>

          <View style={dynamicStyles.controlsRow}>
            <TouchableOpacity
              style={dynamicStyles.sortButton}
              onPress={() => {
                setSortingLoading(true);
                let newSort = 'price';
                if (sortBy === 'price') {
                  newSort = 'time';
                } else if (sortBy === 'time') {
                  newSort = 'rating';
                }
                setSortBy(newSort);
                setTimeout(() => setSortingLoading(false), 1500);
              }}
            >
              <Ionicons name="swap-vertical" size={16} color={colors.messagePrimary} />
              <Text style={dynamicStyles.sortButtonText}>
                {sortBy === 'price' ? 'Precio' : sortBy === 'time' ? 'Hora' : 'Calificación'}
              </Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Content */}
        {trips.length > 0 ? (
          <>
            {sortingLoading && (
              <View style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: colors.background,
                zIndex: 999,
              }}>
                <ActivityIndicator size="large" color={colors.messagePrimary} />
              </View>
            )}
            <FlatList
              data={trips}
              renderItem={renderTripCard}
              keyExtractor={(item) => item._id}
              contentContainerStyle={dynamicStyles.contentContainer}
              scrollIndicatorInsets={{ right: 1 }}
              showsVerticalScrollIndicator={true}
            />
          </>
        ) : (
          <View style={dynamicStyles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color={colors.textTertiary} />
            <Text style={dynamicStyles.emptyText}>No se encontraron viajes</Text>
            <Text style={dynamicStyles.emptySubtext}>
              Intenta con otras ciudades o fechas
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default SearchResultsScreen;
