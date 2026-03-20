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
import { useAlert } from '../../context/AlertContext';
import { get_withauth } from '../../services/apiService';
import useColors from '../../hooks/useColors';

const ReferralScreen = () => {
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode   = getCurrentThemeMode() === 'dark';
  const bg           = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg       = isDarkMode ? '#222222' : '#FFFFFF';
  const border       = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary  = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted    = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider      = isDarkMode ? '#2A2A2A' : '#F0F0F0';
  const green        = '#10B981';
  const greenBg      = isDarkMode ? '#064E3B' : '#D1FAE5';

  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReferralInfo(); }, []);

  const loadReferralInfo = async () => {
    try {
      const response = await get_withauth('/users/referral-info');
      if (response.success) setReferralInfo(response.data);
    } catch {
      showAlert('Error', 'No se pudo cargar la información de referidos');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (referralInfo?.myReferralCode) {
      await Clipboard.setStringAsync(referralInfo.myReferralCode);
      showAlert('Copiado', 'Tu código fue copiado al portapapeles');
    }
  };

  const shareReferralCode = async () => {
    if (!referralInfo?.myReferralCode) return;
    try {
      await Share.share({
        message: `Unite a nuestra app de carpooling con mi código ${referralInfo.myReferralCode}!\n\nDescargala y usalo al registrarte para obtener descuentos.`,
        title: 'Unite al carpooling',
      });
    } catch {}
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={textPrimary} />
      </View>
    );
  }

  const discount = referralInfo?.myDiscountPercentage ?? 0;
  const code     = referralInfo?.myReferralCode ?? '—';

  const steps = [
    {
      icon:  'person-add-outline',
      title: 'Invitá a tus amigos',
      desc:  'Compartí tu código con amigos y familiares.',
    },
    {
      icon:  'checkmark-circle-outline',
      title: 'Se registran con tu código',
      desc:  'Cuando se registren usando tu código, vos ganás.',
    },
    {
      icon:   'pricetag-outline',
      title:  'Obtenés 20% de descuento',
      desc:   'Usalo en tu próximo viaje. Los descuentos se acumulan hasta 100%.',
      accent: true,
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Header */}
        <View style={styles.header}>
          <View style={[
            styles.discountCircle,
            { backgroundColor: discount > 0 ? greenBg : divider, borderColor: discount > 0 ? green : border },
          ]}>
            <Text style={[styles.discountNum, { color: discount > 0 ? green : textMuted }]}>
              {discount}%
            </Text>
            <Text style={[styles.discountSub, { color: discount > 0 ? green : textMuted }]}>
              descuento
            </Text>
          </View>

          <Text style={[styles.headerTitle, { color: textPrimary }]}>Invitá amigos y ahorrá</Text>
          <Text style={[styles.headerDesc, { color: textMuted }]}>
            Por cada amigo que invites obtenés 20% de descuento
          </Text>
        </View>

        {/* Código */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Tu código promocional</Text>

          <View style={[styles.codeBox, { backgroundColor: divider }]}>
            <Text style={[styles.codeText, { color: textPrimary }]}>{code}</Text>
          </View>

          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: textPrimary }]}
              onPress={copyToClipboard}
              activeOpacity={0.85}
            >
              <Text style={[styles.btnPrimaryText, { color: cardBg }]}>Copiar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: border }]}
              onPress={shareReferralCode}
              activeOpacity={0.7}
            >
              <Text style={[styles.btnSecondaryText, { color: textPrimary }]}>Compartir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cómo funciona */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Cómo funciona</Text>

          {steps.map((step, idx) => (
            <View key={idx}>
              <View style={styles.stepRow}>
                <View style={[
                  styles.stepIcon,
                  { backgroundColor: step.accent ? greenBg : divider },
                ]}>
                  <Ionicons
                    name={step.icon}
                    size={18}
                    color={step.accent ? green : textPrimary}
                  />
                </View>
                <View style={styles.stepText}>
                  <Text style={[styles.stepTitle, { color: textPrimary }]}>{step.title}</Text>
                  <Text style={[styles.stepDesc, { color: textMuted }]}>{step.desc}</Text>
                </View>
              </View>
              {idx < steps.length - 1 && (
                <View style={[styles.stepDivider, { backgroundColor: divider, marginLeft: 54 }]} />
              )}
            </View>
          ))}
        </View>

        {/* Referidos */}
        {/* {referralInfo?.referredUsers?.length > 0 && (
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <Text style={[styles.cardTitle, { color: textPrimary }]}>
              Amigos referidos ({referralInfo.referredUsers.length})
            </Text>

            {referralInfo.referredUsers.map((ref, idx) => (
              <View
                key={idx}
                style={[
                  styles.refRow,
                  idx < referralInfo.referredUsers.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: divider,
                  },
                ]}
              >
                <View style={[styles.refAvatar, { backgroundColor: divider }]}>
                  <Text style={[styles.refInitial, { color: textPrimary }]}>
                    {ref.firstName?.[0] || '?'}
                  </Text>
                </View>
                <View style={styles.refInfo}>
                  <Text style={[styles.refName, { color: textPrimary }]}>
                    {ref.firstName} {ref.lastName}
                  </Text>
                  <Text style={[styles.refDate, { color: textMuted }]}>
                    {formatDate(ref.createdAt)}
                  </Text>
                </View>
                <View style={[styles.refBadge, { backgroundColor: greenBg }]}>
                  <Text style={[styles.refBadgeText, { color: green }]}>+20%</Text>
                </View>
              </View>
            ))}
          </View>
        )} */}

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:  { padding: 16, paddingBottom: 40 },

  // Header
  header: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 24,
    paddingHorizontal: 16,
    gap: 8,
  },
  discountCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
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
    textAlign: 'center',
  },
  headerDesc: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 18,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 14,
  },

  // Código
  codeBox: {
    borderRadius: 10,
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
  btnPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 10,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
  },
  btnSecondaryText: {
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
  stepText:  { flex: 1, justifyContent: 'center' },
  stepTitle: { fontSize: 14, fontWeight: '600', marginBottom: 3 },
  stepDesc:  { fontSize: 13, lineHeight: 18 },
  stepDivider: { height: 1 },

  // Referidos
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  refAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refInitial: {
    fontSize: 15,
    fontWeight: '700',
  },
  refInfo:   { flex: 1 },
  refName:   { fontSize: 14, fontWeight: '600' },
  refDate:   { fontSize: 12, marginTop: 2 },
  refBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  refBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
});

export default ReferralScreen;
