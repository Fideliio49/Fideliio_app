import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";

export default function RoleScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();

  function handleRole(role: "customer" | "merchant") {
    router.push(`/auth/login?role=${role}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.top}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("role.choose")}
        </Text>
        <Text style={[styles.sub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          LoyaltyApp
        </Text>
      </View>

      <View style={styles.cards}>
        <TouchableOpacity
          onPress={() => handleRole("customer")}
          activeOpacity={0.85}
          style={[
            styles.roleCard,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius * 1.5,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.roleIcon, { backgroundColor: colors.purple100 }]}>
            <Feather name="user" size={36} color={colors.primary} />
          </View>
          <Text style={[styles.roleTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("role.customer")}
          </Text>
          <Text style={[styles.roleSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("role.customerSub")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handleRole("merchant")}
          activeOpacity={0.85}
          style={[
            styles.roleCard,
            {
              backgroundColor: colors.card,
              borderRadius: colors.radius * 1.5,
              borderColor: colors.border,
            },
          ]}
        >
          <View style={[styles.roleIcon, { backgroundColor: colors.green100 }]}>
            <Feather name="briefcase" size={36} color={colors.secondary} />
          </View>
          <Text style={[styles.roleTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("role.merchant")}
          </Text>
          <Text style={[styles.roleSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("role.merchantSub")}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    paddingTop: 80,
  },
  top: {
    alignItems: "center",
    marginBottom: 48,
    gap: 8,
  },
  title: {
    fontSize: 26,
    textAlign: "center",
  },
  sub: {
    fontSize: 16,
  },
  cards: {
    gap: 16,
  },
  roleCard: {
    padding: 28,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  roleIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  roleTitle: {
    fontSize: 20,
  },
  roleSub: {
    fontSize: 14,
    textAlign: "center",
  },
});
