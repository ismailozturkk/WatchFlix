// utils/afterInteractions.js + "InteractionManager geri gelmesin" bekçisi.
const fs = require("fs");
const path = require("path");
const { runAfterInteractions } = require("../utils/afterInteractions");

describe("runAfterInteractions", () => {
  const realIdle = globalThis.requestIdleCallback;
  const realCancel = globalThis.cancelIdleCallback;
  afterEach(() => {
    globalThis.requestIdleCallback = realIdle;
    globalThis.cancelIdleCallback = realCancel;
    jest.useRealTimers();
  });

  test("requestIdleCallback varsa onu zaman aşımıyla kullanır", () => {
    const calls = [];
    globalThis.requestIdleCallback = jest.fn((cb, opts) => { calls.push(opts); cb(); return 7; });
    const task = jest.fn();
    runAfterInteractions(task, { timeout: 300 });
    expect(task).toHaveBeenCalledTimes(1);
    expect(calls[0]).toEqual({ timeout: 300 });
  });

  test("iptal edilen iş çalışmaz ve idle kaydı silinir", () => {
    let pending = null;
    globalThis.requestIdleCallback = jest.fn((cb) => { pending = cb; return 3; });
    globalThis.cancelIdleCallback = jest.fn();
    const task = jest.fn();
    const handle = runAfterInteractions(task);
    handle.cancel();
    pending();
    expect(task).not.toHaveBeenCalled();
    expect(globalThis.cancelIdleCallback).toHaveBeenCalledWith(3);
  });

  test("requestIdleCallback yoksa setTimeout'a düşer", () => {
    globalThis.requestIdleCallback = undefined;
    jest.useFakeTimers();
    const task = jest.fn();
    const handle = runAfterInteractions(task);
    expect(task).not.toHaveBeenCalled();
    jest.runAllTimers();
    expect(task).toHaveBeenCalledTimes(1);
    expect(typeof handle.cancel).toBe("function");
  });
});

describe("InteractionManager bekçisi", () => {
  // RN 0.86'da InteractionManager koçan: runAfterInteractions beklemiyor.
  // Yeni kod utils/afterInteractions kullanmalı.
  const ROOTS = ["App.js", "components", "screens", "hooks", "context", "utils", "services"];
  const files = [];
  const walk = (p) => {
    const abs = path.join(__dirname, "..", p);
    if (!fs.existsSync(abs)) return;
    if (fs.statSync(abs).isFile()) { if (abs.endsWith(".js")) files.push(abs); return; }
    for (const name of fs.readdirSync(abs)) walk(path.join(p, name));
  };
  ROOTS.forEach(walk);

  test("kaynakta InteractionManager çağrısı/içe aktarımı yok", () => {
    const offenders = files.filter((f) => {
      const code = fs.readFileSync(f, "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
      return /\bInteractionManager\b/.test(code);
    });
    expect(offenders.map((f) => path.relative(path.join(__dirname, ".."), f))).toEqual([]);
  });
});
