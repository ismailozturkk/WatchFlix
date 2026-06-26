import React, { useRef, useState, useEffect, useCallback } from "react";
import { View, PanResponder } from "react-native";

const TRACK_H = 6;
const THUMB_D = 22;

/* IslamicGuide CustomSlider'dan uyarlanmıştır — panResponder yalnızca bir kez
   oluşturulur, canlı değerlere ref üzerinden erişir (jest ortada düşmez). */
export default function StorySlider({
  value,
  minimumValue,
  maximumValue,
  step = 1,
  onValueChange,
  onSlidingComplete,
  accentColor,
  trackColor,
  disabled = false,
  style,
}) {
  const widthRef = useRef(0);
  const dragStartXRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  const stableRef = useRef({
    minimumValue,
    maximumValue,
    step,
    disabled,
    onValueChange,
    onSlidingComplete,
  });
  useEffect(() => {
    stableRef.current = {
      minimumValue,
      maximumValue,
      step,
      disabled,
      onValueChange,
      onSlidingComplete,
    };
  });

  const snap = useCallback((x) => {
    const { minimumValue: min, maximumValue: max, step: s } = stableRef.current;
    const pct = Math.max(0, Math.min(1, x / Math.max(1, widthRef.current)));
    const raw = pct * (max - min) + min;
    const snapped = s > 0 ? Math.round((raw - min) / s) * s + min : raw;
    return Math.max(min, Math.min(max, snapped));
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !stableRef.current.disabled,
      onMoveShouldSetPanResponder: () => !stableRef.current.disabled,
      onPanResponderGrant: (e) => {
        setIsDragging(true);
        dragStartXRef.current = e.nativeEvent.locationX;
        stableRef.current.onValueChange?.(snap(e.nativeEvent.locationX));
      },
      onPanResponderMove: (_, g) => {
        stableRef.current.onValueChange?.(snap(dragStartXRef.current + g.dx));
      },
      onPanResponderRelease: (_, g) => {
        setIsDragging(false);
        const v = snap(dragStartXRef.current + g.dx);
        stableRef.current.onValueChange?.(v);
        stableRef.current.onSlidingComplete?.(v);
      },
      onPanResponderTerminate: () => setIsDragging(false),
    })
  ).current;

  const pct = Math.max(
    0,
    Math.min(
      1,
      (value - minimumValue) / Math.max(1, maximumValue - minimumValue)
    )
  );

  return (
    <View
      style={[
        { flex: 1, height: 36, justifyContent: "center", opacity: disabled ? 0.4 : 1 },
        style,
      ]}
      onLayout={(e) => {
        widthRef.current = e.nativeEvent.layout.width;
      }}
      {...panResponder.panHandlers}
    >
      <View
        style={{
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: trackColor,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct * 100}%`,
            borderRadius: TRACK_H / 2,
            backgroundColor: accentColor,
          }}
        />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: `${pct * 100}%`,
          marginLeft: -(THUMB_D / 2),
          width: THUMB_D,
          height: THUMB_D,
          borderRadius: THUMB_D / 2,
          backgroundColor: "#FFFFFF",
          borderWidth: 2.5,
          borderColor: accentColor,
          shadowColor: accentColor,
          shadowOpacity: isDragging ? 0.65 : 0.3,
          shadowRadius: isDragging ? 14 : 5,
          elevation: isDragging ? 10 : 3,
          transform: [{ scale: isDragging ? 1.2 : 1 }],
        }}
      />
    </View>
  );
}
