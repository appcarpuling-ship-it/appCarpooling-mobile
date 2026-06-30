import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useColors } from '../../../hooks/useColors';

const PrivacyScreen = () => {
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';

  const sections = [
    {
      title: '1. Introducción',
      text: 'En Carpuling, nos tomamos muy en serio tu privacidad. Esta política describe cómo recopilamos, usamos, compartimos y protegemos tu información personal.',
    },
    {
      title: '2. Información que Recopilamos',
      text: '• Nombre completo\n• Correo electrónico\n• Número de teléfono\n• Fotografía de perfil (opcional)\n• Marca, modelo y año del vehículo\n• Ubicaciones de origen y destino de los viajes\n• Historial de viajes y reservas',
    },
    {
      title: '3. Cómo Usamos tu Información',
      text: '• Facilitar la conexión entre conductores y pasajeros\n• Procesar pagos de forma segura\n• Mejorar la experiencia de uso de la plataforma\n• Enviarte notificaciones relevantes sobre tus viajes\n• Cumplir con obligaciones legales',
    },
    {
      title: '4. Compartir Información',
      text: 'No vendemos tu información personal a terceros. Compartimos datos únicamente cuando es necesario para proveer el servicio (ej: mostrar tu nombre y foto a otros usuarios del viaje) o cuando lo exige la ley.',
    },
    {
      title: '5. Seguridad de los Datos',
      text: 'Implementamos medidas técnicas y organizativas para proteger tu información contra acceso no autorizado, pérdida o destrucción. Las contraseñas se almacenan encriptadas.',
    },
    {
      title: '6. Tus Derechos',
      text: '• Acceder a tus datos personales\n• Rectificar datos incorrectos\n• Solicitar la eliminación de tu cuenta\n• Oponerte al tratamiento de tus datos\n• Portabilidad de datos\n\nPodés ejercer estos derechos desde la sección de Ayuda.',
    },
    {
      title: '7. Retención de Datos',
      text: 'Conservamos tus datos mientras tengas una cuenta activa. Al eliminar tu cuenta, borraremos tus datos personales en un plazo razonable, salvo que exista obligación legal de conservarlos.',
    },
    {
      title: '8. Contacto',
      text: 'Si tenés preguntas sobre esta política, contactanos a través de la sección de Ayuda en la aplicación.',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {sections.map((s, index) => (
            <View
              key={index}
              style={[
                styles.section,
                index < sections.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: textPrimary }]}>{s.title}</Text>
              <Text style={[styles.sectionText, { color: textMuted }]}>{s.text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default PrivacyScreen;
