/**
 * Adaptador de `react-native-maps` para WEB (ver metro.config.js — en nativo se usa el paquete
 * real). Reimplementa la parte de la API que usan las pantallas (MapView + ref, Marker,
 * Polyline) encima de `@react-google-maps/api`, así el mapa es de verdad en web y NINGUNA
 * pantalla necesita un `.web.js` sólo por el mapa.
 *
 * La key sale de `app.config.js` (extra.googleMapsApiKey) — la misma que usa el proyecto web/.
 */
import React, {
  forwardRef, useImperativeHandle, useRef, useState, useCallback, useMemo, useEffect,
} from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import {
  GoogleMap, useJsApiLoader, MarkerF, PolylineF, OverlayViewF, OVERLAY_MOUSE_TARGET,
} from '@react-google-maps/api';

const API_KEY =
  Constants.expoConfig?.extra?.googleMapsApiKey ||
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  '';

// region <-> center/zoom. latitudeDelta ≈ span vertical en grados.
function regionToView(region) {
  if (!region || !Number.isFinite(region.latitude)) {
    return { center: { lat: -34.6037, lng: -58.3816 }, zoom: 11 };
  }
  const delta = region.latitudeDelta || 0.02;
  const zoom = Math.round(Math.log2(360 / delta)) - 1;
  return {
    center: { lat: region.latitude, lng: region.longitude },
    zoom: Math.max(2, Math.min(19, zoom)),
  };
}

function mapToRegion(map) {
  const c = map.getCenter();
  const b = map.getBounds();
  if (!c || !b) return null;
  const ne = b.getNorthEast();
  const sw = b.getSouthWest();
  return {
    latitude: c.lat(),
    longitude: c.lng(),
    latitudeDelta: Math.abs(ne.lat() - sw.lat()),
    longitudeDelta: Math.abs(ne.lng() - sw.lng()),
  };
}

// ~25 m: si la región entrante está más cerca que esto de donde ya está el mapa, se
// considera "la misma" y NO se re-centra. Es lo que corta el loop cuando la pantalla hace
// setRegion(r) dentro de onRegionChangeComplete (patrón habitual en react-native-maps).
const SAME = 2.5e-4;
const sameCenter = (a, b) =>
  a && b && Math.abs(a.lat - b.lat) < SAME && Math.abs(a.lng - b.lng) < SAME;

function assetUri(image) {
  if (!image) return null;
  if (typeof image === 'string') return image;
  if (image.uri) return image.uri;
  const resolved = Image.resolveAssetSource?.(image);
  return resolved?.uri || null;
}

function Placeholder({ style, msg }) {
  return (
    <View style={[styles.placeholder, style]}>
      <Text style={styles.placeholderText}>{msg}</Text>
    </View>
  );
}

const MapView = forwardRef(function MapView(props, ref) {
  const {
    style,
    initialRegion,
    region,
    onMapReady,
    onRegionChange,
    onRegionChangeComplete,
    onPress,
    scrollEnabled = true,
    zoomEnabled = true,
    rotateEnabled = true,
    children,
  } = props;

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'carpuling-gmaps',
    googleMapsApiKey: API_KEY,
  });

  const mapRef = useRef(null);
  const readyRef = useRef(false);
  // Marca que el próximo `idle` viene de un movimiento programático (efecto de `region`,
  // animateToRegion, fitToCoordinates) y NO de un gesto del usuario → no dispara el callback.
  const programmaticRef = useRef(false);
  // Marca que hubo gesto del usuario desde el último `idle`.
  const gestureRef = useRef(false);
  const camRef = useRef(regionToView(region || initialRegion));

  // Centro/zoom que se le pasan a <GoogleMap>. Sólo cambian cuando la prop `region` trae
  // algo realmente distinto — nunca en cada render — así el mapa no pelea con el usuario.
  const [cam, setCam] = useState(camRef.current);

  const moveTo = useCallback((r, animate) => {
    const m = mapRef.current;
    if (!m || !r) return;
    const v = regionToView(r);
    programmaticRef.current = true;
    camRef.current = v;
    if (animate) m.panTo(v.center);
    else m.setCenter(v.center);
    if (Number.isFinite(v.zoom)) m.setZoom(v.zoom);
  }, []);

  useImperativeHandle(ref, () => ({
    animateToRegion: (r) => moveTo(r, true),
    animateCamera: (camera) => {
      const c = camera?.center;
      const m = mapRef.current;
      if (!m || !c) return;
      programmaticRef.current = true;
      m.panTo({ lat: c.latitude, lng: c.longitude });
      if (Number.isFinite(camera.zoom)) m.setZoom(camera.zoom);
    },
    fitToCoordinates: (coords, opts = {}) => {
      const m = mapRef.current;
      if (!m || !coords?.length || !window.google) return;
      const b = new window.google.maps.LatLngBounds();
      coords.forEach((c) => b.extend({ lat: c.latitude, lng: c.longitude }));
      programmaticRef.current = true;
      m.fitBounds(b, opts.edgePadding || 48);
    },
    getMapBoundaries: async () => {
      const b = mapRef.current?.getBounds?.();
      if (!b) return null;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      return {
        northEast: { latitude: ne.lat(), longitude: ne.lng() },
        southWest: { latitude: sw.lat(), longitude: sw.lng() },
      };
    },
  }));

  // Mapa controlado: aplicar `region` sólo si trae algo distinto de lo que ya se ve.
  useEffect(() => {
    if (!region || !Number.isFinite(region.latitude) || !mapRef.current) return;
    const v = regionToView(region);
    if (sameCenter(v.center, camRef.current.center) && v.zoom === camRef.current.zoom) return;
    programmaticRef.current = true;
    camRef.current = v;
    setCam(v);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [region?.latitude, region?.longitude, region?.latitudeDelta]);

  const handleIdle = useCallback(() => {
    const m = mapRef.current;
    if (!m) return;
    if (!readyRef.current) {
      readyRef.current = true;
      onMapReady?.();
    }
    if (programmaticRef.current) { programmaticRef.current = false; gestureRef.current = false; return; }
    if (!gestureRef.current) return;
    gestureRef.current = false;
    const r = mapToRegion(m);
    if (r) { camRef.current = regionToView(r); onRegionChangeComplete?.(r, { isGesture: true }); }
  }, [onMapReady, onRegionChangeComplete]);

  if (!API_KEY) return <Placeholder style={style} msg="Falta la API key de Google Maps" />;
  if (loadError) return <Placeholder style={style} msg="No se pudo cargar el mapa" />;
  if (!isLoaded) return <Placeholder style={style} msg="Cargando mapa…" />;

  return (
    <View style={[styles.wrap, style]}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={cam.center}
        zoom={cam.zoom}
        onLoad={(m) => {
          mapRef.current = m;
          const v = regionToView(region || initialRegion);
          camRef.current = v;
          m.setCenter(v.center);
          if (Number.isFinite(v.zoom)) m.setZoom(v.zoom);
          setTimeout(() => {
            if (mapRef.current && window.google) {
              window.google.maps.event.trigger(mapRef.current, 'resize');
              mapRef.current.setCenter(camRef.current.center);
            }
          }, 250);
        }}
        onUnmount={() => { mapRef.current = null; readyRef.current = false; }}
        onDragStart={() => { gestureRef.current = true; }}
        onDrag={() => {
          const r = mapRef.current && mapToRegion(mapRef.current);
          if (r) onRegionChange?.(r, { isGesture: true });
        }}
        onZoomChanged={() => { if (!programmaticRef.current) gestureRef.current = true; }}
        onIdle={handleIdle}
        onClick={(e) => {
          if (!e.latLng) return;
          onPress?.({ nativeEvent: { coordinate: { latitude: e.latLng.lat(), longitude: e.latLng.lng() } } });
        }}
        options={{
          disableDefaultUI: true,
          zoomControl: zoomEnabled,
          gestureHandling: scrollEnabled ? 'greedy' : 'none',
          rotateControl: rotateEnabled,
          clickableIcons: false,
          keyboardShortcuts: false,
        }}
      >
        {children}
      </GoogleMap>
    </View>
  );
});
MapView.displayName = 'MapView';

export function Marker({ coordinate, image, children, anchor, onPress }) {
  if (!coordinate || !Number.isFinite(coordinate.latitude)) return null;
  const position = { lat: coordinate.latitude, lng: coordinate.longitude };

  // Marcador con vista propia (puntos de origen/destino en iOS, pin del pasajero, etc.)
  if (children) {
    return (
      <OverlayViewF
        position={position}
        mapPaneName={OVERLAY_MOUSE_TARGET}
        getPixelPositionOffset={(w, h) => ({
          x: -Math.round(w * (anchor?.x ?? 0.5)),
          y: -Math.round(h * (anchor?.y ?? 0.5)),
        })}
      >
        <div style={{ cursor: onPress ? 'pointer' : 'default' }} onClick={onPress}>
          {children}
        </div>
      </OverlayViewF>
    );
  }

  const url = assetUri(image);
  const icon = url ? { url } : undefined;
  return <MarkerF position={position} icon={icon} onClick={() => onPress?.()} />;
}

export function Polyline({ coordinates, strokeColor, strokeWidth, width, color }) {
  const path = useMemo(
    () => (coordinates || []).map((c) => ({ lat: c.latitude, lng: c.longitude })),
    [coordinates],
  );
  if (!path.length) return null;
  return (
    <PolylineF
      path={path}
      options={{
        strokeColor: strokeColor || color || '#000000',
        strokeWeight: strokeWidth || width || 4,
        strokeOpacity: 1,
        clickable: false,
      }}
    />
  );
}

export const Circle = () => null;
export const Callout = () => null;
export const PROVIDER_GOOGLE = 'google';
export const PROVIDER_DEFAULT = undefined;

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  placeholder: {
    backgroundColor: '#f3f4f6',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  placeholderText: { color: '#9ca3af', fontSize: 12 },
});

export default MapView;
