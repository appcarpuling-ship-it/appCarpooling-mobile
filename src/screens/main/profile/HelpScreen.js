import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUI } from '../../../theme/ui';
import { HELP_GUIDE_CATALOG } from '../../../content/helpGuideContent';
import GuidedHelpOverlay from '../../../components/help/GuidedHelpOverlay';
import { get_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';

const HelpScreen = () => {
  const ui = useUI();
  const [guidedTourId, setGuidedTourId] = useState(null);

  const bg = ui.bg;
  const cardBg = ui.surface;
  const textPrimary = ui.text;
  const textMuted = ui.textMuted;
  const textLabel = ui.text;
  const textHint = ui.textMuted;
  const divider = ui.bg; // separa las filas dentro de la card gris

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
    {
      id: 9,
      question: '¿Qué son las solicitudes de viaje?',
      answer: 'Si no encontrás un viaje publicado, podés crear una solicitud indicando a dónde querés ir. Los conductores se postulan (hasta 5), vos elegís uno y, al completar el pago, el viaje queda confirmado en "Mis reservas". Las gestionás desde la pestaña "Solicitudes" del inicio.',
    },
    {
      id: 10,
      question: '¿Cómo me postulo a una solicitud como conductor?',
      answer: 'Entrá a la pestaña "Solicitudes" → "Ver solicitudes abiertas", abrí un pedido de un pasajero y tocá "Ofrecer viaje" con tu vehículo (necesitás tener uno cargado). Si el pasajero te elige y paga, el viaje se crea automáticamente y aparece en tu agenda.',
    },
  ];

  /**
   * El contacto sale del server, no del código.
   *
   * Estaba escrito acá adentro, y el teléfono era `+1234567890` —un ejemplo—. Los parámetros
   * `supportEmail` y `supportWhatsapp` ya existían y son editables por un admin; sólo faltaba
   * que esta pantalla los leyera. Cambiar el número deja de necesitar un OTA.
   */
  const [soporte, setSoporte] = useState({ supportEmail: null, supportWhatsapp: null });

  useEffect(() => {
    let cancelado = false;
    get_withauth(ENDPOINTS.SOPORTE)
      .then((res) => {
        if (!cancelado && res?.success) setSoporte(res.data || {});
      })
      .catch(() => {}); // sin red se muestra sólo lo que haya
    return () => { cancelado = true; };
  }, []);

  // Sin dato configurado no se muestra la fila: es peor una vía de contacto que no existe.
  const contactItems = [
    soporte.supportEmail && {
      id: 1,
      icon: 'mail-outline',
      title: 'Email',
      subtitle: soporte.supportEmail,
      onPress: () => Linking.openURL(`mailto:${soporte.supportEmail}`),
    },
    soporte.supportWhatsapp && {
      id: 2,
      icon: 'logo-whatsapp',
      title: 'WhatsApp',
      subtitle: `+${soporte.supportWhatsapp}`,
      onPress: () => Linking.openURL(`https://wa.me/${soporte.supportWhatsapp}`),
    },
  ].filter(Boolean);

  return (
    <View style={[styles.screen, { backgroundColor: bg }]}>
      <GuidedHelpOverlay
        visible={!!guidedTourId}
        guideId={guidedTourId}
        onClose={() => setGuidedTourId(null)}
      />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Guías interactivas */}
        <Text style={[styles.sectionLabel, { color: textLabel }]}>Guías paso a paso</Text>
        <Text style={[styles.guideIntro, { color: textHint }]}>
          Elegí un tema. Te llevamos a la pantalla correcta en la app y te explicamos cada paso con calma. Podés cerrar cuando quieras con «Cerrar» arriba a la derecha.
        </Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: ui.border }]}>
          {HELP_GUIDE_CATALOG.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.guideRow,
                index < HELP_GUIDE_CATALOG.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: divider,
                },
              ]}
              onPress={() => setGuidedTourId(item.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.guideIconBox, { backgroundColor: divider }]}>
                <Ionicons name={item.listIcon} size={22} color={textPrimary} />
              </View>
              <View style={styles.guideTextCol}>
                <Text style={[styles.guideTitle, { color: textPrimary }]}>{item.listTitle}</Text>
                <Text style={[styles.guideSubtitle, { color: textMuted }]}>{item.listSubtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={textMuted} />
            </TouchableOpacity>
          ))}
        </View>

        {/* FAQ */}
        <Text style={[styles.sectionLabel, styles.sectionLabelSpaced, { color: textLabel }]}>Preguntas frecuentes</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: ui.border }]}>
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
        <Text style={[styles.sectionLabel, { color: textLabel, marginTop: 8 }]}>Contacto</Text>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: ui.border }]}>
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
  screen: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 40 },

  sectionLabel: {
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
    letterSpacing: 0.2,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionLabelSpaced: {
    marginTop: 20,
  },
  guideIntro: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
    marginLeft: 4,
    marginRight: 4,
  },
  guideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  guideIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  guideTextCol: { flex: 1 },
  guideTitle: { fontFamily: 'Sora_600SemiBold', fontSize: 16 },
  guideSubtitle: { fontFamily: 'Sora_400Regular', fontSize: 13, marginTop: 3, lineHeight: 18 },
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
    fontSize: 15,
    fontFamily: 'Sora_700Bold',
    lineHeight: 22,
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
  contactTitle: { fontFamily: 'Sora_600SemiBold', fontSize: 16 },
  contactSub: {
    fontSize: 13,
    marginTop: 2,
  },
});

export default HelpScreen;
