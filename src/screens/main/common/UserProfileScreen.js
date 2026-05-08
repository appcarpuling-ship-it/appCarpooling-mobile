import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, post_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useColors } from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';

const UserProfileScreen = ({ route, navigation }) => {
  const { userId } = route.params;
  const { colors, isDarkMode } = useColors();
  const { user } = useAuth();
  const { showAlert } = useAlert();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    try {
      const response = await get_withauth(ENDPOINTS.GET_USER(userId));
      if (response.success) {
        setProfile(response.data);
      }
    } catch (_) {
      showAlert('Error', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleStartChat = async (tripId) => {
    setChatLoading(true);
    try {
      const response = await post_withauth('/chat/conversation', {
        participantId: userId,
        ...(tripId ? { tripId } : {}),
      });
      if (response.success) {
        navigation.navigate('ChatsTab', {
          screen: 'ChatDetail',
          params: {
            conversation: response.data,
            otherUser: response.data.participants?.find(p => p._id !== (user?._id || user?.id)),
          },
        });
      }
    } catch (_) {
      showAlert('Error', 'No se pudo iniciar el chat');
    } finally {
      setChatLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Ionicons name="person-outline" size={48} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Usuario no disponible</Text>
      </View>
    );
  }

  const avatarUrl = profile.avatar ? buildImageUri(profile.avatar) : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      {/* Avatar y nombre */}
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#292929' : colors.surface }]}>
            <Text style={[styles.avatarInitials, { color: colors.textPrimary }]}>
              {profile.firstName?.[0]}{profile.lastName?.[0]}
            </Text>
          </View>
        )}
        <Text style={[styles.name, { color: colors.textPrimary }]}>
          {profile.firstName} {profile.lastName}
        </Text>
        {(profile.city || profile.province) && (
          <View style={styles.locationRow}>
            <Ionicons name="location-outline" size={15} color={colors.textMuted} />
            <Text style={[styles.location, { color: colors.textSecondary }]}>
              {[profile.city, profile.province].filter(Boolean).join(', ')}
            </Text>
          </View>
        )}
      </View>

      {/* Botón chat */}
      <TouchableOpacity
        style={[styles.chatButton, { backgroundColor: isDarkMode ? '#FFFFFF' : '#000000' }]}
        onPress={() => handleStartChat(route.params?.tripId)}
        disabled={chatLoading}
      >
        {chatLoading ? (
          <ActivityIndicator size="small" color={isDarkMode ? '#000000' : '#FFFFFF'} />
        ) : (
          <>
            <Ionicons name="chatbubble-outline" size={20} color={isDarkMode ? '#000000' : '#FFFFFF'} />
            <Text style={[styles.chatButtonText, { color: isDarkMode ? '#000000' : '#FFFFFF' }]}>
              Enviar mensaje
            </Text>
          </>
        )}
      </TouchableOpacity>

      {/* Info */}
      {profile.bio ? (
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#292929' : colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Sobre mí</Text>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {profile.memberSince || profile.createdAt ? (
        <View style={[styles.card, { backgroundColor: isDarkMode ? '#292929' : colors.cardBackground, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Miembro desde</Text>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
            {new Date(profile.memberSince || profile.createdAt).toLocaleDateString('es-ES', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 28 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  avatarPlaceholder: {
    width: 100, height: 100, borderRadius: 50,
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarInitials: { fontSize: 36, fontWeight: '700' },
  name: { fontSize: 24, fontWeight: '700', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 14 },
  chatButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 12, marginBottom: 24,
  },
  chatButtonText: { fontSize: 16, fontWeight: '600' },
  card: {
    borderRadius: 12, borderWidth: 1,
    padding: 16, marginBottom: 12,
  },
  cardLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  cardValue: { fontSize: 15 },
});

export default UserProfileScreen;
