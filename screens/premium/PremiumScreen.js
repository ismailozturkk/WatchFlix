import { normalizeAppLanguage } from "../../utils/appLanguages";
import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LensLoader from "../../components/LensLoader";
import { LinearGradient } from "expo-linear-gradient";
import Toast from "@components/AppToast";
import AppIcon from "../../components/AppIcon";
import { useLanguage } from "../../context/LanguageContext";
import { usePremium } from "../../context/PremiumContext";
import { useTheme } from "../../context/ThemeContext";
import { alpha } from "../../theme/colors";
import {
  getPackagesForTier,
  getPackageDisplayProduct,
  getPackageIntroOffer,
  getPackageMonthlyEquivalent,
  getPackagePeriodKey,
  getPackageReferralOffer,
  getPackageRegularPrice,
  getPackageSavings,
  getPackageTierKey,
  getPremiumPlan,
  getPremiumPlanDisplayName,
  pickBetterOffer,
  AI_PLAN_LIMITS,
  PREMIUM_PLAN,
  selectPreferredPackage,
} from "../../utils/premium";
import { SettingsSubScreen, buildUiColors } from "../tabs/settings/settingsUi";
import { i18nText } from "../../utils/i18nText";
import { openLegalPage } from "../../utils/legalLinks";
import { useRoute } from "@react-navigation/native";
import {
  PLANS,
  formatFeatureValue,
  getComparisonSections,
  getFeature,
  isLockedFor,
} from "../../utils/premiumFeatures";
import { ANALYTICS_EVENTS, trackEvent } from "../../services/analytics";
import RedeemCodeSheet, { formatRedeemDate } from "../../components/premium/RedeemCodeSheet";
import { appAlert } from "../../components/AppAlert";
import { REFERRAL_OFFER_UNAVAILABLE } from "../../services/revenueCatService";
import useReferralOverview from "../../hooks/useReferralOverview";
import { getReferralCopy } from "../../utils/referralCopy";
import GlassPressable from "../../components/common/GlassPressable";
import GlassBox from "../../components/common/GlassBox";
import { GLASS_PRESS_ROOM } from "../../utils/liquidGlass";

// Mağazada tanımlı giriş teklifinin (lansman indirimi) vurgusu.
const OFFER_COLOR = "#EC4899";

function packageTitle(aPackage, language) {
  const tr = language === "tr";
  const es = language === "es";
  const pt = language === "pt";
  const de = language === "de";
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "Yıllık Plan" : es ? "Plan anual" : pt ? "Plano anual" : de ? "Jahresplan" : "Annual Plan";
  if (key === "monthly") return tr ? "Aylık Plan" : es ? "Plan mensual" : pt ? "Plano mensal" : de ? "Monatsplan" : "Monthly Plan";
  if (key === "weekly") return tr ? "Haftalık Plan" : es ? "Plan semanal" : pt ? "Plano semanal" : de ? "Wochenplan" : "Weekly Plan";
  if (key === "lifetime") return tr ? "Ömür Boyu" : es ? "De por vida" : pt ? "Vitalício" : de ? "Lebenslang" : "Lifetime";
  return aPackage?.product?.title || aPackage?.identifier || "Plan";
}

function packagePeriodLabel(aPackage, language) {
  const tr = language === "tr";
  const es = language === "es";
  const pt = language === "pt";
  const de = language === "de";
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "/ yıl" : es ? "/ año" : pt ? "/ ano" : de ? "/ year" : "/ year";
  if (key === "monthly") return tr ? "/ ay" : es ? "/ mes" : pt ? "/ mês" : de ? "/ month" : "/ month";
  if (key === "weekly") return tr ? "/ hafta" : es ? "/ semana" : pt ? "/ semana" : de ? "/ week" : "/ week";
  return "";
}

function packageRenewalNote(aPackage, language) {
  const tr = language === "tr";
  const es = language === "es";
  const pt = language === "pt";
  const de = language === "de";
  const key = getPackagePeriodKey(aPackage);
  if (key === "annual") return tr ? "Yıllık tek faturalandırma" : es ? "Facturación anual única" : pt ? "Cobrança anual única" : de ? "Jährliche Abrechnung" : "Billed annually";
  if (key === "monthly") {
    return tr ? "Aylık yenilenir, dilediğinde iptal" : es ? "Se renueva cada mes; cancela cuando quieras" : pt ? "Renova todo mês; cancele quando quiser" : de ? "Verlängert sich monatlich, jederzeit kündbar" : "Renews monthly, cancel anytime";
  }
  return tr ? "Dilediğinde iptal" : es ? "Cancela cuando quieras" : pt ? "Cancele quando quiser" : de ? "Jederzeit kündbar" : "Cancel anytime";
}

// Giriş teklifinin süresi: "İlk 3 ay", "İlk yıl" (faz birimi × tekrar sayısı).
const DE_FIRST = { day: "Erster", week: "Erste", month: "Erster", year: "Erstes" };
function offerDurationLabel(offer, language) {
  const tr = language === "tr";
  const es = language === "es";
  const pt = language === "pt";
  const de = language === "de";
  const count = (offer.cycles || 1) * (offer.unitCount || 1);
  const one = count === 1;
  const units = {
    day: tr ? "gün" : es ? (one ? "día" : "días") : pt ? one ? "dia" : "dias" : de ? (one ? "Tag" : "Tage") : one ? "day" : "days",
    week: tr ? "hafta" : es ? (one ? "semana" : "semanas") : pt ? one ? "semana" : "semanas" : de ? (one ? "Woche" : "Wochen") : one ? "week" : "weeks",
    month: tr ? "ay" : es ? (one ? "mes" : "meses") : pt ? one ? "mês" : "meses" : de ? (one ? "Monat" : "Monate") : one ? "month" : "months",
    year: tr ? "yıl" : es ? (one ? "año" : "años") : pt ? one ? "ano" : "anos" : de ? (one ? "Jahr" : "Jahre") : one ? "year" : "years",
  };
  const unit = units[offer.unit];
  if (!unit) return tr ? "İlk dönem" : es ? "Periodo inicial" : pt ? "Período inicial" : de ? "Einführungszeitraum" : "Intro period";
  if (one) return tr ? `İlk ${unit}` : es ? `${unit} inicial` : pt ? `${unit} inicial` : de ? `${DE_FIRST[offer.unit]} ${unit}` : `First ${unit}`;
  return tr ? `İlk ${count} ${unit}` : es ? `${count} ${unit} iniciales` : pt ? `${count} ${unit} iniciais` : de ? `Erste ${count} ${unit}` : `First ${count} ${unit}`;
}

// Teklif fazının fatura aralığı ("/ ay"); faz birden uzun birimse boş.
function offerPeriodLabel(offer, language) {
  const tr = language === "tr";
  const es = language === "es";
  const pt = language === "pt";
  const de = language === "de";
  if ((offer.unitCount || 1) !== 1) return "";
  if (offer.unit === "year") return tr ? "/ yıl" : es ? "/ año" : pt ? "/ ano" : de ? "/ year" : "/ year";
  if (offer.unit === "month") return tr ? "/ ay" : es ? "/ mes" : pt ? "/ mês" : de ? "/ month" : "/ month";
  if (offer.unit === "week") return tr ? "/ hafta" : es ? "/ semana" : pt ? "/ semana" : de ? "/ week" : "/ week";
  return "";
}

// Mağaza kuralı: teklif fiyatının yanında sonrasında ödenecek tutar açıkça
// yazmalı. "İlk 3 ay ₺29,99/ay, sonra ₺59,99/ay".
function offerDisclosure(offer, aPackage, language) {
  const tr = language === "tr";
  const es = language === "es";
  const pt = language === "pt";
  const de = language === "de";
  const duration = offerDurationLabel(offer, language);
  const after = `${offer.regularPriceString}${packagePeriodLabel(aPackage, language).replace(" ", "")}`;
  if (offer.free) {
    return tr ? `${duration} ücretsiz, sonra ${after}` : es ? `${duration} gratis, después ${after}` : pt ? `${duration} grátis, depois ${after}` : de ? `${duration} kostenlos, danach ${after}` : `${duration} free, then ${after}`;
  }
  const intro = `${offer.priceString}${offerPeriodLabel(offer, language).replace(" ", "")}`;
  return tr ? `${duration} ${intro}, sonra ${after}` : es ? `${duration} ${intro}, después ${after}` : pt ? `${duration} ${intro}, depois ${after}` : de ? `${duration} ${intro}, danach ${after}` : `${duration} ${intro}, then ${after}`;
}

export default function PremiumScreen() {
  const { language } = useLanguage();
  const { theme } = useTheme();
  const C = buildUiColors(theme);
  const tr = language === "tr";
  const es = normalizeAppLanguage(language) === "es";
  const pt = normalizeAppLanguage(language) === "pt";
  const de = normalizeAppLanguage(language) === "de";
  const localized = normalizeAppLanguage(language);

  const {
    isPremium,
    isUnlimited,
    plan,
    packages,
    introEligibleIds,
    loading,
    busyAction,
    configurationError,
    entitlementId,
    usingTestStore,
    purchasePackage,
    refresh,
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

  // Arkadaş daveti: "Kodun var mı?" sayfası + davetle geldiysem ilk dönem indirimi.
  const referralCopy = getReferralCopy(language);
  const { data: referralData, reload: reloadReferral } = useReferralOverview();
  const [redeemOpen, setRedeemOpen] = useState(false);

  const [selectedTier, setSelectedTier] = useState(PREMIUM_PLAN.PREMIUM);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllBenefits, setShowAllBenefits] = useState(false);
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

  const selectedPackage =
    packages.find((item) => item.identifier === selectedId) || null;
  const selectedDisplayPackage =
    pricedPackages.find((item) => item.identifier === selectedId) || null;
  const selectedTierPackages = getPackagesForTier(pricedPackages, selectedTier);
  // Paketin ilk dönem teklifi: lansman indirimi, davetle geldiysem davet indirimi — hangisi
  // daha çok kazandırıyorsa (mağaza tek teklif uygular). Davet teklifi mağazada tanımlı değilse
  // hiç gösterilmez; `handle` satın almanın o teklifle yapılmasını sağlar.
  const referralDiscount = referralData?.invitedBy?.discount || null;
  const offerChoiceFor = (aPackage) => {
    const intro = getPackageIntroOffer(aPackage, {
      iosIntroEligible: (introEligibleIds || []).includes(aPackage?.product?.identifier),
    });
    const referral = referralDiscount
      ? getPackageReferralOffer(aPackage, referralData.limits.offerId, { platform: Platform.OS })
      : null;
    const pick = pickBetterOffer(intro, referral?.offer || null);
    return { offer: pick.offer, handle: pick.useReferral ? referral.handle : null };
  };
  const introOfferFor = (aPackage) => offerChoiceFor(aPackage).offer;
  const selectedOffer = selectedDisplayPackage ? introOfferFor(selectedDisplayPackage) : null;
  const busy = Boolean(busyAction);
  const selectedPlanName = getPremiumPlanDisplayName(selectedTier);
  // Tek kaynak premiumFeatures kaydıdır: seçili planda gerçekten açık olan her
  // özellik otomatik listelenir; Max'e özel ve Premium'da kapalı maddeler Premium
  // görünümüne sızmaz. Yeni bir kayıt eklendiğinde bu bölüm de kendiliğinden büyür.
  const selectedBenefits = useMemo(
    () =>
      comparisonSections.flatMap((section) =>
        section.rows
          .filter((row) => !isLockedFor(row.id, selectedTier))
          .map((row) => ({
            ...row,
            categoryTitle: section.title,
            color: section.color,
            value: row.values[selectedTier],
          })),
      ),
    [comparisonSections, selectedTier],
  );
  const visibleBenefits = showAllBenefits
    ? selectedBenefits
    : selectedBenefits.slice(0, 6);

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

  const purchase = async (aPackage, referralHandle) => {
    try {
      const result = await purchasePackage(aPackage, { referralHandle });
      // Kutlama yalnız hak GERÇEKTEN açıldıysa: ödeme alınıp hak açılmadıysa
      // (bekleyen ödeme, panelde entitlement eşleşmesi bozuk) "aktif" denmez.
      const purchasedPlan = getPremiumPlan(result?.customerInfo, entitlementId);
      if (purchasedPlan === PREMIUM_PLAN.FREE) {
        refresh?.().catch?.(() => {});
        Toast.show({
          type: "info",
          text1: tr ? "Ödemen alındı" : es ? "Hemos recibido tu pago" : pt ? "Recebemos seu pagamento" : de ? "Deine Zahlung ist eingegangen" : "Your payment was received",
          text2: tr ? "Ayrıcalıkların açılması birkaç dakika sürebilir." : es ? "Tus ventajas pueden tardar unos minutos en activarse." : pt ? "Seus benefícios podem levar alguns minutos para serem ativados." : de ? "Es kann ein paar Minuten dauern, bis deine Vorteile aktiv sind." : "It may take a few minutes for your benefits to activate.",
        });
        return;
      }
      const planName = getPremiumPlanDisplayName(purchasedPlan);
      // Premium kutlaması: altın kart + kıvılcım (components/toast).
      Toast.show({
        type: "premium",
        text1: tr ? `Seelogd ${planName} aktif edildi!` : es ? `¡Seelogd ${planName} está activo!` : pt ? `O Seelogd ${planName} está ativo!` : de ? `Seelogd ${planName} ist aktiv!` : `Seelogd ${planName} is active!`,
        text2: tr ? "Tüm ayrıcalıkların kullanıma hazır." : es ? "Todas tus ventajas están listas." : pt ? "Todos os seus benefícios estão prontos." : de ? "Alle deine Vorteile sind bereit." : "All your benefits are ready.",
      });
    } catch (error) {
      if (error?.userCancelled) return;
      // Davet indirimi mağazadan alınamadı: tam fiyata sormadan geçilmez.
      if (error?.code === REFERRAL_OFFER_UNAVAILABLE) {
        appAlert(
          tr ? "İndirim şu an uygulanamıyor" : es ? "El descuento no está disponible ahora" : pt ? "O desconto não está disponível agora" : de ? "Der Rabatt ist gerade nicht verfügbar" : "The discount isn't available right now",
          tr ? "Davet indirimi mağazadan alınamadı. Tam fiyatla devam edebilir ya da daha sonra tekrar deneyebilirsin." : es ? "No se pudo obtener el descuento de invitación de la tienda. Puedes continuar con el precio completo o intentarlo más tarde." : pt ? "Não foi possível obter o desconto de convite na loja. Você pode continuar com o preço cheio ou tentar mais tarde." : de ? "Der Einladungsrabatt konnte nicht vom Store abgerufen werden. Du kannst zum vollen Preis fortfahren oder es später erneut versuchen." : "The invite discount couldn't be retrieved from the store. You can continue at full price or try again later.",
          [
            { text: tr ? "Vazgeç" : es ? "Cancelar" : pt ? "Cancelar" : de ? "Abbrechen" : "Cancel", style: "cancel" },
            {
              text: tr ? "Tam fiyatla devam et" : es ? "Continuar con precio completo" : pt ? "Continuar com preço cheio" : de ? "Zum vollen Preis fortfahren" : "Continue at full price",
              onPress: () => purchase(aPackage, null),
            },
          ],
        );
        return;
      }
      Toast.show({
        type: "error",
        text1: tr ? "Satın alma tamamlanamadı" : es ? "No se pudo completar la compra" : pt ? "Não foi possível concluir a compra" : de ? "Der Kauf konnte nicht abgeschlossen werden" : "Purchase could not be completed",
        text2: error?.message,
      });
    }
  };

  const buy = () => {
    if (!selectedPackage || busy) return;
    purchase(selectedPackage, offerChoiceFor(selectedPackage).handle);
  };

  const restore = async () => {
    if (busy) return;
    try {
      const info = await restorePurchases();
      const restored = Boolean(info?.entitlements?.active?.[entitlementId]);
      Toast.show({
        type: restored ? "premium" : "info",
        text1: restored
          ? tr ? "Satın alımın başarıyla geri yüklendi" : es ? "Compra restaurada correctamente" : pt ? "Compra restaurada com sucesso" : de ? "Kauf erfolgreich wiederhergestellt" : "Purchase successfully restored"
          : tr ? "Aktif bir abonelik bulunamadı" : es ? "No se encontró ninguna suscripción activa" : pt ? "Nenhuma assinatura ativa encontrada" : de ? "Kein aktives Abo gefunden" : "No active subscription found",
      });
    } catch (error) {
      Toast.show({
        type: "error",
        text1: tr ? "Satın alımlar geri yüklenemedi" : es ? "No se pudieron restaurar las compras" : pt ? "Não foi possível restaurar as compras" : de ? "Käufe konnten nicht wiederhergestellt werden" : "Purchases could not be restored",
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
        text1: tr ? "Abonelik ayarları açılamadı" : es ? "No se pudieron abrir los ajustes de la suscripción" : pt ? "Não foi possível abrir as configurações da assinatura" : de ? "Die Abo-Einstellungen konnten nicht geöffnet werden" : "Subscription settings could not be opened",
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
        <GlassBox role="card"
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
        </GlassBox>
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
                  {isUnlimited ? "PREMIUM MAX" : tr ? "AKTİF" : es ? "ACTIVO" : pt ? "ATIVO" : de ? "AKTIV" : "ACTIVE"}
                </Text>
              </View>
            ) : (
              <View style={[styles.heroStatusPill, { backgroundColor: alpha(C.accent, 0.15) }]}>
                <AppIcon name="sparkles" size={11} color={C.accent} />
                <Text style={[styles.heroStatusText, { color: C.accent }]}>
                  {tr ? "AYRICALIKLARI AÇ" : es ? "DESBLOQUEA TODO" : pt ? "DESBLOQUEIE TUDO" : de ? "ALLES FREISCHALTEN" : "UNLOCK ALL"}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.heroBody}>
            <Text style={[styles.heroTitle, { color: C.text }]}>
              {isUnlimited
                ? tr ? "Premium Max aktif." : es ? "Premium Max está activo." : pt ? "Premium Max está ativo." : de ? "Premium Max ist aktiv." : "Premium Max is active."
                : isPremium
                ? tr ? "Premium planın aktif." : es ? "Tu plan Premium está activo." : pt ? "Seu plano Premium está ativo." : de ? "Dein Premium-Plan ist aktiv." : "Your Premium plan is active."
                : tr ? "Sana uygun planı seç." : es ? "Elige el plan que te conviene." : pt ? "Escolha o plano ideal para você." : de ? "Wähle den passenden Plan." : "Choose the plan that fits you."}
            </Text>
            <Text style={[styles.heroSubtitle, { color: C.muted }]}>
              {tr ? "AI kotası, sosyal limitler ve kişiselleştirme seçeneklerini tek yerden karşılaştır." : es ? "Compara la cuota de IA, los límites sociales y la personalización en un solo lugar." : pt ? "Compare a cota de IA, os limites sociais e a personalização em um só lugar." : de ? "Vergleiche KI-Kontingent, soziale Limits und Personalisierung an einem Ort." : "Compare AI allowance, social limits and personalization in one place."}
            </Text>
          </View>

          <View style={styles.heroBenefitsRow}>
            {[
              ["sparkles", tr ? "Daha fazla AI" : es ? "Más IA" : pt ? "Mais IA" : de ? "Mehr KI" : "More AI"],
              ["people", tr ? "Daha geniş limitler" : es ? "Más límites" : pt ? "Mais limites" : de ? "Höhere Limits" : "Higher limits"],
              ["color-palette", tr ? "Kişiselleştirme" : es ? "Personalización" : pt ? "Personalização" : de ? "Personalisierung" : "Personalization"],
            ].map(([icon, label]) => (
              <View key={icon} style={styles.heroBenefitItem}>
                <AppIcon name={icon} size={14} color={C.accent} />
                <Text style={[styles.heroBenefitText, { color: C.text }]}>{label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>
      </View>

      {/* DIRECT PLAN & PRICING SECTION */}
      <View style={styles.pricingSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            {tr ? "Plan seç" : es ? "Elige un plan" : pt ? "Escolha um plano" : de ? "Plan wählen" : "Choose a plan"}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: C.muted }]}>
            {tr ? "Önce planı, ardından ödeme dönemini seç." : es ? "Primero el plan y después el periodo de pago." : pt ? "Primeiro o plano, depois o período de pagamento." : de ? "Wähle zuerst den Plan, dann den Abrechnungszeitraum." : "Pick a plan, then choose the billing period."}
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
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected, disabled }}
                accessibilityLabel={getPremiumPlanDisplayName(tier)}
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
                    {isMax && !isSelected && (
                      <View style={[styles.tierTabMiniBadge, { backgroundColor: isSelected ? "rgba(255,255,255,0.22)" : alpha("#F59E0B", 0.16) }]}>
                        <Text style={[styles.tierTabMiniBadgeText, { color: isSelected ? "#fff" : "#F59E0B" }]}>
                          {tr ? "EN YÜKSEK" : es ? "MÁXIMO" : pt ? "MÁXIMO" : de ? "MAXIMAL" : "HIGHEST"}
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
                      ? tr ? `${AI_PLAN_LIMITS.unlimited.daily} AI / gün · En geniş limitler` : es ? `${AI_PLAN_LIMITS.unlimited.daily} IA/día · Límites máximos` : pt ? `${AI_PLAN_LIMITS.unlimited.daily} IA/dia · Limites máximos` : de ? `${AI_PLAN_LIMITS.unlimited.daily} KI/Tag · Höchste Limits` : `${AI_PLAN_LIMITS.unlimited.daily} AI/day · Highest limits`
                      : tr ? `${AI_PLAN_LIMITS.premium.daily} AI / gün · Dengeli seçenek` : es ? `${AI_PLAN_LIMITS.premium.daily} IA/día · Opción equilibrada` : pt ? `${AI_PLAN_LIMITS.premium.daily} IA/dia · Opção equilibrada` : de ? `${AI_PLAN_LIMITS.premium.daily} KI/Tag · Ausgewogene Wahl` : `${AI_PLAN_LIMITS.premium.daily} AI/day · Balanced choice`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* DIRECT PRICING PACKAGES */}
        {loading ? (
          <View style={styles.packagesLoader}>
            <LensLoader size="large" color={C.accent} />
            <Text style={[styles.packagesLoaderText, { color: C.muted }]}>
              {tr ? "Mağaza fiyatları alınıyor…" : es ? "Cargando precios de la tienda…" : pt ? "Carregando preços da loja…" : de ? "Store-Preise werden geladen…" : "Loading store prices…"}
            </Text>
          </View>
        ) : selectedTierPackages.length > 0 ? (
          <View style={styles.packagesContainer}>
            {selectedTierPackages.map((aPackage) => {
              const isSelected = aPackage.identifier === selectedPackage?.identifier;
              const isAnnual = getPackagePeriodKey(aPackage) === "annual";
              const savings = getPackageSavings(aPackage, pricedPackages, language);
              const monthlyEquivalent = getPackageMonthlyEquivalent(aPackage, language);
              const regular = getPackageRegularPrice(aPackage);
              const offer = introOfferFor(aPackage);
              const cardBorderColor = isSelected
                ? isAnnual
                  ? "#F59E0B"
                  : C.accent
                : isAnnual
                ? alpha("#F59E0B", 0.45)
                : C.border;

              return (
                <GlassPressable
                  key={aPackage.identifier}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${getPremiumPlanDisplayName(selectedTier)}, ${packageTitle(aPackage, language)}, ${getPackageRegularPrice(aPackage).priceString}`}
                  onPress={() => handleSelectPackage(aPackage.identifier)}
                  style={[
                    styles.pricingCard,
                    {
                      backgroundColor: C.card,
                      borderColor: cardBorderColor,
                    },
                    isSelected && styles.pricingCardSelected,
                  ]}
                >
                  <View style={styles.pricingCardHeader}>
                    {isAnnual ? (
                      <View style={[styles.popularBadge, { backgroundColor: "#F59E0B" }]}>
                        <AppIcon name="flame" size={11} color="#fff" />
                        <Text style={styles.popularBadgeText}>
                          {tr ? "EN AVANTAJLI" : es ? "MEJOR PRECIO" : pt ? "MELHOR PREÇO" : de ? "BESTES ANGEBOT" : "BEST VALUE"}
                        </Text>
                      </View>
                    ) : (
                      <View style={[styles.flexibleBadge, { backgroundColor: C.cardAlt }]}>
                        <Text style={[styles.flexibleBadgeText, { color: C.muted }]}>
                          {tr ? "ESNEK DÖNEM" : es ? "FLEXIBLE" : pt ? "FLEXÍVEL" : de ? "FLEXIBEL" : "FLEXIBLE"}
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
                        {packageTitle(aPackage, language)}
                      </Text>
                      <Text style={[styles.pricingPeriodSub, { color: C.muted }]}>
                        {packageRenewalNote(aPackage, language)}
                      </Text>
                    </View>

                    <View style={styles.pricingNumbersWrap}>
                      <View style={styles.pillRow}>
                        {offer && (
                          <View style={[styles.savingsPill, { backgroundColor: alpha(OFFER_COLOR, 0.16) }]}>
                            <Text style={[styles.savingsText, { color: OFFER_COLOR }]}>
                              {offer.free
                                ? tr ? "ÜCRETSİZ DENEME" : es ? "PRUEBA GRATIS" : pt ? "TESTE GRÁTIS" : de ? "KOSTENLOS TESTEN" : "FREE TRIAL"
                                : tr ? `%${offer.percent} İNDİRİM` : es ? `${offer.percent}% DE DESCUENTO` : pt ? `${offer.percent}% DE DESCONTO` : de ? `${offer.percent} % RABATT` : `${offer.percent}% OFF`}
                            </Text>
                          </View>
                        )}
                        {savings && (
                          <View style={[styles.savingsPill, { backgroundColor: C.iconGreen }]}>
                            <Text style={[styles.savingsText, { color: C.green }]}>
                              {tr ? `%${savings.percent} TASARRUF` : es ? `AHORRA ${savings.percent}%` : pt ? `ECONOMIZE ${savings.percent}%` : de ? `${savings.percent} % SPAREN` : `SAVE ${savings.percent}%`}
                            </Text>
                          </View>
                        )}
                      </View>
                      {offer ? (
                        <>
                          <Text
                            fontRole="numeric"
                            style={[styles.strikePrice, { color: C.muted }]}
                          >
                            {regular.priceString}
                          </Text>
                          <View style={styles.priceRow}>
                            <Text fontRole="numeric" style={[styles.priceString, { color: C.text }]}>
                              {offer.free ? (tr ? "Ücretsiz" : es ? "Gratis" : pt ? "Grátis" : de ? "Kostenlos" : "Free") : offer.priceString}
                            </Text>
                            <Text style={[styles.pricePeriod, { color: C.muted }]}>
                              {offer.free ? "" : offerPeriodLabel(offer, language)}
                            </Text>
                          </View>
                        </>
                      ) : (
                        <View style={styles.priceRow}>
                          <Text fontRole="numeric" style={[styles.priceString, { color: C.text }]}>
                            {regular.priceString}
                          </Text>
                          <Text style={[styles.pricePeriod, { color: C.muted }]}>
                            {packagePeriodLabel(aPackage, language)}
                          </Text>
                        </View>
                      )}
                    </View>
                  </View>

                  {offer && (
                    <View
                      style={[
                        styles.offerCallout,
                        {
                          backgroundColor: alpha(OFFER_COLOR, 0.08),
                          borderColor: alpha(OFFER_COLOR, 0.22),
                        },
                      ]}
                    >
                      <AppIcon name="pricetag-outline" size={13} color={OFFER_COLOR} />
                      <Text style={[styles.monthlyEquivalentText, { color: C.text, flex: 1 }]}>
                        {offerDisclosure(offer, aPackage, language)}
                      </Text>
                    </View>
                  )}

                  {isAnnual && monthlyEquivalent && (
                    <View style={[styles.monthlyEquivalentCallout, { backgroundColor: alpha(C.accent, 0.08), borderColor: alpha(C.accent, 0.16) }]}>
                      <AppIcon name="calculator-outline" size={13} color={C.accent} />
                      <Text style={[styles.monthlyEquivalentText, { color: C.text }]}>
                        {tr ? "Sadece " : es ? "Solo " : pt ? "Apenas " : de ? "Nur " : "Only "}
                        <Text style={{ color: C.accent, fontWeight: "900" }}>
                          {monthlyEquivalent}
                        </Text>
                        {tr ? " / aya denk gelir" : es ? " / mes (equivalente)" : pt ? " / mês (equivalente)" : de ? " / Monat umgerechnet" : " / month equivalent"}
                      </Text>
                    </View>
                  )}
                </GlassPressable>
              );
            })}
          </View>
        ) : (
          <GlassBox role="card" style={[styles.noticeBox, { backgroundColor: C.card, borderColor: C.border }]}>
            <AppIcon family="Ionicons" name="construct-outline" size={20} color={C.amber} />
            <Text style={[styles.noticeText, { color: C.muted }]}>
              {configurationError === "missing-api-key"
                ? tr ? "RevenueCat API anahtarı bekleniyor." : es ? "Falta la clave de la API de RevenueCat." : pt ? "A chave da API do RevenueCat não foi encontrada." : de ? "Der RevenueCat-API-Schlüssel fehlt." : "RevenueCat API key is missing."
                : tr ? `${selectedPlanName} mağaza paketleri henüz hazır değil.` : es ? `Los paquetes de ${selectedPlanName} aún no se han cargado.` : pt ? `Os pacotes de ${selectedPlanName} ainda não foram carregados.` : de ? `${selectedPlanName}-Pakete wurden noch nicht geladen.` : `${selectedPlanName} packages not loaded yet.`}
            </Text>
          </GlassBox>
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
            {busyAction === "purchase" || busyAction === "customer-center" ? (
              <LensLoader tone="mono" color="#fff" size="small" />
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
                      ? tr ? "Aboneliği Yönet" : es ? "Gestionar suscripción" : pt ? "Gerenciar assinatura" : de ? "Abo verwalten" : "Manage Subscription"
                      : isPremium
                      ? tr ? `${selectedPlanName}'e Yükselt` : es ? `Pasar a ${selectedPlanName}` : pt ? `Mudar para ${selectedPlanName}` : de ? `Auf ${selectedPlanName} upgraden` : `Upgrade to ${selectedPlanName}`
                      : tr ? "Hemen Başla" : es ? "Empieza ahora" : pt ? "Comece agora" : de ? "Jetzt loslegen" : "Get Started Now"}
                  </Text>
                  {selectedTier !== plan && selectedDisplayPackage && (
                    <Text style={styles.ctaSubText}>
                      {selectedOffer
                        ? offerDisclosure(selectedOffer, selectedDisplayPackage, language)
                        : `${getPackageRegularPrice(selectedDisplayPackage).priceString} ${packagePeriodLabel(selectedDisplayPackage, language)}`}
                      {tr ? " · İstediğin an iptal et" : es ? " · Cancela cuando quieras" : pt ? " · Cancele quando quiser" : de ? " · Jederzeit kündbar" : " · Cancel anytime"}
                    </Text>
                  )}
                </View>
                <AppIcon name="arrow-forward" size={19} color="#fff" />
              </>
            )}
          </LinearGradient>
        </Pressable>

        <View style={styles.purchaseNoteRow}>
          <AppIcon name="shield-checkmark-outline" size={14} color={C.green} />
          <Text style={[styles.purchaseNoteText, { color: C.muted }]}>
            {tr ? "Ödeme mağaza hesabın üzerinden güvenle işlenir · İstediğin an iptal" : es ? "Pago seguro mediante tu cuenta de la tienda · Cancela cuando quieras" : pt ? "Pagamento seguro pela sua conta da loja · Cancele quando quiser" : de ? "Sichere Zahlung über dein Store-Konto · Jederzeit kündbar" : "Secure payment through your store account · Cancel anytime"}
          </Text>
        </View>
      </View>

      {/* Seçili planın öne çıkanları — tek, sakin bir liste */}
      <View style={styles.featuresSection}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: C.text }]}>
            {tr ? `${selectedPlanName} ile gelenler` : es ? `Incluido con ${selectedPlanName}` : pt ? `Incluído no ${selectedPlanName}` : de ? `In ${selectedPlanName} enthalten` : `Included with ${selectedPlanName}`}
          </Text>
          <Text style={[styles.sectionSubtitle, { color: C.muted }]}>
            {tr ? `${selectedBenefits.length} özelliğin tamamı` : es ? `Las ${selectedBenefits.length} funciones incluidas` : pt ? `Todos os ${selectedBenefits.length} recursos incluídos` : de ? `Alle ${selectedBenefits.length} enthaltenen Funktionen` : `All ${selectedBenefits.length} included features`}
          </Text>
        </View>

        <View style={styles.benefitGrid}>
          {visibleBenefits.map((benefit) => (
            <View key={benefit.id} style={[styles.benefitCard, { backgroundColor: C.card, borderColor: C.border }]}>
              <View style={styles.benefitCardTop}>
                <View style={[styles.benefitIcon, { backgroundColor: alpha(benefit.color, 0.13) }]}>
                  <AppIcon name={benefit.icon} size={17} color={benefit.color} />
                </View>
                <AppIcon name="checkmark-circle" size={17} color={C.green} />
              </View>
              <View style={styles.benefitCopy}>
                <Text numberOfLines={2} style={[styles.benefitTitle, { color: C.text }]}>
                  {benefit.title}
                </Text>
                <Text numberOfLines={2} style={[styles.benefitValue, { color: benefit.color }]}>
                  {benefit.value}
                </Text>
                <Text numberOfLines={1} style={[styles.benefitCategory, { color: C.muted }]}>
                  {benefit.categoryTitle}
                </Text>
              </View>
            </View>
          ))}
        </View>
        {selectedBenefits.length > 6 ? (
          <GlassPressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showAllBenefits }}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setShowAllBenefits((current) => !current);
            }}
            style={({ pressed }) => [
              styles.benefitToggle,
              {
                backgroundColor: C.card,
                borderColor: C.border,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text style={[styles.benefitToggleText, { color: C.accent }]}>
              {showAllBenefits
                ? tr ? "Daralt" : es ? "Ver menos" : pt ? "Ver menos" : de ? "Weniger anzeigen" : "Show less"
                : tr ? `Tümünü göster (${selectedBenefits.length})` : es ? `Ver todo (${selectedBenefits.length})` : pt ? `Ver tudo (${selectedBenefits.length})` : de ? `Alle anzeigen (${selectedBenefits.length})` : `Show all (${selectedBenefits.length})`}
            </Text>
            <AppIcon
              name={showAllBenefits ? "chevron-up" : "chevron-down"}
              size={15}
              color={C.accent}
            />
          </GlassPressable>
        ) : null}
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
                  {tr ? "PLAN KARŞILAŞTIRMA" : es ? "COMPARACIÓN DE PLANES" : pt ? "COMPARAÇÃO DE PLANOS" : de ? "PLANVERGLEICH" : "PLAN COMPARISON"}
                </Text>
              </View>
              <Text style={[styles.accordionFeatureCount, { color: C.muted }]}>
                {tr ? `${comparisonSections.length} Kategori · ${comparisonRowCount} Özellik` : es ? `${comparisonSections.length} categorías · ${comparisonRowCount} funciones` : pt ? `${comparisonSections.length} categorias · ${comparisonRowCount} recursos` : de ? `${comparisonSections.length} Kategorien · ${comparisonRowCount} Funktionen` : `${comparisonSections.length} Categories · ${comparisonRowCount} Features`}
              </Text>
            </View>

            <Text style={[styles.accordionToggleTitle, { color: C.text }]}>
              {tr ? "Planları Karşılaştır" : es ? "Comparar planes" : pt ? "Comparar planos" : de ? "Pläne vergleichen" : "Compare Plans"}
            </Text>
            <Text style={[styles.accordionToggleSub, { color: C.muted }]}>
              {tr ? "Free, Premium ve Premium Max'te her özelliğin sınırı" : es ? "El límite de cada función en Gratis, Premium y Premium Max" : pt ? "O limite de cada recurso no Grátis, no Premium e no Premium Max" : de ? "Das Limit jeder Funktion bei Kostenlos, Premium und Premium Max" : "Every feature's limit on Free, Premium and Premium Max"}
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
              style={styles.categoryFilterScroll}
              contentContainerStyle={styles.categoryFilterRow}
            >
              {[
                { id: "all", title: tr ? "✦ Tümü" : es ? "✦ Todo" : pt ? "✦ Tudo" : de ? "✦ Alle" : "✦ All", icon: "sparkles", color: "#6366F1" },
                ...comparisonSections,
              ].map((cat) => {
                const isCatActive = categoryFilter === cat.id;
                const activeColor = cat.color || C.accent;
                return (
                  <GlassPressable
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
                  </GlassPressable>
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
        <Pressable
          disabled={busy}
          onPress={() => setRedeemOpen(true)}
          accessibilityRole="button"
          style={styles.restoreBtn}
        >
          <Text style={[styles.restoreBtnText, { color: C.accent }]}>
            {referralCopy.redeem.entryTitle}
          </Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={restore} style={styles.restoreBtn}>
          {busyAction === "restore" ? (
            <LensLoader size="small" color={C.accent} />
          ) : (
            <Text style={[styles.restoreBtnText, { color: C.accent }]}>
              {tr ? "Önceki Satın Alımları Geri Yükle" : es ? "Restaurar compras anteriores" : pt ? "Restaurar compras anteriores" : de ? "Frühere Käufe wiederherstellen" : "Restore Previous Purchases"}
            </Text>
          )}
        </Pressable>
      </View>

      {/* LEGAL FOOTER */}
      <View style={styles.legalSection}>
        <Text style={[styles.legalDisclaimer, { color: C.muted }]}>
          {tr ? "Satın alma tutarı uygulama mağazası hesabınızdan tahsil edilir. Abonelik, geçerli dönemin bitiminden en az 24 saat önce iptal edilmediği sürece otomatik olarak yenilenir. İstediğiniz zaman mağaza hesap ayarlarınızdan iptal edebilir veya yönetebilirsiniz." : es ? "El pago se cargará a tu cuenta de la tienda. La suscripción se renueva automáticamente salvo que la canceles al menos 24 horas antes de que termine el periodo actual. Puedes gestionarla o cancelarla en cualquier momento en los ajustes de tu cuenta de la tienda." : pt ? "O pagamento será cobrado na sua conta da loja. A assinatura é renovada automaticamente, a menos que seja cancelada pelo menos 24 horas antes do fim do período atual. Você pode gerenciá-la ou cancelá-la a qualquer momento nas configurações da sua conta da loja." : de ? "Die Zahlung wird deinem Store-Konto belastet. Das Abo verlängert sich automatisch, sofern es nicht mindestens 24 Stunden vor Ende des laufenden Zeitraums gekündigt wird. Du kannst es jederzeit in den Einstellungen deines Store-Kontos verwalten oder kündigen." : "Payment will be charged to your store account. The subscription automatically renews unless canceled at least 24 hours before the end of the current period. You can manage or cancel anytime in your store account settings."}
        </Text>

        <View style={styles.legalLinksRow}>
          <Pressable onPress={() => openLegalPage("terms", language)} hitSlop={8}>
            <Text style={[styles.legalLink, { color: C.accent }]}>
              {i18nText("autoI18n.kullanim_kosullari", "Kullanım Koşulları")}
            </Text>
          </Pressable>
          <Text style={[styles.legalBullet, { color: C.muted }]}>•</Text>
          <Pressable onPress={() => openLegalPage("privacy", language)} hitSlop={8}>
            <Text style={[styles.legalLink, { color: C.accent }]}>
              {i18nText("autoI18n.gizlilik_politikasi", "Gizlilik Politikası")}
            </Text>
          </Pressable>
        </View>
      </View>
      <RedeemCodeSheet
        visible={redeemOpen}
        onClose={() => setRedeemOpen(false)}
        onRedeemed={(result) => {
          if (result?.kind === "promo") {
            Toast.show({
              type: "premium",
              text1: referralCopy.redeem.promoSuccess(
                result.days,
                formatRedeemDate(result.untilMs, language),
              ),
            });
          } else {
            Toast.show({
              type: "success",
              text1: referralCopy.redeem.referralSuccess(
                result?.discount?.percent ?? 30,
                result?.inviterName,
              ),
            });
          }
          reloadReferral();
        }}
      />
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
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 20,
  },
  heroGradient: {
    padding: 16,
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
    marginTop: 16,
    marginBottom: 14,
  },
  heroTitle: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: "900",
    letterSpacing: -0.6,
  },
  heroSubtitle: {
    fontSize: 12,
    lineHeight: 18,
    marginTop: 6,
    fontWeight: "500",
  },
  heroBenefitsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  heroBenefitItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingRight: 6,
  },
  heroBenefitText: {
    fontSize: 10.5,
    fontWeight: "700",
  },
  pricingSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    marginBottom: 12,
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
    marginBottom: 14,
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
    borderRadius: 16,
    borderWidth: 1,
    padding: 13,
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
  pillRow: {
    flexDirection: "row",
    gap: 4,
  },
  strikePrice: {
    fontSize: 11,
    fontWeight: "700",
    textDecorationLine: "line-through",
  },
  offerCallout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginTop: 10,
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
    borderRadius: 15,
    overflow: "hidden",
    marginTop: 16,
    shadowColor: "#000",
    shadowOpacity: 0.14,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ctaGradient: {
    minHeight: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
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
  purchaseNoteRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
    paddingHorizontal: 8,
  },
  purchaseNoteText: {
    flexShrink: 1,
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
    textAlign: "center",
  },
  featuresSection: {
    marginBottom: 24,
  },
  benefitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  benefitCard: {
    width: "48.5%",
    minHeight: 104,
    borderRadius: 13,
    borderWidth: 1,
    padding: 10,
  },
  benefitCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 7,
  },
  benefitIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  benefitCopy: {
    flex: 1,
    minWidth: 0,
  },
  benefitTitle: {
    minHeight: 28,
    fontSize: 11.5,
    lineHeight: 14,
    fontWeight: "800",
  },
  benefitValue: {
    fontSize: 9.5,
    lineHeight: 12,
    marginTop: 2,
    fontWeight: "800",
  },
  benefitCategory: {
    fontSize: 8,
    lineHeight: 10,
    marginTop: 3,
    fontWeight: "600",
  },
  benefitToggle: {
    minHeight: 40,
    marginTop: 9,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
  },
  benefitToggleText: {
    fontSize: 11,
    fontWeight: "800",
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
  // Basılan cam hap kesilmesin: pay GLASS_PRESS_ROOM, eski dolgunun fazlası dış boşluktan düşülür.
  categoryFilterScroll: {
    marginVertical: 4 - GLASS_PRESS_ROOM,
    marginHorizontal: 2 - GLASS_PRESS_ROOM,
  },
  categoryFilterRow: {
    gap: 8,
    paddingVertical: GLASS_PRESS_ROOM,
    paddingHorizontal: GLASS_PRESS_ROOM,
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
  detailedCardTitle: {
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  detailedCardBody: {
    borderTopWidth: 1,
    padding: 12,
    gap: 8,
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
  secondaryActions: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 20,
  },
  restoreBtn: {
    minHeight: 40,
    paddingHorizontal: 10,
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
