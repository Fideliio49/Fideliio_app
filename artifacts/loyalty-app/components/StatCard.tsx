import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { Card } from "./ui/Card";

interface StatCardProps {
  icon: keyof typeof Feather.glyphMap;
  value: string | number;
  label: string;
  color?: string;
}

export function StatCard({ icon, value, label, color }: StatCardProps) {
  const colors = useColors();
  const accent = color ?? colors.primary;

  return (
    <Card style={styles.card} padding={14}>
      <View style={[styles.iconBox, { backgroundColor: accent + "18", borderRadius: 10 }]}>
        <Feather name={icon} size={18} color={accent} />
      </View>
      <Text style={[styles.value, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
        {value}
      </Text>
      <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
        {label}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    gap: 6,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  value: {
    fontSize: 20,
  },
  label: {
    fontSize: 12,
  },
});
