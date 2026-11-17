// plugins/withAndroidR8.js + native/android-r8/keep-rules.pro bekçisi.
//
// Google Play, Şubat 2027'den itibaren DEX kodu 10 MB'ı aşan uygulamalarda en az
// %25 optimizasyon, %25 karartma ve %25 küçültme istiyor. Bu test üç geri dönüşü
// engeller: -dontoptimize içeren varsayılan ProGuard dosyasına dönmek, koruma
// kurallarına oranları düşüren global bayrak/geniş kural eklemek ve app.json'da
// R8 bayraklarının kapanması. Rehber: docs/planlama/R8_ETKINLESTIRME_UYGULAMA_REHBERI.md

const fs = require("fs");
const path = require("path");
const {
  setGradleProperty,
  swapDefaultProguardFile,
  mergeKeepRules,
  pinAgpVersion,
  AGP_VERSION,
  RULES_SRC,
  KEEP_RES_SRC,
  BEGIN,
  END,
} = require("../plugins/withAndroidR8");

const count = (haystack, needle) => haystack.split(needle).length - 1;

describe("swapDefaultProguardFile", () => {
  const gradle = [
    "release {",
    '    proguardFiles getDefaultProguardFile("proguard-android.txt"), "proguard-rules.pro"',
    "}",
  ].join("\n");

  test("-dontoptimize içeren dosyayı optimize sürümüyle değiştirir", () => {
    const out = swapDefaultProguardFile(gradle);
    expect(out).toContain('getDefaultProguardFile("proguard-android-optimize.txt")');
    expect(out).not.toContain('"proguard-android.txt"');
    expect(out).toContain('"proguard-rules.pro"');
  });

  test("ikinci kez uygulanınca değişmez", () => {
    const once = swapDefaultProguardFile(gradle);
    expect(swapDefaultProguardFile(once)).toBe(once);
  });

  test("çapa yoksa sessiz geçmez, hata fırlatır", () => {
    expect(() => swapDefaultProguardFile("release { }")).toThrow(/withAndroidR8/);
  });
});

describe("pinAgpVersion", () => {
  const root = [
    "dependencies {",
    "    classpath('com.android.tools.build:gradle')",
    "    classpath('com.facebook.react:react-native-gradle-plugin')",
    "}",
  ].join("\n");

  test("sürümsüz AGP classpath'ine en son yamayı yazar, diğerlerine dokunmaz", () => {
    const out = pinAgpVersion(root, AGP_VERSION);
    expect(out).toContain(`classpath('com.android.tools.build:gradle:${AGP_VERSION}')`);
    expect(out).toContain("classpath('com.facebook.react:react-native-gradle-plugin')");
  });

  test("ikinci kez uygulanınca değişmez", () => {
    const once = pinAgpVersion(root, AGP_VERSION);
    expect(pinAgpVersion(once, AGP_VERSION)).toBe(once);
  });

  test("Play r8.json'u yalnız yamalı sürümde okur: .0 yaması olamaz", () => {
    expect(AGP_VERSION).toMatch(/^8\.\d+\.[1-9]\d*$/);
  });

  test("çapa yoksa sessiz geçmez, hata fırlatır", () => {
    expect(() => pinAgpVersion("dependencies { }", AGP_VERSION)).toThrow(/withAndroidR8/);
  });
});

describe("mergeKeepRules", () => {
  const base = "# şablon\n-keep class com.swmansion.reanimated.** { *; }\n";

  test("bloğu ekler ve mevcut içeriği korur", () => {
    const out = mergeKeepRules(base, "-keepnames class A");
    expect(out.startsWith(base.trimEnd())).toBe(true);
    expect(out).toContain("-keepnames class A");
    expect(count(out, BEGIN)).toBe(1);
    expect(count(out, END)).toBe(1);
  });

  test("iki kez uygulanınca aynı çıktı", () => {
    const once = mergeKeepRules(base, "-keepnames class A");
    expect(mergeKeepRules(once, "-keepnames class A")).toBe(once);
  });

  test("kurallar değişince blok yerinde yenilenir", () => {
    const once = mergeKeepRules(base, "-keepnames class A");
    const twice = mergeKeepRules(once, "-keepnames class B");
    expect(twice).toContain("-keepnames class B");
    expect(twice).not.toContain("-keepnames class A");
    expect(count(twice, BEGIN)).toBe(1);
  });
});

describe("setGradleProperty", () => {
  test("var olanı günceller, olmayanı ekler, yineleme üretmez", () => {
    const props = [
      { type: "comment", value: "x" },
      { type: "property", key: "org.gradle.jvmargs", value: "-Xmx2048m" },
    ];
    setGradleProperty(props, "org.gradle.jvmargs", "-Xmx4g");
    setGradleProperty(props, "android.r8.optimizedResourceShrinking", "true");
    setGradleProperty(props, "android.r8.optimizedResourceShrinking", "true");
    const keys = props.filter((p) => p.type === "property").map((p) => p.key);
    expect(keys).toEqual(["org.gradle.jvmargs", "android.r8.optimizedResourceShrinking"]);
    expect(props[1].value).toBe("-Xmx4g");
  });
});

describe("native/android-r8/keep-rules.pro", () => {
  const rules = fs
    .readFileSync(RULES_SRC, "utf8")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  test("Play oranlarını düşüren global bayrak yok", () => {
    for (const flag of ["-dontobfuscate", "-dontoptimize", "-dontshrink"]) {
      expect(rules.some((l) => l.startsWith(flag))).toBe(false);
    }
  });

  test("tüm sınıfları koruyan geniş kural yok", () => {
    expect(rules.some((l) => /-keep\S*\s+class\s+\*\*/.test(l))).toBe(false);
  });

  test("simge takma adlarının dayandığı MainActivity adı korunur", () => {
    expect(rules).toContain("-keepnames class com.smlztrk.seelogd.MainActivity");
  });
});

describe("native/android-r8/res/raw/seelogd_keep.xml", () => {
  test("Play Billing kayıt dosyaları kaynak küçültmeye karşı korunur", () => {
    const xml = fs.readFileSync(KEEP_RES_SRC, "utf8");
    expect(xml).toMatch(/tools:keep="[^"]*@raw\/com_android_billingclient_heterodyne_info/);
    expect(xml).toMatch(/tools:keep="[^"]*@raw\/com_android_billingclient_registration_info/);
    // Joker karakterli geniş koruma, kaynak küçültmeyi boşa çıkarır.
    expect(xml).not.toMatch(/tools:keep="[^"]*\*/);
  });
});

describe("app.json", () => {
  const plugins = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "app.json"), "utf8")).expo.plugins;
  const entry = (name) => plugins.find((p) => (Array.isArray(p) ? p[0] : p) === name);

  test("expo-build-properties sürüm derlemesinde R8 ve kaynak küçültmeyi açar", () => {
    const bp = entry("expo-build-properties");
    expect(Array.isArray(bp)).toBe(true);
    expect(bp[1].android.enableMinifyInReleaseBuilds).toBe(true);
    expect(bp[1].android.enableShrinkResourcesInReleaseBuilds).toBe(true);
  });

  test("withAndroidR8 kayıtlı", () => {
    expect(entry("./plugins/withAndroidR8.js")).toBeDefined();
  });
});
