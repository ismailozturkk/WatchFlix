// screens/tabs/profile/WatchBadgesScreen.js
//
// İzleme rozetleri ekranı — 81 rozet, kademeli aileler tek karoya indirilmiş.
// Ayrıca çalışma anında üretilen iki bölüm: dönem mühürleri ve koleksiyonlar.
//
// EKRANIN YAPISI (yukarıdan aşağı), her katman bir soruyu cevaplar:
//   1. Perde kartı           — "Ne seviyedeyim?"            (puan)
//   2. Özet kartı            — "Kaç rozetim açık?"          (koleksiyon, nadirlik dağılımı)
//   3. Sıradaki hedefler     — "Şimdi neyin peşinde koşmalıyım?"
//   4. Son kazanılanlar      — "En son ne kazandım?"
//   5. Süzgeçler             — durum (Tümü/Açık/Kilitli) + bölüm
//   6. Izgara                — arşiv: bölüm bölüm tüm rozetler
// Eskiden yalnızca 1 ve 6 vardı; kullanıcının iki acil sorusu (3 ve 4) ızgaranın
// dibinde, "tamamlanmaya en yakın önce" sıralamasının içinde kayboluyordu.
//
// FlatList ZORUNLU (.map değil): bölüm başlıkları dahil çok sayıda AppBadge (SVG)
// içeriyor. Sanallaştırma olmadan her scroll karesinde tüm SVG'ler ölçülür.
//
// ROZETLER ÜÇ SÜTUN. Eski dört sütun 40 px'lik rozet ve 7,5 px yazıyla çiziyordu;
// okunamıyordu (bkz. components/badges/WatchBadgeTile.js).
//
// SIRALAMA "tamamlanmaya en yakın önce" (bölüm İÇİNDE): rozet ekranının işi envanter
// göstermek değil SONRAKİ HEDEFİ göstermektir. Alfabetik ya da katalog sırası,
// kullanıcının 3 adım uzaktaki rozetini 40 satır aşağıya gömer.
//
// DERİN BAĞLANTI: kutlama bildirimine dokunmak `openId` ile gelir ve o rozetin
// detay sayfasını doğrudan açar.

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppIcon from "@components/AppIcon";
import BackButton from "@components/BackButton";
import ScreenDecor from "@components/ScreenDecor";
import StaggerItem from "@components/StaggerItem";
import BadgeControls from "@components/badges/BadgeControls";
import { BadgeRail, HedefKarti, SonKarti } from "@components/badges/BadgeRail";
import BadgeSummaryCard from "@components/badges/BadgeSummaryCard";
import WatchBadgeCard from "@components/badges/WatchBadgeCard";
import WatchBadgeDetailModal from "@components/badges/WatchBadgeDetailModal";
import WatchLevelCard from "@components/profile/WatchLevelCard";
import { BOLUM_BASLIK } from "@components/badges/watchBadgeCatalog";
import {
  bolumOzetleri,
  izgaraSatirlari,
  kartBul,
  nadirlikDagilimi,
  sonKazanilanlar,
  yaklasanlar,
} from "@components/badges/badgeInsights";
import { useTheme } from "@context/ThemeContext";
import { useWatchProgressContext } from "@context/WatchProgressContext";
import useEntranceGate from "@hooks/useEntranceGate";
import { withAlpha } from "@components/profile/StatsComponents";
import { i18nText } from "@utils/i18nText";

const SUTUN = 3;   // ızgara sütunu (satır kurma: badgeInsights.izgaraSatirlari)

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
const bolumAdi = (bolum) => i18nText(BOLUM_KEY[bolum], BOLUM_BASLIK[bolum]?.tr || bolum);

export default function WatchBadgesScreen({ navigation, route }) {
  const { theme } = useTheme();
  const [filtre, setFiltre] = useState("tumu");
  const [bolum, setBolum] = useState(null);
  // Detay sayfası. `null` = kapalı. Kart nesnesinin KENDİSİ tutulur, id değil:
  // id tutup her render'da `kartlar` içinden aramak, süzgeç değişince (kart listeden
  // düşerse) sayfayı boşa düşürürdü.
  const [secili, setSecili] = useState(null);

  // Context'ten: bu ekran açıldığında ProfileScreen stack'te mount'ta kalıyor, yani
  // hook'u burada da çağırmak defter mutabakatını ikiye katlardı.
  const watchProgress = useWatchProgressContext() || { loading: true };
  const { loading, kartlar, rozetler, acikSayisi, toplamRozet, ilkTohum, tohumRozetSayisi } = watchProgress;

  const acDetay = useCallback((b) => setSecili(b), []);
  const kapatDetay = useCallback(() => setSecili(null), []);

  // Kutlama bildirimine dokunulduğunda ilgili rozetin sayfasını aç.
  const openId = route?.params?.openId;
  useEffect(() => {
    if (!openId || !kartlar?.length) return;
    const kart = kartBul(kartlar, openId);
    if (kart) setSecili(kart);
    // Parametreyi tüket: geri gelindiğinde ya da veri yenilendiğinde sayfa tekrar açılmasın.
    navigation?.setParams?.({ openId: undefined });
  }, [openId, kartlar, navigation]);

  const simdi = useMemo(() => Date.now(), [kartlar]); // eslint-disable-line react-hooks/exhaustive-deps
  const yaklasan = useMemo(() => yaklasanlar(kartlar, { limit: 6 }), [kartlar]);
  const son = useMemo(() => sonKazanilanlar(kartlar, { limit: 8, gun: 30, simdi }), [kartlar, simdi]);
  const ozetler = useMemo(() => bolumOzetleri(kartlar), [kartlar]);
  const ozetMap = useMemo(() => Object.fromEntries(ozetler.map((o) => [o.bolum, o])), [ozetler]);
  const dagilim = useMemo(() => nadirlikDagilimi(rozetler), [rozetler]);
  const veri = useMemo(() => izgaraSatirlari(kartlar, filtre, bolum), [kartlar, filtre, bolum]);

  // Izgara satırları ilk yüklenirken kademeli girer; sonra (süzgeç değişimi,
  // kaydırma) animasyon yok — bkz. hooks/useEntranceGate.js.
  const shouldAnimate = useEntranceGate(!loading && !!kartlar?.length);

  const baslik = i18nText("autoI18n.rozetlerim", "Rozetlerim");
  // Sistemi ilk açan mevcut kullanıcıya "Tebrikler, 31 rozet kazandın" demek yalan
  // olur — onları bugün kazanmadı. "Arşivin açıldı" envanter dilidir, ödül dili değil.
  const altBaslik =
    ilkTohum && tohumRozetSayisi > 0
      ? i18nText("autoI18n.rozet_arsiv_acildi", `Arşivin açıldı — ${tohumRozetSayisi} rozet zaten senindi`, { n: tohumRozetSayisi })
      : i18nText("autoI18n.rozet_acildi_sayaci", `${acikSayisi}/${toplamRozet} açıldı`, { acik: acikSayisi, toplam: toplamRozet });

  const ustBlok = (
    <View style={styles.ust}>
      <WatchLevelCard progress={watchProgress} showNearest={false} style={styles.tamGenislik} />
      {!loading && toplamRozet > 0 ? (
        <BadgeSummaryCard acik={acikSayisi} toplam={toplamRozet} dagilim={dagilim} style={styles.ozet} />
      ) : null}
    </View>
  );

  const raflar =
    !loading && kartlar?.length ? (
      <View>
        {yaklasan.length ? (
          <BadgeRail
            baslik={i18nText("autoI18n.rozet_sirada_baslik", "Sıradaki hedefler")}
            altBaslik={i18nText("autoI18n.rozet_sirada_alt", "Tamamlanmaya en yakın")}
          >
            {yaklasan.map(({ kart }) => (
              <HedefKarti key={kart.id} kart={kart} onPress={() => acDetay(kart)} />
            ))}
          </BadgeRail>
        ) : null}
        {son.length ? (
          <BadgeRail
            baslik={i18nText("autoI18n.rozet_son_baslik", "Son kazanılanlar")}
            altBaslik={i18nText("autoI18n.rozet_son_alt", "Son 30 gün")}
          >
            {son.map((kart) => (
              <SonKarti key={kart.id} kart={kart} simdi={simdi} onPress={() => acDetay(kart)} />
            ))}
          </BadgeRail>
        ) : null}
        <BadgeControls
          filtre={filtre}
          onFiltre={setFiltre}
          bolum={bolum}
          onBolum={setBolum}
          ozetler={ozetler}
          bolumAd={bolumAdi}
        />
      </View>
    ) : null;

  const renderItem = ({ item, index }) => {
    if (item.tur === "baslik") {
      const o = ozetMap[item.bolum];
      return (
        <View style={styles.bolumBaslik}>
          <Text allowFontScaling={false} style={[styles.bolumAd, { color: theme.text.primary }]}>
            {bolumAdi(item.bolum)}
          </Text>
          {o ? (
            <Text allowFontScaling={false} style={[styles.bolumSayi, { color: theme.text.muted }]}>
              {o.acik}/{o.toplam}
            </Text>
          ) : null}
          <View style={styles.bolumBosluk} />
          {o ? (
            <View style={[styles.bolumIz, { backgroundColor: withAlpha(theme.text.muted, 0.2) }]}>
              <View style={[styles.bolumDolgu, { backgroundColor: theme.accent, width: `${Math.round(o.oran * 100)}%` }]} />
            </View>
          ) : null}
        </View>
      );
    }
    return (
      <StaggerItem index={index} animate={shouldAnimate()} style={styles.badgeRow}>
        {item.rozetler.map((badge) => (
          <View key={badge.id} style={styles.badgeCell}>
            <WatchBadgeCard badge={badge} compact onPress={() => acDetay(badge)} />
          </View>
        ))}
        {Array.from({ length: SUTUN - item.rozetler.length }).map((_, i) => (
          <View key={`bos_${i}`} style={styles.badgeCell} />
        ))}
      </StaggerItem>
    );
  };

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.primary }]}>
      {/* Arka plan dekoru (ikon deseni + kar) — içeriğin ARKASINDA */}
      <ScreenDecor scope="profile" iconOpacity={0.3} />
      <View style={styles.header}>
        <BackButton absolute={false} onPress={() => navigation.goBack()} />
        <View style={styles.headerCopy}>
          <Text allowFontScaling={false} style={[styles.title, { color: theme.text.primary }]}>
            {baslik}
          </Text>
          <Text allowFontScaling={false} style={[styles.subtitle, { color: theme.text.muted }]}>
            {loading ? i18nText("autoI18n.rozet_hesaplaniyor", "Hesaplanıyor…") : altBaslik}
          </Text>
        </View>
      </View>

      <FlatList
        data={veri}
        keyExtractor={(item) => item.id}
        // ELEMENT veriyoruz, fonksiyon DEĞİL: fonksiyon bileşen TİPİ olur ve üst bloğun
        // kendi state'i değişince söküp yeniden kurulur (bkz. reanimated-initial-value-vanish).
        ListHeaderComponent={
          <View>
            {ustBlok}
            {raflar}
          </View>
        }
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        removeClippedSubviews
        ListEmptyComponent={
          <View style={styles.empty}>
            <AppIcon
              family="Ionicons"
              name={loading ? "hourglass-outline" : filtre === "kilitli" ? "trophy-outline" : "ribbon-outline"}
              size={34}
              color={theme.text.muted}
            />
            <Text allowFontScaling={false} style={[styles.emptyText, { color: theme.text.muted }]}>
              {loading
                ? i18nText("autoI18n.rozet_veri_okunuyor", "İzleme verin okunuyor…")
                : filtre === "acik"
                  ? i18nText("autoI18n.rozet_bos_acik", "Henüz rozet açmadın. İlk karen seni bekliyor.")
                  : filtre === "kilitli"
                    ? i18nText("autoI18n.rozet_bos_kilitli", "Burada kilitli rozet kalmadı. Harikasın!")
                    : i18nText("autoI18n.rozet_bos_filtre", "Bu filtrede rozet yok.")}
            </Text>
          </View>
        }
      />

      <WatchBadgeDetailModal badge={secili} visible={!!secili} onClose={kapatDetay} />
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
  headerCopy: { flex: 1 },
  title: { fontSize: 22, fontWeight: "900" },
  subtitle: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  ust: { paddingHorizontal: 14, paddingTop: 4 },
  // WatchLevelCard varsayılan olarak %90 genişlikte (profil kolonu); burada ızgarayla
  // aynı 14 px kenar boşluğuna oturur.
  tamGenislik: { width: "100%" },
  ozet: { marginTop: 12 },
  listContent: { paddingBottom: 40 },
  badgeRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 8,
    marginHorizontal: 14,
    marginBottom: 8,
  },
  badgeCell: { flex: 1, minWidth: 0 },
  bolumBaslik: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
    marginHorizontal: 16,
  },
  bolumAd: { fontSize: 16, fontWeight: "900", letterSpacing: -0.2 },
  bolumSayi: { fontSize: 12.5, fontWeight: "800" },
  bolumBosluk: { flex: 1 },
  bolumIz: { width: 64, height: 5, borderRadius: 3, overflow: "hidden" },
  bolumDolgu: { height: "100%", borderRadius: 3 },
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
