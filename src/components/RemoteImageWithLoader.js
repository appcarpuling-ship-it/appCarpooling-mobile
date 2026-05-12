import React, { useState, useEffect, useRef } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Imagen remota con overlay de carga solo hasta primera carga (o timeout).
 * Sin `onLoadStart` ni `setState(true)` en bucle con el ciclo del Image: evita spinner eterno y
 * en escenas con varias fotos (formulario vehículo) errores tipo “Maximum update depth exceeded”.
 */
export default function RemoteImageWithLoader({
  uri,
  style,
  isDarkMode,
  spinnerColor,
  resizeMode = 'cover',
  spinnerSize = 'small',
}) {
  const [doneUri, setDoneUri] = useState(null);
  const fallbackRef = useRef(null);

  const clearFallback = () => {
    if (fallbackRef.current) {
      clearTimeout(fallbackRef.current);
      fallbackRef.current = null;
    }
  };

  /** Al cambiar la URI se vuelve a mostrar overlay hasta onLoadEnd o fallback. */
  useEffect(() => {
    clearFallback();
    if (!uri) {
      setDoneUri(null);
      return undefined;
    }
    setDoneUri(null);
    fallbackRef.current = setTimeout(() => {
      fallbackRef.current = null;
      setDoneUri(uri);
    }, 12000);
    return () => {
      clearFallback();
    };
  }, [uri]);

  if (!uri) return null;

  const overlayBg = isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.65)';
  const showOverlay = uri && doneUri !== uri;

  return (
    <View style={[style, styles.clip]}>
      <Image
        key={uri}
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={resizeMode}
        onLoadEnd={() => {
          clearFallback();
          setDoneUri(uri);
        }}
        onError={() => {
          clearFallback();
          setDoneUri(uri);
        }}
      />
      {showOverlay ? (
        <View style={[StyleSheet.absoluteFillObject, styles.overlay, { backgroundColor: overlayBg }]}>
          <ActivityIndicator size={spinnerSize} color={spinnerColor} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
  overlay: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
