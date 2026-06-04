import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { useAlert } from '../../context/AlertContext';
import { useColors } from '../../hooks/useColors';

const GENDER_OPTIONS = [
  { label: 'Masculino', value: 'male' },
  { label: 'Femenino',  value: 'female' },
];

const CompleteProfileScreen = () => {
  const { user, updateProfile } = useAuth();
  const { showAlert } = useAlert();
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#1E1E1E' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const accent      = isDarkMode ? '#FFFFFF' : '#000000';

  const isPlaceholderName = (name) =>
    !name || name === 'Usuario' || name === 'Google' || name === 'Apple';

  const [firstName, setFirstName] = useState(
    isPlaceholderName(user?.firstName) ? '' : user?.firstName || ''
  );
  const [lastName, setLastName] = useState(
    isPlaceholderName(user?.lastName) ? '' : user?.lastName || ''
  );
  const [phone, setPhone]     = useState('');
  const [gender, setGender]   = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      showAlert('Faltan datos', 'Por favor ingresá tu nombre y apellido.');
      return;
    }
    if (!phone.trim()) {
      showAlert('Faltan datos', 'Por favor ingresá tu número de teléfono.');
      return;
    }
    if (!gender) {
      showAlert('Faltan datos', 'Por favor seleccioná tu género.');
      return;
    }

    setLoading(true);
    const result = await updateProfile({ firstName, lastName, phone, gender });
    setLoading(false);

    if (!result.success) {
      showAlert('Error', result.message || 'No se pudo guardar el perfil.');
    }
    // Si success, AppNavigator detecta user.phone y navega a Main automáticamente
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: bg }]} edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

          <Text style={[styles.title, { color: textPrimary }]}>Completá tu perfil</Text>
          <Text style={[styles.subtitle, { color: textMuted }]}>
            Necesitamos algunos datos para que puedas usar Carpuling
          </Text>

          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>

            {/* Nombre */}
            <View style={[styles.row, { borderBottomColor: border }]}>
              <Ionicons name="person-outline" size={18} color={textMuted} style={styles.icon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                placeholder="Nombre"
                placeholderTextColor={textMuted}
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
              />
            </View>

            {/* Apellido */}
            <View style={[styles.row, { borderBottomColor: border }]}>
              <Ionicons name="person-outline" size={18} color={textMuted} style={styles.icon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                placeholder="Apellido"
                placeholderTextColor={textMuted}
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
              />
            </View>

            {/* Teléfono */}
            <View style={[styles.row, { borderBottomColor: border }]}>
              <Ionicons name="call-outline" size={18} color={textMuted} style={styles.icon} />
              <TextInput
                style={[styles.input, { color: textPrimary }]}
                placeholder="Teléfono (ej: +5491112345678)"
                placeholderTextColor={textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            {/* Género */}
            <View style={styles.genderRow}>
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[
                    styles.genderBtn,
                    { borderColor: border, backgroundColor: cardBg },
                    gender === opt.value && { borderColor: accent, backgroundColor: isDarkMode ? '#2A2A2A' : '#F0F0F0' },
                  ]}
                  onPress={() => setGender(opt.value)}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={opt.value === 'male' ? 'male-outline' : 'female-outline'}
                    size={18}
                    color={gender === opt.value ? accent : textMuted}
                    style={{ marginRight: 6 }}
                  />
                  <Text style={{ color: gender === opt.value ? accent : textMuted, fontWeight: '500' }}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

          </View>

          <TouchableOpacity
            style={[styles.btn, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={isDarkMode ? '#000000' : '#FFFFFF'} />
              : <Text style={[styles.btnText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
                  Guardar y continuar
                </Text>
            }
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container:  { flex: 1 },
  scroll:     { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  title:      { fontSize: 26, fontWeight: '700', marginBottom: 8 },
  subtitle:   { fontSize: 14, marginBottom: 32, lineHeight: 20 },
  card:       { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', marginBottom: 16 },
  row:        { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  icon:       { marginRight: 10 },
  input:      { flex: 1, height: 52, fontSize: 15 },
  genderRow:  { flexDirection: 'row', gap: 12, padding: 16 },
  genderBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 44, borderRadius: 10, borderWidth: 1.5 },
  btn:        { borderRadius: 14, height: 54, justifyContent: 'center', alignItems: 'center', marginTop: 8 },
  btnText:    { fontSize: 16, fontWeight: '700' },
});

export default CompleteProfileScreen;
