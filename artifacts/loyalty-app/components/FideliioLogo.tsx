import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";


interface FideliioLogoProps {
  size?: number;
  style?: ViewStyle;
  showName?: boolean;
  nameSize?: number;
  nameColor?: string;
}

export function FideliioLogo({
  size = 56,
  style,
  showName = false,
  nameSize = 20,
  nameColor = "#0f0f0f",
}: FideliioLogoProps) {
  const borderRadius = size * 0.32;

  return (
    <View style={[styles.wrap, style]}>
      <View
        colors={["#FF6B6B", "#FF8E53"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.logo,
          {
            width: size,
            height: size,
            borderRadius,
            shadowRadius: size * 0.2,
          },
        ]}
      >
        <Text
          style={[
            styles.letter,
            { fontSize: size * 0.5, fontFamily: "Inter_700Bold" },
          ]}
        >
          F
        </Text>
      </View>
      {showName && (
        <Text
          style={[
            styles.name,
            { fontSize: nameSize, color: nameColor, fontFamily: "Inter_700Bold" },
          ]}
        >
          Fideliio
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 8,
  },
  logo: {
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
  },
  letter: {
    color: "#fff",
  },
  name: {},
});
