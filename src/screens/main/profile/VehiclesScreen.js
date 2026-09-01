import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { get_withauth, delete_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { reportError } from '../../../utils/sentry';
import VehicleShowcase from '../../../components/vehicle/VehicleShowcase';

const { width: SCREEN_W } = Dimensions.get('window');

/**
 * Mis vehículos: un auto por pantalla, con su foto grande arriba y el detalle scrolleando
 * abajo. Se pasa de auto con swipe o con las flechas de los costados.
 *
 * Es la misma pantalla que VehiclePickerScreen —el selector de vehículo para un viaje—, con
 * la única diferencia de los dos botones que flotan sobre la foto: acá editar y borrar, allá
 * ninguno. Antes era una lista de tarjetas chicas donde la foto del auto casi no se veía.
 */
const VehiclesScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const ui = useUI();
  const insets = useSafeAreaInsets();

  const [vehicles, setVehicles] = useState([]);
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchLock = useRef(false);
  const hasDataRef = useRef(false);
  const loadVehiclesRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    hasDataRef.current = vehicles.length > 0;
    // Borrar el último auto de la lista dejaba el índice apuntando a una página que ya no
    // existe (flechas y puntitos de un vehículo fantasma).
    setIndex((i) => Math.min(i, Math.max(0, vehicles.length - 1)));
  }, [vehicles.length]);

  const loadVehicles = async (pageNum = 1, reset = false, opts = {}) => {
    const { skipMainLoading = false } = opts;
    if (fetchLock.current) return;
    fetchLock.current = true;
    if (pageNum === 1) {
      if (!skipMainLoading) setLoading(true);
    } else {
      setLoadingMore(true);
    }
    try {
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES, { page: pageNum, limit: LIST_PAGE_SIZE });
      if (response.success && Array.isArray(response.data)) {
        const rows = response.data;
        setVehicles((prev) => (reset || pageNum === 1 ? rows : [...prev, ...rows]));
        setPage(pageNum);
        setHasMore(response.hasMore === true);
      } else if (reset || pageNum === 1) {
        setVehicles([]);
        setHasMore(false);
      }
    } catch (error) {
      reportError(error, { screen: 'VehiclesScreen', action: 'loadVehicles' });
      showAlert('Ocurrió algo', 'No pudimos cargar tus vehículos.');
      if (reset || pageNum === 1) setVehicles([]);
    } finally {
      fetchLock.current = false;
      setLoading(false);
      setLoadingMore(false);
    }
  };

  loadVehiclesRef.current = loadVehicles;

  useFocusEffect(
    useCallback(() => {
      loadVehiclesRef.current?.(1, true, { skipMainLoading: hasDataRef.current });
    }, [])
  );

  const onEndReached = () => {
    if (!hasMore || loadingMore || loading || fetchLock.current) return;
    loadVehicles(page + 1, false);
  };

  const goTo = (i) => {
    const next = Math.min(Math.max(i, 0), vehicles.length - 1);
    listRef.current?.scrollToIndex({ index: next, animated: true });
    setIndex(next);
  };

  const handleDelete = (vehicleId) => {
    navigation.navigate('Confirm', {
      title: 'Eliminar Vehículo',
      message: '¿Seguro que querés eliminar este vehículo?',
      confirmLabel: 'Eliminar',
      destructive: true,
      onConfirm: async () => {
        const response = await delete_withauth(ENDPOINTS.DELETE_VEHICLE(vehicleId));
        if (!response.success) throw new Error(response.message || 'No se pudo eliminar el vehículo');
        loadVehicles(1, true, { skipMainLoading: true });
      },
      successParams: { title: 'Vehículo eliminado', message: 'Ya no figura en tu lista.' },
      errorParams: { title: 'Ocurrió algo' },
    });
  };

  const renderItem = ({ item }) => (
    <VehicleShowcase
      vehicle={item}
      width={SCREEN_W}
      // El FAB de nuevo vehículo flota sobre el scroll: sin este aire, al llegar al fondo
      // tapaba la última fila de documentación. 56 del botón + los 20 que lo separan del piso.
      aireAbajo={insets.bottom + 76}
      acciones={[
        { icon: 'create-outline', label: 'Editar vehículo', onPress: () => navigation.navigate('VehicleForm', { vehicle: item }) },
        { icon: 'trash-outline', label: 'Eliminar vehículo', onPress: () => handleDelete(item._id) },
      ]}
    />
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      {vehicles.length > 0 ? (
        <>
          <View style={styles.carousel}>
            {vehicles.length > 1 && index > 0 && (
              <TouchableOpacity
                style={[styles.arrow, styles.arrowLeft, { backgroundColor: ui.bg }]}
                onPress={() => goTo(index - 1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Vehículo anterior"
              >
                <Ionicons name="chevron-back" size={22} color={ui.text} />
              </TouchableOpacity>
            )}

            <FlatList
              ref={listRef}
              data={vehicles}
              keyExtractor={(item) => item._id}
              renderItem={renderItem}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              getItemLayout={(_, i) => ({ length: SCREEN_W, offset: SCREEN_W * i, index: i })}
              onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / SCREEN_W))}
              onEndReached={onEndReached}
              onEndReachedThreshold={0.35}
            />

            {vehicles.length > 1 && index < vehicles.length - 1 && (
              <TouchableOpacity
                style={[styles.arrow, styles.arrowRight, { backgroundColor: ui.bg }]}
                onPress={() => goTo(index + 1)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Vehículo siguiente"
              >
                <Ionicons name="chevron-forward" size={22} color={ui.text} />
              </TouchableOpacity>
            )}
          </View>

          {vehicles.length > 1 && (
            <View style={[styles.dots, { paddingBottom: insets.bottom + 12 }]}>
              {vehicles.map((v, i) => (
                <View
                  key={v._id}
                  style={[styles.dot, { backgroundColor: i === index ? ui.text : ui.border }, i === index && styles.dotActive]}
                />
              ))}
            </View>
          )}
        </>
      ) : (
        <View style={styles.empty}>
          {/* Antes una ilustración 3D a color, sobra del rediseño B/N viejo. Ícono simple,
              mismo criterio que el resto de las pantallas vacías de la app. */}
          <View style={[styles.emptyIconWrap, { backgroundColor: ui.surface, borderColor: ui.border }]}>
            <Ionicons name="car-sport-outline" size={36} color={ui.textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: ui.text }]}>Sin vehículos</Text>
          <Text style={[styles.emptySubtitle, { color: ui.textMuted }]}>
            Cargá tu primer vehículo para empezar a publicar viajes.
          </Text>
        </View>
      )}

      <TouchableOpacity
        // bottom fijo no alcanza: en Android la app dibuja debajo de la barra de
        // navegacion, asi que con los 3 botones el FAB quedaba medio tapado.
        style={[styles.fab, { backgroundColor: ui.invertBg, bottom: insets.bottom + 20 }]}
        onPress={() => navigation.navigate('VehicleForm')}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Agregar vehículo"
      >
        <Ionicons name="add" size={28} color={ui.invertText} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  carousel: { flex: 1, paddingTop: 12 },
  // Sobre la foto, no sobre el detalle: es la altura donde el dedo espera encontrarlas y no
  // tapan texto. HERO_H del showcase es ~36% de la pantalla, así que 18% cae en su medio.
  arrow: { position: 'absolute', zIndex: 2, top: '18%', width: 40, height: 40, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  arrowLeft: { left: 24 },
  arrowRight: { right: 24 },

  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, paddingTop: 12 },
  dot: { width: 6, height: 6, borderRadius: 999 },
  dotActive: { width: 22 },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle:    { fontSize: 17, fontFamily: 'Sora_600SemiBold' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});

export default VehiclesScreen;
