// StaggerItem `animate` sözleşmesi: ilk yükleme penceresi kapandıktan (veya
// "Hareketi Azalt" açıkken) bağlanan öğe 0 opaklıkla başlayıp solmamalı —
// doğrudan tam görünür çizilmeli ve hiç animasyon başlatmamalı. ESKİ DAVRANIŞ:
// bileşen her bağlanışta animasyon oynatıyordu; ızgarada arama yazılınca
// satırlar yeniden bağlanıp her tuşta posterler yeniden solıyordu.
import React from "react";
import { act, create } from "react-test-renderer";
import { Animated } from "react-native";
import StaggerItem from "../components/StaggerItem";

global.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock("react-native", () => {
  const React = require("react");
  class Value {
    constructor(v) {
      this.value = v;
    }
    interpolate() {
      return { interpolatedFrom: this };
    }
  }
  return {
    Animated: {
      Value,
      timing: jest.fn(() => ({ start: jest.fn() })),
      View: ({ children, style }) => <div style={style}>{children}</div>,
    },
  };
});

function mount(props) {
  Animated.timing.mockClear();
  let tree;
  act(() => {
    tree = create(
      <StaggerItem {...props}>
        <span>x</span>
      </StaggerItem>,
    );
  });
  // style = [kullanıcı stili, { opacity, transform }]
  const style = tree.root.findByType("div").props.style;
  const anim = style.find((s) => s && s.opacity);
  return { opacity: anim.opacity.value };
}

describe("StaggerItem animate", () => {
  test("animates in by default: starts transparent and runs a delayed timing", () => {
    const { opacity } = mount({ index: 3 });
    expect(opacity).toBe(0);
    expect(Animated.timing).toHaveBeenCalledTimes(1);
    expect(Animated.timing.mock.calls[0][1]).toMatchObject({
      toValue: 1,
      delay: 3 * 55,
      useNativeDriver: true,
    });
  });

  test("animate={false} renders fully visible and starts no animation", () => {
    const { opacity } = mount({ index: 3, animate: false });
    expect(opacity).toBe(1);
    expect(Animated.timing).not.toHaveBeenCalled();
  });

  test("custom step/maxStaggered cap the delay", () => {
    mount({ index: 40, step: 40, maxStaggered: 12 });
    expect(Animated.timing.mock.calls[0][1].delay).toBe(12 * 40);
  });
});
