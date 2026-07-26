import { Linking, Platform } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";
import {
  PREMIUM_ENTITLEMENT_ID,
  REVENUECAT_PRODUCT_IDS,
} from "../utils/premium";

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

export const purchaseRevenueCatPackage = (aPackage) =>
  aPackage?.isStandaloneProduct
    ? Purchases.purchaseStoreProduct(aPackage.product)
    : Purchases.purchasePackage(aPackage);

export const restoreRevenueCatPurchases = () => Purchases.restorePurchases();

export async function presentRevenueCatPaywall({
  offering,
  entitlementId = PREMIUM_ENTITLEMENT_ID,
  onlyIfNeeded = false,
} = {}) {
  const result = onlyIfNeeded
    ? await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: entitlementId,
        offering,
        displayCloseButton: true,
      })
    : await RevenueCatUI.presentPaywall({
        offering,
        displayCloseButton: true,
      });

  const customerInfo =
    result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED
      ? await Purchases.getCustomerInfo()
      : null;
  return { result, customerInfo };
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
