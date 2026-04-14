import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { RewardCard } from "@/components/RewardCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export default function CustomerRewardsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { getCustomerByUserId, getCustomerRewards, getCustomerRedemptions, addRedemption } = useData();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"available" | "history">("available");

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const customer = user ? getCustomerByUserId(user.id) : null;
  const allRewards = customer ? getCustomerRewards(customer.id) : [];
  const redemptions = customer ? getCustomerRedemptions(customer.id) : [];

  async function handleRedeem(rewardId: string, merchantName: string, rewardName: string) {
    if (!customer) return;
    await addRedemption({
      customerId: customer.id,
      rewardId,
      rewardName,
      merchantName,
    });
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("rewards.title")}
        </Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            onPress={() => setTab("available")}
            style={[styles.tab, { borderBottomColor: tab === "available" ? colors.primary : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: tab === "available" ? colors.primary : colors.mutedForeground, fontFamily: tab === "available" ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
              {t("customer.availableRewards")}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("history")}
            style={[styles.tab, { borderBottomColor: tab === "history" ? colors.primary : "transparent" }]}
          >
            <Text style={[styles.tabText, { color: tab === "history" ? colors.primary : colors.mutedForeground, fontFamily: tab === "history" ? "Inter_600SemiBold" : "Inter_400Regular" }]}>
              {t("rewards.redemptionHistory")}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "available" ? (
        <FlatList
          data={allRewards}
          keyExtractor={({ reward }) => reward.id}
          renderItem={({ item: { reward, merchant } }) => (
            <RewardCard
              reward={reward}
              currentPoints={customer?.totalPoints ?? 0}
              merchantName={merchant.businessName}
              onRedeem={() => handleRedeem(reward.id, merchant.businessName, reward.name)}
            />
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          scrollEnabled={!!allRewards.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="gift" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("customer.noRewards")}
              </Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={redemptions}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <Card style={{ marginBottom: 10 }}>
              <View style={styles.historyRow}>
                <View style={[styles.checkBox, { backgroundColor: colors.green100 }]}>
                  <Feather name="check" size={16} color={colors.secondary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.historyName, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
                    {item.rewardName}
                  </Text>
                  <Text style={[styles.historyMerchant, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {item.merchantName}
                  </Text>
                </View>
                <Badge label={t("rewards.redeemed")} variant="success" />
              </View>
            </Card>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          scrollEnabled={!!redemptions.length}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clock" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("rewards.noHistory")}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24, marginBottom: 12 },
  tabRow: { flexDirection: "row" },
  tab: { flex: 1, alignItems: "center", paddingBottom: 10, borderBottomWidth: 2 },
  tabText: { fontSize: 14 },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkBox: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  historyName: { fontSize: 14 },
  historyMerchant: { fontSize: 13 },
});
