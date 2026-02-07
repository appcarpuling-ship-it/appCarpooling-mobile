import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Animated,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { get_withauth, delete_withauth, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import {  gradients, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import { useColors } from '../../hooks/useColors';

// Componente separado para el item del vehículo
const VehicleItem = ({ item, index, navigation, onDelete }) => {
  const { colors, getCurrentThemeMode } = useColors();
  
  const itemFadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(itemFadeAnim, {
      toValue: 1,
      duration: 600,
      delay: index * 100,
      useNativeDriver: true,
    }).start();
  }, []);

  // Obtener primera foto
  const firstPhoto = item.photos && item.photos.length > 0 ? item.photos[0] : null;
  const photoUrl = firstPhoto ? buildImageUri(firstPhoto) : null;

  return (
    <Animated.View style={{ opacity: itemFadeAnim }}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => navigation.navigate('VehicleForm', { vehicle: item })}
      >
        <View
          style={[styles.vehicleCard, { 
            backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, 
            borderColor: getCurrentThemeMode() === 'dark' ? '#404040' : colors.border 
          }]}
        >
          <View style={styles.vehicleContent}>
            {photoUrl ? (
              <Image
                source={{ uri: photoUrl }}
                style={styles.vehiclePhoto}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[styles.vehicleIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.surface }]}
              >
                <Ionicons name="car-sport" size={28} color="#292929" />
              </View>
            )}

            <View style={styles.vehicleInfo}>
              <Text style={[styles.vehicleName, { color: colors.textPrimary }]}>
                {item.brand} {item.model}
              </Text>
              <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                  <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.vehicleDetails, { color: colors.textSecondary }]}>{item.year}</Text>
                </View>
                {item.color && (
                  <View style={styles.detailItem}>
                    <Ionicons name="color-palette-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.vehicleDetails, { color: colors.textSecondary }]}>{item.color}</Text>
                  </View>
                )}
              </View>
              <View style={styles.plateContainer}>
                <Ionicons name="card-outline" size={14} color="#292929" />
                <Text style={[styles.vehiclePlate, { color: colors.textPrimary }]}>{item.licensePlate || item.plate}</Text>
              </View>
              {item.capacity && (
                <View style={styles.capacityContainer}>
                  <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
                  <Text style={[styles.capacityText, { color: colors.textSecondary }]}>{item.capacity} pasajeros</Text>
                </View>
              )}
            </View>

            <View style={styles.actionsContainer}>
              <TouchableOpacity
                style={styles.editButton}
                onPress={(e) => {
                  e.stopPropagation();
                  navigation.navigate('VehicleForm', { vehicle: item });
                }}
              >
                <Ionicons name="create-outline" size={22} color="#292929" />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={(e) => {
                  e.stopPropagation();
                  onDelete(item._id);
                }}
              >
                <Ionicons name="trash-outline" size={22} color={colors.error} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const VehiclesScreen = () => {
  const navigation = useNavigation();
  const { colors, getCurrentThemeMode } = useColors();
  
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadVehicles();
  }, []);

  useEffect(() => {
    if (!loading && vehicles.length > 0) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }).start();
    }
  }, [loading, vehicles]);

  // Escuchar parámetros de navegación para refrescar
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      const { params } = navigation.getState().routes.find(route => route.name === 'Vehicles') || {};
      if (params?.refreshVehicles) {
        console.log('🚗 [VehiclesScreen] Refrescando vehículos por parámetro');
        loadVehicles();
        // Limpiar el parámetro
        navigation.setParams({ refreshVehicles: false });
      }
    });

    return unsubscribe;
  }, [navigation]);

  // Recargar vehículos cuando la pantalla se enfoca
  useFocusEffect(
    useCallback(() => {
      loadVehicles();
    }, [])
  );

  const loadVehicles = async () => {
    try {
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (response.success) {
        setVehicles(response.data);
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudieron cargar los vehículos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadVehicles();
  };

  const handleDeleteVehicle = (vehicleId) => {
    Alert.alert(
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
                loadVehicles();
                Alert.alert('Éxito', 'Vehículo eliminado');
              }
            } catch (error) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderVehicleItem = ({ item, index }) => (
    <VehicleItem
      item={item}
      index={index}
      navigation={navigation}
      onDelete={handleDeleteVehicle}
    />
  );

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={getCurrentThemeMode() === 'dark' ? '#292929' : colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {vehicles.length > 0 ? (
        <FlatList
          data={vehicles}
          renderItem={renderVehicleItem}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#292929"
              colors={['#292929']}
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <View
            style={[styles.emptyIconContainer, { 
              backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.primary 
            }]}
          >
            <Ionicons name="car-sport-outline" size={48} color={getCurrentThemeMode() === 'dark' ? colors.textPrimary : '#FFFFFF'} />
          </View>
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>No tienes vehículos registrados</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
            Agrega tu primer vehículo para crear viajes
          </Text>
        </View>
      )}

      <TouchableOpacity
        style={styles.fabContainer}
        onPress={() => navigation.navigate('VehicleForm')}
        activeOpacity={0.8}
      >
        <View
          style={[styles.fab, { 
            backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.primary 
          }]}
        >
          <Ionicons name="add" size={32} color="#FFFFFF" />
        </View>
      </TouchableOpacity>
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
  listContent: {
    padding: spacing.lg,
  },
  vehicleCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  vehicleContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  vehiclePhoto: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
  },
  vehicleIcon: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  vehicleInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  vehicleName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    marginBottom: spacing.xs,
  },
  detailsRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  vehicleDetails: {
    fontSize: fontSize.sm,
  },
  plateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  vehiclePlate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semiBold,
  },
  capacityContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  capacityText: {
    fontSize: fontSize.sm,
  },
  actionsContainer: {
    flexDirection: 'column',
    gap: spacing.sm,
  },
  editButton: {
    padding: spacing.sm,
  },
  deleteButton: {
    padding: spacing.sm,
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
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.lg,
  },
  fab: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
});

export default VehiclesScreen;
