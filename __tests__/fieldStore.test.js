import React from "react";
import { act, create } from "react-test-renderer";
import { createFieldStore, useFields } from "../utils/fieldStore";

function Probe({ store, keys, onRender }) {
  const fields = useFields(store, keys);
  onRender(fields);
  return null;
}

describe("fieldStore / useFields", () => {
  test("yalnız seçilen alan değişince yeniden render eder", () => {
    const store = createFieldStore({ a: 1, b: 1 });
    const renders = [];
    act(() => {
      create(<Probe store={store} keys={["a"]} onRender={(f) => renders.push(f)} />);
    });
    expect(renders).toHaveLength(1);

    act(() => store.set({ a: 1, b: 2 })); // b değişti → render yok
    expect(renders).toHaveLength(1);

    act(() => store.set({ a: 5, b: 2 }));
    expect(renders).toHaveLength(2);
    expect(renders[1].a).toBe(5);
  });

  test("fonksiyon alanı sabit sarmalayıcıdır ve EN GÜNCEL fonksiyonu çağırır", () => {
    const store = createFieldStore({ n: 1, get: () => "eski" });
    const renders = [];
    act(() => {
      create(<Probe store={store} keys={["get"]} onRender={(f) => renders.push(f)} />);
    });
    const first = renders[0].get;
    expect(first()).toBe("eski");

    // Yalnız fonksiyon kimliği değişti → render yok, ama çağrı yeniye gider.
    act(() => store.set({ n: 2, get: () => "yeni" }));
    expect(renders).toHaveLength(1);
    expect(first()).toBe("yeni");
  });
});
