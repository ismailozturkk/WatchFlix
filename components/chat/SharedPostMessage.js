// components/chat/SharedPostMessage.js
//
// Sohbette/grupta paylaşılan Hub GÖNDERİSİ balonunun gövdesi (mesaj kind:
// "postShare", bkz. utils/chatShare.js). Feed'deki kartın sohbet ölçeğindeki
// özeti: yazar satırı + tür rozeti, başlık, (inceleme için) yıldız, kısaltılmış
// metin, afişler veya anket seçenekleri; altta "Gönderiyi aç".
//
// İki yerleşim:
//   • TEK afişli gönderi (tipik inceleme): afiş solda, başlık/yıldız/metin sağda —
//     büyük afişin yanında boş alan kalmaz.
//   • Çok afişli gönderi (liste): metin üstte, altında liste balonundakiyle AYNI
//     afiş şeridi (ilk üç + üst üste binmiş yığın ve "+N").
//
// Balon HİÇBİR ZAMAN öğe/metin uzunluğuyla büyümez: metin 4 satıra, afişler
// üç + yığına, anket dört seçeneğe kırpılır; tamamı gönderi detayındadır.
// Spoiler'lı gönderide metin gizli ve afişler karartılı gelir, dokununca açılır
// (feed'deki spoiler perdesiyle aynı mantık).
//
// Gövde gezinmez: dokunuşlar `onOpenPost` / `onOpenItem` ile bildirilir.

import React, { memo, useMemo, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import UserAvatar from "../common/UserAvatar";
import { useTheme } from "../../context/ThemeContext";
import { i18nText } from "../../utils/i18nText";
import { postTypeMeta } from "../feed/postTypeMeta";
import PosterStrip, { PosterFace, stripLayout } from "./PosterStrip";
import { sharePalette } from "./shareKit";

const { width: SCREEN_W } = Dimensions.get("window");
// Metin bloğunun genişliği; afiş şeridi daha genişse şerit belirler.
// Alt sınır: ekran genişliği beklenmedik küçük ölçülürse (ilk çizimde, bölünmüş
// ekran) metin 1–2 harflik şeride çökmesin.
const TEXT_W = Math.max(220, Math.round(Math.min(SCREEN_W * 0.72, 300)));
const SPOILER_VEIL = 0.72;
const STAR = "#FFD54F";
// Tek afişli yerleşimde afiş (çift genişlik → tam 2:3 kutu).
const SINGLE_W = 76;
const SINGLE_H = SINGLE_W * 1.5;

function Stars({ rating, muted }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={n <= rating ? "star" : "star-outline"}
          size={14}
          color={n <= rating ? STAR : muted}
        />
      ))}
    </View>
  );
}

function SharedPostMessage({
  share,
  isOutgoing = false,
  getTmdbUrl,
  onOpenPost,
  onOpenItem,
}) {
  const { theme } = useTheme();
  const meta = useMemo(() => postTypeMeta(share.postType, theme.colors), [share.postType, theme.colors]);
  const palette = useMemo(
    () => sharePalette({ theme, isOutgoing, accent: meta.color }),
    [theme, isOutgoing, meta.color],
  );
  const [revealed, setRevealed] = useState(false);

  const items = share.items || [];
  const total = share.total ?? items.length;
  // Tek afiş + anket değil: afiş metnin YANINDA. Diğer her şey: metin üstte, şerit altta.
  const single = items.length === 1 && total === 1 && !share.poll;
  const layout = useMemo(
    () => (items.length && !single ? stripLayout(total) : null),
    [items.length, total, single],
  );
  const blockW = Math.max(TEXT_W, layout?.width ?? 0);
  const hidden = share.spoiler === true && !revealed;
  const canOpen = typeof onOpenPost === "function";
  const openLabel = i18nText("autoI18n.paylas_gonderiyi_ac", "Gönderiyi aç");
  const stackLabel = i18nText("autoI18n.liste_paylas_tumunu_gor", "Tümünü gör");
  const author = share.author || {};

  // Dokunulabilir alan: gönderiyi açar; açıcı yoksa düz kap.
  const Tap = canOpen ? TouchableOpacity : View;
  const tapProps = canOpen
    ? {
        activeOpacity: 0.85,
        onPress: onOpenPost,
        accessibilityRole: "button",
        accessibilityLabel: openLabel,
      }
    : {};

  const titleStyle = [styles.title, single && styles.titleFirst, { color: palette.primary }];

  // Başlık + yıldız + metin (spoiler'da perde) + anket: iki yerleşimde ortak.
  const content = (
    <>
      {!!share.title && (
        <Text style={titleStyle} numberOfLines={3}>
          {share.title}
        </Text>
      )}

      {share.rating ? <Stars rating={share.rating} muted={palette.muted} /> : null}

      {hidden ? (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={() => setRevealed(true)}
          accessibilityRole="button"
          accessibilityLabel={i18nText("autoI18n.spoileri_goster", "Spoiler'ı göster")}
          style={[styles.spoiler, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}
        >
          <Ionicons name="eye-off-outline" size={15} color={palette.tileInk} />
          <Text
            allowFontScaling={false}
            style={[styles.spoilerText, { color: palette.primary }]}
            numberOfLines={1}
          >
            {i18nText("autoI18n.paylas_spoiler_icerir", "Spoiler içeriyor")}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.spoilerShow, { color: palette.tileInk }]}
            numberOfLines={1}
          >
            {i18nText("autoI18n.spoileri_goster", "Spoiler'ı göster")}
          </Text>
        </TouchableOpacity>
      ) : share.excerpt ? (
        <Text style={[styles.excerpt, { color: palette.secondary }]} numberOfLines={single ? 5 : 4}>
          {share.excerpt}
        </Text>
      ) : null}

      {/* Anket: seçenekler (oy vermek gönderide) */}
      {share.poll ? (
        <View style={styles.poll}>
          {share.poll.options.map((label, index) => (
            <View
              key={`${index}-${label}`}
              style={[styles.pollOption, { backgroundColor: palette.surface, borderColor: palette.surfaceBorder }]}
            >
              <Ionicons name="ellipse-outline" size={14} color={palette.muted} />
              <Text style={[styles.pollLabel, { color: palette.primary }]} numberOfLines={1}>
                {label}
              </Text>
            </View>
          ))}
          <Text allowFontScaling={false} style={[styles.pollMeta, { color: palette.muted }]}>
            {i18nText("autoI18n.n_oy", "{{n}} oy", { n: share.poll.votes })}
          </Text>
        </View>
      ) : null}
    </>
  );

  return (
    <View style={[styles.wrap, { width: blockW }]}>
      {/* Yazar + tür rozeti */}
      <Tap {...tapProps} style={styles.authorRow}>
        <UserAvatar
          avatarIndex={author.avatarIndex}
          photoURL={author.photoURL}
          isCustomPhoto
          size={30}
        />
        <View style={styles.authorCopy}>
          <Text style={[styles.authorName, { color: palette.primary }]} numberOfLines={1}>
            {author.name || i18nText("autoI18n.kullanici", "Kullanıcı")}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.kicker, { color: palette.muted }]}
            numberOfLines={1}
          >
            {i18nText("autoI18n.gonderi", "Gönderi")}
          </Text>
        </View>
        <View style={[styles.typePill, { backgroundColor: palette.tile }]}>
          <Ionicons name={meta.icon} size={11} color={palette.tileInk} />
          <Text
            allowFontScaling={false}
            style={[styles.typeText, { color: palette.tileInk }]}
            numberOfLines={1}
          >
            {meta.label}
          </Text>
        </View>
      </Tap>

      {single ? (
        <View style={styles.singleRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={hidden ? undefined : () => onOpenItem?.(items[0])}
            disabled={hidden || typeof onOpenItem !== "function"}
            accessibilityRole="button"
            accessibilityLabel={items[0].title}
          >
            <PosterFace
              item={items[0]}
              width={SINGLE_W}
              height={SINGLE_H}
              getTmdbUrl={getTmdbUrl}
              palette={palette}
              dim={hidden ? SPOILER_VEIL : 0}
            />
          </TouchableOpacity>
          <Tap {...tapProps} style={styles.singleCopy}>
            {content}
          </Tap>
        </View>
      ) : (
        <Tap {...tapProps}>{content}</Tap>
      )}

      {/* Çok afişli gönderi: ilk üç + yığın (yığın gönderiyi açar) */}
      {layout ? (
        <View style={styles.strip}>
          <PosterStrip
            items={items}
            total={total}
            layout={layout}
            palette={palette}
            getTmdbUrl={getTmdbUrl}
            veil={hidden ? SPOILER_VEIL : 0}
            onOpenItem={hidden ? undefined : onOpenItem}
            onOpenAll={canOpen ? onOpenPost : undefined}
            caption={stackLabel}
          />
        </View>
      ) : null}

      {canOpen && (
        <TouchableOpacity
          activeOpacity={0.85}
          onPress={onOpenPost}
          hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
          style={[
            styles.action,
            { backgroundColor: palette.ghostBg, borderColor: palette.ghostBorder },
          ]}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
        >
          <Ionicons name="open-outline" size={15} color={palette.ghostInk} />
          <Text
            allowFontScaling={false}
            style={[styles.actionText, { color: palette.ghostInk }]}
            numberOfLines={1}
          >
            {openLabel}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default memo(SharedPostMessage);

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", marginBottom: 2 },

  authorRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  authorCopy: { flex: 1, minWidth: 0 },
  authorName: { fontSize: 13.5, fontWeight: "800", lineHeight: 17 },
  kicker: { fontSize: 10, fontWeight: "700", marginTop: 1 },
  typePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    maxWidth: 110,
  },
  typeText: { fontSize: 9.5, fontWeight: "800", letterSpacing: 0.4, flexShrink: 1 },

  // Tek afiş: poster solda, metin sütunu sağda (üstten hizalı).
  singleRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginTop: 12 },
  singleCopy: { flex: 1, minWidth: 0 },

  title: { fontSize: 15.5, fontWeight: "800", lineHeight: 20, marginTop: 10 },
  titleFirst: { marginTop: 0 },
  stars: { flexDirection: "row", gap: 2, marginTop: 6 },
  excerpt: { fontSize: 13, lineHeight: 18, marginTop: 6 },

  spoiler: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 38,
    paddingHorizontal: 11,
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  spoilerText: { flex: 1, fontSize: 12.5, fontWeight: "800" },
  spoilerShow: { fontSize: 11, fontWeight: "800" },

  poll: { marginTop: 8, gap: 6 },
  pollOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 11,
    borderWidth: 1,
  },
  pollLabel: { flex: 1, fontSize: 12.5, fontWeight: "600" },
  pollMeta: { fontSize: 11, fontWeight: "700", marginTop: 1 },

  strip: { marginTop: 14 },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 36,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 18,
    borderWidth: 1,
  },
  actionText: { fontSize: 12.5, fontWeight: "800", flexShrink: 1 },
});
