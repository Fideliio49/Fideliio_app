import React, { useEffect, useRef } from "react";
import { Animated, Text, StyleSheet, View, Platform, StatusBar } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useApp } from "@/context/AppContext";
import { fs, iconSize } from "@/utils/responsive";

const STATUS_BAR_HEIGHT =
  Platform.OS === "android" ? (StatusBar.currentHeight ?? 24) : 54;

export function GlobalToast() {
  const { globalToastMsg, globalToastVisible, accentColor } = useApp();
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (globalToastVisible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -120,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [globalToastVisible]);

  if (!globalToastMsg) return null;

  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: accentColor, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="none"
    >
      <View style={styles.inner}>
        <View style={styles.iconWrap}>
          <Feather name="zap" size={iconSize(20)} color="#fff" />
        </View>
        <Text allowFontScaling={false} style={[styles.text, { fontFamily: "Inter_700Bold" }]}>
          {globalToastMsg}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    top: STATUS_BAR_HEIGHT + 8,
    left: 16,
    right: 16,
    borderRadius: 16,
    zIndex: 99999,
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  inner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: { color: "#fff", fontSize: fs(15), flex: 1 },
});
