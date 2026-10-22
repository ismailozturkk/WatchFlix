// components/game/DuelSendButton.js
//
// "Arkadaşına meydan oku" düğmesi: günlük sonucu bir düello kartına çevirip alıcı seçtirir
// (ShareToChatSheet → ChatScreen kartı kendisi yazar). İki yerde durur: Günlük sonuç ekranı ve
// Eğlence'deki Oyunlar modülü (bugünkü deneme bitmişse).
//
// `payload` yoksa (bugün oynanmadı / skor yok) hiçbir şey çizilmez: skorsuz meydan okuma olmaz.
// Düğme tek satırlık sakin bir cam şerittir; ana eylemin (sıralama / tekrar oyna) yerini almaz.
// `dense`: açıklama satırı yok, daha ince (Eğlence modülünün kompakt düzeni).

import React, { memo, useCallback, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import AppIcon from "@components/AppIcon";
import ShareToChatSheet from "@components/chat/ShareToChatSheet";
import GlassPressable from "@components/common/GlassPressable";
import { useAuth } from "@context/AuthContext";
import { useLanguage } from "@context/LanguageContext";
import { ANALYTICS_EVENTS, trackEvent } from "@services/analytics";
import { triggerHaptic } from "@services/hapticsService";
import { buildChallengeShare } from "@utils/chatShare";
import { getDuelCopy } from "@utils/dailyDuelCopy";

const AMBER = "#F59E0B";

function DuelSendButton({ payload, theme, source = "result", dense = false, style }) {
  const { user } = useAuth() || {};
  const { language } = useLanguage();
  const copy = getDuelCopy(language);
  const [visible, setVisible] = useState(false);

  const share = useMemo(
    () => (payload ? buildChallengeShare({ ...payload, host: user?.displayName || payload.host }) : null),
    [payload, user?.displayName],
  );

  const open = useCallback(() => {
    triggerHaptic("impact");
    setVisible(true);
  }, []);
  const onSent = useCallback(() => {
    trackEvent(ANALYTICS_EVENTS.DUEL_SENT, { source, score: share?.score ?? 0 });
  }, [share?.score, source]);

  if (!share) return null;

  return (
    <>
      <GlassPressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={copy.sendA11y}
        accessibilityHint={copy.sendHint}
        style={[styles.button, dense && styles.buttonDense, { backgroundColor: theme.secondary, borderColor: theme.border }, style]}
      >
        <View style={[styles.icon, dense && styles.iconDense]}>
          <AppIcon family="Ionicons" name="flash" size={dense ? 14 : 16} color="#FFFFFF" />
        </View>
        <View style={styles.copy}>
          <Text style={[styles.title, { color: theme.text.primary }]} numberOfLines={1}>
            {copy.send}
          </Text>
          {dense ? null : (
            <Text style={[styles.hint, { color: theme.text.muted }]} numberOfLines={2}>
              {copy.sendHint}
            </Text>
          )}
        </View>
        <AppIcon family="Ionicons" name="paper-plane-outline" size={18} color={theme.text.muted} />
      </GlassPressable>
      <ShareToChatSheet visible={visible} share={share} onClose={() => setVisible(false)} onSent={onSent} />
    </>
  );
}

export default memo(DuelSendButton);

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    borderWidth: 1,
  },
  buttonDense: { gap: 10, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16 },
  icon: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: AMBER },
  iconDense: { width: 28, height: 28, borderRadius: 10 },
  copy: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: "800" },
  hint: { fontSize: 11.5, lineHeight: 15, fontWeight: "500", marginTop: 1 },
});
