import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { get_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { reportError } from '../../../utils/sentry';
import { imageForType } from '../../../utils/vehicleImage';

/**
 * Mis vehículos: el índice. Una fila por auto, encabezada por la PATENTE, que es como uno
 * distingue sus propios autos ("el del AB 123") y no por la marca, que se repite.
 *
 * Antes era un carrusel de una pantalla por auto: para ver el segundo había que deslizar, y
 * cada página traía la ficha completa (papeles, comodidades, fotos) aunque uno sólo estuviera
 * buscando cuál tocar. Todo eso se mudó a VehicleDetailScreen y acá quedó lo que sirve para
 * elegir: patente, qué auto es y cuántos asientos tiene.
 *
 * Sin cards: filas separadas por líneas finas, que es la dirección del rediseño.
 */

// Mismas etiquetas que VehicleShowcase y el selector de VehicleFormScreen: si difieren, el
// mismo tipo aparece con dos nombres según la pantalla.
const TYPE_LABELS = {
  sedan: 'Auto',
  hatchback: 'Auto',
  suv: 'Auto-camioneta',
  van: 'Camioneta',
  pickup: 'Camioneta',
  otro: 'Otro',
};

const VehiclesScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const ui = useUI();
  const insets = useSafeAreaInsets();

  const [vehicles, setVehicles] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const fetchLock = useRef(false);
  const hasDataRef = useRef(false);
  const loadVehiclesRef = useRef(null);

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
        hasDataRef.current = rows.length > 0 || pageNum > 1;
        setPage(pageNum);
        setHasMore(response.hasMore === true);
      } else if (reset || pageNum === 1) {
        setVehicles([]);
        hasDataRef.current = false;
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

  const renderItem = ({ item }) => {
    // Mismo criterio que VehicleShowcase: las fotos de relleno del seeder (picsum) no son el
    // auto, así que para esas vale más la silueta del tipo que una playa al azar.
    const fotos = (item.photos || []).filter(Boolean);
    const suelta = item.photo && !item.photo.includes('picsum') ? item.photo : null;
    const foto = fotos[0] || suelta;

    const tipo = TYPE_LABELS[item.type] || item.type;
    const subtitulo = [item.brand, item.model].filter(Boolean).join(' ');
    const detalle = [item.year, tipo, item.color].filter(Boolean).join(' · ');

    return (
      <TouchableOpacity
        style={[styles.fila, { borderTopColor: ui.border }]}
        onPress={() => navigation.navigate('VehicleDetail', { vehicle: item })}
        activeOpacity={0.6}
        accessibilityRole="button"
        accessibilityLabel={`${subtitulo}, patente ${item.licensePlate || 'sin cargar'}`}
      >
        <View style={styles.filaTexto}>
          <Text style={[styles.patente, { color: ui.text }]} numberOfLines={1}>
            {item.licensePlate || 'Sin patente'}
          </Text>
          {!!detalle && (
            <Text style={[styles.linea, { color: ui.textMuted }]} numberOfLines={1}>
              {subtitulo ? `${subtitulo} · ${detalle}` : detalle}
            </Text>
          )}
          {!!item.capacity && (
            <Text style={[styles.linea, { color: ui.textMuted }]}>{item.capacity} asientos</Text>
          )}
        </View>

        <View style={[styles.foto, { backgroundColor: ui.surface }]}>
          <Image
            source={foto ? { uri: buildImageUri(foto) } : imageForType(item.type)}
            style={foto ? styles.fotoReal : styles.fotoFallback}
            resizeMode={foto ? 'cover' : 'contain'}
          />
        </View>
      </TouchableOpacity>
    );
  };

  // "Agregar" como una fila más y no como botón flotante: no tapa la última fila y queda en el
  // mismo renglón de lectura que el resto.
  const filaAgregar = (
    <TouchableOpacity
      style={[styles.fila, styles.filaAgregar, { borderTopColor: ui.border, borderBottomColor: ui.border }]}
      onPress={() => navigation.navigate('VehicleForm')}
      activeOpacity={0.6}
      accessibilityRole="button"
      accessibilityLabel="Agregar vehículo"
    >
      <View style={[styles.mas, { borderColor: ui.textMuted }]}>
        <Ionicons name="add" size={20} color={ui.text} />
      </View>
      <Text style={[styles.agregarTexto, { color: ui.text }]}>Agregar vehículo</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: ui.bg }]}>
        <ActivityIndicator size="large" color={ui.text} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: ui.bg, paddingTop: insets.top }]}>
      <View style={styles.header}>
        {/* Sólo si hay a dónde volver: a esta pantalla se llega desde el perfil (con stack
            detrás) pero también desde otras tabs sin `initial: false` (ver
            CreateTripGoogleMaps), donde queda como raíz y goBack no hace nada — una flecha
            muerta es peor que ninguna. */}
        {navigation.canGoBack() && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Volver"
          >
            <Ionicons name="chevron-back" size={26} color={ui.text} />
          </TouchableOpacity>
        )}
        <Text style={[styles.titulo, { color: ui.text }]}>Mis vehículos</Text>
        <Text style={[styles.contador, { color: ui.textMuted }]}>
          {vehicles.length === 1 ? '1 vehículo' : `${vehicles.length} vehículos`}
        </Text>
      </View>

      <FlatList
        data={vehicles}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.35}
        ListFooterComponent={
          <>
            {loadingMore && <ActivityIndicator style={styles.masCargando} color={ui.textMuted} />}
            {filaAgregar}
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={[styles.emptyIconWrap, { backgroundColor: ui.surface, borderColor: ui.border }]}>
              <Ionicons name="car-sport-outline" size={36} color={ui.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: ui.text }]}>Sin vehículos</Text>
            <Text style={[styles.emptySubtitle, { color: ui.textMuted }]}>
              Cargá tu primer vehículo para empezar a publicar viajes.
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  header: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20, gap: 6 },
  titulo: { fontSize: 30, fontFamily: 'Sora_800ExtraBold', letterSpacing: -0.8, marginTop: 10 },
  contador: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  fila: {
    marginHorizontal: 24,
    paddingVertical: 20,
    borderTopWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  filaTexto: { flex: 1, minWidth: 0, gap: 5 },
  // La patente es el título de la fila: grande y espaciada, como se lee en una chapa.
  patente: { fontSize: 26, fontFamily: 'Sora_800ExtraBold', letterSpacing: 2.5 },
  linea: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  foto: { width: 92, height: 92, borderRadius: 20, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  fotoReal: { width: '100%', height: '100%' },
  fotoFallback: { width: '62%', height: '62%', opacity: 0.55 },

  filaAgregar: { borderBottomWidth: 1, gap: 14 },
  mas: { width: 40, height: 40, borderRadius: 999, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  agregarTexto: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },

  masCargando: { marginVertical: 16 },

  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 48, gap: 12 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44, borderWidth: 1,
    justifyContent: 'center', alignItems: 'center', marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontFamily: 'Sora_600SemiBold' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },
});

export default VehiclesScreen;
