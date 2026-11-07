// components/tierList/TierListPreviewSheet.js
//
// Sohbette paylaşılan tier list'in tam görünümü (salt okunur TierBoard). Gelen balonda "Kopyasını düzenle":
// alıcıda yeni tablo açılır; düzenleyiciye geçiş sayfa tamamen kapandıktan SONRA (`onDismissed`) yapılır.
// Afişler mesajdaki anlık görüntüden çizilir (gönderen ne gördüyse o; alıcının özel afiş seçimi uygulanmaz).

import React, { useCallback } from "react";
import { StyleSheet, Text } from "react-native";
import { buildTmdbUrl } from "@utils/tmdbImageUtils";
import { viewBoardRows } from "@utils/tierList";
import TierBoard from "./TierBoard";
import { SheetButton, TierSheet } from "./tierSheetKit";

export default function TierListPreviewSheet({ visible, share, copy, theme, canCopy, onClose, onDismissed, onCopy }) {
  const posterUriOf = useCallback((media, width) => buildTmdbUrl(media.poster_path, "poster", width), []);
  if (!share) return null;
  return (
    <TierSheet
      visible={visible}
      onClose={onClose}
      onDismissed={onDismissed}
      theme={theme}
      title={share.title || copy.untitled}
      subtitle={`${copy.chatFrom(share.host)} · ${copy.cardCount(share.total)}`}
      footer={canCopy ? <SheetButton theme={theme} label={copy.previewCopy} icon="copy-outline" onPress={onCopy} /> : null}
    >
      <TierBoard tiers={viewBoardRows(share)} posterUriOf={posterUriOf} theme={theme} />
      <Text style={[styles.note, { color: theme.text.muted }]}>{copy.cardFooter}</Text>
    </TierSheet>
  );
}

const styles = StyleSheet.create({
  note: { fontSize: 11, fontWeight: "700", textAlign: "center", marginTop: 10 },
});
