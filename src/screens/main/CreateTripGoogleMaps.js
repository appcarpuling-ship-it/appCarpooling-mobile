import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import SafePlacesAutocomplete from '../../components/SafePlacesAutocomplete';
import * as Location from 'expo-location';
import { get_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { spacing } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

// API Key
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const CreateTripGoogleMaps = ({ navigation, route }) => {
  const { colors } = useColors();
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const isMounted = useRef(true);
  const originDebounceTimer = useRef(null);
  const destinationDebounceTimer = useRef(null);

  // Estados principales
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);

  // Estados del mapa
  const [region, setRegion] = useState({
    latitude: -34.6037,
    longitude: -58.3816,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);

  // Estado del formulario (solo origen y destino)
  const [formData, setFormData] = useState({
    origin: {
      address: '',
      city: '',
      province: '',
      coordinates: null,
    },
    destination: {
      address: '',
      city: '',
      province: '',
      coordinates: null,
    },
  });

  useEffect(() => {
    isMounted.current = true;
    loadVehicles();
    getCurrentLocation();

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('❌ GOOGLE_MAPS_API_KEY no está configurada');
      Alert.alert('Error', 'La API Key de Google Maps no está configurada');
    }

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (originMarker && destinationMarker && isMounted.current) {
      getDirections();
    }
  }, [originMarker, destinationMarker]);

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!isMounted.current) return;

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };

      setRegion(newRegion);

      if (mapRef.current && isMounted.current) {
        setTimeout(() => {
          if (mapRef.current && isMounted.current) {
            mapRef.current.animateToRegion(newRegion, 1000);
          }
        }, 500);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const loadVehicles = async () => {
    try {
      if (!isMounted.current) return;

      setLoadingVehicles(true);
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);

      if (!isMounted.current) return;

      if (response && response.success && Array.isArray(response.data)) {
        setVehicles(response.data);
      } else {
        setVehicles([]);
      }
    } catch (error) {
      console.error('❌ Error loading vehicles:', error);
      if (isMounted.current) {
        setVehicles([]);
      }
    } finally {
      if (isMounted.current) {
        setLoadingVehicles(false);
      }
    }
  };

  const getDirections = async () => {
    if (!originMarker || !destinationMarker || !isMounted.current) return;

    setLoadingRoute(true);
    
    try {
      const origin = `${originMarker.latitude},${originMarker.longitude}`;
      const destination = `${destinationMarker.latitude},${destinationMarker.longitude}`;
      
      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);

      if (!isMounted.current) return;

      const data = await response.json();

      if (!isMounted.current) return;

      if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        if (route.overview_polyline && route.overview_polyline.points) {
          const points = decodePolyline(route.overview_polyline.points);
          setRouteCoordinates(points);

          if (route.legs && route.legs[0]) {
            const leg = route.legs[0];
            if (leg.distance) setDistance(leg.distance.text);
            if (leg.duration) setDuration(leg.duration.text);
          }

          if (mapRef.current && isMounted.current && points.length > 0) {
            setTimeout(() => {
              if (mapRef.current && isMounted.current) {
                mapRef.current.fitToCoordinates(points, {
                  edgePadding: { top: 100, right: 50, bottom: 200, left: 50 },
                  animated: true,
                });
              }
            }, 300);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error getting directions:', error);
    } finally {
      if (isMounted.current) {
        setLoadingRoute(false);
      }
    }
  };

  const decodePolyline = (encoded) => {
    if (!encoded) return [];

    const points = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b;
      let shift = 0;
      let result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charAt(index++).charCodeAt(0) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  const handleOriginSelect = (data, details = null) => {
    try {
      if (!isMounted.current) return;

      if (details?.geometry?.location) {
        const coords = {
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
        };

        setOriginMarker(coords);

        let city = '';
        let province = '';

        if (Array.isArray(details.address_components)) {
          details.address_components.forEach(component => {
            if (Array.isArray(component?.types)) {
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name || '';
              }
              if (component.types.includes('administrative_area_level_1')) {
                province = component.long_name || '';
              }
            }
          });
        }

        setFormData(prev => ({
          ...prev,
          origin: {
            address: data?.description || '',
            city: city,
            province: province,
            coordinates: coords,
          },
        }));

        if (mapRef.current && isMounted.current) {
          setTimeout(() => {
            if (mapRef.current && isMounted.current) {
              mapRef.current.animateToRegion({
                ...coords,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
              }, 1000);
            }
          }, 300);
        }
      }
    } catch (error) {
      console.error('❌ Error en handleOriginSelect:', error);
    }
  };

  const handleDestinationSelect = (data, details = null) => {
    try {
      if (!isMounted.current) return;

      if (details?.geometry?.location) {
        const coords = {
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
        };

        setDestinationMarker(coords);

        let city = '';
        let province = '';

        if (Array.isArray(details.address_components)) {
          details.address_components.forEach(component => {
            if (Array.isArray(component?.types)) {
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name || '';
              }
              if (component.types.includes('administrative_area_level_1')) {
                province = component.long_name || '';
              }
            }
          });
        }

        setFormData(prev => ({
          ...prev,
          destination: {
            address: data?.description || '',
            city: city,
            province: province,
            coordinates: coords,
          },
        }));
      }
    } catch (error) {
      console.error('❌ Error en handleDestinationSelect:', error);
    }
  };

  const handleContinueToDetails = () => {
    if (!originMarker || !destinationMarker) {
      Alert.alert('Datos incompletos', 'Por favor selecciona origen y destino');
      return;
    }
    
    // Navegar a la nueva pantalla con los datos de origen y destino
    navigation.navigate('TripDetails', {
      origin: formData.origin,
      destination: formData.destination,
      distance: distance,
      duration: duration,
      vehicles: vehicles,
    });
  };

  const clearOrigin = () => {
    if (!isMounted.current) return;

    setOriginMarker(null);
    setRouteCoordinates([]);
    setDistance(null);
    setDuration(null);
    setFormData(prev => ({
      ...prev,
      origin: {
        address: '',
        city: '',
        province: '',
        coordinates: null,
      },
    }));
    if (originInputRef.current && originInputRef.current.setAddressText) {
      try {
        originInputRef.current.setAddressText('');
      } catch (e) {
        console.log('Error clearing origin input:', e);
      }
    }
  };

  const clearDestination = () => {
    if (!isMounted.current) return;

    setDestinationMarker(null);
    setRouteCoordinates([]);
    setDistance(null);
    setDuration(null);
    setFormData(prev => ({
      ...prev,
      destination: {
        address: '',
        city: '',
        province: '',
        coordinates: null,
      },
    }));
    if (destinationInputRef.current && destinationInputRef.current.setAddressText) {
      try {
        destinationInputRef.current.setAddressText('');
      } catch (e) {
        console.log('Error clearing destination input:', e);
      }
    }
  };

  if (loadingVehicles) {
    return (
      <LinearGradient colors={[colors.background, colors.surface]} style={styles.emptyContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cargando vehículos...</Text>
      </LinearGradient>
    );
  }

  if (!loadingVehicles && (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0)) {
    return (
      <LinearGradient colors={[colors.background, colors.surface]} style={styles.emptyContainer}>
        <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tienes vehículos registrados</Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          Necesitas registrar un vehículo antes de crear un viaje
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Vehicles')}>
          <View style={[styles.addVehicleButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.addVehicleButtonText}>Agregar Vehículo</Text>
          </View>
        </TouchableOpacity>
      </LinearGradient>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={styles.map}
          region={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation={false}
          showsMyLocationButton={false}
        >
          {originMarker && (
            <Marker
              coordinate={originMarker}
              title="Origen"
              pinColor="#007AFF"
            />
          )}
          {destinationMarker && (
            <Marker
              coordinate={destinationMarker}
              title="Destino"
              pinColor="#FF3B30"
            />
          )}
          {routeCoordinates && routeCoordinates.length > 0 && (
            <Polyline
              coordinates={routeCoordinates}
              strokeWidth={4}
              strokeColor="#007AFF"
            />
          )}
        </MapView>

        <View style={styles.searchContainer}>
          <View style={styles.searchCard}>
            <View style={styles.searchRow}>
              <Ionicons name="location" size={20} color="#007AFF" style={styles.searchIcon} />
              <SafePlacesAutocomplete
                inputRef={originInputRef}
                placeholder="¿Desde dónde sales?"
                onPress={handleOriginSelect}
                apiKey={GOOGLE_MAPS_API_KEY}
                debounce={2000}
                styles={{
                  container: { flex: 1 },
                  textInput: {
                    height: 40,
                    color: '#000',
                    fontSize: 15,
                    backgroundColor: 'transparent',
                    paddingHorizontal: 8,
                  },
                  listView: {
                    position: 'absolute',
                    top: 50,
                    left: -40,
                    right: 0,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    elevation: 5,
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    maxHeight: 200,
                    zIndex: 1000,
                  },
                  row: { padding: 13, height: 50 },
                  separator: { height: 1, backgroundColor: '#E5E5E5' },
                  description: { fontSize: 14, color: '#000' },
                }}
              />
              {formData.origin.address && (
                <TouchableOpacity onPress={clearOrigin} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.searchRow}>
              <Ionicons name="flag" size={20} color="#FF3B30" style={styles.searchIcon} />
              <SafePlacesAutocomplete
                inputRef={destinationInputRef}
                placeholder="¿A dónde vas?"
                onPress={handleDestinationSelect}
                apiKey={GOOGLE_MAPS_API_KEY}
                debounce={2000}
                styles={{
                  container: { flex: 1 },
                  textInput: {
                    height: 40,
                    color: '#000',
                    fontSize: 15,
                    backgroundColor: 'transparent',
                    paddingHorizontal: 8,
                  },
                  listView: {
                    position: 'absolute',
                    top: 50,
                    left: -40,
                    right: 0,
                    backgroundColor: 'white',
                    borderRadius: 8,
                    elevation: 5,
                    shadowColor: '#000',
                    shadowOpacity: 0.2,
                    shadowRadius: 8,
                    shadowOffset: { width: 0, height: 2 },
                    maxHeight: 200,
                    zIndex: 1000,
                  },
                  row: { padding: 13, height: 50 },
                  separator: { height: 1, backgroundColor: '#E5E5E5' },
                  description: { fontSize: 14, color: '#000' },
                }}
              />
              {formData.destination.address && (
                <TouchableOpacity onPress={clearDestination} style={styles.clearButton}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.locationButton} onPress={getCurrentLocation}>
          <Ionicons name="locate" size={24} color="#007AFF" />
        </TouchableOpacity>

        {originMarker && destinationMarker && (
          <View style={styles.routeInfoCard}>
            {distance && duration && (
              <View style={styles.routeInfoRow}>
                <View style={styles.routeInfoItem}>
                  <Ionicons name="navigate" size={24} color="#007AFF" />
                  <Text style={styles.routeInfoValue}>{distance}</Text>
                  <Text style={styles.routeInfoLabel}>Distancia</Text>
                </View>
                <View style={styles.routeInfoItem}>
                  <Ionicons name="time" size={24} color="#FF3B30" />
                  <Text style={styles.routeInfoValue}>{duration}</Text>
                  <Text style={styles.routeInfoLabel}>Duración estimada</Text>
                </View>
              </View>
            )}

            <View style={styles.routeInfoButtons}>
              <TouchableOpacity 
                style={styles.editRouteButton} 
                onPress={() => {
                  clearOrigin();
                  clearDestination();
                }}
              >
                <Ionicons name="create-outline" size={20} color="#007AFF" />
                <Text style={styles.editRouteButtonText}>Editar Ruta</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.continueButton} onPress={handleContinueToDetails}>
                <Text style={styles.continueButtonText}>Continuar</Text>
                <Ionicons name="arrow-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {loadingRoute && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  mapContainer: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  searchContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 16,
    right: 16,
    zIndex: 100,
  },
  searchCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
    minHeight: 44,
  },
  searchIcon: { marginRight: 8 },
  clearButton: { padding: 4, marginLeft: 8 },
  locationButton: {
    position: 'absolute',
    bottom: 180,
    right: 16,
    backgroundColor: '#fff',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  routeInfoCard: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    right: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  routeInfoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 16 },
  routeInfoItem: { alignItems: 'center' },
  routeInfoValue: { fontSize: 18, fontWeight: '600', color: '#000', marginTop: 4 },
  routeInfoLabel: { fontSize: 12, color: '#666', marginTop: 2 },
  routeInfoButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editRouteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  editRouteButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  continueButton: {
    flex: 1,
    backgroundColor: '#007AFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    paddingVertical: 14,
  },
  continueButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginRight: 8 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    padding: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 24,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
  },
  addVehicleButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 32,
  },
  addVehicleButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default CreateTripGoogleMaps;