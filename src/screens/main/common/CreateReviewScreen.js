import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { post_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import PillButton from '../../../components/ui/PillButton';
import { useUI } from '../../../theme/ui';

const CreateReviewScreen = ({ route, navigation }) => {
  const { showAlert } = useAlert();
  const ui = useUI();
  const { trip, reviewedUser, reviewType } = route.params || {};
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(false);
  const { user } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleStarPress = (selectedRating) => setRating(selectedRating);

  const handleSubmitReview = async () => {
    if (rating === 0) {
      showAlert('Ocurrió algo', 'Por favor selecciona una calificación');
      return;
    }

    if (comment.trim().length < 10) {
      showAlert('Ocurrió algo', 'Por favor escribe un comentario de al menos 10 caracteres');
      return;
    }

    setLoading(true);

    try {
      const reviewData = {
        trip: trip._id,
        reviewedUser: reviewedUser._id,
        rating,
        comment: comment.trim(),
        type: reviewType, // 'driver' o 'passenger'
      };

      const response = await post_withauth(ENDPOINTS.CREATE_REVIEW, reviewData);

      if (response.success) {
        navigation.navigate('Result', {
          type: 'success',
          title: 'Reseña Enviada',
          message: 'Tu reseña ha sido enviada exitosamente',
          onPrimary: () => { navigation.goBack(); navigation.goBack(); },
        });
      } else {
        showAlert('Ocurrió algo', response.message || 'Error al enviar la reseña');
      }
    } catch (error) {
      showAlert('Ocurrió algo', error.message || 'Error al enviar la reseña');
    } finally {
      setLoading(false);
    }
  };

  const getRatingText = () => {
    switch (rating) {
      case 1: return 'Muy malo';
      case 2: return 'Malo';
      case 3: return 'Regular';
      case 4: return 'Bueno';
      case 5: return 'Excelente';
      default: return 'Tocá una estrella';
    }
  };

  const canSubmit = !loading && rating > 0 && comment.trim().length >= 10;

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={styles.header}>
              <Text style={[styles.title, { color: ui.text }]}>
                Calificá{'\n'}
                <Text style={styles.titleStrong}>{reviewType === 'driver' ? 'al conductor' : 'al pasajero'}</Text>
              </Text>
              <Text style={[styles.subtitle, { color: ui.textMuted }]}>
                ¿Cómo fue tu experiencia con {reviewedUser.firstName} {reviewedUser.lastName}?
              </Text>
            </View>

            {/* Usuario */}
            <View style={styles.section}>
              <View style={[styles.userCard, { backgroundColor: ui.surface }]}>
                <View style={[styles.userAvatar, { backgroundColor: ui.invertBg }]}>
                  <Text style={[styles.userAvatarText, { color: ui.invertText }]}>
                    {reviewedUser.firstName?.[0]}{reviewedUser.lastName?.[0]}
                  </Text>
                </View>
                <View style={styles.userInfo}>
                  <Text style={[styles.userName, { color: ui.text }]}>
                    {reviewedUser.firstName} {reviewedUser.lastName}
                  </Text>
                  <Text style={[styles.userRole, { color: ui.textMuted }]}>
                    {reviewType === 'driver' ? 'Conductor' : 'Pasajero'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Calificación */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Calificación</Text>
              <View style={styles.starsContainer}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleStarPress(i)}
                    style={styles.starButton}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={i <= rating ? 'star' : 'star-outline'}
                      size={36}
                      color={i <= rating ? ui.text : ui.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.ratingText, { color: ui.textMuted }]}>{getRatingText()}</Text>
            </View>

            {/* Comentario */}
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: ui.textMuted }]}>Comentario</Text>
              <Text style={[styles.sectionHint, { color: ui.textMuted }]}>
                Compartí tu experiencia para ayudar a otros usuarios.
              </Text>
              <View
                style={[
                  styles.field,
                  { backgroundColor: ui.surface, borderColor: focused ? ui.text : 'transparent' },
                ]}
              >
                <TextInput
                  style={[styles.commentInput, { color: ui.text }]}
                  placeholder="Describí tu experiencia con este usuario..."
                  placeholderTextColor={ui.textMuted}
                  value={comment}
                  onChangeText={setComment}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  multiline
                  numberOfLines={4}
                  maxLength={500}
                  textAlignVertical="top"
                />
              </View>
              <Text style={[styles.characterCount, { color: ui.textMuted }]}>
                {comment.length}/500 caracteres
              </Text>
            </View>

            <PillButton
              label="Enviar reseña"
              onPress={handleSubmitReview}
              loading={loading}
              disabled={!canSubmit}
              style={styles.submit}
            />
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { paddingBottom: 48 },

  header: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 26 },
  title: { fontFamily: 'Sora_300Light', fontSize: 32, lineHeight: 40, letterSpacing: -1 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },
  subtitle: { fontFamily: 'Sora_400Regular', fontSize: 15, lineHeight: 22, marginTop: 12 },

  section: { paddingHorizontal: 24, marginBottom: 26 },
  sectionLabel: {
    fontFamily: 'Sora_600SemiBold',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginLeft: 4,
  },
  sectionHint: {
    fontFamily: 'Sora_400Regular',
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
    marginLeft: 4,
  },

  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 24,
  },
  userAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  userAvatarText: { fontSize: 18, fontFamily: 'Sora_700Bold' },
  userInfo: { flex: 1 },
  userName: { fontSize: 16, fontFamily: 'Sora_600SemiBold', marginBottom: 2 },
  userRole: { fontSize: 13, fontFamily: 'Sora_500Medium' },

  starsContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  starButton: { padding: 6 },
  ratingText: { fontSize: 14, fontFamily: 'Sora_500Medium', textAlign: 'center', marginTop: 6 },

  field: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  commentInput: {
    fontFamily: 'Sora_500Medium',
    fontSize: 15,
    minHeight: 100,
    padding: 0,
  },
  characterCount: { fontSize: 12, fontFamily: 'Sora_500Medium', textAlign: 'right', marginTop: 6 },

  submit: { marginHorizontal: 24, marginTop: 4 },
});

export default CreateReviewScreen;
