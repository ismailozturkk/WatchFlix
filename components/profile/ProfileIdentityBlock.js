// components/profile/ProfileIdentityBlock.js
//
// Kendi profil başlığında avatarın YANINDAKİ bilgi sütunu: ad, @kullanıcı adı,
// kimlik rozetleri, e-posta + doğrulama durumu, katılma tarihi ve eylem butonları.
//
// Önceki hâl: ikon-only iki buton adın ÜSTÜNDE ayrı bir satırda yüzüyordu (adı
// aşağı itiyor, ne işe yaradıkları etiketsizdi); e-posta ve tarih adla aynı
// kontrastta basılıyordu, hiyerarşi düzdü; doğrulanmamış uyarısı 10 punto çıplak
// kırmızı metindi.
//
// Şimdi yukarıdan aşağıya tek okuma yönü:
//   ad → @kullanıcı adı → rozetler → küçük ikonlu meta satırları → eylemler.
// Eylemler sütunun ALTINDA: etiketli birincil "Düzenle" hapı + kare "Paylaş" + (açıksa)
// yıllık hedef halkası. Üçü de 36 pt yüksekliğinde.
// Sütun dar (360 px'lik ekranda ~158 px) — bu yüzden e-posta ortadan kısaltılır
// (alan adı görünür kalır) ve tarih kısa ay adıyla tek satıra sığar.
//
// EYLEM SATIRI DARLIĞI. Üç düğmeyle "Düzenle"ye 360 pt'te ~70 px kalır (158 − 2×36 − 2×8):
//   • "Düzenle" kendi genişliği `EDIT_ICON_MIN`in altındaysa simgesini bırakır, yalnız etiket
//     kalır (ölçüm onLayout ile; simge yeniden sığınca geri gelir). Etiket 13 punto ~50 px,
//     dolgu dahil `EDIT_MIN` (62) altına inmez.
//   • Sütun `EDIT_MIN` + iki kare + boşluklara (150 px) yetmeyecek kadar darsa (320 pt) satır
//     SARILIR: halka düğmesi alt satıra iner. Tek satıra zorlamak "Düzenle"yi 30 px'e ezerdi.

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { memo, useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import AppIcon from "../AppIcon";
import GlassIconButton from "../common/GlassIconButton";
import IdentityBadgesRow from "../badges/IdentityBadgesRow";
import YearlyGoalButton from "./YearlyGoalButton";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

// "Düzenle" hapının asgari genişliği (yalnız etiket) ve simgenin de sığdığı genişlik.
const EDIT_MIN = 62;
const EDIT_ICON_MIN = 96;

// Doğrulama renkleri temadan bağımsız: her zeminde okunur (eski ekranla aynı).
const VERIFIED_COLOR = "rgb(29, 161, 242)";
const UNVERIFIED_COLOR = "rgb(229, 20, 0)";

// Firebase `metadata.createdAt` ms cinsinden DİZGE verir; geçersizse null.
function formatJoinDate(timestamp, language) {
  const date = new Date(Number(timestamp));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(intlLocaleOf(language), {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function MetaRow({ theme, icon, children, trailing }) {
  return (
    <View style={styles.metaRow}>
      <AppIcon family="Ionicons" name={icon} size={14} color={theme.text.muted} />
      {children}
      {trailing}
    </View>
  );
}

function ProfileIdentityBlock({
  theme,
  language,
  displayName,
  username,
  badges,
  email,
  emailVerified,
  verifyHint,
  joinedAt,
  onEdit,
  onShare,
  showGoal = false,
}) {
  // İlk ölçüme kadar simge YOK: dar ekranda simge önce çizilip sonra kaybolmasın.
  const [editWidth, setEditWidth] = useState(0);
  const onEditLayout = useCallback((event) => {
    const width = Math.round(event.nativeEvent.layout.width);
    setEditWidth((previous) => (previous === width ? previous : width));
  }, []);
  const showEditIcon = editWidth >= EDIT_ICON_MIN;
  const joinDate = joinedAt ? formatJoinDate(joinedAt, language) : null;
  const editLabel = i18nText("autoI18n.profili_duzenle", "Profili Düzenle");

  return (
    <View style={styles.root}>
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.75}
        // Ekranın en büyük metni olsa da bu kullanıcının kendi adı; geniş bir
        // başlık fontu tek satırda hemen kırpılır (bkz. utils/typographyRoles.js).
        fontRole="body"
        style={[styles.name, { color: theme.text.primary }]}
      >
        {displayName}
      </Text>
      {!!username && (
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.username, { color: theme.text.secondary }]}
        >
          @{username}
        </Text>
      )}

      <IdentityBadgesRow
        badges={badges}
        theme={theme}
        language={language}
        style={styles.badges}
      />

      <View style={styles.meta}>
        {!!email && (
          <MetaRow
            theme={theme}
            icon="mail-outline"
            trailing={
              <AppIcon
                family="MaterialIcons"
                name="verified"
                size={14}
                color={emailVerified ? VERIFIED_COLOR : UNVERIFIED_COLOR}
              />
            }
          >
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              ellipsizeMode="middle"
              style={[styles.metaText, { color: theme.text.secondary }]}
            >
              {email}
            </Text>
          </MetaRow>
        )}
        {!!joinDate && (
          <MetaRow theme={theme} icon="calendar-outline">
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.metaText, { color: theme.text.muted }]}
            >
              {i18nText("autoI18n.katilma_tarihi", "Katılma tarihi:")} {joinDate}
            </Text>
          </MetaRow>
        )}
        {!!verifyHint && (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: alpha(UNVERIFIED_COLOR, 0.1),
                borderColor: alpha(UNVERIFIED_COLOR, 0.35),
              },
            ]}
          >
            <AppIcon
              family="Ionicons"
              name="alert-circle"
              size={13}
              color={UNVERIFIED_COLOR}
            />
            <Text
              allowFontScaling={false}
              numberOfLines={3}
              style={[styles.noticeText, { color: UNVERIFIED_COLOR }]}
            >
              {verifyHint}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <Pressable
          onPress={onEdit}
          onLayout={onEditLayout}
          hitSlop={4}
          accessibilityRole="button"
          accessibilityLabel={editLabel}
          style={({ pressed }) => [
            styles.editBtn,
            {
              backgroundColor: alpha(theme.accent, pressed ? 0.26 : 0.14),
              borderColor: alpha(theme.accent, 0.45),
            },
          ]}
        >
          {showEditIcon ? (
            <AppIcon
              family="Ionicons"
              name="create-outline"
              size={16}
              color={theme.accent}
            />
          ) : null}
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[styles.editLabel, { color: theme.accent }]}
          >
            {i18nText("autoI18n.duzenle", "Düzenle")}
          </Text>
        </Pressable>

        <GlassIconButton
          icon="share-social-outline"
          iconSize={17}
          size={36}
          fallbackRadius={12}
          color={theme.text.primary}
          hitSlop={4}
          fallbackStyle={{
            backgroundColor: theme.secondary,
            borderColor: alpha(theme.border, 0.9),
            borderWidth: 1,
          }}
          accessibilityLabel={i18nText("autoI18n.paylas", "Paylaş")}
          onPress={onShare}
        />

        {showGoal ? <YearlyGoalButton /> : null}
      </View>
    </View>
  );
}

export default memo(ProfileIdentityBlock);

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 22,
    fontWeight: "bold",
    letterSpacing: -0.2,
  },
  username: {
    marginTop: 1,
    fontSize: 13,
    fontWeight: "600",
  },
  badges: {
    marginTop: 8,
    marginBottom: 0,
  },
  meta: {
    marginTop: 10,
    gap: 5,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minWidth: 0,
  },
  metaText: {
    flexShrink: 1,
    fontSize: 12.5,
    fontWeight: "500",
  },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 9,
    borderWidth: 1,
  },
  noticeText: {
    flex: 1,
    fontSize: 10.5,
    fontWeight: "600",
    lineHeight: 14,
  },
  actions: {
    marginTop: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 8,
  },
  // flex: 1 DEĞİL: flexBasis 0 sarmayı hiç tetiklemez (satır asla taşmış sayılmaz).
  // Açık taban + büyüme: boş yeri doldurur, ama EDIT_MIN altına inmeden önce satır sarılır.
  editBtn: {
    flexGrow: 1,
    flexShrink: 0,
    flexBasis: EDIT_MIN,
    minWidth: EDIT_MIN,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  editLabel: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "700",
  },
});
