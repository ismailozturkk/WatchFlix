import { Linking, Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import RevenueCatUI from "react-native-purchases-ui";
import { httpsCallable } from "firebase/functions";
import { fns } from "../firebase";
import {
  PREMIUM_ENTITLEMENT_ID,
  REVENUECAT_PRODUCT_IDS,
  getStoreProductChange,
} from "../utils/premium";
import { ANALYTICS_EVENTS, trackEvent } from "./analytics";

const PRODUCTION_API_KEYS = {
  android: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY,
  ios: process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY,
};

let configured = false;
let identifiedUserId = null;

export function getRevenueCatConfiguration() {
  const testApiKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
  const apiKey =
    __DEV__ && testApiKey ? testApiKey : PRODUCTION_API_KEYS[Platform.OS];
  return {
    apiKey,
    entitlementId:
      process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID ||
      PREMIUM_ENTITLEMENT_ID,
    usingTestStore: Boolean(__DEV__ && testApiKey),
    supported: Platform.OS === "android" || Platform.OS === "ios",
  };
}

export async function configureRevenueCat(user) {
  const { apiKey, supported } = getRevenueCatConfiguration();
  if (!supported || !apiKey || !user?.uid) return false;

  if (!configured) {
    configured = await Purchases.isConfigured().catch(() => false);
  }

  if (!configured) {
    if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    Purchases.configure({ apiKey, appUserID: user.uid });
    configured = true;
    identifiedUserId = user.uid;
  } else {
    const currentUserId = await Purchases.getAppUserID().catch(
      () => identifiedUserId
    );
    if (currentUserId !== user.uid) {
      await Purchases.logIn(user.uid);
    }
    identifiedUserId = user.uid;
  }

  await Promise.allSettled([
    user.email ? Purchases.setEmail(user.email) : Promise.resolve(),
    user.displayName
      ? Purchases.setDisplayName(user.displayName)
      : Promise.resolve(),
  ]);

  return true;
}

export async function disconnectRevenueCatUser() {
  if (!configured || !identifiedUserId) return;
  try {
    await Purchases.logOut();
  } catch (error) {
    // RevenueCat anonim kullanıcıda logOut'u reddedebilir. Oturum kapatma
    // akışını bunun yüzünden engelleme.
    if (__DEV__) console.warn("RevenueCat logOut:", error?.message || error);
  } finally {
    identifiedUserId = null;
  }
}

export async function loadRevenueCatState() {
  const [customerInfo, offerings, standaloneProducts] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getOfferings(),
    Purchases.getProducts([REVENUECAT_PRODUCT_IDS.UNLIMITED_YEARLY]).catch(
      () => []
    ),
  ]);
  return { customerInfo, offerings, standaloneProducts };
}

// Satın alma olayı GA4'ün önerilen `purchase` şemasıyla gönderilir (currency +
// value + item_id) — konsoldaki hazır gelir raporları bu alanları bekler.
// Deneme (trial) başlangıcı AYRI olay: dönüşüm hunisinde "deneme başlattı" ile
// "para ödedi" aynı şey değil; ikisini karıştırmak dönüşüm oranını şişirir.
//
// `customerInfo` verilirse ve kullanıcının aktif bir Play aboneliği varsa
// satın alma bir ÜRÜN DEĞİŞİMİ olarak gönderilir (bkz. getStoreProductChange);
// aksi halde Google Play ikinci bir abonelik açar ve iki kez ücret keser.
export async function purchaseRevenueCatPackage(
  aPackage,
  { customerInfo = null, entitlementId = PREMIUM_ENTITLEMENT_ID } = {},
) {
  const change = getStoreProductChange({
    customerInfo,
    entitlementId,
    aPackage,
    platform: Platform.OS,
  });
  const productChangeInfo = change
    ? {
        oldProductIdentifier: change.oldProductIdentifier,
        replacementMode:
          Purchases.STORE_REPLACEMENT_MODE?.[change.replacementMode] ??
          change.replacementMode,
      }
    : null;

  const result = aPackage?.isStandaloneProduct
    ? await Purchases.purchaseStoreProduct(aPackage.product, productChangeInfo)
    : await Purchases.purchasePackage(aPackage, null, productChangeInfo);

  const product = aPackage?.product || {};
  const params = {
    item_id: product.identifier || result?.productIdentifier || null,
    currency: product.currencyCode || null,
    value: typeof product.price === "number" ? product.price : null,
    package_type: aPackage?.packageType || null,
  };

  const isTrial = Boolean(
    product.introPrice?.periodNumberOfUnits &&
      Number(product.introPrice?.price) === 0,
  );
  trackEvent(
    isTrial ? ANALYTICS_EVENTS.TRIAL_START : ANALYTICS_EVENTS.PURCHASE,
    params,
  );

  return result;
}

export const restoreRevenueCatPurchases = () => Purchases.restorePurchases();

/**
 * Sunucudaki Users/{uid}.entitlements alanını RevenueCat'ten yeniden okutur
 * (functions/index.js syncPremiumStatus). Sunucu istemcinin söylediği plana
 * güvenmez; RevenueCat'e kendisi sorar. Satın alma ile webhook arasındaki
 * boşlukta AI kotası gibi sunucu kapılarının yeni planı hemen görmesi için.
 */
export async function syncPremiumStatusOnServer() {
  const call = httpsCallable(fns, "syncPremiumStatus");
  const { data } = await call({});
  return data;
}

export const presentRevenueCatCustomerCenter = (callbacks) =>
  RevenueCatUI.presentCustomerCenter({ callbacks });

export async function openRevenueCatSubscriptionManagement(customerInfo) {
  const managementURL = customerInfo?.managementURL;
  if (managementURL) {
    await Linking.openURL(managementURL);
    return;
  }
  if (Platform.OS === "ios") {
    await Purchases.showManageSubscriptions();
    return;
  }
  await Linking.openURL("https://play.google.com/store/account/subscriptions");
}

export const addRevenueCatCustomerInfoListener = (listener) => {
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
};
