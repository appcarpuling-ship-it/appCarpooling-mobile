import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useUI } from '../../../theme/ui';

const TermsScreen = () => {
  const ui = useUI();
  const bg          = ui.bg;
  const cardBg      = ui.surface;
  const textPrimary = ui.text;
  const textMuted   = ui.textMuted;
  const divider     = ui.bg; // separa las secciones dentro de la card gris

  const sections = [
    {
      title: '1. Aceptación de los Términos',
      text: 'Al acceder y utilizar esta aplicación de carpuling, aceptás estar sujeto a estos términos y condiciones de uso. Si no estás de acuerdo con alguna parte de estos términos, no debés usar nuestra aplicación.',
    },
    {
      title: '2. Descripción del Servicio',
      text: 'Nuestra plataforma conecta a conductores con pasajeros que comparten rutas similares, permitiendo compartir los gastos del viaje. No somos una empresa de transporte, sino una plataforma tecnológica que facilita estas conexiones.',
    },
    {
      title: '3. Responsabilidades del Usuario',
      text: '• Proporcionar información veraz y actualizada\n• Mantener la seguridad de tu cuenta\n• Cumplir con todas las leyes de tránsito aplicables\n• Respetar a otros usuarios de la plataforma\n• No usar la plataforma para actividades ilegales',
    },
    {
      title: '4. Responsabilidades del Conductor',
      text: '• Contar con licencia de conducir vigente\n• Mantener el vehículo en condiciones seguras\n• Contar con seguro vehicular válido\n• Cumplir con los horarios acordados\n• Respetar el número de pasajeros acordado',
    },
    {
      title: '5. Responsabilidades del Pasajero',
      text: '• Estar puntual en el punto de encuentro\n• Pagar la tarifa acordada\n• Respetar al conductor y otros pasajeros\n• No llevar objetos prohibidos o peligrosos\n• Seguir las indicaciones del conductor',
    },
    {
      title: '6. Pagos y Cancelaciones',
      text: 'Los pagos deben realizarse según lo acordado entre conductor y pasajero. Las cancelaciones deben hacerse con anticipación razonable. Consultá nuestra política de cancelación para más detalles.',
    },
    {
      title: '7. Limitación de Responsabilidad',
      text: 'La plataforma no se hace responsable por:\n• Daños o pérdidas durante el viaje\n• Accidentes o incidentes de tráfico\n• Comportamiento de los usuarios\n• Disputas entre usuarios',
    },
    {
      title: '8. Privacidad y Datos Personales',
      text: 'Nos comprometemos a proteger tu privacidad. Consultá nuestra Política de Privacidad para conocer cómo recopilamos, usamos y protegemos tu información personal.',
    },
    {
      title: '9. Modificaciones',
      text: 'Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán efectivos inmediatamente después de su publicación en la aplicación.',
    },
    {
      title: '10. Contacto',
      text: 'Si tenés preguntas sobre estos términos, contactanos a través de la sección de Ayuda en la aplicación.',
    },
  ];

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        <View style={[styles.card, { backgroundColor: cardBg }]}>
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
  scroll: { padding: 24, paddingBottom: 40 },

  header: {
    marginBottom: 12,
    marginLeft: 4,
  },
  date: {
    fontSize: 13,
  },

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
    fontFamily: 'Sora_600SemiBold',
  },
  sectionText: {
    fontSize: 13,
    lineHeight: 20,
  },
});

export default TermsScreen;
