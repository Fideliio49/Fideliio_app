import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { PointsBar } from "@/components/PointsBar";
import { TransactionRow } from "@/components/TransactionRow";
import { RewardCard } from "@/components/RewardCard";
import { Card } from "@/components/ui/Card";

export default function CustomerHomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { getCustomerByUserId, getCustomerTransactions, getCustomerRewards, addRedemption } = useData();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const customer = user ? getCustomerByUserId(user.id) : null;
  const transactions = customer ? getCustomerTransactions(customer.id).slice(0, 5) : [];
  const availableRewards = customer ? getCustomerRewards(customer.id) : [];
  const redeemableRewards = availableRewards.filter(
    ({ reward }) => (customer?.totalPoints ?? 0) >= reward.pointsRequired
  );

  const topReward = availableRewards[0];
  const nextTarget = topReward?.reward.pointsRequired ?? 500;

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 + bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[colors.primary, colors.purple700]}
        style={[styles.hero, { paddingTop: topPad + 16 }]}
      >
        <Text style={[styles.welcome, { fontFamily: "Inter_400Regular" }]}>
          {t("customer.welcome")} {user?.firstName}
        </Text>
        <View style={styles.pointsRow}>
          <Text style={[styles.pointsValue, { fontFamily: "Inter_700Bold" }]}>
            {customer?.totalPoints ?? 0}
          </Text>
          <Text style={[styles.pointsLabel, { fontFamily: "Inter_400Regular" }]}>
            {t("customer.points")}
          </Text>
        </View>
        <View style={styles.progressWrap}>
          <PointsBar
            currentPoints={customer?.totalPoints ?? 0}
            targetPoints={nextTarget}
          />
        </View>
      </LinearGradient>

      <View style={styles.content}>
        {redeemableRewards.length > 0 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("customer.availableRewards")}
            </Text>
            {redeemableRewards.slice(0, 3).map(({ reward, merchant }) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                currentPoints={customer?.totalPoints ?? 0}
                merchantName={merchant.businessName}
                onRedeem={async () => {
                  if (customer) {
                    await addRedemption({
                      customerId: customer.id,
                      rewardId: reward.id,
                      rewardName: reward.name,
                      merchantName: merchant.businessName,
                    });
                  }
                }}
              />
            ))}
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("customer.recentTransactions")}
            </Text>
            <TouchableOpacity onPress={() => router.push("/(customer)/merchants")}>
              <Text style={[styles.viewAll, { color: colors.primary, fontFamily: "Inter_500Medium" }]}>
                {t("customer.browseAll")}
              </Text>
            </TouchableOpacity>
          </View>
          <Card padding={0} style={{ overflow: "hidden" }}>
            {transactions.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Feather name="activity" size={32} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("customer.noTransactions")}
                </Text>
              </View>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                {transactions.map((tx) => (
                  <TransactionRow key={tx.id} transaction={tx} />
                ))}
              </View>
            )}
          </Card>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 4,
  },
  welcome: { color: "rgba(255,255,255,0.85)", fontSize: 16 },
  pointsRow: { flexDirection: "row", alignItems: "baseline", gap: 6, marginTop: 4 },
  pointsValue: { color: "#fff", fontSize: 48 },
  pointsLabel: { color: "rgba(255,255,255,0.8)", fontSize: 16 },
  progressWrap: { marginTop: 16 },
  content: { padding: 20 },
  section: { marginBottom: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17, marginBottom: 12 },
  viewAll: { fontSize: 14 },
  emptyWrap: { padding: 32, alignItems: "center", gap: 10 },
  emptyText: { fontSize: 14 },
});
