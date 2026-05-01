import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useTranslation } from "react-i18next";
import { Card } from "./ui/Card";
import { Badge } from "./ui/Badge";
import type { MerchantData } from "@/context/DataContext";
import { fs, iconSize } from "@/utils/responsive";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  restaurant: "coffee",
  clothing: "shopping-bag",
  hairSalon: "scissors",
  hotel: "home",
  other: "star",
};

interface MerchantCardProps {
  merchant: MerchantData;
  onPress?: () => void;
}

export function MerchantCard({ merchant, onPress }: MerchantCardProps) {
  const colors = useColors();
  const { t } = useTranslation();

  const icon = CATEGORY_ICONS[merchant.category] ?? "star";
  const catLabel = t(`auth.categories.${merchant.category}` as any, { defaultValue: merchant.category });

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.85}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={[styles.iconBox, { backgroundColor: colors.purple100, borderRadius: colors.radius }]}>
            <Feather name={icon} size={iconSize(22)} color={colors.primary} />
          </View>
          <View style={styles.info}>
            <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              {merchant.businessName}
            </Text>
            <Text style={[styles.category, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {catLabel}
            </Text>
          </View>
          <View style={styles.rate}>
            <Text style={[styles.rateNumber, { color: colors.secondary, fontFamily: "Inter_700Bold" }]}>
              {merchant.pointsRate}
            </Text>
            <Text style={[styles.rateSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("merchants.pointsRate")}
            </Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 3,
  },
  name: {
    fontSize: fs(15),
  },
  category: {
    fontSize: fs(13),
  },
  rate: {
    alignItems: "flex-end",
  },
  rateNumber: {
    fontSize: fs(20),
  },
  rateSub: {
    fontSize: fs(11),
  },
});
