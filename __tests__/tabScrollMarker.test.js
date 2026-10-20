// __tests__/tabScrollMarker.test.js
//
// TabScrollMarker: iOS sekme çubuğunun "aşağı kaydırınca küçül" davranışı için
// kaydırma görünümünü işaretleyiciyle sarar. Asıl risk SARMAMAK GEREKEN yerlerde
// (Android, yerel sekme yok, modül yüklenemedi) sarmaya çalışıp uygulamayı
// kırmak — bu testin çoğu o dört durumu sabitliyor.
//
// İşaretleyici modül yüklenirken (require) çözüldüğü için her durum izole bir
// modül kaydında kuruluyor.

import React from "react";
import { act, create } from "react-test-renderer";

global.IS_REACT_ACT_ENVIRONMENT = true;

function yukle({ os = "ios", nativeTabsAvailable = true, isaretleyici = "var" } = {}) {
  let modul;
  jest.isolateModules(() => {
    jest.doMock("react-native", () => ({
      Platform: { OS: os },
      StyleSheet: { create: (stiller) => stiller },
    }));
    jest.doMock("../services/tabBarCapabilities", () => ({
      tabBarNativeSupport: { nativeTabsAvailable },
    }));
    if (isaretleyici === "patlar") {
      jest.doMock("react-native-screens/experimental", () => {
        throw new Error("yerel modül yok");
      });
    } else if (isaretleyici === "ihracatsiz") {
      jest.doMock("react-native-screens/experimental", () => ({}));
    } else {
      jest.doMock("react-native-screens/experimental", () => ({ ScrollViewMarker: "ScrollViewMarker" }));
    }
    modul = require("../components/navigation/TabScrollMarker");
  });
  return modul;
}

let hata;
beforeEach(() => {
  const asil = console.error;
  hata = jest.spyOn(console, "error").mockImplementation((mesaj, ...args) => {
    if (String(mesaj).includes("react-test-renderer is deprecated")) return;
    asil(mesaj, ...args);
  });
});
afterEach(() => hata.mockRestore());
afterAll(() => jest.dontMock("react-native"));

async function ciz(element) {
  let renderer;
  await act(() => {
    renderer = create(element);
  });
  const json = renderer.toJSON();
  await act(() => renderer.unmount());
  return json;
}

describe("TabScrollMarker", () => {
  it("iOS + yerel sekmeler varken çocuğu tek bir işaretleyiciyle sarar", async () => {
    const { default: TabScrollMarker } = yukle();
    const json = await ciz(
      <TabScrollMarker>
        <scroll testID="liste" />
      </TabScrollMarker>,
    );
    expect(json.type).toBe("ScrollViewMarker");
    // Tek ve doğrudan çocuk (işaretleyici başka bir şeyi çözemez).
    expect(json.children).toHaveLength(1);
    expect(json.children[0].type).toBe("scroll");
    // Ekranı doldurmalı, yoksa kaydırma görünümü sıfır yüksekliğe çöker.
    expect(json.props.style).toEqual({ flex: 1 });
    // Üst kenar efekti kapalı: ekranların mevcut görünümü korunuyor.
    expect(json.props.scrollEdgeEffects).toEqual({ top: "hidden" });
  });

  it.each([
    ["Android", { os: "android" }],
    ["yerel sekme yok", { nativeTabsAvailable: false }],
    ["işaretleyici modülü yüklenemiyor", { isaretleyici: "patlar" }],
    ["modül var ama ScrollViewMarker ihraç etmiyor", { isaretleyici: "ihracatsiz" }],
  ])("%s: çocuğu AYNEN döndürür, sarmaz", async (_ad, secenek) => {
    const { default: TabScrollMarker } = yukle(secenek);
    const json = await ciz(
      <TabScrollMarker>
        <scroll testID="liste" />
      </TabScrollMarker>,
    );
    expect(json.type).toBe("scroll");
    expect(json.props.testID).toBe("liste");
  });

  it("Android'de deneyi hiç yüklemeye çalışmaz", () => {
    const yuklenen = jest.fn(() => ({ ScrollViewMarker: "ScrollViewMarker" }));
    jest.isolateModules(() => {
      jest.doMock("react-native", () => ({ Platform: { OS: "android" }, StyleSheet: { create: (s) => s } }));
      jest.doMock("../services/tabBarCapabilities", () => ({ tabBarNativeSupport: { nativeTabsAvailable: true } }));
      jest.doMock("react-native-screens/experimental", yuklenen);
      require("../components/navigation/TabScrollMarker");
    });
    expect(yuklenen).not.toHaveBeenCalled();
  });
});

describe("markTabScroll", () => {
  it("prop'ları ve ref'i içteki kaydırma bileşenine iletir, işaretleyiciyle sarar", async () => {
    const { markTabScroll } = yukle();
    const yakalanan = {};
    const Ic = React.forwardRef(function Ic(props, ref) {
      yakalanan.ref = ref;
      yakalanan.props = props;
      return <inner data-id="ic" />;
    });
    const Isaretli = markTabScroll(Ic);
    const ref = React.createRef();
    const json = await ciz(<Isaretli ref={ref} contentContainerStyle={{ paddingBottom: 9 }} onScroll={() => {}} />);
    expect(json.type).toBe("ScrollViewMarker");
    expect(json.children).toHaveLength(1);
    expect(yakalanan.ref).toBe(ref);
    expect(yakalanan.props.contentContainerStyle).toEqual({ paddingBottom: 9 });
    expect(typeof yakalanan.props.onScroll).toBe("function");
  });

  it("işaretleyici yokken yalnız içteki bileşeni çizer", async () => {
    const { markTabScroll } = yukle({ os: "android" });
    const Ic = () => <inner />;
    const Isaretli = markTabScroll(Ic);
    const json = await ciz(<Isaretli />);
    expect(json.type).toBe("inner");
  });

  it("görünen ad ayıklamada anlamlı", () => {
    const { markTabScroll } = yukle();
    function KaydirmaListesi() {
      return null;
    }
    expect(markTabScroll(KaydirmaListesi).displayName).toBe("Marked(KaydirmaListesi)");
  });
});
