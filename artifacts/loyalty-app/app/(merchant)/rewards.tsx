import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Modal,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { supabase } from "@/lib/supabase";
import { useFocusEffect } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";

type RewardType = "discount" | "freeProduct" | "freeService";
type PromoType = "discount" | "flash" | "event";
type EntryMode = "reward" | "promotion";

const REWARD_ICONS: Record<RewardType, keyof typeof Feather.glyphMap> = {
  discount: "percent",
  freeProduct: "gift",
  freeService: "star",
};
const PROMO_ICONS: Record<PromoType, keyof typeof Feather.glyphMap> = {
  discount: "tag",
  flash: "zap",
  event: "calendar",
};

export default function MerchantRewardsScreen() {
  const colors = useColors();
  const { user, isRTL, merchantAccentColor, language } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [merchant, setMerchant] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [listTab, setListTab] = useState<"rewards" | "promotions">("rewards");

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [entryMode, setEntryMode] = useState<EntryMode>("reward");
  const [editingItem, setEditingItem] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Champs récompense
  const [name, setName] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("discount");
  // ✅ Date expiration récompense
  const [rewardExpiryDate, setRewardExpiryDate] = useState<Date | null>(null);
  const [showRewardDatePicker, setShowRewardDatePicker] = useState(false);

  // Champs promotion
  const [promoTitle, setPromoTitle] = useState("");
  const [promoDesc, setPromoDesc] = useState("");
  const [promoType, setPromoType] = useState<PromoType>("discount");
  const [promoEndsDate, setPromoEndsDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const textAlign = isRTL ? "right" : "left";
  const rowDir: "row" | "row-reverse" = isRTL ? "row-reverse" : "row";

  const REWARD_TYPE_LABELS: Record<RewardType, string> = {
    discount: t("rewards.discount"),
    freeProduct: t("rewards.freeProduct"),
    freeService: t("rewards.freeService"),
  };
  const PROMO_TYPE_LABELS: Record<PromoType, string> = {
    discount:
      language === "ar" ? "تخفيض" : language === "en" ? "Discount" : "Remise",
    flash:
      language === "ar" ? "عرض محدود" : language === "en" ? "Flash" : "Flash",
    event:
      language === "ar" ? "حدث" : language === "en" ? "Event" : "Événement",
  };

  const labelRewards =
    language === "ar"
      ? "المكافآت"
      : language === "en"
        ? "Rewards"
        : "Récompenses";
  const labelPromotions =
    language === "ar" ? "العروض" : language === "en" ? "Offers" : "Offres";
  const labelReward =
    language === "ar" ? "مكافأة" : language === "en" ? "Reward" : "Récompense";
  const labelPromotion =
    language === "ar" ? "عرض" : language === "en" ? "Offer" : "Promotion";
  const labelNewReward =
    language === "ar"
      ? "مكافأة جديدة"
      : language === "en"
        ? "New reward"
        : "Nouvelle récompense";
  const labelNewPromo =
    language === "ar"
      ? "عرض جديد"
      : language === "en"
        ? "New offer"
        : "Nouvelle offre";
  const labelEditReward =
    language === "ar"
      ? "تعديل المكافأة"
      : language === "en"
        ? "Edit reward"
        : "Modifier la récompense";
  const labelEditPromo =
    language === "ar"
      ? "تعديل العرض"
      : language === "en"
        ? "Edit offer"
        : "Modifier l'offre";
  const labelEndsAt =
    language === "ar"
      ? "تاريخ الانتهاء (اختياري)"
      : language === "en"
        ? "End date (optional)"
        : "Date de fin (optionnel)";
  const labelNoRewards =
    language === "ar"
      ? "لا توجد مكافآت"
      : language === "en"
        ? "No rewards yet"
        : "Aucune récompense";
  const labelNoPromos =
    language === "ar"
      ? "لا توجد عروض"
      : language === "en"
        ? "No offers yet"
        : "Aucune offre";

  // ✅ Labels expiration récompense
  const labelRewardExpiry =
    language === "ar"
      ? "تاريخ انتهاء المكافأة (اختياري)"
      : language === "en"
        ? "Reward expiry date (optional)"
        : "Date d'expiration (optionnel)";
  const labelNoRewardExpiry =
    language === "ar"
      ? "لا تنتهي"
      : language === "en"
        ? "No expiry"
        : "Sans expiration";

  useEffect(() => {
    loadData();
  }, [user?.id]);
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
    const [{ data: rewardsData }, { data: promosData }] = await Promise.all([
      supabase
        .from("rewards")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("promotions")
        .select("*")
        .eq("merchant_id", merchantData.id)
        .order("created_at", { ascending: false }),
    ]);
    setRewards(rewardsData ?? []);
    setPromotions(promosData ?? []);
  }

  function handleOpenCreate(mode: EntryMode) {
    setEntryMode(mode);
    setEditingItem(null);
    resetFields();
    setShowModal(true);
  }

  function handleOpenEdit(item: any, mode: EntryMode) {
    setEntryMode(mode);
    setEditingItem(item);
    if (mode === "reward") {
      setName(item.name);
      setPointsRequired(String(item.points_required));
      setRewardType(item.reward_type as RewardType);
      setRewardExpiryDate(item.expiry_date ? new Date(item.expiry_date) : null); // ✅
    } else {
      setPromoTitle(item.title);
      setPromoDesc(item.description ?? "");
      setPromoType(item.type as PromoType);
      setPromoEndsDate(item.ends_at ? new Date(item.ends_at) : null);
    }
    setErrors({});
    setShowModal(true);
  }

  function handleCloseModal() {
    setShowModal(false);
    setEditingItem(null);
    resetFields();
  }

  function resetFields() {
    setName("");
    setPointsRequired("");
    setRewardType("discount");
    setRewardExpiryDate(null);
    setShowRewardDatePicker(false); // ✅
    setPromoTitle("");
    setPromoDesc("");
    setPromoType("discount");
    setPromoEndsDate(null);
    setShowDatePicker(false);
    setErrors({});
  }

  async function handleSave() {
    if (entryMode === "reward") await saveReward();
    else await savePromotion();
  }

  async function saveReward() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t("common.error");
    if (!pointsRequired.trim() || isNaN(parseInt(pointsRequired)))
      errs.pts = t("common.error");
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // ✅ Date expiration
    let expiryISO: string | null = null;
    if (rewardExpiryDate) {
      const d = new Date(rewardExpiryDate);
      d.setHours(23, 59, 0, 0);
      expiryISO = d.toISOString();
    }

    setLoading(true);
    try {
      if (editingItem) {
        const { error } = await supabase
          .from("rewards")
          .update({
            name: name.trim(),
            points_required: parseInt(pointsRequired),
            reward_type: rewardType,
            expiry_date: expiryISO, // ✅
          })
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        let m = merchant;
        if (!m) {
          const { data } = await supabase
            .from("merchants")
            .select("*")
            .eq("user_id", user!.id)
            .maybeSingle();
          if (!data) {
            Alert.alert(t("common.error"), "Aucun commerce trouvé.");
            return;
          }
          m = data;
          setMerchant(data);
        }
        const { nanoid } = await import("nanoid/non-secure");
        const { error } = await supabase.from("rewards").insert({
          id: nanoid(),
          merchant_id: m.id,
          merchant_name: m.business_name,
          name: name.trim(),
          points_required: parseInt(pointsRequired),
          reward_type: rewardType,
          is_active: true,
          expiry_date: expiryISO, // ✅
          created_at: new Date().toISOString(),
        });
        if (error) throw error;
      }
      await loadData();
      handleCloseModal();
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  }

  async function savePromotion() {
    const errs: Record<string, string> = {};
    if (!promoTitle.trim()) errs.promoTitle = t("common.error");
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    let endsAtISO: string | null = null;
    if (promoEndsDate) {
      const d = new Date(promoEndsDate);
      d.setHours(23, 59, 0, 0);
      endsAtISO = d.toISOString();
    }

    setLoading(true);
    try {
      let m = merchant;
      if (!m) {
        const { data } = await supabase
          .from("merchants")
          .select("*")
          .eq("user_id", user!.id)
          .maybeSingle();
        if (!data) {
          Alert.alert(t("common.error"), "Aucun commerce trouvé.");
          return;
        }
        m = data;
        setMerchant(data);
      }
      if (editingItem) {
        const { error } = await supabase
          .from("promotions")
          .update({
            title: promoTitle.trim(),
            description: promoDesc.trim() || null,
            type: promoType,
            ends_at: endsAtISO,
          })
          .eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { nanoid } = await import("nanoid/non-secure");
        const { error } = await supabase
          .from("promotions")
          .insert({
            id: nanoid(),
            merchant_id: m.id,
            title: promoTitle.trim(),
            description: promoDesc.trim() || null,
            type: promoType,
            ends_at: endsAtISO,
            is_active: true,
            starts_at: new Date().toISOString(),
          });
        if (error) throw error;
      }
      await loadData();
      handleCloseModal();
    } catch (err: any) {
      Alert.alert(t("common.error"), err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleToggleReward(id: string, isActive: boolean) {
    const { error } = await supabase
      .from("rewards")
      .update({ is_active: isActive })
      .eq("id", id);
    if (!error)
      setRewards((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)),
      );
  }

  async function handleTogglePromo(id: string, isActive: boolean) {
    const { error } = await supabase
      .from("promotions")
      .update({ is_active: isActive })
      .eq("id", id);
    if (!error)
      setPromotions((prev) =>
        prev.map((p) => (p.id === id ? { ...p, is_active: isActive } : p)),
      );
  }

  async function handleDelete(
    id: string,
    label: string,
    table: "rewards" | "promotions",
  ) {
    Alert.alert(t("common.delete"), label, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase.from(table).delete().eq("id", id);
          if (!error) {
            if (table === "rewards")
              setRewards((prev) => prev.filter((r) => r.id !== id));
            else setPromotions((prev) => prev.filter((p) => p.id !== id));
          }
        },
      },
    ]);
  }

  function formatDate(iso: string): string {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  function promoColor(type: PromoType) {
    if (type === "flash") return "#E74C3C";
    if (type === "event") return "#8E44AD";
    return "#27AE60";
  }

  // ✅ Couleur badge expiration
  function expiryStatus(
    expiryDate: string | null,
  ): { label: string; color: string } | null {
    if (!expiryDate) return null;
    const d = new Date(expiryDate);
    const now = new Date();
    if (d < now)
      return {
        label: language === "en" ? "⚠ Expired" : "⚠ Expirée",
        color: "#E74C3C",
      };
    const days = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    if (days <= 7)
      return {
        label: language === "en" ? `⏰ ${days}d left` : `⏰ ${days}j restants`,
        color: "#E67E22",
      };
    return {
      label:
        language === "en"
          ? `Until ${formatDate(expiryDate)}`
          : `Jusqu'au ${formatDate(expiryDate)}`,
      color: "#27AE60",
    };
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <View
        style={[
          styles.header,
          { paddingTop: topPad + 12, borderBottomColor: colors.border },
        ]}
      >
        <View style={[styles.headerRow, { flexDirection: rowDir }]}>
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
            {t("merchant.rewards")}
          </Text>
          <TouchableOpacity
            onPress={() =>
              handleOpenCreate(listTab === "rewards" ? "reward" : "promotion")
            }
            style={[
              styles.createBtn,
              {
                backgroundColor: merchantAccentColor,
                borderRadius: colors.radius,
              },
            ]}
          >
            <Feather name="plus" size={iconSize(18)} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={[styles.tabRow, { flexDirection: rowDir }]}>
          {(["rewards", "promotions"] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              onPress={() => setListTab(tab)}
              style={[
                styles.tab,
                {
                  borderBottomColor:
                    listTab === tab ? merchantAccentColor : "transparent",
                },
              ]}
            >
              <Feather
                name={tab === "rewards" ? "gift" : "tag"}
                size={iconSize(14)}
                color={
                  listTab === tab ? merchantAccentColor : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      listTab === tab
                        ? merchantAccentColor
                        : colors.mutedForeground,
                    fontFamily:
                      listTab === tab
                        ? "Inter_600SemiBold"
                        : "Inter_400Regular",
                  },
                ]}
              >
                {tab === "rewards" ? labelRewards : labelPromotions}
                {tab === "rewards" &&
                  rewards.length > 0 &&
                  ` (${rewards.length})`}
                {tab === "promotions" &&
                  promotions.length > 0 &&
                  ` (${promotions.length})`}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Liste Récompenses ── */}
      {listTab === "rewards" && (
        <FlatList
          data={rewards}
          keyExtractor={(r) => r.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name="gift"
                size={iconSize(40)}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {labelNoRewards}
              </Text>
              <Button
                title={labelNewReward}
                onPress={() => handleOpenCreate("reward")}
                style={{ backgroundColor: merchantAccentColor }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const expiry = expiryStatus(item.expiry_date);
            const isExpired = expiry?.color === "#E74C3C";
            return (
              <Card style={{ marginBottom: 10 }}>
                <View style={[styles.rewardRow, { flexDirection: rowDir }]}>
                  <View
                    style={[
                      styles.iconBox,
                      {
                        backgroundColor:
                          item.is_active && !isExpired
                            ? merchantAccentColor + "20"
                            : colors.muted,
                        borderRadius: 10,
                      },
                    ]}
                  >
                    <Feather
                      name={
                        REWARD_ICONS[item.reward_type as RewardType] ?? "gift"
                      }
                      size={20}
                      color={
                        item.is_active && !isExpired
                          ? merchantAccentColor
                          : colors.mutedForeground
                      }
                    />
                  </View>
                  <View style={styles.rewardInfo}>
                    <Text
                      style={[
                        styles.rewardName,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          textAlign,
                        },
                      ]}
                    >
                      {item.name}
                    </Text>
                    <Text
                      style={[
                        styles.rewardPts,
                        {
                          color: colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                          textAlign,
                        },
                      ]}
                    >
                      {item.points_required} {t("rewards.pointsRequired")}
                    </Text>
                    {/* ✅ Badge expiration */}
                    {expiry && (
                      <View
                        style={[
                          styles.expiryBadge,
                          { backgroundColor: expiry.color + "15" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.expiryText,
                            {
                              color: expiry.color,
                              fontFamily: "Inter_600SemiBold",
                            },
                          ]}
                        >
                          {expiry.label}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View
                    style={[styles.rewardActions, { flexDirection: rowDir }]}
                  >
                    <Switch
                      value={item.is_active && !isExpired}
                      onValueChange={(v) =>
                        !isExpired && handleToggleReward(item.id, v)
                      }
                      trackColor={{
                        false: colors.border,
                        true: merchantAccentColor + "80",
                      }}
                      thumbColor={
                        item.is_active
                          ? merchantAccentColor
                          : colors.mutedForeground
                      }
                    />
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(item, "reward")}
                    >
                      <Feather
                        name="edit-2"
                        size={18}
                        color={merchantAccentColor}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleDelete(item.id, item.name, "rewards")
                      }
                    >
                      <Feather
                        name="trash-2"
                        size={18}
                        color={colors.destructive}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* ── Liste Promotions ── */}
      {listTab === "promotions" && (
        <FlatList
          data={promotions}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather
                name="tag"
                size={iconSize(40)}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.emptyText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {labelNoPromos}
              </Text>
              <Button
                title={labelNewPromo}
                onPress={() => handleOpenCreate("promotion")}
                style={{ backgroundColor: merchantAccentColor }}
              />
            </View>
          }
          renderItem={({ item }) => {
            const color = promoColor(item.type as PromoType);
            const isExpired =
              item.ends_at && new Date(item.ends_at) < new Date();
            return (
              <Card style={{ marginBottom: 10 }}>
                <View style={[styles.rewardRow, { flexDirection: rowDir }]}>
                  <View
                    style={[
                      styles.iconBox,
                      { backgroundColor: color + "18", borderRadius: 10 },
                    ]}
                  >
                    <Feather
                      name={PROMO_ICONS[item.type as PromoType] ?? "tag"}
                      size={20}
                      color={color}
                    />
                  </View>
                  <View style={styles.rewardInfo}>
                    <Text
                      style={[
                        styles.rewardName,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                          textAlign,
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {item.description && (
                      <Text
                        style={[
                          styles.rewardPts,
                          {
                            color: colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                            textAlign,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {item.description}
                      </Text>
                    )}
                    {item.ends_at && (
                      <Text
                        style={[
                          styles.rewardPts,
                          {
                            color: isExpired
                              ? colors.destructive
                              : colors.mutedForeground,
                            fontFamily: "Inter_400Regular",
                          },
                        ]}
                      >
                        {isExpired
                          ? "⚠ Expirée"
                          : `Jusqu'au ${formatDate(item.ends_at)}`}
                      </Text>
                    )}
                  </View>
                  <View
                    style={[styles.rewardActions, { flexDirection: rowDir }]}
                  >
                    <Switch
                      value={item.is_active}
                      onValueChange={(v) => handleTogglePromo(item.id, v)}
                      trackColor={{ false: colors.border, true: color + "80" }}
                      thumbColor={
                        item.is_active ? color : colors.mutedForeground
                      }
                    />
                    <TouchableOpacity
                      onPress={() => handleOpenEdit(item, "promotion")}
                    >
                      <Feather
                        name="edit-2"
                        size={18}
                        color={merchantAccentColor}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() =>
                        handleDelete(item.id, item.title, "promotions")
                      }
                    >
                      <Feather
                        name="trash-2"
                        size={18}
                        color={colors.destructive}
                      />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* ── Modal Création / Édition ── */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderRadius: colors.radius * 2 },
            ]}
          >
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
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
                {editingItem
                  ? entryMode === "reward"
                    ? labelEditReward
                    : labelEditPromo
                  : entryMode === "reward"
                    ? labelNewReward
                    : labelNewPromo}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Feather
                  name="x"
                  size={iconSize(22)}
                  color={colors.mutedForeground}
                />
              </TouchableOpacity>
            </View>

            {!editingItem && (
              <View
                style={[styles.modeToggle, { backgroundColor: colors.muted }]}
              >
                {(["reward", "promotion"] as EntryMode[]).map((m) => (
                  <TouchableOpacity
                    key={m}
                    onPress={() => setEntryMode(m)}
                    style={[
                      styles.modeBtn,
                      {
                        backgroundColor:
                          entryMode === m ? colors.card : "transparent",
                        borderRadius: colors.radius,
                        shadowColor: entryMode === m ? "#000" : "transparent",
                        shadowOpacity: 0.08,
                        shadowRadius: 4,
                        elevation: entryMode === m ? 2 : 0,
                      },
                    ]}
                  >
                    <Feather
                      name={m === "reward" ? "gift" : "tag"}
                      size={iconSize(14)}
                      color={
                        entryMode === m
                          ? merchantAccentColor
                          : colors.mutedForeground
                      }
                    />
                    <Text
                      style={{
                        color:
                          entryMode === m
                            ? merchantAccentColor
                            : colors.mutedForeground,
                        fontFamily:
                          entryMode === m
                            ? "Inter_700Bold"
                            : "Inter_400Regular",
                        fontSize: fs(13),
                      }}
                    >
                      {m === "reward" ? labelReward : labelPromotion}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={60}
            >
              {/* ── Champs Récompense ── */}
              {entryMode === "reward" && (
                <>
                  <Input
                    label={t("rewards.rewardName")}
                    placeholder={t("rewards.rewardName")}
                    value={name}
                    onChangeText={setName}
                    autoCapitalize="sentences"
                    leftIcon="gift"
                    error={errors.name}
                  />
                  <Input
                    label={t("rewards.pointsThreshold")}
                    placeholder="500"
                    value={pointsRequired}
                    onChangeText={setPointsRequired}
                    keyboardType="number-pad"
                    leftIcon="zap"
                    error={errors.pts}
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                        textAlign,
                      },
                    ]}
                  >
                    {t("rewards.rewardType")}
                  </Text>
                  <View style={[styles.typeRow, { flexDirection: rowDir }]}>
                    {(
                      ["discount", "freeProduct", "freeService"] as RewardType[]
                    ).map((rt) => (
                      <TouchableOpacity
                        key={rt}
                        onPress={() => setRewardType(rt)}
                        style={[
                          styles.typeBtn,
                          {
                            borderRadius: colors.radius,
                            borderColor:
                              rewardType === rt
                                ? merchantAccentColor
                                : colors.border,
                            backgroundColor:
                              rewardType === rt
                                ? merchantAccentColor + "15"
                                : colors.background,
                            borderWidth: rewardType === rt ? 2 : 1,
                          },
                        ]}
                      >
                        <Feather
                          name={REWARD_ICONS[rt]}
                          size={16}
                          color={
                            rewardType === rt
                              ? merchantAccentColor
                              : colors.mutedForeground
                          }
                        />
                        <Text
                          style={{
                            color:
                              rewardType === rt
                                ? merchantAccentColor
                                : colors.mutedForeground,
                            fontFamily:
                              rewardType === rt
                                ? "Inter_600SemiBold"
                                : "Inter_400Regular",
                            fontSize: fs(12),
                            textAlign: "center",
                          }}
                        >
                          {REWARD_TYPE_LABELS[rt]}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* ✅ Date d'expiration récompense */}
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                        textAlign,
                        marginBottom: 6,
                      },
                    ]}
                  >
                    {labelRewardExpiry}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowRewardDatePicker(true)}
                    style={[
                      styles.datePickerBtn,
                      {
                        borderColor: rewardExpiryDate
                          ? merchantAccentColor
                          : colors.border,
                        backgroundColor: colors.card,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Feather
                      name="clock"
                      size={iconSize(16)}
                      color={
                        rewardExpiryDate
                          ? merchantAccentColor
                          : colors.mutedForeground
                      }
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: rewardExpiryDate
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(15),
                      }}
                    >
                      {rewardExpiryDate
                        ? rewardExpiryDate.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : labelNoRewardExpiry}
                    </Text>
                    {rewardExpiryDate && (
                      <TouchableOpacity
                        onPress={() => setRewardExpiryDate(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather
                          name="x"
                          size={iconSize(14)}
                          color={colors.mutedForeground}
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {showRewardDatePicker && (
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        overflow: "hidden",
                        marginBottom: 8,
                      }}
                    >
                      <DateTimePicker
                        value={rewardExpiryDate ?? new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "inline" : "default"}
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          setShowRewardDatePicker(Platform.OS === "ios");
                          if (event.type !== "dismissed" && date)
                            setRewardExpiryDate(date);
                        }}
                        locale={
                          language === "ar"
                            ? "ar"
                            : language === "en"
                              ? "en"
                              : "fr"
                        }
                        style={{ backgroundColor: "#FFFFFF" }}
                        themeVariant="light"
                      />
                    </View>
                  )}
                </>
              )}

              {/* ── Champs Promotion ── */}
              {entryMode === "promotion" && (
                <>
                  <Input
                    label={
                      language === "ar"
                        ? "عنوان العرض"
                        : language === "en"
                          ? "Offer title"
                          : "Titre de l'offre"
                    }
                    placeholder={
                      language === "ar"
                        ? "مثال: -20% على الكل"
                        : language === "en"
                          ? "e.g. -20% on everything"
                          : "Ex : -20% sur tout le menu"
                    }
                    value={promoTitle}
                    onChangeText={setPromoTitle}
                    autoCapitalize="sentences"
                    leftIcon="tag"
                    error={errors.promoTitle}
                  />
                  <Input
                    label={
                      language === "ar"
                        ? "الوصف (اختياري)"
                        : language === "en"
                          ? "Description (optional)"
                          : "Description (optionnel)"
                    }
                    placeholder={
                      language === "ar"
                        ? "تفاصيل إضافية..."
                        : language === "en"
                          ? "More details..."
                          : "Détails supplémentaires..."
                    }
                    value={promoDesc}
                    onChangeText={setPromoDesc}
                    autoCapitalize="sentences"
                    leftIcon="align-left"
                    multiline
                  />
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                        textAlign,
                        marginBottom: 6,
                      },
                    ]}
                  >
                    {labelEndsAt}
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowDatePicker(true)}
                    style={[
                      styles.datePickerBtn,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.card,
                        borderRadius: colors.radius,
                      },
                    ]}
                  >
                    <Feather
                      name="calendar"
                      size={iconSize(16)}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={{
                        flex: 1,
                        color: promoEndsDate
                          ? colors.foreground
                          : colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                        fontSize: fs(15),
                      }}
                    >
                      {promoEndsDate
                        ? promoEndsDate.toLocaleDateString("fr-FR", {
                            day: "2-digit",
                            month: "long",
                            year: "numeric",
                          })
                        : language === "ar"
                          ? "بدون تاريخ انتهاء"
                          : language === "en"
                            ? "No end date"
                            : "Sans date de fin"}
                    </Text>
                    {promoEndsDate && (
                      <TouchableOpacity
                        onPress={() => setPromoEndsDate(null)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Feather
                          name="x"
                          size={iconSize(14)}
                          color={colors.mutedForeground}
                        />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                  {showDatePicker && (
                    <View
                      style={{
                        backgroundColor: "#FFFFFF",
                        borderRadius: 12,
                        overflow: "hidden",
                        marginBottom: 8,
                      }}
                    >
                      <DateTimePicker
                        value={promoEndsDate ?? new Date()}
                        mode="date"
                        display={Platform.OS === "ios" ? "inline" : "default"}
                        minimumDate={new Date()}
                        onChange={(event, date) => {
                          setShowDatePicker(Platform.OS === "ios");
                          if (event.type !== "dismissed" && date)
                            setPromoEndsDate(date);
                        }}
                        locale={
                          language === "ar"
                            ? "ar"
                            : language === "en"
                              ? "en"
                              : "fr"
                        }
                        style={{ backgroundColor: "#FFFFFF" }}
                        themeVariant="light"
                      />
                    </View>
                  )}
                  <Text
                    style={[
                      styles.typeLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_500Medium",
                        textAlign,
                      },
                    ]}
                  >
                    {language === "ar"
                      ? "نوع العرض"
                      : language === "en"
                        ? "Offer type"
                        : "Type d'offre"}
                  </Text>
                  <View style={[styles.typeRow, { flexDirection: rowDir }]}>
                    {(["discount", "flash", "event"] as PromoType[]).map(
                      (pt) => {
                        const color = promoColor(pt);
                        return (
                          <TouchableOpacity
                            key={pt}
                            onPress={() => setPromoType(pt)}
                            style={[
                              styles.typeBtn,
                              {
                                borderRadius: colors.radius,
                                borderColor:
                                  promoType === pt ? color : colors.border,
                                backgroundColor:
                                  promoType === pt
                                    ? color + "15"
                                    : colors.background,
                                borderWidth: promoType === pt ? 2 : 1,
                              },
                            ]}
                          >
                            <Feather
                              name={PROMO_ICONS[pt]}
                              size={16}
                              color={
                                promoType === pt
                                  ? color
                                  : colors.mutedForeground
                              }
                            />
                            <Text
                              style={{
                                color:
                                  promoType === pt
                                    ? color
                                    : colors.mutedForeground,
                                fontFamily:
                                  promoType === pt
                                    ? "Inter_600SemiBold"
                                    : "Inter_400Regular",
                                fontSize: fs(12),
                                textAlign: "center",
                              }}
                            >
                              {PROMO_TYPE_LABELS[pt]}
                            </Text>
                          </TouchableOpacity>
                        );
                      },
                    )}
                  </View>
                </>
              )}

              <Button
                title={
                  editingItem
                    ? t("common.save")
                    : entryMode === "reward"
                      ? t("rewards.save")
                      : language === "ar"
                        ? "نشر العرض"
                        : language === "en"
                          ? "Publish offer"
                          : "Publier l'offre"
                }
                onPress={handleSave}
                loading={loading}
                size="lg"
                style={{
                  marginTop: 8,
                  backgroundColor:
                    entryMode === "reward"
                      ? merchantAccentColor
                      : promoColor(promoType),
                }}
              />
            </KeyboardAwareScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1 },
  headerRow: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: sp(12),
  },
  title: { fontSize: fs(24) },
  createBtn: { padding: 10 },
  tabRow: { gap: 0 },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingBottom: 10,
    borderBottomWidth: 2,
  },
  tabText: { fontSize: fs(14) },
  list: { padding: 16 },
  rewardRow: { alignItems: "center", gap: 12 },
  iconBox: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  rewardInfo: { flex: 1, gap: 3 },
  rewardName: { fontSize: fs(14) },
  rewardPts: { fontSize: fs(12) },
  // ✅ Badge expiration
  expiryBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
    marginTop: 3,
  },
  expiryText: { fontSize: fs(11) },
  rewardActions: { alignItems: "center", gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: fs(15) },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: { maxHeight: "88%", padding: 24, margin: 12, marginBottom: 24 },
  modalHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: fs(20) },
  modeToggle: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  modeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  typeLabel: { fontSize: fs(13), marginBottom: 8 },
  typeRow: { gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, padding: 10, alignItems: "center", gap: 6 },
  datePickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 12,
  },
});
