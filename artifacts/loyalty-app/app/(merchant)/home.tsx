import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  StatusBar,
} from "react-native";
import { fs } from "@/utils/responsive";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { StatCard } from "@/components/StatCard";
import { TransactionRow } from "@/components/TransactionRow";
import { Card } from "@/components/ui/Card";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";

const STATUS_BAR_HEIGHT =
  Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 24);

export default function MerchantHomeScreen() {
  const colors = useColors();
  const { user, merchantAccentColor, isRTL } = useApp();
  const { t } = useTranslation();

  const [merchant, setMerchant] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeCustomers: 0,
    pointsThisMonth: 0,
    rewardsRedeemed: 0,
  });

  const topPad = Platform.OS === "web" ? 67 : STATUS_BAR_HEIGHT;
  const textAlign = isRTL ? "right" : "left";
  const rowDir = isRTL ? "row-reverse" : "row";

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("transparent", true);
      }
      loadData();
    }, [user?.id]),
  );

  async function loadData() {
    if (!user?.id) return;

    const { data: merchantData } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!merchantData) return;
    setMerchant(merchantData);

    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("merchant_id", merchantData.id)
      .order("created_at", { ascending: false })
      .limit(8);

    setTransactions(txData ?? []);

    const { data: statsData } = await supabase
      .from("merchant_stats")
      .select("*")
      .eq("merchant_id", merchantData.id)
      .maybeSingle();

    if (statsData) {
      setStats({
        activeCustomers: statsData.total_customers ?? 0,
        pointsThisMonth: statsData.points_this_month ?? 0,
        rewardsRedeemed: statsData.rewards_redeemed ?? 0,
      });
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#2C3E8C" }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Hero ── */}
        <LinearGradient
          colors={["#2C3E8C", merchantAccentColor, "#00B4D8"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={[styles.hero, { paddingTop: topPad }]}
        >
          <Text
            style={[
              styles.greeting,
              { fontFamily: "Inter_400Regular", textAlign },
            ]}
          >
            {t("customer.welcome")} 👋
          </Text>
          <Text
            style={[styles.bizName, { fontFamily: "Inter_700Bold", textAlign }]}
          >
            {merchant?.business_name ?? t("profile.businessInfo")}
          </Text>
        </LinearGradient>

        {/* ── Stats ── */}
        <View style={styles.stats}>
          <View style={[styles.statsRow, { flexDirection: rowDir }]}>
            <StatCard
              icon="users"
              value={stats.activeCustomers}
              label={t("merchant.activeCustomers")}
              color={merchantAccentColor}
              valueColor="#F9A602"
            />
            <StatCard
              icon="trending-up"
              value={stats.pointsThisMonth}
              label={t("merchant.pointsDistributed")}
              color={merchantAccentColor}
              valueColor="#F9A602"
            />
          </View>
          <View style={[styles.statsRow, { flexDirection: rowDir }]}>
            <StatCard
              icon="gift"
              value={stats.rewardsRedeemed}
              label={t("merchant.rewardsRedeemed")}
              color={merchantAccentColor}
              valueColor="#F9A602"
            />
            <StatCard
              icon="zap"
              value={`1pt=${merchant?.points_rate ?? 1}DH`}
              label={t("profile.pointsRate")}
              color={merchantAccentColor}
              valueColor="#F9A602"
            />
          </View>
        </View>

        {/* ── Transactions récentes ── */}
        <View style={styles.section}>
          <Text
            style={[
              styles.sectionTitle,
              {
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                textAlign,
              },
            ]}
          >
            {t("merchant.recentTransactions")}
          </Text>
          <Card padding={0} style={{ overflow: "hidden" }}>
            {transactions.length === 0 ? (
              <View style={styles.empty}>
                <Feather
                  name="activity"
                  size={32}
                  color={colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                      textAlign: "center",
                    },
                  ]}
                >
                  {t("merchant.noTransactions")}
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                {transactions.map((tx) => (
                  <TransactionRow
                    key={tx.id}
                    transaction={{
                      id: tx.id,
                      merchantName: tx.merchant_name,
                      customerName: tx.customer_name,
                      pointsEarned: tx.points_earned,
                      amount: tx.amount,
                      createdAt: tx.created_at,
                      type: "earn",
                    }}
                    showCustomer
                    isRTL={isRTL}
                  />
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
  greeting: { color: "rgba(255,255,255,0.85)", fontSize: fs(16) },
  bizName: { color: "#fff", fontSize: fs(28) },
  stats: { padding: 16, gap: 12 },
  statsRow: { gap: 12 },
  section: { paddingHorizontal: 16, marginBottom: 24 },
  sectionTitle: { fontSize: fs(17), marginBottom: 12 },
  empty: { padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: fs(14) },
});
