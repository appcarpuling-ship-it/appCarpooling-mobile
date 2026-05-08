import React, { useState } from 'react';
import { View, Image, ActivityIndicator, StyleSheet } from 'react-native';

/**
 * Imagen remota con indicador mientras descarga (onLoadStart / onLoadEnd).
 */
export default function RemoteImageWithLoader({
  uri,
  style,
  isDarkMode,
  spinnerColor,
  resizeMode = 'cover',
  spinnerSize = 'small',
}) {
  const [loading, setLoading] = useState(!!uri);
  if (!uri) return null;
  const overlayBg = isDarkMode ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.65)';

  return (
    <View style={[style, styles.clip]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFillObject}
        resizeMode={resizeMode}
        onLoadStart={() => setLoading(true)}
        onLoad={() => setLoading(false)}
        onLoadEnd={() => setLoading(false)}
        onError={() => setLoading(false)}
      />
      {loading ? (
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
