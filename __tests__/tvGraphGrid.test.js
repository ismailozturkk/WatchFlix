const {
  buildTvGraphGrid,
  TV_GRAPH_GAP_RATIO,
  TV_GRAPH_GRID_SIZES,
} = require("../utils/tvGraphGrid");

test("keeps episode-cell gaps proportional at every scale", () => {
  expect(TV_GRAPH_GRID_SIZES.default.margin).toBe(1.76);
  expect(TV_GRAPH_GRID_SIZES.compact.margin).toBe(1.2);
  expect(TV_GRAPH_GRID_SIZES.heatmap.margin).toBe(0.8);
  expect(TV_GRAPH_GRID_SIZES.default.margin / TV_GRAPH_GRID_SIZES.default.cell)
    .toBe(TV_GRAPH_GAP_RATIO);
  expect(TV_GRAPH_GRID_SIZES.compact.margin / TV_GRAPH_GRID_SIZES.compact.cell)
    .toBe(TV_GRAPH_GAP_RATIO);
  expect(buildTvGraphGrid({ cell: 75 }).margin).toBe(3);
});

test("only the smallest view moves cell labels to the axes", () => {
  const { default: large, compact, heatmap } = TV_GRAPH_GRID_SIZES;
  expect(large.cell).toBeGreaterThan(compact.cell);
  expect(compact.cell).toBeGreaterThan(heatmap.cell);
  for (const grid of [large, compact]) {
    expect(grid.showAxes).toBe(false);
    expect(grid.colorOnly).toBe(false);
  }
  expect(heatmap.showAxes).toBe(true);
  expect(heatmap.colorOnly).toBe(true);
  expect(heatmap.margin / heatmap.cell).toBe(TV_GRAPH_GAP_RATIO);
});
