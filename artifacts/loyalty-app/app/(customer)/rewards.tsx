import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  Animated,
} from "react-native";
import { fs, iconSize } from "@/utils/responsive";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { supabase } from "@/lib/supabase";
import QRCode from "react-native-qrcode-svg";
import AsyncStorage from "@react-native-async-storage/async-storage";

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return (
    date.toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }) +
    " · " +
    date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
  );
}

// ✅ Type pour un groupe commerçant
type MerchantGroup = {
  merchant_id: string;
  business_name: string;
  customer_points: number;
  max_points: number; // max des récompenses
  rewards: any[];
  reachable: number; // nb récompenses atteintes
};

export default function CustomerRewardsScreen() {
  const colors = useColors();
  const { user, accentColor, language } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<"available" | "history">("available");
  const [customer, setCustomer] = useState<any>(null);
  const [merchantGroups, setMerchantGroups] = useState<MerchantGroup[]>([]);
  const [redemptions, setRedemptions] = useState<any[]>([]);

  // ✅ État pour le détail d'un commerçant
  const [selectedMerchant, setSelectedMerchant] =
    useState<MerchantGroup | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // QR
  const [showQR, setShowQR] = useState(false);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeReward, setActiveReward] = useState<any>(null);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(120);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]); // reward ids

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [toastColor, setToastColor] = useState("#27AE60");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  // Labels
  const labelTitle =
    language === "ar"
      ? "مكافآتي"
      : language === "en"
        ? "My rewards"
        : "Mes récompenses";
  const labelAvailable =
    language === "ar"
      ? "التجار"
      : language === "en"
        ? "Merchants"
        : "Commerçants";
  const labelHistory =
    language === "ar" ? "السجل" : language === "en" ? "History" : "Historique";
  const labelUse =
    language === "ar" ? "استخدام" : language === "en" ? "Use" : "Utiliser";
  const labelUsed =
    language === "ar" ? "مستخدم" : language === "en" ? "Used" : "Utilisé";
  const labelPresentQR =
    language === "ar"
      ? "اعرض رمز QR للتاجر"
      : language === "en"
        ? "Present this QR code to the merchant"
        : "Présentez ce QR code au commerçant";
  const labelExpires =
    language === "ar"
      ? "تنتهي في"
      : language === "en"
        ? "Expires in"
        : "Expire dans";
  const labelSecure =
    language === "ar"
      ? "🔒 هذا الرمز فريد وصالح مرة واحدة فقط"
      : language === "en"
        ? "🔒 This code is unique and valid once"
        : "🔒 Ce code est unique et valable une seule fois";
  const labelQRTitle =
    language === "ar"
      ? "رمز QR المكافأة"
      : language === "en"
        ? "Reward QR Code"
        : "QR Code récompense";
  const labelEmptyRewards =
    language === "ar"
      ? "قم بزيارة المتاجر لكسب المكافآت"
      : language === "en"
        ? "Visit stores to earn rewards"
        : "Visitez des commerces pour gagner des récompenses";
  const labelEmptyHistory =
    language === "ar"
      ? "لا يوجد سجل حتى الآن"
      : language === "en"
        ? "No history yet"
        : "Aucun historique pour le moment";
  const labelRewards =
    language === "ar" ? "مكافأة" : language === "en" ? "reward" : "récompense";
  const labelReached =
    language === "ar" ? "مبلغة" : language === "en" ? "reached" : "atteinte";
  const labelBack =
    language === "ar" ? "رجوع" : language === "en" ? "Back" : "Retour";

  function showToast(msg: string, color = "#27AE60") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastColor(color);
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  }

  // ✅ Favoris
  const FAVS_KEY = `@fav_rewards_${user?.id ?? "guest"}`;

  async function loadFavorites() {
    try {
      const raw = await AsyncStorage.getItem(FAVS_KEY);
      setFavorites(raw ? JSON.parse(raw) : []);
    } catch {}
  }

  async function toggleFavorite(rewardId: string) {
    try {
      const next = favorites.includes(rewardId)
        ? favorites.filter((id: string) => id !== rewardId)
        : [...favorites, rewardId];
      setFavorites(next);
      await AsyncStorage.setItem(FAVS_KEY, JSON.stringify(next));
    } catch {}
  }

  useFocusEffect(
    useCallback(() => {
      loadData();
      loadFavorites();
    }, [user?.id]),
  );

  useEffect(() => {
    if (!showQR || !tokenExpiry) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((tokenExpiry.getTime() - Date.now()) / 1000),
      );
      setCountdown(remaining);
      if (remaining === 0) {
        setShowQR(false);
        setActiveToken(null);
        setActiveReward(null);
        showToast(
          language === "ar"
            ? "⏱ انتهت صلاحية الرمز"
            : language === "en"
              ? "⏱ QR code expired"
              : "⏱ QR code expiré.",
          "#E67E22",
        );
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [showQR, tokenExpiry]);

  useEffect(() => {
    if (!activeToken || !showQR) return;
    const channel = supabase
      .channel(`redemption-used-${activeToken}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "redemption_tokens",
          filter: `token=eq.${activeToken}`,
        },
        (payload) => {
          if (payload.new?.used_at) {
            setShowQR(false);
            setActiveToken(null);
            setActiveReward(null);
            showToast(
              language === "ar"
                ? "🎁 تم تطبيق المكافأة بنجاح!"
                : language === "en"
                  ? "🎁 Reward validated!"
                  : "🎁 Récompense validée !",
            );
            loadData();
            setShowDetail(false);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeToken, showQR]);

  async function loadData() {
    if (!user?.id) return;
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!customerData) return;
    setCustomer(customerData);

    // Charger les points par commerçant
    const { data: merchantPoints } = await supabase
      .from("customer_merchant_points")
      .select("merchant_id, total_points, business_name")
      .eq("customer_id", customerData.id);

    if (merchantPoints && merchantPoints.length > 0) {
      const merchantIds = merchantPoints.map((m: any) => m.merchant_id);
      const { data: rewards } = await supabase
        .from("rewards")
        .select("*")
        .in("merchant_id", merchantIds)
        .eq("is_active", true)
        .order("points_required", { ascending: true });

      // ✅ Grouper par commerçant
      const groups: MerchantGroup[] = merchantIds
        .map((merchantId: string) => {
          const mp = merchantPoints.find(
            (m: any) => m.merchant_id === merchantId,
          )!;
          const merchantRewards = (rewards ?? [])
            .filter((r: any) => r.merchant_id === merchantId)
            .map((r: any) => ({
              ...r,
              customer_points: mp.total_points ?? 0,
              merchant_name_label: mp.business_name,
            }));
          const maxPoints =
            merchantRewards.length > 0
              ? Math.max(...merchantRewards.map((r: any) => r.points_required))
              : 0;
          const reachable = merchantRewards.filter(
            (r: any) => (mp.total_points ?? 0) >= r.points_required,
          ).length;
          return {
            merchant_id: merchantId,
            business_name: mp.business_name,
            customer_points: mp.total_points ?? 0,
            max_points: maxPoints,
            rewards: merchantRewards,
            reachable,
          };
        })
        .filter((g: MerchantGroup) => g.rewards.length > 0);

      setMerchantGroups(groups);

      // Mettre à jour le détail si ouvert
      if (selectedMerchant) {
        const updated = groups.find(
          (g) => g.merchant_id === selectedMerchant.merchant_id,
        );
        if (updated) setSelectedMerchant(updated);
      }
    } else {
      setMerchantGroups([]);
    }

    const { data: redemptionData } = await supabase
      .from("redemptions")
      .select("*")
      .eq("customer_id", customerData.id)
      .order("redeemed_at", { ascending: false });
    setRedemptions(redemptionData ?? []);
  }

  async function handleGenerateToken(reward: any) {
    if (!customer) return;
    setGeneratingToken(true);
    try {
      const { data: currentPoints } = await supabase
        .from("customer_merchant_points")
        .select("total_points")
        .eq("customer_id", customer.id)
        .eq("merchant_id", reward.merchant_id)
        .maybeSingle();
      const solde = Math.max(0, currentPoints?.total_points ?? 0);
      if (solde < reward.points_required) {
        Alert.alert(
          language === "ar"
            ? "نقاط غير كافية"
            : language === "en"
              ? "Insufficient points"
              : "Points insuffisants",
          language === "ar"
            ? `تحتاج ${reward.points_required} نقطة. لديك ${solde} نقطة.`
            : language === "en"
              ? `You need ${reward.points_required} pts. You have ${solde} pts.`
              : `Il vous faut ${reward.points_required} pts.\nVous avez ${solde} pts.`,
        );
        return;
      }
      const { nanoid } = await import("nanoid/non-secure");
      const token = `REDEEM-${nanoid(16).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
      await supabase
        .from("redemption_tokens")
        .delete()
        .eq("customer_id", customer.id)
        .eq("reward_id", reward.id)
        .is("used_at", null);
      const { error } = await supabase.from("redemption_tokens").insert({
        id: nanoid(),
        customer_id: customer.id,
        reward_id: reward.id,
        merchant_id: reward.merchant_id,
        token,
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;
      setActiveToken(token);
      setActiveReward(reward);
      setTokenExpiry(expiresAt);
      setCountdown(120);
      // ✅ Fermer le modal détail d'abord puis afficher QR
      setShowDetail(false);
      setTimeout(() => setShowQR(true), 350);
    } catch (err: any) {
      Alert.alert(
        t("common.error"),
        err.message || "Impossible de générer le QR code.",
      );
    } finally {
      setGeneratingToken(false);
    }
  }

  // ── LISTE DES COMMERÇANTS ──
  const renderMerchantGroup = ({ item }: { item: MerchantGroup }) => {
    const progress =
      item.max_points > 0
        ? Math.min(1, item.customer_points / item.max_points)
        : 0;
    const hasReachable = item.reachable > 0;
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => {
          setSelectedMerchant(item);
          setShowDetail(true);
        }}
      >
        <Card style={{ marginBottom: 10 }}>
          <View style={styles.groupRow}>
            {/* Icône */}
            <View
              style={[
                styles.groupIcon,
                {
                  backgroundColor: hasReachable
                    ? accentColor + "20"
                    : colors.muted,
                },
              ]}
            >
              <Feather
                name="shopping-bag"
                size={22}
                color={hasReachable ? accentColor : colors.mutedForeground}
              />
            </View>
            {/* Infos */}
            <View style={{ flex: 1, gap: 4 }}>
              <Text
                style={[
                  styles.groupName,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {item.business_name}
              </Text>
              <Text
                style={[
                  styles.groupSub,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {item.rewards.length} {labelRewards}
                {item.rewards.length > 1 ? "s" : ""} · {item.reachable}{" "}
                {labelReached}
                {item.reachable > 1 ? "s" : ""}
              </Text>
              {/* Barre de progression */}
              <View style={styles.groupProgressRow}>
                <Text
                  style={[
                    styles.groupPoints,
                    {
                      color: hasReachable
                        ? accentColor
                        : colors.mutedForeground,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {item.customer_points} / {item.max_points} pts
                </Text>
              </View>
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
                      width: `${(progress * 100).toFixed(0)}%` as any,
                      backgroundColor: hasReachable
                        ? accentColor
                        : colors.primary,
                    },
                  ]}
                />
              </View>
            </View>
            {/* Badge récompenses atteintes */}
            <View style={{ alignItems: "flex-end", gap: 6 }}>
              {hasReachable && (
                <View
                  style={[
                    styles.reachableBadge,
                    { backgroundColor: accentColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.reachableText,
                      { fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {item.reachable} 🎁
                  </Text>
                </View>
              )}
              <Feather
                name="chevron-right"
                size={18}
                color={colors.mutedForeground}
              />
            </View>
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

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
          {labelTitle}
        </Text>
        <View style={styles.tabRow}>
          {(["available", "history"] as const).map((tabKey) => (
            <TouchableOpacity
              key={tabKey}
              onPress={() => setTab(tabKey)}
              style={[
                styles.tab,
                {
                  borderBottomColor:
                    tab === tabKey ? colors.primary : "transparent",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      tab === tabKey ? colors.primary : colors.mutedForeground,
                    fontFamily:
                      tab === tabKey ? "Inter_600SemiBold" : "Inter_400Regular",
                  },
                ]}
              >
                {tabKey === "available" ? labelAvailable : labelHistory}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {tab === "available" ? (
        <FlatList
          data={merchantGroups}
          keyExtractor={(g) => g.merchant_id}
          renderItem={renderMerchantGroup}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="gift" size={iconSize(40)} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {labelEmptyRewards}
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
                  <Feather name="check" size={iconSize(16)} color={colors.secondary} />
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
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text
                    style={{
                      color: "#E74C3C",
                      fontFamily: "Inter_700Bold",
                      fontSize: fs(15),
                    }}
                  >
                    -{item.points_spent ?? "?"} pts
                  </Text>
                  <Badge label={labelUsed} variant="success" />
                </View>
              </View>
            </Card>
          )}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clock" size={iconSize(40)} color={colors.mutedForeground} />
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {labelEmptyHistory}
              </Text>
            </View>
          }
        />
      )}

      {/* ── Modal Détail Commerçant ── */}
      <Modal visible={showDetail} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[styles.detailCard, { backgroundColor: colors.background }]}
          >
            {/* Header */}
            <View
              style={[
                styles.detailHeader,
                { borderBottomColor: colors.border },
              ]}
            >
              <TouchableOpacity
                onPress={() => setShowDetail(false)}
                style={styles.backBtn}
              >
                <Feather
                  name="arrow-left"
                  size={22}
                  color={colors.foreground}
                />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.detailTitle,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {selectedMerchant?.business_name}
                </Text>
                <Text
                  style={[
                    styles.detailPts,
                    { color: accentColor, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {selectedMerchant?.customer_points} /{" "}
                  {selectedMerchant?.max_points} pts
                </Text>
              </View>
            </View>

            {/* Liste des récompenses du commerçant */}
            <FlatList
              data={selectedMerchant?.rewards ?? []}
              keyExtractor={(r) => r.id}
              contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
              renderItem={({ item }) => {
                const canRedeem = item.customer_points >= item.points_required;
                const progress = Math.min(
                  1,
                  item.customer_points / item.points_required,
                );
                return (
                  <Card style={{ marginBottom: 10 }}>
                    <View style={styles.rewardRow}>
                      <View
                        style={[
                          styles.rewardIcon,
                          {
                            backgroundColor: canRedeem
                              ? accentColor + "20"
                              : colors.muted,
                          },
                        ]}
                      >
                        <Feather
                          name="gift"
                          size={20}
                          color={
                            canRedeem ? accentColor : colors.mutedForeground
                          }
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
                            styles.rewardPoints,
                            {
                              color: canRedeem
                                ? accentColor
                                : colors.mutedForeground,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {item.customer_points} / {item.points_required} pts
                        </Text>
                        {canRedeem && (
                          <Text
                            style={{
                              color: accentColor,
                              fontSize: fs(10),
                              fontFamily: "Inter_600SemiBold",
                            }}
                          >
                            ✓{" "}
                            {language === "ar"
                              ? "متاح"
                              : language === "en"
                                ? "Available"
                                : "Disponible"}
                          </Text>
                        )}
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
                                width: `${(progress * 100).toFixed(0)}%` as any,
                                backgroundColor: canRedeem
                                  ? accentColor
                                  : colors.primary,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() =>
                          canRedeem ? handleGenerateToken(item) : null
                        }
                        activeOpacity={canRedeem ? 0.8 : 1}
                        disabled={generatingToken}
                        style={[
                          styles.useBtn,
                          {
                            backgroundColor: canRedeem
                              ? colors.primary
                              : colors.border,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.useBtnText,
                            {
                              fontFamily: "Inter_600SemiBold",
                              color: canRedeem
                                ? "#fff"
                                : colors.mutedForeground,
                            },
                          ]}
                        >
                          {generatingToken ? "..." : labelUse}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => toggleFavorite(item.id)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{ marginTop: 6, alignItems: "center" }}
                      >
                        <Feather
                          name={favorites.includes(item.id) ? "star" : "star"}
                          size={20}
                          color={
                            favorites.includes(item.id)
                              ? "#F9A602"
                              : colors.mutedForeground
                          }
                          style={{
                            opacity: favorites.includes(item.id) ? 1 : 0.35,
                          }}
                        />
                      </TouchableOpacity>
                    </View>
                  </Card>
                );
              }}
            />
          </View>
        </View>
      </Modal>

      {/* ── Modal QR Code ── */}
      <Modal visible={showQR} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text
                style={[
                  styles.modalTitle,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {labelQRTitle}
              </Text>
              <TouchableOpacity onPress={() => setShowQR(false)}>
                <Feather name="x" size={iconSize(22)} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            {activeReward && (
              <View
                style={[
                  styles.rewardInfo,
                  { backgroundColor: accentColor + "15", borderRadius: 12 },
                ]}
              >
                <Text
                  style={[
                    styles.rewardInfoName,
                    { color: accentColor, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {activeReward.name}
                </Text>
                <Text
                  style={[
                    styles.rewardInfoMerchant,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {activeReward.merchant_name_label} ·{" "}
                  {activeReward.points_required} pts
                </Text>
              </View>
            )}
            {activeToken && (
              <View style={styles.qrContainer}>
                <View style={styles.qrWrap}>
                  <QRCode
                    value={activeToken}
                    size={200}
                    color="#1a1a2e"
                    backgroundColor="white"
                  />
                </View>
                <Text
                  style={[
                    styles.qrHint,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {labelPresentQR}
                </Text>
              </View>
            )}
            <View
              style={[
                styles.countdownWrap,
                {
                  backgroundColor:
                    countdown <= 30 ? "#E74C3C15" : accentColor + "15",
                },
              ]}
            >
              <Feather
                name="clock"
                size={16}
                color={countdown <= 30 ? "#E74C3C" : accentColor}
              />
              <Text
                style={[
                  styles.countdownText,
                  {
                    color: countdown <= 30 ? "#E74C3C" : accentColor,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                {labelExpires} {Math.floor(countdown / 60)}:
                {String(countdown % 60).padStart(2, "0")}
              </Text>
            </View>
            <Text
              style={[
                styles.securityNote,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {labelSecure}
            </Text>
          </View>
        </View>
      </Modal>

      {/* ── Toast ── */}
      {toastVisible && (
        <Animated.View
          style={[
            styles.toast,
            { backgroundColor: toastColor, opacity: toastOpacity },
          ]}
        >
          <Feather name="check-circle" size={iconSize(18)} color="#fff" />
          <Text style={[styles.toastText, { fontFamily: "Inter_600SemiBold" }]}>
            {toastMsg}
          </Text>
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1 },
  title: { fontSize: fs(24), marginBottom: 12 },
  tabRow: { flexDirection: "row" },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingBottom: 10,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: fs(14) },
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: fs(15), textAlign: "center" },
  groupRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  groupIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  groupName: { fontSize: fs(15) },
  groupSub: { fontSize: fs(12) },
  groupProgressRow: { flexDirection: "row", justifyContent: "space-between" },
  groupPoints: { fontSize: fs(12) },
  reachableBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 99,
  },
  reachableText: { color: "#fff", fontSize: fs(12) },
  detailCard: {
    flex: 1,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  detailTitle: { fontSize: fs(18) },
  detailPts: { fontSize: fs(13), marginTop: 2 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rewardIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardName: { fontSize: fs(14) },
  rewardPoints: { fontSize: fs(12) },
  progressTrack: {
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
    marginTop: 4,
  },
  progressFill: { height: 4, borderRadius: 99 },
  useBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  useBtnText: { fontSize: fs(13) },
  historyRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  checkBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  historyName: { fontSize: fs(14) },
  historyMerchant: { fontSize: fs(13) },
  historyDate: { fontSize: fs(11), marginTop: 2 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  modalTitle: { fontSize: fs(18) },
  rewardInfo: { padding: 14, marginBottom: 20, alignItems: "center" },
  rewardInfoName: { fontSize: fs(16) },
  rewardInfoMerchant: { fontSize: fs(13), marginTop: 4 },
  qrContainer: { alignItems: "center", gap: 12, marginBottom: 20 },
  qrWrap: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrHint: { fontSize: fs(13), textAlign: "center" },
  countdownWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: "center",
  },
  countdownText: { fontSize: fs(16) },
  securityNote: { fontSize: fs(12), textAlign: "center" },
  toast: {
    position: "absolute",
    bottom: 100,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 16,
    borderRadius: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  toastText: { color: "#fff", fontSize: fs(14), flex: 1 },
  starBtn: { padding: 4, alignItems: "center", justifyContent: "center" },
});
