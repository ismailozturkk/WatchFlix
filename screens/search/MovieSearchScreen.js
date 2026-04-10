// SearchScreen.js
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  TextInput,
  View,
  Pressable,
  Dimensions,
} from "react-native";

const { height } = Dimensions.get("window");

export default function MovieSearchScreen({ navigation }) {
  const translateY = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    // Ekran açıldığında yukarıdan aşağı iner
    Animated.spring(translateY, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 4,
    }).start();
  }, []);

  const handleClose = () => {
    // Kapanırken yukarı kaçar
    Animated.timing(translateY, {
      toValue: -120,
      duration: 200,
      useNativeDriver: true,
    }).start(() => navigation.goBack());
  };

  return (
    <View style={styles.fullScreen}>
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <Animated.View
        style={[styles.searchBar, { transform: [{ translateY }] }]}
      >
        <TextInput
          autoFocus
          placeholder="Film veya dizi ara..."
          placeholderTextColor="#888"
          style={styles.input}
        />
      </Animated.View>
      {/* Burada arama sonuçlarını listeleyebilirsin */}
    </View>
  );
}

const styles = StyleSheet.create({
  fullScreen: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)" },
  backdrop: { ...StyleSheet.absoluteFillObject },
  searchBar: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    backgroundColor: "#121212",
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  input: {
    backgroundColor: "#333",
    color: "#fff",
    padding: 15,
    borderRadius: 10,
  },
});
