import React, { ReactNode } from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, style, padding = 16 }: CardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.card,
          borderRadius: colors.radius,
          borderColor: colors.border,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
});
