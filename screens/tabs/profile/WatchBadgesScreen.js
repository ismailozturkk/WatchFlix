// screens/tabs/profile/WatchBadgesScreen.js
//
// İzleme rozetleri ekranı — 81 rozet, kademeli aileler tek karta indirilmiş.
// Ayrıca çalışma anında üretilen iki bölüm: dönem mühürleri ve koleksiyonlar.
//
// FlatList ZORUNLU (.map değil): GameAchievementsScreen 9 başarımı ScrollView
// içinde .map ile basıyor ve o ölçekte sorun değil, ama burada bölüm başlıkları
// dahil çok sayıda AppBadge (SVG) içeriyor. Sanallaştırma olmadan her scroll
// karesinde tüm SVG'ler ölçülür.
//
// VARSAYILAN SIRALAMA "tamamlanmaya en yakın önce": rozet ekranının işi
// envanter göstermek değil, SONRAKİ HEDEFİ göstermektir. Alfabetik ya da
// katalog sırası, kullanıcının 3 adım uzaktaki rozetini 40 satır aşağıya gömer.

import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import WatchBadgeCard from "@components/badges/WatchBadgeCard";
import WatchBadgeDetailModal from "@components/badges/WatchBadgeDetailModal";
import WatchLevelCard from "@components/profile/WatchLevelCard";
import { BOLUM_BASLIK, BOLUM_SIRA } from "@components/badges/watchBadgeCatalog";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import { useWatchProgressContext } from "@context/WatchProgressContext";
import { withAlpha } from "@components/profile/StatsComponents";
import { i18nText } from "@utils/i18nText";

const FILTRELER = [
  { id: "tumu", key: "autoI18n.rozet_filtre_tumu", fallback: "Tümü" },
  { id: "acik", key: "autoI18n.rozet_filtre_acik", fallback: "Açık" },
  { id: "kilitli", key: "autoI18n.rozet_filtre_kilitli", fallback: "Kilitli" },
];

// Katalogdaki bölüm id'si → i18n anahtarı. Bölüm başlıkları ekran dizesidir
// (rozet adları katalogda inline durur), bu yüzden buradan çözülür.
const BOLUM_KEY = {
  kilometre: "autoI18n.rozet_bolum_kilometre",
  ritim: "autoI18n.rozet_bolum_ritim",
  tur: "autoI18n.rozet_bolum_tur",
  mevsim: "autoI18n.rozet_bolum_mevsim",
  muhur: "autoI18n.rozet_bolum_muhur",
  set: "autoI18n.rozet_bolum_set",
  kidem: "autoI18n.rozet_bolum_kidem",
  perde: "autoI18n.rozet_bolum_perde",
  gizli: "autoI18n.rozet_bolum_gizli",
};

export default function WatchBadgesScreen({ navigation }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const tr = language !== "en";
  const [filtre, setFiltre] = useState("tumu");
  // Detay modalı. `null` = kapalı. Kart nesnesinin KENDİSİ tutulur, id değil:
  // id tutup her render'da `kartlar` içinden aramak, filtre değişince (kart
  // listeden düşerse) modalı boşa düşürürdü.
  const [secili, setSecili] = useState(null);

  // Context'ten: bu ekran açıldığında ProfileScreen stack'te mount'ta kalıyor,
  // yani hook'u burada da çağırmak defter mutabakatını ikiye katlardı.
  const watchProgress = useWatchProgressContext() || { loading: true };
  const {
    loading,
    kartlar,
    acikSayisi,
    toplamRozet,
    ilkTohum,
    tohumRozetSayisi,
  } = watchProgress;

  // FlatList satırı her render'da yeni bir ok fonksiyonu almasın diye tek
  // referans; WatchBadgeCard React.memo'lu.
  const acDetay = useCallback((b) => setSecili(b), []);

  const veri = useMemo(() => {
    if (!kartlar?.length) return [];
    // Kademeli aile kartı İKİ filtreye birden girer: 2/4 kademesi açık bir aile
    // hem "kazandıklarım"dır hem de peşinde koşulacak bir hedefi vardır.
    // `!b.acik` yazsaydık böyle bir aile "Kilitli"de hiç görünmezdi — yani
    // kullanıcının sıradaki hedefi, tam da hedefleri listeleyen filtrede kaybolurdu.
    const suzulmus = kartlar.filter((b) => {
      if (filtre === "acik") return b.acik;
      if (filtre === "kilitli") return !b.acik || !!b.sonrakiHedef;
      return true;
    });

    // Bölüm bölüm grupla, her bölümün içinde "en yakın önce".
    const bolumler = new Map();
    for (const b of suzulmus) {
      if (!bolumler.has(b.section)) bolumler.set(b.section, []);
      bolumler.get(b.section).push(b);
    }

    // Bölüm sırası KATALOGDAN gelir, kart listesinin dizilişinden değil: mühür
    // ve koleksiyon kartları çalışma anında üretilip listeye sonda ekleniyor,
    // sıra karttan türeseydi ikisi de ekranın dibinde kalırdı.
    const sirali = [...bolumler.entries()].sort(
      (a, b) => BOLUM_SIRA.indexOf(a[0]) - BOLUM_SIRA.indexOf(b[0]),
    );

    const satirlar = [];
    for (const [bolum, liste] of sirali) {
      // "Tamamlanmaya en yakın önce". Peşinde koşulacak bir hedefi olan kart
      // (kilitli rozet YA DA sıradaki kademesi olan aile) üstte durur ve
      // sıralama O HEDEFİN oranına göre yapılır. Kartın kendi `oran`ına
      // bakmak yanlış olurdu: aile kartında o değer ULAŞILAN kademeye ait ve
      // her zaman 1'dir, yani bütün aileler sıranın başına yığılırdı.
      const hedefi = (x) => x.sonrakiHedef || (!x.acik ? x : null);
      liste.sort((a, b) => {
        const ha = hedefi(a);
        const hb = hedefi(b);
        if (!!ha !== !!hb) return ha ? -1 : 1;
        // Gizli rozetler oran sızdırmasın diye kilitliyken sabit sonda durur.
        if (a.hidden !== b.hidden) return a.hidden ? 1 : -1;
        if (!ha) return 0;
        return hb.oran - ha.oran;
      });
      satirlar.push({
        tur: "baslik",
        id: `h_${bolum}`,
        bolum,
        adet: liste.length,
      });
      // Bölüm başlığını tam genişlikte tutup rozetleri dörderli sanal satırlara
      // ayırıyoruz. FlatList'in numColumns özelliği bölüm başlıklarını da bir
      // hücre saydığı için heterojen veriyle doğru hizalama yapamaz.
      for (let i = 0; i < liste.length; i += 4) {
        satirlar.push({
          tur: "rozetSatiri",
          id: `r_${bolum}_${i}`,
          rozetler: liste.slice(i, i + 4),
        });
      }
    }
    return satirlar;
  }, [kartlar, filtre]);

  const baslik = i18nText("autoI18n.rozetlerim", "Rozetlerim");
  // Sistemi ilk açan mevcut kullanıcıya "Tebrikler, 31 rozet kazandın" demek
  // yalan olur — onları bugün kazanmadı. "Arşivin açıldı" envanter dilidir,
  // ödül dili değil; konfeti de bu yüzden burada oynamaz.
  const altBaslik =
    ilkTohum && tohumRozetSayisi > 0
      ? i18nText(
          "autoI18n.rozet_arsiv_acildi",
          `Arşivin açıldı — ${tohumRozetSayisi} rozet zaten senindi`,
          { n: tohumRozetSayisi }
        )
      : i18nText(
          "autoI18n.rozet_acildi_sayaci",
          `${acikSayisi}/${toplamRozet} açıldı`,
          { acik: acikSayisi, toplam: toplamRozet }
        );

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.primary }]}>
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={tr ? "Geri" : "Back"}
          onPress={() => navigation.goBack()}
          style={[
            styles.backButton,
            { backgroundColor: theme.secondary, borderColor: theme.border },
          ]}
        >
          <AppIcon
            family="Ionicons"
            name="arrow-back"
            size={21}
            color={theme.text.primary}
          />
        </TouchableOpacity>
        <View style={styles.headerCopy}>
          <Text
            allowFontScaling={false}
            style={[styles.title, { color: theme.text.primary }]}
          >
            {baslik}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.subtitle, { color: theme.text.muted }]}
          >
            {loading
              ? i18nText("autoI18n.rozet_hesaplaniyor", "Hesaplanıyor…")
              : altBaslik}
          </Text>
        </View>
      </View>

      <FlatList
        data={veri}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <WatchLevelCard progress={watchProgress} />
            <View style={styles.filterRow}>
              {FILTRELER.map((f) => {
                const secili = filtre === f.id;
                return (
                  <TouchableOpacity
                    key={f.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected: secili }}
                    onPress={() => setFiltre(f.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: secili
                          ? withAlpha(theme.accent, 0.18)
                          : theme.secondary,
                        borderColor: secili ? theme.accent : theme.border,
                      },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        styles.chipText,
                        {
                          color: secili ? theme.accent : theme.text.muted,
                        },
                      ]}
                    >
                      {i18nText(f.key, f.fallback)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        }
        renderItem={({ item }) =>
          item.tur === "baslik" ? (
            <Text
              allowFontScaling={false}
              style={[styles.sectionTitle, { color: theme.text.muted }]}
            >
              {i18nText(
                BOLUM_KEY[item.bolum],
                BOLUM_BASLIK[item.bolum]?.tr || item.bolum
              )}
            </Text>
          ) : (
            <View style={styles.badgeRow}>
              {item.rozetler.map((badge) => (
                <View key={badge.id} style={styles.badgeCell}>
                  <WatchBadgeCard
                    badge={badge}
                    compact
                    onPress={() => acDetay(badge)}
                  />
                </View>
              ))}
              {Array.from({ length: 4 - item.rozetler.length }).map(
                (_, index) => (
                  <View key={`bos_${index}`} style={styles.badgeCell} />
                )
              )}
            </View>
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppIcon
              family="Ionicons"
              name={loading ? "hourglass-outline" : "ribbon-outline"}
              size={34}
              color={theme.text.muted}
            />
            <Text
              allowFontScaling={false}
              style={[styles.emptyText, { color: theme.text.muted }]}
            >
              {loading
                ? i18nText(
                    "autoI18n.rozet_veri_okunuyor",
                    "İzleme verin okunuyor…"
                  )
                : filtre === "acik"
                ? i18nText(
                    "autoI18n.rozet_bos_acik",
                    "Henüz rozet açmadın. İlk karen seni bekliyor."
                  )
                : i18nText(
                    "autoI18n.rozet_bos_filtre",
                    "Bu filtrede rozet yok."
                  )}
            </Text>
          </View>
        }
      />

      <WatchBadgeDetailModal
        badge={secili}
        visible={!!secili}
        onClose={() => setSecili(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 66,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  listHeader: { paddingTop: 4 },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  chipText: { fontSize: 12, fontWeight: "850" },
  listContent: { paddingBottom: 34, gap: 8 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 6,
    marginHorizontal: 12,
  },
  badgeCell: { flex: 1, minWidth: 0 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.7,
    marginTop: 8,
    marginHorizontal: 12,
    textTransform: "uppercase",
  },
  empty: {
    alignItems: "center",
    gap: 10,
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 19,
  },
});
