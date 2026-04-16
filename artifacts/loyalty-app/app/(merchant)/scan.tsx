import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  Animated,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData, CustomerData } from "@/context/DataContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import * as Haptics from "expo-haptics";

type ScanStep = "scanning" | "confirm" | "amount" | "success";

const QUICK_AMOUNTS = [20, 50, 100, 200];
const MULTIPLIERS = [1, 2, 5, 10, 20, 50];

function formatAmount(raw: string): string {
  if (!raw || raw === "0") return "0";
  const n = parseInt(raw, 10);
  if (isNaN(n)) return "0";
  return n.toLocaleString("fr-FR");
}

export default function MerchantScanScreen() {
  const colors = useColors();
  const { user, colorTheme, merchantAccentColor } = useApp();
  const { getMerchantByUserId, getCustomerByQrCode, addTransaction } = useData();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<ScanStep>("scanning");
  const [scannedCustomer, setScannedCustomer] = useState<CustomerData | null>(null);
  const [rawAmount, setRawAmount] = useState("0");
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ points: number; name: string } | null>(null);
  const [webCode, setWebCode] = useState("");
  const [activelyScanning, setActivelyScanning] = useState(true);

  const scaleAnim = useRef(new Animated.Value(0)).current;

  const merchant = user ? getMerchantByUserId(user.id) : null;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isDark = colorTheme === "dark";

  const amountNum = parseInt(rawAmount, 10) || 0;
  const effectiveAmount = amountNum * multiplier;
  const points = merchant ? Math.floor(effectiveAmount * merchant.pointsRate) : 0;

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") StatusBar.setBackgroundColor("#000", true);
    }, [])
  );

  useEffect(() => {
    if (step === "scanning") {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") StatusBar.setBackgroundColor("#000", true);
    } else if (step === "success") {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") StatusBar.setBackgroundColor(merchantAccentColor, true);
    } else {
      StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(isDark ? "#121212" : "#F9FAFB", true);
      }
    }
  }, [step, isDark, merchantAccentColor]);

  useEffect(() => {
    if (step === "success") {
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 80,
        friction: 8,
        useNativeDriver: true,
      }).start();
      const timer = setTimeout(handleReset, 2000);
      return () => clearTimeout(timer);
    }
  }, [step]);

  function handleBarcodeScan({ data }: { data: string }) {
    if (!activelyScanning) return;
    setActivelyScanning(false);
    const customer = getCustomerByQrCode(data);
    if (customer) {
      setScannedCustomer(customer);
      setStep("confirm");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } else {
      Alert.alert("QR code invalide", "Aucun client Fideliio trouvé.", [
        { text: "Réessayer", onPress: () => setActivelyScanning(true) },
      ]);
    }
  }

  function handleWebLookup() {
    const customer = getCustomerByQrCode(webCode.trim());
    if (customer) {
      setScannedCustomer(customer);
      setStep("confirm");
    } else {
      Alert.alert("", "Aucun client trouvé pour ce code.");
    }
  }

  function handleKeypad(key: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === "⌫") {
      setRawAmount((prev) => {
        const next = prev.slice(0, -1);
        return next === "" || next === "0" ? "0" : next;
      });
    } else if (key === "00") {
      setRawAmount((prev) => {
        if (prev === "0") return "0";
        const next = prev + "00";
        return parseInt(next, 10) > 999999 ? prev : next;
      });
    } else {
      setRawAmount((prev) => {
        if (prev === "0") {
          return key === "0" ? "0" : key;
        }
        const next = prev + key;
        return parseInt(next, 10) > 999999 ? prev : next;
      });
    }
  }

  function handleQuickAmount(amount: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRawAmount(String(amount));
  }

  async function handleValidate() {
    if (!scannedCustomer || amountNum === 0) return;
    setLoading(true);
    try {
      if (merchant) {
        await addTransaction({
          customerId: scannedCustomer.id,
          merchantId: merchant.id,
          merchantName: merchant.businessName,
          customerName: `${scannedCustomer.firstName} ${scannedCustomer.lastName}`,
          amount: effectiveAmount,
          pointsEarned: points,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessData({
        points,
        name: `${scannedCustomer.firstName} ${scannedCustomer.lastName[0]}.`,
      });
      setStep("success");
    } catch {
      Alert.alert("Erreur", "La validation a échoué.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("scanning");
    setScannedCustomer(null);
    setRawAmount("0");
    setMultiplier(1);
    setSuccessData(null);
    setWebCode("");
    setActivelyScanning(true);
  }

  // ── Success ─────────────────────────────────────────────────────
  if (step === "success" && successData) {
    return (
      <View style={[styles.container, { backgroundColor: merchantAccentColor }]}>
        <StatusBar translucent backgroundColor="transparent" />
        <View style={styles.centeredWrap}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View style={styles.successCircle}>
              <Feather name="check" size={72} color={merchantAccentColor} />
            </View>
          </Animated.View>
          <Text style={[styles.successTitle, { fontFamily: "Inter_700Bold" }]}>
            ✓ {successData.points.toLocaleString("fr-FR")} points ajoutés à{"\n"}
            {successData.name} !
          </Text>
        </View>
      </View>
    );
  }

  // ── Amount input ─────────────────────────────────────────────────
  if (step === "amount" && scannedCustomer) {
    const isValid = amountNum > 0;

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar translucent backgroundColor="transparent" />

        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={() => setStep("confirm")} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            Montant de l'achat
          </Text>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 32 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.amountCustomerRow}>
            <View style={[styles.miniAvatar, { backgroundColor: merchantAccentColor + "20" }]}>
              <Text style={[styles.miniInitial, { color: merchantAccentColor, fontFamily: "Inter_700Bold" }]}>
                {scannedCustomer.firstName[0]}{scannedCustomer.lastName[0]}
              </Text>
            </View>
            <View>
              <Text style={[styles.miniName, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {scannedCustomer.firstName} {scannedCustomer.lastName}
              </Text>
              <Text style={[styles.miniPoints, { color: "#F9A602", fontFamily: "Inter_400Regular" }]}>
                {scannedCustomer.totalPoints} pts actuels
              </Text>
            </View>
          </View>

          <View style={[styles.amountBox, { borderColor: merchantAccentColor }]}>
            <Text style={[styles.amountValue, { color: merchantAccentColor, fontFamily: "Inter_700Bold" }]}>
              {formatAmount(rawAmount)} DH
            </Text>
          </View>

          <View style={styles.keypad}>
            {[["1","2","3"],["4","5","6"],["7","8","9"],["00","0","⌫"]].map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keypadBtn, { backgroundColor: colors.card }]}
                    onPress={() => handleKeypad(key)}
                    activeOpacity={0.7}
                  >
                    {key === "⌫" ? (
                      <Feather name="delete" size={22} color={colors.foreground} />
                    ) : (
                      <Text style={[styles.keypadLabel, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                        {key}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>

          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[
                  styles.quickPill,
                  {
                    borderColor: merchantAccentColor,
                    backgroundColor: amountNum === q ? merchantAccentColor : "transparent",
                  },
                ]}
                onPress={() => handleQuickAmount(q)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.quickLabel,
                    {
                      color: amountNum === q ? "#fff" : merchantAccentColor,
                      fontFamily: "Inter_600SemiBold",
                    },
                  ]}
                >
                  {q} DH
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.multSection}>
            <Text style={[styles.multLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              × Multiplicateur
            </Text>
            <View style={styles.multRow}>
              {MULTIPLIERS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.multPill,
                    {
                      borderColor: merchantAccentColor,
                      backgroundColor: multiplier === m ? merchantAccentColor : "transparent",
                    },
                  ]}
                  onPress={() => {
                    setMultiplier(m);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.multPillLabel,
                      {
                        color: multiplier === m ? "#fff" : merchantAccentColor,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    ×{m}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={[styles.summary, { backgroundColor: colors.card, borderRadius: colors.radius }]}>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Montant réel
              </Text>
              <Text style={[styles.summaryVal, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {effectiveAmount.toLocaleString("fr-FR")} DH
              </Text>
            </View>
            <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryKey, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Points à créditer
              </Text>
              <Text style={[styles.summaryVal, { color: "#F9A602", fontFamily: "Inter_700Bold" }]}>
                {points.toLocaleString("fr-FR")} pts ⭐
              </Text>
            </View>
          </View>

          <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
            <TouchableOpacity
              onPress={isValid ? handleValidate : undefined}
              activeOpacity={isValid ? 0.85 : 1}
              style={[
                styles.validateBtn,
                {
                  backgroundColor: isValid ? merchantAccentColor : colors.border,
                },
              ]}
            >
              {loading ? (
                <Text style={[styles.validateLabel, { fontFamily: "Inter_700Bold" }]}>
                  Chargement…
                </Text>
              ) : (
                <Text style={[styles.validateLabel, { fontFamily: "Inter_700Bold" }]}>
                  Valider — +{points.toLocaleString("fr-FR")} pts
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  }

  // ── Confirm (customer found) ─────────────────────────────────────
  if (step === "confirm" && scannedCustomer) {
    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <StatusBar translucent backgroundColor="transparent" />
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
          >
            Client identifié
          </Text>
        </View>
        <View style={styles.content}>
          <Card style={styles.customerCard}>
            <View
              style={[styles.custAvatar, { backgroundColor: merchantAccentColor + "20" }]}
            >
              <Text
                style={[styles.custInitial, { color: merchantAccentColor, fontFamily: "Inter_700Bold" }]}
              >
                {scannedCustomer.firstName[0]}
                {scannedCustomer.lastName[0]}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.custName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
              >
                {scannedCustomer.firstName} {scannedCustomer.lastName}
              </Text>
              <Text
                style={[styles.custPoints, { color: "#F9A602", fontFamily: "Inter_600SemiBold" }]}
              >
                {scannedCustomer.totalPoints} points actuels
              </Text>
            </View>
            <View style={[styles.checkBadge, { backgroundColor: merchantAccentColor + "18" }]}>
              <Feather name="check" size={16} color={merchantAccentColor} />
            </View>
          </Card>

          <View style={styles.btnRow}>
            <Button
              title="Annuler"
              onPress={handleReset}
              variant="outline"
              style={{ flex: 1 }}
            />
            <Button
              title="Continuer →"
              onPress={() => setStep("amount")}
              style={{ flex: 1, backgroundColor: merchantAccentColor, borderRadius: 99 }}
            />
          </View>
        </View>
      </ScrollView>
    );
  }

  // ── Scanner (default) ─────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar translucent backgroundColor="transparent" />

      {Platform.OS === "web" ? (
        <View style={[styles.webFallback, { backgroundColor: colors.background, paddingTop: topPad + 12 }]}>
          <View style={[styles.header, { paddingTop: 0 }]}>
            <Text
              style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
            >
              Scanner un client
            </Text>
          </View>
          <View style={styles.content}>
            <View style={styles.webIconWrap}>
              <Feather name="maximize-2" size={56} color={colors.mutedForeground} />
              <Text
                style={[styles.webHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              >
                Caméra non disponible sur web.{"\n"}Entrez le code QR du client :
              </Text>
            </View>
            <Card>
              <Input
                label="Code QR du client"
                placeholder="FID-CUST-XXXXXXXX"
                value={webCode}
                onChangeText={setWebCode}
                leftIcon="hash"
                autoCapitalize="characters"
              />
              <Button title="Rechercher le client" onPress={handleWebLookup} />
            </Card>
          </View>
        </View>
      ) : !permission ? (
        <View style={[styles.centeredWrap, { paddingTop: topPad + 20 }]}>
          <Text style={{ color: "white" }}>Chargement...</Text>
        </View>
      ) : !permission.granted ? (
        <View
          style={[
            styles.centeredWrap,
            { paddingTop: topPad + 20, backgroundColor: colors.background },
          ]}
        >
          <Feather name="camera-off" size={48} color={colors.mutedForeground} />
          <Text
            style={[styles.webHint, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
          >
            Accès à la caméra requis pour scanner les QR codes clients.
          </Text>
          <Button title="Autoriser la caméra" onPress={requestPermission} />
        </View>
      ) : (
        <View style={StyleSheet.absoluteFillObject}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
            onBarcodeScanned={activelyScanning ? handleBarcodeScan : undefined}
          />
          <View style={[styles.cameraTopBar, { paddingTop: topPad + 8 }]} pointerEvents="none">
            <Text
              style={[styles.cameraTitle, { fontFamily: "Inter_600SemiBold" }]}
            >
              Scanner un client
            </Text>
          </View>
          <View style={styles.scanOverlay} pointerEvents="none">
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTL]} />
              <View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} />
              <View style={[styles.corner, styles.cornerBR]} />
            </View>
            <Text style={[styles.scanHint, { fontFamily: "Inter_400Regular" }]}>
              Placez le QR code Fideliio du client dans le cadre
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const CORNER_SIZE = 28;
const CORNER_WIDTH = 3;
const FRAME_SIZE = 220;

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22 },
  content: { padding: 20, gap: 16 },
  centeredWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 20,
  },
  webFallback: { flex: 1 },
  webIconWrap: { alignItems: "center", gap: 12 },
  webHint: { fontSize: 14, textAlign: "center", lineHeight: 21 },
  customerCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  custAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
  },
  custInitial: { fontSize: 20 },
  custName: { fontSize: 16 },
  custPoints: { fontSize: 13, marginTop: 2 },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  // ── Amount screen ──────────────────────────────────────────────
  amountCustomerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  miniAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  miniInitial: { fontSize: 15 },
  miniName: { fontSize: 15 },
  miniPoints: { fontSize: 12, marginTop: 1 },
  amountBox: {
    marginHorizontal: 20,
    borderWidth: 2,
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  amountValue: {
    fontSize: 48,
    textAlign: "center",
    letterSpacing: -1,
  },
  keypad: {
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  keypadRow: {
    flexDirection: "row",
    gap: 8,
  },
  keypadBtn: {
    flex: 1,
    height: 62,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadLabel: {
    fontSize: 24,
  },
  quickRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 16,
  },
  quickPill: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickLabel: { fontSize: 13 },
  multSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  multLabel: { fontSize: 13, marginBottom: 2 },
  multRow: {
    flexDirection: "row",
    gap: 6,
    flexWrap: "wrap",
  },
  multPill: {
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignItems: "center",
    minWidth: 44,
  },
  multPillLabel: { fontSize: 13 },
  summary: {
    marginHorizontal: 20,
    padding: 16,
    gap: 0,
    marginBottom: 4,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  summaryDivider: { height: 1 },
  summaryKey: { fontSize: 14 },
  summaryVal: { fontSize: 16 },
  validateBtn: {
    borderRadius: 99,
    paddingVertical: 18,
    alignItems: "center",
  },
  validateLabel: {
    color: "#fff",
    fontSize: 17,
  },
  // ── Success ────────────────────────────────────────────────────
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  successTitle: {
    color: "#fff",
    fontSize: 22,
    textAlign: "center",
    lineHeight: 32,
  },
  // ── Camera ─────────────────────────────────────────────────────
  cameraTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  cameraTitle: { color: "white", fontSize: 18, textAlign: "center" },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
  },
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: "white",
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderTopLeftRadius: 6,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderTopRightRadius: 6,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderLeftWidth: CORNER_WIDTH,
    borderBottomLeftRadius: 6,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_WIDTH,
    borderRightWidth: CORNER_WIDTH,
    borderBottomRightRadius: 6,
  },
  scanHint: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 21,
  },
});
