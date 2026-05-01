import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { fs } from "@/utils/responsive";

interface PointsBarProps {
  currentPoints: number;
  targetPoints: number;
  label?: string;
}

export function PointsBar({ currentPoints, targetPoints, label }: PointsBarProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const progress = Math.min(1, currentPoints / Math.max(1, targetPoints));

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {label ?? t("customer.nextReward")}
        </Text>
        <Text style={[styles.value, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
          {currentPoints} / {targetPoints}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.muted, borderRadius: 99 }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${(progress * 100).toFixed(0)}%` as any,
              backgroundColor: colors.primary,
              borderRadius: 99,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    fontSize: fs(13),
  },
  value: {
    fontSize: fs(13),
  },
  track: {
    height: 8,
    overflow: "hidden",
  },
  fill: {
    height: 8,
  },
});
