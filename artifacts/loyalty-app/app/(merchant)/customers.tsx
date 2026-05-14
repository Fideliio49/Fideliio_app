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
  ScrollView,
  TextInput,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
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

const OFFER_TYPES = [
  {
    key: "discount",
    icon: "percent",
    label: { fr: "Remise", en: "Discount", ar: "تخفيض" },
    color: "#27AE60",
  },
  {
    key: "bonus_points",
    icon: "zap",
    label: { fr: "Bonus points", en: "Bonus points", ar: "نقاط إضافية" },
    color: "#F9A602",
  },
  {
    key: "reminder",
    icon: "bell",
    label: { fr: "Rappel visite", en: "Visit reminder", ar: "تذكير" },
    color: "#2C3E8C",
  },
  {
    key: "custom",
    icon: "gift",
    label: { fr: "Personnalisé", en: "Custom", ar: "مخصص" },
    color: "#9B59B6",
  },
] as const;

// ✅ Filtres de ciblage
const FILTERS = [
  {
    key: "inactive_30",
    icon: "clock",
    color: "#E74C3C",
    label: {
      fr: "Inactifs +30 jours",
      en: "Inactive 30+ days",
      ar: "غائب +30 يوم",
    },
    desc: {
      fr: "N'ont pas visité depuis un mois",
      en: "Haven't visited in a month",
      ar: "لم يزوروا منذ شهر",
    },
    filter: (c: any) => {
      if (!c.last_visit) return true;
      const days = Math.floor(
        (Date.now() - new Date(c.last_visit).getTime()) / 86400000,
      );
      return days >= 30;
    },
  },
  {
    key: "inactive_15",
    icon: "clock",
    color: "#E67E22",
    label: {
      fr: "Inactifs +15 jours",
      en: "Inactive 15+ days",
      ar: "غائب +15 يوم",
    },
    desc: {
      fr: "N'ont pas visité depuis 2 semaines",
      en: "Haven't visited in 2 weeks",
      ar: "لم يزوروا منذ أسبوعين",
    },
    filter: (c: any) => {
      if (!c.last_visit) return true;
      const days = Math.floor(
        (Date.now() - new Date(c.last_visit).getTime()) / 86400000,
      );
      return days >= 15;
    },
  },
  {
    key: "close_reward",
    icon: "zap",
    color: "#F9A602",
    label: {
      fr: "Proches d'une récompense",
      en: "Close to reward",
      ar: "قريب من مكافأة",
    },
    desc: {
      fr: "Ont atteint +70% de leur objectif",
      en: "Reached 70%+ of their goal",
      ar: "وصلوا 70%+ من هدفهم",
    },
    filter: (c: any) => c.progress >= 70 && c.next_reward,
  },
  {
    key: "loyal",
    icon: "star",
    color: "#27AE60",
    label: {
      fr: "Clients fidèles (5+ visites)",
      en: "Loyal (5+ visits)",
      ar: "عملاء وفيون +5 زيارات",
    },
    desc: {
      fr: "Vos meilleurs clients réguliers",
      en: "Your best regular customers",
      ar: "أفضل عملائك",
    },
    filter: (c: any) => c.visit_count >= 5,
  },
  {
    key: "one_visit",
    icon: "user",
    color: "#9B59B6",
    label: { fr: "1 seule visite", en: "Only 1 visit", ar: "زيارة واحدة فقط" },
    desc: {
      fr: "À convertir en habitués",
      en: "Convert to regulars",
      ar: "حوّلهم لزبائن دائمين",
    },
    filter: (c: any) => c.visit_count === 1,
  },
  {
    key: "gold",
    icon: "award",
    color: "#FFD700",
    label: { fr: "Tier Gold", en: "Gold tier", ar: "مستوى ذهبي" },
    desc: {
      fr: "Vos clients premium",
      en: "Your premium customers",
      ar: "عملاؤك المميزون",
    },
    filter: (c: any) => c.tier === "gold",
  },
  {
    key: "silver",
    icon: "award",
    color: "#C0C0C0",
    label: { fr: "Tier Silver", en: "Silver tier", ar: "مستوى فضي" },
    desc: {
      fr: "Clients intermédiaires",
      en: "Intermediate customers",
      ar: "العملاء المتوسطون",
    },
    filter: (c: any) => c.tier === "silver",
  },
  {
    key: "all",
    icon: "users",
    color: "#2C3E8C",
    label: { fr: "Tous les clients", en: "All customers", ar: "جميع العملاء" },
    desc: {
      fr: "Envoyer à tout le monde",
      en: "Send to everyone",
      ar: "إرسال للجميع",
    },
    filter: () => true,
  },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];
type CampaignStep = "filter" | "preview" | "compose";

// ✅ Basé sur lifetime_points + seuils du commerçant
function getTier(
  lifetimePoints: number,
  silverThreshold: number,
  goldThreshold: number,
): string {
  if (lifetimePoints >= goldThreshold) return "gold";
  if (lifetimePoints >= silverThreshold) return "silver";
  return "bronze";
}

function formatLastVisit(iso: string | null, language: string): string {
  if (!iso)
    return language === "ar"
      ? "لم يزر بعد"
      : language === "en"
        ? "No visit yet"
        : "Jamais visité";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0)
    return language === "ar"
      ? "اليوم"
      : language === "en"
        ? "Today"
        : "Aujourd'hui";
  if (days === 1)
    return language === "ar" ? "أمس" : language === "en" ? "Yesterday" : "Hier";
  return language === "ar"
    ? `منذ ${days} يوم`
    : language === "en"
      ? `${days} days ago`
      : `Il y a ${days} jours`;
}

export default function MerchantCustomersScreen() {
  const colors = useColors();
  const { user, merchantAccentColor, isRTL, language } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [merchant, setMerchant] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  // ── Modal ajustement points ──
  const [selectedCust, setSelectedCust] = useState<any>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  // ── Modal détail client ──
  const [detailCust, setDetailCust] = useState<any>(null);

  // ── Campagne (3 étapes) ──
  const [showCampaign, setShowCampaign] = useState(false);
  const [campaignStep, setCampaignStep] = useState<CampaignStep>("filter");
  const [selectedFilter, setSelectedFilter] = useState<FilterKey | null>(null);
  const [filteredTargets, setFilteredTargets] = useState<any[]>([]);
  const [offerType, setOfferType] = useState<string>("custom");
  const [offerTitle, setOfferTitle] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [sendingOffer, setSendingOffer] = useState(false);
  const [sendEmail, setSendEmail] = useState(true);
  const [sendPush, setSendPush] = useState(true);

  // ── Offre individuelle ──
  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerTarget, setOfferTarget] = useState<any>(null);
  const [indivTitle, setIndivTitle] = useState("");
  const [indivMessage, setIndivMessage] = useState("");
  const [indivType, setIndivType] = useState<string>("custom");
  const [sendingIndiv, setSendingIndiv] = useState(false);

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

    const { data: customerPoints } = await supabase
      .from("customer_merchant_points")
      .select(
        "customer_id, total_points, lifetime_points, visit_count, last_visit, silver_threshold, gold_threshold",
      )
      .eq("merchant_id", merchantData.id)
      .order("total_points", { ascending: false });
    if (!customerPoints || customerPoints.length === 0) {
      setCustomers([]);
      return;
    }

    const customerIds = customerPoints.map((c: any) => c.customer_id);
    const { data: customersData } = await supabase
      .from("customers")
      .select("id, first_name, last_name, email, phone, tier, push_token")
      .in("id", customerIds);

    const merged = customerPoints.map((cp: any) => {
      const cust = customersData?.find((c: any) => c.id === cp.customer_id);
      const pts = Math.max(0, cp.total_points);
      const tier = getTier(
        cp.lifetime_points ?? pts,
        cp.silver_threshold ?? 1000,
        cp.gold_threshold ?? 5000,
      );
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
      const { error } = await supabase
        .from("transactions")
        .insert({
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

  // ✅ Appel Edge Function
  async function callSendOffer(
    customerIds: string[],
    title: string,
    message: string,
    type: string,
  ) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated");
    const res = await fetch(
      "https://hdzhdwelgqmdvgwrlxud.supabase.co/functions/v1/send-offer-email",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          merchant_id: merchant.id,
          customer_ids: customerIds,
          title,
          message,
          type,
          send_email: sendEmail,
          send_push: sendPush,
        }),
      },
    );
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || "Erreur envoi");
    return result.results;
  }

  // ✅ Étape 1 → sélectionner le filtre
  function handleSelectFilter(key: FilterKey) {
    setSelectedFilter(key);
    const filterFn = FILTERS.find((f) => f.key === key)?.filter ?? (() => true);
    const targets = customers.filter(filterFn);
    setFilteredTargets(targets);
    setCampaignStep("preview");
  }

  // ✅ Étape 2 → aperçu → composer
  function handleGoCompose() {
    if (filteredTargets.length === 0) {
      Alert.alert(
        language === "en" ? "No customers" : "Aucun client",
        language === "en"
          ? "No customers match this filter"
          : "Aucun client ne correspond à ce filtre",
      );
      return;
    }
    setOfferTitle("");
    setOfferMessage("");
    setOfferType("custom");
    setCampaignStep("compose");
  }

  // ✅ Étape 3 → envoyer
  async function handleSendCampaign() {
    if (!offerTitle.trim() || !offerMessage.trim()) {
      Alert.alert(
        language === "en" ? "Required" : "Requis",
        language === "en"
          ? "Please fill in all fields"
          : "Veuillez remplir tous les champs",
      );
      return;
    }
    setSendingOffer(true);
    try {
      const ids = filteredTargets.map((c) => c.id);
      const results = await callSendOffer(
        ids,
        offerTitle.trim(),
        offerMessage.trim(),
        offerType,
      );
      Alert.alert(
        "✅",
        language === "en"
          ? `Sent! Push: ${results.push_sent} · Email: ${results.email_sent}`
          : `Envoyé ! Push: ${results.push_sent} · Email: ${results.email_sent}`,
      );
      setShowCampaign(false);
      setCampaignStep("filter");
      setSelectedFilter(null);
      setFilteredTargets([]);
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setSendingOffer(false);
    }
  }

  // ✅ Offre individuelle
  async function handleSendIndividual() {
    if (!indivTitle.trim() || !indivMessage.trim()) {
      Alert.alert(
        language === "en" ? "Required" : "Requis",
        language === "en"
          ? "Please fill in all fields"
          : "Veuillez remplir tous les champs",
      );
      return;
    }
    setSendingIndiv(true);
    try {
      const results = await callSendOffer(
        [offerTarget.id],
        indivTitle.trim(),
        indivMessage.trim(),
        indivType,
      );
      Alert.alert(
        "✅",
        language === "en"
          ? `Sent! Push: ${results.push_sent} · Email: ${results.email_sent}`
          : `Envoyé ! Push: ${results.push_sent} · Email: ${results.email_sent}`,
      );
      setShowOfferModal(false);
      setDetailCust(null);
      setIndivTitle("");
      setIndivMessage("");
    } catch (err: any) {
      Alert.alert("Erreur", err.message);
    } finally {
      setSendingIndiv(false);
    }
  }

  function openIndividualOffer(customer: any) {
    setOfferTarget(customer);
    setIndivTitle("");
    setIndivMessage("");
    setIndivType("custom");
    setShowOfferModal(true);
    setDetailCust(null);
  }

  function closeCampaign() {
    setShowCampaign(false);
    setCampaignStep("filter");
    setSelectedFilter(null);
    setFilteredTargets([]);
    setOfferTitle("");
    setOfferMessage("");
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

  const activeFilter = FILTERS.find((f) => f.key === selectedFilter);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <View
          style={{
            flexDirection: rowDir,
            alignItems: "center",
            justifyContent: "space-between",
          }}
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
          {customers.length > 0 && (
            <TouchableOpacity
              onPress={() => {
                setShowCampaign(true);
                setCampaignStep("filter");
              }}
              style={[
                styles.broadcastBtn,
                { backgroundColor: merchantAccentColor },
              ]}
            >
              <Feather name="target" size={iconSize(14)} color="#fff" />
              <Text
                style={[
                  styles.broadcastText,
                  { fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {language === "ar"
                  ? "حملة"
                  : language === "en"
                    ? "Campaign"
                    : "Campagne"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
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
            <TouchableOpacity
              onPress={() => setDetailCust(item)}
              activeOpacity={0.85}
            >
              <Card style={styles.customerCard}>
                <View style={[styles.row, { flexDirection: rowDir }]}>
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
                        <Feather
                          name="gift"
                          size={iconSize(12)}
                          color="#F9A602"
                        />
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
                  <Feather
                    name="chevron-right"
                    size={iconSize(16)}
                    color={colors.mutedForeground}
                    style={{ marginTop: 4 }}
                  />
                </View>
              </Card>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name="users"
              size={iconSize(40)}
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
              {search ? t("common.error") : t("customers.noCustomers")}
            </Text>
          </View>
        }
      />

      {/* ✅ Modal détail client */}
      <Modal visible={!!detailCust} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={{ flex: 1 }}
            onPress={() => setDetailCust(null)}
          />
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderRadius: colors.radius * 2 },
            ]}
          >
            <View style={styles.modalHandle} />
            {detailCust && (
              <>
                <View
                  style={{
                    alignItems: "center",
                    gap: sp(8),
                    marginBottom: sp(20),
                  }}
                >
                  <View
                    style={[
                      styles.detailAvatar,
                      { backgroundColor: merchantAccentColor + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.detailAvatarText,
                        {
                          color: merchantAccentColor,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {(detailCust.first_name?.[0] ?? "").toUpperCase()}
                      {(detailCust.last_name?.[0] ?? "").toUpperCase()}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.detailName,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {detailCust.first_name} {detailCust.last_name}
                  </Text>
                  {detailCust.email && (
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(13),
                      }}
                    >
                      {detailCust.email}
                    </Text>
                  )}
                </View>
                <View style={[styles.statsRow, { borderColor: colors.border }]}>
                  <View style={styles.statItem}>
                    <Text
                      style={[
                        styles.statValue,
                        { color: "#F9A602", fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {detailCust.total_points}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {t("common.points")}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text
                      style={[
                        styles.statValue,
                        {
                          color: merchantAccentColor,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {detailCust.visit_count}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {language === "en" ? "Visits" : "Visites"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statDivider,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <View style={styles.statItem}>
                    <Text
                      style={[
                        styles.statValue,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                          fontSize: fs(11),
                        },
                      ]}
                    >
                      {formatLastVisit(detailCust.last_visit, language)}
                    </Text>
                    <Text
                      style={[
                        styles.statLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {language === "en" ? "Last visit" : "Dernière visite"}
                    </Text>
                  </View>
                </View>
                <View style={{ gap: sp(10), marginTop: sp(4) }}>
                  <TouchableOpacity
                    onPress={() => openIndividualOffer(detailCust)}
                    style={[
                      styles.actionBtn,
                      { backgroundColor: merchantAccentColor },
                    ]}
                  >
                    <Feather name="send" size={iconSize(16)} color="#fff" />
                    <Text
                      style={[
                        styles.actionBtnText,
                        { fontFamily: "Inter_600SemiBold" },
                      ]}
                    >
                      {language === "ar"
                        ? "إرسال عرض خاص"
                        : language === "en"
                          ? "Send personalized offer"
                          : "Envoyer une offre personnalisée"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedCust(detailCust);
                      setDetailCust(null);
                    }}
                    style={[
                      styles.actionBtn,
                      {
                        backgroundColor: colors.card,
                        borderWidth: 1.5,
                        borderColor: merchantAccentColor,
                      },
                    ]}
                  >
                    <Feather
                      name="edit-3"
                      size={iconSize(16)}
                      color={merchantAccentColor}
                    />
                    <Text
                      style={[
                        styles.actionBtnText,
                        {
                          color: merchantAccentColor,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                    >
                      {t("customers.adjustPoints")}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setDetailCust(null)}
                    style={{ alignItems: "center", paddingVertical: sp(8) }}
                  >
                    <Text
                      style={{
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(14),
                      }}
                    >
                      {t("common.cancel")}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* ✅ Modal Campagne — 3 étapes */}
      <Modal visible={showCampaign} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity style={{ flex: 1 }} onPress={closeCampaign} />
            <View
              style={[
                styles.campaignModal,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius * 2,
                },
              ]}
            >
              <View style={styles.modalHandle} />

              {/* ── Étape 1 : Choisir le filtre ── */}
              {campaignStep === "filter" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: sp(16),
                    }}
                  >
                    <Text
                      style={[
                        styles.modalTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      {language === "ar"
                        ? "اختر الجمهور"
                        : language === "en"
                          ? "Choose your audience"
                          : "Choisir le ciblage"}
                    </Text>
                    <TouchableOpacity onPress={closeCampaign}>
                      <Feather
                        name="x"
                        size={iconSize(22)}
                        color={colors.mutedForeground}
                      />
                    </TouchableOpacity>
                  </View>
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {FILTERS.map((f) => {
                      const count = customers.filter(f.filter).length;
                      const label =
                        f.label[language as keyof typeof f.label] ?? f.label.fr;
                      const desc =
                        f.desc[language as keyof typeof f.desc] ?? f.desc.fr;
                      return (
                        <TouchableOpacity
                          key={f.key}
                          onPress={() => handleSelectFilter(f.key as FilterKey)}
                          activeOpacity={0.85}
                          style={[
                            styles.filterCard,
                            {
                              borderColor: f.color + "30",
                              backgroundColor:
                                count > 0
                                  ? f.color + "08"
                                  : colors.muted + "30",
                              opacity: count > 0 ? 1 : 0.5,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.filterIcon,
                              { backgroundColor: f.color + "20" },
                            ]}
                          >
                            <Feather
                              name={f.icon as any}
                              size={iconSize(20)}
                              color={f.color}
                            />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                styles.filterLabel,
                                { color: f.color, fontFamily: "Inter_700Bold" },
                              ]}
                            >
                              {label}
                            </Text>
                            <Text
                              style={[
                                styles.filterDesc,
                                {
                                  color: colors.mutedForeground,
                                  fontFamily: "Inter_400Regular",
                                },
                              ]}
                            >
                              {desc}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.filterCount,
                              { backgroundColor: f.color },
                            ]}
                          >
                            <Text
                              style={[
                                styles.filterCountText,
                                { fontFamily: "Inter_700Bold" },
                              ]}
                            >
                              {count}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {/* ── Étape 2 : Aperçu des clients ── */}
              {campaignStep === "preview" && activeFilter && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: sp(16),
                    }}
                  >
                    <TouchableOpacity onPress={() => setCampaignStep("filter")}>
                      <Feather
                        name="arrow-left"
                        size={iconSize(20)}
                        color={colors.foreground}
                      />
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.modalTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                          flex: 1,
                        },
                      ]}
                    >
                      {language === "ar"
                        ? "العملاء المستهدفون"
                        : language === "en"
                          ? "Target customers"
                          : "Clients ciblés"}
                    </Text>
                  </View>

                  {/* Badge filtre sélectionné */}
                  <View
                    style={[
                      styles.selectedFilterBadge,
                      {
                        backgroundColor: activeFilter.color + "15",
                        borderColor: activeFilter.color + "30",
                      },
                    ]}
                  >
                    <Feather
                      name={activeFilter.icon as any}
                      size={iconSize(14)}
                      color={activeFilter.color}
                    />
                    <Text
                      style={[
                        {
                          color: activeFilter.color,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: fs(13),
                        },
                      ]}
                    >
                      {activeFilter.label[
                        language as keyof typeof activeFilter.label
                      ] ?? activeFilter.label.fr}
                    </Text>
                    <Text
                      style={[
                        {
                          color: activeFilter.color,
                          fontFamily: "Inter_700Bold",
                          fontSize: fs(13),
                        },
                      ]}
                    >
                      · {filteredTargets.length}
                    </Text>
                  </View>

                  <ScrollView
                    style={{ maxHeight: 280 }}
                    showsVerticalScrollIndicator={false}
                  >
                    {filteredTargets.length === 0 ? (
                      <View
                        style={{ alignItems: "center", padding: 32, gap: 12 }}
                      >
                        <Feather
                          name="user-x"
                          size={iconSize(40)}
                          color={colors.mutedForeground}
                        />
                        <Text
                          style={{
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                            textAlign: "center",
                          }}
                        >
                          {language === "en"
                            ? "No customers match this filter"
                            : "Aucun client ne correspond à ce filtre"}
                        </Text>
                      </View>
                    ) : (
                      filteredTargets.map((c) => (
                        <View
                          key={c.id}
                          style={[
                            styles.previewRow,
                            { borderBottomColor: colors.border },
                          ]}
                        >
                          <View
                            style={[
                              styles.previewAvatar,
                              { backgroundColor: merchantAccentColor + "20" },
                            ]}
                          >
                            <Text
                              style={[
                                {
                                  color: merchantAccentColor,
                                  fontFamily: "Inter_700Bold",
                                  fontSize: fs(13),
                                },
                              ]}
                            >
                              {(c.first_name?.[0] ?? "").toUpperCase()}
                              {(c.last_name?.[0] ?? "").toUpperCase()}
                            </Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[
                                {
                                  color: colors.foreground,
                                  fontFamily: "Inter_600SemiBold",
                                  fontSize: fs(14),
                                },
                              ]}
                            >
                              {c.first_name} {c.last_name}
                            </Text>
                            <Text
                              style={[
                                {
                                  color: colors.mutedForeground,
                                  fontFamily: "Inter_400Regular",
                                  fontSize: fs(11),
                                },
                              ]}
                            >
                              {c.total_points} pts ·{" "}
                              {formatLastVisit(c.last_visit, language)}
                            </Text>
                          </View>
                          <Feather
                            name="check-circle"
                            size={iconSize(16)}
                            color={activeFilter.color}
                          />
                        </View>
                      ))
                    )}
                  </ScrollView>

                  <TouchableOpacity
                    onPress={handleGoCompose}
                    disabled={filteredTargets.length === 0}
                    activeOpacity={0.88}
                    style={{ marginTop: sp(16) }}
                  >
                    <LinearGradient
                      colors={[merchantAccentColor, merchantAccentColor + "CC"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={[
                        styles.sendBtn,
                        { opacity: filteredTargets.length === 0 ? 0.4 : 1 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.sendBtnText,
                          { fontFamily: "Inter_700Bold" },
                        ]}
                      >
                        {language === "ar"
                          ? `إنشاء الرسالة ← ${filteredTargets.length}`
                          : language === "en"
                            ? `Compose message → ${filteredTargets.length}`
                            : `Composer le message → ${filteredTargets.length} clients`}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                </>
              )}

              {/* ── Étape 3 : Composer l'offre ── */}
              {campaignStep === "compose" && (
                <>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: sp(16),
                    }}
                  >
                    <TouchableOpacity
                      onPress={() => setCampaignStep("preview")}
                    >
                      <Feather
                        name="arrow-left"
                        size={iconSize(20)}
                        color={colors.foreground}
                      />
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.modalTitle,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_700Bold",
                          flex: 1,
                        },
                      ]}
                    >
                      {language === "ar"
                        ? "إنشاء الرسالة"
                        : language === "en"
                          ? "Compose message"
                          : "Composer le message"}
                    </Text>
                  </View>

                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                  >
                    {/* Résumé */}
                    <View
                      style={[
                        styles.recipientBox,
                        {
                          backgroundColor: merchantAccentColor + "10",
                          borderColor: merchantAccentColor + "30",
                        },
                      ]}
                    >
                      <Feather
                        name="users"
                        size={iconSize(14)}
                        color={merchantAccentColor}
                      />
                      <Text
                        style={[
                          {
                            color: merchantAccentColor,
                            fontFamily: "Inter_600SemiBold",
                            fontSize: fs(13),
                          },
                        ]}
                      >
                        {language === "en"
                          ? `${filteredTargets.length} customers targeted`
                          : `${filteredTargets.length} clients ciblés`}
                      </Text>
                    </View>

                    {/* Type */}
                    <Text
                      style={[
                        styles.fieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {language === "en" ? "Offer type" : "Type d'offre"}
                    </Text>
                    <View
                      style={{
                        flexDirection: "row",
                        flexWrap: "wrap",
                        gap: 8,
                        marginBottom: sp(14),
                      }}
                    >
                      {OFFER_TYPES.map((ot) => {
                        const label =
                          ot.label[language as keyof typeof ot.label] ??
                          ot.label.fr;
                        const isSel = offerType === ot.key;
                        return (
                          <TouchableOpacity
                            key={ot.key}
                            onPress={() => setOfferType(ot.key)}
                            style={[
                              styles.typeChip,
                              {
                                borderColor: isSel ? ot.color : colors.border,
                                backgroundColor: isSel
                                  ? ot.color + "15"
                                  : colors.background,
                                borderWidth: isSel ? 2 : 1,
                              },
                            ]}
                          >
                            <Feather
                              name={ot.icon as any}
                              size={iconSize(13)}
                              color={isSel ? ot.color : colors.mutedForeground}
                            />
                            <Text
                              style={[
                                {
                                  fontSize: fs(12),
                                  color: isSel
                                    ? ot.color
                                    : colors.mutedForeground,
                                  fontFamily: isSel
                                    ? "Inter_600SemiBold"
                                    : "Inter_400Regular",
                                },
                              ]}
                            >
                              {label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {/* Titre */}
                    <Text
                      style={[
                        styles.fieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {language === "en" ? "Title" : "Titre"}
                    </Text>
                    <TextInput
                      value={offerTitle}
                      onChangeText={setOfferTitle}
                      placeholder={
                        language === "en"
                          ? "e.g. -20% just for you!"
                          : "Ex: -20% rien que pour vous !"
                      }
                      placeholderTextColor={colors.mutedForeground}
                      style={[
                        styles.textInput,
                        {
                          color: colors.foreground,
                          borderColor: offerTitle
                            ? merchantAccentColor
                            : colors.border,
                          backgroundColor: colors.background,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    />

                    {/* Message */}
                    <Text
                      style={[
                        styles.fieldLabel,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_500Medium",
                        },
                      ]}
                    >
                      {language === "en" ? "Message" : "Message"}
                    </Text>
                    <TextInput
                      value={offerMessage}
                      onChangeText={setOfferMessage}
                      multiline
                      numberOfLines={3}
                      placeholder={
                        language === "en"
                          ? "Offer details..."
                          : "Détails de l'offre..."
                      }
                      placeholderTextColor={colors.mutedForeground}
                      style={[
                        styles.textInput,
                        styles.textArea,
                        {
                          color: colors.foreground,
                          borderColor: offerMessage
                            ? merchantAccentColor
                            : colors.border,
                          backgroundColor: colors.background,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    />

                    {/* Options */}
                    <View
                      style={[
                        styles.sendOptions,
                        { borderColor: colors.border },
                      ]}
                    >
                      <TouchableOpacity
                        onPress={() => setSendPush(!sendPush)}
                        style={styles.sendOption}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: sendPush
                                ? merchantAccentColor
                                : colors.border,
                              backgroundColor: sendPush
                                ? merchantAccentColor
                                : "transparent",
                            },
                          ]}
                        >
                          {sendPush && (
                            <Feather name="check" size={10} color="#fff" />
                          )}
                        </View>
                        <Feather
                          name="bell"
                          size={iconSize(14)}
                          color={
                            sendPush
                              ? merchantAccentColor
                              : colors.mutedForeground
                          }
                        />
                        <Text
                          style={[
                            {
                              fontSize: fs(13),
                              color: sendPush
                                ? colors.foreground
                                : colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {language === "en"
                            ? "Push notification"
                            : "Notification push"}
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setSendEmail(!sendEmail)}
                        style={styles.sendOption}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            {
                              borderColor: sendEmail
                                ? merchantAccentColor
                                : colors.border,
                              backgroundColor: sendEmail
                                ? merchantAccentColor
                                : "transparent",
                            },
                          ]}
                        >
                          {sendEmail && (
                            <Feather name="check" size={10} color="#fff" />
                          )}
                        </View>
                        <Feather
                          name="mail"
                          size={iconSize(14)}
                          color={
                            sendEmail
                              ? merchantAccentColor
                              : colors.mutedForeground
                          }
                        />
                        <Text
                          style={[
                            {
                              fontSize: fs(13),
                              color: sendEmail
                                ? colors.foreground
                                : colors.mutedForeground,
                              fontFamily: "Inter_400Regular",
                            },
                          ]}
                        >
                          {language === "en"
                            ? "Email (max 2/month)"
                            : "Email (max 2/mois)"}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                      onPress={handleSendCampaign}
                      disabled={
                        sendingOffer ||
                        !offerTitle.trim() ||
                        !offerMessage.trim()
                      }
                      activeOpacity={0.88}
                      style={{ marginTop: sp(12) }}
                    >
                      <LinearGradient
                        colors={[
                          merchantAccentColor,
                          merchantAccentColor + "CC",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={[
                          styles.sendBtn,
                          {
                            opacity:
                              !offerTitle.trim() ||
                              !offerMessage.trim() ||
                              sendingOffer
                                ? 0.5
                                : 1,
                          },
                        ]}
                      >
                        <Feather name="send" size={iconSize(16)} color="#fff" />
                        <Text
                          style={[
                            styles.sendBtnText,
                            { fontFamily: "Inter_700Bold" },
                          ]}
                        >
                          {sendingOffer
                            ? language === "en"
                              ? "Sending..."
                              : "Envoi en cours..."
                            : language === "en"
                              ? `Send to ${filteredTargets.length} customers`
                              : `Envoyer à ${filteredTargets.length} clients`}
                        </Text>
                      </LinearGradient>
                    </TouchableOpacity>
                  </ScrollView>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ✅ Modal offre individuelle */}
      <Modal visible={showOfferModal} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalOverlay}>
            <TouchableOpacity
              style={{ flex: 1 }}
              onPress={() => setShowOfferModal(false)}
            />
            <View
              style={[
                styles.offerModal,
                {
                  backgroundColor: colors.card,
                  borderRadius: colors.radius * 2,
                },
              ]}
            >
              <View style={styles.modalHandle} />
              <ScrollView
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: sp(16),
                  }}
                >
                  <Text
                    style={[
                      styles.modalTitle,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {language === "en"
                      ? "Personalized offer"
                      : "Offre personnalisée"}
                  </Text>
                  <TouchableOpacity onPress={() => setShowOfferModal(false)}>
                    <Feather
                      name="x"
                      size={iconSize(22)}
                      color={colors.mutedForeground}
                    />
                  </TouchableOpacity>
                </View>
                {offerTarget && (
                  <View
                    style={[
                      styles.recipientBox,
                      {
                        backgroundColor: merchantAccentColor + "10",
                        borderColor: merchantAccentColor + "30",
                      },
                    ]}
                  >
                    <Feather
                      name="user"
                      size={iconSize(14)}
                      color={merchantAccentColor}
                    />
                    <Text
                      style={[
                        {
                          color: merchantAccentColor,
                          fontFamily: "Inter_600SemiBold",
                          fontSize: fs(13),
                        },
                      ]}
                    >
                      {offerTarget.first_name} {offerTarget.last_name}
                    </Text>
                  </View>
                )}
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {language === "en" ? "Offer type" : "Type d'offre"}
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    flexWrap: "wrap",
                    gap: 8,
                    marginBottom: sp(14),
                  }}
                >
                  {OFFER_TYPES.map((ot) => {
                    const label =
                      ot.label[language as keyof typeof ot.label] ??
                      ot.label.fr;
                    const isSel = indivType === ot.key;
                    return (
                      <TouchableOpacity
                        key={ot.key}
                        onPress={() => setIndivType(ot.key)}
                        style={[
                          styles.typeChip,
                          {
                            borderColor: isSel ? ot.color : colors.border,
                            backgroundColor: isSel
                              ? ot.color + "15"
                              : colors.background,
                            borderWidth: isSel ? 2 : 1,
                          },
                        ]}
                      >
                        <Feather
                          name={ot.icon as any}
                          size={iconSize(13)}
                          color={isSel ? ot.color : colors.mutedForeground}
                        />
                        <Text
                          style={[
                            {
                              fontSize: fs(12),
                              color: isSel ? ot.color : colors.mutedForeground,
                              fontFamily: isSel
                                ? "Inter_600SemiBold"
                                : "Inter_400Regular",
                            },
                          ]}
                        >
                          {label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {language === "en" ? "Title" : "Titre"}
                </Text>
                <TextInput
                  value={indivTitle}
                  onChangeText={setIndivTitle}
                  placeholder={
                    language === "en"
                      ? "e.g. -20% just for you!"
                      : "Ex: -20% rien que pour vous !"
                  }
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.textInput,
                    {
                      color: colors.foreground,
                      borderColor: indivTitle
                        ? merchantAccentColor
                        : colors.border,
                      backgroundColor: colors.background,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                />
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_500Medium",
                    },
                  ]}
                >
                  {language === "en" ? "Message" : "Message"}
                </Text>
                <TextInput
                  value={indivMessage}
                  onChangeText={setIndivMessage}
                  multiline
                  numberOfLines={3}
                  placeholder={
                    language === "en"
                      ? "Offer details..."
                      : "Détails de l'offre..."
                  }
                  placeholderTextColor={colors.mutedForeground}
                  style={[
                    styles.textInput,
                    styles.textArea,
                    {
                      color: colors.foreground,
                      borderColor: indivMessage
                        ? merchantAccentColor
                        : colors.border,
                      backgroundColor: colors.background,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                />
                <View
                  style={[styles.sendOptions, { borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    onPress={() => setSendPush(!sendPush)}
                    style={styles.sendOption}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: sendPush
                            ? merchantAccentColor
                            : colors.border,
                          backgroundColor: sendPush
                            ? merchantAccentColor
                            : "transparent",
                        },
                      ]}
                    >
                      {sendPush && (
                        <Feather name="check" size={10} color="#fff" />
                      )}
                    </View>
                    <Feather
                      name="bell"
                      size={iconSize(14)}
                      color={
                        sendPush ? merchantAccentColor : colors.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        {
                          fontSize: fs(13),
                          color: sendPush
                            ? colors.foreground
                            : colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {language === "en"
                        ? "Push notification"
                        : "Notification push"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setSendEmail(!sendEmail)}
                    style={styles.sendOption}
                  >
                    <View
                      style={[
                        styles.checkbox,
                        {
                          borderColor: sendEmail
                            ? merchantAccentColor
                            : colors.border,
                          backgroundColor: sendEmail
                            ? merchantAccentColor
                            : "transparent",
                        },
                      ]}
                    >
                      {sendEmail && (
                        <Feather name="check" size={10} color="#fff" />
                      )}
                    </View>
                    <Feather
                      name="mail"
                      size={iconSize(14)}
                      color={
                        sendEmail ? merchantAccentColor : colors.mutedForeground
                      }
                    />
                    <Text
                      style={[
                        {
                          fontSize: fs(13),
                          color: sendEmail
                            ? colors.foreground
                            : colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      {language === "en"
                        ? "Email (max 2/month)"
                        : "Email (max 2/mois)"}
                    </Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={handleSendIndividual}
                  disabled={
                    sendingIndiv || !indivTitle.trim() || !indivMessage.trim()
                  }
                  activeOpacity={0.88}
                  style={{ marginTop: sp(12) }}
                >
                  <LinearGradient
                    colors={[merchantAccentColor, merchantAccentColor + "CC"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.sendBtn,
                      {
                        opacity:
                          !indivTitle.trim() ||
                          !indivMessage.trim() ||
                          sendingIndiv
                            ? 0.5
                            : 1,
                      },
                    ]}
                  >
                    <Feather name="send" size={iconSize(16)} color="#fff" />
                    <Text
                      style={[
                        styles.sendBtnText,
                        { fontFamily: "Inter_700Bold" },
                      ]}
                    >
                      {sendingIndiv
                        ? language === "en"
                          ? "Sending..."
                          : "Envoi..."
                        : language === "en"
                          ? "Send offer"
                          : "Envoyer l'offre"}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
                  {selectedCust.total_points} {t("common.points").toLowerCase()}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, borderBottomWidth: 1, paddingBottom: 0 },
  title: { fontSize: fs(24) },
  broadcastBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  broadcastText: { color: "#fff", fontSize: fs(12) },
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
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: fs(15) },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: { padding: 28, gap: 16, margin: 12, marginBottom: 24 },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: fs(20) },
  modalSubtitle: { fontSize: fs(14), marginTop: -8 },
  adjustBtns: { gap: 12 },
  detailAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  detailAvatarText: { fontSize: fs(28) },
  detailName: { fontSize: fs(20) },
  statsRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: sp(16),
  },
  statItem: { flex: 1, alignItems: "center", gap: 4 },
  statValue: { fontSize: fs(18) },
  statLabel: { fontSize: fs(11) },
  statDivider: { width: 1, marginVertical: 4 },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: sp(14),
    borderRadius: 12,
  },
  actionBtnText: { color: "#fff", fontSize: fs(15) },
  // Campaign modal
  campaignModal: {
    padding: 24,
    margin: 12,
    marginBottom: 24,
    maxHeight: "90%",
  },
  filterCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    marginBottom: sp(10),
  },
  filterIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  filterLabel: { fontSize: fs(14) },
  filterDesc: { fontSize: fs(11), marginTop: 2 },
  filterCount: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  filterCountText: { color: "#fff", fontSize: fs(13) },
  selectedFilterBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: sp(14),
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  previewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  // Offer modal
  offerModal: { padding: 24, margin: 12, marginBottom: 24, maxHeight: "88%" },
  recipientBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: sp(16),
  },
  fieldLabel: { fontSize: fs(13), marginBottom: sp(8) },
  typeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 99,
  },
  textInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    padding: 14,
    fontSize: fs(15),
    marginBottom: sp(14),
  },
  textArea: { height: 80, textAlignVertical: "top" },
  sendOptions: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: sp(10),
    marginBottom: sp(4),
  },
  sendOption: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: sp(16),
    borderRadius: 12,
  },
  sendBtnText: { color: "#fff", fontSize: fs(16) },
});
