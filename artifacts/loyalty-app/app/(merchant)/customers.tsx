import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Alert,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
} from "react-native";
import { fs, iconSize } from "@/utils/responsive";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
};

function getTier(points: number): string {
  if (points >= 5000) return "gold";
  if (points >= 1000) return "silver";
  return "bronze";
}

export default function MerchantCustomersScreen() {
  const colors = useColors();
  const { user, merchantAccentColor, isRTL } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [merchant, setMerchant] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const textAlign = isRTL ? "right" : "left";
  const rowDir = isRTL ? "row-reverse" : "row";

  useFocusEffect(
    useCallback(() => {
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

    const { data: rewardsData } = await supabase
      .from("rewards")
      .select("*")
      .eq("merchant_id", merchantData.id)
      .eq("is_active", true)
      .order("points_required", { ascending: true });
    setRewards(rewardsData ?? []);

    const { data: customerPoints } = await supabase
      .from("customer_merchant_points")
      .select("customer_id, total_points, visit_count, last_visit")
      .eq("merchant_id", merchantData.id)
      .order("total_points", { ascending: false });

    if (!customerPoints || customerPoints.length === 0) {
      setCustomers([]);
      return;
    }

    const customerIds = customerPoints.map((c: any) => c.customer_id);
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, tier")
      .in("id", customerIds);

    const merged = customerPoints.map((cp: any) => {
      const cust = customersData?.find((c: any) => c.id === cp.customer_id);
      const pts = Math.max(0, cp.total_points);
      const tier = getTier(pts);
      const nextReward = (rewardsData ?? []).find(
        (r: any) => r.points_required > pts,
      );
      const progress = nextReward
        ? Math.min(100, Math.round((pts / nextReward.points_required) * 100))
        : 100;
      const remaining = nextReward ? nextReward.points_required - pts : 0;
      return {
        ...cust,
        total_points: pts,
        visit_count: cp.visit_count,
        last_visit: cp.last_visit,
        tier,
        next_reward: nextReward,
        progress,
        remaining,
      };
    });
    setCustomers(merged);
  }

  async function handleAdjust(positive: boolean) {
    const delta = parseInt(adjustDelta);
    if (isNaN(delta) || delta <= 0) {
      Alert.alert("", t("common.error"));
      return;
    }
    if (!merchant || !selectedCust) return;
    setAdjustLoading(true);
    try {
      const { nanoid } = await import("nanoid/non-secure");
      const { error } = await supabase.from("transactions").insert({
        id: nanoid(),
        customer_id: selectedCust.id,
        merchant_id: merchant.id,
        merchant_name: merchant.business_name,
        customer_name: `${selectedCust.first_name} ${selectedCust.last_name}`,
        amount: 0,
        multiplier: 1,
        points_earned: positive ? delta : -delta,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      Alert.alert(
        "✅",
        `${positive ? "+" : "-"}${delta} pts — ${selectedCust.first_name}`,
      );
      setSelectedCust(null);
      setAdjustDelta("");
      await loadData();
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setAdjustLoading(false);
    }
  }

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      search.trim() === "" ||
      `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q) ||
      (c.email ?? "").includes(q)
    );
  });

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* ── Header ── */}
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 12, borderBottomColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.title,
              {
                color: colors.foreground,
                fontFamily: "Inter_700Bold",
                textAlign,
              },
            ]}
          >
            {t("customers.title")}
          </Text>
          <Input
            placeholder={t("customers.search")}
            value={search}
            onChangeText={setSearch}
            leftIcon="search"
            containerStyle={{ marginBottom: 12, marginTop: 12 }}
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            blurOnSubmit={true}
          />
        </View>

        {/* ── Liste ── */}
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={Keyboard.dismiss}
          renderItem={({ item }) => {
            const tierColor = TIER_COLORS[item.tier] ?? "#CD7F32";
            const isUrgent = item.progress >= 80 && item.next_reward;
            return (
              <Card style={styles.customerCard}>
                <View style={[styles.row, { flexDirection: rowDir }]}>
                  {/* Avatar */}
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: merchantAccentColor + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.avatarText,
                        {
                          color: merchantAccentColor,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {(item.first_name?.[0] ?? "").toUpperCase()}
                      {(item.last_name?.[0] ?? "").toUpperCase()}
                    </Text>
                  </View>

                  {/* Infos */}
                  <View style={styles.info}>
                    <View style={[styles.nameRow, { flexDirection: rowDir }]}>
                      <Text
                        style={[
                          styles.custName,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                            textAlign,
                          },
                        ]}
                      >
                        {item.first_name} {item.last_name}
                      </Text>
                      {isUrgent && (
                        <View style={styles.urgentBadge}>
                          <Text
                            style={[
                              styles.urgentText,
                              { fontFamily: "Inter_700Bold" },
                            ]}
                          >
                            🔥
                          </Text>
                        </View>
                      )}
                    </View>

                    {item.email && (
                      <Text
                        style={[
                          styles.custPhone,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                            textAlign,
                          },
                        ]}
                      >
                        {item.email}
                      </Text>
                    )}

                    <View style={[styles.tierRow, { flexDirection: rowDir }]}>
                      <Badge
                        label={t(`customers.${item.tier}`)}
                        style={{
                          borderWidth: 1,
                          borderColor: tierColor,
                          backgroundColor: tierColor + "20",
                        }}
                      />
                      <Text
                        style={[
                          styles.points,
                          { color: "#F9A602", fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {item.total_points} {t("common.points").toLowerCase()}
                      </Text>
                      <Text
                        style={[
                          styles.visits,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        · {item.visit_count}{" "}
                        {item.visit_count > 1 ? "visits" : "visit"}
                      </Text>
                    </View>

                    {/* Barre de progression */}
                    {item.next_reward && (
                      <View style={styles.progressSection}>
                        <View
                          style={[
                            styles.progressLabelRow,
                            { flexDirection: rowDir },
                          ]}
                        >
                          <Text
                            style={[
                              styles.progressLabel,
                              {
                                color: colors.mutedForeground,
                                fontFamily: "Inter_400Regular",
                              },
                            ]}
                          >
                            {item.next_reward.name}
                          </Text>
                          <Text
                            style={[
                              styles.progressPct,
                              {
                                color: merchantAccentColor,
                                fontFamily: "Inter_600SemiBold",
                              },
                            ]}
                          >
                            {item.remaining} {t("rewards.pointsRequired")}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.progressTrack,
                            { backgroundColor: colors.border },
                          ]}
                        >
                          <LinearGradient
                            colors={[merchantAccentColor, "#F9A602"]}
                            start={{ x: isRTL ? 1 : 0, y: 0 }}
                            end={{ x: isRTL ? 0 : 1, y: 0 }}
                            style={[
                              styles.progressFill,
                              { width: `${item.progress}%` as any },
                            ]}
                          />
                        </View>
                      </View>
                    )}

                    {!item.next_reward && (
                      <View
                        style={[
                          styles.rewardReady,
                          {
                            backgroundColor: "#F9A60215",
                            flexDirection: rowDir,
                          },
                        ]}
                      >
                        <Feather name="gift" size={iconSize(12)} color="#F9A602" />
                        <Text
                          style={[
                            styles.rewardReadyText,
                            { fontFamily: "Inter_600SemiBold" },
                          ]}
                        >
                          {t("customer.availableRewards")} 🎉
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Bouton ajustement */}
                  <TouchableOpacity
                    onPress={() => {
                      Keyboard.dismiss();
                      setSelectedCust(item);
                    }}
                    style={[
                      styles.adjustBtn,
                      {
                        backgroundColor: colors.muted,
                        borderRadius: colors.radius - 4,
                      },
                    ]}
                  >
                    <Feather name="edit-3" size={iconSize(16)} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </Card>
            );
          }}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={iconSize(40)} color={colors.mutedForeground} />
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
                {search ? t("common.error") : t("customers.noCustomers")}
              </Text>
            </View>
          }
        />

        {/* ── Modal ajustement points ── */}
        <Modal visible={!!selectedCust} transparent animationType="slide">
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
          >
            <View style={styles.modalOverlay}>
              <View
                style={[
                  styles.modalCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius * 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.modalTitle,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_700Bold",
                      textAlign,
                    },
                  ]}
                >
                  {t("customers.adjustPoints")}
                </Text>
                {selectedCust && (
                  <Text
                    style={[
                      styles.modalSubtitle,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        textAlign,
                      },
                    ]}
                  >
                    {selectedCust.first_name} {selectedCust.last_name} ·{" "}
                    {selectedCust.total_points}{" "}
                    {t("common.points").toLowerCase()}
                  </Text>
                )}
                <Input
                  label={t("common.points")}
                  placeholder="100"
                  value={adjustDelta}
                  onChangeText={setAdjustDelta}
                  keyboardType="number-pad"
                  leftIcon="zap"
                />
                <View style={[styles.adjustBtns, { flexDirection: rowDir }]}>
                  <Button
                    title={t("customers.addPoints")}
                    onPress={() => handleAdjust(true)}
                    variant="secondary"
                    loading={adjustLoading}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title={t("customers.removePoints")}
                    onPress={() => handleAdjust(false)}
                    variant="danger"
                    loading={adjustLoading}
                    style={{ flex: 1 }}
                  />
                </View>
                <Button
                  title={t("common.cancel")}
                  onPress={() => {
                    setSelectedCust(null);
                    setAdjustDelta("");
                  }}
                  variant="ghost"
                />
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, borderBottomWidth: 1 },
  title: { fontSize: fs(24) },
  list: { padding: 16 },
  customerCard: { marginBottom: 10 },
  row: { alignItems: "flex-start", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  avatarText: { fontSize: fs(18) },
  info: { flex: 1, gap: 4 },
  nameRow: { alignItems: "center", gap: 8 },
  custName: { fontSize: fs(15) },
  custPhone: { fontSize: fs(12) },
  tierRow: { alignItems: "center", gap: 8, marginTop: 2 },
  points: { fontSize: fs(14) },
  visits: { fontSize: fs(12) },
  urgentBadge: {
    backgroundColor: "rgba(249,166,2,0.15)",
    borderRadius: 99,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  urgentText: { fontSize: fs(12) },
  progressSection: { marginTop: 6, gap: 4 },
  progressLabelRow: { justifyContent: "space-between", alignItems: "center" },
  progressLabel: { fontSize: fs(11) },
  progressPct: { fontSize: fs(11) },
  progressTrack: { height: 5, borderRadius: 99, overflow: "hidden" },
  progressFill: { height: 5, borderRadius: 99 },
  rewardReady: {
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
    alignSelf: "flex-start",
  },
  rewardReadyText: { color: "#F9A602", fontSize: fs(11) },
  adjustBtn: { padding: 10, marginTop: 2 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: fs(15) },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: { padding: 28, gap: 16, margin: 12, marginBottom: 24 },
  modalTitle: { fontSize: fs(20) },
  modalSubtitle: { fontSize: fs(14), marginTop: -8 },
  adjustBtns: { gap: 12 },
});
