import React, { useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  InteractionManager,
  ActivityIndicator,
  PanResponder,
} from "react-native";
import { useLanguage } from "../../context/LanguageContext";
import AppIcon from "../../components/AppIcon";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../context/ThemeContext";
import LottieView from "lottie-react-native";
import SettingsTheme from "./setting/SettingsTheme";
import {
  useContentSettings,
  useImageQualitySettings,
  useOngoingTvShowsSettings,
  useSnowSettings,
  useIconBackgroundSettings,
  useHapticsSettings,
  useNotificationSettings,
  useAutoDataCacheSettings,
} from "../../context/AppSettingsContext";
import { useDeviceNotifications } from "../../context/DeviceNotificationsContext";
import SwitchToggle from "@components/SwitchToggle";
import SwipeCard from "@components/SwipeCard";
import PetSettingsSection from "@components/pet/PetSettingsSection";
import PermissionsSection from "@components/PermissionsSection";
import { BlurView } from "expo-blur";
import CountryFlag from "react-native-country-flag";
import IconBacground from "../../components/IconBacground";
import { alpha } from "../../theme/colors";
import { downloadAllData } from "../../services/dataDownloader";
import { useConnectivity } from "../../context/ConnectivityContext";
import { i18nText } from "../../utils/i18nText";
import CacheManagerModal from "../../components/CacheManagerModal";
import { appAlert } from "@components/AppAlert";
import { Image } from "expo-image";
import { getBreakdown } from "../../services/cacheInspector";
import { auth, db } from "../../firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

const fmtBytes = (b) =>
  b >= 1024 * 1024
    ? `${(b / 1048576).toFixed(1)} MB`
    : `${Math.max(0, Math.round(b / 1024))} KB`;

const LANGUAGES = [
  { code: "tr", name: "Türkçe", nativeName: "Türkçe", flag: "tr" },
  { code: "en", name: "English", nativeName: "English", flag: "us" },
];

const IMAGE_QUALITIES = [
  { labelKey: "imageQualityLow", value: "low" },
  { labelKey: "imageQualityMedium", value: "medium" },
  { labelKey: "imageQualityGood", value: "good" },
  { labelKey: "imageQualityHigh", value: "high" },
  { labelKey: "imageQualityOriginal", value: "original" },
];

const REMINDER_NOTIFICATION_TIMINGS = [
  { labelKey: "onReleaseDay", value: 0 },
  { labelKey: "oneDayBefore", value: 1 },
  { labelKey: "threeDaysBefore", value: 3 },
  { labelKey: "oneWeekBefore", value: 7 },
];

const NOTIFICATION_ROWS = [
  {
    key: "friendRequestsEnabled",
    titleKey: "friendRequestNotifications",
    subtitleKey: "friendRequestNotificationsSubtitle",
    iconName: "person-add-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
  },
  {
    key: "friendAcceptedEnabled",
    titleKey: "friendAcceptedNotifications",
    subtitleKey: "friendAcceptedNotificationsSubtitle",
    iconName: "people-outline",
    colorKey: "green",
    bgKey: "iconGreen",
  },
  {
    key: "messagesEnabled",
    titleKey: "messageNotifications",
    subtitleKey: "messageNotificationsSubtitle",
    iconName: "chatbubble-ellipses-outline",
    colorKey: "teal",
    bgKey: "iconTeal",
  },
  {
    key: "postLikesEnabled",
    titleKey: "postLikeNotifications",
    subtitleKey: "postLikeNotificationsSubtitle",
    iconName: "heart-outline",
    colorKey: "amber",
    bgKey: "iconAmber",
  },
  {
    key: "postCommentsEnabled",
    titleKey: "postCommentNotifications",
    subtitleKey: "postCommentNotificationsSubtitle",
    iconName: "chatbox-outline",
    colorKey: "purple",
    bgKey: "iconPurple",
  },
  {
    key: "mentionsEnabled",
    titleKey: "mentionNotifications",
    subtitleKey: "mentionNotificationsSubtitle",
    iconName: "at-outline",
    colorKey: "blue",
    bgKey: "iconBlue",
  },
];

function buildUiColors(theme) {
  return {
    bg: theme.primary,
    card: theme.secondary,
    cardAlt: theme.between,
    border: theme.border,
    borderMuted: alpha(theme.border, 0.55),
    text: theme.text.primary,
    muted: theme.text.muted,
    accent: theme.accent,
    accentStrong: theme.bold,
    accentDim: alpha(theme.accent, 0.16),
    danger: theme.colors.red,
    dangerDim: alpha(theme.colors.red, 0.12),
    blue: theme.colors.blue,
    purple: theme.colors.purple,
    green: theme.colors.green,
    amber: theme.colors.orange,
    teal: theme.accent,
    iconBlue: alpha(theme.colors.blue, 0.14),
    iconPurple: alpha(theme.colors.purple, 0.14),
    iconGreen: alpha(theme.colors.green, 0.14),
    iconAmber: alpha(theme.colors.orange, 0.14),
    iconTeal: alpha(theme.accent, 0.14),
    white: "#FFFFFF",
    handle: alpha(theme.text.muted, 0.45),
    closeBg: alpha(theme.border, 0.7),
  };
}

function SectionLabel({ children, color }) {
  return (
    <Text allowFontScaling={false} style={[s.sectionLabel, { color }]}>
      {children}
    </Text>
  );
}

function Chevron({ color }) {
  return <AppIcon family="Ionicons" name="chevron-forward" size={14} color={color} />;
}

function SettingRow({
  colors,
  iconBg,
  iconColor,
  iconName,
  iconFamily = "Ionicons",
  title,
  subtitle,
  right,
  onPress,
  danger,
  last,
}) {
  return (
    <TouchableOpacity
      style={[
        s.row,
        { borderBottomColor: colors.borderMuted },
        last && { borderBottomWidth: 0 },
      ]}
      onPress={onPress}
      activeOpacity={0.65}
    >
      <View style={s.rowLeft}>
        <View style={[s.iconWrap, { backgroundColor: iconBg }]}>
          <AppIcon family={iconFamily} name={iconName} size={15} color={iconColor} />
        </View>
        <View style={s.rowTexts}>
          <Text
            allowFontScaling={false}
            style={[s.rowTitle, { color: danger ? colors.danger : colors.text }]}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text allowFontScaling={false} style={[s.rowSub, { color: colors.muted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={s.rowRight}>{right}</View>
    </TouchableOpacity>
  );
}

// İkon saydamlık çarpanı için hafif kaydırıcı (0.1–1). Ek bağımlılık yok — PanResponder.
function OpacitySlider({ value, onChange, colors }) {
  const MIN = 0.1;
  const MAX = 1;
  const [trackW, setTrackW] = useState(0);
  const widthRef = useRef(0);
  const changeRef = useRef(onChange);
  changeRef.current = onChange;

  const emit = (x) => {
    const w = widthRef.current;
    if (!w) return;
    const ratio = Math.min(1, Math.max(0, x / w));
    changeRef.current(MIN + ratio * (MAX - MIN));
  };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => emit(e.nativeEvent.locationX),
      onPanResponderMove: (e) => emit(e.nativeEvent.locationX),
    }),
  ).current;

  const ratio = Math.min(1, Math.max(0, (value - MIN) / (MAX - MIN)));

  return (
    <View
      {...pan.panHandlers}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        widthRef.current = w;
        setTrackW(w);
      }}
      style={[s.opacityTrack, { backgroundColor: colors.cardAlt, borderColor: colors.border }]}
      hitSlop={{ top: 12, bottom: 12 }}
    >
      <View
        style={[s.opacityFill, { width: ratio * trackW, backgroundColor: colors.accent }]}
      />
      <View
        style={[
          s.opacityThumb,
          {
            left: Math.max(0, Math.min(ratio * trackW - 11, Math.max(0, trackW - 22))),
            backgroundColor: colors.accent,
            borderColor: colors.white,
          },
        ]}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const [modalVisible, setModalVisible] = useState(false);
  const [langModalVisible, setLangModalVisible] = useState(false);
  const [langSearch, setLangSearch] = useState("");
  const [renderSnow, setRenderSnow] = useState(false);

  // Offline-first: veri indirme + önbellek boyutu
  const { isOnline } = useConnectivity();
  const [cacheSize, setCacheSize] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [downloadPct, setDownloadPct] = useState(0);

  const refreshCacheSize = async () => {
    try {
      const breakdown = await getBreakdown();
      setCacheSize(breakdown.total);
    } catch {
      // yok say
    }
  };
  useEffect(() => {
    refreshCacheSize();
  }, []);

  const { t, language, toggleLanguage } = useLanguage();
  const { theme } = useTheme();
  const { adultContent, chaneAdultContent } = useContentSettings();
  const { showSnow, changeShowSnow } = useSnowSettings();
  const {
    showIconBackground,
    changeShowIconBackground,
    iconBackgroundMode,
    changeIconBackgroundMode,
    iconBackgroundOpacity,
    changeIconBackgroundOpacity,
  } = useIconBackgroundSettings();
  const { showOngoingTvShows, changeShowOngoingTvShows } =
    useOngoingTvShowsSettings();
  const { imageQuality, imageQualityLevel, changeImageQuality } =
    useImageQualitySettings();
  const { hapticsEnabled, changeHapticsEnabled } = useHapticsSettings();
  const {
    notificationSettings,
    changeNotificationSettings,
  } = useNotificationSettings();
  const {
    autoDataCacheEnabled,
    changeAutoDataCacheEnabled,
  } = useAutoDataCacheSettings();
  const { permissionStatus, requestPermission } = useDeviceNotifications();

  useEffect(() => {
    if (!showSnow) {
      setRenderSnow(false);
      return undefined;
    }

    const task = InteractionManager.runAfterInteractions(() => {
      setRenderSnow(true);
    });

    return () => task.cancel?.();
  }, [showSnow]);

  const C = buildUiColors(theme);

  const filteredLanguages = LANGUAGES.filter(
    (l) =>
      l.name.toLowerCase().includes(langSearch.toLowerCase()) ||
      l.nativeName.toLowerCase().includes(langSearch.toLowerCase()),
  );
  const currentLang =
    LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

  const handleDownloadData = async () => {
    if (downloading) return;
    if (!isOnline) {
      appAlert(
        i18nText("autoI18n.cevrimdisi", "Çevrimdışı"),
        i18nText(
          "autoI18n.veriIndirmeInternet",
          "Verileri indirmek için internet bağlantısı gerekli.",
        ),
      );
      return;
    }
    setDownloading(true);
    setDownloadPct(0);
    try {
      const res = await downloadAllData({
        language,
        onProgress: (p) => setDownloadPct(p),
      });
      await refreshCacheSize();
      if (res.ok) {
        appAlert(
          i18nText("autoI18n.tamamlandi", "Tamamlandı"),
          i18nText(
            "autoI18n.verilerIndirildi",
            "Veriler çevrimdışı kullanım için indirildi.",
          ),
        );
      } else {
        appAlert(
          i18nText("autoI18n.kismenIndirildi", "Kısmen indirildi"),
          res.errors.join("\n"),
        );
      }
    } catch (e) {
      appAlert(i18nText("autoI18n.hata", "Hata"), e?.message || "");
    } finally {
      setDownloading(false);
    }
  };

  const handleSelectLanguage = (code) => {
    toggleLanguage(code);
    setLangModalVisible(false);
    setLangSearch("");
  };

  const currentQualityLabel =
    t[IMAGE_QUALITIES.find((q) => q.value === imageQualityLevel)?.labelKey] ?? "—";
  const notificationsEnabled = notificationSettings.enabled;
  const remindersEnabled =
    notificationsEnabled && notificationSettings.remindersEnabled;

  const updateNotifications = (patch) => {
    changeNotificationSettings(patch);
  };

  // Ana anahtar açılınca OS bildirim iznini iste; reddedilirse yönlendir.
  const handleToggleMaster = async (enabled) => {
    updateNotifications({ enabled });
    if (enabled && permissionStatus !== "granted") {
      const granted = await requestPermission();
      if (!granted) {
        appAlert(t.notifPermissionTitle, t.notifPermissionMessage);
      }
    }
  };

  const masterSubtitle =
    notificationsEnabled && permissionStatus === "denied"
      ? t.notifPermissionDenied
      : t.allNotificationsSubtitle;

  // ── DEV-ONLY: arka plan push zincirini tek cihazla test eder ──
  // Kendi uid'ine doğrudan bir notif dökümanı yazar (createSocialNotification'daki
  // self-guard'ı atlar; firestore.rules fromUid==auth.uid istediği için kurala uygun).
  // Cloud Function onSocialNotificationCreated tetiklenir → kendi token'ına push gelir.
  // Test için: bas → uygulamayı TAMAMEN kapat → birkaç saniye içinde push düşmeli.
  const [sendingTestPush, setSendingTestPush] = useState(false);
  const handleSendTestPush = async () => {
    if (sendingTestPush) return;
    const uid = auth.currentUser?.uid;
    if (!uid) {
      appAlert("Test push", "Oturum açık değil.");
      return;
    }
    setSendingTestPush(true);
    try {
      await addDoc(collection(db, "Users", uid, "notifications"), {
        type: "post_like",
        fromUid: uid,
        fromName: "Test (kendin)",
        fromAvatarIndex: 0,
        read: false,
        createdAt: serverTimestamp(),
      });
      appAlert(
        "Test push gönderildi",
        "Şimdi uygulamayı TAMAMEN kapat. Birkaç saniye içinde arka plan bildirimi gelmeli. Loglar: firebase functions:log",
      );
    } catch (e) {
      appAlert("Test push hatası", e?.message || String(e));
    } finally {
      setSendingTestPush(false);
    }
  };

  return (
    <View style={[s.root, { backgroundColor: C.bg }]}>
      <IconBacground opacity={0.15} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {renderSnow && (
          <LottieView
            style={s.lottie}
            source={require("@lottie/snow.json")}
            autoPlay
            loop
          />
        )}

        <Text allowFontScaling={false} style={[s.pageTitle, { color: C.text }]}>
          {t.settings}
        </Text>

        <SectionLabel color={C.muted}>{t.language.toUpperCase()}</SectionLabel>
        <TouchableOpacity
          style={[s.langCard, { backgroundColor: C.card, borderColor: C.border }]}
          onPress={() => {
            setLangSearch("");
            setLangModalVisible(true);
          }}
          activeOpacity={0.7}
        >
          <View style={s.langLeft}>
            <View style={[s.iconWrap, { backgroundColor: C.iconBlue }]}>
              <AppIcon name="language-outline" size={16} color={C.blue} />
            </View>
            <View>
              <Text allowFontScaling={false} style={[s.langSubLabel, { color: C.muted }]}>
                {t.language.toUpperCase()}
              </Text>
              <Text allowFontScaling={false} style={[s.langValue, { color: C.text }]}>
                {currentLang.nativeName}
              </Text>
            </View>
          </View>
          <View style={s.langRight}>
            <View style={[s.flagWrap, { borderColor: C.border }]}>
              <CountryFlag
                isoCode={currentLang.flag}
                size={24}
                style={{ borderRadius: 5 }}
              />
            </View>
            <Chevron color={C.muted} />
          </View>
        </TouchableOpacity>

        <SectionLabel color={C.muted}>{t.theme.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={[s.themeHeader, { borderBottomColor: C.borderMuted }]}>
            <View style={[s.iconWrap, { backgroundColor: C.iconAmber }]}>
              <AppIcon name="sunny-outline" size={15} color={C.amber} />
            </View>
            <Text allowFontScaling={false} style={[s.rowTitle, { color: C.text }]}>
              {t.appearance}
            </Text>
          </View>
          <SettingsTheme />
        </View>

        <SectionLabel color={C.muted}>{t.quality.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <View style={s.qualityHeader}>
            <View style={[s.iconWrap, { backgroundColor: C.iconPurple }]}>
              <AppIcon family="MaterialIcons" name="high-quality" size={16} color={C.purple} />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[s.rowTitle, { color: C.text }]}>
                {t.posterQuality}
              </Text>
              <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                {currentQualityLabel} · poster:{imageQuality.poster} · backdrop:
                {imageQuality.backdrop}
              </Text>
            </View>
            <View style={[s.qualityBadge, { backgroundColor: C.accentDim }]}>
              <Text
                allowFontScaling={false}
                style={[s.qualityBadgeText, { color: C.accentStrong }]}
              >
                {currentQualityLabel}
              </Text>
            </View>
          </View>
          <View
            style={[
              s.segment,
              { backgroundColor: C.cardAlt, borderTopColor: C.border },
            ]}
          >
            {IMAGE_QUALITIES.map((q) => {
              const active = imageQualityLevel === q.value;
              return (
                <TouchableOpacity
                  key={q.value}
                  style={[s.segOpt, active && { backgroundColor: C.accent }]}
                  onPress={() => changeImageQuality(q.value)}
                  activeOpacity={0.7}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      s.segText,
                      { color: active ? C.white : C.muted, fontWeight: active ? "700" : "500" },
                    ]}
                  >
                    {t[q.labelKey]}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <SectionLabel color={C.muted}>{t.notifications.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName={
              notificationsEnabled
                ? "notifications-outline"
                : "notifications-off-outline"
            }
            title={t.allNotifications}
            subtitle={masterSubtitle}
            right={
              <SwitchToggle
                value={notificationsEnabled}
                onValueChange={handleToggleMaster}
                size={36}
              />
            }
          />
          <View style={[s.notificationGroup, { borderBottomColor: C.borderMuted }]}>
            <Text allowFontScaling={false} style={[s.notificationGroupText, { color: C.muted }]}>
              {t.reminderNotificationGroup}
            </Text>
          </View>
          <SettingRow
            colors={C}
            iconBg={C.iconGreen}
            iconColor={C.green}
            iconName="alarm-outline"
            title={t.reminderNotifications}
            subtitle={t.reminderNotificationsSubtitle}
            right={
              <SwitchToggle
                value={remindersEnabled}
                onValueChange={(remindersEnabled) =>
                  updateNotifications({ remindersEnabled })
                }
                disabled={!notificationsEnabled}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName="film-outline"
            title={t.movieReminderNotifications}
            subtitle={t.movieReminderNotificationsSubtitle}
            right={
              <SwitchToggle
                value={
                  remindersEnabled &&
                  notificationSettings.moviesEnabled
                }
                onValueChange={(moviesEnabled) =>
                  updateNotifications({ moviesEnabled })
                }
                disabled={!remindersEnabled}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconPurple}
            iconColor={C.purple}
            iconName="tv-outline"
            title={t.tvReminderNotifications}
            subtitle={t.tvReminderNotificationsSubtitle}
            right={
              <SwitchToggle
                value={
                  remindersEnabled &&
                  notificationSettings.tvShowsEnabled
                }
                onValueChange={(tvShowsEnabled) =>
                  updateNotifications({ tvShowsEnabled })
                }
                disabled={!remindersEnabled}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconTeal}
            iconColor={C.teal}
            iconName="document-text-outline"
            title={t.noteReminderNotifications}
            subtitle={t.noteReminderNotificationsSubtitle}
            right={
              <SwitchToggle
                value={
                  remindersEnabled &&
                  notificationSettings.noteRemindersEnabled
                }
                onValueChange={(noteRemindersEnabled) =>
                  updateNotifications({ noteRemindersEnabled })
                }
                disabled={!remindersEnabled}
                size={36}
              />
            }
          />
          <View style={s.notificationTiming}>
            <View style={s.notificationTimingHeader}>
              <View style={[s.iconWrap, { backgroundColor: C.iconGreen }]}>
                <AppIcon name="time-outline" size={15} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text allowFontScaling={false} style={[s.rowTitle, { color: C.text }]}>
                  {t.reminderNotificationTiming}
                </Text>
                <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                  {t.reminderNotificationTimingSubtitle}
                </Text>
              </View>
            </View>
            <View
              style={[
                s.segment,
                s.notificationTimingSegment,
                { backgroundColor: C.cardAlt, borderTopColor: C.border },
              ]}
            >
              {REMINDER_NOTIFICATION_TIMINGS.map((item) => {
                const active =
                  notificationSettings.leadTimeDays === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[
                      s.segOpt,
                      active && remindersEnabled && { backgroundColor: C.accent },
                      !remindersEnabled && { opacity: 0.45 },
                    ]}
                    disabled={!remindersEnabled}
                    onPress={() =>
                      updateNotifications({ leadTimeDays: item.value })
                    }
                    activeOpacity={0.7}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[
                        s.segText,
                        {
                          color:
                            active && remindersEnabled ? C.white : C.muted,
                          fontWeight:
                            active && remindersEnabled ? "700" : "500",
                        },
                      ]}
                    >
                      {t[item.labelKey]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={[s.notificationGroup, { borderBottomColor: C.borderMuted }]}>
            <Text allowFontScaling={false} style={[s.notificationGroupText, { color: C.muted }]}>
              {t.socialNotificationGroup}
            </Text>
          </View>
          {NOTIFICATION_ROWS.map((row, index) => (
            <SettingRow
              key={row.key}
              colors={C}
              iconBg={C[row.bgKey]}
              iconColor={C[row.colorKey]}
              iconName={row.iconName}
              title={t[row.titleKey]}
              subtitle={t[row.subtitleKey]}
              last={index === NOTIFICATION_ROWS.length - 1 && !__DEV__}
              right={
                <SwitchToggle
                  value={notificationsEnabled && notificationSettings[row.key]}
                  onValueChange={(value) =>
                    updateNotifications({ [row.key]: value })
                  }
                  disabled={!notificationsEnabled}
                  size={36}
                />
              }
            />
          ))}
          {__DEV__ && (
            <SettingRow
              colors={C}
              iconBg={C.iconBlue}
              iconColor={C.blue}
              iconName={sendingTestPush ? "hourglass-outline" : "paper-plane-outline"}
              title="Test push gönder (bana)"
              subtitle="DEV-only · arka plan push zincirini test eder"
              last
              onPress={handleSendTestPush}
              right={
                sendingTestPush ? (
                  <ActivityIndicator size="small" color={C.blue} />
                ) : (
                  <AppIcon name="chevron-forward" size={16} color={C.muted} />
                )
              }
            />
          )}
        </View>

        <SectionLabel color={C.muted}>
          {(t.myPermissions || "İzinlerim").toUpperCase()}
        </SectionLabel>
        <PermissionsSection colors={C} />

        <SectionLabel color={C.muted}>{t.general.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName="cloud-download-outline"
            title={t.downloadData}
            subtitle={t.downloadDataSubtitle}
            right={
              <SwitchToggle
                value={autoDataCacheEnabled}
                onValueChange={changeAutoDataCacheEnabled}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconPurple}
            iconColor={C.purple}
            iconName={adultContent ? "eye-outline" : "eye-off-outline"}
            title={t.adultContent}
            subtitle={t.adultContentSubtitle}
            right={
              <SwitchToggle
                value={adultContent}
                onValueChange={() => chaneAdultContent(!adultContent)}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconGreen}
            iconColor={C.green}
            iconName={showOngoingTvShows ? "play-circle-outline" : "pause-circle-outline"}
            title={t.showOngoingTvShows}
            subtitle={t.showOngoingTvShowsSubtitle}
            right={
              <SwitchToggle
                value={showOngoingTvShows}
                onValueChange={changeShowOngoingTvShows}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconAmber}
            iconColor={C.amber}
            iconName={hapticsEnabled ? "phone-portrait-outline" : "phone-portrait"}
            title={t.haptics}
            subtitle={t.hapticsSubtitle}
            last
            right={
              <SwitchToggle
                value={hapticsEnabled}
                onValueChange={changeHapticsEnabled}
                size={36}
              />
            }
          />
        </View>

        {/* Kişiselleştirme: kar + ikon arka planı + pet aynı alanda toplandı */}
        <SectionLabel color={C.muted}>{t.personalization.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconTeal}
            iconColor={C.teal}
            iconName={showSnow ? "snow-sharp" : "snow-outline"}
            title={t.snow}
            subtitle={t.snowSubtitle}
            right={
              <SwitchToggle
                value={showSnow}
                onValueChange={changeShowSnow}
                size={36}
              />
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName={showIconBackground ? "image-outline" : "image-sharp"}
            title={t.iconBackground}
            subtitle={t.iconBackgroundSubtitle}
            last={!showIconBackground}
            right={
              <SwitchToggle
                value={showIconBackground}
                onValueChange={changeShowIconBackground}
                size={36}
              />
            }
          />
          {showIconBackground && (
            <>
            <View style={[s.iconBgOpacity, { borderBottomColor: C.borderMuted }]}>
              <View style={s.iconBgModeHeader}>
                <View style={[s.iconWrap, { backgroundColor: C.iconPurple }]}>
                  <AppIcon name="contrast-outline" size={16} color={C.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling={false} style={[s.rowTitle, { color: C.text }]}>
                    {t.iconBackgroundOpacity}
                  </Text>
                  <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                    {t.iconBackgroundOpacitySubtitle}
                  </Text>
                </View>
                <View style={[s.qualityBadge, { backgroundColor: C.accentDim }]}>
                  <Text
                    allowFontScaling={false}
                    style={[s.qualityBadgeText, { color: C.accentStrong }]}
                  >
                    {Math.round((iconBackgroundOpacity ?? 1) * 100)}%
                  </Text>
                </View>
              </View>
              <View style={s.iconBgSliderWrap}>
                <OpacitySlider
                  value={iconBackgroundOpacity ?? 1}
                  onChange={changeIconBackgroundOpacity}
                  colors={C}
                />
              </View>
            </View>

            <View style={s.iconBgMode}>
              <View style={s.iconBgModeHeader}>
                <View style={[s.iconWrap, { backgroundColor: C.iconBlue }]}>
                  <AppIcon family="MaterialCommunityIcons" name="view-grid-outline" size={16} color={C.blue} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text allowFontScaling={false} style={[s.rowTitle, { color: C.text }]}>
                    {t.iconBackgroundLayout}
                  </Text>
                  <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                    {iconBackgroundMode === "random"
                      ? t.iconBackgroundRandomHint
                      : t.iconBackgroundSharedHint}
                  </Text>
                </View>
              </View>
              <View
                style={[
                  s.segment,
                  { backgroundColor: C.cardAlt, borderTopColor: C.border },
                ]}
              >
                {[
                  { value: "shared", label: t.iconBackgroundShared },
                  { value: "random", label: t.iconBackgroundRandom },
                ].map((o) => {
                  const active = iconBackgroundMode === o.value;
                  return (
                    <TouchableOpacity
                      key={o.value}
                      style={[s.segOpt, active && { backgroundColor: C.accent }]}
                      onPress={() => changeIconBackgroundMode(o.value)}
                      activeOpacity={0.7}
                    >
                      <Text
                        allowFontScaling={false}
                        style={[
                          s.segText,
                          { color: active ? C.white : C.muted, fontWeight: active ? "700" : "500" },
                        ]}
                      >
                        {o.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            </>
          )}
        </View>

        <View style={s.personalizationGap} />
        <PetSettingsSection colors={C} showLabel={false} />

        <SectionLabel color={C.muted}>{t.data.toUpperCase()}</SectionLabel>
        <View style={[s.card, { backgroundColor: C.card, borderColor: C.border }]}>
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconFamily="MaterialCommunityIcons"
            iconName="cloud-download-outline"
            title={i18nText("autoI18n.verileriIndir", "Verileri indir")}
            subtitle={
              downloading
                ? `${i18nText("autoI18n.indiriliyor", "İndiriliyor")} · %${Math.round(
                    downloadPct * 100,
                  )}`
                : i18nText(
                    "autoI18n.verileriIndirAlt",
                    "Çevrimdışı için listeler, notlar, hatırlatıcılar ve posterler",
                  )
            }
            onPress={handleDownloadData}
            right={
              downloading ? (
                <ActivityIndicator size="small" color={C.blue} />
              ) : (
                <Chevron color={C.muted} />
              )
            }
          />
          <SettingRow
            colors={C}
            iconBg={C.iconBlue}
            iconColor={C.blue}
            iconName="server-outline"
            title={i18nText("autoI18n.onbellek", "Önbellek")}
            subtitle={
              cacheSize > 0
                ? `${fmtBytes(cacheSize)} · ${i18nText("autoI18n.goruntuleVeTemizle", "görüntüle ve temizle")}`
                : i18nText("autoI18n.goruntuleVeTemizle", "görüntüle ve temizle")
            }
            last
            onPress={() => setModalVisible(true)}
            right={<Chevron color={C.muted} />}
          />
        </View>

        <SwipeCard>
          <SectionLabel color={C.muted}>{t.about.toUpperCase()}</SectionLabel>
          <View
            style={[
              s.aboutCard,
              { backgroundColor: C.card, borderColor: C.border },
            ]}
          >
            <View
              style={[
                s.appIcon,
                {
                  borderColor: C.border,
                },
              ]}
            >
              <Image
                source={require("../../assets/android-icon-foreground.png")}
                style={{ width: 50, height: 50 }}
                contentFit="contain"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text allowFontScaling={false} style={[s.aboutName, { color: C.text }]}>
                Watchify
              </Text>
              <Text allowFontScaling={false} style={[s.aboutMeta, { color: C.muted }]}>
                created by ismail ozturk · © 2025
              </Text>
              <Text
                allowFontScaling={false}
                style={[s.aboutMeta, { marginTop: 2, fontSize: 10, color: C.muted }]}
              >
                {t.tmdbAttribution}
              </Text>
            </View>
            <View style={[s.versionBadge, { backgroundColor: C.borderMuted }]}>
              <Text
                allowFontScaling={false}
                style={[s.versionText, { color: C.text }]}
              >
                v1.21.1
              </Text>
            </View>
          </View>
        </SwipeCard>

        <CacheManagerModal
          visible={modalVisible}
          onClose={() => {
            setModalVisible(false);
            refreshCacheSize();
          }}
          colors={C}
        />

        <Modal
          animationType="slide"
          transparent
          visible={langModalVisible}
          onRequestClose={() => {
            setLangModalVisible(false);
            setLangSearch("");
          }}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={{ flex: 1 }}
          >
            <View style={s.sheetOverlay}>
              <TouchableOpacity
                style={StyleSheet.absoluteFill}
                activeOpacity={1}
                onPress={() => {
                  setLangModalVisible(false);
                  setLangSearch("");
                }}
              />
              <BlurView
                tint="dark"
                intensity={40}
                experimentalBlurMethod="dimezisBlurView"
                style={StyleSheet.absoluteFill}
              />
              <View
                style={[
                  s.sheet,
                  { backgroundColor: C.card, borderColor: C.border },
                ]}
              >
                <View style={[s.sheetHandle, { backgroundColor: C.handle }]} />
                <View style={s.sheetHeader}>
                  <View style={s.sheetTitleRow}>
                    <AppIcon
                      name="language-outline"
                      size={20}
                      color={C.text}
                    />
                    <Text allowFontScaling={false} style={[s.sheetTitle, { color: C.text }]}>
                      {t.language}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[s.closeBtn, { backgroundColor: C.closeBg }]}
                    onPress={() => {
                      setLangModalVisible(false);
                      setLangSearch("");
                    }}
                  >
                    <AppIcon name="close" size={16} color={C.muted} />
                  </TouchableOpacity>
                </View>

                <View
                  style={[
                    s.searchBox,
                    { borderColor: C.border, backgroundColor: C.cardAlt },
                  ]}
                >
                  <AppIcon name="search-outline" size={16} color={C.muted} />
                  <TextInput
                    allowFontScaling={false}
                    style={[s.searchInput, { color: C.text }]}
                    placeholder={t.searchLanguage}
                    placeholderTextColor={C.muted}
                    value={langSearch}
                    onChangeText={setLangSearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                  />
                  {langSearch.length > 0 && (
                    <TouchableOpacity onPress={() => setLangSearch("")}>
                      <AppIcon name="close-circle" size={16} color={C.muted} />
                    </TouchableOpacity>
                  )}
                </View>

                <FlatList
                  data={filteredLanguages}
                  keyExtractor={(i) => i.code}
                  style={{ maxHeight: 320 }}
                  showsVerticalScrollIndicator={false}
                  ListEmptyComponent={
                    <View style={s.emptyContainer}>
                      <AppIcon
                        name="search-outline"
                        size={28}
                        color={C.muted}
                      />
                      <Text allowFontScaling={false} style={[s.emptyText, { color: C.muted }]}>
                        {t.languageNotFound}
                      </Text>
                    </View>
                  }
                  renderItem={({ item }) => {
                    const sel = item.code === language;
                    return (
                      <TouchableOpacity
                        style={[
                          s.langItem,
                          sel && {
                            backgroundColor: C.accentDim,
                            borderColor: C.accent,
                          },
                        ]}
                        onPress={() => handleSelectLanguage(item.code)}
                        activeOpacity={0.7}
                      >
                        <View style={s.langItemLeft}>
                          <CountryFlag
                            isoCode={item.flag}
                            size={28}
                            style={{ borderRadius: 6 }}
                          />
                          <View>
                            <Text
                              allowFontScaling={false}
                              style={[
                                s.langItemName,
                                { color: sel ? C.accent : C.text, fontWeight: sel ? "700" : "500" },
                              ]}
                            >
                              {item.nativeName}
                            </Text>
                            <Text allowFontScaling={false} style={[s.rowSub, { color: C.muted }]}>
                              {item.name}
                            </Text>
                          </View>
                        </View>
                        {sel && (
                          <AppIcon
                            name="checkmark-circle"
                            size={20}
                            color={C.accent}
                          />
                        )}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 110,
  },
  lottie: {
    position: "absolute",
    top: 0,
    height: 1600,
    left: -60,
    right: -60,
    zIndex: 0,
  },
  pageTitle: {
    fontSize: 26,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
    letterSpacing: -0.5,
  },
  sectionLabel: {
    fontSize: 10.5,
    fontWeight: "600",
    letterSpacing: 1.2,
    marginBottom: 10,
    marginLeft: 4,
    marginTop: 22,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: "hidden",
  },
  personalizationGap: {
    height: 10,
  },
  iconBgMode: {
    paddingTop: 13,
  },
  iconBgModeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  iconBgOpacity: {
    paddingTop: 13,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  iconBgSliderWrap: {
    paddingHorizontal: 16,
  },
  opacityTrack: {
    height: 26,
    borderRadius: 13,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "center",
  },
  opacityFill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    opacity: 0.35,
  },
  opacityThumb: {
    position: "absolute",
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 3,
    top: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  rowRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  rowTexts: {
    flex: 1,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: "500",
  },
  rowSub: {
    fontSize: 11,
    marginTop: 2,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  langCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  langLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  langSubLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  langValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 2,
  },
  langRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flagWrap: {
    borderRadius: 6,
    overflow: "hidden",
    borderWidth: 1,
  },
  themeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  qualityHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  qualityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  qualityBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  notificationTiming: {
    paddingTop: 13,
  },
  notificationTimingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  notificationTimingSegment: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  notificationGroup: {
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  notificationGroupText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  segment: {
    flexDirection: "row",
    borderTopWidth: 1,
    padding: 4,
    gap: 2,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
  },
  segOpt: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
  },
  segText: {
    fontSize: 11,
    textAlign: "center",
  },
  aboutCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
  },
  appIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    flexShrink: 0,
  },
  aboutName: {
    fontSize: 15,
    fontWeight: "600",
  },
  aboutMeta: {
    fontSize: 11.5,
    marginTop: 3,
  },
  versionBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  versionText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBox: {
    borderRadius: 22,
    padding: 28,
    marginHorizontal: 32,
    width: "85%",
    borderWidth: 1,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    textAlign: "center",
    fontWeight: "500",
    marginBottom: 22,
    lineHeight: 22,
  },
  modalButtons: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  btnText: {
    fontWeight: "700",
    fontSize: 14,
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: 16,
    paddingBottom: 34,
    paddingTop: 12,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sheetTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  langItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "transparent",
    marginBottom: 8,
  },
  langItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  langItemName: {
    fontSize: 15,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 30,
    gap: 10,
  },
  emptyText: {
    fontSize: 13,
  },
});
