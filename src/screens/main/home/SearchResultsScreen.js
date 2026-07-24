import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { get_public, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';
import { useTheme } from '../../../context/ThemeContext';
import { useAlert } from '../../../context/AlertContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { tripDisplaySeats } from '../../../utils/tripSeatsDisplay';
import { useUI } from '../../../theme/ui';

const SORT_OPTIONS = ['price', 'time'];

const SearchResultsScreen = ({ route, navigation }) => {
  const { colors } = useColors();
  const { isDarkMode } = useTheme();
  const { showAlert } = useAlert();
  const insets = useSafeAreaInsets();

  const { origin, originCity, destination, destinationCity } = route.params || {};

  const originLabel = originCity || origin || '?';
  const destinationLabel = destinationCity || destination || '?';

  const [trips, setTrips] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchingRef = useRef(false);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('price');

  const ui = useUI();
  const cardBg = ui.surface;
  const cardBorder = ui.border;
  const textPrimary = ui.text;
  const textMuted = ui.textMuted;
  const textSecondary = ui.textMuted;

  const loadResults = useCallback(async (sort, pageNum = 1, reset = true) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      if (reset) setLoading(true);
      const params = { page: pageNum, limit: LIST_PAGE_SIZE, sort };
      if (origin?.trim())          params.originProvince      = origin.trim();
      if (originCity?.trim())      params.originCity          = originCity.trim();
      if (destination?.trim())     params.destinationProvince = destination.trim();
      if (destinationCity?.trim()) params.destinationCity     = destinationCity.trim();

      const response = await get_public(ENDPOINTS.SEARCH_TRIPS, params);

      if (response.success) {
        // El orden lo resuelve el backend: ordenar acá sobre una página daría
        // "el más barato de los cargados", no el más barato de la búsqueda.
        const data = response.data || [];
        setTrips(prev => (reset ? data : [...prev, ...data]));
        setPage(pageNum);
        setHasMore(response.hasMore ?? false);
      }
    } catch {
      showAlert('Ocurrió algo', 'No se pudieron cargar los viajes');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  }, [origin, originCity, destination, destinationCity]);

  useEffect(() => { loadResults(sortBy); }, []);

  // Cambiar el orden vuelve a pedir desde la página 1.
  const handleSort = () => {
    const next = sortBy === 'price' ? 'time' : 'price';
    setSortBy(next);
    loadResults(next, 1, true);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    loadResults(sortBy, page + 1, false);
  };

  const formatAddress = (loc) => {
    if (!loc) return '';
    let raw = (loc.street || loc.address || '').replace(/, [A-Z][0-9]{4}[A-Z0-9]{0,3}\s+/g, ', ');
    const city = loc.city || '';
    const province = loc.province || '';
    let addr = raw || city;
    if (province && addr && !addr.includes(province)) addr += `, ${province}`;
    else if (province && !addr) addr = province;
    return addr;
  };

  const renderTrip = useCallback(({ item }) => {
    const driver = item.driver || {};
    const freeSeats = tripDisplaySeats(item);
    const originAddr = formatAddress(item.origin);
    const destAddr = formatAddress(item.destination);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
        onPress={() => navigation.navigate('TripDetail', { tripId: item._id })}
        activeOpacity={0.7}
      >
        {/* Precio */}
        <View style={styles.cardInner}>
          <View style={styles.routeRow}>
            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
              {originAddr}
            </Text>
            <Ionicons name="arrow-forward" size={16} color={textSecondary} style={styles.arrow} />
            <Text style={[styles.routeText, { color: textPrimary }]} numberOfLines={2}>
              {destAddr}
            </Text>
          </View>

          {/* Driver */}
          <View style={styles.driverRow}>
            {driver.avatar ? (
              <Image
                source={{ uri: buildImageUri(driver.avatar) }}
                style={[styles.avatar, { borderColor: cardBorder }]}
              />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: ui.text }]}>
                <Text style={[styles.avatarInitials, { color: ui.invertText }]}>
                  {driver.firstName?.[0]}{driver.lastName?.[0]}
                </Text>
              </View>
            )}
            <Text style={[styles.driverName, { color: textSecondary }]} numberOfLines={1}>
              {driver.firstName} {driver.lastName}
            </Text>
          </View>

          {/* Meta */}
          <View style={[styles.metaRow, { borderTopColor: cardBorder }]}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={13} color={textMuted} />
              <Text style={[styles.metaText, { color: textMuted }]}>
                {item.departureDate
                  ? new Date(item.departureDate).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })
                  : 'Sin fecha'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={textMuted} />
              <Text style={[styles.metaText, { color: textMuted }]}>
                {item.departureTime || 'Sin hora'}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="people-outline" size={13} color={textMuted} />
              <Text style={[styles.metaText, { color: freeSeats === 0 ? ui.textMuted : textMuted }]}>
                {freeSeats === 0 ? 'Completo' : `${freeSeats} libre${freeSeats !== 1 ? 's' : ''}`}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [isDarkMode, navigation, cardBg, cardBorder, textPrimary, textSecondary, textMuted]);

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#161616' : '#F7F8FA' }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 8,
            backgroundColor: isDarkMode ? '#1F1F1F' : '#FFFFFF',
            borderBottomColor: cardBorder,
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="chevron-back" size={24} color={textPrimary} />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.routeSummary}>
            <Text style={[styles.routeLabel, { color: textPrimary }]} numberOfLines={1}>
              {originLabel}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={textSecondary} style={{ marginHorizontal: 4 }} />
            <Text style={[styles.routeLabel, { color: textPrimary }]} numberOfLines={1}>
              {destinationLabel}
            </Text>
          </View>
          {!loading && (
            <Text style={[styles.resultCount, { color: textMuted }]}>
              {trips.length} {trips.length === 1 ? 'viaje encontrado' : 'viajes encontrados'}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleSort}
          style={[styles.sortBtn, { backgroundColor: isDarkMode ? '#292929' : '#F3F4F6', borderColor: cardBorder }]}
        >
          <Ionicons name="swap-vertical" size={14} color={textSecondary} />
          <Text style={[styles.sortText, { color: textSecondary }]}>
            {sortBy === 'price' ? 'Precio' : 'Hora'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={textPrimary} />
          <Text style={[styles.loadingText, { color: textMuted }]}>Buscando viajes...</Text>
        </View>
      ) : trips.length === 0 ? (
        <View style={styles.centered}>
          <Image
            source={require('../../../../assets/illustrations/empty-search.png')}
            style={styles.emptyIllustration}
            resizeMode="contain"
          />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin resultados</Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            No hay viajes de {originLabel} a {destinationLabel}
          </Text>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={[styles.tryAgainBtn, { backgroundColor: textPrimary }]}
          >
            <Text style={[styles.tryAgainText, { color: ui.bg }]}>
              Modificar búsqueda
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTrip}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={textMuted} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  backBtn: { padding: 2 },
  headerCenter: { flex: 1 },
  routeSummary: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  routeLabel: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
    flexShrink: 1,
  },
  resultCount: {
    fontSize: 12,
    marginTop: 2,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  sortText: { fontSize: 12, fontFamily: 'Sora_500Medium' },
  list: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 10,
  },
  card: {
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardInner: { padding: spacing.md },
  routeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: spacing.sm,
  },
  routeText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
    lineHeight: 18,
  },
  arrow: { marginTop: 1, flexShrink: 0 },
  price: {
    fontSize: fontSize.md,
    fontFamily: 'Sora_700Bold',
    color: '#000000',
    flexShrink: 0,
    marginLeft: 2,
  },
  driverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitials: {
    fontSize: 10,
    fontFamily: 'Sora_700Bold',
  },
  driverName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontFamily: 'Sora_500Medium',
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  ratingText: {
    fontSize: fontSize.xs,
    fontFamily: 'Sora_500Medium',
  },
  metaRow: {
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
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 32,
  },
  loadingText: { fontSize: 14, marginTop: 8 },
  emptyIllustration: { width: 200, height: 200 },
  emptyTitle: { fontSize: 18, fontFamily: 'Sora_600SemiBold', marginTop: 4 },
  emptySubtitle: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  tryAgainBtn: {
    marginTop: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  tryAgainText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
});

export default SearchResultsScreen;
