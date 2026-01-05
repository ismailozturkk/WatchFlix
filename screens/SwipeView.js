import React, { useRef } from "react";
import { View, StyleSheet, Animated, Alert } from "react-native";
import LottieView from "lottie-react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import { ChatModal } from "../components/ChatModal";
import Toast from "react-native-toast-message";
import { useNavigation } from "@react-navigation/native";
const AnimatedLottieView = Animated.createAnimatedComponent(LottieView);

const SwipeView = () => {
  const navigation = useNavigation();
  const translateX = useRef(new Animated.Value(0)).current;

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = ({ nativeEvent }) => {
    // Kaydırma hareketi bitmeden 50px geçilip geçilmediğini kontrol et
    if (
      (nativeEvent.translationX < -50 && translateX.__getValue() <= -50) ||
      (nativeEvent.translationX > 50 && translateX.__getValue() >= 50)
    ) {
      tetiklenecekFonksiyon();
    }

    // Kaydırma bittiğinde animasyonu sıfırla
    if (nativeEvent.state === State.END) {
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  };

  const tetiklenecekFonksiyon = () => {
    navigation.navigate("TabScreen");
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      style={{}}
    >
      <Animated.View
        style={{ backgroundColor: "red", transform: [{ translateX }] }}
      >
        <ChatModal />
      </Animated.View>
    </PanGestureHandler>
  );
};

export default SwipeView;
