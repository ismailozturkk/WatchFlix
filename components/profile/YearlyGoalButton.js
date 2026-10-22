// components/profile/YearlyGoalButton.js
//
// Profil başlığındaki "Yıllık izleme hedefi" düğmesi: 36×36, "Paylaş" düğmesiyle AYNI cam /
// çerçeve dili (GlassIconButton), içinde ilerleme halkası ve ortasında YALNIZ yüzde.
// Dokununca hedef sayfası açılır (koyma / değiştirme / kaldırma + tempo ayrıntısı).
//
// NEDEN KART DEĞİL DÜĞME: profil ekranı zaten çok içerik taşıyor. Film/dizi ayrı hedefleri, tempo,
// plan ve aylık grafik hedef sayfasında; başlıkta yalnız halka ve yüzde kalır.
//
// YÜZDE = açık hedeflerin (film, dizi) oranlarının ORTALAMASI (utils/yearlyGoal.js combineProgress).
//
// HÂLLER
//   yükleniyor  : iz (boş halka), yüzde yok, dokunulamaz — listeler gelmeden "%0" yazmasın
//   hedef yok   : boş halka + bayrak simgesi (davet); dokununca hedef koyma sayfası
//   hedef var   : dolu yay + "%62"
//   tamamlandı  : (TÜM açık hedefler tamam) altın yay + "%100"
//
// BOYUT: 36 pt kutu içinde 30 pt halka, 3 pt çizgi → iç çap 24 pt; "%100" 9 punto kalın
// yazıyla ~21 pt tutar, sığar (dar ekranda adjustsFontSizeToFit son çare).

import React, { memo, useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import GlassIconButton from "@components/common/GlassIconButton";
import { useLanguage } from "@context/LanguageContext";
import { useTheme } from "@context/ThemeContext";
import useYearlyGoal from "@hooks/useYearlyGoal";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { triggerHaptic } from "@services/hapticsService";
import { alpha } from "../../theme/colors";
import YearlyGoalRing from "./YearlyGoalRing";
import YearlyGoalSheet from "./YearlyGoalSheet";
import { fillCopy, formatPercent, getYearlyGoalCopy, summarizeTracks } from "./yearlyGoalCopy";

export const GOAL_BUTTON_SIZE = 36;
const STROKE = 3;
const GOLD = "#FBBF24";

/** Ölçüm olayı için hedefin biçimi: hangi hatlar + hedef sayıları (kullanıcı verisi içermez). */
function analyticsShape(goal) {
  const both = !!goal?.movies && !!goal?.shows;
  return {
    tracks: both ? "both" : goal?.movies ? "movies" : "shows",
    movies_target: goal?.movies?.target,
    shows_target: goal?.shows?.target,
    shows_measure: goal?.shows?.measure,
  };
}

function YearlyGoalButton({ size = GOAL_BUTTON_SIZE, hitSlop = 4 }) {
  const { theme } = useTheme();
  const { language } = useLanguage();
  const copy = getYearlyGoalCopy(language);
  const { year, now, goal, counts, tracks, overall, suggestion, loading, saveGoal, removeGoal } = useYearlyGoal();
  const [sheetVisible, setSheetVisible] = useState(false);
  const resolvedSize = Number(size) > 0 ? Number(size) : GOAL_BUTTON_SIZE;
  const ringSize = Math.max(18, resolvedSize - (resolvedSize < 32 ? 4 : 6));
  const stroke = resolvedSize < 32 ? 2.5 : STROKE;
  // Halkanın iç çapı: yüzde metninin sığacağı en geniş yer.
  const inner = ringSize - stroke * 2;
  const fallbackRadius = Math.max(8, Math.round(resolvedSize / 3));
  const flagSize = Math.max(11, Math.round(resolvedSize * 0.36));
  const percentFontSize = resolvedSize < 32 ? 8 : 9;
  const percentLineHeight = resolvedSize < 32 ? 10 : 11;

  const open = useCallback(() => {
    triggerHaptic("selection");
    setSheetVisible(true);
  }, []);
  const close = useCallback(() => setSheetVisible(false), []);

  // Ölçüm yalnız BAŞARILI yazımda (başarısız kayıt "hedef kondu" diye sayılmasın).
  const handleSave = useCallback(
    (next) => {
      const action = goal ? "changed" : "set";
      const ok = saveGoal(next);
      if (ok) trackEvent(ANALYTICS_EVENTS.YEARLY_GOAL, { action, ...analyticsShape(next) });
      return ok;
    },
    [goal, saveGoal],
  );
  const handleRemove = useCallback(() => {
    const previous = goal;
    const ok = removeGoal();
    if (ok && previous) {
      trackEvent(ANALYTICS_EVENTS.YEARLY_GOAL, { action: "cleared", ...analyticsShape(previous) });
    }
    return ok;
  }, [goal, removeGoal]);

  const hasGoal = !loading && !!overall;
  const done = hasGoal && overall.done;
  const ringColor = done ? GOLD : theme.accent;

  const label = hasGoal
    ? `${fillCopy(copy.editLabel, { year })}. ${fillCopy(copy.ringLabel, { year, summary: summarizeTracks(tracks, copy) })}`
    : fillCopy(copy.emptyTitle, { year });

  return (
    // Alt sayfa (Modal) düzene girmez; yine de kendi sarmalayıcısında durur ki eylem
    // satırının `gap`i ona fazladan boşluk ayırmasın.
    <View>
      <GlassIconButton
        testID="yearly-goal-button"
        size={resolvedSize}
        fallbackRadius={fallbackRadius}
        hitSlop={hitSlop}
        fallbackStyle={{
          backgroundColor: theme.secondary,
          borderColor: alpha(theme.border, 0.9),
          borderWidth: 1,
        }}
        disabled={loading}
        accessibilityLabel={label}
        onPress={open}
      >
        <YearlyGoalRing
          size={ringSize}
          stroke={stroke}
          ratio={hasGoal ? overall.ratio : 0}
          color={ringColor}
          trackColor={alpha(theme.text.muted, 0.3)}
        >
          {hasGoal ? (
            <Text
              testID="yearly-goal-percent"
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.7}
              style={[
                styles.percent,
                {
                  maxWidth: inner,
                  fontSize: percentFontSize,
                  lineHeight: percentLineHeight,
                  color: theme.text.primary,
                },
              ]}
            >
              {formatPercent(overall.percent, language)}
            </Text>
          ) : loading ? null : (
            <Ionicons name="flag-outline" size={flagSize} color={theme.accent} />
          )}
        </YearlyGoalRing>
      </GlassIconButton>

      <YearlyGoalSheet
        visible={sheetVisible}
        onClose={close}
        year={year}
        now={now}
        goal={goal}
        suggestion={suggestion}
        counts={counts}
        onSave={handleSave}
        onRemove={handleRemove}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  percent: {
    fontWeight: "800",
    textAlign: "center",
    fontVariant: ["tabular-nums"],
  },
});

export default memo(YearlyGoalButton);
