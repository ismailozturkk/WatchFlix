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

describe("yeni madde ve işaretleme sırası", () => {
  const { addTodoOnTop, toggleTodoItem } = require("../utils/todoOrder");
  const ids = (list) => list.map((item) => item.id);

  test("yeni madde yapılacakların en üstüne gelir", () => {
    const next = addTodoOnTop(items, { id: "n", text: "yeni", done: false });
    expect(ids(next)).toEqual(["n", "a", "d1", "b", "d2", "c"]);
    // Görünen gruplar: yapılacaklarda en başta, yapılanlar etkilenmez.
    expect(ids(next.filter((item) => !item.done))).toEqual(["n", "a", "b", "c"]);
    expect(ids(next.filter((item) => item.done))).toEqual(["d1", "d2"]);
  });

  test("boş/geçersiz listeye eklenir", () => {
    expect(ids(addTodoOnTop(undefined, { id: "x" }))).toEqual(["x"]);
  });

  test("tamamlanan madde yapılanların EN ÜSTÜNE gelir", () => {
    const next = toggleTodoItem(items, "c");
    expect(next.find((item) => item.id === "c").done).toBe(true);
    expect(ids(next.filter((item) => item.done))).toEqual(["c", "d1", "d2"]);
    expect(ids(next.filter((item) => !item.done))).toEqual(["a", "b"]);
  });

  test("tamamlanmışı geri alınca yapılacakların en üstüne gelir", () => {
    const next = toggleTodoItem(items, "d2");
    expect(next.find((item) => item.id === "d2").done).toBe(false);
    expect(ids(next.filter((item) => !item.done))).toEqual(["d2", "a", "b", "c"]);
    expect(ids(next.filter((item) => item.done))).toEqual(["d1"]);
  });

  test("hedef grup boşken madde sona girer; tek madde de çalışır", () => {
    const active = [
      { id: "a", done: false },
      { id: "b", done: false },
    ];
    expect(ids(toggleTodoItem(active, "a"))).toEqual(["b", "a"]);
    expect(toggleTodoItem([{ id: "z", done: false }], "z")).toEqual([{ id: "z", done: true }]);
  });

  test("bilinmeyen id listeyi değiştirmez; girdi bozulmaz", () => {
    expect(toggleTodoItem(items, "yok")).toBe(items);
    const snapshot = JSON.stringify(items);
    toggleTodoItem(items, "b");
    addTodoOnTop(items, { id: "q" });
    expect(JSON.stringify(items)).toBe(snapshot);
  });
});
