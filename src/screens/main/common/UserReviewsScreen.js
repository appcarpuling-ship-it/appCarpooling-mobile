import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Animated,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { get_public } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { spacing, borderRadius, fontSize, fontWeight } from '../../../theme/colors';
import { useColors } from '../../../hooks/useColors';
import { useAlert } from '../../../context/AlertContext';

const UserReviewsScreen = ({ route, navigation }) => {
  const { userId, userName } = route.params || {};
  const { showAlert } = useAlert();
  const { colors, createColorArray } = useColors();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState('all'); // 'all', 'driver', 'passenger'
  const [stats, setStats] = useState({
    totalReviews: 0,
    averageRating: 0,
    driverReviews: 0,
    passengerReviews: 0,
  });

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    loadReviews();
  }, [filterType]);

  useEffect(() => {
    if (!loading) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [loading]);

  const loadReviews = async () => {
    try {
      const params = filterType !== 'all' ? { type: filterType } : {};
      const response = await get_public(ENDPOINTS.GET_USER_REVIEWS(userId), params);

      if (response.success) {
        setReviews(response.data.reviews || []);
        setStats(response.data.stats || {
          totalReviews: 0,
          averageRating: 0,
          driverReviews: 0,
          passengerReviews: 0,
        });
      }
    } catch (error) {
      showAlert('Ocurrió algo', 'No se pudieron cargar las reseñas');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadReviews();
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color={i <= rating ? '#FFB800' : colors.textTertiary}
        />
      );
    }
    return stars;
  };

  const renderFilterButton = (type, label, icon) => {
    const isActive = filterType === type;
    return (
      <TouchableOpacity
        onPress={() => setFilterType(type)}
        style={[styles.filterButton, isActive && styles.filterButtonActive]}
        activeOpacity={0.7}
      >
        <LinearGradient
          colors={isActive ? ['#1F2937', '#111827'] : ['transparent', 'transparent']}
          style={styles.filterGradient}
        >
          <Ionicons
            name={icon}
            size={18}
            color={isActive ? '#FFF' : colors.textSecondary}
          />
          <Text style={[
            styles.filterButtonText,
            { color: isActive ? '#FFF' : colors.textSecondary }
          ]}>
            {label}
          </Text>
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderReviewCard = (review, index) => {
    return (
      <LinearGradient
        key={review._id}
        colors={createColorArray(colors.surfaceElevated, colors.surface)}
        style={[styles.reviewCard, { opacity: loading ? 0 : 1 }]}
      >
        {/* Review Header */}
        <View style={styles.reviewHeader}>
          <LinearGradient
            colors={['#1F2937', '#111827']}
            style={styles.reviewerAvatar}
          >
            <Text style={styles.reviewerAvatarText}>
              {review.reviewer.firstName?.[0]}{review.reviewer.lastName?.[0]}
            </Text>
          </LinearGradient>
          <View style={styles.reviewerInfo}>
            <Text style={styles.reviewerName}>
              {review.reviewer.firstName} {review.reviewer.lastName}
            </Text>
            <View style={styles.reviewMeta}>
              <View style={styles.starsContainer}>
                {renderStars(review.rating)}
              </View>
              <Text style={styles.reviewDate}>{formatDate(review.createdAt)}</Text>
            </View>
          </View>
          <View style={styles.reviewTypeContainer}>
            <LinearGradient
              colors={review.type === 'driver' ? ['#10B981', '#059669'] : ['#F59E0B', '#D97706']}
              style={styles.reviewTypeBadge}
            >
              <Ionicons
                name={review.type === 'driver' ? 'car-outline' : 'person-outline'}
                size={12}
                color="#FFF"
              />
              <Text style={styles.reviewTypeText}>
                {review.type === 'driver' ? 'Conductor' : 'Pasajero'}
              </Text>
            </LinearGradient>
          </View>
        </View>

        {/* Review Comment */}
        <Text style={styles.reviewComment}>{review.comment}</Text>

        {/* Trip Info */}
        {review.trip && (
          <View style={styles.tripInfo}>
            <Ionicons name="location-outline" size={14} color={colors.textTertiary} />
            <Text style={styles.tripText} numberOfLines={1}>
              {review.trip.origin?.city} → {review.trip.destination?.city}
            </Text>
          </View>
        )}
      </LinearGradient>
    );
  };

  if (loading) {
    return (
      <LinearGradient colors={createColorArray(colors.background, colors.surface)} style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Cargando reseñas...</Text>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={['#F8F9FA', '#E5E7EB']} style={styles.container}>
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
          <Text style={styles.title}>Reseñas de {userName}</Text>

          {/* Stats */}
          <LinearGradient
            colors={createColorArray(colors.surfaceElevated, colors.surface)}
            style={styles.statsContainer}
          >
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.averageRating?.toFixed(1) || '0.0'}</Text>
              <Text style={styles.statLabel}>Promedio</Text>
              <View style={styles.statsStars}>
                {renderStars(Math.round(stats.averageRating || 0))}
              </View>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.totalReviews || 0}</Text>
              <Text style={styles.statLabel}>Reseñas</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.driverReviews || 0}</Text>
              <Text style={styles.statLabel}>Conductor</Text>
            </View>
          </LinearGradient>
        </View>

        {/* Filters */}
        <View style={styles.filtersContainer}>
          {renderFilterButton('all', 'Todas', 'list-outline')}
          {renderFilterButton('driver', 'Conductor', 'car-outline')}
          {renderFilterButton('passenger', 'Pasajero', 'person-outline')}
        </View>

        {/* Reviews List */}
        <ScrollView
          style={styles.reviewsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={createColorArray(colors.primary)}
            />
          }
        >
          {reviews.length > 0 ? (
            reviews.map((review, index) => renderReviewCard(review, index))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color={colors.textTertiary} />
              <Text style={styles.emptyTitle}>Sin reseñas</Text>
              <Text style={styles.emptySubtitle}>
                {filterType === 'all'
                  ? 'Este usuario aún no tiene reseñas'
                  : `No hay reseñas como ${filterType === 'driver' ? 'conductor' : 'pasajero'}`
                }
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: spacing.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: fontSize.md,
    marginTop: spacing.md,
  },
  header: {
    paddingTop: spacing.xl,
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: fontSize.sm,
    color: '#6B7280',
    marginBottom: spacing.xs,
  },
  statsStars: {
    flexDirection: 'row',
    gap: 2,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: '#E5E7EB',
    marginHorizontal: spacing.md,
  },
  filtersContainer: {
    flexDirection: 'row',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  filterButton: {
    flex: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  filterButtonActive: {
    borderColor: 'transparent',
  },
  filterGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  filterButtonText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  reviewsList: {
    flex: 1,
  },
  reviewCard: {
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.md,
  },
  reviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  reviewerAvatarText: {
    color: '#FFF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  reviewerInfo: {
    flex: 1,
  },
  reviewerName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: '#000000',
    marginBottom: spacing.xs,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewDate: {
    fontSize: fontSize.xs,
    color: '#9CA3AF',
  },
  reviewTypeContainer: {
    marginLeft: spacing.sm,
  },
  reviewTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  reviewTypeText: {
    fontSize: fontSize.xs,
    color: '#FFF',
    fontWeight: fontWeight.medium,
  },
  reviewComment: {
    fontSize: fontSize.md,
    color: '#6B7280',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  tripInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tripText: {
    fontSize: fontSize.sm,
    color: '#9CA3AF',
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: '#6B7280',
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: fontSize.md,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});

export default UserReviewsScreen;