import { useCallback, useRef } from "react";
import {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

const PULL_THRESHOLD = 90;

export default function usePullToSearch(onTrigger) {
  const progress = useSharedValue(0);
  const isTriggering = useSharedValue(false);
  const triggerLocked = useRef(false);

  const triggerSearch = useCallback(() => {
    if (triggerLocked.current) return;

    triggerLocked.current = true;
    isTriggering.value = true;
    progress.value = withTiming(1, { duration: 100 });

    setTimeout(() => {
      onTrigger();
    }, 100);

    setTimeout(() => {
      progress.value = withSpring(0, { damping: 16, stiffness: 180 });
      isTriggering.value = false;
      triggerLocked.current = false;
    }, 500);
  }, [isTriggering, onTrigger, progress]);

  const onScroll = useAnimatedScrollHandler((event) => {
    if (isTriggering.value) return;

    const pullDistance = Math.max(0, -event.contentOffset.y);
    if (pullDistance > 0) {
      progress.value = Math.min(pullDistance / PULL_THRESHOLD, 1);
    } else if (progress.value > 0) {
      progress.value = withSpring(0, { damping: 16, stiffness: 180 });
    }
  });

  const animatedSearchStyle = useAnimatedStyle(() => ({
    borderRadius: interpolate(
      progress.value,
      [0, 1],
      [10, 16],
      Extrapolation.CLAMP,
    ),
    transform: [
      {
        scaleX: interpolate(
          progress.value,
          [0, 1],
          [1, 1.06],
          Extrapolation.CLAMP,
        ),
      },
      {
        scaleY: interpolate(
          progress.value,
          [0, 1],
          [1, 1.22],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  return {
    animatedSearchStyle,
    onScroll,
    triggerSearch,
  };
}
