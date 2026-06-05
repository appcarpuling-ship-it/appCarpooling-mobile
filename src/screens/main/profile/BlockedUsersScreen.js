import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, delete_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useColors } from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';

const BlockedUsersScreen = () => {
  const { colors, isDarkMode } = useColors();
  const { refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const [blocked, setBlocked] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unlockingId, setUnlockingId] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await get_withauth(ENDPOINTS.GET_BLOCKED_USERS);
      if (res.success) setBlocked(res.data);
    } catch (_) {
      showAlert('Error', 'No se pudo cargar la lista de bloqueados.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAlert]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    load();
  }, [load]));

  const confirmUnblock = (item) => {
    showAlert(
      'Desbloquear',
      `¿Querés desbloquear a ${item.firstName} ${item.lastName}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Desbloquear', onPress: () => runUnblock(item) },
      ]
    );
  };

  const runUnblock = async (item) => {
    setUnlockingId(item._id);
    try {
      await delete_withauth(ENDPOINTS.UNBLOCK_USER(item._id));
      await refreshUser();
      setBlocked((prev) => prev.filter((u) => u._id !== item._id));
    } catch (e) {
      const msg = e?.response?.data?.message || 'No se pudo desbloquear';
      showAlert('Error', msg);
    } finally {
      setUnlockingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const bg = colors.background;
  const cardBg = isDarkMode ? '#292929' : colors.cardBackground;
  const border = colors.border;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={colors.textPrimary} />
      </View>
    );
  }

  return (
    <FlatList
      data={blocked}
      keyExtractor={(item) => item._id}
      contentContainerStyle={[styles.list, blocked.length === 0 && styles.center, { backgroundColor: bg }]}
      style={{ backgroundColor: bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.textMuted} />}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <Ionicons name="shield-checkmark-outline" size={52} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No tenés usuarios bloqueados</Text>
        </View>
      }
      renderItem={({ item }) => {
        const avatarUrl = item.avatar ? buildImageUri(item.avatar) : null;
        const isUnlocking = unlockingId === item._id;
        return (
          <View style={[styles.row, { backgroundColor: cardBg, borderColor: border }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#3A3A3A' : '#E8E8E8' }]}>
                <Text style={[styles.initials, { color: colors.textMuted }]}>
                  {item.firstName?.[0]}{item.lastName?.[0]}
                </Text>
              </View>
            )}
            <Text style={[styles.name, { color: colors.textPrimary }]}>
              {item.firstName} {item.lastName}
            </Text>
            <TouchableOpacity
              style={[styles.unblockBtn, { borderColor: colors.accent || '#3B82F6' }]}
              onPress={() => confirmUnblock(item)}
              disabled={isUnlocking}
              activeOpacity={0.7}
            >
              {isUnlocking ? (
                <ActivityIndicator size="small" color={colors.accent || '#3B82F6'} />
              ) : (
                <Text style={[styles.unblockText, { color: colors.accent || '#3B82F6' }]}>Desbloquear</Text>
              )}
            </TouchableOpacity>
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  center:           { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list:             { padding: 16, gap: 10 },
  emptyWrap:        { alignItems: 'center', gap: 12, marginTop: 40 },
  emptyText:        { fontSize: 15, textAlign: 'center' },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 12, borderWidth: 1 },
  avatar:           { width: 44, height: 44, borderRadius: 22 },
  avatarPlaceholder:{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  initials:         { fontSize: 16, fontWeight: '600' },
  name:             { flex: 1, fontSize: 15, fontWeight: '500' },
  unblockBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  unblockText:      { fontSize: 13, fontWeight: '600' },
});

export default BlockedUsersScreen;
