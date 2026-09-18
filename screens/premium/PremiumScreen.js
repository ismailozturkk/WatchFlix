import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  InteractionManager,
  LayoutAnimation,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "react-native-toast-message";
import AppIcon from "../../components/AppIcon";
import AppBadge from "../../components/badges/AppBadge";
import {
  IDENTITY_BADGES,
  badgeDesc,
  badgeLabel,
} from "../../components/badges/badgeCatalog";
import { useLanguage } from "../../context/LanguageContext";
import { usePremium } from "../../context/PremiumContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import {
  getPackagesForTier,
  getPackageDisplayProduct,
  getPackageMonthlyEquivalent,
  getPackagePeriodKey,
  getPackageSavings,
  getPackageTierKey,
  getPremiumPlanDisplayName,
  AI_PLAN_LIMITS,
  PREMIUM_PLAN,
  selectPreferredPackage,
} from "../../utils/premium";
import { SettingsSubScreen, buildUiColors } from "../tabs/settings/settingsUi";
import { i18nText } from "../../utils/i18nText";
import { openLegalPage } from "../../utils/legalLinks";
import { useRoute } from "@react-navigation/native";
import {
  FONT_CATALOG_SIZE,
  PLANS,
  formatFeatureValue,
  getComparisonSections,
  getFeature,
} from "../../utils/premiumFeatures";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analytics";

// ÖNE ÇIKAN FAYDALAR — seçili plana göre, utils/premiumFeatures.js
// değerlerinden üretilir. Buradaki her cümlenin arkasında bir kapı var; yeni
// bir fayda eklemek için önce registry'e girdi ve kapı ekle, sonra buraya.
// (P0.2: elle yazılmış vaat listeleri uygulamada karşılığı olmayan
// "reklamsız", "tüm Wrapped yılları" gibi iddialara dönüşmüştü.)
function buildHighlights(tier, tr) {
  const lang = tr ? "tr" : "en";
  const ai = AI_PLAN_LIMITS[tier];
  const multiplier = Math.round(ai.daily / AI_PLAN_LIMITS.free.daily);
  const isMax = tier === PREMIUM_PLAN.UNLIMITED;
  const value = (featureId) => formatFeatureValue(featureId, tier, lang);
  return [
    {
      id: "ai",
      icon: "sparkles",
      color: "#8B5CF6",
      badge: tr ? `${multiplier}X KOTA` : `${multiplier}X QUOTA`,
      title: "CineMatch AI",
      tagline: tr
        ? `Günde ${ai.daily}, ayda ${ai.monthly} mesaj`
        : `${ai.daily} per day, ${ai.monthly} per month`,
      desc: tr
        ? "Ruh haline ve izleme geçmişine göre nokta atışı film ve dizi önerileri."
        : "Spot-on movie and TV picks based on your mood and watch history.",
    },
    {
      id: "badge",
      icon: "diamond",
      color: "#F59E0B",
      badge: isMax ? (tr ? "EFSANEVİ" : "LEGENDARY") : tr ? "EPİK" : "EPIC",
      title: tr ? "Kimlik Rozeti" : "Identity Badge",
      tagline: tr ? "Arkadaşların da görür" : "Your friends see it too",
      desc: tr
        ? "Profilinde ve arkadaşlarının gördüğü profil sayfanda parıldayan plan rozeti."
        : "A plan badge on your profile and on the profile your friends see.",
    },
    {
      id: "social",
      icon: "people",
      color: "#EC4899",
      badge: isMax ? (tr ? "SINIRSIZ" : "UNLIMITED") : tr ? "DAHA FAZLA" : "MORE",
      title: tr ? "Sosyal & Oyun" : "Social & Games",
      tagline: isMax
        ? tr
          ? "Liste, arkadaş, grup ve oyun sınırsız"
          : "Unlimited lists, friends, groups, games"
        : `${value("custom_lists")} · ${value("friends")}`,
      desc: tr
        ? `Sohbet grubu: ${value("chat_groups")} · Oyun: ${value("games")} · CineSwipe odası: ${value("cineswipe_rooms")}.`
        : `Group chats: ${value("chat_groups")} · Games: ${value("games")} · CineSwipe rooms: ${value("cineswipe_rooms")}.`,
    },
    {
      id: "personal",
      icon: "color-palette",
      color: "#10B981",
      badge: tr ? "KİŞİSEL" : "PERSONAL",
      title: tr ? "Tema & Yazı Tipi" : "Themes & Fonts",
      tagline: tr
        ? `Kendi temanı oluştur · ${FONT_CATALOG_SIZE} yazı tipi`
        : `Your own themes · ${FONT_CATALOG_SIZE} fonts`,
      desc: tr
        ? `Wrapped arşivinin tamamı ve ${value("streaming_alerts")} için platform bildirimi de dahil.`
        : `Also includes your full Wrapped archive and streaming alerts for ${value("streaming_alerts")}.`,
    },
  ];
}

function packageTitle(aPackage, tr) {
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "Yıllık Plan" : "Annual Plan";
  if (key === "monthly") return tr ? "Aylık Plan" : "Monthly Plan";
  if (key === "weekly") return tr ? "Haftalık Plan" : "Weekly Plan";
  if (key === "lifetime") return tr ? "Ömür Boyu" : "Lifetime";
  return aPackage?.product?.title || aPackage?.identifier || "Plan";
}

function packagePeriodLabel(aPackage, tr) {
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "/ yıl" : "/ year";
  if (key === "monthly") return tr ? "/ ay" : "/ month";
  if (key === "weekly") return tr ? "/ hafta" : "/ week";
  return "";
}

export default function PremiumScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const tr = language === "tr";
  const localized = tr ? "tr" : "en";

  const {
    isPremium,
    isUnlimited,
    plan,
    packages,
    loading,
    busyAction,
    configurationError,
    entitlementId,
    usingTestStore,
    purchasePackage,
    restorePurchases,
    openCustomerCenter,
  } = usePremium();

  // Hangi kapı getirdi? (services/premiumUpsell.openPremiumScreen). Özellik
  // kimliğiyse üstte o özelliğin plan değerleri gösterilir ve karşılaştırma
  // o kategoriyle açılır.
  const route = useRoute();
  const source = route?.params?.source || "direct";
  const sourceFeature = getFeature(source);
  useEffect(() => {
    trackEvent(ANALYTICS_EVENTS.PAYWALL_VIEW, {
      source,
      offering: "native_screen",
      only_if_needed: false,
    });
  }, [source]);

  const [selectedTier, setSelectedTier] = useState(PREMIUM_PLAN.PREMIUM);
  const [selectedId, setSelectedId] = useState(null);
  const [showDetailedSection, setShowDetailedSection] = useState(Boolean(sourceFeature));
  const [categoryFilter, setCategoryFilter] = useState(sourceFeature?.category || "all");

  const comparisonSections = useMemo(
    () => getComparisonSections(localized),
    [localized],
  );
  const comparisonRowCount = comparisonSections.reduce(
    (total, section) => total + section.rows.length,
    0,
  );

  const ctaShimmer = useRef(new Animated.Value(0)).current;

  const displayPackages = useMemo(
    () =>
      [...packages].sort((left, right) => {
        const tierOrder =
          (getPackageTierKey(left) === PREMIUM_PLAN.UNLIMITED ? 1 : 0) -
          (getPackageTierKey(right) === PREMIUM_PLAN.UNLIMITED ? 1 : 0);
        if (tierOrder) return tierOrder;
        const periodRank = (item) =>
          getPackagePeriodKey(item) === "annual" ? 0 : 1;
        return periodRank(left) - periodRank(right);
      }),
    [packages]
  );

  const pricedPackages = useMemo(
    () =>
      displayPackages.map((item) => ({
        ...item,
        product: getPackageDisplayProduct(item, {
          usingTestStore,
          language,
        }),
      })),
    [displayPackages, language, usingTestStore]
  );

  // Initialize selected tier and package
  useEffect(() => {
    if (selectedId && packages.some((item) => item.identifier === selectedId)) {
      return;
    }
    const targetTier =
      plan === PREMIUM_PLAN.PREMIUM
        ? PREMIUM_PLAN.UNLIMITED
        : plan === PREMIUM_PLAN.UNLIMITED
        ? PREMIUM_PLAN.UNLIMITED
        : PREMIUM_PLAN.PREMIUM;

    const initialPackage = selectPreferredPackage(
      getPackagesForTier(packages, targetTier)
    );
    setSelectedId(
      initialPackage?.identifier || packages[0]?.identifier || null
    );
    setSelectedTier(
      initialPackage ? getPackageTierKey(initialPackage) : targetTier
    );
  }, [packages, plan, selectedId]);

  // CTA Shimmer Animation (ekran geçiş animasyonu tamamlandıktan sonra başlar, kasılmayı önler)
  useEffect(() => {
    let animation;
    const task = InteractionManager.runAfterInteractions(() => {
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(ctaShimmer, {
            toValue: 1,
            duration: 2400,
            easing: Easing.inOut(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.delay(800),
        ])
      );
      animation.start();
    });

    return () => {
      task?.cancel?.();
      animation?.stop?.();
    };
  }, [ctaShimmer]);

  const selectedPackage =
    packages.find((item) => item.identifier === selectedId) || null;
  const selectedDisplayPackage =
    pricedPackages.find((item) => item.identifier === selectedId) || null;
  const selectedTierPackages = getPackagesForTier(pricedPackages, selectedTier);
  const busy = Boolean(busyAction);
  const selectedPlanName = getPremiumPlanDisplayName(selectedTier);
  const selectedIdentityBadge =
    selectedTier === PREMIUM_PLAN.UNLIMITED
      ? IDENTITY_BADGES.unlimited
      : IDENTITY_BADGES.premium;
  const highlights = buildHighlights(selectedTier, tr);

  const handleSelectTier = (tier) => {
    if (isUnlimited && tier !== PREMIUM_PLAN.UNLIMITED) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedTier(tier);
    const tierPackages = getPackagesForTier(pricedPackages, tier);
    const preferred = selectPreferredPackage(tierPackages);
    if (preferred) {
      setSelectedId(preferred.identifier);
    } else if (tierPackages.length > 0) {
      setSelectedId(tierPackages[0].identifier);
    }
  };

  const handleSelectPackage = (packageId) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedId(packageId);
  };

  const buy = async () => {
    if (!selectedPackage || busy) return;
    try {
      await purchasePackage(selectedPackage);
      Toast.show({
        type: "success",
        text1: tr ? "Seelogd Premium aktif edildi!" : "Seelogd Premium is active!",
        text2: tr ? "Tüm ayrıcalıkların kullanıma hazır." : "All your benefits are ready.",
      });
    } catch (error) {
      if (error?.userCancelled) return;
      Toast.show({
        type: "error",
        text1: tr ? "Satın alma tamamlanamadı" : "Purchase could not be completed",
        text2: error?.message,
      });
    }
  };

  const restore = async () => {
    if (busy) return;
    try {
      const info = await restorePurchases();
      const restored = Boolean(info?.entitlements?.active?.[entitlementId]);
      Toast.show({
        type: restored ? "success" : "info",
        text1: restored
          ? tr
            ? "Satın alımın başarıyla geri yüklendi"
            : "Purchase successfully restored"
          : tr
          ? "Aktif bir abonelik bulunamadı"
          : "No active subscription found",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: tr ? "Satın alımlar geri yüklenemedi" : "Purchases could not be restored",
        text2: error?.message,
      });
    }
  };

  const manage = async () => {
    if (busy) return;
    try {
      await openCustomerCenter();
    } catch (error) {
      Toast.show({
        type: "error",
        text1: tr ? "Abonelik ayarları açılamadı" : "Subscription settings could not be opened",
        text2: error?.message,
      });
    }
  };

  return (
    <SettingsSubScreen
      title="Seelogd Premium"
      background={
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={[
              alpha(theme.colors?.purple || "#6366F1", 0.16),
              alpha(theme.accent, 0.08),
              theme.primary,
            ]}
            locations={[0, 0.38, 0.85]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        </View>
      }
    >
      {/* Test Store Indicator */}
      {usingTestStore && (
        <View style={[styles.testBadge, { backgroundColor: C.iconAmber, borderColor: alpha(C.amber, 0.3) }]}>
          <AppIcon family="Ionicons" name="flask-outline" size={13} color={C.amber} />
          <Text style={[styles.testBadgeText, { color: C.amber }]}>
            REVENUECAT TEST STORE (SANAL MOD)
          </Text>
        </View>
      )}

      {/* Kaynak özellik bandı: kullanıcı bir limitten/kilitten geldiyse */}
      {sourceFeature ? (
        <View
          style={[
            styles.sourceBanner,
            { backgroundColor: C.card, borderColor: alpha(C.accent, 0.35) },
          ]}
        >
          <View style={[styles.sourceBannerIcon, { backgroundColor: alpha(C.accent, 0.14) }]}>
            <AppIcon name={sourceFeature.icon} size={16} color={C.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sourceBannerTitle, { color: C.text }]}>
              {sourceFeature.title[localized]}
            </Text>
            <Text style={[styles.sourceBannerValues, { color: C.muted }]}>
              {PLANS.map(
                (planId) =>
                  `${getPremiumPlanDisplayName(planId)}: ${formatFeatureValue(
                    source,
                    planId,
                    localized,
                  )}`,
              ).join("  ·  ")}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Hero Card */}
      <View style={[styles.heroCard, { borderColor: alpha(C.accent, 0.28) }]}>
        <LinearGradient
          colors={[
            alpha(C.purple || "#6366F1", 0.45),
            alpha(C.accent, 0.22),
            C.card,
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroGradient}
        >
          <View style={styles.heroTopRow}>
            <View style={[styles.heroBrandPill, { backgroundColor: alpha("#fff", 0.12) }]}>
              <View style={styles.heroBrandDot} />
              <Text style={styles.heroBrandText}>SEELOGD PRO</Text>
            </View>

            {isPremium ? (
              <View style={[styles.heroStatusPill, { backgroundColor: C.iconGreen }]}>
                <View style={[styles.statusDot, { backgroundColor: C.green }]} />
                <Text style={[styles.heroStatusText, { color: C.green }]}>
                  {isUnlimited ? "PREMIUM MAX" : tr ? "AKTİF" : "ACTIVE"}
                </Text>
              </View>
            ) : (
              <View style={[styles.heroStatusPill, { backgroundColor: alpha(C.accent, 0.15) }]}>
                <AppIcon name="sparkles" size={11} color={C.accent} />
                <Text style={[styles.heroStatusText, { color: C.accent }]}>
                  {tr ? "AYRICALIKLARI AÇ" : "UNLOCK ALL"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, { color: C.text }]}>
              {isUnlimited
                ? tr
                  ? "Premium Max ile sınırları kaldır."
                  : "Boundless with Premium Max."
                : isPremium
                ? tr
                  ? "Premium ayrıcalıkların seninle."
                  : "Your Premium benefits are active."
                : tr
                ? "Sinema Deneyimini Zirveye Taşı."
                : "Elevate Your Cinema Experience."}
            </Text>
            <Text style={[styles.heroSubtitle, { color: C.muted }]}>
              {tr
                ? "CineMatch AI önerileri, arkadaşlarının da gördüğü kimlik rozeti, daha geniş sosyal limitler ve kişiselleştirme tek abonelikte."
                : "CineMatch AI picks, an identity badge your friends can see, higher social limits and personalization in one subscription."}
            </Text>
          </View>

          {/* Quick Metrics Bar */}
          <View style={styles.quickMetricsRow}>
            <View style={[styles.quickMetricBox, { backgroundColor: alpha(C.cardAlt, 0.8), borderColor: alpha(C.accent, 0.15) }]}>
              <AppIcon name="sparkles" size={15} color={C.accent} />
              <View>
                <Text fontRole="numeric" style={[styles.quickMetricNum, { color: C.text }]}>
                  {AI_PLAN_LIMITS[selectedTier].daily}
                </Text>
                <Text style={[styles.quickMetricLabel, { color: C.muted }]}>
                  {tr ? "AI / gün" : "AI / day"}
                </Text>
              </View>
            </View>

            <View style={[styles.quickMetricBox, { backgroundColor: alpha(C.cardAlt, 0.8), borderColor: alpha(C.accent, 0.15) }]}>
              <AppIcon name="calendar" size={15} color={C.purple} />
              <View>
                <Text fontRole="numeric" style={[styles.quickMetricNum, { color: C.text }]}>
                  {AI_PLAN_LIMITS[selectedTier].monthly}
                </Text>
                <Text style={[styles.quickMetricLabel, { color: C.muted }]}>
                  {tr ? "AI / ay" : "AI / month"}
                </Text>
              </View>
            </View>

            <View style={[styles.quickMetricBox, { backgroundColor: alpha(C.cardAlt, 0.8), borderColor: alpha(C.accent, 0.15) }]}>
              <AppIcon name="diamond" size={15} color="#F59E0B" />
              <View>
                <Text style={[styles.quickMetricNum, { color: C.text }]}>
                  {selectedTier === PREMIUM_PLAN.UNLIMITED ? (tr ? "Efsanevi" : "Legend") : (tr ? "Epik" : "Epic")}
                </Text>
                <Text style={[styles.quickMetricLabel, { color: C.muted }]}>
                  {tr ? "Rozet Statüsü" : "Badge Rarity"}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>

      {/* DIRECT PLAN & PRICING SECTION */}
      <View style={styles.pricingSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            {tr ? "Planını ve Fiyatını Seç" : "Select Your Plan & Price"}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: C.muted }]}>
            {tr
              ? "Tüm paketler doğrudan listelenir. İstediğin an iptal edebilirsin."
              : "All packages listed transparently. Cancel anytime."}
          </Text>
        </View>

        {/* Segmented Tier Switcher Tabs */}
        <View style={[styles.tierSegmentWrap, { backgroundColor: C.card, borderColor: C.border }]}>
          {[PREMIUM_PLAN.PREMIUM, PREMIUM_PLAN.UNLIMITED].map((tier) => {
            const isSelected = selectedTier === tier;
            const isMax = tier === PREMIUM_PLAN.UNLIMITED;
            const disabled = isUnlimited && !isMax;

            return (
              <Pressable
                key={tier}
                disabled={disabled}
                onPress={() => handleSelectTier(tier)}
                style={[
                  styles.tierSegmentTab,
                  isSelected && styles.tierSegmentTabActive,
                  disabled && { opacity: 0.4 },
                ]}
              >
                {isSelected && (
                  <LinearGradient
                    colors={[C.accent, C.purple || C.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <View style={styles.tierTabContent}>
                  <View style={styles.tierTabTitleRow}>
                    <AppIcon
                      name={isMax ? "infinite" : "diamond"}
                      size={15}
                      color={isSelected ? "#fff" : isMax ? "#F59E0B" : C.accent}
                    />
                    <Text
                      style={[
                        styles.tierTabTitle,
                        { color: isSelected ? "#fff" : C.text },
                      ]}
                    >
                      {getPremiumPlanDisplayName(tier)}
                    </Text>
                    {isMax && (
                      <View style={[styles.tierTabMiniBadge, { backgroundColor: isSelected ? "rgba(255,255,255,0.22)" : alpha("#F59E0B", 0.16) }]}>
                        <Text style={[styles.tierTabMiniBadgeText, { color: isSelected ? "#fff" : "#F59E0B" }]}>
                          {tr ? "EN GÜÇLÜ" : "MAX"}
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.tierTabSub,
                      { color: isSelected ? "rgba(255,255,255,0.85)" : C.muted },
                    ]}
                  >
                    {isMax
                      ? tr
                        ? `Günde ${AI_PLAN_LIMITS.unlimited.daily} AI · Efsanevi Rozet`
                        : `${AI_PLAN_LIMITS.unlimited.daily} AI/day · Legendary Badge`
                      : tr
                      ? `Günde ${AI_PLAN_LIMITS.premium.daily} AI · Epik Rozet`
                      : `${AI_PLAN_LIMITS.premium.daily} AI/day · Epic Badge`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Live Identity Badge Preview for selected tier */}
        <View style={[styles.badgePreviewCard, { backgroundColor: C.card, borderColor: alpha(C.accent, 0.22) }]}>
          <LinearGradient
            colors={[alpha(C.accent, 0.12), "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.badgePreviewLeft}>
            <AppBadge
              glyph={selectedIdentityBadge.glyph}
              glyphSolid={selectedIdentityBadge.glyphSolid}
              rarity={selectedIdentityBadge.rarity}
              ornate={selectedIdentityBadge.ornate}
              size={58}
              accessibilityLabel={badgeLabel(selectedIdentityBadge, language)}
            />
          </View>
          <View style={styles.badgePreviewRight}>
            <View style={styles.badgePreviewHeader}>
              <Text style={[styles.badgePreviewTitle, { color: C.text }]}>
                {badgeLabel(selectedIdentityBadge, language)}
              </Text>
              <View
                style={[
                  styles.badgeRarityTag,
                  {
                    backgroundColor:
                      selectedTier === PREMIUM_PLAN.UNLIMITED
                        ? alpha("#F59E0B", 0.18)
                        : C.accentDim,
                  },
                ]}
              >
                <AppIcon
                  name={selectedTier === PREMIUM_PLAN.UNLIMITED ? "sparkles" : "diamond"}
                  size={10}
                  color={selectedTier === PREMIUM_PLAN.UNLIMITED ? "#D97706" : C.accent}
                />
                <Text
                  style={[
                    styles.badgeRarityText,
                    {
                      color:
                        selectedTier === PREMIUM_PLAN.UNLIMITED
                          ? "#D97706"
                          : C.accent,
                    },
                  ]}
                >
                  {selectedTier === PREMIUM_PLAN.UNLIMITED
                    ? tr ? "EFSANEVİ ROZET" : "LEGENDARY"
                    : tr ? "EPİK ROZET" : "EPIC"}
                </Text>
              </View>
            </View>
            <Text style={[styles.badgePreviewDesc, { color: C.muted }]}>
              {tr
                ? "Profilinde ve arkadaşlarının gördüğü profil sayfanda statü sembolün olarak parıldar."
                : "Shown on your profile and on the profile page your friends see."}
            </Text>
          </View>
        </View>

        {/* DIRECT PRICING PACKAGES */}
        {loading ? (
          <View style={styles.packagesLoader}>
            <ActivityIndicator size="large" color={C.accent} />
            <Text style={[styles.packagesLoaderText, { color: C.muted }]}>
              {tr ? "Mağaza fiyatları alınıyor…" : "Loading store prices…"}
            </Text>
          </View>
        ) : selectedTierPackages.length > 0 ? (
          <View style={styles.packagesContainer}>
            {selectedTierPackages.map((aPackage) => {
              const isSelected = aPackage.identifier === selectedPackage?.identifier;
              const isAnnual = getPackagePeriodKey(aPackage) === "annual";
              const savings = getPackageSavings(aPackage, pricedPackages, language);
              const monthlyEquivalent = getPackageMonthlyEquivalent(aPackage, language);
              const cardBorderColor = isSelected
                ? isAnnual
                  ? "#F59E0B"
                  : C.accent
                : isAnnual
                ? alpha("#F59E0B", 0.45)
                : C.border;

              return (
                <Pressable
                  key={aPackage.identifier}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => handleSelectPackage(aPackage.identifier)}
                  style={[
                    styles.pricingCard,
                    {
                      backgroundColor: C.card,
                      borderColor: cardBorderColor,
                    },
                    isSelected && styles.pricingCardSelected,
                    isSelected && {
                      shadowColor: isAnnual ? "#F59E0B" : C.accent,
                      shadowOpacity: 0.3,
                      shadowRadius: 12,
                      shadowOffset: { width: 0, height: 6 },
                      elevation: 6,
                    },
                  ]}
                >
                  {isSelected && (
                    <LinearGradient
                      pointerEvents="none"
                      colors={[
                        alpha(isAnnual ? "#F59E0B" : C.accent, 0.16),
                        "transparent",
                      ]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[StyleSheet.absoluteFill, { borderRadius: 19 }]}
                    />
                  )}

                  <View style={styles.pricingCardHeader}>
                    {isAnnual ? (
                      <View style={[styles.popularBadge, { backgroundColor: "#F59E0B" }]}>
                        <AppIcon name="flame" size={11} color="#fff" />
                        <Text style={styles.popularBadgeText}>
                          {tr ? "EN AVANTAJLI" : "BEST VALUE"}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.flexibleBadge, { backgroundColor: C.cardAlt }]}>
                        <Text style={[styles.flexibleBadgeText, { color: C.muted }]}>
                          {tr ? "ESNEK DÖNEM" : "FLEXIBLE"}
                        </Text>
                      </View>
                    )}

                    <View
                      style={[
                        styles.pricingRadio,
                        {
                          borderColor: isSelected
                            ? isAnnual
                              ? "#F59E0B"
                              : C.accent
                            : C.muted,
                          backgroundColor: isSelected
                            ? isAnnual
                              ? "#F59E0B"
                              : C.accent
                            : "transparent",
                        },
                      ]}
                    >
                      {isSelected && <AppIcon name="checkmark" size={12} color="#fff" />}
                    </View>
                  </View>

                  <View style={styles.pricingContentRow}>
                    <View style={styles.pricingTitleWrap}>
                      <Text style={[styles.pricingPeriodTitle, { color: C.text }]}>
                        {packageTitle(aPackage, tr)}
                      </Text>
                      <Text style={[styles.pricingPeriodSub, { color: C.muted }]}>
                        {isAnnual
                          ? tr ? "Yıllık tek faturalandırma" : "Billed annually"
                          : tr ? "Aylık yenilenir, dilediğinde iptal" : "Renews monthly, cancel anytime"}
                      </Text>
                    </View>

                    <View style={styles.pricingNumbersWrap}>
                      {savings && (
                        <View style={[styles.savingsPill, { backgroundColor: C.iconGreen }]}>
                          <Text style={[styles.savingsText, { color: C.green }]}>
                            {tr ? `%${savings.percent} TASARRUF` : `SAVE ${savings.percent}%`}
                          </Text>
                        </View>
                      )}
                      <View style={styles.priceRow}>
                        <Text fontRole="numeric" style={[styles.priceString, { color: C.text }]}>
                          {aPackage.product?.priceString}
                        </Text>
                        <Text style={[styles.pricePeriod, { color: C.muted }]}>
                          {packagePeriodLabel(aPackage, tr)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {isAnnual && monthlyEquivalent && (
                    <View style={[styles.monthlyEquivalentCallout, { backgroundColor: alpha(C.accent, 0.08), borderColor: alpha(C.accent, 0.16) }]}>
                      <AppIcon name="calculator-outline" size={13} color={C.accent} />
                      <Text style={[styles.monthlyEquivalentText, { color: C.text }]}>
                        {tr ? "Sadece " : "Only "}
                        <Text style={{ color: C.accent, fontWeight: "900" }}>
                          {monthlyEquivalent}
                        </Text>
                        {tr ? " / aya denk gelir" : " / month equivalent"}
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={[styles.noticeBox, { backgroundColor: C.card, borderColor: C.border }]}>
            <AppIcon family="Ionicons" name="construct-outline" size={20} color={C.amber} />
            <Text style={[styles.noticeText, { color: C.muted }]}>
              {configurationError === "missing-api-key"
                ? tr
                  ? "RevenueCat API anahtarı bekleniyor."
                  : "RevenueCat API key is missing."
                : tr
                ? `${selectedPlanName} mağaza paketleri henüz hazır değil.`
                : `${selectedPlanName} packages not loaded yet.`}
            </Text>
          </View>
        )}

        {/* PRIMARY CTA BUTTON */}
        <Pressable
          disabled={(selectedTier !== plan && !selectedPackage) || busy}
          onPress={selectedTier === plan ? manage : buy}
          style={({ pressed }) => [
            styles.ctaButton,
            {
              opacity: (selectedTier !== plan && !selectedPackage) || busy ? 0.45 : pressed ? 0.85 : 1,
            },
          ]}
        >
          <LinearGradient
            colors={[C.accent, C.purple || C.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaGradient}
          >
            <Animated.View
              pointerEvents="none"
              style={[
                styles.ctaShimmerBar,
                {
                  transform: [
                    {
                      translateX: ctaShimmer.interpolate({
                        inputRange: [0, 1],
                        outputRange: [-250, 420],
                      }),
                    },
                    { rotate: "-20deg" },
                  ],
                },
              ]}
            >
              <LinearGradient
                colors={[
                  "transparent",
                  "rgba(255,255,255,0.06)",
                  "rgba(255,255,255,0.38)",
                  "rgba(255,255,255,0.06)",
                  "transparent",
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>

            {busyAction === "purchase" || busyAction === "customer-center" ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <View style={styles.ctaIconContainer}>
                  <AppIcon
                    name={selectedTier === PREMIUM_PLAN.UNLIMITED ? "infinite" : "diamond"}
                    size={18}
                    color="#fff"
                  />
                </View>
                <View style={styles.ctaTextContainer}>
                  <Text style={styles.ctaMainText}>
                    {selectedTier === plan
                      ? tr ? "Aboneliği Yönet" : "Manage Subscription"
                      : isPremium
                      ? tr ? `${selectedPlanName}'e Yükselt` : `Upgrade to ${selectedPlanName}`
                      : tr ? "Hemen Başla" : "Get Started Now"}
                  </Text>
                  {selectedTier !== plan && selectedDisplayPackage && (
                    <Text style={styles.ctaSubText}>
                      {selectedDisplayPackage.product?.priceString}{" "}
                      {packagePeriodLabel(selectedDisplayPackage, tr)}
                      {tr ? " · İstediğin an iptal et" : " · Cancel anytime"}
                    </Text>
                  )}
                </View>
                <AppIcon name="arrow-forward" size={19} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* TRUST BADGES ROW */}
        <View style={styles.trustBadgesRow}>
          <View style={styles.trustBadgeItem}>
            <AppIcon name="shield-checkmark" size={13} color={C.green} />
            <Text style={[styles.trustBadgeText, { color: C.muted }]}>
              {tr ? "Güvenli Ödeme" : "Secure Payment"}
            </Text>
          </View>
          <View style={styles.trustBadgeItem}>
            <AppIcon name="flash" size={13} color={C.accent} />
            <Text style={[styles.trustBadgeText, { color: C.muted }]}>
              {tr ? "Anında Aktivasyon" : "Instant Access"}
            </Text>
          </View>
          <View style={styles.trustBadgeItem}>
            <AppIcon name="sync" size={13} color={C.purple} />
            <Text style={[styles.trustBadgeText, { color: C.muted }]}>
              {tr ? "Kolay İptal" : "Easy Cancel"}
            </Text>
          </View>
        </View>
      </View>

      {/* 2X2 MODERN VALUE PROPOSITIONS GRID */}
      <View style={styles.featuresSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionBadgePill, { backgroundColor: alpha(C.accent, 0.14) }]}>
              <AppIcon name="sparkles" size={11} color={C.accent} />
              <Text style={[styles.sectionBadgeText, { color: C.accent }]}>
                {tr ? "AYRICALIKLAR" : "HIGHLIGHTS"}
              </Text>
            </View>
          </View>
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            {tr ? "Neler Kazanacaksın?" : "What You Will Get"}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: C.muted }]}>
            {tr
              ? "Seelogd Premium ile film ve dizi dünyanı bir üst seviyeye taşı."
              : "Elevate your cinema journey with Seelogd Premium privileges."}
          </Text>
        </View>

        <View style={styles.valueProps2x2Grid}>
          {highlights.map((prop) => (
            <View
              key={prop.id}
              style={[
                styles.valueProp2x2Card,
                { backgroundColor: C.card, borderColor: alpha(prop.color, 0.28) },
              ]}
            >
              <LinearGradient
                colors={[alpha(prop.color, 0.12), "transparent"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0.9 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.valueProp2x2Top}>
                <View style={[styles.valuePropIconWrap2x2, { backgroundColor: alpha(prop.color, 0.18) }]}>
                  <AppIcon name={prop.icon} size={18} color={prop.color} />
                </View>
                <View style={[styles.valuePropBadgeTag, { backgroundColor: alpha(prop.color, 0.16) }]}>
                  <Text style={[styles.valuePropBadgeTagText, { color: prop.color }]}>
                    {prop.badge}
                  </Text>
                </View>
              </View>

              <Text style={[styles.valuePropTitle2x2, { color: C.text }]}>
                {prop.title}
              </Text>
              <Text style={[styles.valuePropTagline2x2, { color: prop.color }]}>
                {prop.tagline}
              </Text>
              <Text style={[styles.valuePropDesc2x2, { color: C.muted }]}>
                {prop.desc}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* EXPANDABLE CATEGORY BREAKDOWN */}
      <View style={styles.detailedSection}>
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setShowDetailedSection(!showDetailedSection);
          }}
          style={({ pressed }) => [
            styles.accordionToggle,
            {
              backgroundColor: C.card,
              borderColor: showDetailedSection ? alpha(C.accent, 0.42) : C.border,
              opacity: pressed ? 0.88 : 1,
            },
          ]}
        >
          {showDetailedSection && (
            <LinearGradient
              colors={[alpha(C.accent, 0.12), "transparent"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
              pointerEvents="none"
            />
          )}

          <View
            style={[
              styles.accordionToggleLeadingIcon,
              {
                backgroundColor: showDetailedSection
                  ? alpha(C.accent, 0.22)
                  : alpha(C.accent, 0.12),
              },
            ]}
          >
            <AppIcon
              name="layers-outline"
              size={20}
              color={C.accent}
            />
          </View>

          <View style={styles.accordionToggleCopy}>
            <View style={styles.accordionBadgeRow}>
              <View style={[styles.accordionSmallBadge, { backgroundColor: alpha(C.accent, 0.14) }]}>
                <View style={[styles.accordionDot, { backgroundColor: C.accent }]} />
                <Text style={[styles.accordionSmallBadgeText, { color: C.accent }]}>
                  {tr ? "PLAN KARŞILAŞTIRMA" : "PLAN COMPARISON"}
                </Text>
              </View>
              <Text style={[styles.accordionFeatureCount, { color: C.muted }]}>
                {tr
                  ? `${comparisonSections.length} Kategori · ${comparisonRowCount} Özellik`
                  : `${comparisonSections.length} Categories · ${comparisonRowCount} Features`}
              </Text>
            </View>

            <Text style={[styles.accordionToggleTitle, { color: C.text }]}>
              {tr ? "Planları Karşılaştır" : "Compare Plans"}
            </Text>
            <Text style={[styles.accordionToggleSub, { color: C.muted }]}>
              {tr
                ? "Free, Premium ve Premium Max'te her özelliğin sınırı"
                : "Every feature's limit on Free, Premium and Premium Max"}
            </Text>
          </View>

          <View
            style={[
              styles.accordionToggleIcon,
              {
                backgroundColor: showDetailedSection ? C.accent : C.cardAlt,
              },
            ]}
          >
            <AppIcon
              name={showDetailedSection ? "chevron-up" : "chevron-down"}
              size={16}
              color={showDetailedSection ? "#fff" : C.accent}
            />
          </View>
        </Pressable>

        {showDetailedSection && (
          <View style={styles.categorySectionWrap}>
            {/* Kategori hapları — utils/premiumFeatures.js FEATURE_CATEGORIES */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryFilterRow}
            >
              {[
                { id: "all", title: tr ? "✦ Tümü" : "✦ All", icon: "sparkles", color: "#6366F1" },
                ...comparisonSections,
              ].map((cat) => {
                const isCatActive = categoryFilter === cat.id;
                const activeColor = cat.color || C.accent;
                return (
                  <Pressable
                    key={cat.id}
                    onPress={() => {
                      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                      setCategoryFilter(cat.id);
                    }}
                    style={[
                      styles.categoryFilterPill,
                      {
                        backgroundColor: isCatActive ? activeColor : C.card,
                        borderColor: isCatActive ? activeColor : C.border,
                      },
                    ]}
                  >
                    <AppIcon
                      name={cat.icon}
                      size={13}
                      color={isCatActive ? "#fff" : activeColor}
                    />
                    <Text
                      style={[
                        styles.categoryFilterPillText,
                        { color: isCatActive ? "#fff" : C.text },
                      ]}
                    >
                      {cat.title}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Kategori kartları: her özellik için Free / Premium / Max */}
            <View style={styles.categoryCardsList}>
              {comparisonSections
                .filter((section) => categoryFilter === "all" || section.id === categoryFilter)
                .map((section) => (
                  <View
                    key={section.id}
                    style={[
                      styles.detailedCard,
                      { backgroundColor: C.card, borderColor: alpha(section.color, 0.3) },
                    ]}
                  >
                    <LinearGradient
                      colors={[alpha(section.color, 0.12), "transparent"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0.8, y: 0.8 }}
                      style={StyleSheet.absoluteFill}
                      pointerEvents="none"
                    />
                    <View style={styles.detailedCardHeader}>
                      <View
                        style={[
                          styles.detailedCardIconWrap,
                          { backgroundColor: alpha(section.color, 0.9) },
                        ]}
                      >
                        <AppIcon name={section.icon} size={20} color="#fff" />
                      </View>
                      <View style={styles.detailedCardCopy}>
                        <Text style={[styles.detailedCardTitle, { color: C.text }]}>
                          {section.title}
                        </Text>
                      </View>
                    </View>

                    <View
                      style={[
                        styles.detailedCardBody,
                        {
                          borderTopColor: alpha(section.color, 0.16),
                          backgroundColor: alpha(C.cardAlt, 0.38),
                        },
                      ]}
                    >
                      {section.rows.map((row) => {
                        const highlighted = row.id === source;
                        return (
                          <View
                            key={row.id}
                            style={[
                              styles.compareRow,
                              {
                                backgroundColor: alpha(C.card, 0.88),
                                borderColor: highlighted
                                  ? C.accent
                                  : alpha(section.color, 0.14),
                              },
                            ]}
                          >
                            <View style={styles.compareRowHead}>
                              <AppIcon name={row.icon} size={14} color={section.color} />
                              <Text style={[styles.compareRowTitle, { color: C.text }]}>
                                {row.title}
                              </Text>
                            </View>
                            {row.detail ? (
                              <Text style={[styles.compareRowDetail, { color: C.muted }]}>
                                {row.detail}
                              </Text>
                            ) : null}
                            <View style={styles.compareValues}>
                              {PLANS.map((planId) => {
                                const isSelectedPlan = planId === selectedTier;
                                return (
                                  <View
                                    key={planId}
                                    style={[
                                      styles.compareCell,
                                      {
                                        backgroundColor: isSelectedPlan
                                          ? alpha(C.accent, 0.16)
                                          : C.cardAlt,
                                        borderColor: isSelectedPlan
                                          ? alpha(C.accent, 0.5)
                                          : "transparent",
                                      },
                                    ]}
                                  >
                                    <Text
                                      numberOfLines={1}
                                      style={[styles.compareCellPlan, { color: C.muted }]}
                                    >
                                      {getPremiumPlanDisplayName(planId)}
                                    </Text>
                                    <Text
                                      numberOfLines={2}
                                      style={[
                                        styles.compareCellValue,
                                        { color: isSelectedPlan ? C.accent : C.text },
                                      ]}
                                    >
                                      {row.values[planId]}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                            {row.note ? (
                              <Text style={[styles.compareRowNote, { color: C.muted }]}>
                                {row.note}
                              </Text>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ))}
            </View>
          </View>
        )}
      </View>

      {/* SECONDARY ACTIONS */}
      <View style={styles.secondaryActions}>
        <Pressable disabled={busy} onPress={restore} style={styles.restoreBtn}>
          {busyAction === "restore" ? (
            <ActivityIndicator size="small" color={C.accent} />
          ) : (
            <Text style={[styles.restoreBtnText, { color: C.accent }]}>
              {tr ? "Önceki Satın Alımları Geri Yükle" : "Restore Previous Purchases"}
            </Text>
          )}
        </Pressable>
      </View>

      {/* LEGAL FOOTER */}
      <View style={styles.legalSection}>
        <Text style={[styles.legalDisclaimer, { color: C.muted }]}>
          {tr
            ? "Satın alma tutarı uygulama mağazası hesabınızdan tahsil edilir. Abonelik, geçerli dönemin bitiminden en az 24 saat önce iptal edilmediği sürece otomatik olarak yenilenir. İstediğiniz zaman mağaza hesap ayarlarınızdan iptal edebilir veya yönetebilirsiniz."
            : "Payment will be charged to your store account. The subscription automatically renews unless canceled at least 24 hours before the end of the current period. You can manage or cancel anytime in your store account settings."}
        </Text>

        <View style={styles.legalLinksRow}>
          <Pressable onPress={() => openLegalPage("terms", tr ? "tr" : "en")} hitSlop={8}>
            <Text style={[styles.legalLink, { color: C.accent }]}>
              {i18nText("autoI18n.kullanim_kosullari", "Kullanım Koşulları")}
            </Text>
          </Pressable>
          <Text style={[styles.legalBullet, { color: C.muted }]}>•</Text>
          <Pressable onPress={() => openLegalPage("privacy", tr ? "tr" : "en")} hitSlop={8}>
            <Text style={[styles.legalLink, { color: C.accent }]}>
              {i18nText("autoI18n.gizlilik_politikasi", "Gizlilik Politikası")}
            </Text>
          </Pressable>
        </View>
      </View>
    </SettingsSubScreen>
  );
}

const styles = StyleSheet.create({
  testBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 5,
    marginBottom: 12,
  },
  testBadgeText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  heroGradient: {
    padding: 18,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroBrandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  heroBrandDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#fff",
  },
  heroBrandText: {
    color: "#fff",
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  heroStatusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  heroStatusText: {
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  heroBody: {
    marginTop: 14,
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 11.5,
    lineHeight: 17,
    marginTop: 6,
    fontWeight: "500",
  },
  quickMetricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  quickMetricBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  quickMetricNum: {
    fontSize: 11.5,
    fontWeight: "900",
  },
  quickMetricLabel: {
    fontSize: 7.5,
    fontWeight: "600",
    marginTop: 1,
  },
  pricingSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    marginBottom: 5,
  },
  sectionBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  sectionBadgeText: {
    fontSize: 8.5,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: -0.4,
  },
  sectionSubtitle: {
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2,
    fontWeight: "500",
  },
  tierSegmentWrap: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    gap: 4,
    marginBottom: 12,
  },
  tierSegmentTab: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  tierSegmentTabActive: {
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tierTabContent: {
    alignItems: "center",
    gap: 2,
  },
  tierTabTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  tierTabTitle: {
    fontSize: 13,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  tierTabMiniBadge: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
  },
  tierTabMiniBadgeText: {
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  tierTabSub: {
    fontSize: 9,
    fontWeight: "600",
  },
  badgePreviewCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    marginBottom: 14,
  },
  badgePreviewLeft: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgePreviewRight: {
    flex: 1,
  },
  badgePreviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  badgePreviewTitle: {
    fontSize: 13.5,
    fontWeight: "900",
  },
  badgeRarityTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeRarityText: {
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  badgePreviewDesc: {
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: 3,
    fontWeight: "500",
  },
  packagesLoader: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  packagesLoaderText: {
    fontSize: 11,
    fontWeight: "600",
  },
  packagesContainer: {
    gap: 10,
  },
  pricingCard: {
    borderRadius: 20,
    borderWidth: 1.5,
    padding: 14,
    overflow: "hidden",
  },
  pricingCardSelected: {
    borderWidth: 2,
  },
  pricingCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  popularBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  popularBadgeText: {
    color: "#fff",
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  flexibleBadge: {
    borderRadius: 7,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  flexibleBadgeText: {
    fontSize: 8,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  pricingRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pricingContentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pricingTitleWrap: {
    flex: 1,
  },
  pricingPeriodTitle: {
    fontSize: 15,
    fontWeight: "900",
  },
  pricingPeriodSub: {
    fontSize: 9.5,
    marginTop: 2,
    fontWeight: "500",
  },
  pricingNumbersWrap: {
    alignItems: "flex-end",
    gap: 3,
  },
  savingsPill: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  savingsText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 3,
  },
  priceString: {
    fontSize: 18,
    fontWeight: "900",
  },
  pricePeriod: {
    fontSize: 10,
    fontWeight: "700",
  },
  monthlyEquivalentCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 10,
  },
  monthlyEquivalentText: {
    fontSize: 10,
    fontWeight: "600",
  },
  noticeBox: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  noticeText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
  },
  ctaButton: {
    borderRadius: 18,
    overflow: "hidden",
    marginTop: 16,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  ctaGradient: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  ctaShimmerBar: {
    position: "absolute",
    top: -40,
    bottom: -40,
    width: 140,
  },
  ctaIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaTextContainer: {
    flex: 1,
  },
  ctaMainText: {
    color: "#fff",
    fontSize: 14.5,
    fontWeight: "900",
  },
  ctaSubText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 9,
    fontWeight: "600",
    marginTop: 1,
  },
  trustBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 14,
    paddingHorizontal: 4,
  },
  trustBadgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  trustBadgeText: {
    fontSize: 9.5,
    fontWeight: "600",
  },
  featuresSection: {
    marginBottom: 24,
  },
  valueProps2x2Grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  valueProp2x2Card: {
    width: "48.4%",
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    overflow: "hidden",
  },
  valueProp2x2Top: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  valuePropIconWrap2x2: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  valuePropBadgeTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  valuePropBadgeTagText: {
    fontSize: 7.5,
    fontWeight: "900",
    letterSpacing: 0.5,
  },
  valuePropTitle2x2: {
    fontSize: 13.5,
    fontWeight: "900",
    letterSpacing: -0.2,
  },
  valuePropTagline2x2: {
    fontSize: 9.5,
    fontWeight: "700",
    marginTop: 2,
  },
  valuePropDesc2x2: {
    fontSize: 9.5,
    lineHeight: 14,
    marginTop: 4,
    fontWeight: "500",
  },
  detailedSection: {
    marginBottom: 24,
  },
  accordionToggle: {
    borderRadius: 18,
    borderWidth: 1.2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    overflow: "hidden",
    position: "relative",
  },
  accordionToggleLeadingIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  accordionToggleCopy: {
    flex: 1,
  },
  accordionBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  accordionSmallBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  accordionDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  accordionSmallBadgeText: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  accordionFeatureCount: {
    fontSize: 9,
    fontWeight: "600",
  },
  accordionToggleTitle: {
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  accordionToggleSub: {
    fontSize: 10,
    marginTop: 2,
    lineHeight: 14,
    fontWeight: "500",
  },
  accordionToggleIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  categorySectionWrap: {
    marginTop: 12,
  },
  categoryFilterRow: {
    gap: 8,
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  categoryFilterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    borderWidth: 1.2,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  categoryFilterPillText: {
    fontSize: 11,
    fontWeight: "700",
  },
  categoryCardsList: {
    gap: 12,
    marginTop: 12,
  },
  detailedCard: {
    borderRadius: 18,
    borderWidth: 1.2,
    overflow: "hidden",
    position: "relative",
  },
  detailedCardHeader: {
    padding: 14,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailedCardIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  detailedCardCopy: {
    flex: 1,
  },
  detailedCardTagRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  detailedCategoryTag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2.5,
  },
  detailedCategoryTagText: {
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  detailedPerkBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  detailedPerkBadgeText: {
    fontSize: 8.5,
    fontWeight: "600",
  },
  detailedCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  detailedCardSummary: {
    fontSize: 10.5,
    marginTop: 3,
    lineHeight: 15,
    fontWeight: "500",
  },
  detailedCardBody: {
    borderTopWidth: 1,
    padding: 12,
    gap: 8,
  },
  detailedBulletItem: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 9,
  },
  detailedBulletIconBadge: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
  detailedBulletText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },
  sourceBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
  },
  sourceBannerIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  sourceBannerTitle: {
    fontSize: 13,
    fontWeight: "900",
  },
  sourceBannerValues: {
    fontSize: 10.5,
    fontWeight: "600",
    marginTop: 2,
    lineHeight: 15,
  },
  compareRow: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 6,
  },
  compareRowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  compareRowTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  compareRowDetail: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "500",
  },
  compareValues: {
    flexDirection: "row",
    gap: 6,
  },
  compareCell: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 6,
  },
  compareCellPlan: {
    fontSize: 8.5,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  compareCellValue: {
    fontSize: 10.5,
    fontWeight: "800",
    marginTop: 2,
  },
  compareRowNote: {
    fontSize: 9.5,
    lineHeight: 13,
    fontStyle: "italic",
  },
  detailedCardFooter: {
    borderTopWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  detailedCardFooterText: {
    fontSize: 10,
    fontWeight: "500",
  },
  secondaryActions: {
    gap: 8,
    marginBottom: 20,
  },
  restoreBtn: {
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  restoreBtnText: {
    fontSize: 11.5,
    fontWeight: "700",
  },
  legalSection: {
    paddingHorizontal: 8,
    paddingBottom: 24,
    alignItems: "center",
    gap: 10,
  },
  legalDisclaimer: {
    fontSize: 9,
    lineHeight: 14,
    textAlign: "center",
  },
  legalLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legalLink: {
    fontSize: 10.5,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  legalBullet: {
    fontSize: 9,
  },
});
