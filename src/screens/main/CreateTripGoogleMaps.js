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
  Keyboard,
  StatusBar,
  Animated,
  KeyboardAvoidingView,
  ScrollView,
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

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const CreateTripGoogleMaps = ({ navigation, route }) => {
  const { colors } = useColors();
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const isMounted = useRef(true);
  const originDebounceTimer = useRef(null);
  const destinationDebounceTimer = useRef(null);

  // Animated values
  const sheetTranslateY = useRef(new Animated.Value(300)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const handleBarWidth = useRef(new Animated.Value(0)).current;

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [activeAutocomplete, setActiveAutocomplete] = useState(null); // 'origin' | 'destination' | null
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
  const originResultsRef = useRef([]);
  const destinationResultsRef = useRef([]);

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

    // Animación de entrada del bottom sheet
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      tension: 50,
      friction: 9,
      useNativeDriver: true,
    }).start();

    // Animación del handle bar
    Animated.timing(handleBarWidth, {
      toValue: 40,
      duration: 600,
      delay: 300,
      useNativeDriver: false,
    }).start();

    // Keyboard listeners para ajustar la posición cuando aparece el teclado
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, (e) => {
      setKeyboardVisible(true);
      // Ajustar manualmente en ambas plataformas
      // Mover el bottom sheet hacia arriba solo lo necesario para que los inputs sean visibles
      const keyboardHeight = e.endCoordinates.height;
      // Ajustar el offset para que se vean ambos inputs bien
      // Mover aproximadamente el 70% de la altura del teclado, pero un poco menos para que quede más abajo
      const offset = -keyboardHeight * 0.7 - 10;
      Animated.timing(keyboardOffset, {
        toValue: offset,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
        useNativeDriver: true,
      }).start();
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardVisible(false);
      // Restaurar posición en ambas plataformas
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
        useNativeDriver: true,
      }).start();
    });

    return () => {
      isMounted.current = false;
      showSub.remove();
      hideSub.remove();
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
                  edgePadding: { top: 100, right: 50, bottom: 300, left: 50 },
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

  const hasRoute = originMarker && destinationMarker;

  // Estilos para listView - ambos inputs comparten el mismo estilo
  // El contenedor de predicciones debe estar justo arriba del contenedor completo de inputs (inputsWrapper)
  // Calculamos valores adaptativos basados en las dimensiones de la pantalla
  // El inputsWrapper tiene aproximadamente: timelineContainer (28px) + inputsContainer (97px) = 125px
  // Usamos un factor proporcional para adaptarse a diferentes tamaños de pantalla
  const getListViewStyle = () => {
    // Calcular altura del contenedor de inputs de forma adaptativa
    // timelineContainer: paddingTop (14) + paddingBottom (14) = 28px
    // inputsContainer: 2 inputs (48px cada uno) + divider (1px) = 97px
    // Total base: ~125px, pero ajustamos proporcionalmente según el ancho de pantalla
    const baseInputsHeight = 125;
    const scaleFactor = width / 375; // Factor de escala basado en iPhone estándar (375px)
    const adjustedBottom = baseInputsHeight * scaleFactor + 35; // +35 para espacio adicional arriba
    
    return {
      position: 'absolute',
      bottom: adjustedBottom, // Adaptativo según el tamaño de pantalla
      left: -44 * scaleFactor, // Adaptativo
      right: -20 * scaleFactor, // Adaptativo
      backgroundColor: '#F5F5F5', // Mismo color que el inputsContainer
      borderTopLeftRadius: 16,
      borderTopRightRadius: 16,
      borderBottomLeftRadius: 12, // Mismo radio que el contenedor de inputs para continuidad visual
      borderBottomRightRadius: 12,
      elevation: 10,
      shadowColor: '#000',
      shadowOpacity: 0.15,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: -6 },
      maxHeight: Math.min(280, height * 0.35), // Máximo 35% de la altura de pantalla o 280px
      zIndex: 5000,
    };
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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />

      {/* Mapa full screen */}
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
          <Marker coordinate={originMarker} title="Origen">
            <View style={styles.originMarkerContainer}>
              <View style={styles.originMarkerDot} />
            </View>
          </Marker>
        )}
        {destinationMarker && (
          <Marker coordinate={destinationMarker} title="Destino">
            <View style={styles.destinationMarkerContainer}>
              <View style={styles.destinationMarkerSquare} />
            </View>
          </Marker>
        )}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor="#000"
          />
        )}
      </MapView>


      {/* Botón mi ubicación */}
      {!keyboardVisible && (
        <TouchableOpacity style={styles.myLocationButton} onPress={getCurrentLocation}>
          <Ionicons name="navigate" size={20} color="#000" />
        </TouchableOpacity>
      )}

      {/* Panel inferior estilo Uber - Animated */}
      <Animated.View
        style={[
          styles.bottomSheetWrapper,
          {
            transform: [
              { translateY: sheetTranslateY },
              { translateY: keyboardOffset },
            ],
          },
        ]}
      >
            <View style={[
              styles.bottomSheet,
              keyboardVisible && styles.bottomSheetExpanded,
            ]}>
              {/* Handle animado */}
          {!keyboardVisible && (
            <View style={styles.handleBarContainer}>
              <Animated.View style={[styles.handleBar, { width: handleBarWidth }]} />
            </View>
          )}

         

          {/* Contenedor único compartido para resultados de autocompletado - ARRIBA del contenedor completo de inputs */}
          {activeAutocomplete && autocompleteResults.length > 0 && (
            <View 
              style={getListViewStyle()}
            >
              <ScrollView
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={false}
              >
                {autocompleteResults.map((item, index) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 12,
                      paddingHorizontal: 14,
                      minHeight: 52,
                      borderBottomWidth: 1,
                      borderBottomColor: '#F2F2F2',
                    }}
                    onPress={() => {
                      if (activeAutocomplete === 'origin') {
                        // Obtener detalles
                        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_MAPS_API_KEY}&language=es&fields=address_components,geometry,formatted_address`;
                        fetch(detailsUrl)
                          .then(res => res.json())
                          .then(data => {
                            if (data && data.result) {
                              handleOriginSelect({ description: item.description }, data.result);
                            }
                          });
                      } else {
                        // Obtener detalles
                        const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_MAPS_API_KEY}&language=es&fields=address_components,geometry,formatted_address`;
                        fetch(detailsUrl)
                          .then(res => res.json())
                          .then(data => {
                            if (data && data.result) {
                              handleDestinationSelect({ description: item.description }, data.result);
                            }
                          });
                      }
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 18,
                      backgroundColor: '#F0F0F0',
                      justifyContent: 'center',
                      alignItems: 'center',
                      marginRight: 12,
                    }}>
                      <Ionicons name="location-sharp" size={18} color="#666" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{
                        fontSize: 15,
                        fontWeight: '500',
                        color: '#000',
                      }} numberOfLines={1}>
                        {item.structured_formatting?.main_text || item.description}
                      </Text>
                      <Text style={{
                        fontSize: 13,
                        color: '#888',
                        marginTop: 2,
                      }} numberOfLines={1}>
                        {item.structured_formatting?.secondary_text || ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Contenedor de inputs con timeline */}
          <View style={styles.inputsWrapper}>
            {/* Timeline dots */}
            <View style={styles.timelineContainer}>
              <View style={styles.originDot} />
              <View style={styles.timelineLine} />
              <View style={styles.destinationSquare} />
            </View>

            {/* Inputs */}
            <View style={styles.inputsContainer}>
              {/* Origen */}
              <View style={[styles.inputRow, { zIndex: 3000 }]}>
                <SafePlacesAutocomplete
                  inputRef={originInputRef}
                  placeholder="¿Desde dónde sales?"
                  onPress={handleOriginSelect}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  debounce={2000}
                  inputType="origin"
                  onFocusChange={(type) => {
                    // Cuando este input recibe el foco, activarlo y mostrar sus resultados
                    if (type === 'origin') {
                      setActiveAutocomplete('origin');
                      setAutocompleteResults(originResultsRef.current);
                    } else {
                      // Si otro input recibe el foco, cambiar al otro y mostrar sus resultados
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                    }
                  }}
                  onResultsChange={(results) => {
                    // Guardar resultados en el ref correspondiente
                    originResultsRef.current = results;
                    // Si este input está activo, actualizar los resultados mostrados
                    if (activeAutocomplete === 'origin') {
                      setAutocompleteResults(results);
                    }
                  }}
                  externalResults={[]}
                  externalLoading={false}
                  styles={{
                    container: { flex: 1, zIndex: 3000 },
                    textInput: {
                      height: 44,
                      color: '#000',
                      fontSize: 16,
                      fontWeight: '500',
                      backgroundColor: 'transparent',
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                  }}
                />
                {formData.origin.address ? (
                  <TouchableOpacity onPress={clearOrigin} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#CACACA" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <View style={styles.inputDivider} />

              {/* Destino */}
              <View style={[styles.inputRow, { zIndex: 2000 }]}>
                <SafePlacesAutocomplete
                  inputRef={destinationInputRef}
                  placeholder="¿A dónde vas?"
                  onPress={handleDestinationSelect}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  debounce={2000}
                  inputType="destination"
                  onFocusChange={(type) => {
                    // Cuando este input recibe el foco, activarlo y mostrar sus resultados
                    if (type === 'destination') {
                      setActiveAutocomplete('destination');
                      setAutocompleteResults(destinationResultsRef.current);
                    } else {
                      // Si otro input recibe el foco, cambiar al otro y mostrar sus resultados
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                    }
                  }}
                  onResultsChange={(results) => {
                    // Guardar resultados en el ref correspondiente
                    destinationResultsRef.current = results;
                    // Si este input está activo, actualizar los resultados mostrados
                    if (activeAutocomplete === 'destination') {
                      setAutocompleteResults(results);
                    }
                  }}
                  externalResults={[]}
                  externalLoading={false}
                  styles={{
                    container: { flex: 1, zIndex: 2000 },
                    textInput: {
                      height: 44,
                      color: '#000',
                      fontSize: 16,
                      fontWeight: '500',
                      backgroundColor: 'transparent',
                      paddingHorizontal: 12,
                      paddingVertical: 0,
                    },
                  }}
                />
                {formData.destination.address ? (
                  <TouchableOpacity onPress={clearDestination} style={styles.clearBtn}>
                    <Ionicons name="close-circle" size={18} color="#CACACA" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          </View>

          {/* Info de ruta + botones cuando hay ruta */}
          {hasRoute && !keyboardVisible && (
            <View style={styles.routeSection}>
              <View style={styles.routeDivider} />

              {distance && duration && (
                <View style={styles.routeInfoRow}>
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="car-outline" size={20} color="#000" />
                    <Text style={styles.routeInfoValue}>{distance}</Text>
                  </View>
                  <View style={styles.routeInfoDot} />
                  <View style={styles.routeInfoItem}>
                    <Ionicons name="time-outline" size={20} color="#000" />
                    <Text style={styles.routeInfoValue}>{duration}</Text>
                  </View>
                </View>
              )}

              <View style={styles.routeButtons}>
                <TouchableOpacity
                  style={styles.editRouteBtn}
                  onPress={() => {
                    clearOrigin();
                    clearDestination();
                  }}
                >
                  <Text style={styles.editRouteBtnText}>Editar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.continueBtn}
                  onPress={handleContinueToDetails}
                  activeOpacity={0.8}
                >
                  <Text style={styles.continueBtnText}>Confirmar ruta</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
            </View>
          </Animated.View>

      {/* Loading overlay */}
      {loadingRoute && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#000" />
            <Text style={styles.loadingText}>Calculando ruta...</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },

  // Top bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  backButton: {
    marginLeft: 16,
    marginTop: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // My location
  myLocationButton: {
    position: 'absolute',
    right: 16,
    bottom: 280,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },

  // Bottom sheet
  bottomSheetWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    backgroundColor: '#fff',
    width: '100%',
  },
  bottomSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    overflow: 'visible',
  },
  bottomSheetExpanded: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingBottom: Platform.OS === 'ios' ? 50 : 36,
    marginBottom: 0,
  },
  handleBarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handleBar: {
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E0E0E0',
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000',
    marginBottom: 20,
  },

  // Inputs with timeline
  inputsWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'visible',
    zIndex: 1000,
  },
  timelineContainer: {
    width: 24,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#000',
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: '#E0E0E0',
    marginVertical: 4,
  },
  destinationSquare: {
    width: 10,
    height: 10,
    backgroundColor: '#000',
  },
  inputsContainer: {
    flex: 1,
    backgroundColor: '#F6F6F6',
    borderRadius: 12,
    overflow: 'visible',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingRight: 8,
    overflow: 'visible',
  },
  inputDivider: {
    height: 1,
    backgroundColor: '#E8E8E8',
    marginLeft: 12,
    marginRight: 12,
  },
  clearBtn: {
    padding: 6,
  },

  // Route section
  routeSection: {
    marginTop: 16,
  },
  routeDivider: {
    height: 1,
    backgroundColor: '#F0F0F0',
    marginBottom: 16,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  routeInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeInfoDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#CCC',
    marginHorizontal: 12,
  },
  routeInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  routeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editRouteBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#F0F0F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRouteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  continueBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },

  // Custom markers
  originMarkerContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  originMarkerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
  },
  destinationMarkerContainer: {
    width: 24,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  destinationMarkerSquare: {
    width: 12,
    height: 12,
    backgroundColor: '#000',
    borderWidth: 2,
    borderColor: '#fff',
  },

  // Loading
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  loadingBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },

  // Empty states
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
