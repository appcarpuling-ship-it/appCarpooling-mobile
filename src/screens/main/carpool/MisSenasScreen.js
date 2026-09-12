import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  RefreshControl,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';
import { TripListSkeleton } from '../../../components/ui/TripCardSkeleton';
import { useMinDuration } from '../../../hooks/useMinDuration';
import { reportError } from '../../../utils/sentry';
import { montoSena } from '../../../utils/sena';
import { fmtDate } from '../../../utils/solicitudes';

const pesos = (n) => `$${Number(n || 0).toLocaleString('es-AR')}`;

// Mismo texto que ya usa la bandeja de reservas recibidas (utils/solicitudes.js
// getStatusConSena) del lado conductor, para que el mismo estado se lea igual en
// las dos pantallas. Del lado pasajero la acción pendiente es la suya, no la del
// conductor, así que el texto cambia.
const chipSena = (estado, soyConductor) => {
  if (estado === 'confirmada') return { label: 'Confirmada', solid: true };
  if (estado === 'enviada') {
    return soyConductor
      ? { label: 'Mandó la seña', solid: true }
      : { label: 'Enviada', solid: true };
  }
  return soyConductor
    ? { label: 'Esperando la seña', solid: false }
    : { label: 'Falta enviarla', solid: false };
};

const MisSenasScreen = ({ route }) => {
  const navigation = useNavigation();
  const ui = useUI();
  const { showAlert } = useAlert();
  // Fija, no un switch: "Señas Recibidas" es recibidas y "Señas Enviadas" es enviadas,
  // sin forma de cruzar de una a la otra desde acá adentro.
  const tab = route?.params?.tab === 'recibidas' ? 'recibidas' : 'enviadas';
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useMinDuration(loading);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchingRef = useRef(false);

  const load = useCallback(async (pageNum, reset, tabActual) => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    try {
      const endpoint = tabActual === 'enviadas'
        ? ENDPOINTS.MY_BOOKINGS
        : ENDPOINTS.SENAS_RECIBIDAS;
      const params = tabActual === 'enviadas'
        ? { conSena: 1, page: pageNum, limit: LIST_PAGE_SIZE }
        : { page: pageNum, limit: LIST_PAGE_SIZE };
      const response = await get_withauth(endpoint, params);
      if (response.success) {
        setItems((prev) => (reset ? response.data : [...prev, ...response.data]));
        setPage(pageNum);
        setHasMore(response.hasMore ?? false);
      }
    } catch (error) {
      reportError(error, { screen: 'MisSenasScreen', action: 'load', tab: tabActual });
      showAlert('Ocurrió algo', 'No se pudieron cargar las señas');
    } finally {
      fetchingRef.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useEffect(() => {
    navigation.setOptions({ title: tab === 'recibidas' ? 'Señas recibidas' : 'Señas enviadas' });
  }, [navigation, tab]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load(1, true, tab);
    }, [tab, load])
  );

  const onRefresh = () => {
    setRefreshing(true);
    load(1, true, tab);
  };

  const onEndReached = () => {
    if (!hasMore || loadingMore || fetchingRef.current) return;
    setLoadingMore(true);
    load(page + 1, false, tab);
  };

  const textPrimary = ui.invertBg;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;
  const accent      = ui.invertBg;
  const accentInv   = ui.invertText;

  const renderItem = ({ item }) => {
    const trip = item.trip;
    const soyConductor = tab === 'recibidas';
    const persona = soyConductor ? item.passenger : trip?.driver;
    const avatarUrl = persona?.avatar ? buildImageUri(persona.avatar) : null;
    const monto = montoSena(trip?.driverPrice, item.seatsBooked || 1);
    const chip = chipSena(item.sena?.estado, soyConductor);

    return (
      <TouchableOpacity
        style={[styles.fila, { borderBottomColor: divider }]}
        onPress={() => {
          if (soyConductor) {
            navigation.navigate('TripRequests', { tripId: trip?._id });
          } else {
            navigation.navigate('PagarSena', { bookingId: item._id, tripId: trip?._id });
          }
        }}
        activeOpacity={0.6}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder, { backgroundColor: ui.bg }]}>
            <Text style={[styles.avatarInitials, { color: textMuted }]}>
              {persona?.firstName?.[0]}{persona?.lastName?.[0]}
            </Text>
          </View>
        )}

        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.nombre, { color: textPrimary }]} numberOfLines={1}>
            {persona?.firstName} {persona?.lastName}
          </Text>
          <Text style={[styles.sub, { color: textMuted }]} numberOfLines={1}>
            {trip?.origin?.city} → {trip?.destination?.city}
          </Text>
          {!!trip?.departureDate && (
            <Text style={[styles.fecha, { color: textMuted }]} numberOfLines={1}>
              {fmtDate(trip.departureDate)}
            </Text>
          )}
        </View>

        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={[styles.monto, { color: textPrimary }]}>{pesos(monto)}</Text>
          <View style={[styles.chip, { backgroundColor: chip.solid ? accent : ui.bg }]}>
            <Text style={[styles.chipText, { color: chip.solid ? accentInv : textMuted }]}>{chip.label}</Text>
          </View>
        </View>

        <Ionicons name="chevron-forward" size={16} color={textMuted} style={{ marginLeft: 4 }} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      {showSkeleton ? (
        <TripListSkeleton />
      ) : items.length > 0 ? (
        <FlatList
          data={items}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.3}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={textMuted} />}
          ListFooterComponent={
            loadingMore ? (
              <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator size="small" color={textMuted} />
              </View>
            ) : null
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIconWrap, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <Ionicons name="cash-outline" size={36} color={textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>
            {tab === 'enviadas' ? 'Sin señas enviadas' : 'Sin señas recibidas'}
          </Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            {tab === 'enviadas'
              ? 'Las señas que mandes como pasajero van a aparecer acá'
              : 'Las señas que te manden como conductor van a aparecer acá'}
          </Text>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { paddingTop: 8 },

  fila: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatar: { width: 44, height: 44, borderRadius: 999 },
  avatarPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  avatarInitials: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  nombre: { fontFamily: 'Sora_600SemiBold', fontSize: 14.5 },
  sub: { fontFamily: 'Sora_500Medium', fontSize: 12.5, marginTop: 2 },
  fecha: { fontFamily: 'Sora_400Regular', fontSize: 11, marginTop: 1 },
  monto: { fontFamily: 'Sora_700Bold', fontSize: 14 },
  chip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  chipText: { fontSize: 9.5, fontFamily: 'Sora_600SemiBold' },

  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center',
  },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, padding: 32 },
  emptyTitle: { fontSize: 16, fontFamily: 'Sora_600SemiBold', marginTop: 4 },
  emptySubtitle: { fontSize: 13, textAlign: 'center', lineHeight: 20 },
});

export default MisSenasScreen;
