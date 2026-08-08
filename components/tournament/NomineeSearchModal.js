// components/tournament/NomineeSearchModal.js
//
// Seçim (aday belirleme) fazının ARAMA ekranı — SIRADAN bir arama gibi davranır:
// yazarsın, eşleşen yapımlar tek listede çıkar, hype verirsin.
//
// Arka planda iki kaynak var ama bu kullanıcıya ANLATILMAZ (ayrı bölüm başlığı,
// "TMDB'de ara", "havuzda yok" gibi etiketler bilerek YOK):
//   1) Havuz — ay başı listesi + topluluğun eklediği adaylar (yerel süzme).
//   2) TMDB  — havuzda olmayanlar için global arama; ayın türüne uymayanlar
//              serviste sessizce elenir, yani listede yalnız hype verilebilecek
//              yapımlar görünür.
// Tek fark görünmez: TMDB satırına hype verilince aday önce havuza yazılır
// (onHypeExternal), havuz satırı doğrudan hype alır (onHype).
//
// Oy kuralı her iki kaynakta da AYNI: tek hak + iki adımlı onay + kesin
// (değiştirilemez). İlk basış onay durumuna geçirir, ikinci basış parent'a
// bildirir; PENDING_TIMEOUT boyunca dokunulmazsa iptal. Kaydetme/geri alma/
// toast mantığı parent'tadır (tek doğruluk kaynağı).

import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View, Text, StyleSheet, Modal, Pressable, TextInput, FlatList, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";
import { searchCandidates } from "@services/tournamentService";

const PENDING_TIMEOUT = 2600;
const SEARCH_DEBOUNCE = 380;
const MIN_QUERY = 2;

// Türkçe uyumlu, aksan bağışlayıcı küçük harf karşılaştırma.
const norm = (s, lang) =>
  String(s || "").toLocaleLowerCase(lang === "tr" ? "tr-TR" : "en-US");

// ─── Aday satırı ──────────────────────────────────────────────────────────────
// Havuzdaki satır sıra rozeti + hype sayacı taşır; havuzda olmayan (external)
// satır yalnız yılını gösterir. Buton her ikisinde de aynı: "Hype".
const Row = memo(function Row({
  item, mine, canVote, isPending, external, onPress, onOpen, theme, getTmdbUrl, lang,
}) {
  const uri = item.posterPath ? getTmdbUrl(item.posterPath, "poster", 92) : null;
  const rankColor = item.finalist ? "#22C55E" : "#9CA3AF";

  // Satırın GÖVDESİ her zaman detaya gider; hype butonu iç içe Pressable olduğu
  // için kendi dokunuşunu ayrıca yakalar. Böylece ızgaradaki "Bilgi" seçeneğinin
  // karşılığı burada da var: hype vermeden önce yapımı inceleyebilirsin.
  let action = null;
  if (mine) {
    action = (
      <View style={[styles.actionChip, { backgroundColor: theme.accent }]}>
        <AppIcon family="Ionicons" name="flame" size={12} color="#fff" />
        <Text style={styles.actionChipTextOn}>
          {i18nText("autoI18n.tournament_your_pick", "Senin adayın")}
        </Text>
        <AppIcon family="Ionicons" name="chevron-forward" size={11} color="#fff" />
      </View>
    );
  } else if (canVote) {
    action = (
      <Pressable
        onPress={() => onPress(item)}
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
    <Pressable
      onPress={() => onOpen?.(item)}
      style={[styles.row, { backgroundColor: theme.secondary, borderColor: theme.border }]}
      accessibilityRole="button"
    >
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
          {external ? (
            !!item.year && (
              <Text style={[styles.yearText, { color: theme.text.muted }]}>{item.year}</Text>
            )
          ) : (
            <>
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
            </>
          )}
        </View>
      </View>

      {action}
    </Pressable>
  );
});

export default function NomineeSearchModal({
  visible, onClose, pool = [], myNoms, canVote, onHype, onHypeExternal, onOpen,
  mediaType, genreId, theme, getTmdbUrl, lang = "tr",
}) {
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [remote, setRemote] = useState([]);
  const [searching, setSearching] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const timer = useRef(null);

  const clearPending = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPendingId(null);
  }, []);

  // Modal her açılışta temiz başlasın.
  useEffect(() => {
    if (visible) { setQ(""); setRemote([]); setRemoteError(false); clearPending(); }
  }, [visible, clearPending]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const trimmed = q.trim();

  const filtered = useMemo(() => {
    const needle = norm(trimmed, lang);
    if (!needle) return pool;
    return pool.filter((n) => norm(n.title, lang).includes(needle));
  }, [pool, trimmed, lang]);

  // ── Global TMDB araması (gecikmeli + iptal edilebilir) ──────────────────────
  // Havuzda ZATEN olanlar elenir: onlar yukarıdaki havuz bölümünde normal
  // (sıra + hype sayaçlı) satır olarak çıkıyor, iki kez göstermenin anlamı yok.
  const poolIds = useMemo(() => new Set(pool.map((n) => String(n.id))), [pool]);

  useEffect(() => {
    if (!visible || trimmed.length < MIN_QUERY) {
      setRemote([]); setSearching(false); setRemoteError(false);
      return undefined;
    }
    const controller = new AbortController();
    let active = true;
    setSearching(true);
    setRemoteError(false);
    const id = setTimeout(() => {
      searchCandidates({ query: trimmed, mediaType, genreId, language: lang, signal: controller.signal })
        .then((res) => { if (active) { setRemote(res); setSearching(false); } })
        .catch(() => {
          // İptal (yeni tuş) hata değildir; yalnız gerçek başarısızlığı göster.
          if (active && !controller.signal.aborted) { setRemoteError(true); setSearching(false); }
        });
    }, SEARCH_DEBOUNCE);
    return () => { active = false; clearTimeout(id); controller.abort(); };
  }, [visible, trimmed, mediaType, genreId, lang]);

  const external = useMemo(
    () => remote.filter((r) => !poolIds.has(String(r.id))),
    [remote, poolIds],
  );

  // Tek düz liste: önce havuz eşleşmeleri, sonra havuzda olmayanlar. Kaynak
  // ayrımı kullanıcıya gösterilmez — hepsi aynı görünen arama sonucudur.
  const data = useMemo(
    () => [
      ...filtered.map((n) => ({ _type: "pool", key: `p-${n.id}`, item: n })),
      ...external.map((n) => ({ _type: "ext", key: `e-${n.id}`, item: n })),
    ],
    [filtered, external],
  );

  // İki adımlı onay: 1. basış beklet, 2. basış parent'a bildir.
  const handlePress = useCallback(
    (item, isExternal) => {
      const key = String(item.id);
      if (pendingId === key) {
        clearPending();
        if (isExternal) onHypeExternal?.(item);
        else onHype?.(item.id);
      } else {
        setPendingId(key);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setPendingId(null), PENDING_TIMEOUT);
      }
    },
    [pendingId, clearPending, onHype, onHypeExternal],
  );

  const pressPool = useCallback((item) => handlePress(item, false), [handlePress]);
  const pressExt = useCallback((item) => handlePress(item, true), [handlePress]);

  const renderItem = useCallback(
    ({ item }) => {
      const isExt = item._type === "ext";
      return (
        <Row
          item={item.item}
          external={isExt}
          mine={myNoms?.has(String(item.item.id))}
          canVote={canVote}
          isPending={pendingId === String(item.item.id)}
          onPress={isExt ? pressExt : pressPool}
          onOpen={onOpen}
          theme={theme}
          getTmdbUrl={getTmdbUrl}
          lang={lang}
        />
      );
    },
    [myNoms, canVote, pendingId, pressExt, pressPool, onOpen, theme, getTmdbUrl, lang],
  );

  const searchMode = trimmed.length >= MIN_QUERY;

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
              returnKeyType="search"
            />
            {searching ? (
              <ActivityIndicator size="small" color={theme.accent} />
            ) : q.length > 0 ? (
              <Pressable onPress={() => setQ("")}>
                <AppIcon family="Ionicons" name="close-circle" size={16} color={theme.text.muted} />
              </Pressable>
            ) : null}
          </View>
          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: theme.secondary, borderColor: theme.border }]}
          >
            <AppIcon family="Ionicons" name="close" size={18} color={theme.text.secondary} />
          </Pressable>
        </View>

        <FlatList
          data={data}
          keyExtractor={(row) => row.key}
          renderItem={renderItem}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          initialNumToRender={12}
          maxToRenderPerBatch={12}
          windowSize={7}
          removeClippedSubviews
          ListEmptyComponent={
            // Arama sürerken boş durum gösterme — sonuç gelmeden "bulunamadı"
            // yazmak yanlış olurdu.
            searchMode && searching ? null : (
              <View style={styles.empty}>
                <AppIcon
                  family="Ionicons"
                  name={remoteError ? "cloud-offline-outline" : "search-outline"}
                  size={28}
                  color={theme.text.muted}
                />
                <Text style={[styles.emptyText, { color: theme.text.muted }]}>
                  {remoteError
                    ? i18nText("autoI18n.tournament_search_net_error", "Arama yapılamadı — bağlantını kontrol et.")
                    : i18nText("autoI18n.tournament_search_empty", "Eşleşen yapım bulunamadı")}
                </Text>
              </View>
            )
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
  listContent: { paddingHorizontal: 14, paddingTop: 10, paddingBottom: 30 },

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

  yearText: { fontSize: 10.5, fontWeight: "800" },

  actionChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 10, paddingVertical: 7, borderRadius: 11,
  },
  actionChipText: { fontSize: 11.5, fontWeight: "900" },
  actionChipTextOn: { color: "#fff", fontSize: 11.5, fontWeight: "900" },

  empty: { alignItems: "center", gap: 10, paddingTop: 50 },
  emptyText: { fontSize: 12.5, fontWeight: "600" },
});
