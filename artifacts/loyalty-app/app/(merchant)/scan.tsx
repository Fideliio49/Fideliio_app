import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { StatusBar } from "expo-status-bar";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData, CustomerData } from "@/context/DataContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import * as Haptics from "expo-haptics";

type ScanStep = "scanning" | "confirm" | "success";

export default function MerchantScanScreen() {
  const colors = useColors();
  const { user } = useApp();
  const { getMerchantByUserId, getCustomerByQrCode, addTransaction } = useData();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<ScanStep>("scanning");
  const [scannedCustomer, setScannedCustomer] = useState<CustomerData | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [successData, setSuccessData] = useState<{ points: number; name: string } | null>(null);
  const [webCode, setWebCode] = useState("");
  const [activelyScanning, setActivelyScanning] = useState(true);

  const merchant = user ? getMerchantByUserId(user.id) : null;
  const topPad = Platform.OS === "web" ? 67 : insets.top;

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

  async function handleValidate() {
    if (!scannedCustomer || !amount || isNaN(parseFloat(amount))) return;
    setLoading(true);
    try {
      const amountNum = parseFloat(amount);
      const rate = merchant?.pointsRate ?? 1;
      const points = Math.floor(amountNum * rate);
      if (merchant) {
        await addTransaction({
          customerId: scannedCustomer.id,
          merchantId: merchant.id,
          merchantName: merchant.businessName,
          customerName: `${scannedCustomer.firstName} ${scannedCustomer.lastName}`,
          amount: amountNum,
          pointsEarned: points,
        });
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSuccessData({
        points,
        name: `${scannedCustomer.firstName} ${scannedCustomer.lastName[0]}.`,
      });
      setStep("success");
      setScannedCustomer(null);
      setAmount("");
    } catch {
      Alert.alert("Erreur", "La validation a échoué.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setStep("scanning");
    setScannedCustomer(null);
    setAmount("");
    setSuccessData(null);
    setWebCode("");
    setActivelyScanning(true);
  }

  // ── Success ─────────────────────────────────────────────────────
  if (step === "success" && successData) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar style="dark" />
        <View style={[styles.centeredWrap, { paddingTop: topPad + 20 }]}>
          <View style={[styles.successIcon, { backgroundColor: colors.green100 }]}>
            <Feather name="check-circle" size={60} color={colors.secondary} />
          </View>
          <Text
            style={[styles.successTitle, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
          >
            Validation réussie !
          </Text>
          <Text
            style={[styles.successMsg, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
          >
            ✓ {successData.points} points ajoutés à {successData.name}
          </Text>
          <Button
            title="Nouveau scan"
            onPress={handleReset}
            variant="secondary"
            size="lg"
            style={{ marginTop: 32, minWidth: 200 }}
          />
        </View>
      </View>
    );
  }

  // ── Confirm (customer found) ─────────────────────────────────────
  if (step === "confirm" && scannedCustomer) {
    const preview =
      amount && !isNaN(parseFloat(amount)) && merchant
        ? Math.floor(parseFloat(amount) * merchant.pointsRate)
        : null;

    return (
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        <StatusBar style="dark" />
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
          <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
          >
            Valider l'achat
          </Text>
        </View>
        <View style={styles.content}>
          <Card style={styles.customerCard}>
            <View
              style={[styles.custAvatar, { backgroundColor: colors.secondary + "20" }]}
            >
              <Text
                style={[styles.custInitial, { color: colors.secondary, fontFamily: "Inter_700Bold" }]}
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
            <View style={[styles.checkBadge, { backgroundColor: colors.green100 }]}>
              <Feather name="check" size={16} color={colors.secondary} />
            </View>
          </Card>

          <Card>
            <Input
              label="Montant de l'achat (DH)"
              placeholder="0.00"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              leftIcon="tag"
            />
            {preview !== null && (
              <View
                style={[
                  styles.preview,
                  { backgroundColor: colors.green100, borderRadius: colors.radius },
                ]}
              >
                <Feather name="zap" size={16} color={colors.secondary} />
                <Text
                  style={[styles.previewText, { color: colors.green600, fontFamily: "Inter_600SemiBold" }]}
                >
                  +{preview} points à créditer
                </Text>
              </View>
            )}
            <View style={styles.btnRow}>
              <Button
                title="Annuler"
                onPress={handleReset}
                variant="outline"
                style={{ flex: 1 }}
              />
              <Button
                title="Valider"
                onPress={handleValidate}
                loading={loading}
                variant="secondary"
                style={{ flex: 1 }}
              />
            </View>
          </Card>
        </View>
      </ScrollView>
    );
  }

  // ── Scanner (default) ─────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar style="light" />

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
  preview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    marginBottom: 8,
  },
  previewText: { fontSize: 15 },
  btnRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  successTitle: { fontSize: 24, textAlign: "center" },
  successMsg: { fontSize: 16, textAlign: "center", lineHeight: 24 },
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
