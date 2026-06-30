import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { get_withauth, delete_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useColors } from '../../../hooks/useColors';
import { useAlert } from '../../../context/AlertContext';
import { LIST_PAGE_SIZE } from '../../../constants/pagination';
import { Image } from 'react-native';

const TYPE_LABELS = {
  sedan: 'Sedán',
  suv: 'SUV',
  hatchback: 'Hatchback',
  van: 'Van',
  pickup: 'Pickup',
  otro: 'Otro',
};

const VehiclesScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const bg         = isDarkMode ? '#161616' : '#F0F2F5';
  const cardBg     = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border     = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary   = isDarkMode ? '#FFFFFF' : '#111827';
  const textMuted     = isDarkMode ? '#6B7280' : '#9CA3AF';
  const textSecondary = isDarkMode ? '#9CA3AF' : '#6B7280';
  const chipBg        = isDarkMode ? '#2A2A2A' : '#F3F4F6';

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
    } catch {
      showAlert('Ocurrió algo', 'No se pudieron cargar los vehículos');
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
    showAlert(
      'Eliminar Vehículo',
      '¿Estás seguro que deseas eliminar este vehículo?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await delete_withauth(ENDPOINTS.DELETE_VEHICLE(vehicleId));
              if (response.success) {
                loadVehicles(1, true, { skipMainLoading: true });
              }
            } catch (error) {
              showAlert('Ocurrió algo', error.message);
            }
          },
        },
      ]
    );
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
        <View style={[styles.imageWrapper, { backgroundColor: isDarkMode ? '#2A2A2A' : '#F3F4F6' }]}>
          {photoUrl ? (
            <Image
              source={{ uri: photoUrl }}
              style={styles.image}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.imagePlaceholder}>
              <Ionicons name="car-sport-outline" size={48} color={textMuted} />
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
              <Ionicons name="trash-outline" size={16} color={isDarkMode ? '#F87171' : '#DC2626'} />
              <Text style={[styles.actionBtnText, { color: isDarkMode ? '#F87171' : '#DC2626' }]}>Eliminar</Text>
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
          <View style={[styles.emptyIcon, { backgroundColor: cardBg, borderColor: border }]}>
            <Ionicons name="car-sport-outline" size={40} color={textMuted} />
          </View>
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin vehículos</Text>
          <Text style={[styles.emptySubtitle, { color: textMuted }]}>
            Agrega tu primer vehículo para crear viajes
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: isDarkMode ? '#FFFFFF' : '#111827' }]}
        onPress={() => navigation.navigate('VehicleForm')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={isDarkMode ? '#111827' : '#FFFFFF'} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 100 },
  listFooter:  { paddingVertical: 20, alignItems: 'center' },

  card: {
    borderRadius: 16,
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
    fontWeight: '700',
    flex: 1,
  },
  plate: {
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '500',
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
    fontWeight: '500',
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
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle:    { fontSize: 17, fontWeight: '600' },
  emptySubtitle: { fontSize: 14, textAlign: 'center' },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
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
