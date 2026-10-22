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
// Eylemler sütunun ALTINDA, hepsi İKON düğmeleri: Düzenle, Bildirimler (okunmamış
// sayacıyla; `notificationsAction` olarak dışarıdan gelir), Ayarlar, Paylaş ve (açıksa) yıllık
// hedef halkası. Eskiden "Düzenle" etiketli bir hapıydı ve bildirimler profilin altında ayrı bir
// tam genişlik kartı kaplıyordu.
// Sütun dar (360 px'lik ekranda ~158 px) — bu yüzden e-posta ortadan kısaltılır
// (alan adı görünür kalır) ve tarih kısa ay adıyla tek satıra sığar.
//
// DUYARLI TEK SATIR EYLEMLER. Beş düğme de alt satıra İNMEZ (`flexWrap: "nowrap"`).
// Sütunun ölçülen yatay genişliğine (`onLayout`, ilk karede `useWindowDimensions` tahmini)
// ve görünür düğme sayısına göre düğme boyu (22–38 pt) ile aralık (gap) hesaplanır; böylece
// dar ekranda (360 pt → 158 px sütun: 5×28 + 4×4,5 = 158 px) da geniş ekranda da yatay alanı
// taşmadan tam doldurur.

import { intlLocaleOf } from "../../utils/appLanguages";
import React, { memo, useCallback, useState } from "react";
import * as ReactNative from "react-native";
import AppIcon from "../AppIcon";
import GlassIconButton from "../common/GlassIconButton";
import IdentityBadgesRow from "../badges/IdentityBadgesRow";
import YearlyGoalButton from "./YearlyGoalButton";
import { alpha } from "../../theme/colors";
import { i18nText } from "../../utils/i18nText";

const { StyleSheet, Text, View } = ReactNative;

// Doğrulama renkleri temadan bağımsız: her zeminde okunur (eski ekranla aynı).
const VERIFIED_COLOR = "rgb(29, 161, 242)";
const UNVERIFIED_COLOR = "rgb(229, 20, 0)";

const DEFAULT_BUTTON_SIZE = 36;
const MIN_BUTTON_SIZE = 22;
const MAX_BUTTON_SIZE = 38;
const DEFAULT_GAP = 8;
const MIN_GAP = 3;
const MAX_GAP = 12;
const GAP_RATIO = 0.16;
// ProfileScreen styles.images: sol/sağ 16 pt dolgu (32) + 14 pt boşluk + 156 pt avatar halkası = 202 pt.
const PROFILE_HEADER_RESERVED_WIDTH = 16 * 2 + 14 + 156;

/**
 * Eylem satırının yatay genişliğine (`width`) ve görünür düğme sayısına (`count`) göre
 * düğme boyunu, ikon boyunu, köşe yarıçapını ve düğmeler arası boşluğu hesaplar.
 * Toplam genişlik (`count * size + (count - 1) * gap`) hiçbir zaman `width`i aşmaz.
 */
export function resolveActionRowLayout(width, count = 5) {
  const numericWidth = Math.floor(Number(width) || 0);
  if (numericWidth <= 0) {
    return {
      size: DEFAULT_BUTTON_SIZE,
      gap: DEFAULT_GAP,
      iconSize: 18,
      shareIconSize: 17,
      radius: 12,
      hitSlop: 4,
    };
  }
  const safeCount = Math.max(1, Number(count) || 1);
  // 4'ten az düğme varken düğmelerin aşırı büyümesini önlemek için ideal boy en az 4 yuvaya göre.
  const slots = Math.max(safeCount, 4);
  const minGap = numericWidth < 140 ? 2 : MIN_GAP;
  const idealSize = Math.floor(numericWidth / (slots + (slots - 1) * GAP_RATIO));
  const maxFittingSize =
    safeCount > 1
      ? Math.floor((numericWidth - (safeCount - 1) * minGap) / safeCount)
      : numericWidth;
  const size = Math.max(
    MIN_BUTTON_SIZE,
    Math.min(MAX_BUTTON_SIZE, idealSize, maxFittingSize),
  );
  const rawGap =
    safeCount > 1 ? (numericWidth - safeCount * size) / (safeCount - 1) : 0;
  // Alt piksel taşmasını önlemek için onda bire aşağı yuvarla: count*size + (count-1)*gap <= width.
  const gap =
    safeCount > 1
      ? Math.min(MAX_GAP, Math.max(minGap, Math.floor(rawGap * 10) / 10))
      : 0;
  const iconSize = Math.max(13, Math.round(size * 0.5));
  const shareIconSize = Math.max(12, iconSize - 1);
  const radius = Math.max(8, Math.round(size / 3));
  const hitSlop = safeCount > 1 ? Math.max(2, Math.min(4, Math.floor(gap / 2))) : 4;
  return { size, gap, iconSize, shareIconSize, radius, hitSlop };
}

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
  onSettings,
  settingsLabel,
  notificationsAction = null,
  showGoal = false,
}) {
  const windowDims =
    typeof ReactNative.useWindowDimensions === "function"
      ? ReactNative.useWindowDimensions()
      : null;
  const estimatedWidth =
    windowDims?.width > PROFILE_HEADER_RESERVED_WIDTH
      ? windowDims.width - PROFILE_HEADER_RESERVED_WIDTH
      : 0;
  const [measuredWidth, setMeasuredWidth] = useState(0);
  const onActionsLayout = useCallback((event) => {
    const width = Math.floor(Number(event?.nativeEvent?.layout?.width) || 0);
    if (width > 0) {
      setMeasuredWidth((prev) => (prev === width ? prev : width));
    }
  }, []);

  const buttonCount =
    2 + (notificationsAction ? 1 : 0) + (onSettings ? 1 : 0) + (showGoal ? 1 : 0);
  const effectiveWidth = measuredWidth > 0 ? measuredWidth : estimatedWidth;
  const actionLayout = resolveActionRowLayout(effectiveWidth, buttonCount);

  const renderedNotifications = React.isValidElement(notificationsAction)
    ? React.cloneElement(notificationsAction, {
        size: actionLayout.size,
        iconSize: actionLayout.iconSize,
        fallbackRadius: actionLayout.radius,
        hitSlop: actionLayout.hitSlop,
      })
    : notificationsAction;

  const joinDate = joinedAt ? formatJoinDate(joinedAt, language) : null;
  const editLabel = i18nText("autoI18n.profili_duzenle", "Profili Düzenle");

  return (
    <View style={styles.root}>
      {/* Ad satırı: yalnız ad (Ayarlar dişlisi eylem satırına taşındı). */}
      <View style={styles.nameRow}>
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
      </View>
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

      <View
        style={[styles.actions, { gap: actionLayout.gap }]}
        onLayout={onActionsLayout}
      >
        <GlassIconButton
          testID="profile-edit-button"
          icon="create-outline"
          iconSize={actionLayout.iconSize}
          size={actionLayout.size}
          fallbackRadius={actionLayout.radius}
          color={theme.accent}
          hitSlop={actionLayout.hitSlop}
          fallbackStyle={{
            backgroundColor: alpha(theme.accent, 0.14),
            borderColor: alpha(theme.accent, 0.45),
            borderWidth: 1,
          }}
          accessibilityLabel={editLabel}
          onPress={onEdit}
        />

        {renderedNotifications}

        {onSettings ? (
          <GlassIconButton
            testID="profile-settings-button"
            icon="settings-outline"
            iconSize={actionLayout.iconSize}
            size={actionLayout.size}
            fallbackRadius={actionLayout.radius}
            color={theme.text.primary}
            hitSlop={actionLayout.hitSlop}
            fallbackStyle={{
              backgroundColor: theme.secondary,
              borderColor: alpha(theme.border, 0.9),
              borderWidth: 1,
            }}
            accessibilityLabel={settingsLabel}
            onPress={onSettings}
          />
        ) : null}

        <GlassIconButton
          icon="share-social-outline"
          iconSize={actionLayout.shareIconSize}
          size={actionLayout.size}
          fallbackRadius={actionLayout.radius}
          color={theme.text.primary}
          hitSlop={actionLayout.hitSlop}
          fallbackStyle={{
            backgroundColor: theme.secondary,
            borderColor: alpha(theme.border, 0.9),
            borderWidth: 1,
          }}
          accessibilityLabel={i18nText("autoI18n.paylas", "Paylaş")}
          onPress={onShare}
        />

        {showGoal ? <YearlyGoalButton size={actionLayout.size} hitSlop={actionLayout.hitSlop} /> : null}
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
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  name: {
    flex: 1,
    minWidth: 0,
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
    width: "100%",
    flexDirection: "row",
    flexWrap: "nowrap",
    alignItems: "center",
    gap: 8,
  },
});
