import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { get_withauth, delete_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import { useAlert } from '../../../context/AlertContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { reportError } from '../../../utils/sentry';
import { imageForType } from '../../../utils/vehicleImage';

// Mismas etiquetas que el selector de VehicleFormScreen: si difieren, el mismo
// tipo se muestra con dos nombres distintos según la pantalla.
const TYPE_LABELS = {
  sedan: 'Auto',
  suv: 'Auto-camioneta',
  hatchback: 'Auto',
  van: 'Camioneta',
  pickup: 'Camioneta',
  otro: 'Otro',
};

const VehiclesScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const ui = useUI();
  const insets = useSafeAreaInsets();

  const bg         = ui.bg;
  const cardBg     = ui.surface;
  const border     = ui.border;
  const textPrimary   = ui.text;
  const textMuted     = ui.textMuted;
  const textSecondary = ui.textMuted;
  const chipBg        = ui.bg;

  const [vehicles, setVehicles] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchLock = useRef(false);
  const hasDataRef = useRef(false);
  const loadVehiclesRef = useRef(null);

  useEffect(() => {
    hasDataRef.current = vehicles.length > 0;
  }, [vehicles.length]);

  const loadVehicles = async (pageNum = 1, reset = false, opts = {}) => {
    const { skipMainLoading = false } = opts;
    if (fetchLock.current) return;
    fetchLock.current = true;
    if (pageNum === 1) {
      if (!refreshing && !skipMainLoading) setLoading(true);
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
      setRefreshing(false);
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

  const onRefresh = () => {
    setRefreshing(true);
    loadVehicles(1, true, { skipMainLoading: true });
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

  const renderItem = ({ item }) => {
    const photoUrl = item.photos?.length > 0
      ? buildImageUri(item.photos[0])
      : item.photo && !item.photo.includes('picsum') ? buildImageUri(item.photo) : null;

    const typeLabel = TYPE_LABELS[item.type] || item.type;

    const chips = [
      item.capacity ? `${item.capacity} asientos` : null,
      item.color || null,
      item.year ? String(item.year) : null,
      typeLabel || null,
    ].filter(Boolean);

    const featureIcons = [
      item.features?.ac      && { name: 'snow-outline',     label: 'AC' },
      item.features?.music   && { name: 'musical-notes-outline', label: 'Música' },
      item.features?.pets    && { name: 'paw-outline',       label: 'Mascotas' },
      item.features?.luggage && { name: 'briefcase-outline', label: 'Equipaje' },
    ].filter(Boolean);

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.navigate('VehicleForm', { vehicle: item })}
        activeOpacity={0.85}
      >
        {/* Image */}
        <View style={[styles.imageWrapper, { backgroundColor: ui.bg }]}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              {/* Sin fotos, la imagen del tipo. El ícono genérico de auto hacía que una
                  camioneta y un sedán sin fotos se vieran idénticos en la lista. */}
              <Image source={imageForType(item.type)} style={styles.imagePlaceholderImg} resizeMode="contain" />
            </View>
          )}


        </View>

        {/* Content */}
        <View style={styles.content}>
          {/* Name + plate */}
          <View style={styles.titleRow}>
            <Text style={[styles.vehicleName, { color: textPrimary }]} numberOfLines={1}>
              {item.year} {item.brand} {item.model}
            </Text>
            <Text style={[styles.plate, { color: textSecondary }]}>
              {item.licensePlate}
            </Text>
          </View>

          {/* Chips */}
          <View style={styles.chipsRow}>
            {chips.map((chip) => (
              <View key={chip} style={[styles.chip, { backgroundColor: chipBg }]}>
                <Text style={[styles.chipText, { color: textSecondary }]}>{chip}</Text>
              </View>
            ))}
          </View>

          {/* Feature icons */}
          {featureIcons.length > 0 && (
            <View style={styles.featuresRow}>
              {featureIcons.map((f) => (
                <View key={f.name} style={styles.featureItem}>
                  <Ionicons name={f.name} size={13} color={textMuted} />
                  <Text style={[styles.featureText, { color: textMuted }]}>{f.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Acciones */}
          <View style={[styles.actionsRow, { borderTopColor: border }]}>
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: border }]}
              onPress={(e) => { e.stopPropagation(); navigation.navigate('VehicleForm', { vehicle: item }); }}
              activeOpacity={0.7}
            >
              <Ionicons name="create-outline" size={16} color={textPrimary} />
              <Text style={[styles.actionBtnText, { color: textPrimary }]}>Editar</Text>
            </TouchableOpacity>
            <View style={[styles.actionDivider, { backgroundColor: border }]} />
            <TouchableOpacity
              style={[styles.actionBtn, { borderColor: border }]}
              onPress={(e) => { e.stopPropagation(); handleDelete(item._id); }}
              activeOpacity={0.7}
            >
              {/* Sin rojo: el destructivo se confirma igual con el diálogo de handleDelete. */}
              <Ionicons name="trash-outline" size={16} color={textMuted} />
              <Text style={[styles.actionBtnText, { color: textMuted }]}>Eliminar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textPrimary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {vehicles.length > 0 ? (
        <FlatList
          data={vehicles}
          renderItem={renderItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.35}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.listFooter}>
                <ActivityIndicator size="small" color={textMuted} />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={textMuted}
              colors={[textPrimary]}
            />
          }
        />
      ) : (
        <View style={styles.empty}>
          <Image
            source={require('../../../../assets/illustrations/empty-vehicles.png')}
            style={styles.emptyIllustration}
            resizeMode="contain"
          />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin vehículos</Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
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
      >
        <Ionicons name="add" size={28} color={ui.invertText} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 120 },
  listFooter:  { paddingVertical: 20, alignItems: 'center' },

  card: {
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },

  // Image
  imageWrapper: {
    width: '100%',
    height: 190,
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: 190,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imagePlaceholderImg: { width: '55%', height: '75%' },

  // Content
  content: {
    padding: 14,
    gap: 10,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  vehicleName: {
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
    flex: 1,
  },
  plate: {
    fontSize: 13,
    fontFamily: 'Sora_500Medium',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontFamily: 'Sora_500Medium',
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  featureText: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    marginTop: 4,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 11,
  },
  actionBtnText: {
    fontSize: 14,
    fontFamily: 'Sora_500Medium',
  },
  actionDivider: {
    width: 1,
    marginVertical: 8,
  },

  // Empty
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    gap: 12,
  },
  emptyIllustration: { width: 220, height: 220, marginBottom: 4 },
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
