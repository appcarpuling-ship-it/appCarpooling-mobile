import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import socketService from '../../../services/socketService';
import { getDirections } from '../../../services/mapsService';

/** Cada cuánto se reporta la posición del conductor: nada de APIs pagas, solo GPS + socket */
const DRIVER_LOCATION_INTERVAL_MS = 8000;
const DRIVER_LOCATION_DISTANCE_M = 25;

const decodePolyline = (encoded) => {
  if (!encoded) return [];
  const pts = [];
  let i = 0, lat = 0, lng = 0;
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

const TripMapScreen = ({ route, navigation }) => {
  const { trip } = route.params;
  const insets = useSafeAreaInsets();
  const { getCurrentThemeMode } = useColors();
  const { user } = useAuth();
  const mapRef = useRef(null);
  const isMounted = useRef(true);
  const locationWatchRef = useRef(null);

  const isDark = getCurrentThemeMode() === 'dark';
  const cardBg = isDark ? '#1E1E1E' : '#FFFFFF';
  const textPrimary = isDark ? '#FFFFFF' : '#000000';

  const [routeCoordinates, setRouteCoordinates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStop, setSelectedStop] = useState(null);
  const [driverLocation, setDriverLocation] = useState(trip?.currentLocation || null);

  const originCoords = trip?.origin?.coordinates;
  const destCoords = trip?.destination?.coordinates;
  const stops = (trip?.intermediateStops || [])
    .filter(s => s?.coordinates?.latitude && s?.coordinates?.longitude)
    .sort((a, b) => a.order - b.order);

  const userId = user?._id || user?.id;
  const driverId = trip?.driver?._id || trip?.driver?.id;
  const isDriver = Boolean(userId && driverId && String(userId) === String(driverId));
  const isTripStarted = trip?.status === 'started';

  useEffect(() => {
    isMounted.current = true;
    fetchRoute();
    return () => { isMounted.current = false; };
  }, []);

  // Ubicación en vivo del conductor: se comparte por socket (sin costo de API), no por polling ni geocodificación.
  useEffect(() => {
    if (!trip?._id || !isTripStarted) return;

    if (isDriver) {
      let cancelled = false;
      (async () => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted' || cancelled) return;
        locationWatchRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: DRIVER_LOCATION_INTERVAL_MS,
            distanceInterval: DRIVER_LOCATION_DISTANCE_M,
          },
          (loc) => {
            socketService.sendTripLocationUpdate(trip._id, {
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              heading: loc.coords.heading,
            });
          }
        );
      })();
      return () => {
        cancelled = true;
        locationWatchRef.current?.remove?.();
        locationWatchRef.current = null;
      };
    }

    // Pasajero: solo escucha la posición ya calculada por el conductor, sin llamadas propias.
    socketService.joinTripTracking(trip._id);
    socketService.onTripLocation((data) => {
      if (data?.tripId === trip._id) {
        setDriverLocation({ latitude: data.latitude, longitude: data.longitude, heading: data.heading });
      }
    });
    return () => {
      socketService.leaveTripTracking(trip._id);
      socketService.removeListener('trip:location');
    };
  }, [trip?._id, isTripStarted, isDriver]);

  const fetchRoute = async () => {
    if (!originCoords?.latitude || !destCoords?.latitude) {
      setLoading(false);
      return;
    }
    try {
      const orig = `${originCoords.latitude},${originCoords.longitude}`;
      const dest = `${destCoords.latitude},${destCoords.longitude}`;
      let waypointsParam;
      if (stops.length > 0) {
        waypointsParam = stops.map(s => `${s.coordinates.latitude},${s.coordinates.longitude}`).join('|');
      }
      const data = await getDirections(orig, dest, waypointsParam);
      if (!isMounted.current) return;
      if (data.routes?.length > 0) {
        const r = data.routes[0];
        let points = [];
        r.legs?.forEach(leg => leg.steps?.forEach(step => {
          if (step.polyline?.points) points.push(...decodePolyline(step.polyline.points));
        }));
        if (points.length === 0 && r.overview_polyline?.points) points = decodePolyline(r.overview_polyline.points);
        if (points.length > 0) {
          setRouteCoordinates(points);
          setTimeout(() => {
            if (mapRef.current && isMounted.current) {
              mapRef.current.fitToCoordinates(points, {
                edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
                animated: true,
              });
            }
          }, 400);
        }
      }
    } catch (e) {
      // fallback: fit to markers
      const allCoords = [
        originCoords && { latitude: originCoords.latitude, longitude: originCoords.longitude },
        ...stops.map(s => ({ latitude: s.coordinates.latitude, longitude: s.coordinates.longitude })),
        destCoords && { latitude: destCoords.latitude, longitude: destCoords.longitude },
      ].filter(Boolean);
      if (mapRef.current && isMounted.current && allCoords.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(allCoords, {
            edgePadding: { top: 80, right: 40, bottom: 80, left: 40 },
            animated: true,
          });
        }, 400);
      }
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const initialRegion = originCoords?.latitude
    ? { latitude: originCoords.latitude, longitude: originCoords.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }
    : { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 2, longitudeDelta: 2 };

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton
        paddingAdjustmentBehavior="never"
      >
        {!isDriver && driverLocation?.latitude && (
          <Marker
            coordinate={{ latitude: driverLocation.latitude, longitude: driverLocation.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={driverLocation.heading || 0}
            flat
          >
            <View style={styles.driverMarker}>
              <Ionicons name="navigate" size={16} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {originCoords?.latitude && (
          Platform.OS === 'android'
            ? <Marker coordinate={{ latitude: originCoords.latitude, longitude: originCoords.longitude }} anchor={{ x: 0.5, y: 0.5 }} image={require('../../../../assets/marker-origin.png')} />
            : <Marker coordinate={{ latitude: originCoords.latitude, longitude: originCoords.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.originMarker}><View style={styles.markerInner} /></View>
              </Marker>
        )}

        {stops.map((stop, i) => (
          <Marker
            key={`stop-${i}`}
            coordinate={{ latitude: stop.coordinates.latitude, longitude: stop.coordinates.longitude }}
            anchor={{ x: 0.5, y: 0.5 }}
            onPress={() => setSelectedStop(selectedStop?.index === i ? null : { index: i, address: stop.address || stop.city || `Parada ${i + 1}` })}
          >
            <View style={styles.waypointMarker}>
              <Text style={styles.waypointNumber}>{i + 1}</Text>
            </View>
          </Marker>
        ))}

        {destCoords?.latitude && (
          Platform.OS === 'android'
            ? <Marker coordinate={{ latitude: destCoords.latitude, longitude: destCoords.longitude }} anchor={{ x: 0.5, y: 0.5 }} image={require('../../../../assets/marker-dest.png')} />
            : <Marker coordinate={{ latitude: destCoords.latitude, longitude: destCoords.longitude }} anchor={{ x: 0.5, y: 0.5 }}>
                <View style={styles.destMarker}><View style={styles.markerInner} /></View>
              </Marker>
        )}

        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeWidth={5}
            strokeColor="#010101"
            strokeColors={['#010101']}
            lineCap="round"
            lineJoin="round"
          />
        )}
      </MapView>

      {/* Back button */}
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: cardBg }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.8}
        >
          <Ionicons name="arrow-back" size={22} color={textPrimary} />
        </TouchableOpacity>
      </View>

      {selectedStop && (
        <TouchableOpacity
          style={[styles.stopTooltip, { backgroundColor: cardBg }]}
          onPress={() => setSelectedStop(null)}
          activeOpacity={0.9}
        >
          <Text style={[styles.stopTooltipLabel, { color: textPrimary }]}>Parada {selectedStop.index + 1}</Text>
          <Text style={[styles.stopTooltipAddress, { color: textPrimary }]}>{selectedStop.address}</Text>
        </TouchableOpacity>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#010101" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  originMarker: { width: 22, height: 22, borderRadius: 11, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  destMarker: { width: 22, height: 22, backgroundColor: 'rgba(0,0,0,0.1)', justifyContent: 'center', alignItems: 'center' },
  markerInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#010101' },
  waypointMarker: { width: 26, height: 26, borderRadius: 13, backgroundColor: '#555555', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  driverMarker: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#2563EB', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFFFFF' },
  waypointNumber: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  stopTooltip: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  stopTooltipLabel: { fontSize: 11, fontWeight: '600', opacity: 0.5, marginBottom: 4 },
  stopTooltipAddress: { fontSize: 14, fontWeight: '600' },
});

export default TripMapScreen;
