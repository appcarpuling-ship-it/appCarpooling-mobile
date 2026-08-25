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
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, delete_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useUI } from '../../../theme/ui';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import EmptyState from '../../../components/ui/EmptyState';
import { reportError } from '../../../utils/sentry';

const BlockedUsersScreen = () => {
  const ui = useUI();
  const navigation = useNavigation();
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
    } catch (error) {
      reportError(error, { screen: 'BlockedUsersScreen', action: 'load' });
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
    navigation.navigate('Confirm', {
      title: 'Desbloquear',
      message: `¿Querés desbloquear a ${item.firstName} ${item.lastName}?`,
      confirmLabel: 'Desbloquear',
      onConfirm: () => runUnblock(item),
      successParams: { title: 'Listo', message: 'Usuario desbloqueado.' },
      errorParams: { title: 'Error' },
    });
  };

  const runUnblock = async (item) => {
    setUnlockingId(item._id);
    try {
      await delete_withauth(ENDPOINTS.UNBLOCK_USER(item._id));
      await refreshUser();
      setBlocked((prev) => prev.filter((u) => u._id !== item._id));
    } finally {
      setUnlockingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const bg = ui.bg;
  const cardBg = ui.surface;

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: bg }]}>
        <ActivityIndicator size="large" color={ui.text} />
      </View>
    );
  }

  return (
    <FlatList
      data={blocked}
      keyExtractor={(item) => item._id}
      contentContainerStyle={[styles.list, blocked.length === 0 && styles.center, { backgroundColor: bg }]}
      style={{ backgroundColor: bg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ui.textMuted} />}
      ListEmptyComponent={
        <View style={styles.emptyWrap}>
          <EmptyState
            image={require('../../../../assets/icons/pngwing.com (20).png')}
            title="No tenés usuarios bloqueados"
          />
        </View>
      }
      renderItem={({ item }) => {
        const avatarUrl = item.avatar ? buildImageUri(item.avatar) : null;
        const isUnlocking = unlockingId === item._id;
        return (
          <View style={[styles.row, { backgroundColor: cardBg }]}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: ui.bg }]}>
                <Text style={[styles.initials, { color: ui.textMuted }]}>
                  {item.firstName?.[0]}{item.lastName?.[0]}
                </Text>
              </View>
            )}
            <Text style={[styles.name, { color: ui.text }]}>
              {item.firstName} {item.lastName}
            </Text>
            <TouchableOpacity
              style={[styles.unblockBtn, { backgroundColor: ui.invertBg }]}
              onPress={() => confirmUnblock(item)}
              disabled={isUnlocking}
              activeOpacity={0.7}
            >
              {isUnlocking ? (
                <ActivityIndicator size="small" color={ui.invertText} />
              ) : (
                <Text style={[styles.unblockText, { color: ui.invertText }]}>Desbloquear</Text>
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
  list:             { padding: 24, gap: 12 },
  emptyWrap:        { alignItems: 'center', gap: 12, marginTop: 40 },
  emptyText:        { fontFamily: 'Sora_400Regular', fontSize: 15, textAlign: 'center' },
  row:              { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 24 },
  avatar:           { width: 44, height: 44, borderRadius: 999 },
  avatarPlaceholder:{ width: 44, height: 44, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  initials:         { fontFamily: 'Sora_600SemiBold', fontSize: 16 },
  name:             { flex: 1, fontFamily: 'Sora_600SemiBold', fontSize: 15 },
  unblockBtn:       { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  unblockText:      { fontFamily: 'Sora_600SemiBold', fontSize: 13 },
});

export default BlockedUsersScreen;
