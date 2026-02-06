import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../theme/colors';
import { useColors } from '../../hooks/useColors';

const TermsScreen = () => {
  const { colors } = useColors();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Términos y Condiciones</Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>Última actualización: 1 de Octubre, 2025</Text>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>1. Aceptación de los Términos</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Al acceder y utilizar esta aplicación de carpuling, aceptas estar sujeto a estos
              términos y condiciones de uso. Si no estás de acuerdo con alguna parte de estos
              términos, no debes usar nuestra aplicación.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>2. Descripción del Servicio</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Nuestra plataforma conecta a conductores con pasajeros que comparten rutas similares,
              permitiendo compartir los gastos del viaje. No somos una empresa de transporte, sino
              una plataforma tecnológica que facilita estas conexiones.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>3. Responsabilidades del Usuario</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              • Proporcionar información veraz y actualizada{'\n'}
              • Mantener la seguridad de tu cuenta{'\n'}
              • Cumplir con todas las leyes de tránsito aplicables{'\n'}
              • Respetar a otros usuarios de la plataforma{'\n'}
              • No usar la plataforma para actividades ilegales
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>4. Responsabilidades del Conductor</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              • Contar con licencia de conducir vigente{'\n'}
              • Mantener el vehículo en condiciones seguras{'\n'}
              • Contar con seguro vehicular válido{'\n'}
              • Cumplir con los horarios acordados{'\n'}
              • Respetar el número de pasajeros acordado
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>5. Responsabilidades del Pasajero</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              • Estar puntual en el punto de encuentro{'\n'}
              • Pagar la tarifa acordada{'\n'}
              • Respetar al conductor y otros pasajeros{'\n'}
              • No llevar objetos prohibidos o peligrosos{'\n'}
              • Seguir las indicaciones del conductor
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>6. Pagos y Cancelaciones</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Los pagos deben realizarse según lo acordado entre conductor y pasajero. Las
              cancelaciones deben hacerse con anticipación razonable. Consulta nuestra política
              de cancelación para más detalles.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>7. Limitación de Responsabilidad</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              La plataforma no se hace responsable por:{'\n'}
              • Daños o pérdidas durante el viaje{'\n'}
              • Accidentes o incidentes de tráfico{'\n'}
              • Comportamiento de los usuarios{'\n'}
              • Disputas entre usuarios
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>8. Privacidad y Datos Personales</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Nos comprometemos a proteger tu privacidad. Consulta nuestra Política de Privacidad
              para conocer cómo recopilamos, usamos y protegemos tu información personal.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>9. Modificaciones</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Nos reservamos el derecho de modificar estos términos en cualquier momento. Los
              cambios serán efectivos inmediatamente después de su publicación en la aplicación.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>10. Contacto</Text>
            <Text style={[styles.text, { color: colors.textSecondary }]}>
              Si tienes preguntas sobre estos términos, contáctanos a través de la sección de
              Ayuda en la aplicación.
            </Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    marginBottom: spacing.sm,
  },
  date: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semiBold,
    marginBottom: spacing.md,
  },
  text: {
    fontSize: fontSize.md,
    lineHeight: 24,
  },
});

export default TermsScreen;