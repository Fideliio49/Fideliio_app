import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import { fs } from "@/utils/responsive";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "purple";
  style?: ViewStyle;
}

export function Badge({ label, variant = "default", style }: BadgeProps) {
  const colors = useColors();

  const bgColor =
    variant === "success" ? colors.green100 :
    variant === "warning" ? "#FEF3C7" :
    variant === "danger" ? "#FEE2E2" :
    variant === "purple" ? colors.purple100 :
    colors.muted;

  const textColor =
    variant === "success" ? colors.green600 :
    variant === "warning" ? colors.warning :
    variant === "danger" ? colors.destructive :
    variant === "purple" ? colors.purple600 :
    colors.mutedForeground;

  return (
    <View style={[styles.badge, { backgroundColor: bgColor, borderRadius: 20 }, style]}>
      <Text
        allowFontScaling={false}
        style={[styles.label, { color: textColor, fontFamily: "Inter_500Medium" }]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  label: {
    fontSize: fs(12),
  },
});
