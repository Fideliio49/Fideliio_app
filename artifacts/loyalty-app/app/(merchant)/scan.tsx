import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import * as Haptics from "expo-haptics";

export default function MerchantScanScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { getMerchantByUserId, customers, addTransaction } = useData();
  const insets = useSafeAreaInsets();

  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [customerName, setCustomerName] = useState("");
  const [showQr, setShowQr] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const merchant = user ? getMerchantByUserId(user.id) : null;

  async function handleValidate() {
    const errs: Record<string, string> = {};
    if (!customerPhone.trim()) errs.phone = "Required";
    if (!amount.trim() || isNaN(parseFloat(amount))) errs.amount = "Required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));

      const amountNum = parseFloat(amount);
      const rate = merchant?.pointsRate ?? 1;
      const points = Math.floor(amountNum * rate);

      const customer = customers.find(
        (c) => c.phone === customerPhone.trim() || c.id === customerPhone.trim()
      ) ?? customers[0];

      if (!customer) {
        Alert.alert("", "Customer not found");
        return;
      }

      if (merchant) {
        await addTransaction({
          customerId: customer.id,
          merchantId: merchant.id,
          merchantName: merchant.businessName,
          customerName: `${customer.firstName} ${customer.lastName}`,
          amount: amountNum,
          pointsEarned: points,
        });
      }

      setEarnedPoints(points);
      setCustomerName(`${customer.firstName} ${customer.lastName}`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessModal(true);
      setCustomerPhone("");
      setAmount("");
      setErrors({});
    } catch {
      Alert.alert("Error", "Validation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("merchant.scan")}
        </Text>
      </View>

      <View style={styles.content}>
        <TouchableOpacity
          onPress={() => setShowQr(true)}
          activeOpacity={0.85}
          style={[styles.qrBtn, { backgroundColor: colors.accent, borderRadius: colors.radius * 1.5, borderColor: colors.primary }]}
        >
          <Feather name="grid" size={32} color={colors.primary} />
          <View>
            <Text style={[styles.qrTitle, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {t("scan.generateQr")}
            </Text>
            <Text style={[styles.qrSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("scan.qrSubtitle")}
            </Text>
          </View>
          <Feather name="chevron-right" size={20} color={colors.primary} />
        </TouchableOpacity>

        <Text style={[styles.dividerLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
          {t("scan.enterAmount")}
        </Text>

        <Card>
          <Input
            label={t("scan.customerPhone")}
            placeholder="+212 6XX XXX XXX"
            value={customerPhone}
            onChangeText={setCustomerPhone}
            keyboardType="phone-pad"
            leftIcon="smartphone"
            error={errors.phone}
          />
          <Input
            label={t("scan.amount")}
            placeholder="0.00"
            value={amount}
            onChangeText={setAmount}
            keyboardType="decimal-pad"
            leftIcon="tag"
            error={errors.amount}
          />
          {amount && !isNaN(parseFloat(amount)) && merchant && (
            <View style={[styles.preview, { backgroundColor: colors.green100, borderRadius: colors.radius }]}>
              <Feather name="zap" size={16} color={colors.secondary} />
              <Text style={[styles.previewText, { color: colors.green600, fontFamily: "Inter_600SemiBold" }]}>
                +{Math.floor(parseFloat(amount) * merchant.pointsRate)} {t("common.points")}
              </Text>
            </View>
          )}
          <Button
            title={t("scan.validate")}
            onPress={handleValidate}
            loading={loading}
            variant="secondary"
            size="lg"
            style={{ marginTop: 8 }}
          />
        </Card>
      </View>

      <Modal visible={showQr} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("scan.generateQr")}
            </Text>
            <View style={[styles.qrPlaceholder, { borderColor: colors.primary, backgroundColor: colors.muted }]}>
              <Feather name="grid" size={64} color={colors.primary} />
              <Text style={[styles.qrId, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {merchant?.id ?? "m1"}
              </Text>
            </View>
            <Text style={[styles.qrSub2, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("scan.qrSubtitle")}
            </Text>
            <Button title={t("common.close")} onPress={() => setShowQr(false)} variant="outline" />
          </View>
        </View>
      </Modal>

      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
            <View style={[styles.successIcon, { backgroundColor: colors.green100 }]}>
              <Feather name="check-circle" size={48} color={colors.secondary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("scan.scanSuccess")}
            </Text>
            <Text style={[styles.custName, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {customerName}
            </Text>
            <Text style={[styles.pts, { color: colors.secondary, fontFamily: "Inter_700Bold" }]}>
              +{earnedPoints} pts
            </Text>
            <Button title={t("common.close")} onPress={() => setSuccessModal(false)} />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 8 },
  title: { fontSize: 24 },
  content: { padding: 20, gap: 16 },
  qrBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderWidth: 1.5,
  },
  qrTitle: { fontSize: 16 },
  qrSub: { fontSize: 13, marginTop: 2 },
  dividerLabel: { fontSize: 15 },
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 8,
  },
  previewText: { fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center", padding: 24 },
  modalCard: { padding: 28, alignItems: "center", width: "100%", gap: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10 },
  modalTitle: { fontSize: 20 },
  qrPlaceholder: { width: 180, height: 180, borderRadius: 16, borderWidth: 2, alignItems: "center", justifyContent: "center", gap: 8 },
  qrId: { fontSize: 13 },
  qrSub2: { fontSize: 14, textAlign: "center" },
  successIcon: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  successTitle: { fontSize: 22 },
  custName: { fontSize: 15 },
  pts: { fontSize: 48 },
});
