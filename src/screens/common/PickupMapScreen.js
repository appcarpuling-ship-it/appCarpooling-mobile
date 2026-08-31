import React, { useState, useEffect } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View, Text, Image, TouchableOpacity, StyleSheet, StatusBar, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { MAP_PROVIDER } from '../../utils/mapProvider';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../theme/ui';

// Pin del punto del pasajero (recogida o bajada). En Android va como PNG nativo: la vista
// custom de un Marker no se llega a dibujar acá (queda en blanco). En iOS va como <Image>
// dentro del Marker para poder darle un tamaño en puntos (el PNG nativo saldría enorme).
const PIN_PASAJERO = require('../../../assets/map/pin-pasajero.png');

// Mapa de un punto de un pasajero —recogida o bajada—, con un solo marcador. Se abre desde
// Reservas Recibidas con { coordinates:{latitude,longitude}, address, label? }.
const PickupMapScreen = ({ route, navigation }) => {
  const ui = useUI();
  const insets = useSafeAreaInsets();
  const { coordinates, address, label } = route.params || {};

  // El mapa se suelta al perder el foco: es una vista nativa cara y en un stack sigue montada
  // aunque no se vea. Apilar varias fue lo que hizo que iOS matara la app por RAM.
  const estaEnfoco = useIsFocused();

  // El punto solo no le dice al conductor si le queda cerca o cruzando la ciudad. Con su
  // propia posición en el mapa lo ve de una, igual que en "Ver trayecto en el mapa".
  const [showMyLocation, setShowMyLocation] = useState(false);
  useEffect(() => {
    let cancelled = false;
    Location.requestForegroundPermissionsAsync()
      .then(({ status }) => { if (!cancelled && status === 'granted') setShowMyLocation(true); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const region = coordinates?.latitude
    ? { latitude: coordinates.latitude, longitude: coordinates.longitude, latitudeDelta: 0.01, longitudeDelta: 0.01 }
    : { latitude: -34.6037, longitude: -58.3816, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  /**
   * En Android un marcador con vista propia y `tracksViewChanges` en false DESDE EL PRIMER
   * render se dibuja en blanco: nunca llega a pintarse una primera vez. Estaban los dos
   * hardcodeados en false, así que en Android no se veía ni el pin ni la dirección (en iOS
   * sí, porque ahí el marcador se pinta igual).
   *
   * El patrón que funciona en TripMapScreen y en los tres previews tiene TRES partes, y hay que
   * copiarlo entero:
   *   1. el tracking arranca en true y se apaga solo;
   *   2. el temporizador cuenta desde `onMapReady`, NO desde que se monta la pantalla;
   *   3. los marcadores llevan `mapaListo` en su `key`, para remontarse cuando el mapa avisa.
   * Acá estaba sólo la primera: los 900ms corrían mientras el mapa todavía se inicializaba, el
   * tracking se apagaba antes de que el marcador llegara a dibujarse una vez, y quedaba una
   * miniatura sin la placa ni la etiqueta.
   */
  const [mapaListo, setMapaListo] = useState(false);
  const [marcadoresVivos, setMarcadoresVivos] = useState(true);
  useEffect(() => {
    if (!mapaListo || !coordinates?.latitude) return undefined;
    setMarcadoresVivos(true);
    const t = setTimeout(() => setMarcadoresVivos(false), 900);
    return () => clearTimeout(t);
  }, [mapaListo, coordinates?.latitude, coordinates?.longitude]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle={ui.isDarkMode ? 'light-content' : 'dark-content'} />

      {/* Solo con la pantalla enfocada: ver PointPickerScreen. */}
      {estaEnfoco && <MapView
        provider={MAP_PROVIDER}
        style={StyleSheet.absoluteFillObject}
        initialRegion={region}
        paddingAdjustmentBehavior="never"
        showsUserLocation={showMyLocation}
        /* Sin edificios 3D, POIs ni interiores: texturas que ocupan RAM y no aportan acá. */
        showsBuildings={false}
        showsIndoors={false}
        showsPointsOfInterest={false}
        showsMyLocationButton={false}
        onMapReady={() => setMapaListo(true)}
      >
        {/* El ícono de pasajero va ACÁ, en el marcador: esta pantalla es siempre el punto de
            recogida o bajada de un pasajero, así que no hace falta condición para mostrarlo. */}
        {coordinates?.latitude && (
          Platform.OS === 'android' ? (
            // PNG nativo: se ancla en la PUNTA del pin (y:1), que es lo que cae en la coordenada.
            // La dirección va sólo en la tarjeta de abajo (la etiqueta flotante no se dibuja acá).
            <Marker
              coordinate={{ latitude: coordinates.latitude, longitude: coordinates.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              image={PIN_PASAJERO}
            />
          ) : (
            // Sólo el pin. La dirección va en la tarjeta de abajo — antes había una etiqueta
            // flotante sobre el pin y se pidió sacarla.
            <Marker
              key={`pin-${mapaListo}`}
              coordinate={{ latitude: coordinates.latitude, longitude: coordinates.longitude }}
              anchor={{ x: 0.5, y: 1 }}
              tracksViewChanges={marcadoresVivos}
            >
              <Image source={PIN_PASAJERO} style={styles.pinPasajero} resizeMode="contain" />
            </Marker>
          )
        )}
      </MapView>}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: ui.card }]} onPress={() => navigation.goBack()} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={22} color={ui.text} />
        </TouchableOpacity>
      </View>

      <View style={[styles.addressCard, { backgroundColor: ui.card, paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.addressLabel, { color: ui.textMuted }]}>{(label || 'Punto de recogida').toUpperCase()}</Text>
        <Text style={[styles.addressText, { color: ui.text }]}>{address || 'Sin dirección'}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Ratio del PNG (33x48). Alto 46pt: tamaño de pin de mapa normal — a 64 tapaba media
  // ciudad al alejar el zoom.
  pinPasajero: { width: 32, height: 46 },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  backBtn: {
    width: 40, height: 40, borderRadius: 999, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 4,
  },
  addressCard: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 24, paddingTop: 18, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 8,
  },
  addressLabel: { fontSize: 11, fontFamily: 'Sora_600SemiBold', letterSpacing: 0.5, marginBottom: 6 },
  addressText: { fontSize: 16, fontFamily: 'Sora_600SemiBold', lineHeight: 22 },
});

export default PickupMapScreen;
