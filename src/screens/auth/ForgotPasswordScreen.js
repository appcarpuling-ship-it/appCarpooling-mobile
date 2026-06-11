import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { post_public } from '../../services/apiService';
import { useAlert } from '../../context/AlertContext';
import { ENDPOINTS } from '../../config/api';
import { useColors } from '../../hooks/useColors';

const ForgotPasswordScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const iconBg      = isDarkMode ? '#2A2A2A' : '#F3F4F6';

  const handleResetPassword = async () => {
    if (!email) {
      showAlert('Ocurrió algo', 'Por favor ingresá tu email');
      return;
    }
    setLoading(true);
    try {
      await post_public(ENDPOINTS.FORGOT_PASSWORD, { email });
      showAlert('Código enviado', 'Enviamos un código de recuperación a tu email', [
        { text: 'Ingresar código', onPress: () => navigation.navigate('ResetPassword', { email }) },
      ]);
    } catch (error) {
      showAlert('Ocurrió algo', error.message || 'Error al enviar el email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={22} color={textPrimary} />
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <Ionicons name="key-outline" size={32} color={textPrimary} />
            </View>
            <Text style={[styles.title, { color: textPrimary }]}>Recuperar contraseña</Text>
            <Text style={[styles.subtitle, { color: textMuted }]}>
              Ingresá tu email y te enviaremos un código para restablecer tu contraseña
            </Text>
          </View>

          {/* Form card */}
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <View style={styles.inputRow}>
              <Ionicons name="mail-outline" size={18} color={textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                placeholder="Email"
                placeholderTextColor={textMuted}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
            </View>
          </View>

          {/* Button */}
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }, loading && { opacity: 0.7 }]}
            onPress={handleResetPassword}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
              : <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>Enviar código</Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:    { flex: 1 },
  scrollContent:{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 16, paddingBottom: 40 },
  backBtn:      { width: 44, height: 44, justifyContent: 'center', marginBottom: 24 },
  header:       { alignItems: 'center', marginBottom: 32 },
  iconCircle:   { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  title:        { fontSize: 26, fontWeight: '700', marginBottom: 10, textAlign: 'center' },
  subtitle:     { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  card:         { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  inputRow:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  inputIcon:    { marginRight: 10 },
  input:        { flex: 1, height: 52, fontSize: 15 },
  btn:          { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center' },
  btnText:      { fontSize: 16, fontWeight: '700' },
});

export default ForgotPasswordScreen;
