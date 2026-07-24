import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAlert } from '../../../context/AlertContext';
import { redeemCoupon, getMyCoupons } from '../../../services/couponService';
import { useUI } from '../../../theme/ui';

const describeCoupon = (coupon) => {
  if (!coupon) return '';
  switch (coupon.type) {
    case 'free_trip':
      return 'Viaje gratis';
    case 'percentage':
      return `${coupon.value}% de descuento`;
    case 'fixed_amount':
      return `$${coupon.value} de descuento`;
    default:
      return coupon.description || 'Cupón';
  }
};

const CouponsScreen = () => {
  const { showAlert } = useAlert();
  const navigation = useNavigation();
  const ui = useUI();

  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const border      = ui.border;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg;
  const green       = ui.invertText;
  const greenBg     = ui.invertBg;

  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCoupons(); }, []);

  const loadCoupons = async () => {
    try {
      const response = await getMyCoupons();
      if (response.success) setCoupons(response.data || []);
    } catch {
      showAlert('Ocurrió algo', 'No se pudieron cargar tus cupones');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setRedeeming(true);
    try {
      const response = await redeemCoupon(trimmed);
      if (response.success) {
        setCode('');
        loadCoupons();
        navigation.navigate('Result', { type: 'success', title: '¡Listo!', message: response.message || 'Cupón canjeado correctamente' });
      } else {
        showAlert('No se pudo canjear', response.message || 'Código inválido');
      }
    } catch (error) {
      const message = error?.response?.data?.message || 'No se pudo canjear el código';
      showAlert('No se pudo canjear', message);
    } finally {
      setRedeeming(false);
    }
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

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Canjear */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Canjear cupón</Text>

          <TextInput
            style={[styles.input, { backgroundColor: divider, color: textPrimary, borderColor: border }]}
            placeholder="Ingresá tu código"
            placeholderTextColor={textMuted}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
          />

          <TouchableOpacity
            style={[
              styles.btnPrimary,
              { backgroundColor: textPrimary, opacity: redeeming || !code.trim() ? 0.6 : 1 },
            ]}
            onPress={handleRedeem}
            disabled={redeeming || !code.trim()}
            activeOpacity={0.85}
          >
            {redeeming ? (
              <ActivityIndicator size="small" color={cardBg} />
            ) : (
              <Text style={[styles.btnPrimaryText, { color: cardBg }]}>Canjear</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Mis cupones */}
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Text style={[styles.cardTitle, { color: textPrimary }]}>Mis cupones</Text>

          {coupons.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="pricetag-outline" size={32} color={textMuted} />
              <Text style={[styles.emptyText, { color: textMuted }]}>
                Todavía no canjeaste ningún cupón
              </Text>
            </View>
          ) : (
            coupons.map((redemption, idx) => {
              const isAvailable = redemption.status === 'banked';
              return (
                <View
                  key={redemption._id}
                  style={[
                    styles.couponRow,
                    idx < coupons.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: divider,
                    },
                  ]}
                >
                  <View style={[styles.couponIcon, { backgroundColor: isAvailable ? greenBg : divider }]}>
                    <Ionicons
                      name="pricetag-outline"
                      size={18}
                      color={isAvailable ? green : textMuted}
                    />
                  </View>
                  <View style={styles.couponInfo}>
                    <Text style={[styles.couponCode, { color: textPrimary }]}>
                      {redemption.coupon?.code}
                    </Text>
                    <Text style={[styles.couponDesc, { color: textMuted }]}>
                      {describeCoupon(redemption.coupon)}
                    </Text>
                    <Text style={[styles.couponDate, { color: textMuted }]}>
                      Canjeado el {formatDate(redemption.redeemedAt || redemption.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: isAvailable ? greenBg : divider }]}>
                    <Text style={[styles.badgeText, { color: isAvailable ? green : textMuted }]}>
                      {isAvailable ? 'Disponible' : 'Usado'}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  center:  { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll:  { padding: 16, paddingBottom: 40 },

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

  input: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
    height: 52,
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
    letterSpacing: 1,
    marginBottom: 12,
  },
  btnPrimary: {
    height: 52,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 15,
  },

  emptyState: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  emptyText: {
    fontFamily: 'Sora_400Regular',
    fontSize: 14,
    textAlign: 'center',
  },

  couponRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  couponIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponInfo:  { flex: 1 },
  couponCode:  { fontFamily: 'Sora_700Bold', fontSize: 14, letterSpacing: 1 },
  couponDesc:  { fontFamily: 'Sora_600SemiBold', fontSize: 13, marginTop: 2 },
  couponDate:  { fontSize: 12, marginTop: 2 },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeText: {
    fontFamily: 'Sora_700Bold',
    fontSize: 12,
  },
});

export default CouponsScreen;
