import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  Keyboard,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Animated,
  PanResponder,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';

import { getGoogleMapsApiKey } from '../../../config/googleMapsEnv';
import { Ionicons } from '@expo/vector-icons';
import SafePlacesAutocomplete from '../../../components/SafePlacesAutocomplete';
import * as Location from 'expo-location';
import { get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import {
  getDirections as getDirectionsApi,
  reverseGeocode as reverseGeocodeApi,
  getPlaceDetails as getPlaceDetailsApi,
} from '../../../services/mapsService';
import { useColors } from '../../../hooks/useColors';
import { useFrequentAddresses } from '../../../hooks/useFrequentAddresses';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';
import MapCenterPin, { usePinAlzado } from '../../../components/ui/MapCenterPin';
import RutaPolyline from '../../../components/map/RutaPolyline';
import { useMapFit } from '../../../hooks/useMapFit';

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.0922;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;
/** Tras arrastrar el mapa, si el pin central queda quieto este tiempo, se confirma el punto */
const MAP_SELECTION_IDLE_MS = 1000;
const GOOGLE_MAPS_API_KEY = getGoogleMapsApiKey();

/** locality a veces no viene (ej. Santa Cruz); usar provincia o nivel 2. */
const cityFromGoogleComponents = (components) => {
  let city = '';
  let province = '';
  if (!Array.isArray(components)) return { city, province };
  components.forEach((c) => {
    const types = c.types || [];
    if (types.includes('locality')) city = c.long_name;
    if (types.includes('administrative_area_level_2') && !city) city = c.long_name;
    if (types.includes('administrative_area_level_1')) province = c.long_name;
  });
  if (!city && province) city = province;
  return { city, province };
};

const CreateTripGoogleMaps = ({ navigation, route: navRoute }) => {
  const isRequestMode = navRoute?.params?.mode === 'request';
  const { isDarkMode } = useColors();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const frequentAddresses = useFrequentAddresses();
  const mapRef = useRef(null);
  const [mapaListo, setMapaListo] = useState(false);
  const originInputRef = useRef(null);
  const destinationInputRef = useRef(null);
  const waypointInputRefs = useRef([]);
  const isMounted = useRef(true);

  // Encuadre que espera a que el mapa esté listo (ver useMapFit): con el setTimeout de antes,
  // si el mapa tardaba en inicializar el fit se perdía y la ruta quedaba fuera de cuadro.
  const encuadrar = useMapFit(mapRef, mapaListo, { top: 100, right: 50, bottom: 300, left: 50 });
  const waypointDebounceTimers = useRef([]);
  const mapSelectionModeRef = useRef(null);
  const mapSelectionIdleTimerRef = useRef(null);
  const hasMapGestureForSelectionRef = useRef(false);


  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.invertBg;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;
  const iconBg      = ui.bg;

  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [loadingMapSelection, setLoadingMapSelection] = useState(false);

  // 'origin' | 'destination' | 'waypoint-N' | null
  const [activeAutocomplete, setActiveAutocomplete] = useState(null);
  const [autocompleteResults, setAutocompleteResults] = useState([]);
  const originResultsRef = useRef([]);
  const destinationResultsRef = useRef([]);
  const waypointResultsRef = useRef([]);

  const [region, setRegion] = useState({
    latitude: -34.6037, longitude: -58.3816,
    latitudeDelta: LATITUDE_DELTA, longitudeDelta: LONGITUDE_DELTA,
  });

  // Va despues de region: arriba quedaba en zona muerta y useRef(region)
  // lanzaba ReferenceError al abrir la pantalla.
  const lastRegionRef = useRef(region);
  const [originMarker, setOriginMarker] = useState(null);
  const [destinationMarker, setDestinationMarker] = useState(null);
  const [waypointMarkers, setWaypointMarkers] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [routeCoordinates, setRouteCoordinates] = useState([]);
  // Se guarda con el viaje para que ver el mapa después no vuelva a pegarle a Directions.
  // ponytail: overview_polyline (una sola string, algo más simplificada que los steps);
  // si el trazo se ve anguloso en rutas largas, guardar los steps en un array.
  const [routePolyline, setRoutePolyline] = useState(null);
  const [distance, setDistance] = useState(null);
  const [distanceKm, setDistanceKm] = useState(0);
  const [duration, setDuration] = useState(null);
  const [mapSelectionMode, setMapSelectionMode] = useState(null);
  const [searchVisible, setSearchVisible] = useState(false);
  const { alzado, levantarPin } = usePinAlzado();
  // El punto azul del GPS: sin él, al marcar en el mapa no hay ninguna referencia de dónde
  // está uno respecto del punto que está eligiendo.
  const [mostrarMiUbicacion, setMostrarMiUbicacion] = useState(false);
  useEffect(() => {
    let cancelado = false;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => { if (!cancelado && status === 'granted') setMostrarMiUbicacion(true); })
      .catch(() => {});
    return () => { cancelado = true; };
  }, []);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayTranslateY = useRef(new Animated.Value(16)).current;

  // ── Bottom sheet drag ──────────────────────────────────────────────────────
  // PEEK_HEIGHT como ref para que el PanResponder siempre use el valor actualizado
  // Incluye insets.bottom para que el handle quede SOBRE la barra de gestos
  const peekHeight = useRef(100);
  useEffect(() => {
    peekHeight.current = (insets.bottom || 0) + 100;
  }, [insets.bottom]);

  const sheetTranslateY = useRef(new Animated.Value(0)).current;
  const sheetState = useRef('expanded'); // 'expanded' | 'collapsed'
  const sheetFullHeight = useRef(0);
  const dragStartValue = useRef(0);

  const snapSheet = (toState) => {
    const maxTranslate = sheetFullHeight.current - peekHeight.current;
    const toValue = toState === 'collapsed' ? Math.max(0, maxTranslate) : 0;
    sheetState.current = toState;
    Animated.spring(sheetTranslateY, {
      toValue,
      useNativeDriver: true,
      overshootClamping: true, // sin rebote que se pase del límite
      tension: 60,
      friction: 10,
    }).start();
  };

  const sheetPanResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dy }) => Math.abs(dy) > 6,
      onPanResponderGrant: () => {
        dragStartValue.current = sheetState.current === 'expanded'
          ? 0
          : Math.max(0, sheetFullHeight.current - peekHeight.current);
      },
      onPanResponderMove: (_, { dy }) => {
        const maxTranslate = Math.max(0, sheetFullHeight.current - peekHeight.current);
        const newVal = Math.max(0, Math.min(maxTranslate, dragStartValue.current + dy));
        sheetTranslateY.setValue(newVal);
      },
      onPanResponderRelease: (_, { dy, vy }) => {
        const shouldCollapse = sheetState.current === 'expanded' && (dy > 25 || vy > 0.4);
        const shouldExpand   = sheetState.current === 'collapsed' && (dy < -25 || vy < -0.4);
        if (shouldCollapse) snapSheet('collapsed');
        else if (shouldExpand) snapSheet('expanded');
        else snapSheet(sheetState.current); // vuelve al estado actual
      },
    })
  ).current;

  const [formData, setFormData] = useState({
    origin:      { address: '', city: '', province: '', coordinates: null },
    destination: { address: '', city: '', province: '', coordinates: null },
    waypoints:   [],
  });

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    isMounted.current = true;
    if (!isRequestMode) loadVehicles();
    else setLoadingVehicles(false);
    getCurrentLocation();
    if (!GOOGLE_MAPS_API_KEY) showAlert('Ocurrió algo', 'La API Key de Google Maps no está configurada');
    return () => {
      isMounted.current = false;
      if (mapSelectionIdleTimerRef.current) {
        clearTimeout(mapSelectionIdleTimerRef.current);
        mapSelectionIdleTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (originMarker && destinationMarker && isMounted.current) getDirections();
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

  useEffect(() => {
    mapSelectionModeRef.current = mapSelectionMode;
    if (!mapSelectionMode) {
      hasMapGestureForSelectionRef.current = false;
      if (mapSelectionIdleTimerRef.current) {
        clearTimeout(mapSelectionIdleTimerRef.current);
        mapSelectionIdleTimerRef.current = null;
      }
    } else {
      hasMapGestureForSelectionRef.current = false;
    }
  }, [mapSelectionMode]);

  useEffect(() => {
    lastRegionRef.current = region;
  }, [region]);

  // ─── Location / Vehicles / Directions ────────────────────────────────────

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      if (!isMounted.current) return;
      const { latitude, longitude } = loc.coords;
      const newRegion = { latitude, longitude, latitudeDelta: LATITUDE_DELTA, longitudeDelta: LONGITUDE_DELTA };
      setRegion(newRegion);
      setUserLocation({ latitude, longitude });
      if (mapRef.current && isMounted.current) {
        setTimeout(() => { if (mapRef.current && isMounted.current) mapRef.current.animateToRegion(newRegion, 1000); }, 500);
      }
      // Auto-set origin with user's current location
      if (!formData.origin.address && isMounted.current) {
        const locData = await reverseGeocode(latitude, longitude);
        if (locData && isMounted.current) {
          setOriginMarker({ latitude, longitude });
          setFormData(prev => ({ ...prev, origin: locData }));
          if (originInputRef.current?.setAddressText) {
            try { originInputRef.current.setAddressText([locData.address, locData.city, locData.province].filter(Boolean).join(', ')); } catch {}
          }
        }
      }
    } catch {}
  };

  const loadVehicles = async () => {
    try {
      if (!isMounted.current) return;
      setLoadingVehicles(true);
      const response = await get_withauth(ENDPOINTS.MY_VEHICLES);
      if (!isMounted.current) return;
      setVehicles(response?.success && Array.isArray(response.data) ? response.data : []);
    } catch {
      if (isMounted.current) setVehicles([]);
    } finally {
      if (isMounted.current) setLoadingVehicles(false);
    }
  };

  // Encuadra origen/destino/paradas cuando no hay trayecto para dibujar (ZERO_RESULTS, error de
  // red, etc.) — antes esos casos no lanzan excepción y el mapa se quedaba quieto sin avisar nada.
  const fitToMarkersOnly = () => {
    const coords = [originMarker, ...waypointMarkers, destinationMarker].filter(m => m?.latitude && m?.longitude);
    if (coords.length < 2) return;
    encuadrar(coords);
  };

  const getDirections = async () => {
    if (!originMarker || !destinationMarker || !isMounted.current) return;
    setLoadingRoute(true);
    setRoutePolyline(null); // que no quede la ruta anterior si esta falla
    try {
      const orig = `${originMarker.latitude},${originMarker.longitude}`;
      const dest = `${destinationMarker.latitude},${destinationMarker.longitude}`;
      let waypointsParam;
      if (waypointMarkers.length > 0) {
        const coords = waypointMarkers.filter(w => w?.latitude && w?.longitude).map(w => `${w.latitude},${w.longitude}`);
        if (coords.length > 0) waypointsParam = coords.join('|');
      }
      const data = await getDirectionsApi(orig, dest, waypointsParam);
      if (!isMounted.current) return;
      if (data.routes?.length > 0) {
        const route = data.routes[0];
        let points = [];
        route.legs?.forEach(leg => leg.steps?.forEach(step => { if (step.polyline?.points) points.push(...decodePolyline(step.polyline.points)); }));
        if (points.length === 0 && route.overview_polyline?.points) points = decodePolyline(route.overview_polyline.points);
        if (points.length > 0) {
          setRouteCoordinates(points);
          setRoutePolyline(encodePolyline(points));
          let totalDist = 0, totalDur = 0;
          route.legs?.forEach(leg => { totalDist += leg.distance?.value || 0; totalDur += leg.duration?.value || 0; });
          setDistance(totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${totalDist} m`);
          setDistanceKm(totalDist / 1000);
          setDuration(totalDur >= 3600 ? `${Math.floor(totalDur / 3600)}h ${Math.floor((totalDur % 3600) / 60)}min` : `${Math.floor(totalDur / 60)} min`);
          if (mapRef.current && isMounted.current) {
            encuadrar(points);
          }
        } else {
          fitToMarkersOnly();
        }
      } else {
        // Sin rutas (ZERO_RESULTS, REQUEST_DENIED...): no lanza excepción, así que antes
        // esto se caía en silencio y el mapa quedaba sin trazado ni encuadre.
        fitToMarkersOnly();
      }
    } catch (e) {
      console.error('Error getting directions:', e);
      fitToMarkersOnly();
    }
    finally { if (isMounted.current) setLoadingRoute(false); }
  };

  const decodePolyline = (encoded) => {
    if (!encoded) return [];
    const pts = []; let i = 0, lat = 0, lng = 0;
    while (i < encoded.length) {
      let b, shift = 0, result = 0;
      do { b = encoded.charAt(i++).charCodeAt(0) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lat += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      shift = 0; result = 0;
      do { b = encoded.charAt(i++).charCodeAt(0) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      lng += (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      pts.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
    }
    return pts;
  };

  // Codifica los puntos ya decodificados (alta resolución, uno por step) para guardarlos.
  // routePolyline debe reflejar el mismo trazado que ve el conductor, no el overview_polyline
  // de Google (una versión simplificada que corta camino entre paradas y desalinea el mapa).
  const encodePolyline = (points) => {
    let result = '', prevLat = 0, prevLng = 0;
    const encodeValue = (value) => {
      let v = value < 0 ? ~(value << 1) : (value << 1);
      let out = '';
      while (v >= 0x20) { out += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
      out += String.fromCharCode(v + 63);
      return out;
    };
    points.forEach(({ latitude, longitude }) => {
      const lat = Math.round(latitude * 1e5);
      const lng = Math.round(longitude * 1e5);
      result += encodeValue(lat - prevLat) + encodeValue(lng - prevLng);
      prevLat = lat; prevLng = lng;
    });
    return result;
  };

  // ─── Geocoding ────────────────────────────────────────────────────────────

  const reverseGeocode = async (latitude, longitude) => {
    try {
      const data = await reverseGeocodeApi(latitude, longitude);
      if (data.results?.length > 0) {
        const result = data.results[0];
        let street = '';
        let streetNumber = '';
        const { city, province } = cityFromGoogleComponents(result.address_components);
        result.address_components?.forEach(c => {
          if (c.types?.includes('street_number')) streetNumber = c.long_name;
          if (c.types?.includes('route')) street = c.long_name;
        });
        const fullStreet = [street, streetNumber].filter(Boolean).join(' ');
        return { address: fullStreet || result.formatted_address?.split(',')[0]?.trim() || '', city, province, country: 'Argentina', coordinates: { latitude, longitude } };
      }
    } catch {}
    return null;
  };

  const clearMapSelectionIdleTimer = () => {
    if (mapSelectionIdleTimerRef.current) {
      clearTimeout(mapSelectionIdleTimerRef.current);
      mapSelectionIdleTimerRef.current = null;
    }
  };

  const applyMapSelectionAt = useCallback(
    async (latitude, longitude) => {
      const mode = mapSelectionModeRef.current;
      if (!mode || !isMounted.current) return;
      setLoadingMapSelection(true);
      const loc = await reverseGeocode(latitude, longitude);
      setLoadingMapSelection(false);
      if (!isMounted.current) return;
      if (!loc) {
        showAlert('Ocurrió algo', 'No se pudo obtener la dirección');
        return;
      }
      if (mode === 'origin') {
        setOriginMarker({ latitude, longitude });
        setFormData(prev => ({ ...prev, origin: loc }));
        if (originInputRef.current?.setAddressText) {
          originInputRef.current.setAddressText([loc.address, loc.city, loc.province].filter(Boolean).join(', '));
        }
      } else if (mode === 'destination') {
        setDestinationMarker({ latitude, longitude });
        setFormData(prev => ({ ...prev, destination: loc }));
        if (destinationInputRef.current?.setAddressText) {
          destinationInputRef.current.setAddressText([loc.address, loc.city, loc.province].filter(Boolean).join(', '));
        }
      } else if (mode.startsWith('waypoint-')) {
        const idx = parseInt(mode.split('-')[1], 10);
        setWaypointMarkers(prev => {
          const n = [...prev];
          n[idx] = { latitude, longitude };
          return n;
        });
        setFormData(prev => {
          const n = [...prev.waypoints];
          n[idx] = loc;
          return { ...prev, waypoints: n };
        });
        if (waypointInputRefs.current[idx]?.current?.setAddressText) {
          waypointInputRefs.current[idx].current.setAddressText([loc.address, loc.city, loc.province].filter(Boolean).join(', '));
        }
      }
      setMapSelectionMode(null);
      mapSelectionModeRef.current = null;
      clearMapSelectionIdleTimer();
      if (mapRef.current && isMounted.current) {
        mapRef.current.animateToRegion(
          { latitude, longitude, latitudeDelta: LATITUDE_DELTA, longitudeDelta: LONGITUDE_DELTA },
          1000
        );
      }
    },
    [showAlert]
  );

  const scheduleMapSelectionIdleCommit = useCallback(() => {
    clearMapSelectionIdleTimer();
    mapSelectionIdleTimerRef.current = setTimeout(() => {
      mapSelectionIdleTimerRef.current = null;
      if (!mapSelectionModeRef.current || !isMounted.current) return;
      const c = lastRegionRef.current;
      if (!c) return;
      applyMapSelectionAt(c.latitude, c.longitude);
    }, MAP_SELECTION_IDLE_MS);
  }, [applyMapSelectionAt]);

  const extractComponents = (details) => {
    let street = '';
    let streetNumber = '';
    const { city, province } = cityFromGoogleComponents(details?.address_components);
    details.address_components?.forEach(c => {
      if (c.types?.includes('street_number')) streetNumber = c.long_name;
      if (c.types?.includes('route')) street = c.long_name;
    });
    return { city, province, fullStreet: [street, streetNumber].filter(Boolean).join(' ') };
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleMapPress = async (event) => {
    if (!mapSelectionMode) {
      Keyboard.dismiss();
      return;
    }
    clearMapSelectionIdleTimer();
    const { latitude, longitude } = event.nativeEvent.coordinate;
    await applyMapSelectionAt(latitude, longitude);
  };

  const handleOriginSelect = (data, details = null) => {
    try {
      if (!isMounted.current) return;
      setActiveAutocomplete(null); setAutocompleteResults([]);
      if (details?.geometry?.location) {
        const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
        const { city, province, fullStreet } = extractComponents(details);
        const text = [fullStreet || data?.description?.split(',')[0] || '', city, province].filter(Boolean).join(', ');
        setOriginMarker(coords);
        setFormData(prev => ({ ...prev, origin: { address: data?.description || '', city, province, country: 'Argentina', coordinates: coords } }));
        if (originInputRef.current?.setAddressText) { try { originInputRef.current.setAddressText(text); } catch {} }
        if (mapRef.current && isMounted.current) setTimeout(() => { if (mapRef.current && isMounted.current) mapRef.current.animateToRegion({ ...coords, latitudeDelta: LATITUDE_DELTA, longitudeDelta: LONGITUDE_DELTA }, 1000); }, 300);
      }
    } catch (e) { console.error('handleOriginSelect:', e); }
  };

  const handleDestinationSelect = (data, details = null) => {
    try {
      if (!isMounted.current) return;
      setActiveAutocomplete(null); setAutocompleteResults([]);
      if (details?.geometry?.location) {
        const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
        const { city, province, fullStreet } = extractComponents(details);
        const text = [fullStreet || data?.description?.split(',')[0] || '', city, province].filter(Boolean).join(', ');
        setDestinationMarker(coords);
        setFormData(prev => ({ ...prev, destination: { address: data?.description || '', city, province, country: 'Argentina', coordinates: coords } }));
        if (destinationInputRef.current?.setAddressText) { try { destinationInputRef.current.setAddressText(text); } catch {} }
      }
    } catch (e) { console.error('handleDestinationSelect:', e); }
  };

  const handleWaypointSelect = (data, details, idx) => {
    try {
      if (!isMounted.current) return;
      setActiveAutocomplete(null); setAutocompleteResults([]);
      if (details?.geometry?.location) {
        const coords = { latitude: details.geometry.location.lat, longitude: details.geometry.location.lng };
        const { city, province, fullStreet } = extractComponents(details);
        const text = [fullStreet || data?.description?.split(',')[0] || '', city, province].filter(Boolean).join(', ');
        setWaypointMarkers(prev => { const n = [...prev]; n[idx] = coords; return n; });
        setFormData(prev => { const n = [...prev.waypoints]; n[idx] = { address: data?.description || '', city, province, coordinates: coords }; return { ...prev, waypoints: n }; });
        if (waypointInputRefs.current[idx]?.current?.setAddressText) { try { waypointInputRefs.current[idx].current.setAddressText(text); } catch {} }
      }
    } catch (e) { console.error('handleWaypointSelect:', e); }
  };

  const handleResultPress = (item) => {
    const field = activeAutocomplete;
    closeSearch();
    setLoadingMapSelection(true);
    Promise.all([
      getPlaceDetailsApi(item.place_id),
      new Promise(resolve => setTimeout(resolve, 1500)),
    ]).then(([data]) => {
      if (!isMounted.current) return;
      setLoadingMapSelection(false);
      if (!data?.result) return;
      if (field === 'origin') handleOriginSelect({ description: item.description }, data.result);
      else if (field === 'destination') handleDestinationSelect({ description: item.description }, data.result);
      else if (field?.startsWith('waypoint-')) handleWaypointSelect({ description: item.description }, data.result, parseInt(field.split('-')[1]));
    });
  };

  // Dirección frecuente: ya tenemos address/city/province/coordinates guardados, sin llamar a Place Details de nuevo.
  const handleSelectFrequent = (addr) => {
    const field = activeAutocomplete;
    closeSearch();
    const coords = addr.coordinates?.latitude != null
      ? { latitude: addr.coordinates.latitude, longitude: addr.coordinates.longitude }
      : null;
    const locationData = { address: addr.address, city: addr.city || '', province: addr.province || '', country: addr.country || 'Argentina', coordinates: coords };
    const text = [addr.address, addr.city, addr.province].filter(Boolean).join(', ');

    if (field === 'origin') {
      setOriginMarker(coords);
      setFormData(prev => ({ ...prev, origin: locationData }));
      if (originInputRef.current?.setAddressText) { try { originInputRef.current.setAddressText(text); } catch {} }
      if (coords && mapRef.current) setTimeout(() => { if (mapRef.current && isMounted.current) mapRef.current.animateToRegion({ ...coords, latitudeDelta: LATITUDE_DELTA, longitudeDelta: LONGITUDE_DELTA }, 1000); }, 300);
    } else if (field === 'destination') {
      setDestinationMarker(coords);
      setFormData(prev => ({ ...prev, destination: locationData }));
      if (destinationInputRef.current?.setAddressText) { try { destinationInputRef.current.setAddressText(text); } catch {} }
    } else if (field?.startsWith('waypoint-')) {
      const idx = parseInt(field.split('-')[1], 10);
      setWaypointMarkers(prev => { const n = [...prev]; n[idx] = coords; return n; });
      setFormData(prev => { const n = [...prev.waypoints]; n[idx] = { ...locationData, order: idx + 1 }; return { ...prev, waypoints: n }; });
      if (waypointInputRefs.current[idx]?.current?.setAddressText) { try { waypointInputRefs.current[idx].current.setAddressText(text); } catch {} }
    }
  };

  const addWaypoint = () => {
    if (formData.waypoints.length >= 3) { showAlert('Límite alcanzado', 'Máximo 3 paradas intermedias'); return; }
    setFormData(prev => ({ ...prev, waypoints: [...prev.waypoints, { id: Date.now().toString(), address: '', city: '', province: '', coordinates: null }] }));
    waypointInputRefs.current.push(React.createRef());
    waypointResultsRef.current.push([]);
    waypointDebounceTimers.current.push(null);
  };

  const removeWaypoint = (index) => {
    setFormData(prev => ({ ...prev, waypoints: prev.waypoints.filter((_, i) => i !== index) }));
    setWaypointMarkers(prev => prev.filter((_, i) => i !== index));
    waypointInputRefs.current.splice(index, 1);
    waypointResultsRef.current.splice(index, 1);
    waypointDebounceTimers.current.splice(index, 1);
    if (activeAutocomplete === `waypoint-${index}`) { setActiveAutocomplete(null); setAutocompleteResults([]); }
    if (mapSelectionMode === `waypoint-${index}`) setMapSelectionMode(null);
  };

  const clearOrigin = () => {
    setOriginMarker(null); setRouteCoordinates([]); setDistance(null); setDuration(null); setMapSelectionMode(null);
    setFormData(prev => ({ ...prev, origin: { address: '', city: '', province: '', coordinates: null } }));
    if (originInputRef.current?.setAddressText) { try { originInputRef.current.setAddressText(''); } catch {} }
  };

  const clearDestination = () => {
    setDestinationMarker(null); setRouteCoordinates([]); setDistance(null); setDuration(null); setMapSelectionMode(null);
    setFormData(prev => ({ ...prev, destination: { address: '', city: '', province: '', coordinates: null } }));
    if (destinationInputRef.current?.setAddressText) { try { destinationInputRef.current.setAddressText(''); } catch {} }
  };

  const openSearch = (field) => {
    setMapSelectionMode(null);
    setActiveAutocomplete(field);
    setSearchVisible(true);
    overlayOpacity.setValue(0);
    overlayTranslateY.setValue(16);
    Animated.parallel([
      Animated.timing(overlayOpacity,     { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayTranslateY,  { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
    // Populate already-selected addresses and focus active input after overlay mounts
    setTimeout(() => {
      if (formData.origin.address && originInputRef.current?.setAddressText) {
        try { originInputRef.current.setAddressText([formData.origin.address, formData.origin.city, formData.origin.province].filter(Boolean).join(', ')); } catch {}
      }
      if (formData.destination.address && destinationInputRef.current?.setAddressText) {
        try { destinationInputRef.current.setAddressText([formData.destination.address, formData.destination.city, formData.destination.province].filter(Boolean).join(', ')); } catch {}
      }
      formData.waypoints.forEach((wp, i) => {
        if (wp.address && waypointInputRefs.current[i]?.current?.setAddressText) {
          try { waypointInputRefs.current[i].current.setAddressText([wp.address, wp.city, wp.province].filter(Boolean).join(', ')); } catch {}
        }
      });
      // Auto-focus the tapped input
      try {
        if (field === 'origin' && originInputRef.current?.focus) {
          originInputRef.current.focus();
        } else if (field === 'destination' && destinationInputRef.current?.focus) {
          destinationInputRef.current.focus();
        } else if (field?.startsWith('waypoint-')) {
          const idx = parseInt(field.split('-')[1]);
          if (waypointInputRefs.current[idx]?.current?.focus) waypointInputRefs.current[idx].current.focus();
        }
      } catch {}
    }, 80);
  };

  const closeSearch = () => {
    Keyboard.dismiss();
    originResultsRef.current = [];
    destinationResultsRef.current = [];
    waypointResultsRef.current = [];
    Animated.parallel([
      Animated.timing(overlayOpacity,    { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(overlayTranslateY, { toValue: 12, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setSearchVisible(false);
      setActiveAutocomplete(null);
      setAutocompleteResults([]);
    });
  };

  const handleGoToVehicles = () => {
    navigation.navigate('Main', {
      screen: 'ProfileTab',
      params: { screen: 'Vehicles' },
    });
  };

  const renderEarlyExitHeader = () => (
    <View style={[styles.earlyExitHeader, { paddingTop: insets.top }]}>
      <TouchableOpacity
        style={[styles.circleBtn, { backgroundColor: cardBg }]}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel="Volver atrás"
      >
        <Ionicons name="arrow-back" size={22} color={textPrimary} />
      </TouchableOpacity>
    </View>
  );

  const handleContinueToDetails = () => {
    if (!originMarker || !destinationMarker) { showAlert('Datos incompletos', 'Por favor seleccioná origen y destino'); return; }
    if (isRequestMode) {
      navigation.getParent('AppStack')?.navigate('TripRequestDetails', {
        origin: formData.origin,
        destination: formData.destination,
        waypoints: formData.waypoints.filter(wp => wp.coordinates !== null),
        distanceKm,
      });
      return;
    }
    if (loadingVehicles) { showAlert('Un momento', 'Estamos verificando tus vehículos...'); return; }
    if (!vehicles?.length) {
      showAlert('Vehículo requerido', 'Necesitás registrar un vehículo antes de crear un viaje', [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Ir a mis vehículos', onPress: handleGoToVehicles },
      ]);
      return;
    }
    navigation.navigate('TripDetails', { origin: formData.origin, destination: formData.destination, waypoints: formData.waypoints.filter(wp => wp.coordinates !== null), distance, duration, routePolyline, vehicles });
  };

  const hasRoute = originMarker && destinationMarker;

  // ─── Early returns ────────────────────────────────────────────────────────

  if (!isRequestMode && loadingVehicles) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        {renderEarlyExitHeader()}
        <View style={[styles.emptyContainer, { flex: 1 }]}>
          <ActivityIndicator size="large" color={textPrimary} />
          <Text style={[styles.emptyText, { color: textMuted }]}>Verificando vehículos...</Text>
        </View>
      </View>
    );
  }

  if (!isRequestMode && !vehicles?.length) {
    return (
      <View style={{ flex: 1, backgroundColor: bg }}>
        {renderEarlyExitHeader()}
        <View style={[styles.emptyContainer, { flex: 1 }]}>
          <Ionicons name="car-outline" size={64} color={textMuted} />
          <Text style={[styles.emptyTitle, { color: textPrimary }]}>Sin vehículos registrados</Text>
          <Text style={[styles.emptyText, { color: textMuted, textAlign: 'center' }]}>
            Necesitás registrar un vehículo antes de crear un viaje
          </Text>
          <TouchableOpacity
            style={[styles.emptyCtaBtn, { backgroundColor: ui.invertBg }]}
            onPress={handleGoToVehicles}
            activeOpacity={0.85}
          >
            <Text style={[styles.emptyCtaText, { color: ui.invertText }]}>Ir a mis vehículos</Text>
            <Ionicons name="chevron-forward" size={18} color={ui.invertText} style={{ marginLeft: 4 }} />
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const isSearching = activeAutocomplete !== null;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Map */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        region={region}
        onMapReady={() => setMapaListo(true)}
        onRegionChange={(r) => {
          lastRegionRef.current = r;
          if (mapSelectionModeRef.current) levantarPin(true);
          if (!mapSelectionModeRef.current || !hasMapGestureForSelectionRef.current) return;
          scheduleMapSelectionIdleCommit();
        }}
        onRegionChangeComplete={(r, d = {}) => {
          lastRegionRef.current = r;
          levantarPin(false);
          if (d.isGesture) {
            setRegion(r);
            if (mapSelectionModeRef.current) {
              hasMapGestureForSelectionRef.current = true;
              scheduleMapSelectionIdleCommit();
            }
          }
        }}
        paddingAdjustmentBehavior="never"
        showsUserLocation={mostrarMiUbicacion}
        showsMyLocationButton={false}
        onPress={handleMapPress}
      >
        {originMarker && (
          Platform.OS === 'android'
            ? <Marker coordinate={originMarker} anchor={{ x: 0.5, y: 0.5 }} image={require('../../../../assets/marker-origin.png')} />
            : <Marker coordinate={originMarker} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.originMarkerOuter}><View style={styles.markerInner} /></View>
              </Marker>
        )}
        {destinationMarker && (
          Platform.OS === 'android'
            ? <Marker coordinate={destinationMarker} anchor={{ x: 0.5, y: 0.5 }} image={require('../../../../assets/marker-dest.png')} />
            : <Marker coordinate={destinationMarker} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.destMarkerOuter}><View style={styles.markerInner} /></View>
              </Marker>
        )}
        {waypointMarkers.map((m, i) => (
          <Marker key={`wp-${i}`} coordinate={m} anchor={{ x: 0.5, y: 0.5 }}>
            <View style={styles.waypointMarker}><Text style={styles.waypointMarkerText}>{i + 1}</Text></View>
          </Marker>
        ))}
        {routeCoordinates.length > 0 && (
          <RutaPolyline coordinates={routeCoordinates} width={5} color="#000000" />
        )}
      </MapView>

      {/* Back button (mini mode) */}
      {!isSearching && (
        <View style={[styles.topBar, { paddingTop: insets.top }]}>
          <TouchableOpacity style={[styles.circleBtn, { backgroundColor: cardBg }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>
        </View>
      )}

      {/* My location (mini mode) */}
      {!isSearching && (
        <TouchableOpacity
          style={[styles.myLocationBtn, { backgroundColor: cardBg }]}
          onPress={() => { getCurrentLocation(); if (userLocation && mapRef.current) mapRef.current.animateToRegion({ ...userLocation, latitudeDelta: LATITUDE_DELTA, longitudeDelta: LONGITUDE_DELTA }, 1000); }}
        >
          <Ionicons name="navigate" size={20} color={textPrimary} />
        </TouchableOpacity>
      )}

      {/* Map selection banner */}
      {mapSelectionMode && !isSearching && (
        <>
          <View style={[styles.selectionBanner, { top: insets.top + 72 }]}>
            <Text style={styles.selectionText}>
              {mapSelectionMode === 'origin' || mapSelectionMode === 'destination'
                ? 'Mové el mapa o tocá para seleccionar.'
                : `Parada ${parseInt(mapSelectionMode.split('-')[1], 10) + 1}: mové o tocá para seleccionar.`}
            </Text>
            <TouchableOpacity onPress={() => setMapSelectionMode(null)} style={{ marginLeft: 12 }}>
              <Text style={styles.selectionCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
          <MapCenterPin alzado={alzado} />
        </>
      )}

      {/* ── MINI BOTTOM SHEET ── */}
      {!isSearching && (
        <Animated.View
          style={[styles.miniSheet, { backgroundColor: cardBg, paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 0) + 16, transform: [{ translateY: sheetTranslateY }] }]}
          onLayout={(e) => { sheetFullHeight.current = e.nativeEvent.layout.height; }}
        >
          <View style={styles.handleContainer} {...sheetPanResponder.panHandlers}>
            <View style={[styles.handle, { backgroundColor: border }]} />
          </View>

          <View style={styles.miniInputs}>
            {/* Timeline */}
            <View style={styles.miniTimeline}>
              <View style={[styles.tlDotOrigin, { backgroundColor: textPrimary }]} />
              <View style={[styles.tlLine, { backgroundColor: border }]} />
              {formData.waypoints.map((wp) => (
                <React.Fragment key={`tl-${wp.id}`}>
                  <View style={[styles.tlDotWp, { backgroundColor: textMuted }]} />
                  <View style={[styles.tlLine, { backgroundColor: border }]} />
                </React.Fragment>
              ))}
              <View style={[styles.tlDotDest, { backgroundColor: textPrimary }]} />
            </View>

            {/* Rows */}
            <View style={{ flex: 1 }}>
              {/* Origin */}
              <TouchableOpacity style={[styles.miniRow, { borderBottomColor: divider }]} onPress={() => openSearch('origin')} activeOpacity={0.7}>
                <Text style={[styles.miniRowText, { color: formData.origin.address ? textPrimary : textMuted }]} numberOfLines={1}>
                  {formData.origin.address
                    ? [formData.origin.address, formData.origin.city].filter(Boolean).join(', ')
                    : '¿Desde dónde salís?'}
                </Text>
                {formData.origin.address && (
                  <TouchableOpacity onPress={clearOrigin} style={styles.rowBtn}><Ionicons name="close-circle" size={17} color={textMuted} /></TouchableOpacity>
                )}
              </TouchableOpacity>

              {/* Waypoints */}
              {formData.waypoints.map((wp, i) => (
                <TouchableOpacity key={`wp-row-${wp.id}`} style={[styles.miniRow, { borderBottomColor: divider }]} onPress={() => openSearch(`waypoint-${i}`)} activeOpacity={0.7}>
                  <Text style={[styles.miniRowText, { color: wp.address ? textPrimary : textMuted }]} numberOfLines={1}>
                    {wp.address ? [wp.address, wp.city].filter(Boolean).join(', ') : `Parada ${i + 1}`}
                  </Text>
                  <TouchableOpacity onPress={() => removeWaypoint(i)} style={styles.rowBtn}>
                    <Ionicons name="close-circle" size={17} color={wp.address ? ui.textMuted : textMuted} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}

              {/* Add waypoint */}
              {formData.waypoints.length < 3 && (
                <TouchableOpacity style={[styles.miniRow, { borderBottomColor: divider }]} onPress={addWaypoint} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={16} color={textMuted} />
                  <Text style={[styles.miniAddText, { color: textMuted }]}>Agregar parada</Text>
                </TouchableOpacity>
              )}

              {/* Destination */}
              <TouchableOpacity style={styles.miniRow} onPress={() => openSearch('destination')} activeOpacity={0.7}>
                <Text style={[styles.miniRowText, { color: formData.destination.address ? textPrimary : textMuted }]} numberOfLines={1}>
                  {formData.destination.address
                    ? [formData.destination.address, formData.destination.city].filter(Boolean).join(', ')
                    : '¿A dónde vas?'}
                </Text>
                {formData.destination.address && (
                  <TouchableOpacity onPress={clearDestination} style={styles.rowBtn}><Ionicons name="close-circle" size={17} color={textMuted} /></TouchableOpacity>
                )}
              </TouchableOpacity>
            </View>
          </View>

          {/* Route section */}
          {hasRoute && (
            <View style={[styles.routeSection, { borderTopColor: divider }]}>
              {/* {distance && duration && (
                <Text style={[styles.routeMeta, { color: textMuted }]}>{distance} · {duration}</Text>
              )} */}
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: ui.invertBg }, loadingRoute && { opacity: 0.7 }]}
                onPress={handleContinueToDetails}
                disabled={loadingVehicles || loadingRoute}
                activeOpacity={0.85}
              >
                {loadingRoute
                  ? <ActivityIndicator size="small" color={ui.invertText} />
                  : (
                    <>
                      <Text style={[styles.confirmText, { color: ui.invertText }]}>Confirmar ruta</Text>
                      <View style={styles.confirmBtnChevrons}>
                        {[0.35, 0.6, 1].map((opacity, i) => (
                          <Ionicons key={i} name="chevron-forward" size={15} color={ui.invertText} style={{ opacity, marginLeft: -5 }} />
                        ))}
                      </View>
                    </>
                  )
                }
              </TouchableOpacity>
            </View>
          )}
        </Animated.View>
      )}

      {/* ── SEARCH OVERLAY (Uber style) ── */}
      {searchVisible && (
        <Animated.View style={[styles.searchOverlay, { opacity: overlayOpacity, transform: [{ translateY: overlayTranslateY }] }]}>
        <KeyboardAvoidingView
          style={[{ flex: 1, backgroundColor: cardBg }]}
          behavior="padding"
        >
          {/* Header */}
          <View style={[styles.searchHeader, { paddingTop: insets.top + 8, borderBottomColor: divider }]}>
            <TouchableOpacity onPress={closeSearch} style={styles.searchBackBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={22} color={textPrimary} />
            </TouchableOpacity>
          </View>

          {/* All inputs with timeline */}
          <View style={styles.searchInputsWrapper}>
            {/* Timeline */}
            <View style={styles.searchTimeline}>
              <View style={[styles.tlDotOrigin, { backgroundColor: textPrimary }]} />
              <View style={[styles.tlLine, { backgroundColor: border }]} />
              {formData.waypoints.map((wp) => (
                <React.Fragment key={`stl-${wp.id}`}>
                  <View style={[styles.tlDotWp, { backgroundColor: textMuted }]} />
                  <View style={[styles.tlLine, { backgroundColor: border }]} />
                </React.Fragment>
              ))}
              <View style={[styles.tlDotDest, { backgroundColor: textPrimary }]} />
            </View>

            <View style={{ flex: 1 }}>
              {/* Origin input */}
              <View style={[styles.searchInputRow, { borderBottomColor: divider, zIndex: 3000, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                <SafePlacesAutocomplete
                  inputRef={originInputRef}
                  placeholder="¿Desde dónde salís?"
                  onPress={handleOriginSelect}
                  debounce={1500}
                  inputType="origin"
                  onFocusChange={(type) => {
                    if (type === 'origin') { setActiveAutocomplete('origin'); setAutocompleteResults(originResultsRef.current); }
                    else if (type !== null) { setActiveAutocomplete(null); setAutocompleteResults([]); }
                  }}
                  onResultsChange={(results) => { originResultsRef.current = results; if (activeAutocomplete === 'origin') setAutocompleteResults(results); }}
                  externalResults={[]} externalLoading={false}
                  styles={{ container: { flex: 1, zIndex: 3000 }, textInput: { height: 44, color: textPrimary, fontSize: 15, fontWeight: '500', backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 0 } }}
                />
                {formData.origin.address && (
                  <TouchableOpacity onPress={clearOrigin} style={styles.rowBtn}><Ionicons name="close-circle" size={18} color={textMuted} /></TouchableOpacity>
                )}
              </View>

              {/* Waypoint inputs */}
              {formData.waypoints.map((wp, i) => {
                if (!waypointInputRefs.current[i]) waypointInputRefs.current[i] = React.createRef();
                return (
                  <View key={`sinput-wp-${wp.id}`} style={[styles.searchInputRow, { borderBottomColor: divider, zIndex: 2500 - i * 100, borderBottomWidth: StyleSheet.hairlineWidth }]}>
                    <SafePlacesAutocomplete
                      inputRef={waypointInputRefs.current[i]}
                      placeholder={`Parada ${i + 1}`}
                      onPress={(d, det) => handleWaypointSelect(d, det, i)}
                          debounce={1500}
                      inputType={`waypoint-${i}`}
                      onFocusChange={(type) => {
                        if (type === `waypoint-${i}`) { setActiveAutocomplete(`waypoint-${i}`); setAutocompleteResults(waypointResultsRef.current[i] || []); }
                        else if (type !== null) { setActiveAutocomplete(null); setAutocompleteResults([]); }
                      }}
                      onResultsChange={(results) => { waypointResultsRef.current[i] = results; if (activeAutocomplete === `waypoint-${i}`) setAutocompleteResults(results); }}
                      externalResults={[]} externalLoading={false}
                      styles={{ container: { flex: 1, zIndex: 2500 - i * 100 }, textInput: { height: 44, color: textPrimary, fontSize: 15, fontWeight: '500', backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 0 } }}
                    />
                    <TouchableOpacity onPress={() => removeWaypoint(i)} style={styles.rowBtn}>
                      <Ionicons name="close-circle" size={18} color={textMuted} />
                    </TouchableOpacity>
                  </View>
                );
              })}

              {/* Add waypoint */}
              {formData.waypoints.length < 3 && (
                <TouchableOpacity style={[styles.searchInputRow, { borderBottomColor: divider, borderBottomWidth: StyleSheet.hairlineWidth }]} onPress={addWaypoint} activeOpacity={0.7}>
                  <Ionicons name="add-circle-outline" size={16} color={textMuted} style={{ marginLeft: 12 }} />
                  <Text style={[styles.miniAddText, { color: textMuted, paddingVertical: 14 }]}>Agregar parada</Text>
                </TouchableOpacity>
              )}

              {/* Destination input */}
              <View style={[styles.searchInputRow, { zIndex: 2000 }]}>
                <SafePlacesAutocomplete
                  inputRef={destinationInputRef}
                  placeholder="¿A dónde vas?"
                  onPress={handleDestinationSelect}
                  debounce={1500}
                  inputType="destination"
                  onFocusChange={(type) => {
                    if (type === 'destination') { setActiveAutocomplete('destination'); setAutocompleteResults(destinationResultsRef.current); }
                    else if (type !== null) { setActiveAutocomplete(null); setAutocompleteResults([]); }
                  }}
                  onResultsChange={(results) => { destinationResultsRef.current = results; if (activeAutocomplete === 'destination') setAutocompleteResults(results); }}
                  externalResults={[]} externalLoading={false}
                  styles={{ container: { flex: 1, zIndex: 2000 }, textInput: { height: 44, color: textPrimary, fontSize: 15, fontWeight: '500', backgroundColor: 'transparent', paddingHorizontal: 12, paddingVertical: 0 } }}
                />
                {formData.destination.address && (
                  <TouchableOpacity onPress={clearDestination} style={styles.rowBtn}><Ionicons name="close-circle" size={18} color={textMuted} /></TouchableOpacity>
                )}
              </View>
            </View>
          </View>

          {/* Results list — fills remaining space above keyboard */}
          <ScrollView
            style={[styles.results, { borderTopColor: divider }]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {/* Marcar en mapa — siempre visible */}
            <TouchableOpacity
              style={[styles.resultRow, { borderBottomColor: divider }]}
              onPress={() => { const mode = activeAutocomplete; closeSearch(); setMapSelectionMode(mode); }}
              activeOpacity={0.6}
            >
              <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
                <Ionicons name="map-outline" size={16} color={textPrimary} />
              </View>
              <Text style={[styles.resultMain, { color: textPrimary }]}>Marcar en el mapa</Text>
            </TouchableOpacity>

            {autocompleteResults.length === 0 && frequentAddresses.length > 0 && (
              <>
                <Text style={[styles.resultSub, { color: textMuted, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase', fontWeight: '600', fontSize: 11 }]}>
                  Direcciones frecuentes
                </Text>
                {frequentAddresses.map((addr, i) => (
                  <TouchableOpacity
                    key={`freq-${i}`}
                    style={[styles.resultRow, { borderBottomColor: divider }]}
                    onPress={() => handleSelectFrequent(addr)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
                      <Ionicons name="time-outline" size={16} color={textPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.resultMain, { color: textPrimary }]} numberOfLines={1}>{addr.address}</Text>
                      {!!addr.city && <Text style={[styles.resultSub, { color: textMuted }]} numberOfLines={1}>{addr.city}</Text>}
                    </View>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {autocompleteResults.map((item) => (
              <TouchableOpacity
                key={item.place_id}
                style={[styles.resultRow, { borderBottomColor: divider }]}
                onPress={() => handleResultPress(item)}
                activeOpacity={0.6}
              >
                <View style={[styles.resultIcon, { backgroundColor: iconBg }]}>
                  <Ionicons name="location-sharp" size={16} color={textPrimary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.resultMain, { color: textPrimary }]} numberOfLines={1}>
                    {item.structured_formatting?.main_text || item.description}
                  </Text>
                  <Text style={[styles.resultSub, { color: textMuted }]} numberOfLines={1}>
                    {item.structured_formatting?.secondary_text || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </KeyboardAvoidingView>
        </Animated.View>
      )}

      {/* Loading overlay */}
      {(loadingMapSelection || loadingRoute) && (
        <View style={styles.loadingOverlay}>
          <View style={[styles.loadingBox, { backgroundColor: cardBg }]}>
            <ActivityIndicator size="large" color={textPrimary} />
            <Text style={[styles.loadingText, { color: textMuted }]}>
              {loadingMapSelection ? 'Obteniendo dirección...' : 'Calculando ruta...'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject, width, height },

  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  earlyExitHeader: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  circleBtn: {
    marginLeft: 16, marginTop: 8,
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  myLocationBtn: {
    position: 'absolute', right: 16, bottom: 300,
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },

  // Map selection
  // Sin zIndex, como el resto: este banner MONTA justo al entrar en modo selección, y ese
  // montaje es el que hacía que React Native reordenara las subvistas nativas y le rompiera
  // la superficie GL al mapa. Se declara después del mapa, así que queda encima igual.
  selectionBanner: {
    position: 'absolute', left: 16, right: 16,
    backgroundColor: '#1F2937', borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 8,
  },
  selectionText: { flex: 1, color: '#FFFFFF', fontSize: 13, fontFamily: 'Sora_500Medium' },
  selectionCancelText: { color: '#FFFFFF', fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  // Mini sheet
  miniSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  miniInputs: { flexDirection: 'row', paddingHorizontal: 20 },
  miniTimeline: { width: 20, alignItems: 'center', paddingTop: 16, paddingBottom: 16, marginRight: 8 },
  miniRow: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  miniRowText: { flex: 1, fontSize: 15, fontFamily: 'Sora_500Medium' },
  miniAddText: { flex: 1, fontSize: 14, marginLeft: 4 },
  rowBtn: { padding: 4 },
  mapIconBtn: { padding: 8, borderRadius: 8 },

  // Map pills
  mapPillsScroll: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mapPillsRow: {
    flexDirection: 'row', gap: 8,
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6,
  },
  mapPill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 9, borderRadius: 10,
  },
  mapPillText: { fontSize: 12, fontFamily: 'Sora_600SemiBold' },

  // Route section
  routeSection: {
    marginTop: 8, paddingTop: 14, paddingHorizontal: 20,
    paddingBottom: 4, borderTopWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  routeMeta: { fontSize: 13, textAlign: 'center' },
  confirmBtn: {
    height: 58, borderRadius: 999, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
  },
  confirmText: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  confirmBtnChevrons: { flexDirection: 'row', alignItems: 'center', marginLeft: 14 },

  // Timeline dots (shared)
  tlDotOrigin: { width: 8, height: 8, borderRadius: 4 },
  tlDotDest:   { width: 8, height: 8 },
  tlDotWp:     { width: 6, height: 6, borderRadius: 3 },
  tlLine:      { flex: 1, width: 2, marginVertical: 3, minHeight: 16 },

  // Search overlay
  // Sin zIndex a propósito. Con zIndex, React Native reordena las subvistas NATIVAS al
  // montar y desmontar este overlay, y mover un GMSMapView de índice entre sus hermanos le
  // rompe la superficie GL: el mapa queda vivo pero sin dibujar tiles (todo celeste). El
  // overlay se declara casi al final del árbol, así que tapa igual sin pedirlo — sólo el
  // overlay de carga se declara al final del árbol, así que queda por encima igual.
  searchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchInputsWrapper: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  searchTimeline: { width: 20, alignItems: 'center', paddingTop: 14, paddingBottom: 14, marginRight: 8 },
  searchInputRow: {
    flexDirection: 'row', alignItems: 'center',
    minHeight: 48, overflow: 'visible',
  },

  // Results
  results: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  resultRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  resultIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  resultMain: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  resultSub:  { fontSize: 12, marginTop: 2 },

  // Markers
  originMarkerOuter: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  destMarkerOuter: { width: 22, height: 22, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  markerInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#000000', borderWidth: 2, borderColor: '#FFFFFF' },
  waypointMarker: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#555555', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  waypointMarkerText: { fontSize: 11, fontFamily: 'Sora_700Bold', color: '#FFFFFF' },

  // Loading
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' },
  loadingBox: { borderRadius: 16, padding: 24, alignItems: 'center', gap: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8 },
  loadingText: { fontSize: 14, fontFamily: 'Sora_500Medium' },

  // Empty
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, gap: 12 },
  emptyCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 12,
  },
  emptyCtaText: {
    fontSize: 15,
    fontFamily: 'Sora_600SemiBold',
  },
  emptyTitle: { fontSize: 18, fontFamily: 'Sora_600SemiBold', textAlign: 'center' },
  emptyText: { fontSize: 14, textAlign: 'center' },
});

export default CreateTripGoogleMaps;
