import React, { useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  useWindowDimensions,
  StatusBar,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import Svg, { Path } from "react-native-svg";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { RewardCard } from "@/components/RewardCard";
import { TransactionRow } from "@/components/TransactionRow";
import { Card } from "@/components/ui/Card";

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  restaurant: "coffee",
  clothing: "shopping-bag",
  hairSalon: "scissors",
  hotel: "home",
  other: "star",
};

const STATUSBAR_HEIGHT = Platform.OS === "ios" ? 44 : (StatusBar.currentHeight ?? 0);

function ZelligeOverlay({ width, height }: { width: number; height: number }) {
  const s = 22;
  const parts: string[] = [];
  for (let row = -1; row <= Math.ceil(height / s) + 1; row++) {
    for (let col = -1; col <= Math.ceil(width / s) + 1; col++) {
      const cx = col * s + (row % 2 === 0 ? 0 : s / 2);
      const cy = row * s;
      const r = s * 0.4;
      parts.push(
        `M${cx.toFixed(1)} ${(cy - r).toFixed(1)} L${(cx + r).toFixed(1)} ${cy.toFixed(1)} L${cx.toFixed(1)} ${(cy + r).toFixed(1)} L${(cx - r).toFixed(1)} ${cy.toFixed(1)} Z`
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

export default function CustomerHomeScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, accentColor, colorTheme } = useApp();
  const isDark = colorTheme === "dark";
  const {
    getCustomerByUserId,
    getCustomerTransactions,
    getCustomerRewards,
    getCustomerProgressPerMerchant,
    addRedemption,
  } = useData();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const customer = user ? getCustomerByUserId(user.id) : null;
  const transactions = customer
    ? getCustomerTransactions(customer.id).slice(0, 5)
    : [];
  const availableRewards = customer ? getCustomerRewards(customer.id) : [];
  const redeemableRewards = availableRewards.filter(
    ({ reward }) => (customer?.totalPoints ?? 0) >= reward.pointsRequired
  );
  const progressItems = customer
    ? getCustomerProgressPerMerchant(customer.id).slice(0, 3)
    : [];

  const topReward = availableRewards[0];
  const nextTarget = topReward?.reward.pointsRequired ?? 200;
  const currentPoints = customer?.totalPoints ?? 0;
  const progress = Math.min(1, currentPoints / Math.max(1, nextTarget));

  const topPad = Platform.OS === "web" ? 67 : STATUSBAR_HEIGHT;
  const bottomPad = Platform.OS === "web" ? 34 : 0;
  const heroPatternHeight = topPad + 240;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor("transparent", true);
      }
    }, [])
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#C85A17" }}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 + bottomPad }}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={["#C85A17", "#E67E22", "#7B2D8B"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.3, y: 1 }}
        style={[styles.hero, { paddingTop: topPad + 20 }]}
      >
        <ZelligeOverlay width={width} height={heroPatternHeight} />

        <Text
          style={[styles.welcome, { fontFamily: "Inter_400Regular" }]}
        >
          Bonjour, {user?.firstName} 👋
        </Text>

        <View style={styles.pointsRow}>
          <Text
            style={[styles.pointsValue, { fontFamily: "Inter_700Bold" }]}
          >
            {currentPoints}
          </Text>
          <Text
            style={[styles.pointsLabel, { fontFamily: "Inter_400Regular" }]}
          >
            {t("customer.points")}
          </Text>
        </View>

        <View style={styles.progressSection}>
          <Text
            style={[styles.progressSubLabel, { fontFamily: "Inter_400Regular" }]}
          >
            Prochaine récompense dans
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
            {currentPoints} / {nextTarget}
          </Text>
        </View>
      </LinearGradient>

      <View style={[styles.content, { backgroundColor: colors.background }]}>

        {progressItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                🏪 Presque là !
              </Text>
              <TouchableOpacity onPress={() => router.push("/(customer)/merchants")}>
                <Text style={[styles.viewAll, { color: accentColor, fontFamily: "Inter_600SemiBold", fontSize: 13 }]}>
                  Voir tous
                </Text>
              </TouchableOpacity>
            </View>

            {progressItems.map((item) => {
              const pct = item.progressPercent;
              const remaining = item.nextRewardThreshold - item.customerPoints;
              const icon = CATEGORY_ICONS[item.merchantCategory] ?? "star";
              const isUrgent = pct >= 95;

              return (
                <TouchableOpacity
                  key={item.merchantId}
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
                    <View style={styles.urgencyBadge}>
                      <Text style={[styles.urgencyText, { fontFamily: "Inter_700Bold" }]}>🔥 Presque !</Text>
                    </View>
                  )}

                  <View style={styles.progressCardRow}>
                    <View style={[styles.categoryIcon, { backgroundColor: accentColor + "26" }]}>
                      <Feather name={icon} size={18} color={accentColor} />
                    </View>
                    <View style={styles.progressCardInfo}>
                      <Text style={[styles.progressMerchantName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                        {item.merchantName}
                      </Text>
                      <Text style={[styles.progressRewardLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        Récompense : {item.nextRewardName}
                      </Text>
                    </View>
                    <View style={styles.progressPointsCol}>
                      <Text style={[styles.progressPoints, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                        {remaining} pts
                      </Text>
                      <Text style={[styles.progressPointsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                        restants
                      </Text>
                    </View>
                  </View>

                  <View style={styles.progressBarSection}>
                    <Text style={[styles.progressPct, { color: accentColor, fontFamily: "Inter_700Bold" }]}>
                      {Math.round(pct)}%
                    </Text>
                    <View style={[styles.progressTrack, { backgroundColor: isDark ? "#333333" : "#E0E0E0" }]}>
                      <LinearGradient
                        colors={[accentColor, "#F9A602"]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[styles.progressFillBar, { width: `${pct}%` as any }]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {redeemableRewards.length > 0 && (
          <View style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {t("customer.availableRewards")}
            </Text>
            {redeemableRewards.slice(0, 3).map(({ reward, merchant }) => (
              <RewardCard
                key={reward.id}
                reward={reward}
                currentPoints={currentPoints}
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
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              Activité récente
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
                Voir tous
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
                <Feather name="star" size={36} color="#F9A602" />
                <Text
                  style={[
                    styles.emptyText,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  Aucune transaction pour le moment
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
  welcome: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 16,
    marginBottom: 8,
  },
  pointsRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 8,
    marginBottom: 20,
  },
  pointsValue: {
    color: "#F9A602",
    fontSize: 48,
    lineHeight: 54,
  },
  pointsLabel: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 18,
  },
  progressSection: {
    gap: 6,
  },
  progressSubLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
  },
  progressTrack: {
    height: 8,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: "#F9A602",
    borderRadius: 99,
  },
  progressCount: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    textAlign: "right",
  },
  content: {
    padding: 20,
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 17,
  },
  viewAll: {
    fontSize: 14,
  },
  emptyWrap: {
    padding: 36,
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    textAlign: "center",
  },
  progressCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 14,
    marginBottom: 10,
    overflow: "hidden",
  },
  urgencyBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(249,166,2,0.15)",
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 3,
    zIndex: 1,
  },
  urgencyText: {
    color: "#F9A602",
    fontSize: 10,
  },
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
  progressCardInfo: {
    flex: 1,
    gap: 2,
  },
  progressMerchantName: {
    fontSize: 14,
  },
  progressRewardLabel: {
    fontSize: 12,
  },
  progressPointsCol: {
    alignItems: "flex-end",
    gap: 1,
  },
  progressPoints: {
    fontSize: 14,
  },
  progressPointsLabel: {
    fontSize: 11,
  },
  progressBarSection: {
    gap: 4,
  },
  progressPct: {
    fontSize: 11,
    textAlign: "right",
  },
  progressTrack: {
    height: 6,
    borderRadius: 99,
    overflow: "hidden",
  },
  progressFillBar: {
    height: 6,
    borderRadius: 99,
  },
});
