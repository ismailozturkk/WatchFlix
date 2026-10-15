import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ModalBlurBackdrop from "../common/ModalBlurBackdrop";
import UserAvatar from "../common/UserAvatar";
import { useTheme } from "../../context/ThemeContext";

const { width } = Dimensions.get("window");
const AVATAR_SIZE = Math.min(Math.round(width * 0.72), 280);

/**
 * AvatarPreviewModal
 * Instagram tarzi uzun basma ile acilan avatar onizleme modali.
 *
 * @param {object} props
 * @param {boolean} props.visible - Modal gorunurlugu
 * @param {Function} props.onClose - Modal kapandiginda cagrilacak fonksiyon
 * @param {any} props.source - Avatar gorsel kaynagi (URI veya require)
 * @param {boolean} [props.isCustomPhoto=false] - Kullanici ozel fotografi mi yoksa hazir avatar ikonu mu
 * @param {string} [props.displayName] - Kullanici gorunen adi
 * @param {string} [props.username] - Kullanici adi
 */
export default function AvatarPreviewModal({
  visible,
  onClose,
  source,
  isCustomPhoto = false,
  displayName,
  username,
}) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(visible);

  const scaleAnim = useRef(new Animated.Value(0.35)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const isClosingRef = useRef(false);

  const handleClose = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;

    Animated.parallel([
      Animated.timing(scaleAnim, {
        toValue: 0.7,
        duration: 160,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 160,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setMounted(false);
      isClosingRef.current = false;
      if (onClose) onClose();
    });
  }, [backdropAnim, opacityAnim, scaleAnim, onClose]);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      isClosingRef.current = false;
      scaleAnim.setValue(0.35);
      opacityAnim.setValue(0);
      backdropAnim.setValue(0);

      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 7,
          tension: 80,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 160,
          useNativeDriver: true,
        }),
        Animated.timing(backdropAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    } else if (mounted && !isClosingRef.current) {
      handleClose();
    }
  }, [visible, mounted, handleClose, scaleAnim, opacityAnim, backdropAnim]);

  if (!mounted) return null;

  const cleanUsername = username
    ? `@${String(username).trim().replace(/^@/, "")}`
    : null;

  return (
    <Modal
      visible={mounted}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <Pressable
        style={styles.overlay}
        onPress={handleClose}
        onPressOut={handleClose}
        onTouchEnd={handleClose}
      >
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { opacity: backdropAnim },
          ]}
          pointerEvents="none"
        >
          <ModalBlurBackdrop intensity={70} tint="dark" />
          <View style={styles.darkDim} />
        </Animated.View>

        <Animated.View
          style={[
            styles.contentContainer,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <UserAvatar
            source={source}
            fallbackSource={require("../../assets/avatar/3.png")}
            isCustomPhoto={isCustomPhoto}
            size={AVATAR_SIZE}
            iconRatio={0.74}
            borderWidth={3.5}
            borderColor={theme?.accent ? theme.accent + "55" : "rgba(255,255,255,0.2)"}
            priority="high"
            cachePolicy="memory-disk"
            style={[
              styles.avatarRing,
              { backgroundColor: theme?.secondary || "#1a1a24" },
            ]}
          />

          {(displayName || cleanUsername) && (
            <View
              style={[
                styles.infoCard,
                {
                  backgroundColor: theme?.primary
                    ? theme.primary + "EE"
                    : "rgba(18, 18, 24, 0.92)",
                  borderColor: theme?.border || "rgba(255, 255, 255, 0.12)",
                },
              ]}
            >
              {displayName ? (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    styles.displayName,
                    { color: theme?.text?.primary || "#ffffff" },
                  ]}
                >
                  {displayName}
                </Text>
              ) : null}
              {cleanUsername ? (
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[
                    styles.username,
                    { color: theme?.text?.secondary || "rgba(255,255,255,0.7)" },
                  ]}
                >
                  {cleanUsername}
                </Text>
              ) : null}
            </View>
          )}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  darkDim: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  contentContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  avatarRing: {
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.5,
        shadowRadius: 24,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  infoCard: {
    marginTop: 18,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    maxWidth: width * 0.82,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
      },
    }),
  },
  displayName: {
    fontSize: 16,
    fontWeight: "800",
    textAlign: "center",
  },
  username: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 2,
    textAlign: "center",
  },
});
