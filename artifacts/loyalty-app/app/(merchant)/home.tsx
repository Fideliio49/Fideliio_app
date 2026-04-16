import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { StatCard } from "@/components/StatCard";
import { TransactionRow } from "@/components/TransactionRow";
import { Card } from "@/components/ui/Card";
import { Feather } from "@expo/vector-icons";

const STATUS_BAR_HEIGHT = Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 24);

export default function MerchantHomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, merchantAccentColor } = useApp();
  const { getMerchantByUserId, getMerchantTransactions, getMerchantStats } = useData();

  const merchant = user ? getMerchantByUserId(user.id) : null;
  const transactions = merchant ? getMerchantTransactions(merchant.id).slice(0, 8) : [];
  const stats = merchant ? getMerchantStats(merchant.id) : { activeCustomers: 0, pointsThisMonth: 0 };

  const topPad = Platform.OS === "web" ? 67 : STATUS_BAR_HEIGHT;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("transparent", true);
      }
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#2C3E8C" }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#2C3E8C", merchantAccentColor, "#00B4D8"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={[styles.hero, { paddingTop: topPad }]}
      >
        <Text style={[styles.greeting, { fontFamily: "Inter_400Regular" }]}>
          Bonjour, {user?.firstName} 👋
        </Text>
        <Text style={[styles.bizName, { fontFamily: "Inter_700Bold" }]}>
          {merchant?.businessName ?? user?.businessName ?? "My Business"}
        </Text>
      </LinearGradient>

      <View style={styles.stats}>
        <View style={styles.statsRow}>
          <StatCard
            icon="users"
            value={stats.activeCustomers}
            label={t("merchant.activeCustomers")}
            color={merchantAccentColor}
            valueColor={"#F9A602"}
          />
          <StatCard
            icon="trending-up"
            value={stats.pointsThisMonth}
            label={t("merchant.pointsDistributed")}
            color={merchantAccentColor}
            valueColor={"#F9A602"}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            icon="gift"
            value={merchant?.rewardsRedeemed ?? 0}
            label={t("merchant.rewardsRedeemed")}
            color={merchantAccentColor}
            valueColor={"#F9A602"}
          />
          <StatCard
            icon="zap"
            value={`${merchant?.pointsRate ?? 1}x`}
            label="Points rate"
            color={merchantAccentColor}
            valueColor={"#F9A602"}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("merchant.recentTransactions")}
        </Text>
        <Card padding={0} style={{ overflow: "hidden" }}>
          {transactions.length === 0 ? (
            <View style={styles.empty}>
              <Feather name="activity" size={32} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("merchant.noTransactions")}
              </Text>
            </View>
          ) : (
            <View style={{ paddingHorizontal: 16 }}>
              {transactions.map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} showCustomer />
              ))}
            </View>
          )}
        </Card>
      </View>
    </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 4,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  greeting: { color: "rgba(255,255,255,0.85)", fontSize: 16 },
  bizName: { color: "#fff", fontSize: 28 },
  stats: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 12 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 17, marginBottom: 12 },
  empty: { padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
});
