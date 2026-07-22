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
import { useAlert } from '../../../context/AlertContext';
import { get_withauth } from '../../../services/apiService';
import { useUI } from '../../../theme/ui';

const ReferralScreen = () => {
  const { showAlert } = useAlert();
  const ui = useUI();

  const bg           = ui.bg;
  const cardBg       = ui.surface;
  const border       = ui.border;
  const textPrimary  = ui.text;
  const textMuted    = ui.textMuted;
  const divider      = ui.bg;
  // Lo "activo" (descuento ganado, paso cumplido) se marca invirtiendo el
  // fondo en vez de con verde.
  const green        = ui.invertText;
  const greenBg      = ui.invertBg;

  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReferralInfo(); }, []);

  const loadReferralInfo = async () => {
    try {
      const response = await get_withauth('/users/referral-info');
      if (response.success) setReferralInfo(response.data);
    } catch {
      showAlert('Ocurrió algo', 'No se pudo cargar la información de referidos');
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
    width: 104,
    height: 104,
    borderRadius: 999,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  discountNum: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 28,
    lineHeight: 30,
  },
  discountSub: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
  },
  headerTitle: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 24,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  headerDesc: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Card
  card: {
    borderRadius: 24,
    padding: 20,
    marginBottom: 12,
  },
  cardTitle: {
    fontFamily: 'Sora_700Bold',
    fontSize: 16,
    marginBottom: 14,
  },

  // Código
  codeBox: {
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 14,
  },
  codeText: {
    fontFamily: 'Sora_800ExtraBold',
    fontSize: 22,
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
    height: 52,
    borderRadius: 999,
  },
  btnPrimaryText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },
  btnSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    height: 52,
    borderRadius: 999,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },

  // Steps
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
  },
  stepIcon: {
    width: 44,
    height: 44,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepText:  { flex: 1, justifyContent: 'center' },
  stepTitle: { fontFamily: 'Sora_600SemiBold', fontSize: 14, marginBottom: 3 },
  stepDesc:  { fontFamily: 'Sora_400Regular', fontSize: 13, lineHeight: 18 },
  stepDivider: { height: 1 },

  // Referidos
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  refAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refInitial: {
    fontFamily: 'Sora_700Bold',
    fontSize: 15,
  },
  refInfo:   { flex: 1 },
  refName:   { fontFamily: 'Sora_600SemiBold', fontSize: 14 },
  refDate:   { fontSize: 12, marginTop: 2 },
  refBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  refBadgeText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 13,
  },
});

export default ReferralScreen;
