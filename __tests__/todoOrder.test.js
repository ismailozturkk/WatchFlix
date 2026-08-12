const {
  getTodoMoveAvailability,
  moveTodoItem,
} = require("../utils/todoOrder");

const items = [
  { id: "a", done: false },
  { id: "d1", done: true },
  { id: "b", done: false },
  { id: "d2", done: true },
  { id: "c", done: false },
];

test("moves an item inside its visible todo group", () => {
  expect(moveTodoItem(items, "c", "up").map((item) => item.id)).toEqual([
    "a",
    "d1",
    "c",
    "d2",
    "b",
  ]);
});

test("does not move active items across completed items", () => {
  expect(moveTodoItem(items, "a", "up")).toBe(items);
  expect(moveTodoItem(items, "d2", "down")).toBe(items);
});

test("reports move controls for each status group", () => {
  expect(getTodoMoveAvailability(items, "b")).toEqual({
    canMoveUp: true,
    canMoveDown: true,
  });
  expect(getTodoMoveAvailability(items, "d1")).toEqual({
    canMoveUp: false,
    canMoveDown: true,
  });
});
