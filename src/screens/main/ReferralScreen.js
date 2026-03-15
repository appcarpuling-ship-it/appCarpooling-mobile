import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { get_withauth } from '../../services/apiService';
import useColors from '../../hooks/useColors';

const ReferralScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const { colors, getCurrentThemeMode } = useColors();
  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  const isDarkMode = getCurrentThemeMode() === 'dark';
  const cardBg   = isDarkMode ? '#1C1C1C' : '#FFFFFF';
  const screenBg = isDarkMode ? '#0E0E0E' : '#F6F6F6';
  const sep      = isDarkMode ? '#252525' : '#F0F0F0';
  const shadow   = isDarkMode ? {} : {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  };

  useEffect(() => { loadReferralInfo(); }, []);

  const loadReferralInfo = async () => {
    try {
      const response = await get_withauth('/users/referral-info');
      if (response.success) setReferralInfo(response.data);
    } catch {
      showAlert('Error', 'No se pudo cargar la informacion de referidos');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (referralInfo?.myReferralCode) {
      await Clipboard.setStringAsync(referralInfo.myReferralCode);
      showAlert('Copiado', 'Tu codigo promocional fue copiado al portapapeles');
    }
  };

  const shareReferralCode = async () => {
    if (!referralInfo?.myReferralCode) return;
    try {
      await Share.share({
        message: `Unete a nuestra app de carpooling con mi codigo promocional ${referralInfo.myReferralCode}!\n\nDescargala y usalo al registrarte para ayudarme a obtener descuentos.`,
        title: 'Unete a nuestro carpooling!',
      });
    } catch {}
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: screenBg }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  const discount = referralInfo?.myDiscountPercentage ?? 0;
  const code     = referralInfo?.myReferralCode ?? '—';

  const steps = [
    {
      icon: 'person-add-outline',
      title: 'Invita a tus amigos',
      desc: 'Comparte tu codigo con amigos y familiares',
    },
    {
      icon: 'checkmark-circle-outline',
      title: 'Se registran con tu codigo',
      desc: 'Cuando se registren usando tu codigo, tu ganas',
    },
    {
      icon: 'pricetag-outline',
      title: 'Obtenes 20% de descuento',
      desc: 'Usalo en tu proximo viaje. Los descuentos se acumulan hasta 100%',
      accent: true,
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: screenBg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          {discount > 0 ? (
            <View style={[styles.discountCircle, { backgroundColor: colors.success + '15', borderColor: colors.success + '30' }]}>
              <Text style={[styles.discountNum, { color: colors.success }]}>{discount}%</Text>
              <Text style={[styles.discountSub, { color: colors.success }]}>de descuento</Text>
            </View>
          ) : (
            <View style={[styles.discountCircle, { backgroundColor: isDarkMode ? '#1C1C1C' : '#F0F0F0', borderColor: isDarkMode ? '#2A2A2A' : '#E0E0E0' }]}>
              <Text style={[styles.discountNum, { color: colors.textMuted }]}>0%</Text>
              <Text style={[styles.discountSub, { color: colors.textMuted }]}>de descuento</Text>
            </View>
          )}

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            Invita amigos y ahorra
          </Text>
          <Text style={[styles.headerDesc, { color: colors.textTertiary }]}>
            Por cada amigo que invites obtienes 20% de descuento
          </Text>
        </View>

        {/* Codigo promocional */}
        <View style={[styles.card, { backgroundColor: cardBg }, shadow]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Tu codigo promocional</Text>

          <View style={[styles.codeBox, { backgroundColor: isDarkMode ? '#141414' : '#F8F8F8', borderColor: sep }]}>
            <Text style={[styles.codeText, { color: colors.textPrimary }]}>{code}</Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnMain, { backgroundColor: colors.textPrimary, flex: 1 }]}
              onPress={copyToClipboard}
            >
              <Ionicons name="copy-outline" size={16} color={cardBg} />
              <Text style={[styles.btnMainTxt, { color: cardBg }]}>Copiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: isDarkMode ? '#2A2A2A' : '#E0E0E0', flex: 1 }]}
              onPress={shareReferralCode}
            >
              <Ionicons name="share-outline" size={16} color={colors.textPrimary} />
              <Text style={[styles.btnOutlineTxt, { color: colors.textPrimary }]}>Compartir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Como funciona */}
        <View style={[styles.card, { backgroundColor: cardBg }, shadow]}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Como funciona</Text>

          {steps.map((step, idx) => (
            <View key={idx}>
              <View style={styles.stepRow}>
                <View style={[
                  styles.stepIcon,
                  {
                    backgroundColor: step.accent
                      ? colors.success + '15'
                      : isDarkMode ? '#252525' : '#F5F5F5',
                  },
                ]}>
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={step.accent ? colors.success : colors.textPrimary}
                  />
                </View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: colors.textTertiary }]}>{step.desc}</Text>
                </View>
              </View>
              {idx < steps.length - 1 && (
                <View style={[styles.stepSep, { backgroundColor: sep, marginLeft: 54 }]} />
              )}
            </View>
          ))}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen:   { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:   { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
  },
  discountCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  discountNum: {
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 30,
  },
  discountSub: {
    fontSize: 11,
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
  },
  headerDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 14,
  },

  // Codigo
  codeBox: {
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: 4,
  },

  // Botones
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  btnMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 10,
  },
  btnMainTxt: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnOutlineTxt: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
  },
  stepIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText: {
    flex: 1,
    justifyContent: 'center',
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  stepDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  stepSep: {
    height: 1,
  },
});

export default ReferralScreen;
