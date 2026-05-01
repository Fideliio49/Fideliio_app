import React, { useCallback, useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  StatusBar,
  Animated,
} from "react-native";
import { fs, iconSize } from "@/utils/responsive";
import { useRouter, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { TransactionRow } from "@/components/TransactionRow";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";
import { RewardQRModal } from "@/components/RewardQRModal";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  restaurant: "coffee",
  clothing: "shopping-bag",
  hairSalon: "scissors",
  hotel: "home",
  other: "star",
};

const STATUS_BAR_HEIGHT =
  Platform.OS === "ios" ? 54 : (StatusBar.currentHeight ?? 24);

function ZelligeOverlay({ width, height }: { width: number; height: number }) {
  const s = 22;
  const parts: string[] = [];
  for (let row = -1; row <= Math.ceil(height / s) + 1; row++) {
    for (let col = -1; col <= Math.ceil(width / s) + 1; col++) {
      const cx = col * s + (row % 2 === 0 ? 0 : s / 2);
      const cy = row * s;
      const r = s * 0.4;
      parts.push(
        `M${cx.toFixed(1)} ${(cy - r).toFixed(1)} L${(cx + r).toFixed(1)} ${cy.toFixed(1)} L${cx.toFixed(1)} ${(cy + r).toFixed(1)} L${(cx - r).toFixed(1)} ${cy.toFixed(1)} Z`,
      );
    }
  }
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width={width} height={height}>
        <Path
          d={parts.join(" ")}
          fill="none"
          stroke="white"
          strokeWidth={0.7}
          opacity={0.08}
        />
      </Svg>
    </View>
  );
}

function PointsToast({
  message,
  visible,
  accentColor,
}: {
  message: string;
  visible: boolean;
  accentColor: string;
}) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          tension: 80,
          friction: 10,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);
  return (
    <Animated.View
      style={[
        styles.toast,
        { backgroundColor: accentColor, transform: [{ translateY }], opacity },
      ]}
      pointerEvents="none"
    >
      <View style={styles.toastInner}>
        <View style={styles.toastIconWrap}>
          <Feather name="zap" size={iconSize(20)} color="#fff" />
        </View>
        <Text style={[styles.toastText, { fontFamily: "Inter_700Bold" }]}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

export default function CustomerHomeScreen() {
  const colors = useColors();
  const { user, accentColor, colorTheme, language } = useApp();
  const { t } = useTranslation();
  const isDark = colorTheme === "dark";
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [customer, setCustomer] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [redeemableRewards, setRedeemableRewards] = useState<any[]>([]);
  const [progressItems, setProgressItems] = useState<any[]>([]);
  const [nextTarget, setNextTarget] = useState(200);
  const [merchantPoints, setMerchantPoints] = useState<any[]>([]);
  const [showQRModal, setShowQRModal] = useState(false);
  const [favRewardIds, setFavRewardIds] = useState<string[]>([]);
  const [favRewards, setFavRewards] = useState<any[]>([]);
  const [selectedReward, setSelectedReward] = useState<any>(null);
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const customerRef = useRef<any>(null);

  const topPad = Platform.OS === "web" ? 67 : STATUS_BAR_HEIGHT;
  const bottomPad = Platform.OS === "web" ? 34 : 0;
  const heroPatternHeight = topPad + 240;
  const progress = Math.min(1, totalPoints / Math.max(1, nextTarget));

  // ✅ Textes traduits
  const labelHello =
    language === "ar" ? "مرحباً،" : language === "en" ? "Hello," : "Bonjour,";
  const labelPoints = t("common.points").toLowerCase();
  const labelNextReward =
    language === "ar"
      ? "المكافأة التالية في"
      : language === "en"
        ? "Next reward in"
        : "Prochaine récompense dans";
  const labelAlmostThere =
    language === "ar"
      ? "تقريباً!"
      : language === "en"
        ? "Almost there!"
        : "Presque là !";
  const labelSeeAll =
    language === "ar"
      ? "عرض الكل"
      : language === "en"
        ? "See all"
        : "Voir tous";
  const labelAvailableRewards =
    language === "ar"
      ? "المكافآت المتاحة"
      : language === "en"
        ? "Available rewards"
        : "Récompenses disponibles";
  const labelRecentActivity =
    language === "ar"
      ? "النشاط الأخير"
      : language === "en"
        ? "Recent activity"
        : "Activité récente";
  const labelNoTransactions =
    language === "ar"
      ? "لا توجد معاملات"
      : language === "en"
        ? "No transactions yet"
        : "Aucune transaction pour le moment";
  const labelUse =
    language === "ar" ? "استخدام" : language === "en" ? "Use" : "Utiliser";
  const labelReward =
    language === "ar"
      ? "مكافأة:"
      : language === "en"
        ? "Reward:"
        : "Récompense :";
  const labelRemaining =
    language === "ar" ? "متبقية" : language === "en" ? "remaining" : "restants";
  const labelAlmostBadge =
    language === "ar"
      ? "🔥 تقريباً!"
      : language === "en"
        ? "🔥 Almost!"
        : "🔥 Presque !";

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 3500);
  }

  useEffect(() => {
    if (!customerRef.current?.id) return;
    const channel = supabase
      .channel(`customer-tx-home-${customerRef.current.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "transactions",
          filter: `customer_id=eq.${customerRef.current.id}`,
        },
        (payload) => {
          const tx = payload.new as any;
          if (tx.points_earned > 0) {
            const msg =
              language === "ar"
                ? `+${tx.points_earned} نقطة من ${tx.merchant_name} 🎉`
                : language === "en"
                  ? `+${tx.points_earned} points earned at ${tx.merchant_name}! 🎉`
                  : `+${tx.points_earned} points gagnés chez ${tx.merchant_name} ! 🎉`;
            showToast(msg);
            loadData();
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerRef.current?.id, language]);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android")
        StatusBar.setBackgroundColor("transparent", true);
      loadData();
      loadFavorites();
    }, [user?.id]),
  );

  async function loadFavorites() {
    if (!user?.id) return;
    try {
      const key = `@fav_rewards_${user.id}`;
      const raw = await AsyncStorage.getItem(key);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setFavRewardIds(ids);
      return ids;
    } catch {
      return [];
    }
  }

  async function loadData() {
    if (!user?.id) return;
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!customerData) return;
    setCustomer(customerData);
    customerRef.current = customerData;

    const { data: pointsData } = await supabase
      .from("customer_total_points")
      .select("total_points")
      .eq("customer_id", customerData.id)
      .maybeSingle();
    setTotalPoints(pointsData?.total_points ?? 0);

    const { data: txData } = await supabase
      .from("transactions")
      .select("*")
      .eq("customer_id", customerData.id)
      .gt("points_earned", 0)
      .order("created_at", { ascending: false })
      .limit(5);
    setTransactions(txData ?? []);

    const { data: progressData } = await supabase
      .from("customer_reward_progress")
      .select("*")
      .eq("customer_id", customerData.id)
      .gte("progress_percent", 80)
      .order("progress_percent", { ascending: false })
      .limit(3);
    setProgressItems(progressData ?? []);

    const { data: mpData } = await supabase
      .from("customer_merchant_points")
      .select("merchant_id, total_points")
      .eq("customer_id", customerData.id);
    setMerchantPoints(mpData ?? []);

    if (mpData && mpData.length > 0) {
      const merchantIds = mpData.map((m: any) => m.merchant_id);
      const { data: rewards } = await supabase
        .from("rewards")
        .select("*")
        .in("merchant_id", merchantIds)
        .eq("is_active", true);
      const redeemable = (rewards ?? []).filter((r: any) => {
        const mp = mpData.find((m: any) => m.merchant_id === r.merchant_id);
        return mp && mp.total_points >= r.points_required;
      });
      setRedeemableRewards(redeemable);

      // ✅ Construire la liste des favoris (par ids)
      const key = `@fav_rewards_${user?.id}`;
      const raw = await AsyncStorage.getItem(key);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      setFavRewardIds(ids);
      const favs = (rewards ?? [])
        .filter((r: any) => ids.includes(r.id))
        .map((r: any) => {
          const mp = mpData.find((m: any) => m.merchant_id === r.merchant_id);
          return {
            ...r,
            customer_points: mp?.total_points ?? 0,
            merchant_name: r.merchant_name ?? mp?.business_name,
          };
        });
      setFavRewards(favs);
      const nonRedeemable = (rewards ?? []).filter((r: any) => {
        const mp = mpData.find((m: any) => m.merchant_id === r.merchant_id);
        return !mp || mp.total_points < r.points_required;
      });
      if (nonRedeemable.length > 0) {
        setNextTarget(
          Math.min(...nonRedeemable.map((r: any) => r.points_required)),
        );
      }
    }
  }

  function openQRModal(reward: any) {
    setSelectedReward(reward);
    setShowQRModal(true);
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#C85A17" }}>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="light-content"
      />
      <PointsToast
        message={toastMsg}
        visible={toastVisible}
        accentColor={accentColor}
      />

      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 + bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={["#C85A17", "#E67E22", "#7B2D8B"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.3, y: 1 }}
          style={[styles.hero, { paddingTop: topPad }]}
        >
          <ZelligeOverlay width={width} height={heroPatternHeight} />
          <Text style={[styles.welcome, { fontFamily: "Inter_400Regular" }]}>
            {labelHello} {customer?.first_name} 👋
          </Text>
          <View style={styles.pointsRow}>
            <Text style={[styles.pointsValue, { fontFamily: "Inter_700Bold" }]}>
              {totalPoints}
            </Text>
            <Text
              style={[styles.pointsLabel, { fontFamily: "Inter_400Regular" }]}
            >
              {labelPoints}
            </Text>
          </View>
          <View style={styles.progressSection}>
            <Text
              style={[
                styles.progressSubLabel,
                { fontFamily: "Inter_400Regular" },
              ]}
            >
              {labelNextReward}
            </Text>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${(progress * 100).toFixed(0)}%` as any },
                ]}
              />
            </View>
            <Text
              style={[styles.progressCount, { fontFamily: "Inter_400Regular" }]}
            >
              {totalPoints} / {nextTarget}
            </Text>
          </View>
        </LinearGradient>

        <View style={[styles.content, { backgroundColor: colors.background }]}>
          {progressItems.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View
                  style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
                >
                  <Feather name="map-pin" size={iconSize(16)} color={colors.foreground} />
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {labelAlmostThere}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/(customer)/merchants")}
                >
                  <Text
                    style={[
                      styles.viewAll,
                      {
                        color: accentColor,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: fs(13),
                      },
                    ]}
                  >
                    {labelSeeAll}
                  </Text>
                </TouchableOpacity>
              </View>
              {progressItems.map((item: any) => {
                const pct = item.progress_percent;
                const remaining = item.points_remaining;
                const icon = CATEGORY_ICONS[item.category] ?? "star";
                const isUrgent = pct >= 95;
                return (
                  <TouchableOpacity
                    key={item.merchant_id}
                    onPress={() => router.push("/(customer)/merchants")}
                    activeOpacity={0.8}
                    style={[
                      styles.progressCard,
                      {
                        backgroundColor: isDark ? "#1E1E1E" : "#FFFFFF",
                        borderColor: isDark ? "#333333" : "#E0E0E0",
                      },
                    ]}
                  >
                    {isUrgent && (
                      <View
                        style={[
                          styles.urgencyBadge,
                          { alignSelf: "flex-end", marginBottom: 6 },
                        ]}
                      >
                        <Text
                          style={[
                            styles.urgencyText,
                            { fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {labelAlmostBadge}
                        </Text>
                      </View>
                    )}
                    <View style={styles.progressCardRow}>
                      <View
                        style={[
                          styles.categoryIcon,
                          { backgroundColor: accentColor + "26" },
                        ]}
                      >
                        <Feather name={icon} size={iconSize(18)} color={accentColor} />
                      </View>
                      <View style={styles.progressCardInfo}>
                        <Text
                          style={[
                            styles.progressMerchantName,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {item.business_name}
                        </Text>
                        <Text
                          style={[
                            styles.progressRewardLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {labelReward} {item.reward_name}
                        </Text>
                      </View>
                      <View style={styles.progressPointsCol}>
                        <Text
                          style={[
                            styles.progressPoints,
                            { color: accentColor, fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {remaining} pts
                        </Text>
                        <Text
                          style={[
                            styles.progressPointsLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {labelRemaining}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.progressBarSection}>
                      <Text
                        style={[
                          styles.progressPct,
                          { color: accentColor, fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {Math.round(pct)}%
                      </Text>
                      <View
                        style={[
                          styles.progressTrackBar,
                          { backgroundColor: isDark ? "#333333" : "#E0E0E0" },
                        ]}
                      >
                        <LinearGradient
                          colors={[accentColor, "#F9A602"]}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 0 }}
                          style={[
                            styles.progressFillBar,
                            { width: `${pct}%` as any },
                          ]}
                        />
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ✅ Mes favoris */}
          {favRewards.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.foreground, fontFamily: "Inter_700Bold" },
                  ]}
                >
                  {language === "ar"
                    ? "⭐ المفضلة"
                    : language === "en"
                      ? "⭐ Favorites"
                      : "⭐ Mes favoris"}
                </Text>
                <TouchableOpacity
                  onPress={() => router.push("/(customer)/rewards")}
                >
                  <Text
                    style={[
                      styles.viewAll,
                      {
                        color: accentColor,
                        fontFamily: "Inter_600SemiBold",
                        fontSize: fs(13),
                      },
                    ]}
                  >
                    {labelSeeAll}
                  </Text>
                </TouchableOpacity>
              </View>
              {favRewards.slice(0, 3).map((reward: any) => {
                const canRedeem =
                  (reward.customer_points ?? 0) >= reward.points_required;
                return (
                  <Card key={reward.id} style={{ marginBottom: 10 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                      }}
                    >
                      <View
                        style={[
                          styles.categoryIcon,
                          {
                            backgroundColor: canRedeem
                              ? "#F9A60220"
                              : colors.muted,
                          },
                        ]}
                      >
                        <Feather
                          name="gift"
                          size={iconSize(18)}
                          color={canRedeem ? "#F9A602" : colors.mutedForeground}
                        />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text
                          style={[
                            styles.progressMerchantName,
                            {
                              color: colors.foreground,
                              fontFamily: "Inter_700Bold",
                            },
                          ]}
                        >
                          {reward.name}
                        </Text>
                        <Text
                          style={[
                            styles.progressRewardLabel,
                            {
                              color: colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {reward.merchant_name} · {reward.customer_points ?? 0}
                          /{reward.points_required} pts
                        </Text>
                        {/* Mini barre de progression */}
                        <View
                          style={[
                            styles.progressTrackBar,
                            {
                              backgroundColor: colors.border,
                              height: 3,
                              marginTop: 2,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.progressFillBar,
                              {
                                width:
                                  `${Math.min(100, ((reward.customer_points ?? 0) / reward.points_required) * 100).toFixed(0)}%` as any,
                                backgroundColor: canRedeem
                                  ? "#F9A602"
                                  : accentColor,
                                height: 3,
                              },
                            ]}
                          />
                        </View>
                      </View>
                      {canRedeem ? (
                        <TouchableOpacity
                          onPress={() => openQRModal(reward)}
                          style={[
                            styles.useBtn,
                            { backgroundColor: accentColor },
                          ]}
                        >
                          <Text
                            style={[
                              styles.useBtnText,
                              { fontFamily: "Inter_600SemiBold" },
                            ]}
                          >
                            {labelUse}
                          </Text>
                        </TouchableOpacity>
                      ) : (
                        <View
                          style={[
                            styles.useBtn,
                            { backgroundColor: colors.border },
                          ]}
                        >
                          <Text
                            style={[
                              styles.useBtnText,
                              {
                                fontFamily: "Inter_600SemiBold",
                                color: colors.mutedForeground,
                              },
                            ]}
                          >
                            {reward.points_required -
                              (reward.customer_points ?? 0)}{" "}
                            pts
                          </Text>
                        </View>
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.foreground, fontFamily: "Inter_700Bold" },
                ]}
              >
                {labelRecentActivity}
              </Text>
              <TouchableOpacity
                onPress={() => router.push("/(customer)/merchants")}
              >
                <Text
                  style={[
                    styles.viewAll,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  {labelSeeAll}
                </Text>
              </TouchableOpacity>
            </View>
            <Card
              padding={0}
              style={{
                overflow: "hidden",
                borderWidth: 0.5,
                borderColor: "#E0E0E0",
                borderRadius: 16,
              }}
            >
              {transactions.length === 0 ? (
                <View style={styles.emptyWrap}>
                  <Feather name="star" size={iconSize(36)} color="#F9A602" />
                  <Text
                    style={[
                      styles.emptyText,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {labelNoTransactions}
                  </Text>
                </View>
              ) : (
                <View style={{ paddingHorizontal: 16 }}>
                  {transactions.map((tx: any) => (
                    <TransactionRow
                      key={tx.id}
                      transaction={{
                        id: tx.id,
                        merchantName: tx.merchant_name,
                        pointsEarned: tx.points_earned,
                        amount: tx.amount,
                        createdAt: tx.created_at,
                        type: "earn",
                      }}
                    />
                  ))}
                </View>
              )}
            </Card>
          </View>
        </View>
      </ScrollView>

      <RewardQRModal
        visible={showQRModal}
        reward={selectedReward}
        customer={customer}
        onClose={() => {
          setShowQRModal(false);
          setSelectedReward(null);
        }}
        onValidated={() => loadData()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  hero: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: "hidden",
  },
  welcome: { color: "rgba(255,255,255,0.9)", fontSize: fs(16), marginBottom: 8 },
  pointsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 20,
  },
  pointsValue: { color: "#F9A602", fontSize: fs(48), lineHeight: fs(54) },
  pointsLabel: { color: "rgba(255,255,255,0.85)", fontSize: fs(18) },
  progressSection: { gap: 6 },
  progressSubLabel: { color: "rgba(255,255,255,0.75)", fontSize: fs(12) },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: { height: 8, backgroundColor: "#F9A602", borderRadius: 99 },
  progressCount: {
    color: "rgba(255,255,255,0.85)",
    fontSize: fs(12),
    textAlign: "right",
  },
  content: { padding: 20, marginTop: 4 },
  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: { fontSize: fs(17) },
  viewAll: { fontSize: fs(14) },
  emptyWrap: { padding: 36, alignItems: "center", gap: 12 },
  emptyText: { fontSize: fs(14), textAlign: "center" },
  progressCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
  },
  urgencyBadge: {
    backgroundColor: "rgba(249,166,2,0.15)",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  urgencyText: { color: "#F9A602", fontSize: fs(10) },
  progressCardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  progressCardInfo: { flex: 1, gap: 2 },
  progressMerchantName: { fontSize: fs(14) },
  progressRewardLabel: { fontSize: fs(12) },
  progressPointsCol: { alignItems: "flex-end", gap: 1 },
  progressPoints: { fontSize: fs(14) },
  progressPointsLabel: { fontSize: fs(11) },
  progressBarSection: { gap: 4 },
  progressPct: { fontSize: fs(11), textAlign: "right" },
  progressTrackBar: { height: 6, borderRadius: 99, overflow: "hidden" },
  progressFillBar: { height: 6, borderRadius: 99 },
  useBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 99 },
  useBtnText: { color: "#fff", fontSize: fs(13) },
  toast: {
    position: "absolute",
    top: STATUS_BAR_HEIGHT + 12,
    left: 16,
    right: 16,
    borderRadius: 16,
    zIndex: 9999,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 10,
  },
  toastInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  toastIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  toastText: { color: "#fff", fontSize: fs(15), flex: 1 },
});
