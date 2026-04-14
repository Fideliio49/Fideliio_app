import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Platform,
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

export default function CustomerScanScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user } = useApp();
  const { merchants, getCustomerByUserId, addTransaction } = useData();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [earnedPoints, setEarnedPoints] = useState(0);
  const [merchantName, setMerchantName] = useState("");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  async function handleValidate() {
    if (!code.trim()) {
      Alert.alert("", "Please enter a merchant code");
      return;
    }

    const merchant = merchants.find(
      (m) => m.id === code.trim() || m.businessName.toLowerCase() === code.trim().toLowerCase()
    ) ?? merchants[0];

    if (!merchant) {
      Alert.alert("", "Merchant not found");
      return;
    }

    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 800));
      const customer = user ? getCustomerByUserId(user.id) : null;
      if (!customer) return;

      const amount = 100;
      const points = amount * merchant.pointsRate;

      await addTransaction({
        customerId: customer.id,
        merchantId: merchant.id,
        merchantName: merchant.businessName,
        customerName: `${user?.firstName} ${user?.lastName}`,
        amount,
        pointsEarned: points,
      });

      setEarnedPoints(points);
      setMerchantName(merchant.businessName);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessModal(true);
      setCode("");
    } catch {
      Alert.alert("Error", "Failed to validate purchase");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
          {t("scan.title")}
        </Text>
      </View>

      <View style={styles.scanArea}>
        <View style={[styles.qrFrame, { borderColor: colors.primary }]}>
          <Feather name="camera" size={64} color={colors.primary} />
          <Text style={[styles.qrHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("scan.title")}
          </Text>
        </View>
      </View>

      <View style={styles.manualWrap}>
        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("scan.manualCode")}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <Card style={styles.card}>
          <Input
            label={t("scan.merchantCode")}
            placeholder="Ex: m1 or Café Atlas"
            value={code}
            onChangeText={setCode}
            leftIcon="hash"
          />
          <Button
            title={t("scan.confirm")}
            onPress={handleValidate}
            loading={loading}
            size="lg"
          />
        </Card>
      </View>

      <Modal visible={successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderRadius: colors.radius * 2 }]}>
            <View style={[styles.successIcon, { backgroundColor: colors.green100 }]}>
              <Feather name="check-circle" size={48} color={colors.secondary} />
            </View>
            <Text style={[styles.successTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {t("scan.scanSuccess")}
            </Text>
            <Text style={[styles.successSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {merchantName}
            </Text>
            <Text style={[styles.successPoints, { color: colors.secondary, fontFamily: "Inter_700Bold" }]}>
              +{earnedPoints} pts
            </Text>
            <Text style={[styles.successPtsLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("scan.pointsEarned")}
            </Text>
            <Button
              title={t("common.close")}
              onPress={() => setSuccessModal(false)}
              size="md"
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24 },
  scanArea: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  qrFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  qrHint: { fontSize: 14 },
  manualWrap: { padding: 20, paddingBottom: 100 },
  dividerRow: { flexDirection: "row", alignItems: "center", marginBottom: 20, gap: 10 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  card: {},
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modalCard: {
    padding: 32,
    alignItems: "center",
    width: "100%",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  successIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 22 },
  successSub: { fontSize: 15 },
  successPoints: { fontSize: 48, marginTop: 8 },
  successPtsLabel: { fontSize: 15 },
});
