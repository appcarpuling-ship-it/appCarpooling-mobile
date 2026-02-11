import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
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
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import SafePlacesAutocomplete from '../../components/SafePlacesAutocomplete';
import * as Location from 'expo-location';
import { get_withauth } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import { useColors } from '../../hooks/useColors';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

const CreateTripGoogleMaps = ({ navigation, route }) => {
  const { colors, isDarkMode } = useColors();
  const mapRef = useRef(null);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const waypointInputRefs = useRef([]);
  const isMounted = useRef(true);
  const originDebounceTimer = useRef(null);
  const destinationDebounceTimer = useRef(null);
  const waypointDebounceTimers = useRef([]);

  // Bottom sheet: 'mini' = compacto, 'full' = expandido (input activo o resultados)
  const sheetMode = activeAutocomplete !== null ? 'full' : 'mini';
  const sheetHeight = useRef(new Animated.Value(0)).current; // 0 = mini, 1 = full

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [activeAutocomplete, setActiveAutocomplete] = useState(null);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const originResultsRef = useRef([]);
  const destinationResultsRef = useRef([]);
  const waypointResultsRef = useRef([]);

  const [region, setRegion] = useState({
    latitude: -34.6037,
    longitude: -58.3816,
    latitudeDelta: LATITUDE_DELTA,
    longitudeDelta: LONGITUDE_DELTA,
  });
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [waypointMarkers, setWaypointMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [mapSelectionMode, setMapSelectionMode] = useState(null); // 'origin' | 'destination' | 'waypoint-N' | null

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
    waypoints: [],
  });

  const MIN_SHEET_HEIGHT = 200;
  const MAX_SHEET_HEIGHT = height * 0.7;
  // Con teclado abierto: limitar altura para que origen/destino queden visibles
  const effectiveMaxHeight = keyboardHeight > 0
    ? Math.min(MAX_SHEET_HEIGHT, height - keyboardHeight - 80)
    : MAX_SHEET_HEIGHT;

  useEffect(() => {
    isMounted.current = true;
    loadVehicles();
    getCurrentLocation();

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('❌ GOOGLE_MAPS_API_KEY no está configurada');
      Alert.alert('Error', 'La API Key de Google Maps no está configurada');
    }

    // Animación de entrada inicial (mini)
    Animated.spring(sheetHeight, {
      toValue: 0,
      tension: 50,
      friction: 9,
      useNativeDriver: false,
    }).start();

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, (e) => setKeyboardHeight(e.endCoordinates.height));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));

    return () => {
      isMounted.current = false;
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Animación del sheet según activeAutocomplete
  useEffect(() => {
    const target = activeAutocomplete !== null ? 1 : 0;
    Animated.timing(sheetHeight, {
      toValue: target,
      duration: 280,
      useNativeDriver: false,
    }).start();
  }, [activeAutocomplete]);

  useEffect(() => {
    if (originMarker && destinationMarker && isMounted.current) {
      getDirections();
    }
  }, [originMarker, destinationMarker, waypointMarkers]);

  const screenWasBlurred = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (screenWasBlurred.current) {
        setActiveAutocomplete(null);
        setAutocompleteResults([]);
        screenWasBlurred.current = false;
      }
      return () => { screenWasBlurred.current = true; };
    }, [])
  );

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
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude });

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
      
      // Construir waypoints si existen
      let waypointsParam = '';
      if (waypointMarkers.length > 0) {
        const waypointCoords = waypointMarkers
          .filter(waypoint => waypoint && waypoint.latitude && waypoint.longitude)
          .map(waypoint => `${waypoint.latitude},${waypoint.longitude}`);
        
        if (waypointCoords.length > 0) {
          waypointsParam = `&waypoints=${waypointCoords.join('|')}`;
        }
      }

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}${waypointsParam}&key=${GOOGLE_MAPS_API_KEY}`;

      const response = await fetch(url);

      if (!isMounted.current) return;

      const data = await response.json();

      if (!isMounted.current) return;

      if (data.routes && Array.isArray(data.routes) && data.routes.length > 0) {
        const route = data.routes[0];
        if (route.overview_polyline && route.overview_polyline.points) {
          const points = decodePolyline(route.overview_polyline.points);
          setRouteCoordinates(points);

          if (route.legs && route.legs.length > 0) {
            // Sumar todos los legs (tramos) para obtener distancia y duración total
            let totalDistanceValue = 0;
            let totalDurationValue = 0;
            let distanceText = '';
            let durationText = '';
            
            route.legs.forEach(leg => {
              if (leg.distance && leg.distance.value) {
                totalDistanceValue += leg.distance.value;
              }
              if (leg.duration && leg.duration.value) {
                totalDurationValue += leg.duration.value;
              }
            });
            
            // Convertir metros a km
            if (totalDistanceValue >= 1000) {
              distanceText = `${(totalDistanceValue / 1000).toFixed(1)} km`;
            } else {
              distanceText = `${totalDistanceValue} m`;
            }
            
            // Convertir segundos a minutos/horas
            if (totalDurationValue >= 3600) {
              const hours = Math.floor(totalDurationValue / 3600);
              const minutes = Math.floor((totalDurationValue % 3600) / 60);
              durationText = `${hours}h ${minutes}min`;
            } else {
              const minutes = Math.floor(totalDurationValue / 60);
              durationText = `${minutes} min`;
            }
            
            setDistance(distanceText);
            setDuration(durationText);
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

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}&language=es`;
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        const result = data.results[0];
        
        let city = '';
        let province = '';
        let street = '';
        let streetNumber = '';
        
        if (Array.isArray(result.address_components)) {
          result.address_components.forEach(component => {
            if (Array.isArray(component?.types)) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name || '';
              }
              if (component.types.includes('route')) {
                street = component.long_name || '';
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name || '';
              }
              if (component.types.includes('administrative_area_level_1')) {
                province = component.long_name || '';
              }
            }
          });
        }
        
        // Construir la dirección completa con número para usar en formatted_address
        const fullStreetAddress = [street, streetNumber].filter(Boolean).join(' ');
        // Si no hay componentes específicos de calle, usar la dirección completa formateada
        const addressToShow = fullStreetAddress || result.formatted_address?.split(',')[0]?.trim() || '';
        
        return {
          address: addressToShow,
          city: city,
          province: province,
          coordinates: { latitude, longitude },
        };
      }
    } catch (error) {
      console.error('Error in reverse geocoding:', error);
    }
    return null;
  };

  const handleMapPress = async (event) => {
    if (!mapSelectionMode) {
      Keyboard.dismiss();
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      return;
    }
    
    const { latitude, longitude } = event.nativeEvent.coordinate;
    const locationData = await reverseGeocode(latitude, longitude);
    
    if (!locationData) {
      Alert.alert('Error', 'No se pudo obtener la dirección de esta ubicación');
      return;
    }
    
    if (mapSelectionMode === 'origin') {
      setOriginMarker({ latitude, longitude });
      setFormData(prev => ({ ...prev, origin: locationData }));
      
      if (originInputRef.current?.setAddressText) {
        const fullAddressText = [locationData.address, locationData.city, locationData.province].filter(Boolean).join(', ');
        originInputRef.current.setAddressText(fullAddressText);
      }
    } else if (mapSelectionMode === 'destination') {
      setDestinationMarker({ latitude, longitude });
      setFormData(prev => ({ ...prev, destination: locationData }));
      
      if (destinationInputRef.current?.setAddressText) {
        const fullAddressText = [locationData.address, locationData.city, locationData.province].filter(Boolean).join(', ');
        destinationInputRef.current.setAddressText(fullAddressText);
      }
    } else if (mapSelectionMode.startsWith('waypoint-')) {
      const waypointIndex = parseInt(mapSelectionMode.split('-')[1]);
      
      setWaypointMarkers(prev => {
        const newMarkers = [...prev];
        newMarkers[waypointIndex] = { latitude, longitude };
        return newMarkers;
      });
      
      setFormData(prev => {
        const newWaypoints = [...prev.waypoints];
        newWaypoints[waypointIndex] = locationData;
        return { ...prev, waypoints: newWaypoints };
      });
      
      if (waypointInputRefs.current[waypointIndex]?.current?.setAddressText) {
        const fullAddressText = [locationData.address, locationData.city, locationData.province].filter(Boolean).join(', ');
        waypointInputRefs.current[waypointIndex].current.setAddressText(fullAddressText);
      }
    }
    
    setMapSelectionMode(null);
    
    if (mapRef.current) {
      mapRef.current.animateToRegion({
        latitude,
        longitude,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }, 1000);
    }
  };

  const addWaypoint = () => {
    if (formData.waypoints.length >= 3) {
      Alert.alert('Límite alcanzado', 'Máximo 3 paradas intermedias permitidas');
      return;
    }
    
    const newWaypoint = {
      address: '',
      city: '',
      province: '',
      coordinates: null,
    };
    
    setFormData(prev => ({
      ...prev,
      waypoints: [...prev.waypoints, newWaypoint]
    }));
    
    // Agregar refs para el nuevo waypoint
    const newRef = React.createRef();
    waypointInputRefs.current.push(newRef);
    waypointResultsRef.current.push([]);
    waypointDebounceTimers.current.push(null);
  };

  const removeWaypoint = (index) => {
    setFormData(prev => ({
      ...prev,
      waypoints: prev.waypoints.filter((_, i) => i !== index)
    }));
    
    setWaypointMarkers(prev => prev.filter((_, i) => i !== index));
    
    // Limpiar refs
    waypointInputRefs.current.splice(index, 1);
    waypointResultsRef.current.splice(index, 1);
    waypointDebounceTimers.current.splice(index, 1);
    
    // Si estaba activo este waypoint, limpiar autocomplete
    if (activeAutocomplete === `waypoint-${index}`) {
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
    }
    
    // Si estaba en modo de selección para este waypoint, cancelar
    if (mapSelectionMode === `waypoint-${index}`) {
      setMapSelectionMode(null);
    }
  };

  const handleWaypointSelect = (data, details, waypointIndex) => {
    try {
      if (!isMounted.current) return;

      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      Keyboard.dismiss();

      if (details?.geometry?.location) {
        const coords = {
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
        };

        // Actualizar marker de waypoint
        setWaypointMarkers(prev => {
          const newMarkers = [...prev];
          newMarkers[waypointIndex] = coords;
          return newMarkers;
        });

        let city = '';
        let province = '';
        let street = '';
        let streetNumber = '';

        if (Array.isArray(details.address_components)) {
          details.address_components.forEach(component => {
            if (Array.isArray(component?.types)) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name || '';
              }
              if (component.types.includes('route')) {
                street = component.long_name || '';
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name || '';
              }
              if (component.types.includes('administrative_area_level_1')) {
                province = component.long_name || '';
              }
            }
          });
        }

        // Construir la dirección completa con número
        const fullStreetAddress = [street, streetNumber].filter(Boolean).join(' ');
        
        const fullAddressText = [
          fullStreetAddress || data?.description?.split(',')[0] || '',
          city,
          province
        ].filter(Boolean).join(', ');

        setFormData(prev => {
          const newWaypoints = [...prev.waypoints];
          newWaypoints[waypointIndex] = {
            address: data?.description || '',
            city: city,
            province: province,
            coordinates: coords,
          };
          return {
            ...prev,
            waypoints: newWaypoints
          };
        });

        // Actualizar texto del input
        if (waypointInputRefs.current[waypointIndex]?.current?.setAddressText) {
          try {
            waypointInputRefs.current[waypointIndex].current.setAddressText(fullAddressText);
          } catch (e) {
            console.log(`Error setting waypoint ${waypointIndex} address text:`, e);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error en handleWaypointSelect:', error);
    }
  };

  const handleOriginSelect = (data, details = null) => {
    try {
      if (!isMounted.current) return;

      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      Keyboard.dismiss();

      if (details?.geometry?.location) {
        const coords = {
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
        };

        setOriginMarker(coords);

        let city = '';
        let province = '';
        let street = '';
        let streetNumber = '';

        if (Array.isArray(details.address_components)) {
          details.address_components.forEach(component => {
            if (Array.isArray(component?.types)) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name || '';
              }
              if (component.types.includes('route')) {
                street = component.long_name || '';
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name || '';
              }
              if (component.types.includes('administrative_area_level_1')) {
                province = component.long_name || '';
              }
            }
          });
        }

        // Construir la dirección completa con número
        const fullStreetAddress = [street, streetNumber].filter(Boolean).join(' ');
        
        // Construir el texto completo para el input: dirección, ciudad, provincia
        const fullAddressText = [
          fullStreetAddress || data?.description?.split(',')[0] || '',
          city,
          province
        ].filter(Boolean).join(', ');

        setFormData(prev => ({
          ...prev,
          origin: {
            address: data?.description || '',
            city: city,
            province: province,
            coordinates: coords,
          },
        }));

        // Actualizar el texto del input con la dirección completa
        if (originInputRef.current && originInputRef.current.setAddressText) {
          try {
            originInputRef.current.setAddressText(fullAddressText);
          } catch (e) {
            console.log('Error setting origin address text:', e);
          }
        }

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

      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      Keyboard.dismiss();

      if (details?.geometry?.location) {
        const coords = {
          latitude: details.geometry.location.lat,
          longitude: details.geometry.location.lng,
        };

        setDestinationMarker(coords);

        let city = '';
        let province = '';
        let street = '';
        let streetNumber = '';

        if (Array.isArray(details.address_components)) {
          details.address_components.forEach(component => {
            if (Array.isArray(component?.types)) {
              if (component.types.includes('street_number')) {
                streetNumber = component.long_name || '';
              }
              if (component.types.includes('route')) {
                street = component.long_name || '';
              }
              if (component.types.includes('locality') || component.types.includes('administrative_area_level_2')) {
                city = component.long_name || '';
              }
              if (component.types.includes('administrative_area_level_1')) {
                province = component.long_name || '';
              }
            }
          });
        }

        // Construir la dirección completa con número
        const fullStreetAddress = [street, streetNumber].filter(Boolean).join(' ');
        
        // Construir el texto completo para el input: dirección, ciudad, provincia
        const fullAddressText = [
          fullStreetAddress || data?.description?.split(',')[0] || '',
          city,
          province
        ].filter(Boolean).join(', ');

        setFormData(prev => ({
          ...prev,
          destination: {
            address: data?.description || '',
            city: city,
            province: province,
            coordinates: coords,
          },
        }));

        // Actualizar el texto del input con la dirección completa
        if (destinationInputRef.current && destinationInputRef.current.setAddressText) {
          try {
            destinationInputRef.current.setAddressText(fullAddressText);
          } catch (e) {
            console.log('Error setting destination address text:', e);
          }
        }
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

    // Si aún está cargando vehículos, mostrar mensaje
    if (loadingVehicles) {
      Alert.alert('Un momento', 'Estamos verificando tus vehículos...');
      return;
    }

    // Si no hay vehículos, mostrar el mensaje de error
    if (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0) {
      Alert.alert(
        'Vehículo requerido', 
        'Necesitas registrar un vehículo antes de crear un viaje',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Agregar Vehículo', onPress: () => navigation.navigate('Vehicles') }
        ]
      );
      return;
    }

    navigation.navigate('TripDetails', {
      origin: formData.origin,
      destination: formData.destination,
      waypoints: formData.waypoints.filter(wp => wp.coordinates !== null),
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
    setMapSelectionMode(null);
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
    setMapSelectionMode(null);
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

  if (!loadingVehicles && (!vehicles || !Array.isArray(vehicles) || vehicles.length === 0)) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <Ionicons name="car-outline" size={64} color={colors.textTertiary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No tienes vehículos registrados</Text>
        <Text style={[styles.emptySubtext, { color: colors.textTertiary }]}>
          Necesitas registrar un vehículo antes de crear un viaje
        </Text>
        <TouchableOpacity onPress={() => navigation.navigate('Vehicles')}>
          <View style={[styles.addVehicleButton, { backgroundColor: colors.primary }]}>
            <Text style={[styles.addVehicleButtonText, { color: colors.textPrimary }]}>Agregar Vehículo</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  const dismissSheet = () => {
    if (activeAutocomplete) {
      Keyboard.dismiss();
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={dismissSheet}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} />

      {/* Mapa full screen */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation={false}
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {/* Marcador de ubicación del usuario */}
        {userLocation && (
          <Marker coordinate={userLocation} title="Tu ubicación">
            <View style={[styles.userLocationMarkerContainer, { backgroundColor: isDarkMode ? 'transparent' : '#292929' }]}>
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}
        {originMarker && (
          <Marker coordinate={originMarker} title="Origen">
            <View style={styles.originMarkerContainer}>
              <View style={[styles.originMarkerDot, { backgroundColor: '#000' }]} />
            </View>
          </Marker>
        )}
        {destinationMarker && (
          <Marker coordinate={destinationMarker} title="Destino">
            <View style={styles.destinationMarkerContainer}>
              <View style={[styles.destinationMarkerSquare, { backgroundColor: '#000' }]} />
            </View>
          </Marker>
        )}
        {waypointMarkers.map((waypointMarker, index) => (
          <Marker
            key={`waypoint-${index}`}
            coordinate={waypointMarker}
            title={`Parada ${index + 1}`}
          >
            <View style={styles.waypointMarkerContainer}>
              <Text style={styles.waypointMarkerText}>{index + 1}</Text>
            </View>
          </Marker>
        ))}
        {routeCoordinates && routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={3}
            strokeColor="#000000"
            strokeColors={routeCoordinates.map(() => '#000000')}
          />
        )}
      </MapView>


      {/* Botón mi ubicación - oculto cuando el sheet está expandido (editando) */}
      {sheetMode === 'mini' && (
        <TouchableOpacity style={[styles.myLocationButton, { backgroundColor: colors.cardBackground, shadowColor: colors.shadow }]} onPress={() => {
          getCurrentLocation();
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion({
              ...userLocation,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            }, 1000);
          }
        }}>
          <Ionicons name="navigate" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      )}

      {/* Panel inferior estilo Uber - Animated */}
      {mapSelectionMode && (
        <>
          <View style={[styles.mapSelectionIndicator, { backgroundColor: '#6B7280', shadowColor: colors.shadow }]}>
            <Text style={[styles.mapSelectionText, { color: '#FFFFFF' }]}>
              {mapSelectionMode === 'origin' ? 'Toca el mapa para seleccionar el origen' :
               mapSelectionMode === 'destination' ? 'Toca el mapa para seleccionar el destino' :
               `Toca el mapa para seleccionar la parada ${parseInt(mapSelectionMode.split('-')[1]) + 1}`}
            </Text>
            <TouchableOpacity
              onPress={() => setMapSelectionMode(null)}
              style={styles.cancelSelectionBtn}
            >
              <Text style={[styles.cancelSelectionText, { color: '#FFFFFF' }]}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.centerMapIndicator} pointerEvents="none">
            <View style={[styles.centerDot, { backgroundColor: '#6B7280', shadowColor: colors.shadow }]} />
          </View>
        </>
      )}
      <KeyboardAvoidingView
        style={[styles.bottomSheetWrapper, { backgroundColor: colors.cardBackground }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={[
            styles.bottomSheet,
            {
              backgroundColor: colors.cardBackground,
              shadowColor: colors.shadow,
              minHeight: sheetHeight.interpolate({
                inputRange: [0, 1],
                outputRange: [MIN_SHEET_HEIGHT, effectiveMaxHeight],
              }),
              // Evitar que crezca hacia arriba con muchas predicciones: usar altura máxima cuando hay teclado
              maxHeight: keyboardHeight > 0 ? effectiveMaxHeight : undefined,
            },
          ]}
        >
          <View style={{
            flex: activeAutocomplete && autocompleteResults.length > 0 ? 0 : 1,
            flexGrow: activeAutocomplete && autocompleteResults.length > 0 ? 0 : 1,
          }}>
            {sheetMode === 'mini' && (
              <View style={styles.handleBarContainer}>
                <View style={[styles.handleBar, { backgroundColor: colors.border }]} />
              </View>
            )}

                {/* Contenedor de inputs con timeline - posición fija arriba (sin flex) */}
                <View style={[styles.inputsWrapper, { backgroundColor: isDarkMode ? 'transparent' : colors.surface }]}>
            {/* Timeline dots */}
            <View style={[
              styles.timelineContainer,
              { backgroundColor: isDarkMode ? 'transparent' : colors.surface },
              activeAutocomplete && autocompleteResults.length > 0 && {
                borderBottomLeftRadius: 0, // Quitar el radio cuando hay predicciones para evitar espacio blanco
              },
            ]}>
              <View style={[styles.originDot, { backgroundColor: colors.success }]} />
              <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
              
              {/* Waypoints dots */}
              {formData.waypoints.map((_, index) => (
                <React.Fragment key={`waypoint-${index}`}>
                  <View style={[styles.waypointDot, { backgroundColor: '#666', borderColor: isDarkMode ? 'transparent' : colors.surface }]} />
                  <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                </React.Fragment>
              ))}
              
              <View style={[styles.destinationSquare, { backgroundColor: colors.error }]} />
            </View>

            {/* Inputs */}
            <View style={[
              styles.inputsContainer,
              { backgroundColor: isDarkMode ? 'transparent' : colors.surface },
              activeAutocomplete && autocompleteResults.length > 0 && {
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
              },
            ]}>
              {/* Origen */}
              <View style={[styles.inputRow, { zIndex: 3000 }]}>
                <SafePlacesAutocomplete
                  inputRef={originInputRef}
                  placeholder="¿Desde dónde sales?"
                  onPress={handleOriginSelect}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  debounce={1500}
                  inputType="origin"
                  onFocusChange={(type) => {
                    if (type === 'origin') {
                      setActiveAutocomplete('origin');
                      setAutocompleteResults(originResultsRef.current);
                    } else if (type !== null) {
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                    }
                  }}
                  onResultsChange={(results) => {
                    originResultsRef.current = results;
                    if (activeAutocomplete === 'origin') setAutocompleteResults(results);
                  }}
                  externalResults={[]}
                  externalLoading={false}
                  styles={{
                    container: { flex: 1, zIndex: 3000 },
                    textInput: {
                      height: 44,
                      color: colors.textPrimary,
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
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                      setMapSelectionMode('origin');
                    }}
                    style={[
                      styles.mapSelectBtn,
                      { backgroundColor: isDarkMode ? 'transparent' : colors.surface },
                      mapSelectionMode === 'origin' && { backgroundColor: '#6B7280' },
                    ]}
                  >
                    <Ionicons name="map-outline" size={16} color={mapSelectionMode === 'origin' ? '#FFFFFF' : colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />

              {/* Waypoints */}
              {formData.waypoints.map((waypoint, index) => {
                // Asegurar que el ref existe para este índice
                if (!waypointInputRefs.current[index]) {
                  waypointInputRefs.current[index] = React.createRef();
                }
                
                return (
                  <React.Fragment key={`waypoint-input-${index}`}>
                    <View style={[styles.inputRow, { zIndex: 2500 - index * 100 }]}>
                      <SafePlacesAutocomplete
                        inputRef={waypointInputRefs.current[index]}
                        placeholder={`Parada ${index + 1} (opcional)`}
                        onPress={(data, details) => handleWaypointSelect(data, details, index)}
                        apiKey={GOOGLE_MAPS_API_KEY}
                        debounce={1500}
                        inputType={`waypoint-${index}`}
                      onFocusChange={(type) => {
                        if (type === `waypoint-${index}`) {
                          setActiveAutocomplete(`waypoint-${index}`);
                          setAutocompleteResults(waypointResultsRef.current[index] || []);
                        } else if (type !== null) {
                          setActiveAutocomplete(null);
                          setAutocompleteResults([]);
                        }
                      }}
                      onResultsChange={(results) => {
                        waypointResultsRef.current[index] = results;
                        if (activeAutocomplete === `waypoint-${index}`) setAutocompleteResults(results);
                      }}
                      externalResults={[]}
                      externalLoading={false}
                      styles={{
                        container: { flex: 1, zIndex: 2500 - index * 100 },
                        textInput: {
                          height: 44,
                          color: colors.textPrimary,
                          fontSize: 16,
                          fontWeight: '500',
                          backgroundColor: 'transparent',
                          paddingHorizontal: 12,
                          paddingVertical: 0,
                        },
                      }}
                    />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      {!waypoint.address && (
                        <TouchableOpacity
                          onPress={() => {
                            Keyboard.dismiss();
                            setActiveAutocomplete(null);
                            setAutocompleteResults([]);
                            setMapSelectionMode(`waypoint-${index}`);
                          }}
                          style={[
                            styles.mapSelectBtn,
                            { backgroundColor: isDarkMode ? 'transparent' : colors.surface },
                            mapSelectionMode === `waypoint-${index}` && { backgroundColor: '#6B7280' },
                          ]}
                        >
                          <Ionicons name="map-outline" size={16} color={mapSelectionMode === `waypoint-${index}` ? '#FFFFFF' : colors.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => removeWaypoint(index)}
                        style={styles.clearBtn}
                      >
                        <Ionicons name="close-circle" size={18} color={waypoint.address ? colors.error : colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                </React.Fragment>
                );
              })}

              {/* Botón agregar waypoint */}
              {formData.waypoints.length < 3 && (
                <>
                  <TouchableOpacity onPress={addWaypoint} style={styles.addWaypointButton}>
                    <Ionicons name="add-circle" size={20} color={colors.primary} />
                    <Text style={[styles.addWaypointText, { color: colors.primary }]}>Agregar parada</Text>
                  </TouchableOpacity>
                  <View style={[styles.inputDivider, { backgroundColor: colors.border }]} />
                </>
              )}

              {/* Destino */}
              <View style={[styles.inputRow, { zIndex: 2000 }]}>
                <SafePlacesAutocomplete
                  inputRef={destinationInputRef}
                  placeholder="¿A dónde vas?"
                  onPress={handleDestinationSelect}
                  apiKey={GOOGLE_MAPS_API_KEY}
                  debounce={1500}
                  inputType="destination"
                  onFocusChange={(type) => {
                    if (type === 'destination') {
                      setActiveAutocomplete('destination');
                      setAutocompleteResults(destinationResultsRef.current);
                    } else if (type !== null) {
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                    }
                  }}
                  onResultsChange={(results) => {
                    destinationResultsRef.current = results;
                    if (activeAutocomplete === 'destination') setAutocompleteResults(results);
                  }}
                  externalResults={[]}
                  externalLoading={false}
                  styles={{
                    container: { flex: 1, zIndex: 2000 },
                    textInput: {
                      height: 44,
                      color: colors.textPrimary,
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
                    <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                      setMapSelectionMode('destination');
                    }}
                    style={[
                      styles.mapSelectBtn,
                      { backgroundColor: isDarkMode ? 'transparent' : colors.surface },
                      mapSelectionMode === 'destination' && { backgroundColor: '#6B7280' },
                    ]}
                  >
                    <Ionicons name="map-outline" size={16} color={mapSelectionMode === 'destination' ? '#FFFFFF' : colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

           {/* Contenedor de resultados de autocompletado - debajo de los inputs */}
           {activeAutocomplete && autocompleteResults.length > 0 && (
             <View style={[styles.resultsContainer, { backgroundColor: isDarkMode ? 'transparent' : colors.surface }]}>
               <ScrollView
                 keyboardShouldPersistTaps="handled"
                 nestedScrollEnabled={true}
                 showsVerticalScrollIndicator={true}
                 onScrollBeginDrag={() => Keyboard.dismiss()}
                 contentContainerStyle={{ paddingBottom: 10 }}
               >
                {autocompleteResults.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={styles.resultRow}
                    onPress={() => {
                      const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${item.place_id}&key=${GOOGLE_MAPS_API_KEY}&language=es&fields=address_components,geometry,formatted_address`;
                      fetch(detailsUrl)
                        .then(res => res.json())
                        .then(data => {
                          if (data && data.result) {
                            if (activeAutocomplete === 'origin') {
                              handleOriginSelect({ description: item.description }, data.result);
                            } else if (activeAutocomplete === 'destination') {
                              handleDestinationSelect({ description: item.description }, data.result);
                            } else if (activeAutocomplete && activeAutocomplete.startsWith('waypoint-')) {
                              const waypointIndex = parseInt(activeAutocomplete.split('-')[1]);
                              handleWaypointSelect({ description: item.description }, data.result, waypointIndex);
                            }
                          }
                        });
                      setActiveAutocomplete(null);
                      setAutocompleteResults([]);
                    }}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.resultIconContainer, { backgroundColor: isDarkMode ? 'transparent' : '#292929' }]}>
                      <Ionicons name="location-sharp" size={18} color={colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultMainText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {item.structured_formatting?.main_text || item.description}
                      </Text>
                      <Text style={[styles.resultSecondaryText, { color: colors.textSecondary }]} numberOfLines={1}>
                        {item.structured_formatting?.secondary_text || ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Info de ruta + botones cuando hay ruta */}
          {hasRoute && (
              <View style={[
                styles.routeSection,
                { backgroundColor: colors.cardBackground }
              ]}>
              <View style={[styles.routeDivider, { backgroundColor: colors.border }]} />
              <View style={styles.routeButtons}>
                <TouchableOpacity
                  style={[styles.continueBtn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
                  onPress={handleContinueToDetails}
                  activeOpacity={0.8}
                  disabled={loadingVehicles}
                >
                  {loadingVehicles ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <ActivityIndicator size="small" color={isDarkMode ? '#000000' : '#FFFFFF'} />
                      <Text style={[styles.continueBtnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Verificando...</Text>
                    </View>
                  ) : (
                    <Text style={[styles.continueBtnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Confirmar ruta</Text>
                  )}
                </TouchableOpacity>
              </View>
              </View>
            )}
          </View>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Loading overlay */}
      {loadingRoute && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: colors.cardBackground }]}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Calculando ruta...</Text>
          </View>
        </View>
      )}
    </View>
    </TouchableWithoutFeedback>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    width: '100%',
  },
  bottomSheet: {
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    justifyContent: 'flex-start',
  },
  handleBarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: 'transparent', // Cambiar a transparente para usar color dinámico
    marginBottom: 20,
  },

  // Inputs with timeline
  inputsWrapper: {
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'visible',
    zIndex: 1000,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  timelineContainer: {
    width: 24,
    alignItems: 'center',
    paddingTop: 14,
    paddingBottom: 14,
    paddingLeft: 8,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12, // Se quitará dinámicamente cuando hay predicciones
  },
  originDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    marginVertical: 4,
  },
  destinationSquare: {
    width: 10,
    height: 10,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
  },
  waypointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    borderWidth: 2,
    borderColor: 'transparent', // Cambiar a transparente para evitar bordes blancos
  },
  inputsContainer: {
    flex: 1,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    marginLeft: 12,
    marginRight: 12,
  },
  clearBtn: {
    padding: 6,
  },
  mapSelectBtn: {
    padding: 8,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    borderRadius: 8,
  },
  addWaypointButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 16,
    marginHorizontal: 0,
    backgroundColor: 'transparent',
  },
  addWaypointText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
    color: 'transparent', // Añadir para usar color dinámico
  },

  // Autocomplete results - altura libre, se ajusta al contenido
  resultsContainer: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: -2,
    marginLeft: 0,
    marginRight: 0,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(235, 235, 235, 0.3)', // Color más sutil para el borde
  },
  resultIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultMainText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'transparent', // Cambiar a transparente para usar color dinámico
  },
  resultSecondaryText: {
    fontSize: 13,
    color: 'transparent', // Cambiar a transparente para usar color dinámico
    marginTop: 2,
  },

  // Route section
  routeSection: {
    marginTop: 16,
  },
  routeDivider: {
    height: 1,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    marginHorizontal: 12,
  },
  routeInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: 'transparent', // Cambiar a transparente para usar color dinámico
  },
  routeButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  editRouteBtn: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    alignItems: 'center',
    justifyContent: 'center',
  },
  editRouteBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: 'transparent', // Cambiar a transparente para usar color dinámico
  },
  continueBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    alignItems: 'center',
    justifyContent: 'center',
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    borderWidth: 2,
    borderColor: '#fff',
  },
  waypointMarkerContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#666',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  waypointMarkerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
  userLocationMarkerContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#292929',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  userLocationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
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
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: 'transparent', // Cambiar a transparente para usar color dinámico
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
    color: 'transparent', // Añadir para usar color dinámico
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: 'transparent', // Añadir para usar color dinámico
  },
  addVehicleButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    marginTop: 32,
    backgroundColor: 'transparent', // Añadir para usar color dinámico
  },
  addVehicleButtonText: {
    color: 'transparent', // Cambiar para usar color dinámico
    fontSize: 16,
    fontWeight: '600',
  },

  // Map selection indicator
  mapSelectionIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  mapSelectionText: {
    flex: 1,
    color: 'transparent', // Cambiar a transparente para usar color dinámico
    fontSize: 14,
    fontWeight: '500',
  },
  cancelSelectionBtn: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelSelectionText: {
    color: 'transparent', // Cambiar a transparente para usar color dinámico
    fontSize: 14,
    fontWeight: '600',
    opacity: 0.8,
  },
  centerMapIndicator: {
    position: 'absolute',
    top: height * 0.35 - 8,
    left: width / 2 - 8,
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 40,
  },
  centerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'transparent', // Cambiar a transparente para usar color dinámico
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default CreateTripGoogleMaps;
