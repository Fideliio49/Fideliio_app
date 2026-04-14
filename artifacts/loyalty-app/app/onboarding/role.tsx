import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { FideliioLogo } from "@/components/FideliioLogo";

export default function RoleScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top + 16;

  function handleRole(role: "customer" | "merchant") {
    router.push(`/auth/login?role=${role}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.card, paddingTop: topPad }]}>
      <View style={styles.top}>
        <FideliioLogo size={56} showName nameSize={20} nameColor={colors.foreground} />
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("role.choose")}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {t("role.chooseSub")}
        </Text>
      </View>

      <View style={styles.cards}>
        {/* Customer card */}
        <TouchableOpacity
          onPress={() => handleRole("customer")}
          activeOpacity={0.88}
          style={styles.cardWrap}
        >
          <LinearGradient
            colors={["#FF6B6B", "#FF8E53"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.cardIcon}>👤</Text>
            <Text style={[styles.cardTitle, { fontFamily: "Inter_700Bold" }]}>
              {t("role.customer")}
            </Text>
            <Text style={[styles.cardSub, { fontFamily: "Inter_400Regular" }]}>
              {t("role.customerSub")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Merchant card */}
        <TouchableOpacity
          onPress={() => handleRole("merchant")}
          activeOpacity={0.88}
          style={styles.cardWrap}
        >
          <LinearGradient
            colors={["#2C3E8C", "#00B4D8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            <Text style={styles.cardIcon}>🏪</Text>
            <Text style={[styles.cardTitle, { fontFamily: "Inter_700Bold" }]}>
              {t("role.merchant")}
            </Text>
            <Text style={[styles.cardSub, { fontFamily: "Inter_400Regular" }]}>
              {t("role.merchantSub")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  top: {
    alignItems: "center",
    gap: 10,
    marginBottom: 32,
  },
  title: {
    fontSize: 22,
    marginTop: 14,
  },
  sub: {
    fontSize: 13,
  },
  cards: {
    flexDirection: "row",
    gap: 12,
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    borderRadius: 20,
    padding: 20,
    minHeight: 180,
    justifyContent: "flex-end",
    gap: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  cardIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  cardTitle: {
    color: "#fff",
    fontSize: 15,
  },
  cardSub: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 11,
    lineHeight: 16,
  },
});
