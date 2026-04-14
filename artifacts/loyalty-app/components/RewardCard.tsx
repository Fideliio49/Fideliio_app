import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { Card } from "./ui/Card";
import type { Reward } from "@/context/DataContext";

const TYPE_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  discount: "percent",
  freeProduct: "gift",
  freeService: "star",
};

interface RewardCardProps {
  reward: Reward;
  currentPoints?: number;
  merchantName?: string;
  onRedeem?: () => void;
  showMerchant?: boolean;
}

export function RewardCard({
  reward,
  currentPoints = 0,
  merchantName,
  onRedeem,
  showMerchant = true,
}: RewardCardProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const canRedeem = currentPoints >= reward.pointsRequired;
  const icon = TYPE_ICONS[reward.rewardType] ?? "gift";

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View style={[styles.iconBox, { backgroundColor: canRedeem ? colors.green100 : colors.muted, borderRadius: 10 }]}>
          <Feather name={icon} size={20} color={canRedeem ? colors.secondary : colors.mutedForeground} />
        </View>
        <View style={styles.info}>
          <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
            {reward.name}
          </Text>
          {showMerchant && merchantName && (
            <Text style={[styles.merchant, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {merchantName}
            </Text>
          )}
          <Text style={[styles.pts, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {reward.pointsRequired} {t("rewards.pointsRequired")}
          </Text>
        </View>
        {onRedeem && (
          <TouchableOpacity
            onPress={onRedeem}
            disabled={!canRedeem}
            activeOpacity={0.8}
            style={[
              styles.redeemBtn,
              {
                backgroundColor: canRedeem ? colors.secondary : colors.muted,
                borderRadius: colors.radius - 4,
              },
            ]}
          >
            <Text style={[styles.redeemText, { color: canRedeem ? "#fff" : colors.mutedForeground, fontFamily: "Inter_600SemiBold" }]}>
              {t("rewards.redeem")}
            </Text>
          </TouchableOpacity>
        )}
      </View>
      {currentPoints > 0 && currentPoints < reward.pointsRequired && (
        <View style={styles.progressWrap}>
          <View style={[styles.track, { backgroundColor: colors.muted }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.min(100, (currentPoints / reward.pointsRequired) * 100).toFixed(0)}%` as any,
                  backgroundColor: colors.primary,
                },
              ]}
            />
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
  },
  merchant: {
    fontSize: 12,
  },
  pts: {
    fontSize: 12,
  },
  redeemBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  redeemText: {
    fontSize: 13,
  },
  progressWrap: {
    marginTop: 10,
  },
  track: {
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
  },
  fill: {
    height: 4,
    borderRadius: 99,
  },
});
