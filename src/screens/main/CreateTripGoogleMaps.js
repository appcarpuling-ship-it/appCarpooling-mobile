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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
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
  const waypointInputRefs = useRef([]);
  const isMounted = useRef(true);
  const originDebounceTimer = useRef(null);
  const destinationDebounceTimer = useRef(null);
  const waypointDebounceTimers = useRef([]);

  // Animated values
  const sheetTranslateY = useRef(new Animated.Value(300)).current;
  const keyboardOffset = useRef(new Animated.Value(0)).current;
  const handleBarWidth = useRef(new Animated.Value(0)).current;
  const bottomSheetHeight = useRef(new Animated.Value(0)).current; // Controla la altura desde abajo (paddingBottom)

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [activeAutocomplete, setActiveAutocomplete] = useState(null); // 'origin' | 'destination' | 'waypoint-0' | 'waypoint-1' | null
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const [autocompleteLoading, setAutocompleteLoading] = useState(false);
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

  useEffect(() => {
    isMounted.current = true;
    loadVehicles();
    getCurrentLocation();

    if (!GOOGLE_MAPS_API_KEY) {
      console.error('❌ GOOGLE_MAPS_API_KEY no está configurada');
      Alert.alert('Error', 'La API Key de Google Maps no está configurada');
    }

    // Animación de entrada del bottom sheet
    // Posición inicial: 3 (de 0 a 10)
    // Esto significa que el bottom sheet está a una altura inicial desde abajo
    Animated.spring(sheetTranslateY, {
      toValue: 0,
      tension: 50,
      friction: 9,
      useNativeDriver: true,
    }).start();
    
    // Altura inicial del bottom (posición 3)
    // Calculamos que posición 3 = aproximadamente altura base del contenedor
    // El contenedor tiene una altura base que incluye: handle + inputs + padding
    const baseSheetHeight = 200; // Altura base aproximada del contenedor
    Animated.timing(bottomSheetHeight, {
      toValue: baseSheetHeight,
      duration: 0,
      useNativeDriver: false,
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
      const kbHeight = e.endCoordinates.height;
      setKeyboardVisible(true);
      setKeyboardHeight(kbHeight);
      
      // Si el contenedor ya está arriba (porque se presionó un input), mantenerlo ahí
      // Si hay predicciones, expandir hasta el teclado (sin espacios vacíos)
      if (activeAutocomplete && autocompleteResults.length > 0) {
        Animated.timing(bottomSheetHeight, {
          toValue: kbHeight, // Crecer hasta el teclado para eliminar espacios
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          useNativeDriver: false,
        }).start();
      } else {
        // Si no hay predicciones, mantener minHeight
        Animated.timing(bottomSheetHeight, {
          toValue: MIN_SHEET_HEIGHT,
          duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
          useNativeDriver: false,
        }).start();
      }
    });

    const hideSub = Keyboard.addListener(hideEvent, (e) => {
      setKeyboardVisible(false);
      setKeyboardHeight(0);
      
      // Restaurar altura inicial (minHeight) y posición
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
        useNativeDriver: true,
      }).start();
      
      Animated.timing(bottomSheetHeight, {
        toValue: MIN_SHEET_HEIGHT,
        duration: Platform.OS === 'ios' ? (e.duration || 250) : 250,
        useNativeDriver: false,
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
  }, [originMarker, destinationMarker, waypointMarkers]);

  // Restaurar estado inicial cuando la pantalla se enfoca (solo al volver de otra pantalla)
  const screenWasBlurred = useRef(false);
  
  useFocusEffect(
    useCallback(() => {
      console.log('🔄 [CreateTripGoogleMaps] Pantalla enfocada');
      
      // Solo restaurar si la pantalla había sido desenfocada (volvimos de otra pantalla)
      if (screenWasBlurred.current) {
        console.log('🔄 [CreateTripGoogleMaps] Restaurando estado inicial');
        
        // Restaurar animaciones a estado inicial
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }).start();
        
        Animated.timing(bottomSheetHeight, {
          toValue: MIN_SHEET_HEIGHT,
          duration: 0,
          useNativeDriver: false,
        }).start();
        
        // Limpiar predicciones
        setActiveAutocomplete(null);
        setAutocompleteResults([]);
        
        screenWasBlurred.current = false;
      }
      
      // Función de cleanup que se ejecuta cuando la pantalla se desenfoca
      return () => {
        console.log('🔄 [CreateTripGoogleMaps] Pantalla desenfocada');
        screenWasBlurred.current = true;
      };
    }, [])
  );

  // Constantes para minHeight y maxHeight del contenedor
  const MIN_SHEET_HEIGHT = 200; // Altura mínima (posición inicial)
  const MAX_SHEET_HEIGHT = height * 0.75; // 75% de la pantalla cuando hay predicciones sin teclado
  const KEYBOARD_SHEET_HEIGHT = height * 0.85; // 85% de la pantalla cuando aparece el teclado
  
  // Función para subir el contenedor y prepararlo cuando se activa un input
  const moveSheetUpOnInputFocus = () => {
    // Cuando se activa un input, expandir el sheet más agresivamente como Uber
    const targetHeight = keyboardVisible && keyboardHeight > 0 
      ? Math.min(keyboardHeight, KEYBOARD_SHEET_HEIGHT) // Usar altura del teclado o máximo 85% de pantalla
      : KEYBOARD_SHEET_HEIGHT; // Si no hay teclado aún, usar 85% de pantalla
    
    // Subir el contenedor más para que los inputs queden más arriba
    // Mover hacia arriba aproximadamente 200px para dar más espacio
    const offset = -200;
    
    Animated.timing(keyboardOffset, {
      toValue: offset,
      duration: 250,
      useNativeDriver: true,
    }).start();
    
    // Expandir el contenedor inmediatamente cuando se activa un input
    Animated.timing(bottomSheetHeight, {
      toValue: targetHeight,
      duration: 250,
      useNativeDriver: false,
    }).start();
  };

  // Efecto para manejar la expansión del bottom sheet cuando hay predicciones
  // Cuando el usuario activa un input, expandir más agresivamente como Uber
  useEffect(() => {
    if (keyboardVisible && keyboardHeight > 0) {
      if (activeAutocomplete) {
        // Input activo con teclado: usar la altura máxima del teclado o KEYBOARD_SHEET_HEIGHT
        const targetHeight = Math.min(keyboardHeight, KEYBOARD_SHEET_HEIGHT);
        Animated.timing(bottomSheetHeight, {
          toValue: targetHeight,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }
    } else if (!keyboardVisible && activeAutocomplete) {
      // Input activo sin teclado: usar MAX_SHEET_HEIGHT (75% de pantalla)
      Animated.timing(bottomSheetHeight, {
        toValue: MAX_SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [activeAutocomplete, keyboardVisible, keyboardHeight]);

  // Efecto para subir el contenedor cuando hay una ruta completa (sin teclado)
  useEffect(() => {
    if (hasRoute && !keyboardVisible && !activeAutocomplete) {
      // Cuando hay ruta completa, subir el contenedor un poco para que los botones sean más visibles
      Animated.timing(keyboardOffset, {
        toValue: -80, // Subir 80px para que los botones queden visibles
        duration: 250,
        useNativeDriver: true,
      }).start();
      
      // Ajustar altura del contenedor para que los botones se vean bien
      // Necesitamos espacio para: handle (~20px) + inputs (~100px) + divider (~1px) + info ruta (~60px) + botones (~60px) + padding (~60px) = ~300px
      Animated.timing(bottomSheetHeight, {
        toValue: 320, // Aumentar más la altura para asegurar que los botones sean visibles
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else if (!hasRoute && !keyboardVisible && !activeAutocomplete) {
      // Si no hay ruta, restaurar posición inicial
      Animated.timing(keyboardOffset, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
      
      Animated.timing(bottomSheetHeight, {
        toValue: MIN_SHEET_HEIGHT,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [hasRoute, keyboardVisible, activeAutocomplete]);

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
    // Si no está en modo de selección, solo cerrar el teclado y limpiar el autocompletado
    if (!mapSelectionMode) {
      Keyboard.dismiss();
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      
      // Restaurar la altura del contenedor a la mínima
      setTimeout(() => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
        
        Animated.timing(bottomSheetHeight, {
          toValue: MIN_SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }, 100);
      
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
      
      setTimeout(() => {
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
        
        Animated.timing(bottomSheetHeight, {
          toValue: MIN_SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }, 100);

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
      
      // Limpiar predicciones primero
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      
      // Cerrar el teclado primero
      Keyboard.dismiss();
      
      // Esperar un poco antes de restaurar para que el teclado se cierre
      setTimeout(() => {
        // Cuando seleccionas una dirección: restaurar altura inicial (minHeight) y posición
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
        
        Animated.timing(bottomSheetHeight, {
          toValue: MIN_SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }, 100);

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
      
      // Limpiar predicciones primero
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
      
      // Cerrar el teclado primero
      Keyboard.dismiss();
      
      // Esperar un poco antes de restaurar para que el teclado se cierre
      setTimeout(() => {
        // Cuando seleccionas una dirección: restaurar altura inicial (minHeight) y posición
        Animated.timing(keyboardOffset, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }).start();
        
        Animated.timing(bottomSheetHeight, {
          toValue: MIN_SHEET_HEIGHT,
          duration: 250,
          useNativeDriver: false,
        }).start();
      }, 100);

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

  if (loadingVehicles) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cargando vehículos...</Text>
      </View>
    );
  }

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
            <Text style={styles.addVehicleButtonText}>Agregar Vehículo</Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <TouchableWithoutFeedback onPress={() => {
      // Cerrar teclado y limpiar autocompletado al tocar áreas vacías
      if (activeAutocomplete) {
        Keyboard.dismiss();
        setActiveAutocomplete(null);
        setAutocompleteResults([]);
        
        // Restaurar la altura del contenedor a la mínima
        setTimeout(() => {
          Animated.timing(keyboardOffset, {
            toValue: 0,
            duration: 250,
            useNativeDriver: true,
          }).start();
          
          Animated.timing(bottomSheetHeight, {
            toValue: MIN_SHEET_HEIGHT,
            duration: 250,
            useNativeDriver: false,
          }).start();
        }, 100);
      }
    }}>
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
        onPress={handleMapPress}
      >
        {/* Marcador de ubicación del usuario */}
        {userLocation && (
          <Marker coordinate={userLocation} title="Tu ubicación">
            <View style={styles.userLocationMarkerContainer}>
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}
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


      {/* Botón mi ubicación */}
      {!keyboardVisible && (
        <TouchableOpacity style={styles.myLocationButton} onPress={() => {
          getCurrentLocation();
          if (userLocation && mapRef.current) {
            mapRef.current.animateToRegion({
              ...userLocation,
              latitudeDelta: LATITUDE_DELTA,
              longitudeDelta: LONGITUDE_DELTA,
            }, 1000);
          }
        }}>
          <Ionicons name="navigate" size={20} color="#000" />
        </TouchableOpacity>
      )}

      {/* Panel inferior estilo Uber - Animated */}
      {mapSelectionMode && (
        <>
          <View style={styles.mapSelectionIndicator}>
            <Text style={styles.mapSelectionText}>
              {mapSelectionMode === 'origin' ? 'Toca el mapa para seleccionar el origen' :
               mapSelectionMode === 'destination' ? 'Toca el mapa para seleccionar el destino' :
               `Toca el mapa para seleccionar la parada ${parseInt(mapSelectionMode.split('-')[1]) + 1}`}
            </Text>
            <TouchableOpacity
              onPress={() => setMapSelectionMode(null)}
              style={styles.cancelSelectionBtn}
            >
              <Text style={styles.cancelSelectionText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.centerMapIndicator} pointerEvents="none">
            <View style={styles.centerDot} />
          </View>
        </>
      )}
      <Animated.View
        style={[
          styles.bottomSheetWrapper,
          {
            transform: [
              { translateY: sheetTranslateY },
              { translateY: keyboardOffset }, // Mover hacia arriba cuando se presiona un input
            ],
          },
        ]}
      >
            <Animated.View style={[
              styles.bottomSheet,
              keyboardVisible && styles.bottomSheetExpanded,
              {
                minHeight: bottomSheetHeight, // Altura mínima animada (crece hacia abajo)
              },
            ]}>
              {/* Contenedor interno con flex column para mantener inputs arriba */}
              <View style={{ flex: 1, flexDirection: 'column' }}>
                {/* Handle animado */}
                {!keyboardVisible && (
                  <View style={styles.handleBarContainer}>
                    <Animated.View style={[styles.handleBar, { width: handleBarWidth }]} />
                  </View>
                )}

                {/* Contenedor de inputs con timeline - posición fija arriba (sin flex) */}
                <View style={styles.inputsWrapper}>
            {/* Timeline dots */}
            <View style={[
              styles.timelineContainer,
              activeAutocomplete && autocompleteResults.length > 0 && {
                borderBottomLeftRadius: 0, // Quitar el radio cuando hay predicciones para evitar espacio blanco
              },
            ]}>
              <View style={styles.originDot} />
              <View style={styles.timelineLine} />
              
              {/* Waypoints dots */}
              {formData.waypoints.map((_, index) => (
                <React.Fragment key={`waypoint-${index}`}>
                  <View style={styles.waypointDot} />
                  <View style={styles.timelineLine} />
                </React.Fragment>
              ))}
              
              <View style={styles.destinationSquare} />
            </View>

            {/* Inputs */}
            <View style={[
              styles.inputsContainer,
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
                  debounce={2000}
                  inputType="origin"
                  onFocusChange={(type) => {
                    // Cuando este input recibe el foco, activarlo y mostrar sus resultados
                    if (type === 'origin') {
                      setActiveAutocomplete('origin');
                      setAutocompleteResults(originResultsRef.current);
                      // Subir el contenedor y prepararlo cuando se activa el input
                      moveSheetUpOnInputFocus();
                    } else if (type === null) {
                      // Si el input pierde el foco pero hay predicciones guardadas, mantener el estado
                      // para que las predicciones aparezcan cuando lleguen
                      // NO limpiar activeAutocomplete ni autocompleteResults
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
                      // Si hay resultados, expandir más agresivamente como Uber
                      if (results.length > 0) {
                        const targetHeight = keyboardVisible && keyboardHeight > 0 
                          ? Math.min(keyboardHeight, KEYBOARD_SHEET_HEIGHT)
                          : MAX_SHEET_HEIGHT;
                        Animated.timing(bottomSheetHeight, {
                          toValue: targetHeight,
                          duration: 250,
                          useNativeDriver: false,
                        }).start();
                      }
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
                      mapSelectionMode === 'origin' && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Ionicons name="map-outline" size={16} color={mapSelectionMode === 'origin' ? '#fff' : colors.primary} />
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputDivider} />

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
                        debounce={2000}
                        inputType={`waypoint-${index}`}
                      onFocusChange={(type) => {
                        if (type === `waypoint-${index}`) {
                          setActiveAutocomplete(`waypoint-${index}`);
                          setAutocompleteResults(waypointResultsRef.current[index] || []);
                          moveSheetUpOnInputFocus();
                        } else if (type === null) {
                          // Mantener el estado
                        } else {
                          setActiveAutocomplete(null);
                          setAutocompleteResults([]);
                        }
                      }}
                      onResultsChange={(results) => {
                        waypointResultsRef.current[index] = results;
                        if (activeAutocomplete === `waypoint-${index}`) {
                          setAutocompleteResults(results);
                          if (results.length > 0) {
                            const targetHeight = keyboardVisible && keyboardHeight > 0 
                              ? Math.min(keyboardHeight, KEYBOARD_SHEET_HEIGHT)
                              : MAX_SHEET_HEIGHT;
                            Animated.timing(bottomSheetHeight, {
                              toValue: targetHeight,
                              duration: 250,
                              useNativeDriver: false,
                            }).start();
                          }
                        }
                      }}
                      externalResults={[]}
                      externalLoading={false}
                      styles={{
                        container: { flex: 1, zIndex: 2500 - index * 100 },
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
                            mapSelectionMode === `waypoint-${index}` && { backgroundColor: colors.primary },
                          ]}
                        >
                          <Ionicons name="map-outline" size={16} color={mapSelectionMode === `waypoint-${index}` ? '#fff' : colors.primary} />
                        </TouchableOpacity>
                      )}
                      <TouchableOpacity
                        onPress={() => removeWaypoint(index)}
                        style={styles.clearBtn}
                      >
                        <Ionicons name="close-circle" size={18} color={waypoint.address ? "#ff6b6b" : "#CACACA"} />
                      </TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.inputDivider} />
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
                  <View style={styles.inputDivider} />
                </>
              )}

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
                      // Subir el contenedor y prepararlo cuando se activa el input (igual que origen)
                      moveSheetUpOnInputFocus();
                    } else if (type === null) {
                      // Si el input pierde el foco pero hay predicciones guardadas, mantener el estado
                      // para que las predicciones aparezcan cuando lleguen
                      // NO limpiar activeAutocomplete ni autocompleteResults
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
                      // Si hay resultados, expandir más agresivamente como Uber
                      if (results.length > 0) {
                        const targetHeight = keyboardVisible && keyboardHeight > 0 
                          ? Math.min(keyboardHeight, KEYBOARD_SHEET_HEIGHT)
                          : MAX_SHEET_HEIGHT;
                        Animated.timing(bottomSheetHeight, {
                          toValue: targetHeight,
                          duration: 250,
                          useNativeDriver: false,
                        }).start();
                      }
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
                      mapSelectionMode === 'destination' && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Ionicons name="map-outline" size={16} color={mapSelectionMode === 'destination' ? '#fff' : colors.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>

           {/* Contenedor de resultados de autocompletado - debajo de los inputs */}
           {activeAutocomplete && autocompleteResults.length > 0 && (
             <View style={styles.resultsContainer}>
               <ScrollView
                 keyboardShouldPersistTaps="handled"
                 nestedScrollEnabled={true}
                 showsVerticalScrollIndicator={true}
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
                    <View style={styles.resultIconContainer}>
                      <Ionicons name="location-sharp" size={18} color="#666" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.resultMainText} numberOfLines={1}>
                        {item.structured_formatting?.main_text || item.description}
                      </Text>
                      <Text style={styles.resultSecondaryText} numberOfLines={1}>
                        {item.structured_formatting?.secondary_text || ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Info de ruta + botones cuando hay ruta */}
          {hasRoute && !keyboardVisible && (
            <View style={styles.routeSection}>
              <View style={styles.routeDivider} />

              {/* {distance && duration && (
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
              )} */}

              <View style={styles.routeButtons}>
                {/* <TouchableOpacity
                  style={styles.editRouteBtn}
                  onPress={() => {
                    clearOrigin();
                    clearDestination();
                  }}
                >
                  <Text style={styles.editRouteBtnText}>Editar</Text>
                </TouchableOpacity> */}

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
    </TouchableWithoutFeedback>
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
    justifyContent: 'flex-start', // Asegurar que el contenido empiece desde arriba
  },
  bottomSheetExpanded: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    paddingBottom: 8,
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
    backgroundColor: '#F6F6F6', // Color de fondo para todo el contenedor
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
    backgroundColor: '#F6F6F6', // Mismo color que inputsContainer
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12, // Se quitará dinámicamente cuando hay predicciones
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
  waypointDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    borderWidth: 2,
    borderColor: '#F6F6F6',
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
  mapSelectBtn: {
    padding: 8,
    backgroundColor: '#EBEBEB',
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
  },

  // Autocomplete results
  resultsContainer: {
    backgroundColor: '#F6F6F6',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    marginTop: -2,
    marginLeft: 0, // Sin margen izquierdo para que quede alineado con los inputs
    marginRight: 0,
    overflow: 'hidden',
    maxHeight: height * 0.6, // 60% de la pantalla para las predicciones (más espacio como Uber)
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 52,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
  },
  resultIconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E8E8E8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  resultMainText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#000',
  },
  resultSecondaryText: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
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
    backgroundColor: '#007AFF',
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

  // Map selection indicator
  mapSelectionIndicator: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    backgroundColor: '#000',
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
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  cancelSelectionBtn: {
    marginLeft: 12,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cancelSelectionText: {
    color: '#fff',
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
    backgroundColor: '#000',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
});

export default CreateTripGoogleMaps;
