import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  useWindowDimensions,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUI } from '../../theme/ui';
import PillButton from '../../components/ui/PillButton';

export const ONBOARDING_SEEN_KEY = '@carpuling_onboarding_seen';

// El "acento" del rediseño es el peso tipográfico, no el color: el segundo
// tramo de cada título va en ExtraBold y el primero en Light.
const SLIDES = [
  { icon: 'car-sport-outline', lead: 'Viajá con otros,', strong: 'gastá menos', body: 'Compartí los asientos libres de tu auto y dividí el costo del viaje.' },
  { icon: 'navigate-outline',  lead: 'Publicá tu viaje',  strong: 'en segundos', body: 'Elegís origen, destino y cuántos lugares tenés. Nada más.' },
  { icon: 'shield-checkmark-outline', lead: 'Gente verificada,', strong: 'viajes seguros', body: 'Perfiles con reseñas reales de quienes ya viajaron.' },
];

const OnboardingScreen = ({ navigation }) => {
  const ui = useUI();
  const { width } = useWindowDimensions();
  const scrollRef = useRef(null);
  const [index, setIndex] = useState(0);

  const isLast = index === SLIDES.length - 1;

  const finish = async () => {
    // Si falla el guardado, el onboarding se repite: molesto pero no rompe el login.
    try { await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, '1'); } catch {}
    navigation.replace('Login');
  };

  const next = () => {
    if (isLast) return finish();
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
  };

  const LOGO = ui.isDarkMode
    ? require('../../../assets/logo/192x192-white.png')
    : require('../../../assets/logo/192x192-black.png');

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: ui.bg }]} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Image source={LOGO} style={styles.logo} />
        <TouchableOpacity onPress={finish} hitSlop={12} accessibilityRole="button">
          <Text style={[styles.skip, { color: ui.textMuted }]}>Saltar</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={styles.pager}
      >
        {SLIDES.map((s) => (
          <View key={s.strong} style={[styles.slide, { width }]}>
            <View style={[styles.art, { backgroundColor: ui.surface }]}>
              <Ionicons name={s.icon} size={104} color={ui.text} />
            </View>

            <Text style={[styles.title, { color: ui.text }]}>
              {s.lead}
              {'\n'}
              <Text style={styles.titleStrong}>{s.strong}</Text>
            </Text>
            <Text style={[styles.body, { color: ui.textMuted }]}>{s.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {SLIDES.map((s, i) => (
            <View
              key={s.strong}
              style={[
                styles.dot,
                { backgroundColor: i === index ? ui.text : ui.border },
                i === index && styles.dotActive,
              ]}
            />
          ))}
        </View>

        <PillButton
          label={isLast ? 'Empezar' : 'Siguiente'}
          onPress={next}
          trailingIcon={isLast ? 'checkmark' : 'arrow-forward'}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:   { flex: 1 },
  topBar:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8 },
  logo:        { width: 30, height: 30, resizeMode: 'contain' },
  skip:        { fontFamily: 'Sora_500Medium', fontSize: 15 },
  pager:       { flex: 1 },
  slide:       { flex: 1, paddingHorizontal: 24, justifyContent: 'center' },
  art:         { height: 300, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 40 },
  title:       { fontFamily: 'Sora_300Light', fontSize: 34, lineHeight: 42, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },
  body:        { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 23, marginTop: 14, paddingRight: 24 },
  footer:      { paddingHorizontal: 24, paddingBottom: 12, gap: 24 },
  dots:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot:         { width: 6, height: 6, borderRadius: 999 },
  dotActive:   { width: 22 },
});

export default OnboardingScreen;
