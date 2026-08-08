// components/CacheManagerModal.js
//
// "Önbellek" ekranı: uygulamadaki önbelleği kategori kategori (posterler, pet,
// dizi/film içerik, gönderiler, izleme listesi, hatırlatıcılar, notlar, profil)
// boyutlarıyla gösterir; tek tek veya tümden temizlenebilir.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  StyleSheet,
  } from "react-native";
import AppIcon from "./AppIcon";
import { i18nText } from "../utils/i18nText";
import { appAlert } from "./AppAlert";
import {
  getBreakdown,
  clearCategory,
  clearAllCaches,
} from "../services/cacheInspector";

const META = {
  images: { tr: "Posterler ve görseller", family: "Ionicons", icon: "images-outline", color: "#3B82F6" },
  pets: { tr: "Pet'ler", family: "MaterialCommunityIcons", icon: "paw", color: "#F59E0B" },
  tvContent: { tr: "Dizi içerikleri", family: "Ionicons", icon: "tv-outline", color: "#8B5CF6" },
  movieContent: { tr: "Film içerikleri", family: "Ionicons", icon: "film-outline", color: "#EC4899" },
  posts: { tr: "Gönderiler", family: "Ionicons", icon: "newspaper-outline", color: "#10B981" },
  lists: { tr: "İzleme listesi", family: "Ionicons", icon: "bookmark-outline", color: "#06B6D4" },
  reminders: { tr: "Hatırlatıcılar", family: "Ionicons", icon: "alarm-outline", color: "#EF4444" },
  notes: { tr: "Notlar", family: "Ionicons", icon: "document-text-outline", color: "#EAB308" },
  profile: { tr: "Profil", family: "Ionicons", icon: "person-outline", color: "#64748B" },
  activity: { tr: "Etkinliklerim", family: "Ionicons", icon: "sparkles-outline", color: "#F97316" },
  networkData: { tr: "İnternet verileri", family: "Ionicons", icon: "cloud-done-outline", color: "#14B8A6" },
};

const fmt = (b) => {
  if (!b) return "0 KB";
  if (b >= 1024 * 1024) return `${(b / 1048576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(b / 1024))} KB`;
};

export default function CacheManagerModal({ visible, onClose, colors: C }) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ total: 0, categories: [] });
  const [busyId, setBusyId] = useState(null);
  const [clearingAll, setClearingAll] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBreakdown();
      setData(res);
    } catch {
      setData({ total: 0, categories: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) load();
  }, [visible, load]);

  const onClearCategory = useCallback(
    async (id) => {
      setBusyId(id);
      try {
        await clearCategory(id);
        await load();
      } finally {
        setBusyId(null);
      }
    },
    [load],
  );

  const onClearAll = useCallback(() => {
    appAlert(
      i18nText("autoI18n.tumOnbellek", "Tüm önbellek"),
      i18nText(
        "autoI18n.tumOnbellekTemizleOnay",
        "Tüm önbellek silinecek. Ayarların ve oturumun etkilenmez; veriler tekrar internetten yüklenir.",
      ),
      [
        { text: i18nText("autoI18n.vazgec", "Vazgeç"), style: "cancel" },
        {
          text: i18nText("autoI18n.temizle", "Temizle"),
          style: "destructive",
          onPress: async () => {
            setClearingAll(true);
            try {
              await clearAllCaches();
              await load();
            } finally {
              setClearingAll(false);
            }
          },
        },
      ],
    );
  }, [load]);

  // Boş olmayanlar üstte, boyuta göre azalan.
  const sorted = useMemo(
    () => [...data.categories].sort((a, b) => b.bytes - a.bytes),
    [data.categories],
  );
  const maxBytes = sorted.length ? Math.max(1, sorted[0].bytes) : 1;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: C.card, borderColor: C.border }]}>
          {/* Başlık */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.headerIcon, { backgroundColor: C.iconBlue }]}>
                <AppIcon family="Ionicons" name="server-outline" size={18} color={C.blue} />
              </View>
              <View>
                <Text allowFontScaling={false} style={[styles.title, { color: C.text }]}>
                  {i18nText("autoI18n.onbellek", "Önbellek")}
                </Text>
                <Text allowFontScaling={false} style={[styles.subtitle, { color: C.muted }]}>
                  {i18nText("autoI18n.toplam", "Toplam")}: {fmt(data.total)}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <AppIcon family="Ionicons" name="close" size={22} color={C.muted} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={C.blue} />
              <Text allowFontScaling={false} style={[styles.loadingText, { color: C.muted }]}>
                {i18nText("autoI18n.hesaplaniyor", "Hesaplanıyor…")}
              </Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 380 }} showsVerticalScrollIndicator={false}>
              {sorted.map((cat) => {
                const meta = META[cat.id] || {};
                const pct = Math.round((cat.bytes / maxBytes) * 100);
                const empty = cat.bytes === 0;
                return (
                  <View key={cat.id} style={styles.row}>
                    <View style={[styles.rowIcon, { backgroundColor: `${meta.color}22` }]}>
                      <AppIcon
                        family={meta.family}
                        name={meta.icon}
                        size={16}
                        color={meta.color}
                      />
                    </View>
                    <View style={styles.rowMid}>
                      <View style={styles.rowTop}>
                        <Text
                          allowFontScaling={false}
                          numberOfLines={1}
                          style={[styles.rowLabel, { color: C.text }]}
                        >
                          {i18nText(`autoI18n.cache_${cat.id}`, meta.tr || cat.id)}
                        </Text>
                        <Text allowFontScaling={false} style={[styles.rowSize, { color: C.muted }]}>
                          {fmt(cat.bytes)}
                        </Text>
                      </View>
                      <View style={[styles.barTrack, { backgroundColor: C.border }]}>
                        <View
                          style={[
                            styles.barFill,
                            { width: `${empty ? 0 : Math.max(4, pct)}%`, backgroundColor: meta.color },
                          ]}
                        />
                      </View>
                    </View>
                    <TouchableOpacity
                      onPress={() => onClearCategory(cat.id)}
                      disabled={empty || busyId === cat.id}
                      hitSlop={8}
                      style={styles.trashBtn}
                    >
                      {busyId === cat.id ? (
                        <ActivityIndicator size="small" color={C.muted} />
                      ) : (
                        <AppIcon
                          family="Ionicons"
                          name="trash-outline"
                          size={17}
                          color={empty ? C.border : C.danger}
                        />
                      )}
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          )}

          {/* Tümünü temizle */}
          <TouchableOpacity
            onPress={onClearAll}
            disabled={clearingAll || loading || data.total === 0}
            activeOpacity={0.85}
            style={[
              styles.clearAllBtn,
              {
                backgroundColor: data.total === 0 ? C.border : `${C.danger}1A`,
                borderColor: C.danger,
                opacity: clearingAll ? 0.7 : 1,
              },
            ]}
          >
            {clearingAll ? (
              <ActivityIndicator size="small" color={C.danger} />
            ) : (
              <>
                <AppIcon family="Ionicons" name="trash-outline" size={16} color={C.danger} />
                <Text allowFontScaling={false} style={[styles.clearAllText, { color: C.danger }]}>
                  {i18nText("autoI18n.tumunuTemizle", "Tümünü temizle")}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 18, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { fontSize: 12.5, fontWeight: "600", marginTop: 1 },
  loadingBox: { paddingVertical: 40, alignItems: "center", gap: 10 },
  loadingText: { fontSize: 13 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  rowIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  rowMid: { flex: 1, gap: 6 },
  rowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  rowLabel: { fontSize: 13.5, fontWeight: "600", flexShrink: 1 },
  rowSize: { fontSize: 12, fontWeight: "700" },
  barTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 3 },
  trashBtn: { width: 30, alignItems: "center", justifyContent: "center" },
  clearAllBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 13,
  },
  clearAllText: { fontSize: 14.5, fontWeight: "800" },
});
