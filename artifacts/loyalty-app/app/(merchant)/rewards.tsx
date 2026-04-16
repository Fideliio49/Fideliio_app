import React, { useState } from "react";
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
  ScrollView,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { Reward } from "@/context/DataContext";

type RewardType = "discount" | "freeProduct" | "freeService";

const TYPE_ICONS: Record<RewardType, keyof typeof Feather.glyphMap> = {
  discount: "percent",
  freeProduct: "gift",
  freeService: "star",
};

export default function MerchantRewardsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { getMerchantByUserId, getMerchantRewards, addReward, updateReward, deleteReward } = useData();
  const insets = useSafeAreaInsets();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [pointsRequired, setPointsRequired] = useState("");
  const [rewardType, setRewardType] = useState<RewardType>("discount");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const merchant = user ? getMerchantByUserId(user.id) : null;
  const rewards = merchant ? getMerchantRewards(merchant.id) : [];

  async function handleCreate() {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Required";
    if (!pointsRequired.trim() || isNaN(parseInt(pointsRequired))) errs.pts = "Required";
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      await addReward({
        merchantId: merchant!.id,
        merchantName: merchant!.businessName,
        name,
        pointsRequired: parseInt(pointsRequired),
        rewardType,
        isActive: true,
      });
      setName("");
      setPointsRequired("");
      setRewardType("discount");
      setShowCreate(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <View style={styles.headerRow}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("merchant.rewards")}
          </Text>
          <TouchableOpacity
            onPress={() => setShowCreate(true)}
            style={[styles.createBtn, { backgroundColor: colors.secondary, borderRadius: colors.radius }]}
          >
            <Feather name="plus" size={18} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={rewards}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <Card style={{ marginBottom: 10 }}>
            <View style={styles.rewardRow}>
              <View style={[styles.iconBox, { backgroundColor: item.isActive ? colors.green100 : colors.muted, borderRadius: 10 }]}>
                <Feather name={TYPE_ICONS[item.rewardType]} size={20} color={item.isActive ? colors.secondary : colors.mutedForeground} />
              </View>
              <View style={styles.rewardInfo}>
                <Text style={[styles.rewardName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {item.name}
                </Text>
                <Text style={[styles.rewardPts, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {item.pointsRequired} {t("rewards.pointsRequired")}
                </Text>
              </View>
              <View style={styles.rewardActions}>
                <Switch
                  value={item.isActive}
                  onValueChange={(v) => updateReward(item.id, { isActive: v })}
                  trackColor={{ false: colors.border, true: colors.secondary + "80" }}
                  thumbColor={item.isActive ? colors.secondary : colors.mutedForeground}
                />
                <TouchableOpacity
                  onPress={() =>
                    Alert.alert(t("common.delete"), item.name, [
                      { text: t("common.cancel"), style: "cancel" },
                      { text: t("common.delete"), style: "destructive", onPress: () => deleteReward(item.id) },
                    ])
                  }
                >
                  <Feather name="trash-2" size={18} color={colors.destructive} />
                </TouchableOpacity>
              </View>
            </View>
          </Card>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        scrollEnabled={!!rewards.length}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="gift" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("rewards.createReward")}
            </Text>
            <Button title={t("rewards.createReward")} onPress={() => setShowCreate(true)} />
          </View>
        }
      />

      <Modal visible={showCreate} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
                {t("rewards.createReward")}
              </Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Feather name="x" size={22} color={colors.mutedForeground} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" onScrollBeginDrag={Keyboard.dismiss}>
              <Input
                label={t("rewards.rewardName")}
                placeholder="Ex: Free coffee"
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
              <Text style={[styles.typeLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
                {t("rewards.rewardType")}
              </Text>
              <View style={styles.typeRow}>
                {(["discount", "freeProduct", "freeService"] as RewardType[]).map((rt) => (
                  <TouchableOpacity
                    key={rt}
                    onPress={() => setRewardType(rt)}
                    style={[
                      styles.typeBtn,
                      {
                        borderRadius: colors.radius,
                        borderColor: rewardType === rt ? colors.secondary : colors.border,
                        backgroundColor: rewardType === rt ? colors.green100 : colors.background,
                        borderWidth: rewardType === rt ? 2 : 1,
                      },
                    ]}
                  >
                    <Feather name={TYPE_ICONS[rt]} size={16} color={rewardType === rt ? colors.secondary : colors.mutedForeground} />
                    <Text style={[{ color: rewardType === rt ? colors.secondary : colors.mutedForeground, fontFamily: rewardType === rt ? "Inter_600SemiBold" : "Inter_400Regular", fontSize: 12 }]}>
                      {t(`rewards.${rt === "discount" ? "discount" : rt === "freeProduct" ? "freeProduct" : "freeService"}` as any)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Button
                title={t("rewards.save")}
                onPress={handleCreate}
                loading={loading}
                variant="secondary"
                size="lg"
                style={{ marginTop: 8 }}
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 24 },
  createBtn: { padding: 10 },
  list: { padding: 16 },
  rewardRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBox: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  rewardInfo: { flex: 1, gap: 3 },
  rewardName: { fontSize: 14 },
  rewardPts: { fontSize: 12 },
  rewardActions: { flexDirection: "row", alignItems: "center", gap: 12 },
  empty: { alignItems: "center", paddingTop: 80, gap: 16 },
  emptyText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { maxHeight: "80%", padding: 24, margin: 12, marginBottom: 24 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  modalTitle: { fontSize: 20 },
  typeLabel: { fontSize: 13, marginBottom: 8 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  typeBtn: { flex: 1, padding: 10, alignItems: "center", gap: 6 },
});
