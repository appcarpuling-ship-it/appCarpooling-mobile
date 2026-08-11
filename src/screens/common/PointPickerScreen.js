import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator,
  Animated, TextInput, Platform, Keyboard, KeyboardAvoidingView, BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useUI } from '../../theme/ui';
import { useFrequentAddresses } from '../../hooks/useFrequentAddresses';
import { searchPlaces, getPlaceDetails, reverseGeocode } from '../../services/mapsService';

/**
 * Elegir un punto en el mapa: el de recogida o el de bajada de una reserva.
 *
 * Es una PANTALLA y no un overlay dentro de la reserva, y eso ES el arreglo, no una cuestión
 * de orden. Como overlay flotante el mapa quedaba celeste, sin cargar tiles: se probaron
 * cinco variantes —validar la región, atrasar el montaje, sacar el marcador, remontarlo al
 * cerrar el buscador, no montarlo mientras estaba tapado— y ninguna sirvió. Los dos mapas de
 * la app que SÍ funcionan (TripMapScreen y PickupMapScreen) son pantallas del navegador, así
 * que se dejó de adivinar qué propiedad del overlay lo rompía y se usó la forma que anda.
 *
 * El caller navega con:
 *   navigation.navigate('PointPicker', { mode, initial, fallback, onSelect })
 *     mode     'pickup' | 'dropoff'  — sólo cambia los textos
 *     initial  el punto ya elegido, o null
 *     fallback coordenadas donde abrir si no hay punto elegido (el destino del viaje)
 *     onSelect ({ address, coordinates }) => void
 */

const limpiarDireccion = (address) => {
  if (!address) return null;
  const limpio = address
    .replace(/\b[A-Z]?\d{4,5}[A-Z]{0,3}\b/g, '')
    .replace(/,?\s*argentina\s*,?/gi, '')
    .replace(/\s*,\s*,+/g, ',')
    .replace(/(^[,\s]+|[,\s]+$)/g, '')
    .trim();
  return limpio || null;
};

/**
 * Región utilizable, o null. El 0 es el caso que importa: `coords.latitude != null` lo da por
 * bueno, y un viaje sin geocodificar queda en 0,0 —mar abierto frente a África—, con lo que
 * el mapa abría en el océano.
 */
const regionDesde = (coords, delta) => {
  const lat = Number(coords?.latitude);
  const lng = Number(coords?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta };
};

const PointPickerScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const frequentAddresses = useFrequentAddresses();
  const { mode = 'pickup', initial = null, fallback = null, onSelect } = route.params || {};
  const esBajada = mode === 'dropoff';

  const cardBg = ui.surface;
  const textPrimary = ui.text;
  const textMuted = ui.textMuted;
  const divider = ui.bg;

  const regionInicial = regionDesde(initial?.coordinates, 0.01)
    || (esBajada ? regionDesde(fallback, 0.05) : null);

  const [region, setRegion] = useState(regionInicial);
  const [pinCoords, setPinCoords] = useState(
    regionDesde(initial?.coordinates, 0.01)
      ? { latitude: initial.coordinates.latitude, longitude: initial.coordinates.longitude }
      : null,
  );
  const [pinAddress, setPinAddress] = useState(initial?.address || '');
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchVisible, setSearchVisible] = useState(false);
  // Arranca en modo selección: esta pantalla existe para elegir un punto, así que el pin del
  // centro está desde el principio y se arrastra el mapa y listo. Antes había que abrir el
  // buscador y tocar "Marcar en el mapa" para poder mover el mapa, que además es el camino
  // por el que el mapa quedaba celeste.
  const [selectionMode] = useState(true);
  const [resolving, setResolving] = useState(false);

  const mapRef = useRef(null);
  const searchDebounce = useRef(null);
  const idleTimer = useRef(null);
  const geocodeId = useRef(0);
  const selectionModeRef = useRef(true);
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const overlayY = useRef(new Animated.Value(16)).current;

  // El pin se despega del suelo mientras el mapa se mueve y vuelve a apoyarse al frenar.
  // No es adorno: mientras está levantado, lo que dice la dirección de abajo ya no
  // corresponde al punto, y el gesto lo comunica sin texto.
  const alzado = useRef(new Animated.Value(0)).current;
  const estaAlzado = useRef(false);
  const levantarPin = (arriba) => {
    if (estaAlzado.current === arriba) return; // onRegionChange dispara decenas de veces
    estaAlzado.current = arriba;
    Animated.spring(alzado, {
      toValue: arriba ? 1 : 0,
      useNativeDriver: true,
      friction: 6,
      tension: 120,
    }).start();
  };

  const geocodeInverso = async (coords) => {
    try {
      const data = await reverseGeocode(coords.latitude, coords.longitude);
      if (data.results && data.results[0]) {
        return limpiarDireccion(data.results[0].formatted_address) || data.results[0].formatted_address;
      }
    } catch {}
    return `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
  };

  // Sin punto previo ni destino al que ir, abre donde está parado el usuario.
  useEffect(() => {
    if (regionInicial) return;
    let cancelado = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('denied');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelado) return;
        const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        setPinCoords(coords);
        setRegion({ ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 });
        const addr = await geocodeInverso(coords);
        if (!cancelado) setPinAddress(addr || '');
      } catch {
        if (cancelado) return;
        setRegion(regionDesde(fallback, 0.05)
          || { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.02, longitudeDelta: 0.02 });
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const cerrarBuscador = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(overlayY, { toValue: 12, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setSearchVisible(false);
      setSearchText('');
      setSearchResults([]);
    });
  };

  // El botón físico de Android cierra el buscador antes que la pantalla.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (searchVisible) { cerrarBuscador(); return true; }
      return false;
    });
    return () => sub.remove();
  }, [searchVisible]);

  const buscarLugares = useCallback((text) => {
    if (searchDebounce.current) clearTimeout(searchDebounce.current);
    if (!text || text.length < 3) { setSearchResults([]); return; }
    searchDebounce.current = setTimeout(async () => {
      try {
        const data = await searchPlaces(text);
        if (data.predictions) setSearchResults(data.predictions.slice(0, 5));
      } catch {}
    }, 400);
  }, []);


  const abrirBuscador = () => {
    setSearchVisible(true);
    overlayOpacity.setValue(0);
    overlayY.setValue(16);
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(overlayY, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  };

  const elegirDeLaBusqueda = async (prediction) => {
    cerrarBuscador();
    try {
      const data = await getPlaceDetails(prediction.place_id, 'geometry,formatted_address');
      if (data.result?.geometry?.location) {
        const coords = {
          latitude: data.result.geometry.location.lat,
          longitude: data.result.geometry.location.lng,
        };
        geocodeId.current++;
        if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
        setPinCoords(coords);
        setPinAddress(prediction.description);
        const r = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
        setRegion(r);
        mapRef.current?.animateToRegion(r, 500);
      }
    } catch {}
  };

  // Dirección frecuente: ya tiene coordenadas guardadas, sin volver a pedir Place Details.
  const elegirFrecuente = (addr) => {
    cerrarBuscador();
    if (!addr.coordinates?.latitude) return;
    const coords = { latitude: addr.coordinates.latitude, longitude: addr.coordinates.longitude };
    geocodeId.current++;
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    setPinCoords(coords);
    setPinAddress(addr.address);
    const r = { ...coords, latitudeDelta: 0.01, longitudeDelta: 0.01 };
    setRegion(r);
    mapRef.current?.animateToRegion(r, 500);
  };

  const confirmar = async () => {
    if (!pinCoords) return;
    let address = pinAddress;
    if (!address) {
      setResolving(true);
      address = await geocodeInverso(pinCoords);
      setResolving(false);
    }
    if (idleTimer.current) { clearTimeout(idleTimer.current); idleTimer.current = null; }
    onSelect?.({ address, coordinates: pinCoords });
    navigation.goBack();
  };

  return (
    <View style={styles.fullscreen}>
        {/* Map — sólo monta con región válida y con el overlay ya en pantalla */}
        {region && !searchVisible ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={StyleSheet.absoluteFill}
            initialRegion={region}
            onRegionChange={(_r, details = {}) => {
              if (details.isGesture === false) return;
              levantarPin(true);
            }}
            onRegionChangeComplete={(r, details = {}) => {
              levantarPin(false);
              if (!selectionModeRef.current) return;
              if (details.isGesture === false) return;
              const coords = { latitude: r.latitude, longitude: r.longitude };
              setPinCoords(coords);
              if (idleTimer.current) clearTimeout(idleTimer.current);
              setPinAddress('');
              const reqId = ++geocodeId.current;
              idleTimer.current = setTimeout(async () => {
                const addr = await geocodeInverso(coords);
                if (geocodeId.current === reqId) setPinAddress(addr || '');
              }, 800);
            }}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
          </MapView>
        ) : (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', backgroundColor: cardBg }]}>
            <ActivityIndicator size="large" color={textPrimary} />
          </View>
        )}


        {/* Pin del centro: lo que se confirma es siempre el punto del medio del mapa. */}
        {!searchVisible && (
          <View style={styles.centerPin} pointerEvents="none">
            <Animated.View
              style={{
                alignItems: 'center',
                transform: [{ translateY: alzado.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }],
              }}
            >
              <View style={styles.pinCabeza}>
                <View style={styles.pinNucleo} />
              </View>
              <View style={styles.pinTallo} />
            </Animated.View>
            {/* La sombra se queda en el punto y se achica: es lo que da la sensación de que
                el pin se despegó y sigue marcando el mismo lugar. */}
            <Animated.View
              style={[
                styles.pinBase,
                {
                  opacity: alzado.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.16] }),
                  transform: [{ scale: alzado.interpolate({ inputRange: [0, 1], outputRange: [1, 0.65] }) }],
                },
              ]}
            />
          </View>
        )}


        {/* Floating back button */}
        {!searchVisible && (
          <View style={[styles.topBar, { paddingTop: insets.top }]}>
            <TouchableOpacity
              style={[styles.circleBtn, { backgroundColor: cardBg }]}
              onPress={() => { if (idleTimer.current) clearTimeout(idleTimer.current); navigation.goBack(); }}
              activeOpacity={0.8}
            >
              <Ionicons name="arrow-back" size={22} color={textPrimary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Bottom mini sheet */}
        {!searchVisible && (
          <View style={[styles.miniSheet, { backgroundColor: cardBg, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.handleContainer}>
              <View style={[styles.handle, { backgroundColor: ui.border }]} />
            </View>

            <TouchableOpacity
              style={[styles.addressRow, { borderBottomColor: ui.bg }]}
              onPress={abrirBuscador}
              activeOpacity={0.7}
            >
              <Ionicons name="location-outline" size={18} color={textMuted} />
              <Text style={[styles.addressText, { color: pinAddress ? textPrimary : textMuted }]} numberOfLines={2}>
                {pinAddress || 'Mové el mapa o buscá una dirección'}
              </Text>
              <Ionicons name="search" size={16} color={textMuted} />
            </TouchableOpacity>

            <View style={styles.sheetActions}>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: ui.invertBg }, (resolving || !pinCoords) && { opacity: 0.6 }]}
                onPress={confirmar}
                disabled={resolving || !pinCoords}
                activeOpacity={0.85}
              >
                {resolving
                  ? <ActivityIndicator color={ui.invertText} />
                  : <Text style={[styles.confirmBtnText, { color: ui.invertText }]}>
                      {esBajada ? 'Confirmar punto de bajada' : 'Confirmar punto de recogida'}
                    </Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Search overlay (Uber style) */}
        {searchVisible && (
          <Animated.View style={[styles.searchOverlay, { backgroundColor: cardBg, opacity: overlayOpacity, transform: [{ translateY: overlayY }] }]}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
              <View style={[styles.searchHeader, { paddingTop: insets.top + 8, borderBottomColor: ui.bg }]}>
                <TouchableOpacity onPress={cerrarBuscador} style={styles.searchBackBtn} activeOpacity={0.7}>
                  <Ionicons name="arrow-back" size={22} color={textPrimary} />
                </TouchableOpacity>
                <TextInput
                  style={[styles.searchTextInput, { color: textPrimary }]}
                  placeholder="Buscar dirección..."
                  placeholderTextColor={textMuted}
                  value={searchText}
                  onChangeText={(t) => { setSearchText(t); buscarLugares(t); }}
                  autoFocus
                  autoCorrect={false}
                />
                {searchText.length > 0 && (
                  <TouchableOpacity onPress={() => { setSearchText(''); setSearchResults([]); }} style={{ padding: 8 }}>
                    <Ionicons name="close" size={18} color={textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              <ScrollView
                style={[styles.results, { borderTopColor: ui.bg }]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                showsVerticalScrollIndicator={false}
              >

                {searchText.length === 0 && searchResults.length === 0 && frequentAddresses.length > 0 && (
                  <>
                    <Text style={[styles.resultSub, { color: textMuted, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 4, textTransform: 'uppercase', fontWeight: '600', fontSize: 11 }]}>
                      Direcciones frecuentes
                    </Text>
                    {frequentAddresses.map((addr, i) => (
                      <TouchableOpacity
                        key={`freq-${i}`}
                        style={[styles.resultRow, { borderBottomColor: ui.bg }]}
                        onPress={() => elegirFrecuente(addr)}
                        activeOpacity={0.6}
                      >
                        <View style={[styles.resultIcon, { backgroundColor: ui.bg }]}>
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

                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.place_id}
                    style={[styles.resultRow, { borderBottomColor: ui.bg }]}
                    onPress={() => elegirDeLaBusqueda(item)}
                    activeOpacity={0.6}
                  >
                    <View style={[styles.resultIcon, { backgroundColor: ui.bg }]}>
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
    </View>
  );
};

const styles = StyleSheet.create({
  // Reemplaza al <Modal>: mismo efecto de pantalla completa sin crear una ventana aparte.
  // Sin zIndex: el overlay ya es el ÚLTIMO hermano del árbol, así que se dibuja arriba sin
  // pedirlo. Y el zIndex en iOS reordena capas de composición, que es de las pocas cosas que
  // pueden dejar la superficie GL del mapa sin componer — el resto ya se descartó midiendo.
  fullscreen: { ...StyleSheet.absoluteFillObject },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  circleBtn: {
    marginLeft: 16, marginTop: 8,
    width: 42, height: 42, borderRadius: 21,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  /**
   * El pin del centro. Antes era un ícono de Ionicons suelto, centrado en la mitad de su
   * caja: o sea que el punto que confirmabas no era la punta del pin sino su MEDIO, unos
   * 15px más arriba de lo que veías. Ahora se dibuja con vistas y el ancla queda en la punta
   * exacta: la caja mide 46px de alto y se sube 46, así que su borde inferior cae justo en el
   * centro del mapa.
   */
  centerPin: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -17,
    marginTop: -46,
    width: 34,
    height: 46,
    alignItems: 'center',
  },
  pinCabeza: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: '#010101',
    borderWidth: 3, borderColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3, shadowRadius: 3, elevation: 5,
  },
  pinNucleo: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#FFFFFF' },
  pinTallo: { width: 3, height: 11, backgroundColor: '#010101', marginTop: -1 },
  // La sombrita en el suelo: sin ella el pin parece flotar y no se sabe qué punto marca.
  pinBase: {
    width: 10, height: 4, borderRadius: 5,
    backgroundColor: '#000000',
    marginTop: 1,
  },
  miniSheet: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 10,
  },
  handleContainer: { alignItems: 'center', paddingTop: 12, paddingBottom: 8 },
  handle: { width: 36, height: 4, borderRadius: 2 },
  addressRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 56,
  },
  addressText: { flex: 1, fontSize: 15, fontFamily: 'Sora_500Medium' },
  sheetActions: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 4 },
  confirmBtn: { borderRadius: 12, paddingVertical: 15, alignItems: 'center', justifyContent: 'center' },
  confirmBtnText: { fontSize: 16, fontFamily: 'Sora_700Bold' },
  // Sin zIndex, igual que en CreateTripGoogleMaps: React Native reordena las subvistas
  // NATIVAS cuando hay hermanos con zIndex, y mover el GMSMapView de índice le rompe la
  // superficie GL — el mapa queda vivo pero sin dibujar. Estos dos se declaran después del
  // mapa en el árbol, así que quedan arriba igual sin pedirlo.
  searchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
  },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  searchBackBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  searchTextInput: { flex: 1, height: 44, fontSize: 15, fontFamily: 'Sora_500Medium' },
  results: { flex: 1, borderTopWidth: StyleSheet.hairlineWidth },
  resultRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 14, paddingHorizontal: 16,
    gap: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  resultMain: { fontSize: 14, fontFamily: 'Sora_500Medium' },
  resultSub: { fontSize: 12, marginTop: 2 },
});

export default PointPickerScreen;
