import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { useUserProfile } from "./UserProfileContext";
import {
  addRevenueCatCustomerInfoListener,
  configureRevenueCat,
  disconnectRevenueCatUser,
  getRevenueCatConfiguration,
  loadRevenueCatState,
  openRevenueCatSubscriptionManagement,
  presentRevenueCatCustomerCenter,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
  syncPremiumStatusOnServer,
} from "../services/revenueCatService";
import {
  baseProductIdentifier,
  getPremiumPlan,
  PREMIUM_PLAN,
  REVENUECAT_PRODUCT_IDS,
  resolveServerPlan,
} from "../utils/premium";
import { higherPlan } from "../utils/premiumFeatures";
import {
  getPremiumPlanSnapshot,
  publishPremiumPlan,
} from "../services/premiumState";
import { USER_PROPERTIES, setAnalyticsUserProperty } from "../services/analytics";

const PremiumContext = createContext(null);

// ETKİN PLAN — iki kaynağın yükseği:
//   • RevenueCat CustomerInfo: satın almayı ANINDA bilir (cihazda önbellekli).
//   • Sunucu (Users/{uid}.entitlements, webhook/syncPremiumStatus yazar):
//     RevenueCat yapılandırılamasa bile ödeme yapmış kullanıcı kilitte kalmasın.
// Sunucu alanını istemci yazamaz (firestore.rules), bu yüzden güvenilir.
// RevenueCat henüz cevap vermediyse son bilinen plan (services/premiumState)
// kullanılır; premium kullanıcı açılışta bir anlığına kilit görmesin.
//
// İki kaynak ayrışırsa (webhook gecikti, iade oldu) sunucu RevenueCat'ten
// yeniden okutulur: istemcinin söylediğine değil RevenueCat'e güvenir.

export function PremiumProvider({ children }) {
  const { user, needsProfileCompletion, loading: authLoading } = useAuth();
  const { profile, loading: profileLoading } = useUserProfile() || {};
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [standaloneProducts, setStandaloneProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  // RevenueCat durumunun (başarılı ya da hatalı) çözüldüğü kullanıcı. Oturum
  // değişince eski kullanıcının CustomerInfo'su yeni kullanıcıya sızmasın ve
  // cevap gelene kadar son bilinen plan kullanılsın diye.
  const [resolvedUid, setResolvedUid] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [configurationError, setConfigurationError] = useState(null);
  const config = getRevenueCatConfiguration();

  const refresh = useCallback(async () => {
    if (
      !user?.uid ||
      needsProfileCompletion ||
      !config.supported ||
      !config.apiKey
    ) {
      setLoading(false);
      return null;
    }

    const next = await loadRevenueCatState();
    setCustomerInfo(next.customerInfo);
    setOfferings(next.offerings);
    setStandaloneProducts(next.standaloneProducts || []);
    return next;
  }, [config.apiKey, config.supported, needsProfileCompletion, user?.uid]);

  useEffect(() => {
    let active = true;
    let removeListener = null;

    const start = async () => {
      if (!user?.uid || needsProfileCompletion) {
        setCustomerInfo(null);
        setOfferings(null);
        setStandaloneProducts([]);
        setConfigurationError(null);
        setResolvedUid(null);
        setLoading(false);
        disconnectRevenueCatUser();
        return;
      }

      if (!config.supported) {
        setConfigurationError("unsupported-platform");
        setResolvedUid(user.uid);
        setLoading(false);
        return;
      }
      if (!config.apiKey) {
        setConfigurationError("missing-api-key");
        setResolvedUid(user.uid);
        setLoading(false);
        return;
      }

      setLoading(true);
      setConfigurationError(null);
      try {
        await configureRevenueCat(user);
        if (!active) return;
        removeListener = addRevenueCatCustomerInfoListener((info) => {
          if (active) setCustomerInfo(info);
        });
        const next = await loadRevenueCatState();
        if (!active) return;
        setCustomerInfo(next.customerInfo);
        setOfferings(next.offerings);
        setStandaloneProducts(next.standaloneProducts || []);
      } catch (error) {
        if (active) {
          setConfigurationError(error?.message || "configuration-failed");
        }
      } finally {
        if (active) {
          setResolvedUid(user.uid);
          setLoading(false);
        }
      }
    };

    start();
    return () => {
      active = false;
      removeListener?.();
    };
  }, [config.apiKey, config.supported, needsProfileCompletion, user]);

  const signedIn = Boolean(user?.uid && !needsProfileCompletion);
  // RevenueCat bu kullanıcı için henüz cevap vermedi mi?
  const awaitingStore = signedIn && (loading || resolvedUid !== user.uid);
  const storePlan =
    !awaitingStore && customerInfo
      ? getPremiumPlan(customerInfo, config.entitlementId)
      : null;
  const serverPlan = resolveServerPlan(profile?.entitlements);
  // RevenueCat cevabı beklenirken son bilinen plan; cevap hiç gelmediyse
  // (hata, desteklenmeyen platform) yalnız sunucu.
  const provisionalPlan = awaitingStore ? getPremiumPlanSnapshot() : PREMIUM_PLAN.FREE;
  const plan = signedIn
    ? higherPlan(storePlan ?? provisionalPlan, serverPlan)
    : PREMIUM_PLAN.FREE;

  // Tema / yazı tipi gibi React dışı tüketicilere yayın. Oturum ya da
  // RevenueCat beklenirken YAYINLAMA: geçici "free" diske yazılırsa premium
  // kullanıcının teması/fontu her açılışta bir an varsayılana düşer.
  const planSettled = !authLoading && !awaitingStore;
  useEffect(() => {
    if (planSettled) publishPremiumPlan(plan);
  }, [plan, planSettled]);

  // Analytics segmentasyonu: her olay hangi katmandaki kullanıcıdan geldi?
  // Bu özellik olmadan "premium kullanıcı daha çok mu oynuyor / daha az mı
  // çıkıyor" sorularının hiçbiri cevaplanamaz.
  useEffect(() => {
    if (planSettled) setAnalyticsUserProperty(USER_PROPERTIES.PREMIUM_TIER, plan);
  }, [plan, planSettled]);

  // Uzlaştırma: RevenueCat ile sunucu ayrıştıysa sunucuya RevenueCat'i yeniden
  // okut. Aynı ayrışma için oturumda bir kez; sunucu da kendi tarafında
  // sıklığı sınırlar.
  const reconciledRef = useRef(null);
  useEffect(() => {
    if (!signedIn || awaitingStore || !storePlan || profileLoading || !profile) return;
    if (storePlan === serverPlan) return;
    const key = `${user.uid}:${storePlan}:${serverPlan}`;
    if (reconciledRef.current === key) return;
    reconciledRef.current = key;
    syncPremiumStatusOnServer().catch((error) => {
      if (__DEV__) console.warn("syncPremiumStatus:", error?.message || error);
    });
  }, [awaitingStore, profile, profileLoading, serverPlan, signedIn, storePlan, user?.uid]);

  const purchasePackage = useCallback(
    async (aPackage) => {
      if (!aPackage) throw new Error("purchase-package-required");
      setBusyAction("purchase");
      try {
        const result = await purchaseRevenueCatPackage(aPackage, {
          customerInfo,
          entitlementId: config.entitlementId,
        });
        setCustomerInfo(result.customerInfo);
        return result;
      } finally {
        setBusyAction(null);
      }
    },
    [config.entitlementId, customerInfo],
  );

  const restorePurchases = useCallback(async () => {
    setBusyAction("restore");
    try {
      const info = await restoreRevenueCatPurchases();
      setCustomerInfo(info);
      return info;
    } finally {
      setBusyAction(null);
    }
  }, []);

  const manageSubscription = useCallback(async () => {
    setBusyAction("manage");
    try {
      await openRevenueCatSubscriptionManagement(customerInfo);
    } finally {
      setBusyAction(null);
    }
  }, [customerInfo]);

  const openCustomerCenter = useCallback(async () => {
    setBusyAction("customer-center");
    try {
      await presentRevenueCatCustomerCenter({
        onRestoreCompleted: ({ customerInfo: info }) => setCustomerInfo(info),
        onRestoreFailed: ({ error }) => {
          if (__DEV__) {
            console.warn("RevenueCat restore failed:", error?.message || error);
          }
        },
      });
    } catch (error) {
      await openRevenueCatSubscriptionManagement(customerInfo);
    } finally {
      setBusyAction(null);
    }
  }, [customerInfo]);

  const value = useMemo(() => {
    const offeringPackages = offerings?.current?.availablePackages || [];
    const hasUnlimitedYearly = offeringPackages.some(
      (item) =>
        baseProductIdentifier(item?.product?.identifier) ===
        REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY
    );
    const unlimitedYearlyProduct = standaloneProducts.find(
      (product) =>
        baseProductIdentifier(product?.identifier) ===
        REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY
    );
    const packages =
      !hasUnlimitedYearly && unlimitedYearlyProduct
        ? [
            ...offeringPackages,
            {
              identifier: "standalone_unlimited_yearly",
              packageType: "ANNUAL",
              product: unlimitedYearlyProduct,
              isStandaloneProduct: true,
            },
          ]
        : offeringPackages;
    return {
      plan,
      // Mağaza tarafındaki plan (yönetilebilir abonelik). Sunucudan gelen
      // promosyon/yedek plan etkin plana dahildir ama "Aboneliği yönet"
      // yalnız mağaza aboneliğinde anlamlıdır.
      storePlan: storePlan ?? PREMIUM_PLAN.FREE,
      isPremium: plan !== PREMIUM_PLAN.FREE,
      isUnlimited: plan === PREMIUM_PLAN.UNLIMITED,
      customerInfo,
      offerings,
      packages,
      loading,
      busyAction,
      configurationError,
      isConfigured: Boolean(config.supported && config.apiKey),
      entitlementId: config.entitlementId,
      usingTestStore: config.usingTestStore,
      purchasePackage,
      restorePurchases,
      manageSubscription,
      openCustomerCenter,
      refresh,
    };
  }, [
    busyAction,
    config.apiKey,
    config.entitlementId,
    config.supported,
    config.usingTestStore,
    configurationError,
    customerInfo,
    loading,
    manageSubscription,
    openCustomerCenter,
    offerings,
    plan,
    purchasePackage,
    refresh,
    restorePurchases,
    standaloneProducts,
    storePlan,
  ]);

  return (
    <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
  );
}

export function usePremium() {
  const value = useContext(PremiumContext);
  if (!value) throw new Error("usePremium must be used inside PremiumProvider");
  return value;
}
