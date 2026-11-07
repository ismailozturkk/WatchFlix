// Paylaşılan bölüm grafiğinin ızgarası (components/tv/TvGraphSnapshot.js): plan ne derse onu çizer —
// her bölüm bir kare, kısa sezonun eksik satırları boşluk, kayan şeritte bölümler `perLine`da alta geçer.
import React from "react";
import { act, create } from "react-test-renderer";
import TvGraphSnapshot from "../components/tv/TvGraphSnapshot";
import { planTvGraphLayout } from "../utils/tvGraphShare";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => ({
  StyleSheet: { create: (styles) => styles, hairlineWidth: 1 },
  Text: "Text",
  View: "View",
}));
// Babel eklentisi Text'i AppText'e çevirir (tipografi katmanı); burada düz Text yeter.
jest.mock("../components/typography/AppText", () => ({ AppText: "Text" }));

const seasonsOf = (lengths) => lengths.map((n, i) => ({ s: i + 1, r: Array.from({ length: n }, (_, e) => (e === 0 ? 0 : 8.4)) }));
const renderPlan = (seasons, box) => {
  const plan = planTvGraphLayout(seasons, box);
  let renderer;
  act(() => {
    renderer = create(<TvGraphSnapshot seasons={seasons} plan={plan} />);
  });
  return { plan, root: renderer.root };
};
const cellsOf = (root, size) =>
  root.findAll((node) => node.type === "View" && node.props.style?.width === size && node.props.style?.backgroundColor);

it("klasik düzen: her bölüm bir kare, puan ve puansız '–' yazılır", () => {
  const seasons = seasonsOf([10, 10, 7]);
  const { plan, root } = renderPlan(seasons, { width: 340, maxHeight: 480 });
  expect(plan.mode).toBe("columns");
  expect(cellsOf(root, plan.cell)).toHaveLength(27);
  const texts = root.findAll((node) => node.type === "Text").map((node) => node.props.children);
  expect(texts).toEqual(expect.arrayContaining(["S1", "S3", "8.4", "–"]));
});

it("kayan şerit: uzun sezon perLine'da alta geçer, kare sayısı korunur", () => {
  const seasons = seasonsOf([60, 58]);
  const { plan, root } = renderPlan(seasons, { width: 236, maxHeight: 320 });
  expect(plan.mode).toBe("rows");
  expect(cellsOf(root, plan.cell)).toHaveLength(118);
  expect(root.findByProps({ testID: "tvgraph-snapshot-rows" })).toBeTruthy();
});

it("çok satıra bölünen sezonda etiket ilk yatay satırın sol üstünde kalır", () => {
  const seasons = seasonsOf([18, 14]);
  const { plan, root } = renderPlan(seasons, {
    width: 282,
    maxHeight: 320,
    layoutMode: "rows",
    episodesPerRow: 10,
  });
  expect(plan.lines).toEqual([2, 2]);
  const firstSeason = root.findByProps({ testID: "tvgraph-season-row-1" });
  const style = Object.assign({}, ...[].concat(firstSeason.props.style).filter(Boolean));
  expect(style).toMatchObject({ flexDirection: "row", alignItems: "flex-start" });
});
