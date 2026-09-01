import React, { useState } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { sanitizeImageUrl } from '../../utils/imageUtils';
import { useUI } from '../../theme/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
// Dos tarjetas por fila, del tamaño de las de Uber (~44% del ancho de pantalla) — la
// primera versión las dejaba mucho más chicas (~39%) y el usuario lo notó. 24 de margen a
// cada lado de la pantalla, 12 entre tarjetas. Verificado en 360/390/414/430 de ancho.
const GAP = 12;
const CARD_WIDTH = Math.round((SCREEN_WIDTH - 24 * 2 - GAP * 1.5) / 1.9);
// 2:1, el aspecto que ya usan los banners cargados — no hace falta resubirlos recortados
// distinto.
const IMAGE_HEIGHT = Math.round(CARD_WIDTH / 2);
const ITEM_WIDTH = CARD_WIDTH + GAP;

/**
 * El carrusel de banners que comparten Home, Carpoolings y el detalle de un viaje.
 *
 * Vivía triplicado, uno por pantalla, y las tres copias habían divergido: dos se movían
 * solas con un `setInterval` cada 5s, y la tercera (acá) era peor — un marquee en loop
 * infinito con `Animated.timing`, que ni siquiera se podía tocar y arrastrar. Al arreglar
 * "que no se muevan solos" se arreglaron las dos primeras y la tercera quedó afuera, porque
 * nadie sabía que existía: tres implementaciones del mismo componente es exactamente lo que
 * hace que un arreglo se aplique en dos lugares y se olvide en el tercero.
 *
 * Ahora es UN componente. Sin auto-scroll a propósito: se queda quieto, sólo se mueve
 * cuando la persona lo desliza.
 *
 * @param {Array}    banners
 * @param {Function} onBannerPress
 * @param {boolean}  showDots   puntitos de paginación debajo (Carpoolings ya los tenía).
 */
const BannerCarousel = ({ banners, onBannerPress, showDots = false }) => {
  const ui = useUI();
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = (event) => {
    if (!showDots) return;
    const index = Math.round(event.nativeEvent.contentOffset.x / ITEM_WIDTH);
    if (index !== activeIndex && index >= 0 && index < banners.length) {
      setActiveIndex(index);
    }
  };

  return (
    <View>
      <FlatList
        data={banners}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.92}
            onPress={() => onBannerPress?.(item)}
          >
            <View style={styles.imageWrap}>
              {item.imageUrl ? (
                <Image source={{ uri: sanitizeImageUrl(item.imageUrl) }} style={styles.image} resizeMode="cover" />
              ) : null}
            </View>
            {/* Título y texto SIEMPRE visibles, debajo de la imagen — no hace falta tocar la
                tarjeta para saber de qué trata, mismo criterio que Uber. El modal sigue
                estando: es donde va el resto (links, botón). */}
            <Text style={[styles.title, { color: ui.text }]} numberOfLines={1}>{item.title}</Text>
            {!!item.texto && (
              <Text style={[styles.text, { color: ui.textMuted }]} numberOfLines={2}>{item.texto}</Text>
            )}
          </TouchableOpacity>
        )}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        snapToInterval={ITEM_WIDTH}
        decelerationRate="fast"
        contentContainerStyle={styles.content}
        getItemLayout={(_, index) => ({ length: ITEM_WIDTH, offset: ITEM_WIDTH * index, index })}
      />

      {showDots && banners.length > 1 && (
        <View style={styles.dots}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { backgroundColor: i === activeIndex ? ui.text : ui.border },
                i === activeIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: 24 },
  card: { width: CARD_WIDTH, marginRight: GAP },
  imageWrap: {
    width: '100%',
    height: IMAGE_HEIGHT,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#111',
  },
  image: { width: '100%', height: '100%' },
  title: { fontSize: 14.5, fontFamily: 'Sora_600SemiBold', marginTop: 9 },
  text: { fontSize: 12, fontFamily: 'Sora_400Regular', lineHeight: 16, marginTop: 2 },

  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 14 },
  dot: { width: 6, height: 6, borderRadius: 999, marginHorizontal: 3 },
  dotActive: { width: 22 },
});

export default BannerCarousel;
