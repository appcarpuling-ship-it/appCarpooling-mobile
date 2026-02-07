import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { get_withauth } from '../../services/apiService';
import useColors from '../../hooks/useColors';

const ReferralScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { colors, getCurrentThemeMode } = useColors();
  const [referralInfo, setReferralInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReferralInfo();
  }, []);

  const loadReferralInfo = async () => {
    try {
      setLoading(true);
      const response = await get_withauth('/users/referral-info');
      if (response.success) {
        setReferralInfo(response.data);
      }
    } catch (error) {
      console.error('Error loading referral info:', error);
      Alert.alert('Error', 'No se pudo cargar la información de referidos');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (referralInfo?.myReferralCode) {
      await Clipboard.setStringAsync(referralInfo.myReferralCode);
      Alert.alert('¡Copiado!', 'Tu código promocional ha sido copiado al portapapeles');
    }
  };

  const shareReferralCode = async () => {
    if (!referralInfo?.myReferralCode) return;
    
    const message = `¡Únete a nuestra app de carpooling con mi código promocional ${referralInfo.myReferralCode}! 🚗✨\n\nDescarga la app y usa mi código al registrarte para ayudarme a obtener descuentos.`;
    
    try {
      await Share.share({
        message,
        title: '¡Únete a nuestro carpooling!',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          Cargando información de referidos...
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        
        {/* Header con descuento */}
        <View style={styles.headerContainer}>
          <View style={[styles.discountBadge, { backgroundColor: colors.success + '15' }]}>
            <Text style={[styles.discountPercentage, { color: colors.success }]}>
              {referralInfo?.myDiscountPercentage || 0}%
            </Text>
            <Text style={[styles.discountLabel, { color: colors.success }]}>
              de descuento
            </Text>
          </View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>
            ¡Invita amigos y ahorra!
          </Text>
          <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
            Por cada amigo que invites obtienes 20% de descuento
          </Text>
        </View>

        {/* Código Promocional */}
        <View style={[styles.promoCodeCard, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.border }]}>
          <View style={styles.promoCodeHeader}>
            <View style={[styles.giftIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.primary + '15' }]}>
              <Ionicons name="gift" size={20} color={getCurrentThemeMode() === 'dark' ? '#FFFFFF' : colors.primary} />
            </View>
            <Text style={[styles.promoCodeTitle, { color: colors.textPrimary }]}>
              Tu código promocional
            </Text>
          </View>
          
          <View style={[styles.codeDisplay, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.codeText, { color: getCurrentThemeMode() === 'dark' ? '#FFFFFF' : colors.primary }]}>
              {referralInfo?.myReferralCode || 'Cargando...'}
            </Text>
          </View>
          
          <View style={styles.promoActions}>
            <TouchableOpacity 
              style={[styles.primaryButton, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.primary }]}
              onPress={copyToClipboard}
            >
              <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Copiar código</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.secondaryButton, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : 'transparent', borderColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.border }]}
              onPress={shareReferralCode}
            >
              <Ionicons name="share-outline" size={18} color={getCurrentThemeMode() === 'dark' ? '#FFFFFF' : colors.primary} />
              <Text style={[styles.secondaryButtonText, { color: getCurrentThemeMode() === 'dark' ? '#FFFFFF' : colors.primary }]}>Compartir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cómo funciona */}
        <View style={[styles.howItWorksCard, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#292929' : colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.howItWorksTitle, { color: colors.textPrimary }]}>
            ¿Cómo funciona?
          </Text>
          
          <View style={styles.stepsList}>
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.primary }]}>
                <Ionicons name="person-add" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                  Invita a tus amigos
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  Comparte tu código promocional con amigos y familiares
                </Text>
              </View>
            </View>
            
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, { backgroundColor: getCurrentThemeMode() === 'dark' ? '#1F1F1F' : colors.primary }]}>
                <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                  Se registran con tu código
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  Cuando se registren usando tu código, ¡tú ganas!
                </Text>
              </View>
            </View>
            
            <View style={styles.stepItem}>
              <View style={[styles.stepIcon, { backgroundColor: colors.success }]}>
                <Ionicons name="pricetag" size={16} color="#FFFFFF" />
              </View>
              <View style={styles.stepContent}>
                <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>
                  Obtén 20% de descuento
                </Text>
                <Text style={[styles.stepDescription, { color: colors.textSecondary }]}>
                  Úsalo en tu próximo viaje. Los descuentos se acumulan hasta 100%
                </Text>
              </View>
            </View>
          </View>
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  
  // Header Section
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  discountBadge: {
    borderRadius: 60,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  discountPercentage: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  discountLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 22,
  },
  
  // Promo Code Card
  promoCodeCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
  },
  promoCodeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  giftIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  promoCodeTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  codeDisplay: {
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    alignItems: 'center',
  },
  codeText: {
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 3,
  },
  promoActions: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  
  // How it works Card
  howItWorksCard: {
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
  },
  howItWorksTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  stepsList: {
    gap: 16,
  },
  stepItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default ReferralScreen;