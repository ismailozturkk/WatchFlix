const {
  buildTvGraphGrid,
  TV_GRAPH_GAP_RATIO,
  TV_GRAPH_GRID_SIZES,
} = require("../utils/tvGraphGrid");

test("keeps episode-cell gaps proportional at every scale", () => {
  expect(TV_GRAPH_GRID_SIZES.default.margin).toBe(2);
  expect(TV_GRAPH_GRID_SIZES.compact.margin).toBe(1.44);
  expect(TV_GRAPH_GRID_SIZES.default.margin / TV_GRAPH_GRID_SIZES.default.cell)
    .toBe(TV_GRAPH_GAP_RATIO);
  expect(TV_GRAPH_GRID_SIZES.compact.margin / TV_GRAPH_GRID_SIZES.compact.cell)
    .toBe(TV_GRAPH_GAP_RATIO);
  expect(buildTvGraphGrid({ cell: 75 }).margin).toBe(3);
});
