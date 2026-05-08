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
import RemoteImageWithLoader from '../../../components/RemoteImageWithLoader';

const VehiclesScreen = () => {
  const navigation = useNavigation();
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const bg      = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg  = isDarkMode ? '#222222' : '#FFFFFF';
  const border  = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';

  const [vehicles, setVehicles] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const fetchLock = useRef(false);
  const hasDataRef = useRef(false);

  useEffect(() => {
    hasDataRef.current = vehicles.length > 0;
  }, [vehicles.length]);

  useFocusEffect(
    useCallback(() => {
      loadVehicles(1, true, { skipMainLoading: hasDataRef.current });
    }, [])
  );

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
      showAlert('Error', 'No se pudieron cargar los vehículos');
      if (reset || pageNum === 1) setVehicles([]);
    } finally {
      fetchLock.current = false;
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

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
              showAlert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderItem = ({ item }) => {
    const photoUrl = item.photos?.length > 0 ? buildImageUri(item.photos[0]) : null;

    return (
      <TouchableOpacity
        style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
        onPress={() => navigation.navigate('VehicleForm', { vehicle: item })}
        activeOpacity={0.7}
      >
        {photoUrl ? (
          <RemoteImageWithLoader
            uri={photoUrl}
            style={styles.photo}
            isDarkMode={isDarkMode}
            spinnerColor={textPrimary}
          />
        ) : (
          <View style={[styles.photoPlaceholder, { backgroundColor: divider }]}>
            <Ionicons name="car-sport-outline" size={28} color={textMuted} />
          </View>
        )}

        <View style={styles.info}>
          <Text style={[styles.vehicleName, { color: textPrimary }]}>
            {item.brand} {item.model}
          </Text>

          <View style={styles.metaRow}>
            {item.year ? (
              <View style={styles.metaItem}>
                <Ionicons name="calendar-outline" size={13} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{item.year}</Text>
              </View>
            ) : null}
            {item.color ? (
              <View style={styles.metaItem}>
                <Ionicons name="color-palette-outline" size={13} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{item.color}</Text>
              </View>
            ) : null}
            {item.capacity ? (
              <View style={styles.metaItem}>
                <Ionicons name="people-outline" size={13} color={textMuted} />
                <Text style={[styles.metaText, { color: textMuted }]}>{item.capacity} pas.</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.plateBadge, { backgroundColor: divider }]}>
            <Text style={[styles.plateText, { color: textPrimary }]}>
              {item.licensePlate || item.plate}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: divider }]}
            onPress={(e) => { e.stopPropagation(); navigation.navigate('VehicleForm', { vehicle: item }); }}
            activeOpacity={0.7}
          >
            <Ionicons name="create-outline" size={18} color={textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: isDarkMode ? '#3D1A1A' : '#FEE2E2' }]}
            onPress={(e) => { e.stopPropagation(); handleDelete(item._id); }}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={18} color={isDarkMode ? '#F87171' : '#DC2626'} />
          </TouchableOpacity>
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
                <ActivityIndicator size="small" color={textPrimary} />
                <Text style={[styles.listFooterText, { color: textMuted }]}>Cargando más…</Text>
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
        style={[styles.fab, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
        onPress={() => navigation.navigate('VehicleForm')}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={28} color={isDarkMode ? '#000000' : '#FFFFFF'} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },
  listContent: { padding: 16, paddingBottom: 100 },
  listFooter: {
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
  },
  listFooterText: { fontSize: 13 },

  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
    gap: 12,
  },
  photo: {
    width: 72,
    height: 72,
    borderRadius: 10,
  },
  photoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  info: {
    flex: 1,
    gap: 6,
  },
  vehicleName: {
    fontSize: 15,
    fontWeight: '600',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 13,
  },
  plateBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  plateText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  actions: {
    gap: 8,
  },
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },

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
  emptyTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
  },

  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default VehiclesScreen;
