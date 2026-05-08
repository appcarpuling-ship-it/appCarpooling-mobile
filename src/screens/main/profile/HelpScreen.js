import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import useColors from '../../../hooks/useColors';

const HelpScreen = () => {
  const { getCurrentThemeMode } = useColors();

  const isDarkMode  = getCurrentThemeMode() === 'dark';
  const bg          = isDarkMode ? '#161616' : '#F5F5F5';
  const cardBg      = isDarkMode ? '#222222' : '#FFFFFF';
  const border      = isDarkMode ? '#2E2E2E' : '#E8E8E8';
  const textPrimary = isDarkMode ? '#FFFFFF' : '#000000';
  const textMuted   = isDarkMode ? '#6B7280' : '#9CA3AF';
  const divider     = isDarkMode ? '#2A2A2A' : '#F0F0F0';

  const faqItems = [
    {
      id: 1,
      question: '¿Cómo funciona el Carpuling?',
      answer: 'Es compartir tu vehículo con personas que van en la misma dirección. Como conductor, publicás tu viaje y los pasajeros pueden reservar asientos.',
    },
    {
      id: 2,
      question: '¿Cómo creo un viaje?',
      answer: 'Andá a la pestaña "Viajes", tocá "Crear Viaje" y completá la información: origen, destino, fecha, hora, asientos disponibles y precio por asiento.',
    },
    {
      id: 3,
      question: '¿Cómo reservo un viaje?',
      answer: 'Buscá viajes desde la pantalla principal, seleccioná el que te interese, revisá los detalles y tocá "Reservar". Confirmá el número de asientos.',
    },
    {
      id: 4,
      question: '¿Cómo funciona el pago?',
      answer: 'Los pagos se realizan directamente entre conductor y pasajero. La plataforma solo facilita la conexión. Acordá el método de pago antes del viaje.',
    },
    {
      id: 5,
      question: '¿Puedo cancelar una reserva?',
      answer: 'Sí, podés cancelar una reserva desde "Mis Reservas". Te recomendamos hacerlo con anticipación para que el conductor pueda ofrecer el asiento a otros.',
    },
    {
      id: 6,
      question: '¿Qué pasa si el conductor cancela?',
      answer: 'Si un conductor cancela, recibirás una notificación. Podrás buscar otros viajes alternativos en la plataforma.',
    },
    {
      id: 7,
      question: '¿Cómo agrego un vehículo?',
      answer: 'Andá a tu Perfil, seleccioná "Mis Vehículos" y tocá el botón "+". Completá la información: marca, modelo, año, color y patente.',
    },
    {
      id: 8,
      question: '¿Es seguro usar la aplicación?',
      answer: 'Verificamos la información de los usuarios y fomentamos un sistema de calificaciones. Siempre revisá el perfil y las reseñas antes de viajar.',
    },
  ];

  const contactItems = [
    {
      id: 1,
      icon: 'mail-outline',
      title: 'Email',
      subtitle: 'soporte@carpuling.com',
      onPress: () => Linking.openURL('mailto:soporte@carpuling.com'),
    },
    {
      id: 2,
      icon: 'call-outline',
      title: 'Teléfono',
      subtitle: '+1 234 567 890',
      onPress: () => Linking.openURL('tel:+1234567890'),
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* FAQ */}
        <Text style={[styles.sectionLabel, { color: textMuted }]}>PREGUNTAS FRECUENTES</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {faqItems.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.faqItem,
                index < faqItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
              ]}
            >
              <Text style={[styles.question, { color: textPrimary }]}>{item.question}</Text>
              <Text style={[styles.answer, { color: textMuted }]}>{item.answer}</Text>
            </View>
          ))}
        </View>

        {/* Contacto */}
        <Text style={[styles.sectionLabel, { color: textMuted, marginTop: 8 }]}>CONTACTO</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {contactItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.contactRow,
                index < contactItems.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: divider },
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.contactIcon, { backgroundColor: divider }]}>
                <Ionicons name={item.icon} size={19} color={textPrimary} />
              </View>
              <View style={styles.contactInfo}>
                <Text style={[styles.contactTitle, { color: textPrimary }]}>{item.title}</Text>
                <Text style={[styles.contactSub, { color: textMuted }]}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={textMuted} />
            </TouchableOpacity>
          ))}
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  screen:  { flex: 1 },
  scroll:  { padding: 16, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 12,
  },

  faqItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 6,
  },
  question: {
    fontSize: 14,
    fontWeight: '600',
  },
  answer: {
    fontSize: 13,
    lineHeight: 19,
  },

  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  contactIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: { flex: 1 },
  contactTitle: { fontSize: 15, fontWeight: '500' },
  contactSub:   { fontSize: 13, marginTop: 2 },
});

export default HelpScreen;
