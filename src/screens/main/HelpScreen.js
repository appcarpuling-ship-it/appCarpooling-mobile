import React from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import useColors from '../../hooks/useColors';

const HelpScreen = () => {
  const colors = useColors();

  const faqItems = [
    {
      id: 1,
      question: '¿Cómo funciona el carpooling?',
      answer:
        'El carpooling es compartir tu vehículo con otras personas que van en la misma dirección. Como conductor, publicas tu viaje y los pasajeros pueden reservar asientos.',
    },
    {
      id: 2,
      question: '¿Cómo creo un viaje?',
      answer:
        'Ve a la pestaña "Viajes", toca "Crear Viaje" y completa la información: origen, destino, fecha, hora, asientos disponibles y precio por asiento.',
    },
    {
      id: 3,
      question: '¿Cómo reservo un viaje?',
      answer:
        'Busca viajes desde la pantalla principal, selecciona el viaje que te interese, revisa los detalles y toca "Reservar". Confirma el número de asientos y el pago.',
    },
    {
      id: 4,
      question: '¿Cómo funciona el pago?',
      answer:
        'Los pagos se realizan directamente entre conductor y pasajero. La plataforma solo facilita la conexión. Acuerden el método de pago antes del viaje.',
    },
    {
      id: 5,
      question: '¿Puedo cancelar una reserva?',
      answer:
        'Sí, puedes cancelar una reserva desde "Mis Reservas". Te recomendamos hacerlo con anticipación para que el conductor pueda ofrecer el asiento a otros pasajeros.',
    },
    {
      id: 6,
      question: '¿Qué pasa si el conductor cancela?',
      answer:
        'Si un conductor cancela un viaje, recibirás una notificación. Podrás buscar otros viajes alternativos en la plataforma.',
    },
    {
      id: 7,
      question: '¿Cómo agrego un vehículo?',
      answer:
        'Ve a tu Perfil, selecciona "Mis Vehículos" y toca el botón "+". Completa la información del vehículo: marca, modelo, año, color y placa.',
    },
    {
      id: 8,
      question: '¿Es seguro usar la aplicación?',
      answer:
        'Verificamos la información de los usuarios y fomentamos un sistema de calificaciones. Siempre revisa el perfil y las reseñas antes de viajar.',
    },
  ];

  const contactItems = [
    {
      id: 1,
      icon: 'mail',
      title: 'Email',
      subtitle: 'soporte@carpooling.com',
      onPress: () => Linking.openURL('mailto:soporte@carpooling.com'),
    },
    {
      id: 2,
      icon: 'call',
      title: 'Teléfono',
      subtitle: '+1 234 567 890',
      onPress: () => Linking.openURL('tel:+1234567890'),
    },
    // {
    //   id: 3,
    //   icon: 'chatbubbles',
    //   title: 'Chat en vivo',
    //   subtitle: 'Disponible 24/7',
    //   onPress: () => {},
    // },
  ];

  return (
    <LinearGradient
      colors={[staticColors.background, staticColors.surface]}
      style={styles.container}
    >
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.sectionTitle}>Preguntas Frecuentes</Text>

          {faqItems.map((item) => (
            <View key={item.id} style={styles.faqItem}>
              <View style={styles.faqHeader}>
                <Ionicons name="help-circle" size={24} color="#1F2937" />
                <Text style={styles.question}>{item.question}</Text>
              </View>
              <Text style={styles.answer}>{item.answer}</Text>
            </View>
          ))}

          <Text style={styles.contactSectionTitle}>Contáctanos</Text>

          {contactItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.contactItem}
              onPress={item.onPress}
            >
              <View style={styles.contactIcon}>
                <Ionicons name={item.icon} size={24} color="#1F2937" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactTitle}>{item.title}</Text>
                <Text style={styles.contactSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={staticColors.textTertiary} />
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    marginBottom: spacing.lg,
  },
  faqItem: {
    marginBottom: spacing.lg,
  },
  faqHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  question: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
    marginLeft: spacing.md,
    flex: 1,
  },
  answer: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    lineHeight: 20,
    marginLeft: 36,
  },
  contactSectionTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    marginTop: spacing.xl,
    marginBottom: spacing.lg,
    color: '#000000',
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F8F9FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  contactTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semiBold,
    color: '#000000',
  },
  contactSubtitle: {
    fontSize: fontSize.sm,
    color: '#9CA3AF',
    marginTop: 2,
  },
  footer: {
    backgroundColor: '#F8F9FA',
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  footerText: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default HelpScreen;