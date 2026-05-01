import React from "react";
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import * as Haptics from "expo-haptics";
import { useColors } from "@/hooks/useColors";
import { fs } from "@/utils/responsive";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const colors = useColors();

  function handlePress() {
    if (!disabled && !loading) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onPress();
    }
  }

  const containerStyle: ViewStyle = {
    borderRadius: colors.radius,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    opacity: disabled || loading ? 0.6 : 1,
    ...(size === "sm" ? { paddingVertical: 8, paddingHorizontal: 16 } : {}),
    ...(size === "md" ? { paddingVertical: 14, paddingHorizontal: 24 } : {}),
    ...(size === "lg" ? { paddingVertical: 16, paddingHorizontal: 32 } : {}),
    ...(variant === "primary" ? { backgroundColor: colors.primary } : {}),
    ...(variant === "secondary" ? { backgroundColor: colors.secondary } : {}),
    ...(variant === "outline" ? { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.primary } : {}),
    ...(variant === "ghost" ? { backgroundColor: "transparent" } : {}),
    ...(variant === "danger" ? { backgroundColor: colors.destructive } : {}),
  };

  const labelStyle: TextStyle = {
    fontFamily: "Inter_600SemiBold",
    ...(size === "sm" ? { fontSize: fs(13) } : {}),
    ...(size === "md" ? { fontSize: fs(15) } : {}),
    ...(size === "lg" ? { fontSize: fs(17) } : {}),
    ...(variant === "primary" ? { color: colors.primaryForeground } : {}),
    ...(variant === "secondary" ? { color: colors.secondaryForeground } : {}),
    ...(variant === "outline" ? { color: colors.primary } : {}),
    ...(variant === "ghost" ? { color: colors.primary } : {}),
    ...(variant === "danger" ? { color: colors.destructiveForeground } : {}),
  };

  return (
    <TouchableOpacity
      style={[containerStyle, style]}
      onPress={handlePress}
      activeOpacity={0.8}
      disabled={disabled || loading}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? colors.primary : "#fff"}
        />
      ) : (
        <Text allowFontScaling={false} style={[labelStyle, textStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}
