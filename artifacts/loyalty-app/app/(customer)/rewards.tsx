import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return (
    date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " · " +
    date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  );
}

export default function CustomerRewardsScreen() {
  const colors = useColors();
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"available" | "history">("available");

  const [customer, setCustomer] = useState<any>(null);
  const [availableRewards, setAvailableRewards] = useState<any[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [user?.id]),
  );

  async function loadData() {
    if (!user?.id) return;

    // Charger le customer
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!customerData) return;
    setCustomer(customerData);

    // Charger les points par commerce
    const { data: merchantPoints } = await supabase
      .from("customer_merchant_points")
      .select("merchant_id, total_points, business_name")
      .eq("customer_id", customerData.id);

    if (merchantPoints && merchantPoints.length > 0) {
      const merchantIds = merchantPoints.map((m: any) => m.merchant_id);

      // Charger les récompenses actives de ces commerces
      const { data: rewards } = await supabase
        .from("rewards")
        .select("*")
        .in("merchant_id", merchantIds)
        .eq("is_active", true)
        .order("points_required", { ascending: true });

      // Associer les points du client à chaque récompense
      const rewardsWithPoints = (rewards ?? []).map((r: any) => {
        const mp = merchantPoints.find(
          (m: any) => m.merchant_id === r.merchant_id,
        );
        return {
          ...r,
          customer_points: mp?.total_points ?? 0,
          merchant_name_label: mp?.business_name ?? r.merchant_name,
        };
      });

      setAvailableRewards(rewardsWithPoints);
    }

    // Charger l'historique des rédemptions
    const { data: redemptionData } = await supabase
      .from("redemptions")
      .select("*")
      .eq("customer_id", customerData.id)
      .order("redeemed_at", { ascending: false });

    setRedemptions(redemptionData ?? []);
  }

  async function handleRedeem(reward: any) {
    if (!customer) return;

    // Vérifier le solde ACTUEL depuis Supabase (pas le cache)
    const { data: currentPoints } = await supabase
      .from("customer_merchant_points")
      .select("total_points")
      .eq("customer_id", customer.id)
      .eq("merchant_id", reward.merchant_id)
      .single();

    const solde = currentPoints?.total_points ?? 0;

    // Bloquer si solde insuffisant
    if (solde < reward.points_required) {
      Alert.alert(
        "Points insuffisants",
        `Il vous faut ${reward.points_required} points.\nVous avez ${Math.max(0, solde)} points chez ${reward.merchant_name_label}.`,
      );
      return;
    }

    Alert.alert(
      "Utiliser cette récompense ?",
      `${reward.name} chez ${reward.merchant_name_label}\n\nVotre solde après : ${solde - reward.points_required} pts`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Confirmer",
          onPress: async () => {
            try {
              const { nanoid } = await import("nanoid/non-secure");

              // Insérer la rédemption
              const { error: rdError } = await supabase
                .from("redemptions")
                .insert({
                  id: nanoid(),
                  customer_id: customer.id,
                  reward_id: reward.id,
                  merchant_id: reward.merchant_id,
                  reward_name: reward.name,
                  merchant_name: reward.merchant_name_label,
                  redeemed_at: new Date().toISOString(),
                });

              if (rdError) throw rdError;

              // Transaction négative pour déduire les points
              const { error: txError } = await supabase
                .from("transactions")
                .insert({
                  id: nanoid(),
                  customer_id: customer.id,
                  merchant_id: reward.merchant_id,
                  merchant_name: reward.merchant_name_label,
                  customer_name: `${customer.first_name} ${customer.last_name}`,
                  amount: 0,
                  multiplier: 1,
                  points_earned: -reward.points_required,
                  created_at: new Date().toISOString(),
                });

              if (txError) throw txError;

              // Recharger les données
              await loadData();
            } catch (err: any) {
              Alert.alert(
                "Erreur",
                err.message || "Impossible d'utiliser cette récompense.",
              );
            }
          },
        },
      ],
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          Mes récompenses
        </Text>
        <View style={styles.tabRow}>
          <TouchableOpacity
            onPress={() => setTab("available")}
            style={[
              styles.tab,
              {
                borderBottomColor:
                  tab === "available" ? colors.primary : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    tab === "available"
                      ? colors.primary
                      : colors.mutedForeground,
                  fontFamily:
                    tab === "available"
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                },
              ]}
            >
              Récompenses disponibles
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setTab("history")}
            style={[
              styles.tab,
              {
                borderBottomColor:
                  tab === "history" ? colors.primary : "transparent",
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    tab === "history" ? colors.primary : colors.mutedForeground,
                  fontFamily:
                    tab === "history"
                      ? "Inter_600SemiBold"
                      : "Inter_400Regular",
                },
              ]}
            >
              Historique
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {tab === "available" ? (
        <FlatList
          data={availableRewards}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => {
            const canRedeem = item.customer_points >= item.points_required;
            return (
              <Card style={{ marginBottom: 10 }}>
                <View style={styles.rewardRow}>
                  <View
                    style={[
                      styles.rewardIcon,
                      {
                        backgroundColor: canRedeem ? "#F9A60220" : colors.muted,
                      },
                    ]}
                  >
                    <Feather
                      name="gift"
                      size={20}
                      color={canRedeem ? "#F9A602" : colors.mutedForeground}
                    />
                  </View>
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text
                      style={[
                        styles.rewardName,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.rewardMerchant,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {item.merchant_name_label}
                    </Text>
                    <View style={styles.pointsRow}>
                      <Text
                        style={[
                          styles.rewardPoints,
                          {
                            color: canRedeem
                              ? "#F9A602"
                              : colors.mutedForeground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {item.customer_points} / {item.points_required} pts
                      </Text>
                      {canRedeem && (
                        <View
                          style={[
                            styles.readyBadge,
                            { backgroundColor: "#F9A60220" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.readyText,
                              { fontFamily: "Inter_600SemiBold" },
                            ]}
                          >
                            ✓ Disponible
                          </Text>
                        </View>
                      )}
                    </View>
                    {/* Barre de progression */}
                    <View
                      style={[
                        styles.progressTrack,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width:
                              `${Math.min(100, (item.customer_points / item.points_required) * 100).toFixed(0)}%` as any,
                            backgroundColor: canRedeem
                              ? "#F9A602"
                              : colors.primary,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  {canRedeem && (
                    <TouchableOpacity
                      onPress={() => handleRedeem(item)}
                      style={[
                        styles.useBtn,
                        { backgroundColor: colors.primary },
                      ]}
                    >
                      <Text
                        style={[
                          styles.useBtnText,
                          { fontFamily: "Inter_600SemiBold" },
                        ]}
                      >
                        Utiliser
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="gift" size={40} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Visitez des commerces pour gagner des récompenses
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
                <View
                  style={[
                    styles.checkBox,
                    { backgroundColor: colors.green100 },
                  ]}
                >
                  <Feather name="check" size={16} color={colors.secondary} />
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text
                    style={[
                      styles.historyName,
                      {
                        color: colors.foreground,
                        fontFamily: "Inter_500Medium",
                      },
                    ]}
                  >
                    {item.reward_name}
                  </Text>
                  <Text
                    style={[
                      styles.historyMerchant,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {item.merchant_name}
                  </Text>
                  <Text
                    style={[
                      styles.historyDate,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {formatDate(item.redeemed_at)}
                  </Text>
                </View>
                <Badge label="Utilisé" variant="success" />
              </View>
            </Card>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clock" size={40} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Aucun historique pour le moment
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
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1 },
  title: { fontSize: 24, marginBottom: 12 },
  tabRow: { flexDirection: "row" },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: 14 },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardName: { fontSize: 14 },
  rewardMerchant: { fontSize: 12 },
  pointsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  rewardPoints: { fontSize: 12 },
  readyBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 99 },
  readyText: { color: "#F9A602", fontSize: 10 },
  progressTrack: {
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: 4, borderRadius: 99 },
  useBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  useBtnText: { color: "#fff", fontSize: 13 },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  historyName: { fontSize: 14 },
  historyMerchant: { fontSize: 13 },
  historyDate: { fontSize: 11, marginTop: 2 },
});
