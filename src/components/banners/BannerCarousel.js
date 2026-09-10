import React, { useState, useMemo } from 'react';
import { View, Text, Image, FlatList, TouchableOpacity, StyleSheet, useWindowDimensions } from 'react-native';
import { sanitizeImageUrl } from '../../utils/imageUtils';
import { useUI } from '../../theme/ui';

// ~57% del ancho de pantalla: entra una tarjeta entera y un pedazo de la siguiente
// asomando. Pasó por 44% y el usuario las siguió viendo chicas — esta vez el salto es
// grande a propósito, no otro ajuste tímido. 24 de margen a cada lado, 12 entre tarjetas.
// Verificado en 360/390/414/430 de ancho.
const GAP = 12;
// El ancho se saca de useWindowDimensions (no del Dimensions.get de nivel de módulo, que
// en web queda clavado en el tamaño que tenía la ventana al cargar y hacía banners
// gigantes al achicarla). Tope de 430: esta UI es un teléfono en vertical, en una ventana
// de escritorio ancha las tarjetas no tienen que crecer sin límite.
function useCardMetrics() {
  const { width } = useWindowDimensions();
  return useMemo(() => {
    const w = Math.min(width || 390, 430);
    const cardWidth = Math.round((w - 24 * 2 - GAP * 1.5) / 1.45);
    return {
      CARD_WIDTH: cardWidth,
      // 2:1, el aspecto que ya usan los banners cargados.
      IMAGE_HEIGHT: Math.round(cardWidth / 2),
      ITEM_WIDTH: cardWidth + GAP,
    };
  }, [width]);
}

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
  const { CARD_WIDTH, IMAGE_HEIGHT, ITEM_WIDTH } = useCardMetrics();

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
            style={[styles.card, { width: CARD_WIDTH }]}
            activeOpacity={0.92}
            onPress={() => onBannerPress?.(item)}
          >
            <View style={[styles.imageWrap, { height: IMAGE_HEIGHT }]}>
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
        extraData={ITEM_WIDTH}
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
  card: { marginRight: GAP },
  imageWrap: {
    width: '100%',
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
