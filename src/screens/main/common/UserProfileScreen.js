import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { get_withauth, post_withauth, delete_withauth, buildImageUri } from '../../../services/apiService';
import { ENDPOINTS } from '../../../config/api';
import { useColors } from '../../../hooks/useColors';
import { useAuth } from '../../../context/AuthContext';
import { useAlert } from '../../../context/AlertContext';
import { useUI } from '../../../theme/ui';

const REPORT_REASONS = [
  { value: 'harassment', label: 'Acoso o amenazas' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'fraud', label: 'Estafa o fraude' },
  { value: 'inappropriate', label: 'Contenido inapropiado' },
  { value: 'identity', label: 'Suplantación de identidad' },
  { value: 'other', label: 'Otro (explicar abajo)' },
];

const UserProfileScreen = ({ route, navigation }) => {
  const ui = useUI();
  const { userId, tripId, conversationId, fromChat, openReport } = route.params || {};
  const { colors, isDarkMode } = useColors();
  const { user, refreshUser } = useAuth();
  const { showAlert } = useAlert();
  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chatLoading, setChatLoading] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReasonCode, setReportReasonCode] = useState(REPORT_REASONS[0].value);
  const [reportDetail, setReportDetail] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const selfId = user?._id || user?.id;
  const isSelf = selfId && userId && String(selfId) === String(userId);
  const isBlocked = (user?.blockedUserIds || []).includes(String(userId));

  const loadProfile = useCallback(async () => {
    try {
      const response = await get_withauth(ENDPOINTS.GET_USER(userId));
      if (response.success) {
        setProfile(response.data);
      }
    } catch (_) {
      showAlert('Ocurrió algo', 'No se pudo cargar el perfil');
    } finally {
      setLoading(false);
    }
  }, [userId, showAlert]);

  const loadVehicles = useCallback(async () => {
    try {
      const response = await get_withauth(ENDPOINTS.GET_USER_VEHICLES(userId));
      if (response.success && Array.isArray(response.data)) {
        setVehicles(response.data);
      } else {
        setVehicles([]);
      }
    } catch (_) {
      setVehicles([]);
    }
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    loadProfile();
    loadVehicles();
  }, [userId, loadProfile, loadVehicles]);

  useEffect(() => {
    if (openReport && profile && !isSelf) {
      setReportOpen(true);
      navigation.setParams({ openReport: undefined });
    }
  }, [openReport, profile, isSelf, navigation]);

  const handleStartChat = async () => {
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
            otherUser: response.data.participants?.find((p) => p._id !== (user?._id || user?.id)),
          },
        });
      }
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo iniciar el chat';
      showAlert('Ocurrió algo', msg);
    } finally {
      setChatLoading(false);
    }
  };

  const submitReport = async () => {
    const label = REPORT_REASONS.find((r) => r.value === reportReasonCode)?.label || reportReasonCode;
    const extra = reportDetail.trim();
    if (reportReasonCode === 'other' && extra.length < 4) {
      showAlert('Detalle requerido', 'Para «Otro» escribí al menos 4 caracteres explicando el motivo.');
      return;
    }
    const reason = extra ? `${label}: ${extra}` : label;
    if (reason.length < 4) {
      showAlert('Motivo requerido', 'Elegí una categoría y/o escribí un breve detalle.');
      return;
    }
    setReportSubmitting(true);
    try {
      await post_withauth(ENDPOINTS.REPORT_USER(userId), {
        reason,
        ...(conversationId ? { conversationId } : {}),
      });
      setReportOpen(false);
      setReportDetail('');
      showAlert('Enviado', 'Recibimos tu reporte. Lo revisará el equipo de moderación.');
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo enviar el reporte';
      showAlert('Ocurrió algo', msg);
    } finally {
      setReportSubmitting(false);
    }
  };

  const confirmBlock = () => {
    if (isBlocked) {
      showAlert(
        'Desbloquear usuario',
        `¿Querés desbloquear a ${profile?.firstName}?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Desbloquear', onPress: () => runUnblock() },
        ]
      );
    } else {
      showAlert(
        'Bloquear usuario',
        'No podrán enviarse mensajes y el chat desaparecerá para ambos. ¿Continuar?',
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Bloquear', style: 'destructive', onPress: () => runBlock() },
        ]
      );
    }
  };

  const runBlock = async () => {
    setBlockLoading(true);
    try {
      await post_withauth(ENDPOINTS.BLOCK_USER(userId), {});
      await refreshUser();
      showAlert('Listo', 'Usuario bloqueado.', [
        {
          text: 'OK',
          onPress: () => {
            if (fromChat) {
              navigation.popToTop();
            } else {
              navigation.goBack();
            }
          },
        },
      ]);
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo bloquear';
      showAlert('Ocurrió algo', msg);
    } finally {
      setBlockLoading(false);
    }
  };

  const runUnblock = async () => {
    setBlockLoading(true);
    try {
      await delete_withauth(ENDPOINTS.UNBLOCK_USER(userId));
      await refreshUser();
      showAlert('Listo', 'Usuario desbloqueado.');
    } catch (e) {
      const msg = e?.response?.data?.message || e?.message || 'No se pudo desbloquear';
      showAlert('Ocurrió algo', msg);
    } finally {
      setBlockLoading(false);
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
  const cardBg = isDarkMode ? '#292929' : colors.cardBackground;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.header}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: isDarkMode ? '#292929' : colors.surface }]}>
            <Text style={[styles.avatarInitials, { color: colors.textPrimary }]}>
              {profile.firstName?.[0]}
              {profile.lastName?.[0]}
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

      {!isSelf && (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.secondaryBtn, { borderColor: colors.border, backgroundColor: cardBg }]}
            onPress={() => setReportOpen(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="flag-outline" size={18} color={colors.textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Reportar</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.secondaryBtn,
              isBlocked
                ? { borderColor: colors.border, backgroundColor: cardBg }
                : { borderColor: ui.textMuted, backgroundColor: cardBg },
            ]}
            onPress={confirmBlock}
            disabled={blockLoading}
            activeOpacity={0.8}
          >
            {blockLoading ? (
              <ActivityIndicator size="small" color={isBlocked ? colors.textMuted : ui.textMuted} />
            ) : isBlocked ? (
              <>
                <Ionicons name="lock-open-outline" size={18} color={colors.textPrimary} />
                <Text style={[styles.secondaryBtnText, { color: colors.textPrimary }]}>Desbloquear</Text>
              </>
            ) : (
              <>
                <Ionicons name="ban-outline" size={18} color="#DC2626" />
                <Text style={[styles.secondaryBtnText, { color: ui.textMuted }]}>Bloquear</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}

      {!isSelf && !!tripId && (
        <TouchableOpacity
          style={[styles.chatButton, { backgroundColor: ui.invertBg }]}
          onPress={handleStartChat}
          disabled={chatLoading}
        >
          {chatLoading ? (
            <ActivityIndicator size="small" color={ui.invertText} />
          ) : (
            <>
              <Ionicons name="chatbubble-outline" size={20} color={ui.invertText} />
              <Text style={[styles.chatButtonText, { color: ui.invertText }]}>Enviar mensaje</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {vehicles.length > 0 && (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Vehículos</Text>
          {vehicles.map((v) => {
            const img =
              (v.photos && v.photos[0] && buildImageUri(v.photos[0])) ||
              (v.photo && buildImageUri(v.photo));
            return (
              <View key={v._id} style={[styles.vehicleRow, { borderTopColor: colors.border }]}>
                {img ? (
                  <Image source={{ uri: img }} style={styles.vehicleThumb} />
                ) : (
                  <View style={[styles.vehicleThumb, styles.vehicleThumbPh, { backgroundColor: colors.surface }]}>
                    <Ionicons name="car-outline" size={22} color={colors.textMuted} />
                  </View>
                )}
                <View style={styles.vehicleInfo}>
                  <Text style={[styles.vehicleTitle, { color: colors.textPrimary }]}>
                    {v.brand} {v.model} ({v.year})
                  </Text>
                  <Text style={[styles.vehicleMeta, { color: colors.textSecondary }]}>
                    {v.color} · {v.licensePlate} · {v.capacity} plazas
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {profile.bio ? (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Sobre mí</Text>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {profile.memberSince || profile.createdAt ? (
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: colors.border }]}>
          <Text style={[styles.cardLabel, { color: colors.textMuted }]}>Miembro desde</Text>
          <Text style={[styles.cardValue, { color: colors.textPrimary }]}>
            {new Date(profile.memberSince || profile.createdAt).toLocaleDateString('es-ES', {
              month: 'long',
              year: 'numeric',
            })}
          </Text>
        </View>
      ) : null}

      <Modal visible={reportOpen} animationType="slide" transparent onRequestClose={() => setReportOpen(false)}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalBox, { backgroundColor: colors.background }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Reportar usuario</Text>
            <Text style={[styles.modalHint, { color: colors.textSecondary }]}>
              Elegí un motivo. Los administradores lo verán en el panel.
            </Text>
            <ScrollView style={styles.reasonList} showsVerticalScrollIndicator={false}>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  style={[
                    styles.reasonChip,
                    {
                      borderColor: reportReasonCode === r.value ? colors.textPrimary : colors.border,
                      backgroundColor: reportReasonCode === r.value ? (isDarkMode ? '#333' : '#F3F4F6') : 'transparent',
                    },
                  ]}
                  onPress={() => setReportReasonCode(r.value)}
                >
                  <Text style={{ color: colors.textPrimary, fontSize: 14 }}>{r.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              style={[
                styles.reportInput,
                {
                  borderColor: colors.border,
                  color: colors.textPrimary,
                  backgroundColor: isDarkMode ? '#1A1A1A' : '#F9FAFB',
                },
              ]}
              placeholder="Detalle (opcional u obligatorio si elegiste «Otro»)"
              placeholderTextColor={colors.textMuted}
              value={reportDetail}
              onChangeText={setReportDetail}
              multiline
              maxLength={1500}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnGhost} onPress={() => setReportOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtnPrimary, { backgroundColor: ui.invertBg }]}
                onPress={submitReport}
                disabled={reportSubmitting}
              >
                {reportSubmitting ? (
                  <ActivityIndicator color={isDarkMode ? '#000' : '#FFF'} />
                ) : (
                  <Text style={{ color: ui.invertText, fontWeight: '700' }}>Enviar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 24, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { marginTop: 12, fontSize: 16 },
  header: { alignItems: 'center', marginBottom: 20 },
  avatar: { width: 100, height: 100, borderRadius: 50, marginBottom: 16 },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarInitials: { fontSize: 36, fontFamily: 'Sora_700Bold' },
  name: { fontSize: 24, fontFamily: 'Sora_700Bold', marginBottom: 6 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  location: { fontSize: 14 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 14, fontFamily: 'Sora_600SemiBold' },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 24,
  },
  chatButtonText: { fontSize: 16, fontFamily: 'Sora_600SemiBold' },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 11,
    fontFamily: 'Sora_600SemiBold',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  cardValue: { fontSize: 15 },
  vehicleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    marginTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  vehicleThumb: { width: 56, height: 56, borderRadius: 8, marginRight: 12 },
  vehicleThumbPh: { justifyContent: 'center', alignItems: 'center' },
  vehicleInfo: { flex: 1 },
  vehicleTitle: { fontSize: 15, fontFamily: 'Sora_600SemiBold' },
  vehicleMeta: { fontSize: 13, marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalBox: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 20,
    maxHeight: '85%',
  },
  modalTitle: { fontSize: 18, fontFamily: 'Sora_700Bold', marginBottom: 8 },
  modalHint: { fontSize: 13, marginBottom: 12 },
  reasonList: { maxHeight: 220 },
  reasonChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
  },
  reportInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    minHeight: 80,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  modalBtns: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 16,
  },
  modalBtnGhost: { paddingVertical: 12, paddingHorizontal: 16 },
  modalBtnPrimary: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
});

export default UserProfileScreen;
