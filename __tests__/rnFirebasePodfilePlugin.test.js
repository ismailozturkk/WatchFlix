// __tests__/rnFirebasePodfilePlugin.test.js
//
// plugins/withRNFirebaseCocoaPods.js Podfile düzenlemelerinin sözleşmesi.
//
// NEDEN: FirebaseAppCheck 12.15–12.18 CocoaPods ile derlenmiyor
// (`unknown receiver 'GACRecaptchaProvider'`). Sürüm yalnız bazı EAS
// profillerinde env ile sabitlenmişti; development/preview iOS derlemeleri
// varsayılan 12.17.0'a düşüp patladı. Sabitleme artık Podfile'da; bu test onun
// sessizce kaybolmasını engeller.

const {
  disableRNFirebaseSpm,
  pinFirebaseSdkVersion,
  FIREBASE_IOS_SDK_VERSION,
} = require("../plugins/withRNFirebaseCocoaPods");

const PODFILE = [
  "require File.join(File.dirname(`node --print \"require.resolve('expo/package.json')\"`), \"scripts/autolinking\")",
  "",
  "prepare_react_native_project!",
  "",
  "target 'Seelogd' do",
  "end",
  "",
].join("\n");

describe("withRNFirebaseCocoaPods", () => {
  it("Firebase iOS SDK 12.15–12.18 aralığında olmayan bir sürüme sabitler", () => {
    // 12.15.0–12.18.0 CocoaPods'ta derlenmez; 12.14.0 son sağlam sürüm.
    const [major, minor] = FIREBASE_IOS_SDK_VERSION.split(".").map(Number);
    const broken = major === 12 && minor >= 15 && minor <= 18;
    expect(broken).toBe(false);
  });

  it("$FirebaseSDKVersion satırını prepare_react_native_project!'ten ÖNCE ekler", () => {
    const out = pinFirebaseSdkVersion(PODFILE);
    const pin = out.indexOf(`$FirebaseSDKVersion = '${FIREBASE_IOS_SDK_VERSION}'`);
    expect(pin).toBeGreaterThan(-1);
    expect(pin).toBeLessThan(out.indexOf("prepare_react_native_project!"));
  });

  it("idempotent: ikinci çalıştırma Podfile'ı değiştirmez", () => {
    const once = pinFirebaseSdkVersion(PODFILE);
    expect(pinFirebaseSdkVersion(once)).toBe(once);
  });

  it("var olan farklı bir sürümü günceller, yinelemez", () => {
    const stale = PODFILE.replace(
      "prepare_react_native_project!",
      "$FirebaseSDKVersion = '12.17.0'\n\nprepare_react_native_project!",
    );
    const out = pinFirebaseSdkVersion(stale);
    expect(out.match(/\$FirebaseSDKVersion/g)).toHaveLength(1);
    expect(out).toContain(`'${FIREBASE_IOS_SDK_VERSION}'`);
    expect(out).not.toContain("12.17.0");
  });

  it("SPM'yi kapatma ve sabitleme birlikte uygulanır, ikisi de tek kez", () => {
    const out = pinFirebaseSdkVersion(disableRNFirebaseSpm(PODFILE));
    expect(out.match(/\$RNFirebaseDisableSPM = true/g)).toHaveLength(1);
    expect(out.match(/\$FirebaseSDKVersion/g)).toHaveLength(1);
    expect(out).toBe(pinFirebaseSdkVersion(disableRNFirebaseSpm(out)));
  });

  it("bağlayıcı nokta yoksa sessizce geçmez, hata verir", () => {
    expect(() => pinFirebaseSdkVersion("target 'X' do\nend\n")).toThrow(
      /prepare_react_native_project!/,
    );
  });
});
