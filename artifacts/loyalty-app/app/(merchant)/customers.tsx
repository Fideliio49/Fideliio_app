import React, { useState } from "react";
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
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

const TIER_VARIANTS: Record<string, "default" | "success" | "warning" | "danger" | "purple"> = {
  bronze: "warning",
  silver: "default",
  gold: "warning",
};

export default function MerchantCustomersScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { customers, getMerchantByUserId, adjustCustomerPoints } = useData();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [selectedCust, setSelectedCust] = useState<string | null>(null);
  const [adjustDelta, setAdjustDelta] = useState("");
  const [adjustLoading, setAdjustLoading] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = customers.filter((c) => {
    const q = search.toLowerCase();
    return (
      search.trim() === "" ||
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(q) ||
      (c.phone ?? "").includes(q)
    );
  });

  async function handleAdjust(positive: boolean) {
    const delta = parseInt(adjustDelta);
    if (isNaN(delta) || delta <= 0) {
      Alert.alert("", "Please enter a valid number");
      return;
    }
    setAdjustLoading(true);
    try {
      await adjustCustomerPoints(selectedCust!, positive ? delta : -delta);
      setSelectedCust(null);
      setAdjustDelta("");
    } finally {
      setAdjustLoading(false);
    }
  }

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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

      <FlatList
        data={filtered}
        keyExtractor={(c) => c.id}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        renderItem={({ item }) => (
          <Card style={styles.customerCard}>
            <View style={styles.row}>
              <View style={[styles.avatar, { backgroundColor: colors.purple100 }]}>
                <Text style={[styles.avatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                  {item.firstName[0]}{item.lastName[0]}
                </Text>
              </View>
              <View style={styles.info}>
                <Text style={[styles.custName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {item.firstName} {item.lastName}
                </Text>
                {item.phone && (
                  <Text style={[styles.custPhone, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                    {item.phone}
                  </Text>
                )}
                <View style={styles.tierRow}>
                  <Badge
                    label={t(`customers.${item.tier}` as any)}
                    variant={TIER_VARIANTS[item.tier]}
                  />
                  <Text style={[styles.points, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                    {item.totalPoints} pts
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => { Keyboard.dismiss(); setSelectedCust(item.id); }}
                style={[styles.adjustBtn, { backgroundColor: colors.muted, borderRadius: colors.radius - 4 }]}
              >
                <Feather name="edit-3" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
          </Card>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="users" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("customers.noCustomers")}
            </Text>
          </View>
        }
      />

      <Modal visible={!!selectedCust} transparent animationType="slide">
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("customers.adjustPoints")}
            </Text>
            <Input
              label={t("customers.adjustPoints")}
              placeholder="100"
              value={adjustDelta}
              onChangeText={setAdjustDelta}
              keyboardType="number-pad"
              leftIcon="zap"
            />
            <View style={styles.adjustBtns}>
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
              onPress={() => { setSelectedCust(null); setAdjustDelta(""); }}
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
  title: { fontSize: 24 },
  list: { padding: 16 },
  customerCard: { marginBottom: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18 },
  info: { flex: 1, gap: 4 },
  custName: { fontSize: 15 },
  custPhone: { fontSize: 13 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  points: { fontSize: 14 },
  adjustBtn: { padding: 10 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalCard: { padding: 28, gap: 16, margin: 12, marginBottom: 24 },
  modalTitle: { fontSize: 20 },
  adjustBtns: { flexDirection: "row", gap: 12 },
});
