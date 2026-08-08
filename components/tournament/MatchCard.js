// components/tournament/MatchCard.js
//
// Tek bir eleme maçı: yan yana iki poster. OYLAMA = POSTERE BASIP SEÇENEK SEÇME:
//   1. basış → o posterin üzerinde onay katmanı açılır (hafif büyür)
//   2. adım  → katmandaki İKİ seçenekten biri:
//        • Onayla → oy kaydedilir (onVote), değiştirilemez
//        • Bilgi  → yapımın detay sayfasına gider (onInfo)
//      Katmanın BOŞLUĞUNA basmak vazgeçer. Diğer postere basmak beklemeyi oraya
//      taşır; hiç dokunulmazsa PENDING_TIMEOUT sonunda kendiliğinden kapanır.
//
// Onay bilerek "tekrar bas" değil AÇIK SEÇİM: oy geri alınamıyor, kullanıcı
// karar vermeden önce yapımın detayına gidebilmeli.
//
// Ayrıca: canlı oy yüzdesi barları, "senin oyun" rozeti, tur bittiğinde kazanan
// kupası + kaybedenin solması, henüz belli olmayan rakip için "?" yer tutucu.

import React, { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "@services/hapticsService";
import AppIcon from "@components/AppIcon";
import { i18nText } from "@utils/i18nText";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { mass: 0.5, damping: 13, stiffness: 200 };
// Basış geri bildirimi: parmak inince poster küçülür, kalkınca yayla döner.
const PRESS_SCALE = 0.95;
// Uygulamanın onay/başarı yeşili — finalist rozeti ve "Hype verildi" çipiyle
// AYNI değer (temada `success` belirteci yok, turnuva ekranı bunu sabit kullanır).
const CONFIRM_GREEN = "#22C55E";
// Katmanda artık okunacak iki seçenek var; eski 2.6 sn karar vermeye yetmiyordu.
const PENDING_TIMEOUT = 6000;

// ─── Tek poster hücresi ───────────────────────────────────────────────────────
function Cell({
  side, contestant, votes, total, pct,
  isMyPick, isWinner, isLoser, isPending, locked,
  onPress, onConfirm, onInfo, theme, getTmdbUrl, lang,
}) {
  // İki ölçek AYRI tutulup çarpılır: biri parmak basılıyken küçültür, diğeri
  // onay katmanı açıkken kartı hafifçe öne çıkarır. Tek değere yazsalardı
  // basış bırakıldığında pending büyümesi de sıfırlanırdı.
  const press = useSharedValue(1);
  const lift = useSharedValue(1);

  useEffect(() => {
    lift.value = withSpring(isPending ? 1.045 : 1, PRESS_SPRING);
  }, [isPending]);

  const aStyle = useAnimatedStyle(() => ({
    transform: [{ scale: press.value * lift.value }],
  }));

  const empty = !contestant;
  const uri = !empty && contestant.posterPath ? getTmdbUrl(contestant.posterPath, "poster", 185) : null;
  const ringColor = isMyPick ? theme.accent : isWinner ? "#F5C518" : "transparent";

  return (
    <AnimatedPressable
      disabled={empty || locked}
      onPress={() => onPress(side)}
      onPressIn={() => { press.value = withSpring(PRESS_SCALE, PRESS_SPRING); }}
      onPressOut={() => { press.value = withSpring(1, PRESS_SPRING); }}
      style={[styles.cell, aStyle]}
    >
      <View
        style={[
          styles.posterWrap,
          {
            backgroundColor: theme.between,
            borderColor: ringColor,
            borderWidth: isMyPick || isWinner ? 2.5 : 0,
            opacity: isLoser ? 0.45 : 1,
          },
        ]}
      >
        {uri ? (
          <Image source={{ uri }} style={styles.poster} contentFit="cover" transition={150} />
        ) : (
          <View style={[styles.poster, styles.posterEmpty]}>
            <AppIcon family="Ionicons" name={empty ? "help" : "image-outline"} size={26} color={theme.text.muted} />
          </View>
        )}

        {/* Seed rozeti */}
        {!empty && (
          <View style={[styles.seedBadge, { backgroundColor: theme.primary + "E6" }]}>
            <Text style={[styles.seedText, { color: theme.text.secondary }]}>#{contestant.seed}</Text>
          </View>
        )}

        {/* Kazanan kupası */}
        {isWinner && (
          <View style={styles.crown}>
            <AppIcon family="Ionicons" name="trophy" size={16} color="#F5C518" />
          </View>
        )}

        {/* Senin oyun rozeti */}
        {isMyPick && !isWinner && (
          <View style={[styles.myPickBadge, { backgroundColor: theme.accent }]}>
            <AppIcon family="Ionicons" name="checkmark" size={13} color="#fff" />
          </View>
        )}

        {/* Alt: başlık + oy barı */}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.85)"]}
          style={styles.posterFooter}
          pointerEvents="none"
        >
          <Text numberOfLines={2} style={styles.title}>
            {empty ? i18nText("autoI18n.tournament_tbd", "Belli değil") : contestant.title}
          </Text>
          {(total > 0) && (
            <View style={styles.barRow}>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.barFill,
                    { width: `${pct}%`, backgroundColor: isMyPick ? theme.accent : "#F5C518" },
                  ]}
                />
              </View>
              <Text style={styles.pctText}>%{pct}</Text>
            </View>
          )}
        </LinearGradient>

        {/* Onay katmanı: posteri TAM kaplayan iki yarım buton.
            Üst yarı Onayla (beyaz), alt yarı Bilgi (accent). İkisi de dairesel
            ikon rozeti + etiket taşır; üzerlerindeki şeffaf→koyu gradyan düz
            dolguya derinlik verir (accent'in tonunu bilmeye gerek kalmadan).
            Yarımlar zıt yönlerden girer: katman "ortadan açılıyor" hissi verir.
            Poster tamamen kapandığı için vazgeçme kartın boşluğundan (VS
            dairesi/kenarlar) ya da PENDING_TIMEOUT ile olur. */}
        {isPending && (
          <View style={styles.confirmOverlay}>
            <Animated.View entering={FadeInDown.duration(170)} style={styles.confirmHalf}>
              <Pressable
                onPress={() => onConfirm(side)}
                style={({ pressed }) => [
                  styles.confirmHalfInner,
                  styles.confirmHalfPrimary,
                  pressed && styles.confirmHalfPressed,
                ]}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.16)", "rgba(0,0,0,0.22)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.confirmBadgeLight}>
                  <AppIcon family="Ionicons" name="checkmark-sharp" size={19} color="#fff" />
                </View>
                <Text numberOfLines={1} style={[styles.confirmHalfText, { color: "#fff" }]}>
                  {i18nText("autoI18n.tournament_confirm_short", "Onayla")}
                </Text>
              </Pressable>
            </Animated.View>

            <Animated.View entering={FadeInUp.duration(170)} style={styles.confirmHalf}>
              <Pressable
                onPress={() => onInfo(side)}
                style={({ pressed }) => [
                  styles.confirmHalfInner,
                  styles.confirmHalfInfo,
                  { backgroundColor: theme.accent },
                  pressed && styles.confirmHalfPressed,
                ]}
                accessibilityRole="button"
              >
                <LinearGradient
                  colors={["rgba(255,255,255,0.16)", "rgba(0,0,0,0.22)"]}
                  style={StyleSheet.absoluteFill}
                  pointerEvents="none"
                />
                <View style={styles.confirmBadgeLight}>
                  <AppIcon family="Ionicons" name="information" size={19} color="#fff" />
                </View>
                <Text numberOfLines={1} style={[styles.confirmHalfText, { color: "#fff" }]}>
                  {i18nText("autoI18n.tournament_info", "Bilgi")}
                </Text>
              </Pressable>
            </Animated.View>
          </View>
        )}
      </View>
    </AnimatedPressable>
  );
}

// ─── Maç ──────────────────────────────────────────────────────────────────────
export default function MatchCard({
  match, mySide, votable, onVote, onInfo,
  theme, getTmdbUrl, lang = "tr", hapticsEnabled = true,
}) {
  const [pending, setPending] = useState(null); // "a" | "b" | null
  const timer = useRef(null);

  const clearPending = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    setPending(null);
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Postere basış: onay katmanını açar (veya beklemeyi diğer tarafa taşır).
  // Onay artık "aynı yere tekrar basmak" değil, katmandaki açık seçim.
  const handlePress = useCallback(
    (side) => {
      if (!votable) return;
      const contestant = side === "a" ? match.a : match.b;
      if (!contestant) return;
      if (hapticsEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setPending(side);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setPending(null), PENDING_TIMEOUT);
    },
    [votable, match, hapticsEnabled],
  );

  const handleConfirm = useCallback(
    (side) => {
      clearPending();
      if (hapticsEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onVote?.(match.matchId, side);
    },
    [clearPending, hapticsEnabled, onVote, match.matchId],
  );

  // Detaya giderken katman kapanmalı: geri dönüldüğünde açık kalmasın.
  const handleInfo = useCallback(
    (side) => {
      const contestant = side === "a" ? match.a : match.b;
      clearPending();
      if (contestant) onInfo?.(contestant);
    },
    [clearPending, onInfo, match],
  );

  const total = match.total || 0;
  const aPct = total > 0 ? Math.round((match.aVotes / total) * 100) : 0;
  const bPct = total > 0 ? Math.max(0, 100 - aPct) : 0;
  const showWinner = match.decided && !!match.winnerSide;

  return (
    // Butonlar posteri tam kapladığı için vazgeçme alanı posterin DIŞINDA:
    // kartın boşluğuna (VS dairesi / kenarlar) basmak katmanı kapatır.
    <Pressable
      onPress={pending ? clearPending : undefined}
      style={[styles.match, { backgroundColor: theme.secondary, borderColor: theme.border }]}
    >
      <Cell
        side="a"
        contestant={match.a}
        votes={match.aVotes}
        total={total}
        pct={aPct}
        isMyPick={mySide === "a"}
        isWinner={showWinner && match.winnerSide === "a"}
        isLoser={showWinner && match.winnerSide === "b"}
        isPending={pending === "a"}
        locked={!votable}
        onPress={handlePress}
        onConfirm={handleConfirm}
        onInfo={handleInfo}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />

      <View style={styles.vsWrap}>
        <View style={[styles.vsCircle, { backgroundColor: theme.primary, borderColor: theme.border }]}>
          <Text style={[styles.vsText, { color: theme.text.secondary }]}>VS</Text>
        </View>
      </View>

      <Cell
        side="b"
        contestant={match.b}
        votes={match.bVotes}
        total={total}
        pct={bPct}
        isMyPick={mySide === "b"}
        isWinner={showWinner && match.winnerSide === "b"}
        isLoser={showWinner && match.winnerSide === "a"}
        isPending={pending === "b"}
        locked={!votable}
        onPress={handlePress}
        onConfirm={handleConfirm}
        onInfo={handleInfo}
        theme={theme}
        getTmdbUrl={getTmdbUrl}
        lang={lang}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  match: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    padding: 10,
    marginBottom: 12,
  },
  cell: { flex: 1 },
  posterWrap: {
    width: "100%",
    aspectRatio: 2 / 3,
    borderRadius: 12,
    overflow: "hidden",
  },
  poster: { width: "100%", height: "100%" },
  posterEmpty: { alignItems: "center", justifyContent: "center" },
  seedBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 7,
  },
  seedText: { fontSize: 10, fontWeight: "800" },
  crown: {
    position: "absolute",
    top: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderRadius: 11,
    padding: 4,
  },
  myPickBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 11,
    padding: 3,
  },
  posterFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 7,
    paddingTop: 16,
    paddingBottom: 7,
  },
  title: { color: "#fff", fontSize: 11.5, fontWeight: "700", lineHeight: 14 },
  barRow: { flexDirection: "row", alignItems: "center", marginTop: 5 },
  barTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.25)",
    overflow: "hidden",
  },
  barFill: { height: "100%", borderRadius: 3 },
  pctText: { color: "#fff", fontSize: 10, fontWeight: "800", marginLeft: 6, width: 34, textAlign: "right" },
  // Posteri tam kaplayan iki yarım buton (üst: Onayla, alt: Bilgi).
  confirmOverlay: { ...StyleSheet.absoluteFill, flexDirection: "column" },
  confirmHalf: { flex: 1 },
  confirmHalfInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  // Yeşil = onay, accent = bilgi. İki yarım yapı olarak AYNI (yarı saydam beyaz
  // rozet + beyaz etiket), yalnız rengiyle ayrışır.
  confirmHalfPrimary: { backgroundColor: CONFIRM_GREEN },
  // Ayırıcı çizgi: iki yarım aynı renge yakınsa bile sınır okunur kalsın.
  confirmHalfInfo: { borderTopWidth: 1.5, borderTopColor: "rgba(255,255,255,0.55)" },
  confirmHalfPressed: { opacity: 0.82 },
  confirmBadgeLight: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.22)",
    borderWidth: 1, borderColor: "rgba(255,255,255,0.45)",
    alignItems: "center", justifyContent: "center",
  },
  confirmHalfText: { fontSize: 13, fontWeight: "900", letterSpacing: 0.2 },
  vsWrap: { width: 34, alignItems: "center", justifyContent: "center" },
  vsCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: { fontSize: 10, fontWeight: "900" },
});
