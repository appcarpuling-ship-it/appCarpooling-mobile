import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { post_withauth } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { colors as staticColors, spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import useColors from '../../../hooks/useColors';

const CreateReviewScreen = ({ route, navigation }) => {
  const { showAlert } = useAlert();
  const { colors, gradients, createColorArray } = useColors();
  const { trip, reviewedUser, reviewType } = route.params || {};
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleStarPress = (selectedRating) => {
    setRating(selectedRating);
  };

  const handleSubmitReview = async () => {
    if (rating === 0) {
      showAlert('Error', 'Por favor selecciona una calificación');
      return;
    }

    if (comment.trim().length < 10) {
      showAlert('Error', 'Por favor escribe un comentario de al menos 10 caracteres');
      return;
    }

    setLoading(true);

    try {
      const reviewData = {
        trip: trip._id,
        reviewedUser: reviewedUser._id,
        rating: rating,
        comment: comment.trim(),
        type: reviewType, // 'driver' o 'passenger'
      };

      const response = await post_withauth(ENDPOINTS.CREATE_REVIEW, reviewData);

      if (response.success) {
        showAlert(
          'Reseña Enviada',
          'Tu reseña ha sido enviada exitosamente',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack()
            }
          ]
        );
      } else {
        showAlert('Error', response.message || 'Error al enviar la reseña');
      }
    } catch (error) {
      showAlert('Error', error.message || 'Error al enviar la reseña');
    } finally {
      setLoading(false);
    }
  };

  const renderStars = () => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <TouchableOpacity
          key={i}
          onPress={() => handleStarPress(i)}
          style={styles.starButton}
          activeOpacity={0.7}
        >
          <Ionicons
            name={i <= rating ? 'star' : 'star-outline'}
            size={40}
            color={i <= rating ? '#FFB800' : colors.textTertiary}
          />
        </TouchableOpacity>
      );
    }
    return stars;
  };

  const getRatingText = () => {
    switch (rating) {
      case 1: return 'Muy malo';
      case 2: return 'Malo';
      case 3: return 'Regular';
      case 4: return 'Bueno';
      case 5: return 'Excelente';
      default: return 'Selecciona una calificación';
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={createColorArray('#000000', '#0A0A0A', '#000000')}
        style={styles.gradient}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
              {/* Header */}
              <View style={styles.header}>
                <LinearGradient
                  colors={createColorArray('#6366F1', '#8B5CF6')}
                  style={styles.iconContainer}
                >
                  <Ionicons name="star-outline" size={32} color="#FFF" />
                </LinearGradient>
                <Text style={styles.title}>Calificar {reviewType === 'driver' ? 'Conductor' : 'Pasajero'}</Text>
                <Text style={styles.subtitle}>
                  ¿Cómo fue tu experiencia con {reviewedUser.firstName} {reviewedUser.lastName}?
                </Text>
              </View>

              {/* User Info */}
              <LinearGradient
                colors={createColorArray(colors.surfaceElevated, colors.surface)}
                style={styles.userCard}
              >
                <LinearGradient
                  colors={createColorArray('#6366F1', '#8B5CF6')}
                  style={styles.userAvatar}
                >
                  <Text style={styles.userAvatarText}>
                    {reviewedUser.firstName?.[0]}{reviewedUser.lastName?.[0]}
                  </Text>
                </LinearGradient>
                <View style={styles.userInfo}>
                  <Text style={styles.userName}>
                    {reviewedUser.firstName} {reviewedUser.lastName}
                  </Text>
                  <Text style={styles.userRole}>
                    {reviewType === 'driver' ? 'Conductor' : 'Pasajero'}
                  </Text>
                </View>
              </LinearGradient>

              {/* Rating Section */}
              <View style={styles.ratingSection}>
                <Text style={styles.sectionTitle}>Calificación</Text>
                <View style={styles.starsContainer}>
                  {renderStars()}
                </View>
                <Text style={styles.ratingText}>{getRatingText()}</Text>
              </View>

              {/* Comment Section */}
              <View style={styles.commentSection}>
                <Text style={styles.sectionTitle}>Comentario</Text>
                <Text style={styles.commentHelper}>
                  Comparte tu experiencia para ayudar a otros usuarios
                </Text>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Describe tu experiencia con este usuario..."
                    placeholderTextColor={colors.placeholder}
                    value={comment}
                    onChangeText={setComment}
                    multiline={true}
                    numberOfLines={4}
                    maxLength={500}
                  />
                </View>
                <Text style={styles.characterCount}>
                  {comment.length}/500 caracteres
                </Text>
              </View>

              {/* Submit Button */}
              <TouchableOpacity
                onPress={handleSubmitReview}
                disabled={loading || rating === 0 || comment.trim().length < 10}
                activeOpacity={0.8}
                style={[
                  styles.buttonContainer,
                  (loading || rating === 0 || comment.trim().length < 10) && styles.buttonDisabled
                ]}
              >
                <LinearGradient
                  colors={
                    loading || rating === 0 || comment.trim().length < 10
                      ? [colors.surfaceElevated, colors.surface]
                      : ['#6366F1', '#8B5CF6']
                  }
                  style={styles.button}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                      <Text style={styles.buttonText}>Enviar Reseña</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </LinearGradient>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  title: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: staticColors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: fontSize.md,
    color: staticColors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.xl,
  },
  userAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  userAvatarText: {
    color: '#FFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: staticColors.textPrimary,
    marginBottom: spacing.xs,
  },
  userRole: {
    fontSize: fontSize.md,
    color: staticColors.textSecondary,
  },
  ratingSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: staticColors.textPrimary,
    marginBottom: spacing.md,
  },
  starsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  starButton: {
    padding: spacing.sm,
  },
  ratingText: {
    fontSize: fontSize.md,
    color: staticColors.textSecondary,
    fontWeight: fontWeight.medium,
  },
  commentSection: {
    marginBottom: spacing.xl,
  },
  commentHelper: {
    fontSize: fontSize.sm,
    color: staticColors.textTertiary,
    marginBottom: spacing.md,
  },
  inputWrapper: {
    backgroundColor: staticColors.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: staticColors.border,
    padding: spacing.md,
  },
  commentInput: {
    fontSize: fontSize.md,
    color: staticColors.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: fontSize.sm,
    color: staticColors.textTertiary,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
  buttonContainer: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0.1,
    elevation: 2,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  buttonText: {
    color: '#FFF',
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
});

export default CreateReviewScreen;