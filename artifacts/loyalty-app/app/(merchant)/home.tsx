import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { StatCard } from "@/components/StatCard";
import { TransactionRow } from "@/components/TransactionRow";
import { Card } from "@/components/ui/Card";
import { Feather } from "@expo/vector-icons";

export default function MerchantHomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { getMerchantByUserId, getMerchantTransactions } = useData();
  const insets = useSafeAreaInsets();

  const merchant = user ? getMerchantByUserId(user.id) : null;
  const transactions = merchant ? getMerchantTransactions(merchant.id).slice(0, 8) : [];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <>
      <StatusBar style="light" backgroundColor={colors.secondary} />
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.secondary, colors.green600]}
        style={[styles.hero, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.greeting, { fontFamily: "Inter_400Regular" }]}>
          {t("role.merchant")}
        </Text>
        <Text style={[styles.bizName, { fontFamily: "Inter_700Bold" }]}>
          {merchant?.businessName ?? user?.businessName ?? "My Business"}
        </Text>
      </LinearGradient>

      <View style={styles.stats}>
        <View style={styles.statsRow}>
          <StatCard
            icon="users"
            value={merchant?.totalCustomers ?? 0}
            label={t("merchant.activeCustomers")}
            color={colors.primary}
          />
          <StatCard
            icon="trending-up"
            value={merchant?.pointsThisMonth ?? 0}
            label={t("merchant.pointsDistributed")}
            color={colors.secondary}
          />
        </View>
        <View style={styles.statsRow}>
          <StatCard
            icon="gift"
            value={merchant?.rewardsRedeemed ?? 0}
            label={t("merchant.rewardsRedeemed")}
            color={colors.warning}
          />
          <StatCard
            icon="zap"
            value={`${merchant?.pointsRate ?? 1}x`}
            label="Points rate"
            color={colors.purple500}
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
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 28,
    gap: 4,
  },
  greeting: { color: "rgba(255,255,255,0.85)", fontSize: 14 },
  bizName: { color: "#fff", fontSize: 26 },
  stats: { padding: 16, gap: 12 },
  statsRow: { flexDirection: "row", gap: 12 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: 17, marginBottom: 12 },
  empty: { padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
});
