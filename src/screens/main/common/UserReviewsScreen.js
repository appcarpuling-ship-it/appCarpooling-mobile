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
import { Ionicons } from '@expo/vector-icons';
import { get_public } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';

const UserReviewsScreen = ({ route, navigation }) => {
  const { userId, userName } = route.params || {};
  const { showAlert } = useAlert();
  const ui = useUI();
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
        Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 600, useNativeDriver: true }),
      ]).start();
    }
  }, [loading]);

  const loadReviews = async () => {
    try {
      const params = filterType !== 'all' ? { type: filterType } : {};
      const response = await get_public(ENDPOINTS.GET_USER_REVIEWS(userId), params);

      if (response.success) {
        // La respuesta es { success, count, stats, data: [reviews] }: `data` ES el array.
        // Leerlo como data.reviews/data.stats daba undefined y dejaba la pantalla vacia
        // con los contadores en cero.
        setReviews(response.data || []);
        setStats(response.stats || {
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
    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const renderStars = (rating) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={16}
          color={i <= rating ? ui.text : ui.textMuted}
        />
      );
    }
    return stars;
  };

  const renderFilterButton = (type, label, icon) => {
    const isActive = filterType === type;
    return (
      <TouchableOpacity
        key={type}
        onPress={() => setFilterType(type)}
        style={[styles.filterButton, { backgroundColor: isActive ? ui.invertBg : ui.surface }]}
        activeOpacity={0.7}
      >
        <Ionicons name={icon} size={16} color={isActive ? ui.invertText : ui.textMuted} />
        <Text style={[styles.filterButtonText, { color: isActive ? ui.invertText : ui.textMuted }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderReviewCard = (review) => (
    <View key={review._id} style={[styles.reviewCard, { backgroundColor: ui.surface, opacity: loading ? 0 : 1 }]}>
      <View style={styles.reviewHeader}>
        <View style={[styles.reviewerAvatar, { backgroundColor: ui.invertBg }]}>
          <Text style={[styles.reviewerAvatarText, { color: ui.invertText }]}>
            {review.reviewer.firstName?.[0]}{review.reviewer.lastName?.[0]}
          </Text>
        </View>
        <View style={styles.reviewerInfo}>
          <Text style={[styles.reviewerName, { color: ui.text }]}>
            {review.reviewer.firstName} {review.reviewer.lastName}
          </Text>
          <View style={styles.reviewMeta}>
            <View style={styles.starsContainer}>{renderStars(review.rating)}</View>
            <Text style={[styles.reviewDate, { color: ui.textMuted }]}>{formatDate(review.createdAt)}</Text>
          </View>
        </View>
        <View style={[styles.reviewTypeBadge, { backgroundColor: ui.bg }]}>
          <Ionicons
            name={review.type === 'driver' ? 'car-outline' : 'person-outline'}
            size={12}
            color={ui.textMuted}
          />
          <Text style={[styles.reviewTypeText, { color: ui.textMuted }]}>
            {review.type === 'driver' ? 'Conductor' : 'Pasajero'}
          </Text>
        </View>
      </View>

      <Text style={[styles.reviewComment, { color: ui.text }]}>{review.comment}</Text>

      {review.trip && (
        <View style={styles.tripInfo}>
          <Ionicons name="location-outline" size={14} color={ui.textMuted} />
          <Text style={[styles.tripText, { color: ui.textMuted }]} numberOfLines={1}>
            {review.trip.origin?.city} → {review.trip.destination?.city}
          </Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: ui.bg }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={ui.invertBg} />
          <Text style={[styles.loadingText, { color: ui.textMuted }]}>Cargando reseñas...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: ui.bg }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: ui.text }]}>
            Reseñas de{'\n'}
            <Text style={styles.titleStrong}>{userName}</Text>
          </Text>

          <View style={[styles.statsContainer, { backgroundColor: ui.surface }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: ui.text }]}>{stats.averageRating?.toFixed(1) || '0.0'}</Text>
              <Text style={[styles.statLabel, { color: ui.textMuted }]}>Promedio</Text>
              <View style={styles.statsStars}>{renderStars(Math.round(stats.averageRating || 0))}</View>
            </View>
            <View style={[styles.statDivider, { backgroundColor: ui.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: ui.text }]}>{stats.totalReviews || 0}</Text>
              <Text style={[styles.statLabel, { color: ui.textMuted }]}>Reseñas</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: ui.border }]} />
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: ui.text }]}>{stats.driverReviews || 0}</Text>
              <Text style={[styles.statLabel, { color: ui.textMuted }]}>Conductor</Text>
            </View>
          </View>
        </View>

        <View style={styles.filtersContainer}>
          {renderFilterButton('all', 'Todas', 'list-outline')}
          {renderFilterButton('driver', 'Conductor', 'car-outline')}
          {renderFilterButton('passenger', 'Pasajero', 'person-outline')}
        </View>

        <ScrollView
          style={styles.reviewsList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={ui.invertBg}
              colors={[ui.invertBg]}
            />
          }
        >
          {reviews.length > 0 ? (
            reviews.map((review) => renderReviewCard(review))
          ) : (
            <View style={styles.emptyContainer}>
              <Ionicons name="star-outline" size={64} color={ui.textMuted} />
              <Text style={[styles.emptyTitle, { color: ui.text }]}>Sin reseñas</Text>
              <Text style={[styles.emptySubtitle, { color: ui.textMuted }]}>
                {filterType === 'all'
                  ? 'Este usuario aún no tiene reseñas'
                  : `No hay reseñas como ${filterType === 'driver' ? 'conductor' : 'pasajero'}`}
              </Text>
            </View>
          )}
        </ScrollView>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { fontSize: 15, fontFamily: 'Sora_500Medium', marginTop: 12 },

  header: { paddingTop: 24, marginBottom: 20 },
  title: { fontFamily: 'Sora_300Light', fontSize: 30, lineHeight: 38, letterSpacing: -1, marginBottom: 20 },
  titleStrong: { fontFamily: 'Sora_800ExtraBold' },

  statsContainer: {
    flexDirection: 'row',
    padding: 18,
    borderRadius: 24,
    alignItems: 'center',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 20, fontFamily: 'Sora_700Bold', marginBottom: 4 },
  statLabel: { fontSize: 12, fontFamily: 'Sora_500Medium', marginBottom: 6 },
  statsStars: { flexDirection: 'row', gap: 2 },
  statDivider: { width: 1, height: 40, marginHorizontal: 12 },

  filtersContainer: { flexDirection: 'row', marginBottom: 18, gap: 8 },
  filterButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 11,
    paddingHorizontal: 8,
  },
  filterButtonText: { fontSize: 13, fontFamily: 'Sora_600SemiBold' },

  reviewsList: { flex: 1 },
  reviewCard: { padding: 18, borderRadius: 24, marginBottom: 12 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  reviewerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  reviewerAvatarText: { fontSize: 14, fontFamily: 'Sora_700Bold' },
  reviewerInfo: { flex: 1 },
  reviewerName: { fontSize: 15, fontFamily: 'Sora_600SemiBold', marginBottom: 4 },
  reviewMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  starsContainer: { flexDirection: 'row', gap: 1 },
  reviewDate: { fontSize: 11 },
  reviewTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    gap: 4,
    marginLeft: 8,
  },
  reviewTypeText: { fontSize: 11, fontFamily: 'Sora_500Medium' },
  reviewComment: { fontSize: 14, lineHeight: 21, fontFamily: 'Sora_400Regular', marginBottom: 10 },
  tripInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripText: { fontSize: 12, flex: 1 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 64 },
  emptyTitle: { fontSize: 17, fontFamily: 'Sora_600SemiBold', marginTop: 16, marginBottom: 6 },
  emptySubtitle: { fontSize: 14, fontFamily: 'Sora_400Regular', textAlign: 'center' },
});

export default UserReviewsScreen;
