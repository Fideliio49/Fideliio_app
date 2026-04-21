import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  Platform,
  TouchableOpacity,
  StatusBar,
  Animated,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";
import * as Haptics from "expo-haptics";
import { supabase } from "@/lib/supabase";
import { useTranslation } from "react-i18next";

type ScanStep = "scanning" | "quickPoints" | "amount" | "success";

const QUICK_AMOUNTS = [5, 10, 20, 50, 100, 200];
const MULTIPLIERS = [1, 2, 5, 10, 20, 50];

function formatAmount(raw: string): string {
  if (!raw || raw === "0") return "0";
  const n = parseInt(raw, 10);
  if (isNaN(n)) return "0";
  return n.toLocaleString("fr-FR");
}

async function sendPointsNotification(
  customerId: string,
  merchantName: string,
  points: number,
) {
  try {
    const { data: customer } = await supabase
      .from("customers")
      .select("push_token")
      .eq("id", customerId)
      .maybeSingle();
    if (!customer?.push_token) return;
    if (!customer.push_token.startsWith("ExponentPushToken")) return;
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: customer.push_token,
        title: `+${points} points 🎉`,
        body: `Vous venez de gagner ${points} points chez ${merchantName} !`,
        sound: "default",
        priority: "high",
      }),
    });
  } catch {}
}

export default function MerchantScanScreen() {
  const colors = useColors();
  const { user, colorTheme, merchantAccentColor, isRTL } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();

  const [step, setStep] = useState<ScanStep>("scanning");
  const [scannedCustomer, setScannedCustomer] = useState<any>(null);
  const [customerPoints, setCustomerPoints] = useState(0);
  const [merchant, setMerchant] = useState<any>(null);
  const [rawAmount, setRawAmount] = useState("0");
  const [multiplier, setMultiplier] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadingPreset, setLoadingPreset] = useState<number | null>(null);
  const [successData, setSuccessData] = useState<{
    points: number;
    name: string;
  } | null>(null);
  const [webCode, setWebCode] = useState("");
  const [activelyScanning, setActivelyScanning] = useState(true);
  const [quickPoints, setQuickPoints] = useState<number[]>([
    10, 25, 50, 100, 200, 500,
  ]);

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isDark = colorTheme === "dark";
  const rowDir = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";

  const amountNum = parseInt(rawAmount, 10) || 0;
  const effectiveAmount = amountNum * multiplier;
  const pointsRate = merchant?.points_rate ?? 1;
  const points = Math.floor(effectiveAmount / pointsRate);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") StatusBar.setBackgroundColor("#000", true);
      loadMerchant();
    }, [user]),
  );

  useEffect(() => {
    loadMerchant();
  }, [user?.id]);

  async function loadMerchant() {
    if (!user?.id) return;
    const { data } = await supabase
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    if (data) {
      setMerchant(data);
      if (data.quick_points) {
        const pts = data.quick_points
          .split(",")
          .map(Number)
          .filter((n: number) => !isNaN(n) && n > 0);
        if (pts.length > 0) setQuickPoints(pts);
      }
    }
  }

  useEffect(() => {
    if (step === "scanning") {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android") StatusBar.setBackgroundColor("#000", true);
    } else if (step === "success") {
      StatusBar.setBarStyle("light-content", true);
      if (Platform.OS === "android")
        StatusBar.setBackgroundColor(merchantAccentColor, true);
    } else {
      StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
      if (Platform.OS === "android")
        StatusBar.setBackgroundColor(isDark ? "#121212" : "#F9FAFB", true);
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
      const timer = setTimeout(handleReset, 800);
      return () => clearTimeout(timer);
    }
  }, [step]);

  async function handleBarcodeScan({ data }: { data: string }) {
    if (!activelyScanning) return;
    setActivelyScanning(false);
    try {
      const { data: customerData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("qr_code", data.trim())
        .maybeSingle();
      if (error || !customerData) {
        Alert.alert("QR code invalide", "Aucun client Fideliio trouvé.", [
          { text: "Réessayer", onPress: () => setActivelyScanning(true) },
        ]);
        return;
      }
      const { data: pointsData } = await supabase
        .from("customer_merchant_points")
        .select("total_points")
        .eq("customer_id", customerData.id)
        .eq("merchant_id", merchant?.id)
        .maybeSingle();
      setCustomerPoints(Math.max(0, pointsData?.total_points ?? 0));
      setScannedCustomer(customerData);
      setStep("quickPoints");
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      Alert.alert("Erreur", "Impossible de vérifier ce QR code.", [
        { text: "Réessayer", onPress: () => setActivelyScanning(true) },
      ]);
    }
  }

  async function handleWebLookup() {
    const code = webCode.trim();
    if (!code) return;
    const { data: customerData } = await supabase
      .from("customers")
      .select("*")
      .eq("qr_code", code)
      .maybeSingle();
    if (!customerData) {
      Alert.alert("", "Aucun client trouvé pour ce code.");
      return;
    }
    const { data: pointsData } = await supabase
      .from("customer_merchant_points")
      .select("total_points")
      .eq("customer_id", customerData.id)
      .eq("merchant_id", merchant?.id)
      .maybeSingle();
    setCustomerPoints(Math.max(0, pointsData?.total_points ?? 0));
    setScannedCustomer(customerData);
    setStep("quickPoints");
  }

  async function handleQuickPointsValidate(presetPoints: number) {
    if (!scannedCustomer || !merchant) return;
    setLoadingPreset(presetPoints);
    try {
      const { nanoid } = await import("nanoid/non-secure");
      const { error } = await supabase.from("transactions").insert({
        id: nanoid(),
        customer_id: scannedCustomer.id,
        merchant_id: merchant.id,
        merchant_name: merchant.business_name,
        customer_name: `${scannedCustomer.first_name} ${scannedCustomer.last_name}`,
        amount: 0,
        multiplier: 1,
        points_earned: presetPoints,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sendPointsNotification(
        scannedCustomer.id,
        merchant.business_name,
        presetPoints,
      );
      setSuccessData({
        points: presetPoints,
        name: `${scannedCustomer.first_name} ${scannedCustomer.last_name[0]}.`,
      });
      setStep("success");
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "La validation a échoué.");
    } finally {
      setLoadingPreset(null);
    }
  }

  async function handleValidate() {
    if (!scannedCustomer || !merchant || amountNum === 0) return;
    setLoading(true);
    try {
      const { nanoid } = await import("nanoid/non-secure");
      const { error } = await supabase.from("transactions").insert({
        id: nanoid(),
        customer_id: scannedCustomer.id,
        merchant_id: merchant.id,
        merchant_name: merchant.business_name,
        customer_name: `${scannedCustomer.first_name} ${scannedCustomer.last_name}`,
        amount: effectiveAmount,
        multiplier,
        points_earned: points,
        created_at: new Date().toISOString(),
      });
      if (error) throw error;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      sendPointsNotification(
        scannedCustomer.id,
        merchant.business_name,
        points,
      );
      setSuccessData({
        points,
        name: `${scannedCustomer.first_name} ${scannedCustomer.last_name[0]}.`,
      });
      setStep("success");
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "La validation a échoué.");
    } finally {
      setLoading(false);
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
        if (prev === "0") return key === "0" ? "0" : key;
        const next = prev + key;
        return parseInt(next, 10) > 999999 ? prev : next;
      });
    }
  }

  function handleReset() {
    setStep("scanning");
    setScannedCustomer(null);
    setCustomerPoints(0);
    setRawAmount("0");
    setMultiplier(1);
    setSuccessData(null);
    setWebCode("");
    setActivelyScanning(true);
    setLoadingPreset(null);
  }

  // ── SUCCESS ──────────────────────────────────────────────────
  if (step === "success" && successData) {
    return (
      <View
        style={[styles.container, { backgroundColor: merchantAccentColor }]}
      >
        <StatusBar translucent backgroundColor="transparent" />
        <View style={styles.centeredWrap}>
          <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View style={styles.successCircle}>
              <Feather name="check" size={72} color={merchantAccentColor} />
            </View>
          </Animated.View>
          <Text style={[styles.successTitle, { fontFamily: "Inter_700Bold" }]}>
            ✓ {successData.points.toLocaleString("fr-FR")} pts ajoutés à{"\n"}
            {successData.name} !
          </Text>
        </View>
      </View>
    );
  }

  // ── QUICK POINTS ─────────────────────────────────────────────
  if (step === "quickPoints" && scannedCustomer) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar translucent backgroundColor="transparent" />
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 12, flexDirection: rowDir },
          ]}
        >
          <TouchableOpacity onPress={handleReset} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {isRTL ? "تأكيد النقاط" : "Créditer des points"}
          </Text>
        </View>
        <View
          style={[
            styles.customerBanner,
            {
              backgroundColor: colors.card,
              borderBottomColor: colors.border,
              flexDirection: rowDir,
            },
          ]}
        >
          <View
            style={[
              styles.custAvatar,
              { backgroundColor: merchantAccentColor + "20" },
            ]}
          >
            <Text
              style={[
                styles.custInitial,
                { color: merchantAccentColor, fontFamily: "Inter_700Bold" },
              ]}
            >
              {scannedCustomer.first_name?.[0]}
              {scannedCustomer.last_name?.[0]}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text
              style={[
                styles.custName,
                {
                  color: colors.foreground,
                  fontFamily: "Inter_700Bold",
                  textAlign,
                },
              ]}
            >
              {scannedCustomer.first_name} {scannedCustomer.last_name}
            </Text>
            <Text
              style={[
                styles.custPoints,
                {
                  color: "#F9A602",
                  fontFamily: "Inter_600SemiBold",
                  textAlign,
                },
              ]}
            >
              {customerPoints} {isRTL ? "نقطة عندك" : "pts chez vous"}
            </Text>
          </View>
          <View
            style={[
              styles.checkBadge,
              { backgroundColor: merchantAccentColor + "18" },
            ]}
          >
            <Feather name="check" size={16} color={merchantAccentColor} />
          </View>
        </View>
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <Text
            style={[
              styles.sectionLabel,
              {
                color: colors.mutedForeground,
                fontFamily: "Inter_500Medium",
                textAlign,
              },
            ]}
          >
            {isRTL ? "نقاط سريعة" : "Points rapides"}
          </Text>
          <View style={styles.presetsGrid}>
            {quickPoints.map((pts) => (
              <TouchableOpacity
                key={pts}
                onPress={() => handleQuickPointsValidate(pts)}
                activeOpacity={0.75}
                disabled={loadingPreset !== null}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor:
                      loadingPreset === pts ? merchantAccentColor : colors.card,
                    borderColor: merchantAccentColor,
                    borderRadius: colors.radius,
                  },
                ]}
              >
                {loadingPreset === pts ? (
                  <Text
                    style={[
                      styles.presetLoading,
                      { fontFamily: "Inter_600SemiBold" },
                    ]}
                  >
                    ...
                  </Text>
                ) : (
                  <>
                    <Text
                      style={[
                        styles.presetPts,
                        {
                          color:
                            loadingPreset === null
                              ? merchantAccentColor
                              : colors.mutedForeground,
                          fontFamily: "Inter_700Bold",
                        },
                      ]}
                    >
                      +{pts}
                    </Text>
                    <Text
                      style={[
                        styles.presetPtsLabel,
                        {
                          color:
                            loadingPreset === null
                              ? merchantAccentColor
                              : colors.mutedForeground,
                          fontFamily: "Inter_400Regular",
                        },
                      ]}
                    >
                      pts
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.dividerRow}>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
            <Text
              style={[
                styles.dividerText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {isRTL ? "أو حسب المبلغ" : "ou par montant DH"}
            </Text>
            <View
              style={[styles.dividerLine, { backgroundColor: colors.border }]}
            />
          </View>
          <TouchableOpacity
            onPress={() => setStep("amount")}
            style={[
              styles.amountBtn,
              { borderColor: merchantAccentColor, borderRadius: colors.radius },
            ]}
          >
            <Feather name="dollar-sign" size={18} color={merchantAccentColor} />
            <Text
              style={[
                styles.amountBtnText,
                { color: merchantAccentColor, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              {isRTL ? "إدخال مبلغ الشراء" : "Saisir montant d'achat"}
            </Text>
            <Feather
              name={isRTL ? "chevron-left" : "chevron-right"}
              size={16}
              color={merchantAccentColor}
            />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleReset} style={styles.cancelBtn}>
            <Text
              style={[
                styles.cancelText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {t("common.cancel")}
            </Text>
          </TouchableOpacity>
        </KeyboardAwareScrollView>
      </View>
    );
  }

  // ── AMOUNT ───────────────────────────────────────────────────
  if (step === "amount" && scannedCustomer) {
    const isValid = amountNum > 0;
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <StatusBar translucent backgroundColor="transparent" />
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 12, flexDirection: rowDir },
          ]}
        >
          <TouchableOpacity
            onPress={() => setStep("quickPoints")}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {t("scan.enterAmount")}
          </Text>
        </View>

        {/* ✅ Scroll sans bouton */}
        <KeyboardAwareScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.amountCustomerRow, { flexDirection: rowDir }]}>
            <View
              style={[
                styles.miniAvatar,
                { backgroundColor: merchantAccentColor + "20" },
              ]}
            >
              <Text
                style={[
                  styles.miniInitial,
                  { color: merchantAccentColor, fontFamily: "Inter_700Bold" },
                ]}
              >
                {scannedCustomer.first_name?.[0]}
                {scannedCustomer.last_name?.[0]}
              </Text>
            </View>
            <View>
              <Text
                style={[
                  styles.miniName,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {scannedCustomer.first_name} {scannedCustomer.last_name}
              </Text>
              <Text
                style={[
                  styles.miniPoints,
                  { color: "#F9A602", fontFamily: "Inter_400Regular" },
                ]}
              >
                {customerPoints} pts chez votre commerce
              </Text>
            </View>
          </View>
          <View
            style={[styles.amountBox, { borderColor: merchantAccentColor }]}
          >
            <Text
              style={[
                styles.amountValue,
                { color: merchantAccentColor, fontFamily: "Inter_700Bold" },
              ]}
            >
              {formatAmount(rawAmount)} DH
            </Text>
          </View>
          <View style={styles.keypad}>
            {[
              ["1", "2", "3"],
              ["4", "5", "6"],
              ["7", "8", "9"],
              ["00", "0", "⌫"],
            ].map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[styles.keypadBtn, { backgroundColor: colors.card }]}
                    onPress={() => handleKeypad(key)}
                    activeOpacity={0.7}
                  >
                    {key === "⌫" ? (
                      <Feather
                        name="delete"
                        size={22}
                        color={colors.foreground}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.keypadLabel,
                          {
                            color: colors.foreground,
                            fontFamily: "Inter_600SemiBold",
                          },
                        ]}
                      >
                        {key}
                      </Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            ))}
          </View>
          <View style={[styles.quickRow, { flexDirection: rowDir }]}>
            {QUICK_AMOUNTS.map((q) => (
              <TouchableOpacity
                key={q}
                style={[
                  styles.quickPill,
                  {
                    borderColor: merchantAccentColor,
                    backgroundColor:
                      amountNum === q ? merchantAccentColor : "transparent",
                  },
                ]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setRawAmount(String(q));
                }}
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
            <Text
              style={[
                styles.multLabel,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              × Multiplicateur
            </Text>
            <View style={[styles.multRow, { flexDirection: rowDir }]}>
              {MULTIPLIERS.map((m) => (
                <TouchableOpacity
                  key={m}
                  style={[
                    styles.multPill,
                    {
                      borderColor: merchantAccentColor,
                      backgroundColor:
                        multiplier === m ? merchantAccentColor : "transparent",
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
          <View
            style={[
              styles.summary,
              { backgroundColor: colors.card, borderRadius: colors.radius },
            ]}
          >
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: colors.border },
              ]}
            />
            <View style={[styles.summaryRow, { flexDirection: rowDir }]}>
              <Text
                style={[
                  styles.summaryKey,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {isRTL ? "النقاط المضافة" : "Points à créditer"}
              </Text>
              <Text
                style={[
                  styles.summaryVal,
                  { color: "#F9A602", fontFamily: "Inter_700Bold" },
                ]}
              >
                {points.toLocaleString("fr-FR")} pts ⭐
              </Text>
            </View>
          </View>
        </KeyboardAwareScrollView>

        {/* ✅ Bouton FIXE en bas — jamais caché */}
        <View
          style={[
            styles.fixedBottom,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 70,
            },
          ]}
        >
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
            <Text
              style={[styles.validateLabel, { fontFamily: "Inter_700Bold" }]}
            >
              {loading
                ? t("common.loading")
                : `${t("scan.validate")} — +${points.toLocaleString("fr-FR")} pts`}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── SCANNER ──────────────────────────────────────────────────
  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <StatusBar translucent backgroundColor="transparent" />
      {Platform.OS === "web" ? (
        <View
          style={[
            styles.webFallback,
            { backgroundColor: colors.background, paddingTop: topPad + 12 },
          ]}
        >
          <View style={[styles.header, { paddingTop: 0 }]}>
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {t("scan.title")}
            </Text>
          </View>
          <View style={styles.content}>
            <View style={styles.webIconWrap}>
              <Feather
                name="maximize-2"
                size={56}
                color={colors.mutedForeground}
              />
              <Text
                style={[
                  styles.webHint,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Caméra non disponible sur web.{"\n"}Entrez le code QR du client
                :
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
          <Text style={{ color: "white" }}>{t("common.loading")}</Text>
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
            style={[
              styles.webHint,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
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
          <View
            style={[styles.cameraTopBar, { paddingTop: topPad + 8 }]}
            pointerEvents="none"
          >
            <Text
              style={[styles.cameraTitle, { fontFamily: "Inter_600SemiBold" }]}
            >
              {t("scan.title")}
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
    alignItems: "center",
    gap: 12,
  },
  backBtn: { padding: 4 },
  title: { fontSize: 22, flex: 1 },
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
  customerBanner: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: "center",
    gap: 14,
    borderBottomWidth: 1,
  },
  custAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  custInitial: { fontSize: 18 },
  custName: { fontSize: 16 },
  custPoints: { fontSize: 13, marginTop: 2 },
  checkBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionLabel: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  presetsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 8,
  },
  presetCard: {
    width: "30%",
    aspectRatio: 1.4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  presetPts: { fontSize: 26 },
  presetPtsLabel: { fontSize: 12 },
  presetLoading: { color: "#fff", fontSize: 18 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 20,
    marginVertical: 16,
    gap: 10,
  },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 13 },
  amountBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1.5,
  },
  amountBtnText: { fontSize: 15, flex: 1, textAlign: "center" },
  cancelBtn: { alignItems: "center", paddingVertical: 16 },
  cancelText: { fontSize: 14 },
  amountCustomerRow: {
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
    marginBottom: 16,
  },
  amountValue: { fontSize: 48, textAlign: "center", letterSpacing: -1 },
  keypad: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  keypadRow: { flexDirection: "row", gap: 8 },
  keypadBtn: {
    flex: 1,
    height: 62,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  keypadLabel: { fontSize: 24 },
  quickRow: { paddingHorizontal: 20, gap: 8, marginBottom: 16 },
  quickPill: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: 8,
    alignItems: "center",
  },
  quickLabel: { fontSize: 13 },
  multSection: { paddingHorizontal: 20, marginBottom: 16, gap: 8 },
  multLabel: { fontSize: 13 },
  multRow: { gap: 6, flexWrap: "wrap" },
  multPill: {
    borderWidth: 1.5,
    borderRadius: 99,
    paddingVertical: 6,
    paddingHorizontal: 12,
    minWidth: 44,
    alignItems: "center",
  },
  multPillLabel: { fontSize: 13 },
  summary: { marginHorizontal: 20, padding: 16, marginBottom: 4 },
  summaryRow: {
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
  },
  summaryDivider: { height: 1 },
  summaryKey: { fontSize: 14 },
  summaryVal: { fontSize: 16 },
  // ✅ Bouton fixe en bas
  fixedBottom: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1 },
  validateBtn: { borderRadius: 99, paddingVertical: 18, alignItems: "center" },
  validateLabel: { color: "#fff", fontSize: 17 },
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
  scanFrame: { width: FRAME_SIZE, height: FRAME_SIZE, position: "relative" },
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
