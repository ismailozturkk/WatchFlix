// components/tournament/NomineeSearchModal.js
//
// Seçim (aday belirleme) fazı için ARAMA modalı. TournamentScreen'deki arama
// çubuğu butonuna basınca açılır; 64 adaylık havuzda isimle arar ve buradan da
// hype (aday oyu) verilebilir.
//
// Oy kuralı gridle AYNI: tek hak + iki adımlı onay + kesin (değiştirilemez).
// Satırdaki "Hype" butonuna ilk basış onay durumuna geçirir ("Onayla — kesin"),
// ikinci basış parent'ın onHype(id)'ini çağırır. 2.6 sn dokunulmazsa iptal.
// Kaydetme/geri alma/toast mantığı parent'tadır (tek doğruluk kaynağı).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

const PENDING_TIMEOUT = 2600;

// Türkçe uyumlu, aksan bağışlayıcı küçük harf karşılaştırma.
const norm = (s, lang) =>
  String(s || "").toLocaleLowerCase(lang === "tr" ? "tr-TR" : "en-US");

const Row = memo(function Row({
  item, mine, canVote, isPending, onPress, theme, getTmdbUrl,
}) {
  const uri = item.posterPath ? getTmdbUrl(item.posterPath, "poster", 92) : null;
  const rankColor = item.finalist ? "#22C55E" : "#9CA3AF";

  let action = null;
  if (mine) {
    action = (
      <View style={[styles.actionChip, { backgroundColor: theme.accent }]}>
        <AppIcon family="Ionicons" name="flame" size={12} color="#fff" />
        <Text style={styles.actionChipTextOn}>
          {i18nText("autoI18n.tournament_your_pick", "Senin adayın")}
        </Text>
      </View>
    );
  } else if (canVote) {
    action = (
      <Pressable
        onPress={() => onPress(item.id)}
        style={[
          styles.actionChip,
          isPending
            ? { backgroundColor: theme.accent }
            : { backgroundColor: theme.accent + "1A", borderWidth: 1, borderColor: theme.accent + "66" },
        ]}
      >
        <AppIcon family="Ionicons" name="flame" size={12} color={isPending ? "#fff" : theme.accent} />
        <Text style={isPending ? styles.actionChipTextOn : [styles.actionChipText, { color: theme.accent }]}>
          {isPending
            ? i18nText("autoI18n.tournament_confirm_final", "Onayla — kesin")
            : i18nText("autoI18n.tournament_hype", "Hype")}
        </Text>
      </Pressable>
    );
  }

  return (
    <View style={[styles.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
      <View style={[styles.rowPosterWrap, { backgroundColor: theme.between }]}>
        {uri ? (
          <Image source={{ uri }} style={styles.rowPoster} contentFit="cover" transition={120} />
        ) : (
          <View style={[styles.rowPoster, styles.rowPosterEmpty]}>
            <AppIcon family="Ionicons" name="image-outline" size={16} color={theme.text.muted} />
          </View>
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: theme.text.primary }]}>
          {item.title}
        </Text>
        <View style={styles.rowMeta}>
          <View style={[styles.rankPill, { backgroundColor: rankColor + "22", borderColor: rankColor + "66" }]}>
            <Text style={[styles.rankPillText, { color: rankColor }]}>#{item.rank}</Text>
          </View>
          <View style={styles.hypePill}>
            <AppIcon family="Ionicons" name="flame" size={10} color="#F59E0B" />
            <Text style={styles.hypePillText}>{item.nomVotes}</Text>
          </View>
          {item.finalist && (
            <Text style={[styles.finalistText, { color: "#22C55E" }]}>
              {i18nText("autoI18n.tournament_in_top32", "İlk 32'de")}
            </Text>
          )}
        </View>
      </View>

      {action}
    </View>
  );
});

export default function NomineeSearchModal({
  visible, onClose, pool = [], myNoms, canVote, onHype,
  theme, getTmdbUrl, lang = "tr",
}) {
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const timer = useRef(null);

  const clearPending = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPendingId(null);
  }, []);

  // Modal her açılışta temiz başlasın.
  useEffect(() => {
    if (visible) { setQ(""); clearPending(); }
  }, [visible, clearPending]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const filtered = useMemo(() => {
    const needle = norm(q.trim(), lang);
    if (!needle) return pool;
    return pool.filter((n) => norm(n.title, lang).includes(needle));
  }, [pool, q, lang]);

  // İki adımlı onay: 1. basış beklet, 2. basış parent'a bildir.
  const handlePress = useCallback(
    (id) => {
      const key = String(id);
      if (pendingId === key) {
        clearPending();
        onHype?.(id);
      } else {
        setPendingId(key);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setPendingId(null), PENDING_TIMEOUT);
      }
    },
    [pendingId, clearPending, onHype],
  );

  const renderItem = useCallback(
    ({ item }) => (
      <Row
        item={item}
        mine={myNoms?.has(String(item.id))}
        canVote={canVote}
        isPending={pendingId === String(item.id)}
        onPress={handlePress}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
      />
    ),
    [myNoms, canVote, pendingId, handlePress, theme, getTmdbUrl],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView edges={["top", "bottom"]} style={[styles.container, { backgroundColor: theme.primary }]}>
        {/* Başlık + arama kutusu */}
        <View style={styles.header}>
          <View style={[styles.searchBox, { backgroundColor: theme.secondary, borderColor: theme.border }]}>
            <AppIcon family="Ionicons" name="search" size={16} color={theme.text.muted} />
            <TextInput
              autoFocus
              value={q}
              onChangeText={(t) => { setQ(t); clearPending(); }}
              maxLength={80}
              placeholder={i18nText("autoI18n.tournament_search_ph", "Aday ara…")}
              placeholderTextColor={theme.text.muted}
              style={[styles.searchInput, { color: theme.text.primary }]}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {q.length > 0 && (
              <Pressable onPress={() => setQ("")}>
                <AppIcon family="Ionicons" name="close-circle" size={16} color={theme.text.muted} />
              </Pressable>
            )}
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <AppIcon family="Ionicons" name="close" size={18} color={theme.text.secondary} />
          </Pressable>
        </View>

        {/* Kural hatırlatması */}
        <Text style={[styles.hint, { color: theme.text.muted }]}>
          {canVote
            ? i18nText(
                "autoI18n.tournament_search_hint",
                "Tek hype hakkın var — butona iki kez bas, seçim kesindir.",
              )
            : i18nText(
                "autoI18n.tournament_search_hint_locked",
                "Hype dönemi kapalı veya hakkını kullandın — sıralamayı inceleyebilirsin.",
              )}
        </Text>

        <FlatList
          data={filtered}
          keyExtractor={(n) => String(n.id)}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            <View style={styles.empty}>
              <AppIcon family="Ionicons" name="search-outline" size={28} color={theme.text.muted} />
              <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                {i18nText("autoI18n.tournament_search_empty", "Havuzda eşleşen aday yok")}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingTop: 8,
  },
  searchBox: {
    flex: 1, flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9,
  },
  searchInput: { flex: 1, fontSize: 14, paddingVertical: 0 },
  closeBtn: {
    width: 38, height: 38, borderRadius: 13, borderWidth: 1,
    alignItems: "center", justifyContent: "center",
  },
  hint: {
    fontSize: 11, fontWeight: "600", lineHeight: 15,
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4,
  },
  listContent: { paddingHorizontal: 14, paddingTop: 6, paddingBottom: 30 },

  row: {
    flexDirection: "row", alignItems: "center", gap: 10,
    borderRadius: 14, borderWidth: 1, padding: 8, marginBottom: 8,
  },
  rowPosterWrap: { borderRadius: 8, overflow: "hidden" },
  rowPoster: { width: 40, height: 60 },
  rowPosterEmpty: { alignItems: "center", justifyContent: "center" },
  rowTitle: { fontSize: 13.5, fontWeight: "800" },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  rankPill: {
    paddingHorizontal: 6, paddingVertical: 1.5, borderRadius: 7, borderWidth: 1,
  },
  rankPillText: { fontSize: 10, fontWeight: "800" },
  hypePill: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: "rgba(245,158,11,0.14)",
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 7,
  },
  hypePillText: { color: "#F59E0B", fontSize: 10, fontWeight: "800" },
  finalistText: { fontSize: 10, fontWeight: "800" },

  actionChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11,
  },
  actionChipText: { fontSize: 11.5, fontWeight: "900" },
  actionChipTextOn: { color: "#fff", fontSize: 11.5, fontWeight: "900" },

  empty: { alignItems: "center", gap: 10, paddingTop: 50 },
  emptyText: { fontSize: 12.5, fontWeight: "600" },
});
