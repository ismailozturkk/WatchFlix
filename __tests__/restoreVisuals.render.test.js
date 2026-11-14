// __tests__/restoreVisuals.render.test.js
// İçe aktarma ekranının hareketli parçaları hatasız çizilir (hareket açık ve kapalı); bölüm satırı dokunuşu iletir.
import React from "react";
import { act, create } from "react-test-renderer";

jest.mock("react-native", () => {
  const React = require("react");
  const resolve = (style, state) => (typeof style === "function" ? style(state) : style);
  return {
    View: "View",
    Text: "Text",
    Pressable: ({ style, children, ...rest }) =>
      React.createElement("Pressable", { ...rest, style: resolve(style, { pressed: false }) }, children),
    StyleSheet: { create: (s) => s, absoluteFill: { position: "absolute" }, absoluteFillObject: { position: "absolute" }, hairlineWidth: 1 },
  };
});
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));
jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const anim = new Proxy({}, { get: () => () => anim });
  const AView = ({ children, entering: _e, exiting: _x, layout: _l, ...rest }) => React.createElement("AnimatedView", rest, children);
  return {
    __esModule: true,
    default: { View: AView, Text: "Text" },
    Easing: new Proxy({}, { get: () => () => (x) => x }),
    FadeIn: anim,
    FadeInDown: anim,
    ZoomIn: anim,
    cancelAnimation: () => {},
    useSharedValue: (v) => ({ value: v }),
    useAnimatedStyle: (fn) => fn(),
    withRepeat: (a) => a,
    withSpring: (v) => v,
    withTiming: (v) => v,
    withDelay: (_d, a) => a,
    withSequence: (...a) => a[a.length - 1],
  };
});
jest.mock("../components/AppIcon", () => ({ __esModule: true, default: "Icon" }));
jest.mock("../components/LensLoader", () => ({ __esModule: true, default: "LensLoader" }));
jest.mock("../components/import/ImportProgressView", () => ({ PosterThumb: "PosterThumb" }));

const V = require("../components/libraryImport/RestoreVisuals");

global.IS_REACT_ACT_ENVIRONMENT = true;
const C = new Proxy({}, { get: (_t, key) => (typeof key === "string" ? "#123456" : undefined) });

const renderAll = (reduceMotion) => {
  const onToggle = jest.fn();
  let r;
  act(() => {
    r = create(
      <>
        {["idle", "busy", "done", "error"].map((mode) => (
          <V.RestoreOrb key={mode} C={C} mode={mode} reduceMotion={reduceMotion} />
        ))}
        <V.StageList
          C={C}
          reduceMotion={reduceMotion}
          progressText={(d, t) => `${d}/${t}`}
          stages={[
            { id: "matching", label: "Eşleşiyor", status: "done", done: 2, total: 2 },
            { id: "saving", label: "Kaydediliyor", status: "active", done: 1, total: 2 },
            { id: "comments", label: "Yorumlar", status: "pending", done: 0, total: 0 },
          ]}
        />
        <V.SectionToggle C={C} icon="film-outline" tone={["#111", "#222"]} title="3 film" amount={3} ratio={0.5} selected index={0} reduceMotion={reduceMotion} onToggle={onToggle} />
        <V.PosterFan posters={["/a.jpg", "/b.jpg", "/c.jpg"]} theme={{}} reduceMotion={reduceMotion} />
        <V.SummaryTiles C={C} reduceMotion={reduceMotion} items={[{ id: "t", value: 12, label: "Yapım" }]} />
        <V.ProgressBar C={C} ratio={0.4} reduceMotion={reduceMotion} />
      </>,
    );
  });
  return { r, onToggle };
};

it.each([true, false])("hareket azaltma=%s: hepsi çizilir", (reduceMotion) => {
  const spy = jest.spyOn(console, "error").mockImplementation(() => {});
  const { r, onToggle } = renderAll(reduceMotion);
  const pressables = r.root.findAllByType("Pressable");
  expect(pressables.length).toBeGreaterThan(0);
  act(() => pressables[0].props.onPress());
  expect(onToggle).toHaveBeenCalled();
  const json = JSON.stringify(r.toJSON());
  expect(json).toContain("3 film");
  expect(json).toContain("Kaydediliyor");
  act(() => r.unmount());
  const real = spy.mock.calls.filter(([m]) => !String(m).includes("react-test-renderer is deprecated"));
  spy.mockRestore();
  expect(real).toEqual([]);
});
