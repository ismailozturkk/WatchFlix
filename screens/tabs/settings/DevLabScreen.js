// screens/tabs/settings/DevLabScreen.js
//
// Ayarlar > Geliştirici Laboratuvarı — YALNIZ __DEV__ (giriş satırı Ayarlar'da
// DevBadge ile, ekran kaydı App.js'te __DEV__ kapılı). Uygulamada beklemesi uzun
// ya da elle kurulması zor durumları düğmeyle anında görmek için:
//
//   • Lens yükleme göstergesi: tüm boylar (small/medium/large/screen + fill), iki ton
//   • Seri alevi simülatörü: hafta / gün / durum / kalkan seç → canlı rozet; istenirse
//     profildeki alev de bu sahte seriyi gösterir (services/devLab.js, bellekte)
//   • Turnuva adımları: seçim → son 32 → … → sonuç; geçen ayın kupa sayfası
//   • Rozet / Perde / Makara ve seri kutlamaları (gerçek kutlama kodu, kayıt yazmadan)
//   • Toast türleri, açılış animasyonu tekrarı
//   • Plan simülatörü + Debug ekranı kısayolu
//
// Metinler bilerek Türkçe ve çevrilmez: yalnız geliştiricinin gördüğü ekran.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import AppIcon from "@components/AppIcon";
import GlassBox from "../../../components/common/GlassBox";
import GlassTouchable from "../../../components/common/GlassTouchable";
import { DevBadge } from "../../../components/common/BetaBadge";
import LensLoader from "../../../components/LensLoader";
import SwitchToggle from "../../../components/SwitchToggle";
import SplashLensIntro from "../../../components/SplashLensIntro";
import StreakFlameBadge from "../../../components/streak/StreakFlameBadge";
import StreakFlame from "../../../components/streak/StreakFlame";
import { SKIA_FLAME_READY } from "../../../components/streak/SkiaStreakFlame";
import DevPlanSimulatorCard from "../../../components/settings/DevPlanSimulatorCard";
import DevTasteShadowCard from "../../../components/settings/DevTasteShadowCard";
import DevMatchLab from "../../../components/settings/DevMatchLab";
import toast from "../../../components/AppToast";
import { useTheme } from "@context/ThemeContext";
import { useLanguage } from "@context/LanguageContext";
import { alpha } from "@theme/colors";
import { SPARK_SHAPES, streakFlameState, streakLook } from "@utils/streakFlame";
import { LOADER_SIZES, resolveLoaderSize, screenScaleFor } from "../../../utils/lensLoaderMotion";
import { TOURNAMENT_DEV_PRESETS } from "../../../utils/tournamentDevPresets";
import {
  DEV_STREAK_MAX_DAYS,
  buildDevSeriler,
  resetDevLab,
  setDevFlameRenderer,
  setDevStreak,
  useDevStreak,
  useFlameRenderer,
} from "../../../services/devLab";
import { Chevron, SectionLabel, SettingRow, SettingsSubScreen, buildUiColors } from "./settingsUi";
import { showBadgeCelebration } from "../../../hooks/useBadgeCelebration";
import { showStreakCelebration } from "../../../hooks/useStreakCelebration";
import { DEV_BADGE_CELEBRATIONS as BADGE_CELEBRATIONS } from "../../../utils/devLabSamples";

const STREAK_PRESETS = [0, 1, 2, 4, 5, 8, 9, 12, 13, 15, 16, 20];
const STREAK_STEPS = [-4, -1, 1, 4];
const STATUS_LABELS = { lit: "Yanıyor", risk: "Risk ⌛", repair: "Telafi 🩹", shield: "Kalkan 🛡" };
const SPLASH_HOLD_MS = 2600;

function Chip({ label, active, onPress, C, testID }) {
  return (
    <GlassTouchable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: active ? C.accent : C.border, backgroundColor: active ? C.accentDim : C.cardAlt },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.chipText, { color: active ? C.accent : C.text }]}>
        {label}
      </Text>
    </GlassTouchable>
  );
}

function Card({ C, children, style }) {
  return (
    <GlassBox role="card" style={[styles.card, { backgroundColor: C.card, borderColor: C.border }, style]}>
      {children}
    </GlassBox>
  );
}

function Hint({ C, children }) {
  return (
    <Text allowFontScaling={false} style={[styles.hint, { color: C.muted }]}>
      {children}
    </Text>
  );
}

// ── Seri alevi önizlemesi (Skia shader ↔ SVG) ────────────────────────────────
// Simülatördeki hafta/gün/durumu büyük boyda çizer. Çizici seçimi profildeki
// alevi de etkiler (services/devLab, bellekte). "1→7 oynat" bu haftanın günlerini
// sırayla artırır: ihtişam kademeleri (katman → kıvılcım → uçuşan kıvılcım → taç → yıldız).
const FLAME_DARK_BG = "#0E0C14";
const STAGE_NAMES = ["tek", "çift", "üçlü", "kıvılcım", "uçuşan", "taç", "yıldız"];
const SHAPE_NAMES = { ember: "kor", star: "yıldız", diamond: "elmas", flake: "kar" };

function FlamePreviewLab({ C }) {
  const sim = useDevStreak();
  const renderer = useFlameRenderer();
  const [dark, setDark] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [full, setFull] = useState(false);
  const win = useWindowDimensions();
  // Kartın iç genişliği (ekran kenar boşluğu + kart dolgusu düşülür). Alev boyu bu
  // genişliğe göre: hale halkası ~1,25 × boy kaplar, kenara değmesin.
  const inner = Math.max(240, win.width - 60);
  const heroSize = Math.round(inner / 1.3);
  const stageSize = Math.round(inner / 3 / 1.35);
  const shapeSize = Math.round(inner / 2 / 1.35);
  const weeks = Math.max(1, sim.weeks);
  const dimmed = sim.status === "risk" || sim.status === "repair" || sim.status === "shield";
  const days = Math.max(1, sim.weekDays);
  const look = useMemo(() => streakLook(weeks, days), [weeks, days]);
  const stages = useMemo(() => [1, 2, 3, 4, 5, 6, 7].map((d) => streakLook(weeks, d)), [weeks]);
  // Kıvılcım biçimi 4 haftada bir: dört bölümün ilk haftaları (her biri 4. günde).
  const shapes = useMemo(
    () => [1, 5, 9, 13].map((week) => ({ week, look: streakLook(week, 4) })),
    [],
  );

  useEffect(() => {
    if (!playing) return undefined;
    setDevStreak({ weekDays: 1 });
    let day = 1;
    const id = setInterval(() => {
      day += 1;
      if (day > 7) {
        clearInterval(id);
        setPlaying(false);
        return;
      }
      setDevStreak({ weekDays: day });
    }, 1200);
    return () => clearInterval(id);
  }, [playing]);

  const stageBg = dark ? FLAME_DARK_BG : alpha(C.text, 0.04);
  const label = dark ? "rgba(255,255,255,0.62)" : C.muted;
  return (
    <Card C={C}>
      <View style={styles.wrap}>
        <Chip C={C} label="Skia" active={renderer === "skia"} onPress={() => setDevFlameRenderer("skia")} />
        <Chip C={C} label="SVG (eski)" active={renderer === "svg"} onPress={() => setDevFlameRenderer("svg")} />
        <Chip C={C} label={dark ? "Koyu zemin" : "Tema zemini"} active={dark} onPress={() => setDark((v) => !v)} />
        <Chip C={C} label={playing ? "Oynuyor…" : "1→7 gün oynat"} active={playing} onPress={() => setPlaying(true)} />
        <Chip C={C} label="Tam ekran ⤢" onPress={() => setFull(true)} />
      </View>
      {!SKIA_FLAME_READY ? <Hint C={C}>Skia shader derlenemedi: SVG yedeği çiziliyor.</Hint> : null}

      <GlassTouchable
        accessibilityRole="button"
        accessibilityLabel="Alevi tam ekranda aç"
        onPress={() => setFull(true)}
      >
        {/* Kırpma iç View'da: cam düğmenin kendisi overflow:hidden taşımaz (basma payı). */}
        <View style={[styles.flameHero, { backgroundColor: stageBg, height: Math.round(heroSize * 1.8) }]}>
          <StreakFlame look={look} size={heroSize} dimmed={dimmed} />
        </View>
      </GlassTouchable>
      <Text allowFontScaling={false} style={[styles.streakMeta, { color: C.muted }]}>
        {`${weeks}. hafta · renk ${look.palette.id} · kıvılcım ${SHAPE_NAMES[look.spark.shape]} ×${look.spark.count} · ihtişam ${look.stage}/7 (${STAGE_NAMES[look.stage - 1]})`}
      </Text>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>İhtişam kademeleri (bu haftanın günü)</Text>
      <View style={[styles.flameStrip, { backgroundColor: stageBg }]}>
        {stages.map((item, i) => (
          <View key={i} style={[styles.flameCell, { width: `${100 / 3 - 1}%`, paddingTop: stageSize * 0.45 }]}>
            <StreakFlame look={item} size={stageSize} />
            <Text allowFontScaling={false} style={[styles.loaderLabel, { color: label }]}>{`${i + 1} ${STAGE_NAMES[i]}`}</Text>
          </View>
        ))}
      </View>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Kıvılcım biçimi (4 haftada bir değişir)</Text>
      <View style={[styles.flameStrip, { backgroundColor: stageBg }]}>
        {shapes.map(({ week, look: item }) => (
          <View key={week} style={[styles.flameCell, { width: "48%", paddingTop: shapeSize * 0.45 }]}>
            <StreakFlame look={item} size={shapeSize} />
            <Text allowFontScaling={false} style={[styles.loaderLabel, { color: label }]}>{`${week}. hf ${SHAPE_NAMES[item.spark.shape]}`}</Text>
          </View>
        ))}
      </View>
      <Hint C={C}>{`Biçimler: ${SPARK_SHAPES.map((k) => SHAPE_NAMES[k]).join(" → ")}. Renk her hafta değişir: 16. haftada Efsane.`}</Hint>
      <Hint C={C}>Çizici seçimi profildeki alevi de değiştirir (yalnız bu oturum). Büyük aleve dokun: tam ekran.</Hint>
      {full ? (
        <FlameFullscreen
          C={C}
          look={look}
          dimmed={dimmed}
          weeks={weeks}
          days={days}
          onClose={() => setFull(false)}
        />
      ) : null}
    </Card>
  );
}

// Tam ekran alev: koyu zemin, ekranın büyük kısmını kaplayan alev; gün ve hafta
// buradan da değiştirilir (simülatörle aynı durum).
function FlameFullscreen({ C, look, dimmed, weeks, days, onClose }) {
  const win = useWindowDimensions();
  const size = Math.round(Math.min(win.width / 1.3, win.height * 0.4));
  return (
    <Modal visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={[styles.fullRoot, { backgroundColor: FLAME_DARK_BG }]}>
        <View style={styles.fullFlame}>
          <StreakFlame look={look} size={size} dimmed={dimmed} />
        </View>
        <View style={styles.fullControls}>
          <Text allowFontScaling={false} style={[styles.streakMeta, styles.fullMeta]}>
            {`${weeks}. hafta · ${look.palette.id} · ${SHAPE_NAMES[look.spark.shape]} · ihtişam ${look.stage}/7 (${STAGE_NAMES[look.stage - 1]})`}
          </Text>
          <View style={[styles.wrap, styles.fullRow]}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <Chip key={n} C={C} label={String(n)} active={days === n} onPress={() => setDevStreak({ weekDays: n })} />
            ))}
          </View>
          <View style={[styles.wrap, styles.fullRow]}>
            {STREAK_STEPS.map((d) => (
              <Chip key={d} C={C} label={`${d > 0 ? "+" : ""}${d} hf`} onPress={() => setDevStreak((p) => ({ weeks: Math.max(1, p.weeks + d) }))} />
            ))}
            <Chip C={C} label="Kapat ✕" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Lens yükleme göstergesi ────────────────────────────────────────────────────
function LoaderLab({ C }) {
  const [mono, setMono] = useState(false);
  const window = useWindowDimensions();
  const scale = screenScaleFor(window.width, window.height);
  const tone = mono ? "mono" : "brand";
  const names = Object.keys(LOADER_SIZES);
  return (
    <Card C={C}>
      <View style={styles.rowBetween}>
        <Text allowFontScaling={false} style={[styles.cardTitle, { color: C.text }]}>Ton: {mono ? "mono" : "brand"}</Text>
        <SwitchToggle value={mono} onValueChange={setMono} />
      </View>
      <View style={[styles.loaderStage, { backgroundColor: mono ? C.accent : alpha(C.text, 0.04) }]}>
        {names.map((name) => (
          <View key={name} style={styles.loaderCell}>
            <LensLoader size={name} tone={tone} color="#FFFFFF" />
            <Text allowFontScaling={false} style={[styles.loaderLabel, { color: mono ? "#FFFFFF" : C.muted }]}>
              {name} · {resolveLoaderSize(name, tone, scale)}px
            </Text>
          </View>
        ))}
      </View>
      <Hint C={C}>
        Ekran ölçeği ×{scale.toFixed(2)} (kısa kenar / 390). small düğmede küçülmez. "fill" kabın kısa kenarının ~%30'u:
      </Hint>
      <View style={styles.fillRow}>
        <View style={[styles.fillPoster, { backgroundColor: alpha(C.text, 0.06), borderColor: C.border }]}>
          <LensLoader size="fill" tone={tone} color="#FFFFFF" />
        </View>
        <View style={[styles.fillWide, { backgroundColor: alpha(C.text, 0.06), borderColor: C.border }]}>
          <LensLoader size="fill" tone={tone} color="#FFFFFF" />
        </View>
      </View>
      <View style={styles.buttonRow}>
        <View style={[styles.fakeButton, { backgroundColor: C.accent }]}>
          <LensLoader tone="mono" color="#FFFFFF" />
          <Text allowFontScaling={false} style={styles.fakeButtonText}>Kaydediliyor</Text>
        </View>
        <View style={[styles.fakeButton, { backgroundColor: C.cardAlt, borderColor: C.border, borderWidth: 1 }]}>
          <LensLoader size="small" />
          <Text allowFontScaling={false} style={[styles.fakeButtonText, { color: C.text }]}>Satır içi</Text>
        </View>
      </View>
      <Hint C={C}>Hareketi Azalt açıksa karadelikler sabit durur, yalnız saydamlık nefes alır.</Hint>
    </Card>
  );
}

// ── Seri alevi simülatörü ──────────────────────────────────────────────────────
function StreakLab({ C, theme, language }) {
  const sim = useDevStreak();
  const seriler = useMemo(() => buildDevSeriler(sim), [sim]);
  const state = useMemo(() => streakFlameState(seriler), [seriler]);
  const set = setDevStreak;
  return (
    <Card C={C}>
      <View style={styles.rowBetween}>
        <View style={styles.flex}>
          <Text allowFontScaling={false} style={[styles.cardTitle, { color: C.text }]}>Profilde de göster</Text>
          <Hint C={C}>Açıkken profildeki alev gerçek seri yerine bunu çizer. Diske yazılmaz.</Hint>
        </View>
        <SwitchToggle value={sim.enabled} onValueChange={(v) => set({ enabled: v })} />
      </View>

      <View style={[styles.streakStage, { backgroundColor: alpha(C.text, 0.04) }]}>
        {state.visible ? (
          <StreakFlameBadge seriler={seriler} theme={theme} language={language} size={26} />
        ) : (
          <Text allowFontScaling={false} style={[styles.hint, { color: C.muted }]}>0 haftada alev çizilmez</Text>
        )}
        <Text allowFontScaling={false} style={[styles.streakMeta, { color: C.muted }]}>
          {`renk ${state.level.tier} · kıvılcım ${state.look.spark.shape} · ihtişam ${state.look.stage}/7 · kademe ${state.level.index}`}
        </Text>
        <Hint C={C}>Rozete dokun: ayrıntı sayfası açılır.</Hint>
      </View>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Hafta: {sim.weeks}</Text>
      <View style={styles.wrap}>
        {STREAK_STEPS.map((d) => (
          <Chip key={d} C={C} label={d > 0 ? `+${d}` : `${d}`} onPress={() => set((p) => ({ weeks: p.weeks + d }))} />
        ))}
      </View>
      <View style={styles.wrap}>
        {STREAK_PRESETS.map((d) => (
          <Chip key={d} C={C} label={String(d)} active={sim.weeks === d} onPress={() => set({ weeks: d })} />
        ))}
      </View>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Bu haftanın günleri (ihtişam): {sim.weekDays}</Text>
      <View style={styles.wrap}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
          <Chip key={n} C={C} label={String(n)} active={sim.weekDays === n} onPress={() => set({ weekDays: n })} />
        ))}
      </View>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Durum</Text>
      <View style={styles.wrap}>
        {Object.entries(STATUS_LABELS).map(([key, label]) => (
          <Chip key={key} C={C} label={label} active={sim.status === key} onPress={() => set({ status: key })} />
        ))}
      </View>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Kalkan</Text>
      <View style={styles.wrap}>
        {[0, 1, 2, 3].map((n) => (
          <Chip key={n} C={C} label={"🛡".repeat(n) || "yok"} active={sim.shields === n} onPress={() => set({ shields: n })} />
        ))}
      </View>
      {sim.status === "repair" ? (
        <>
          <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Telafi ilerlemesi</Text>
          <View style={styles.wrap}>
            {[0, 1, 2, 3].map((n) => (
              <Chip key={n} C={C} label={`${n}/4`} active={sim.repairHave === n} onPress={() => set({ repairHave: n })} />
            ))}
          </View>
        </>
      ) : null}

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Rekor: {Math.max(sim.record, sim.weeks)}</Text>
      <View style={styles.wrap}>
        {[0, 10, 52, DEV_STREAK_MAX_DAYS].map((n) => (
          <Chip key={n} C={C} label={n === 0 ? "= hafta" : String(n)} active={sim.record === n} onPress={() => set({ record: n })} />
        ))}
        <Chip C={C} label="Sıfırla" onPress={resetDevLab} />
      </View>

      <Text allowFontScaling={false} style={[styles.subTitle, { color: C.text }]}>Kutlama (toast)</Text>
      <View style={styles.wrap}>
        {STREAK_CELEBRATIONS.map((c) => (
          <Chip key={c.label} C={C} label={c.label} onPress={() => showStreakCelebration(c.build(sim), language)} />
        ))}
      </View>
    </Card>
  );
}

// Seri kutlaması: streakCelebrationStep çıktısı biçiminde (celebrate / patch).
const flameAt = (weeks, extra) => streakFlameState(buildDevSeriler({ weeks, weekDays: 2, status: "lit", shields: 1, ...extra }));
const STREAK_CELEBRATIONS = [
  { label: "Alev yandı", build: () => ({ celebrate: { kind: "lit", state: flameAt(1) } }) },
  { label: "Yeni hafta", build: (sim) => ({ celebrate: { kind: "week", state: flameAt(Math.max(2, sim.weeks)) } }) },
  { label: "Yeni renk", build: (sim) => ({ celebrate: { kind: "tier", state: flameAt(Math.max(5, sim.weeks)) } }) },
  { label: "Telafi edildi", build: (sim) => ({ patch: { tur: "telafi", state: flameAt(Math.max(1, sim.weeks)) } }) },
  { label: "Kalkan korudu", build: (sim) => ({ patch: { tur: "kalkan", state: flameAt(Math.max(1, sim.weeks)) } }) },
];

// ── Rozet kutlaması ────────────────────────────────────────────────────────────
function BadgeLab({ C, language }) {
  return (
    <Card C={C}>
      <Hint C={C}>
        Gerçek kutlama kodu çalışır (toast + titreşim); kart dokununca Rozetler ekranında o rozeti açar. Kazanılmış sayılmaz.
      </Hint>
      <View style={styles.wrap}>
        {BADGE_CELEBRATIONS.map((b) => (
          <Chip key={b.label} C={C} label={b.label} onPress={() => showBadgeCelebration(b.kutlama(), language)} />
        ))}
      </View>
    </Card>
  );
}

// ── Turnuva adımları ───────────────────────────────────────────────────────────
function TournamentLab({ C, navigation }) {
  const open = (params) => navigation.navigate("TournamentScreen", params);
  return (
    <Card C={C}>
      <Hint C={C}>
        Turnuva ekranını o fazın gününe sabitlenmiş saatle açar. "Gerçek" saati geri bırakır (ekrandaki DEV şeridi de aynı).
      </Hint>
      <View style={styles.wrap}>
        {TOURNAMENT_DEV_PRESETS.map((p) => (
          <Chip key={p.key} C={C} label={p.label} onPress={() => open({ devPreset: p.key, devNonce: Date.now() })} />
        ))}
      </View>
      <View style={styles.wrap}>
        <Chip C={C} label="🏆 Geçen ayın kupası" onPress={() => open({ devOpenPodium: Date.now() })} />
      </View>
    </Card>
  );
}

// ── Toast + açılış ─────────────────────────────────────────────────────────────
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const TOASTS = [
  { label: "Başarı", run: () => toast.success("Kaydedildi", "Listeye eklendi") },
  { label: "Hata", run: () => toast.error("Olmadı", "Bağlantını kontrol et") },
  { label: "Uyarı", run: () => toast.warning("Dikkat", "Günlük sınıra yaklaştın") },
  { label: "Bilgi", run: () => toast.info("Bilgi", "Yeni bölüm yayında") },
  { label: "Premium", run: () => toast.premium("Premium aktif", "Tüm özellikler açık") },
  {
    label: "Yükleniyor → bitti",
    run: () => toast.promise(wait(2500), { loading: "Yükleniyor…", success: "Bitti", error: "Olmadı" }),
  },
  { label: "Geri al", run: () => toast.undo("Silindi", () => toast.info("Geri alındı")) },
];

function SplashReplay({ visible, onClose, background }) {
  const [exiting, setExiting] = useState(false);
  useEffect(() => {
    if (!visible) return undefined;
    setExiting(false);
    const id = setTimeout(() => setExiting(true), SPLASH_HOLD_MS);
    return () => clearTimeout(id);
  }, [visible]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={onClose}>
      <SplashLensIntro exiting={exiting} onExited={onClose} background={background} />
    </Modal>
  );
}

export default function DevLabScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { language } = useLanguage();
  const C = buildUiColors(theme);
  const [splash, setSplash] = useState(false);
  const closeSplash = useCallback(() => setSplash(false), []);

  if (!__DEV__) return null;

  return (
    <SettingsSubScreen title="Geliştirici Laboratuvarı">
      <View style={styles.intro}>
        <DevBadge />
        <Hint C={C}>Yalnız geliştirme build'inde görünür. Buradaki ayarlar bellekte durur, uygulama yeniden açılınca sıfırlanır.</Hint>
      </View>

      <SectionLabel color={C.muted}>Yükleme göstergesi (LensLoader)</SectionLabel>
      <LoaderLab C={C} />

      <SectionLabel color={C.muted}>Seri alevi</SectionLabel>
      <StreakLab C={C} theme={theme} language={language} />

      <SectionLabel color={C.muted}>Alev önizlemesi (Skia shader)</SectionLabel>
      <FlamePreviewLab C={C} />

      <SectionLabel color={C.muted}>Rozet kutlaması</SectionLabel>
      <BadgeLab C={C} language={language} />

      <SectionLabel color={C.muted}>Turnuva adımları</SectionLabel>
      <TournamentLab C={C} navigation={navigation} />

      <SectionLabel color={C.muted}>Bildirim kartları (toast)</SectionLabel>
      <Card C={C}>
        <View style={styles.wrap}>
          {TOASTS.map((t) => (
            <Chip key={t.label} C={C} label={t.label} onPress={t.run} />
          ))}
        </View>
      </Card>

      <SectionLabel color={C.muted}>Zevk uyumu: eski / yeni (gölge mod)</SectionLabel>
      <DevTasteShadowCard C={C} />

      <SectionLabel color={C.muted}>Zevk Çemberleri: öneri durumları (sahte veri)</SectionLabel>
      <DevMatchLab C={C} language={language} />

      <SectionLabel color={C.muted}>Diğer</SectionLabel>
      <Card C={C} style={styles.listCard}>
        <SettingRow
          colors={C}
          iconBg={C.iconPurple}
          iconColor={C.purple}
          iconName="sparkles-outline"
          title="Açılış animasyonunu oynat"
          subtitle="Yıldızların çarpışıp Lens'e dönüşmesi"
          onPress={() => setSplash(true)}
          right={<AppIcon family="Ionicons" name="play" size={16} color={C.muted} />}
        />
        <SettingRow
          colors={C}
          iconBg={C.iconBlue}
          iconColor={C.blue}
          iconName="analytics-outline"
          title="Debug (kullanım / maliyet)"
          onPress={() => __DEV__ && navigation.navigate("UsageDebugScreen")}
          right={<Chevron color={C.muted} />}
          last
        />
      </Card>
      <DevPlanSimulatorCard />

      <SplashReplay visible={splash} onClose={closeSplash} background={theme.primary} />
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  intro: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, marginBottom: 12 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, marginBottom: 18, gap: 10 },
  listCard: { padding: 0, gap: 0 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  subTitle: { fontSize: 13, fontWeight: "700", marginTop: 4 },
  hint: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 12.5, fontWeight: "700" },
  loaderStage: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-around",
    gap: 12,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  loaderCell: { alignItems: "center", gap: 6 },
  loaderLabel: { fontSize: 11, fontWeight: "600" },
  fillRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  fillPoster: { width: 96, aspectRatio: 2 / 3, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  fillWide: { flex: 1, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  buttonRow: { flexDirection: "row", gap: 10 },
  fakeButton: {
    flex: 1,
    height: 44,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  fakeButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  streakStage: { alignItems: "center", gap: 8, borderRadius: 14, paddingVertical: 18 },
  streakMeta: { fontSize: 11.5, fontWeight: "600" },
  flameHero: { alignItems: "center", justifyContent: "center", borderRadius: 14, overflow: "hidden" },
  fullRoot: { flex: 1, paddingTop: 60, paddingBottom: 40, paddingHorizontal: 16 },
  fullFlame: { flex: 1, alignItems: "center", justifyContent: "center" },
  fullControls: { gap: 12 },
  fullMeta: { color: "rgba(255,255,255,0.7)", textAlign: "center" },
  fullRow: { justifyContent: "center" },
  flameStrip: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    justifyContent: "space-around",
    rowGap: 18,
    borderRadius: 14,
    paddingTop: 34,
    paddingBottom: 12,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  flameCell: { alignItems: "center", gap: 10 },
});
