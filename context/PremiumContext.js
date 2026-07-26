import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import {
  addRevenueCatCustomerInfoListener,
  configureRevenueCat,
  disconnectRevenueCatUser,
  getRevenueCatConfiguration,
  loadRevenueCatState,
  openRevenueCatSubscriptionManagement,
  presentRevenueCatCustomerCenter,
  presentRevenueCatPaywall,
  purchaseRevenueCatPackage,
  restoreRevenueCatPurchases,
} from "../services/revenueCatService";
import {
  getPremiumPlan,
  PREMIUM_PLAN,
  REVENUECAT_PRODUCT_IDS,
} from "../utils/premium";

const PremiumContext = createContext(null);

export function PremiumProvider({ children }) {
  const { user, needsProfileCompletion } = useAuth();
  const [customerInfo, setCustomerInfo] = useState(null);
  const [offerings, setOfferings] = useState(null);
  const [standaloneProducts, setStandaloneProducts] = useState([]);
  const [loading, setLoading] = useState(true);
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
        setLoading(false);
        disconnectRevenueCatUser();
        return;
      }

      if (!config.supported) {
        setConfigurationError("unsupported-platform");
        setLoading(false);
        return;
      }
      if (!config.apiKey) {
        setConfigurationError("missing-api-key");
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
        if (active) setLoading(false);
      }
    };

    start();
    return () => {
      active = false;
      removeListener?.();
    };
  }, [config.apiKey, config.supported, needsProfileCompletion, user]);

  const purchasePackage = useCallback(async (aPackage) => {
    if (!aPackage) throw new Error("purchase-package-required");
    setBusyAction("purchase");
    try {
      const result = await purchaseRevenueCatPackage(aPackage);
      setCustomerInfo(result.customerInfo);
      return result;
    } finally {
      setBusyAction(null);
    }
  }, []);

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

  const showPaywall = useCallback(
    async ({ onlyIfNeeded = false } = {}) => {
      setBusyAction("paywall");
      try {
        const result = await presentRevenueCatPaywall({
          offering: offerings?.current,
          entitlementId: config.entitlementId,
          onlyIfNeeded,
        });
        if (result.customerInfo) setCustomerInfo(result.customerInfo);
        return result;
      } finally {
        setBusyAction(null);
      }
    },
    [config.entitlementId, offerings?.current]
  );

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
    const plan = getPremiumPlan(customerInfo, config.entitlementId);
    const offeringPackages = offerings?.current?.availablePackages || [];
    const hasUnlimitedYearly = offeringPackages.some(
      (item) =>
        item?.product?.identifier === REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY
    );
    const unlimitedYearlyProduct = standaloneProducts.find(
      (product) =>
        product?.identifier === REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY
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
      showPaywall,
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
    purchasePackage,
    refresh,
    restorePurchases,
    showPaywall,
    standaloneProducts,
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
