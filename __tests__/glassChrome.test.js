// utils/glassChrome.js — "bu düğme/kutu/alan cama çevrilsin mi, nasıl?" kararı.
// Burada kilitlenen şey: hangi stiller cama DÖNMEZ (eski görünüm kalır), tonun
// dolgu renginden nasıl türediği, çerçevenin camda hep düşüp renginin tona
// taşınması, Android buzlu cam renkleri ve
// TextInput stilinin kutu / yazı olarak bölünmesi.
import {
  clampRadius,
  formatColor,
  isNeutralBorder,
  isVividColor,
  parseColor,
  planGlassChrome,
  splitInputStyle,
  stripChrome,
  frostedAppearance,
  frostedFill,
  stateBorderColor,
  FROSTED_SURFACE_TINT_ALPHA,
  GLASS_ACCENT_TINT_ALPHA,
  GLASS_STATE_TINT_ALPHA,
  GLASS_SURFACE_TINT_ALPHA,
} from "../utils/glassChrome";

const THEME = { border: "rgba(255, 255, 255, 0.12)" };

describe("parseColor", () => {
  it.each([
    ["#fff", { r: 255, g: 255, b: 255, a: 1 }],
    ["#F00", { r: 255, g: 0, b: 0, a: 1 }],
    ["#336699", { r: 51, g: 102, b: 153, a: 1 }],
    ["#33669980", { r: 51, g: 102, b: 153, a: 0.502 }],
    ["rgb(10, 20, 30)", { r: 10, g: 20, b: 30, a: 1 }],
    ["rgba(10,20,30,0.25)", { r: 10, g: 20, b: 30, a: 0.25 }],
    ["transparent", { r: 0, g: 0, b: 0, a: 0 }],
    ["white", { r: 255, g: 255, b: 255, a: 1 }],
  ])("%s", (input, expected) => {
    expect(parseColor(input)).toEqual(expected);
  });

  it("çözümlenemeyen girdi null (animasyonlu değer, nesne, bilinmeyen ad)", () => {
    expect(parseColor({ __getValue: () => 1 })).toBeNull();
    expect(parseColor("hotpink")).toBeNull();
    expect(parseColor("#12345")).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe("planGlassChrome — cama DÖNMEYENLER", () => {
  it("köşesiz kutu", () => {
    expect(planGlassChrome({ backgroundColor: "#202020" })).toBeNull();
    expect(planGlassChrome({ backgroundColor: "#202020", borderRadius: 0 })).toBeNull();
  });

  it("dolgusuz ve çerçevesiz (yalın metin/ikon dokunuşu)", () => {
    expect(planGlassChrome({ borderRadius: 12, padding: 8 })).toBeNull();
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "transparent" })).toBeNull();
    expect(planGlassChrome({ borderRadius: 12, borderWidth: 1, borderColor: "transparent" })).toBeNull();
  });

  it("tam ekran örtü / arka plan", () => {
    expect(
      planGlassChrome({
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: 12, backgroundColor: "rgba(0,0,0,0.5)",
      }),
    ).toBeNull();
  });

  it("gizli (opaklık ~0) ya da kısık (devre dışı / yükleniyor) öğe: eski görünüm kalır", () => {
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "#222", opacity: 0 })).toBeNull();
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "#222", opacity: 0.45 })).toBeNull();
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "#222", opacity: 1 })).not.toBeNull();
  });

  it("kesikli çerçeve, animasyonlu/çözümlenemeyen renk, animasyonlu opaklık", () => {
    expect(planGlassChrome({ borderRadius: 12, borderWidth: 1, borderColor: "#fff", borderStyle: "dashed" })).toBeNull();
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: { __getValue: () => "#fff" } })).toBeNull();
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "#222", opacity: { __getValue: () => 1 } })).toBeNull();
  });

  it("geçersiz girdi", () => {
    expect(planGlassChrome(null)).toBeNull();
    expect(planGlassChrome(undefined)).toBeNull();
  });
});

describe("planGlassChrome — ton", () => {
  it("canlı (vurgu) dolgu → camın tonu, düğmede neredeyse opak", () => {
    const plan = planGlassChrome({ borderRadius: 14, backgroundColor: "#E50914" }, { role: "button" });
    expect(plan.tint).toBe(formatColor(parseColor("#E50914"), GLASS_ACCENT_TINT_ALPHA));
    expect(plan.scheme).toBeUndefined();
  });

  it("nötr yüzey dolgusu → hafif ton (cam yüzeyde kaybolmasın ama dolgu olmasın)", () => {
    const plan = planGlassChrome({ borderRadius: 14, backgroundColor: "#202020" });
    expect(plan.tint).toBe(formatColor(parseColor("#202020"), GLASS_SURFACE_TINT_ALPHA));
  });

  it("yarı saydam vurgu dolgusu (seçili çip) kendi opaklığını korur, alt sınır 0.2", () => {
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "rgba(229, 9, 20, 0.4)" }).tint)
      .toBe("rgba(229, 9, 20, 0.4)");
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "rgba(229, 9, 20, 0.05)" }).tint)
      .toBe("rgba(229, 9, 20, 0.2)");
  });

  it("çok şeffaf nötr dolgu → ton yok (cam zaten şeffaf)", () => {
    expect(planGlassChrome({ borderRadius: 12, backgroundColor: "rgba(255,255,255,0.06)" }).tint).toBeUndefined();
  });

  it("koyu yarı saydam örtü (poster üstü düğme) → koyu cam", () => {
    const plan = planGlassChrome({ borderRadius: 20, backgroundColor: "rgba(0,0,0,0.45)" });
    expect(plan.scheme).toBe("dark");
    expect(plan.tint).toBe("rgba(0, 0, 0, 0.45)");
  });

  it("yalnız çerçeveli (dolgusuz) düğme → tonsuz cam", () => {
    const plan = planGlassChrome({ borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" });
    expect(plan).not.toBeNull();
    expect(plan.tint).toBeUndefined();
  });

  it("ton zorlanabilir", () => {
    const plan = planGlassChrome({ borderRadius: 14, backgroundColor: "#202020" }, { tint: "rgba(1, 2, 3, 0.3)" });
    expect(plan.tint).toBe("rgba(1, 2, 3, 0.3)");
  });
});

describe("planGlassChrome — çerçeve", () => {
  it("tema çerçevesi nötr → düşer, cam katmanı çerçeve kalınlığı kadar dışa taşar", () => {
    const plan = planGlassChrome(
      { borderRadius: 14, backgroundColor: "#202020", borderWidth: 1.5, borderColor: "rgba(255, 255, 255, 0.12)" },
      { theme: THEME },
    );
    expect(plan.dropBorder).toBe(true);
    expect(plan.inset).toBe(1.5);
  });

  // Cam basınca esneyip büyür/küçülür; RN çerçevesi yerinde sabit kalır ve camın
  // çevresinde ondan kopuk ikinci bir halka olarak görünür. Bu yüzden camda HİÇBİR
  // çerçeve çizilmez; durum rengi tona (ve buzlu camda kenar ışığına) geçer.
  it("vurgu rengi çerçeve (seçili durum) de düşer; rengi tona ve `rim`e taşınır", () => {
    const plan = planGlassChrome(
      { borderRadius: 14, backgroundColor: "#202020", borderWidth: 1.5, borderColor: "#E50914" },
      { theme: THEME },
    );
    expect(plan.dropBorder).toBe(true);
    expect(plan.inset).toBe(1.5);
    expect(plan.tint).toBe(formatColor(parseColor("#E50914"), GLASS_STATE_TINT_ALPHA));
    expect(plan.rim).toBe("rgba(229, 9, 20, 1)");
  });

  it("yarı saydam durum çerçevesinin tonu kendi alfasıyla orantılı (alt sınırlı)", () => {
    const plan = planGlassChrome(
      { borderRadius: 18, backgroundColor: "#202020", borderWidth: 1, borderColor: "rgba(229, 9, 20, 0.55)" },
      { theme: THEME },
    );
    expect(plan.tint).toBe(formatColor(parseColor("#E50914"), 0.165));
  });

  it("dolgu zaten canlıysa ton dolgudan gelir (çerçeve rengi tonu ezmez)", () => {
    const plan = planGlassChrome(
      { borderRadius: 18, backgroundColor: "rgba(59, 130, 246, 0.16)", borderWidth: 1, borderColor: "#3B82F6" },
      { theme: THEME },
    );
    expect(plan.tint).toBe("rgba(59, 130, 246, 0.2)");
    expect(plan.rim).toBe("rgba(59, 130, 246, 1)");
    expect(plan.dropBorder).toBe(true);
  });

  it("nötr çerçevede `rim` yok", () => {
    const plan = planGlassChrome(
      { borderRadius: 14, backgroundColor: "#202020", borderWidth: 1, borderColor: THEME.border },
      { theme: THEME },
    );
    expect(plan.rim).toBeUndefined();
  });

  it("isNeutralBorder", () => {
    const themeBorder = parseColor("#333333");
    expect(isNeutralBorder(parseColor("#333333"), themeBorder)).toBe(true);
    expect(isNeutralBorder(parseColor("rgba(255,255,255,0.1)"), themeBorder)).toBe(true);
    expect(isNeutralBorder(parseColor("#E50914"), themeBorder)).toBe(false);
    expect(isNeutralBorder(null, themeBorder)).toBe(true);
  });
});

describe("stripChrome", () => {
  it("dolgu, gölge, opaklık düşer; yerleşim ve çerçeve kalınlığı kalır", () => {
    const flat = {
      backgroundColor: "#202020", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)",
      shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 4,
      opacity: 1, paddingHorizontal: 16, height: 48, alignItems: "center",
    };
    const plan = planGlassChrome(flat, { theme: THEME });
    expect(stripChrome(flat, plan)).toEqual({
      borderRadius: 14, borderWidth: 1, borderColor: "transparent",
      paddingHorizontal: 16, height: 48, alignItems: "center",
    });
  });

  it("basılı-durum saydamlığı (fonksiyon stilin pressed dalı) cam yolunda düşer", () => {
    const plan = planGlassChrome({ backgroundColor: "#E50914", borderRadius: 14 });
    expect(stripChrome({ backgroundColor: "#E50914", borderRadius: 14, opacity: 0.8 }, plan).opacity).toBeUndefined();
  });

  it("anlamlı çerçeve rengi de saydamlaşır (kalınlık korunur)", () => {
    const flat = { backgroundColor: "#202020", borderRadius: 14, borderWidth: 2, borderColor: "#E50914" };
    const plan = planGlassChrome(flat, { theme: THEME });
    expect(stripChrome(flat, plan)).toEqual({ borderRadius: 14, borderWidth: 2, borderColor: "transparent" });
  });

  it("buzlu camda (keepOpacity) basılı-durum saydamlığı korunur", () => {
    const flat = { backgroundColor: "#202020", borderRadius: 14, opacity: 0.7 };
    const plan = planGlassChrome({ ...flat, opacity: 1 }, { theme: THEME });
    expect(stripChrome(flat, plan, { keepOpacity: true }).opacity).toBe(0.7);
    expect(stripChrome(flat, plan).opacity).toBeUndefined();
  });
});

describe("Android buzlu cam", () => {
  it("opak nötr yüzey camdakinden daha opak kalır (arkada blur yok)", () => {
    const flat = { borderRadius: 14, backgroundColor: "#202020" };
    expect(planGlassChrome(flat, { frosted: true }).tint).toBe(
      formatColor(parseColor("#202020"), FROSTED_SURFACE_TINT_ALPHA),
    );
    expect(planGlassChrome(flat).tint).toBe(formatColor(parseColor("#202020"), GLASS_SURFACE_TINT_ALPHA));
  });

  it("frostedFill: opak nötr → buzlu opaklık; vurgu ve yarı saydam aynen", () => {
    expect(frostedFill("#202020")).toBe(formatColor(parseColor("#202020"), FROSTED_SURFACE_TINT_ALPHA));
    expect(frostedFill("#E50914")).toBe("rgba(229, 9, 20, 0.94)");
    expect(frostedFill("rgba(0,0,0,0.45)")).toBe("rgba(0, 0, 0, 0.45)");
    expect(frostedFill(undefined)).toBeUndefined();
  });

  it("frostedAppearance: canlı dolguda güçlü parlama; açık/koyu tema kenar ışığı; `rim` ezer", () => {
    expect(frostedAppearance({ fill: "#E50914" }).rim).toBe("rgba(255, 255, 255, 0.24)");
    expect(frostedAppearance({ fill: "#202020", scheme: "dark" }).rim).toBe("rgba(255, 255, 255, 0.13)");
    expect(frostedAppearance({ fill: "#F2F2F2", scheme: "light" }).rim).toBe("rgba(0, 0, 0, 0.08)");
    expect(frostedAppearance({ fill: "#202020", rim: "#3B82F6" }).rim).toBe("#3B82F6");
    expect(frostedAppearance({ fill: "#202020" }).sheen).toHaveLength(2);
  });

  it("stateBorderColor: yalnız canlı çerçeve durum sayılır", () => {
    expect(stateBorderColor("#3B82F6")).toBe("rgba(59, 130, 246, 1)");
    expect(stateBorderColor("rgba(255,255,255,0.12)")).toBeUndefined();
    expect(stateBorderColor("transparent")).toBeUndefined();
    expect(stateBorderColor(undefined)).toBeUndefined();
  });
});


describe("clampRadius", () => {
  it("hap (999) ölçülen boyutun yarısına iner; sığan köşe değişmez", () => {
    expect(clampRadius(999, 120, 44)).toBe(22);
    expect(clampRadius(14, 120, 44)).toBe(14);
  });
  it("ölçü yokken çağıranın yarıçapı", () => {
    expect(clampRadius(999, 0, 0)).toBe(999);
    expect(clampRadius(12, undefined, undefined)).toBe(12);
  });
});

describe("isVividColor", () => {
  it("vurgu canlı, gri / siyah / beyaz değil", () => {
    expect(isVividColor(parseColor("#E50914"))).toBe(true);
    expect(isVividColor(parseColor("#3B82F6"))).toBe(true);
    expect(isVividColor(parseColor("#202020"))).toBe(false);
    expect(isVividColor(parseColor("#FFFFFF"))).toBe(false);
    expect(isVividColor(parseColor("#000000"))).toBe(false);
  });
});

describe("splitInputStyle", () => {
  it("kutu (dolgu, çerçeve, köşe, boyut, kenar boşluğu) ile yazı (renk, punto, iç dolgu) ayrılır", () => {
    const { box, text } = splitInputStyle({
      backgroundColor: "#202020", borderColor: "#333", borderWidth: 1, borderRadius: 14,
      height: 48, marginBottom: 12, flex: 1,
      color: "#fff", fontSize: 15, textAlign: "left", paddingHorizontal: 14, paddingVertical: 12,
    });
    expect(Object.keys(box).sort()).toEqual(
      ["backgroundColor", "borderColor", "borderRadius", "borderWidth", "flex", "height", "marginBottom"].sort(),
    );
    expect(Object.keys(text).sort()).toEqual(["color", "fontSize", "paddingHorizontal", "paddingVertical", "textAlign"].sort());
  });

  it("boş / null stil", () => {
    expect(splitInputStyle(undefined)).toEqual({ box: {}, text: {} });
  });
});
