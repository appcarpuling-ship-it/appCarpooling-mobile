import React, { useCallback, useEffect, useState } from 'react';
import { get_withauth, post_withauth, buildImageUri } from '../../services/apiService';
import { ENDPOINTS } from '../../config/api';
import BannerDetailModal from './BannerDetailModal';
import useColors from '../../hooks/useColors';
import { sanitizeImageUrl } from '../../utils/imageUtils';

/**
 * Noticias creadas en el dashboard: modal estilo banner, una a la vez; al cerrar se marca como leída.
 */
export default function UnreadNewsModalLayer() {
  const { colors } = useColors();
  const [pending, setPending] = useState([]);
  const [active, setActive] = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await get_withauth(ENDPOINTS.NEWS_UNREAD);
      if (res?.success && Array.isArray(res.data) && res.data.length > 0) {
        setPending(res.data);
      }
    } catch {
      /* offline / sin token */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (active == null && pending.length > 0) {
      const [head, ...tail] = pending;
      setActive(head);
      setPending(tail);
    }
  }, [active, pending]);

  const handleClose = async () => {
    const id = active?._id;
    if (id) {
      try {
        await post_withauth(ENDPOINTS.NEWS_ACK_READ(id), {});
      } catch {
        /* no bloquear cierre */
      }
    }
    setActive(null);
  };

  const rawImage = active
    ? active.imageUrl && !String(active.imageUrl).startsWith('http')
      ? buildImageUri(active.imageUrl)
      : active.imageUrl
    : null;

  const banner = active
    ? {
        title: active.title,
        description: active.body,
        imageUrl: rawImage ? sanitizeImageUrl(rawImage) : undefined,
      }
    : null;

  return (
    <BannerDetailModal
      visible={!!active}
      banner={banner}
      onClose={handleClose}
      colors={colors}
    />
  );
}
