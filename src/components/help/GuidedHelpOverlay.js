import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets, initialWindowMetrics } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import useColors from '../../hooks/useColors';
import { navigationRef } from '../../navigation/rootNavigation';
import { getHelpGuide } from '../../content/helpGuideContent';

const { width: SCREEN_W } = Dimensions.get('window');

function runStepNav(nav) {
  if (!nav) return undefined;
  return requestAnimationFrame(() => {
    try {
      if (!navigationRef.isReady()) return;
      if (nav.root) {
        navigationRef.navigate(nav.root);
        return;
      }
      if (nav.main) {
        const { tab, screen, params } = nav.main;
        navigationRef.navigate('Main', {
          screen: tab,
          // initial:false para que la raiz del tab quede abajo y volver atras
          // funcione; sin eso la pantalla de la guia queda clavada como raiz.
          params: screen
            ? { screen, params: params !== undefined ? params : {}, initial: false }
            : {},
        });
      }
    } catch {
      /* noop */
    }
  });
}

const GuidedHelpOverlay = ({ visible, guideId, onClose }) => {
  const insets = useSafeAreaInsets();
  const insetTop = insets.top || initialWindowMetrics?.insets.top || 0;
  const insetBottom = insets.bottom || initialWindowMetrics?.insets.bottom || 0;
  const { fontFamily } = useColors();
  const guide = guideId ? getHelpGuide(guideId) : null;
  const steps = guide?.steps ?? [];

  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!visible) {
      setStep(0);
      return;
    }
    if (guideId) setStep(0);
  }, [visible, guideId]);

  useEffect(() => {
    if (!visible || !steps.length) return;
    const nav = steps[step]?.nav;
    const raf = runStepNav(nav);
    return () => {
      if (typeof raf === 'number') cancelAnimationFrame(raf);
    };
  }, [visible, step, steps]);

  const total = steps.length;
  const isLast = total > 0 && step === total - 1;
  const current = steps[step];

  const goNext = useCallback(() => {
    if (isLast) {
      onClose();
      return;
    }
    setStep((s) => Math.min(s + 1, total - 1));
  }, [isLast, onClose, total]);

  const goBack = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  const padH = Math.max(20, SCREEN_W * 0.06);

  if (!visible || !guide || !current) {
    return null;
  }

  const muted = 'rgba(255,255,255,0.62)';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={[styles.backdrop, { backgroundColor: '#000000' }]}>
        <View
          style={[
            styles.safe,
            {
              paddingTop: insetTop + 12,
              paddingBottom: Math.max(insetBottom, 12) + 10,
              paddingHorizontal: padH,
            },
          ]}
        >
          <View style={styles.topRow}>
            <Text
              style={[styles.stepMeta, { fontFamily: fontFamily.medium, color: muted }]}
              numberOfLines={1}
            >
              Guía · Paso {step + 1} de {total}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Cerrar guía"
              style={({ pressed }) => [styles.closeBtn, pressed && { opacity: 0.7 }]}
            >
              <Text style={[styles.closeBtnText, { fontFamily: fontFamily.semiBold }]}>Cerrar</Text>
            </Pressable>
          </View>

          <ScrollView
            key={step}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.iconWrap}>
              <Ionicons name={current.icon || 'help-circle-outline'} size={44} color="#FFFFFF" />
            </View>
            <Text style={[styles.title, { fontFamily: fontFamily.bold }]}>{current.title}</Text>
            <Text style={[styles.paragraph, { fontFamily: fontFamily.regular }]}>{current.body}</Text>
          </ScrollView>

          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  { backgroundColor: i === step ? '#FFFFFF' : 'rgba(255,255,255,0.28)' },
                  i === step && styles.dotActive,
                ]}
              />
            ))}
          </View>

          <View style={styles.footer}>
            <View style={styles.footerInner}>
              {step > 0 ? (
                <View style={styles.footerButtonRow}>
                  <TouchableOpacity style={styles.btnGhost} onPress={goBack} activeOpacity={0.85}>
                    <Ionicons name="chevron-back" size={20} color="#FFFFFF" />
                    <Text style={[styles.btnGhostText, { fontFamily: fontFamily.semiBold }]}>Atrás</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btnPrimary, styles.btnPrimaryInRow]}
                    onPress={goNext}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.btnPrimaryText, { fontFamily: fontFamily.semiBold }]}>
                      {isLast ? 'Listo' : 'Siguiente'}
                    </Text>
                    {!isLast ? (
                      <Ionicons name="arrow-forward" size={18} color="#111827" style={styles.btnIcon} />
                    ) : null}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.btnPrimary} onPress={goNext} activeOpacity={0.9}>
                  <Text style={[styles.btnPrimaryText, { fontFamily: fontFamily.semiBold }]}>
                    {isLast ? 'Listo' : 'Siguiente'}
                  </Text>
                  {!isLast ? (
                    <Ionicons name="arrow-forward" size={18} color="#111827" style={styles.btnIcon} />
                  ) : null}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  safe: { flex: 1 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    minHeight: 44,
  },
  stepMeta: { fontSize: 13, flex: 1, marginRight: 12 },
  closeBtn: { paddingVertical: 8, paddingHorizontal: 4 },
  closeBtnText: { color: 'rgba(255,255,255,0.85)', fontSize: 16 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 2,
  },
  iconWrap: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 8,
  },
  title: {
    fontSize: 22,
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 14,
    lineHeight: 28,
  },
  paragraph: {
    fontSize: 16,
    lineHeight: 24,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'left',
  },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22, borderRadius: 4 },
  footer: { paddingTop: 8, alignItems: 'center', width: '100%' },
  footerInner: { width: '100%', maxWidth: 360, alignSelf: 'center' },
  footerButtonRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 12,
    width: '100%',
  },
  btnGhost: {
    flex: 0.95,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.42)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    minHeight: 52,
    gap: 4,
  },
  btnGhostText: { color: '#FFFFFF', fontSize: 16, letterSpacing: 0.2 },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    width: '100%',
    minHeight: 52,
  },
  btnPrimaryInRow: { flex: 1.25, width: undefined, paddingHorizontal: 20 },
  btnPrimaryText: { fontSize: 17, color: '#111827' },
  btnIcon: { marginLeft: 8 },
});

export default GuidedHelpOverlay;
