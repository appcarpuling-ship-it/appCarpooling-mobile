import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Image,
  StyleSheet,
  Animated,
  Dimensions,
  ScrollView,
  Pressable,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { sanitizeImageUrl } from '../../utils/imageUtils';
import { handleBannerPress } from '../../utils/bannerNavigation';

const { height: SCREEN_H } = Dimensions.get('window');

/** Mismo alto que el carrusel de Home (`BANNER_HEIGHT = 160`) */
const BANNER_IMAGE_HEIGHT = 160;

/** Modal a 90% de altura; imagen + texto scrollean dentro */
const SHEET_HEIGHT = Math.round(SCREEN_H * 0.9);

/** Mismo aire que la barrita: paddingTop sheet 8 + handle 4 + marginBottom 8 */
const TOP_INSET_WITHOUT_HANDLE = 20;

/**
 * Modal tipo bottom sheet con imagen, texto y botón fijo "Cerrar" (solo cierra, no navega).
 */
const BannerDetailModal = ({ visible, banner, onClose, navigation, colors }) => {
  const insets = useSafeAreaInsets();
  const { isDarkMode } = useTheme();
  const slide = useRef(new Animated.Value(SCREEN_H)).current;

  const bg = colors?.cardBackground || '#FFFFFF';
  const textPrimary = colors?.textPrimary || '#111';
  const textSecondary = colors?.textSecondary || '#666';
  const border = colors?.border || '#E5E7EB';

  /** Botón claro: en oscuro fondo blanco + letra negra; en claro fondo oscuro + letra blanca */
  const closeBtnBg = isDarkMode ? '#FFFFFF' : '#111111';
  const closeBtnFg = isDarkMode ? '#000000' : '#FFFFFF';

  useEffect(() => {
    if (visible && banner) {
      slide.setValue(SCREEN_H);
      Animated.spring(slide, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  }, [visible, banner, slide]);

  const handleClose = () => {
    Animated.timing(slide, {
      toValue: SCREEN_H,
      duration: 220,
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  };

  if (!visible || !banner) return null;

  const title       = typeof banner.title === 'string' ? banner.title.trim() : '';
  const description = typeof banner.texto === 'string' ? banner.texto.trim()
                    : typeof banner.description === 'string' ? banner.description.trim() : '';
  const hasLink     = banner.hipervinculo && (banner.appGoTo || banner.webGoTo || banner.clickUrl);
  const linkLabel   = banner.textHipervinculo || 'Ver más';

  const handleLink = () => {
    handleBannerPress(banner, navigation);
    handleClose();
  };

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose}>
          <View style={styles.backdrop} />
        </Pressable>
        <Animated.View
          style={[
            styles.sheet,
            {
              height: SHEET_HEIGHT,
              maxHeight: SHEET_HEIGHT,
              backgroundColor: bg,
              transform: [{ translateY: slide }],
            },
          ]}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            bounces
            nestedScrollEnabled
          >
            {banner.imageUrl ? (
              <View style={styles.heroWrap}>
                <Image
                  source={{ uri: sanitizeImageUrl(banner.imageUrl) }}
                  style={styles.heroImage}
                  resizeMode="cover"
                />
              </View>
            ) : null}

            {(title || description) ? (
              <View style={styles.textBlock}>
                {title ? (
                  <Text style={[styles.title, { color: textPrimary }]}>{title}</Text>
                ) : null}
                {description ? (
                  <Text style={[styles.description, { color: textSecondary }]}>{description}</Text>
                ) : null}
              </View>
            ) : null}
          </ScrollView>

          <View
            style={[
              styles.footer,
              {
                borderTopColor: border,
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: bg,
              },
            ]}
          >
            {hasLink && (
              <TouchableOpacity
                style={[styles.linkBtn, { borderColor: closeBtnBg }]}
                onPress={handleLink}
                activeOpacity={0.85}
              >
                <Text style={[styles.linkBtnText, { color: closeBtnBg }]}>{linkLabel}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.closeActionBtn, { backgroundColor: closeBtnBg }]}
              onPress={handleClose}
              activeOpacity={0.85}
            >
              <Text style={[styles.closeActionBtnText, { color: closeBtnFg }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    flexDirection: 'column',
    justifyContent: 'space-between',
  },
  scroll: {
    flex: 1,
    width: '100%',
    minHeight: 0,
  },
  scrollContent: {
    flexGrow: 1,
    paddingTop: TOP_INSET_WITHOUT_HANDLE,
    paddingBottom: 12,
  },
  heroWrap: {
    width: '100%',
    height: BANNER_IMAGE_HEIGHT,
    backgroundColor: '#1a1a1a',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  textBlock: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
    lineHeight: 26,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 10,
  },
  linkBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  linkBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
  closeActionBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeActionBtnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});

export default BannerDetailModal;
