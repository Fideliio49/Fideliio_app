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
import { fs, iconSize } from "@/utils/responsive";
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

type RewardType = "discount" | "freeProduct" | "freeService";

const TYPE_ICONS: Record<RewardType, keyof typeof Feather.glyphMap> = {
  discount: "percent",
  freeProduct: "gift",
  freeService: "star",
};

export default function MerchantRewardsScreen() {
  const colors = useColors();
  const { user, isRTL, merchantAccentColor } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const [merchant, setMerchant] = useState<any>(null);
  const [rewards, setRewards] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editingReward, setEditingReward] = useState<any>(null); // ✅ null = création, objet = édition
  const [name, setName] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("discount");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const textAlign = isRTL ? "right" : "left";
  const rowDir = isRTL ? "row-reverse" : "row";

  const TYPE_LABELS: Record<RewardType, string> = {
    discount: t("rewards.discount"),
    freeProduct: t("rewards.freeProduct"),
    freeService: t("rewards.freeService"),
  };

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
    const { data: merchantData, error } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error || !merchantData) return;
    setMerchant(merchantData);
    const { data: rewardsData } = await supabase
      .from("rewards")
      .select("*")
      .eq("merchant_id", merchantData.id)
      .order("created_at", { ascending: false });
    setRewards(rewardsData ?? []);
  }

  // ✅ Ouvrir modal en mode édition
  function handleOpenEdit(reward: any) {
    setEditingReward(reward);
    setName(reward.name);
    setPointsRequired(String(reward.points_required));
    setRewardType(reward.reward_type as RewardType);
    setErrors({});
    setShowCreate(true);
  }

  // ✅ Ouvrir modal en mode création
  function handleOpenCreate() {
    setEditingReward(null);
    setName("");
    setPointsRequired("");
    setRewardType("discount");
    setErrors({});
    setShowCreate(true);
  }

  function handleCloseModal() {
    setShowCreate(false);
    setEditingReward(null);
    setName("");
    setPointsRequired("");
    setRewardType("discount");
    setErrors({});
  }

  async function handleSave() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = t("common.error");
    if (!pointsRequired.trim() || isNaN(parseInt(pointsRequired)))
      errs.pts = t("common.error");
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      if (editingReward) {
        // ✅ Mode édition — UPDATE
        const { error } = await supabase
          .from("rewards")
          .update({
            name: name.trim(),
            points_required: parseInt(pointsRequired),
            reward_type: rewardType,
          })
          .eq("id", editingReward.id);
        if (error) throw error;
      } else {
        // Mode création — INSERT
        let currentMerchant = merchant;
        if (!currentMerchant) {
          const { data } = await supabase
            .from("merchants")
            .select("*")
            .eq("user_id", user!.id)
            .maybeSingle();
          if (!data) {
            Alert.alert(t("common.error"), "Aucun commerce trouvé.");
            return;
          }
          currentMerchant = data;
          setMerchant(data);
        }
        const { nanoid } = await import("nanoid/non-secure");
        const { error } = await supabase.from("rewards").insert({
          id: nanoid(),
          merchant_id: currentMerchant.id,
          merchant_name: currentMerchant.business_name,
          name: name.trim(),
          points_required: parseInt(pointsRequired),
          reward_type: rewardType,
          is_active: true,
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

  async function handleToggle(id: string, isActive: boolean) {
    const { error } = await supabase
      .from("rewards")
      .update({ is_active: isActive })
      .eq("id", id);
    if (!error)
      setRewards((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_active: isActive } : r)),
      );
  }

  async function handleDelete(id: string, rewardName: string) {
    Alert.alert(t("common.delete"), rewardName, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          const { error } = await supabase
            .from("rewards")
            .delete()
            .eq("id", id);
          if (!error) setRewards((prev) => prev.filter((r) => r.id !== id));
        },
      },
    ]);
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
            onPress={handleOpenCreate}
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
      </View>

      {/* ── Liste ── */}
      <FlatList
        data={rewards}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <View style={[styles.rewardRow, { flexDirection: rowDir }]}>
              <View
                style={[
                  styles.iconBox,
                  {
                    backgroundColor: item.is_active
                      ? merchantAccentColor + "20"
                      : colors.muted,
                    borderRadius: 10,
                  },
                ]}
              >
                <Feather
                  name={TYPE_ICONS[item.reward_type as RewardType] ?? "gift"}
                  size={20}
                  color={
                    item.is_active
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
              </View>
              <View style={[styles.rewardActions, { flexDirection: rowDir }]}>
                <Switch
                  value={item.is_active}
                  onValueChange={(v) => handleToggle(item.id, v)}
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
                {/* ✅ Bouton édition */}
                <TouchableOpacity onPress={() => handleOpenEdit(item)}>
                  <Feather
                    name="edit-2"
                    size={18}
                    color={merchantAccentColor}
                  />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleDelete(item.id, item.name)}
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
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        scrollEnabled={!!rewards.length}
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
              {t("rewards.createReward")}
            </Text>
            <Button
              title={t("rewards.createReward")}
              onPress={handleOpenCreate}
              style={{ backgroundColor: merchantAccentColor }}
            />
          </View>
        }
      />

      {/* ── Modal création / édition ── */}
      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, borderRadius: colors.radius * 2 },
            ]}
          >
            <View style={[styles.modalHeader, { flexDirection: rowDir }]}>
              {/* ✅ Titre dynamique selon le mode */}
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
                {editingReward
                  ? "Modifier la récompense"
                  : t("rewards.createReward")}
              </Text>
              <TouchableOpacity onPress={handleCloseModal}>
                <Feather name="x" size={iconSize(22)} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <KeyboardAwareScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              bottomOffset={60}
            >
              <Input
                label={t("rewards.rewardName")}
                placeholder={t("rewards.rewardName")}
                value={name}
                onChangeText={setName}
                keyboardType="default"
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
                      name={TYPE_ICONS[rt]}
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
                      {TYPE_LABELS[rt]}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button
                title={editingReward ? t("common.save") : t("rewards.save")}
                onPress={handleSave}
                loading={loading}
                size="lg"
                style={{ marginTop: 8, backgroundColor: merchantAccentColor }}
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
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: fs(24) },
  createBtn: { padding: 10 },
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
  rewardActions: { alignItems: "center", gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: fs(15) },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: { maxHeight: "80%", padding: 24, margin: 12, marginBottom: 24 },
  modalHeader: {
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  modalTitle: { fontSize: fs(20) },
  typeLabel: { fontSize: fs(13), marginBottom: 8 },
  typeRow: { gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, padding: 10, alignItems: "center", gap: 6 },
});
