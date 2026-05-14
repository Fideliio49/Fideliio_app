import React, { useCallback, useRef, useState } from "react";
import { fs, iconSize } from "@/utils/responsive";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Share,
  Platform,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import ViewShot from "react-native-view-shot";
import * as MediaLibrary from "expo-media-library";

type MerchantProgress = {
  merchant_id: string;
  business_name: string;
  current_points: number;
  max_points: number;
  progress: number;
};

export default function CustomerQrCodeScreen() {
  const colors = useColors();
  const { user, colorTheme, language, accentColor } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [customer, setCustomer] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [merchantProgress, setMerchantProgress] = useState<MerchantProgress[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ✅ Ref pour capturer la carte QR en image
  const qrCardRef = useRef<any>(null);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;
  const isDark = colorTheme === "dark";

  const labelTitle =
    language === "ar"
      ? "رمز QR الخاص بي"
      : language === "en"
        ? "My QR Code"
        : "Mon QR Code";
  const labelSubtitle =
    language === "ar"
      ? "قدّم هذا الرمز عند كل عملية شراء"
      : language === "en"
        ? "Present this code at each purchase"
        : "Présentez ce code lors de chaque achat";
  const labelHint =
    language === "ar"
      ? "سيقوم التاجر بمسح رمز QR هذا للتحقق من شرائك وإضافة النقاط."
      : language === "en"
        ? "The merchant will scan this QR code to validate your purchase and credit your points."
        : "Le marchand scannera ce QR code pour valider votre achat et créditer vos points.";
  const labelShare =
    language === "ar"
      ? "مشاركة رمز QR"
      : language === "en"
        ? "Share my QR Code"
        : "Partager mon QR Code";
  const labelSave =
    language === "ar"
      ? "حفظ في المعرض"
      : language === "en"
        ? "Save to gallery"
        : "Enregistrer dans la galerie";
  const labelUnavailable =
    language === "ar"
      ? "رمز QR غير متوفر"
      : language === "en"
        ? "QR Code unavailable"
        : "QR Code non disponible";
  const labelReconnect =
    language === "ar"
      ? "يرجى إعادة الاتصال لإنشاء رمز QR."
      : language === "en"
        ? "Please reconnect to generate your QR code."
        : "Veuillez vous reconnecter pour générer votre QR code.";
  const labelMyProgress =
    language === "ar"
      ? "تقدمي لدى التجار"
      : language === "en"
        ? "My progress"
        : "Ma progression";
  const labelRemaining =
    language === "ar" ? "متبقي" : language === "en" ? "remaining" : "restants";
  const labelMax =
    language === "ar"
      ? "وصلت للحد الأقصى!"
      : language === "en"
        ? "Max reached!"
        : "Plafond atteint !";

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
      if (Platform.OS === "android")
        StatusBar.setBackgroundColor(isDark ? "#121212" : "#F9FAFB", true);
      loadCustomer();
    }, [isDark, user]),
  );

  async function loadCustomer() {
    if (!user?.id) return;
    try {
      setLoading(true);
      const { data: customerData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .single();
      if (error) return;
      setCustomer(customerData);

      const { data: pointsData } = await supabase
        .from("customer_total_points")
        .select("total_points")
        .eq("customer_id", customerData.id)
        .single();
      setTotalPoints(Math.max(0, pointsData?.total_points ?? 0));

      const { data: merchantPoints } = await supabase
        .from("customer_merchant_points")
        .select("merchant_id, total_points, business_name")
        .eq("customer_id", customerData.id);

      if (merchantPoints && merchantPoints.length > 0) {
        const merchantIds = merchantPoints.map((m: any) => m.merchant_id);
        const { data: rewards } = await supabase
          .from("rewards")
          .select("merchant_id, points_required")
          .in("merchant_id", merchantIds)
          .eq("is_active", true);

        const rewardMap = new Map<string, number>();
        (rewards ?? []).forEach((r: any) => {
          const existing = rewardMap.get(r.merchant_id);
          if (existing === undefined || r.points_required < existing) {
            rewardMap.set(r.merchant_id, r.points_required);
          }
        });

        const progress: MerchantProgress[] = merchantPoints.map((m: any) => {
          const maxPts = rewardMap.get(m.merchant_id) ?? 100;
          const current = Math.max(0, m.total_points ?? 0);
          return {
            merchant_id: m.merchant_id,
            business_name: m.business_name ?? "",
            current_points: current,
            max_points: maxPts,
            progress: Math.min(1, current / maxPts),
          };
        });

        progress.sort((a, b) => b.progress - a.progress);
        setMerchantProgress(progress);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }

  const qrCodeValue = customer?.qr_code ?? null;

  // ✅ Capturer la carte QR en URI
  async function captureQrCard(): Promise<string | null> {
    try {
      if (!qrCardRef.current) return null;
      const uri = await qrCardRef.current.capture();
      return uri as string;
    } catch {
      return null;
    }
  }

  // ✅ Sauvegarder dans la galerie photo
  async function handleSaveToGallery() {
    setSaving(true);
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          language === "en" ? "Permission required" : "Permission requise",
          language === "en"
            ? "Gallery access is needed to save the QR code."
            : "L'accès à la galerie est nécessaire pour enregistrer le QR code.",
        );
        return;
      }
      const uri = await captureQrCard();
      if (!uri) throw new Error("Capture échouée");
      await MediaLibrary.saveToLibraryAsync(uri);
      Alert.alert(
        "✓",
        language === "ar"
          ? "تم الحفظ في المعرض!"
          : language === "en"
            ? "Saved to gallery!"
            : "Enregistré dans la galerie !",
      );
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Sauvegarde échouée.");
    } finally {
      setSaving(false);
    }
  }

  // ✅ Partager le QR code — image sur iOS, texte sur Android
  async function handleShare() {
    if (!qrCodeValue) return;
    try {
      if (Platform.OS === "ios") {
        const uri = await captureQrCard();
        if (uri) {
          await Share.share({ url: uri });
          return;
        }
      }
      // Fallback texte (Android ou si capture échoue)
      await Share.share({
        message: `${language === "ar" ? "رمز Fideliio الخاص بي:" : language === "en" ? "My Fideliio code:" : "Mon code Fideliio :"} ${qrCodeValue}`,
      });
    } catch {}
  }

  if (loading) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
          },
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!qrCodeValue) {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: colors.background,
            justifyContent: "center",
            alignItems: "center",
            padding: 24,
          },
        ]}
      >
        <Feather
          name="alert-circle"
          size={iconSize(48)}
          color={colors.mutedForeground}
        />
        <Text
          style={[
            styles.title,
            { color: colors.foreground, textAlign: "center", marginTop: 16 },
          ]}
        >
          {labelUnavailable}
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          {labelReconnect}
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.scroll,
        { paddingTop: topPad + 12, paddingBottom: 100 + bottomPad },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <Text
        style={[
          styles.title,
          { color: colors.foreground, fontFamily: "Inter_700Bold" },
        ]}
      >
        {labelTitle}
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        {labelSubtitle}
      </Text>

      {/* ✅ ViewShot enveloppe la carte QR pour la capture image */}
      <ViewShot
        ref={qrCardRef}
        options={{ format: "png", quality: 1 }}
        style={styles.viewShot}
      >
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, shadowColor: "#000" },
          ]}
        >
          <View style={styles.qrWrap}>
            <QRCode
              value={qrCodeValue}
              size={220}
              color="#1a1a2e"
              backgroundColor="white"
            />
          </View>
          <Text
            style={[
              styles.userName,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {customer?.first_name} {customer?.last_name}
          </Text>
          <View style={styles.pointsPill}>
            <Feather name="star" size={iconSize(14)} color="#F9A602" />
            <Text
              style={[
                styles.pointsText,
                { color: "#F9A602", fontFamily: "Inter_700Bold" },
              ]}
            >
              {totalPoints} {t("common.points").toLowerCase()}
            </Text>
          </View>
          <Text
            style={[
              styles.codeText,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {qrCodeValue}
          </Text>
        </View>
      </ViewShot>

      {/* ✅ Progression par commerçant */}
      {merchantProgress.length > 0 && (
        <View
          style={[
            styles.progressSection,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text
            style={[
              styles.progressTitle,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {labelMyProgress}
          </Text>
          {merchantProgress.map((mp) => {
            const isAtMax = mp.progress >= 100;
            const remaining = Math.max(0, mp.max_points - mp.current_points);
            return (
              <View key={mp.merchant_id} style={styles.progressItem}>
                <View style={styles.progressItemHeader}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                    }}
                  >
                    <View
                      style={[
                        styles.merchantDot,
                        {
                          backgroundColor: isAtMax
                            ? accentColor
                            : colors.primary,
                        },
                      ]}
                    />
                    <Text
                      style={[
                        styles.merchantName,
                        {
                          color: colors.foreground,
                          fontFamily: "Inter_600SemiBold",
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {mp.business_name}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.progressPts,
                      {
                        color: isAtMax ? accentColor : colors.mutedForeground,
                        fontFamily: "Inter_600SemiBold",
                      },
                    ]}
                  >
                    {mp.current_points}/{mp.max_points}
                  </Text>
                </View>
                <View
                  style={[styles.barTrack, { backgroundColor: colors.border }]}
                >
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${mp.progress}%` as any,
                        backgroundColor: isAtMax ? accentColor : colors.primary,
                      },
                    ]}
                  />
                </View>
                <Text
                  style={[
                    styles.progressHint,
                    {
                      color: isAtMax ? accentColor : colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {isAtMax
                    ? `🎁 ${labelMax}`
                    : `${remaining} pts ${labelRemaining}`}
                </Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Hint */}
      <View
        style={[
          styles.hintBox,
          {
            backgroundColor: colors.primary + "12",
            borderColor: colors.primary + "30",
          },
        ]}
      >
        <Feather name="info" size={iconSize(16)} color={colors.primary} />
        <Text
          style={[
            styles.hintText,
            { color: colors.primary, fontFamily: "Inter_400Regular" },
          ]}
        >
          {labelHint}
        </Text>
      </View>

      {/* ✅ Boutons : Enregistrer + Partager */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          onPress={handleSaveToGallery}
          disabled={saving}
          activeOpacity={0.8}
          style={[
            styles.actionBtn,
            {
              backgroundColor: accentColor + "12",
              borderColor: accentColor + "40",
              borderRadius: colors.radius,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator size="small" color={accentColor} />
          ) : (
            <Feather name="download" size={iconSize(18)} color={accentColor} />
          )}
          <Text
            style={[
              styles.actionBtnText,
              { color: accentColor, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {labelSave}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleShare}
          activeOpacity={0.8}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.primary + "12",
              borderColor: colors.primary + "40",
              borderRadius: colors.radius,
            },
          ]}
        >
          <Feather name="share-2" size={iconSize(18)} color={colors.primary} />
          <Text
            style={[
              styles.actionBtnText,
              { color: colors.primary, fontFamily: "Inter_600SemiBold" },
            ]}
          >
            {labelShare}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: fs(24), marginBottom: 6, alignSelf: "flex-start" },
  subtitle: { fontSize: fs(14), marginBottom: 28, alignSelf: "flex-start" },
  viewShot: { width: "100%", marginBottom: 20 },
  card: {
    width: "100%",
    borderRadius: 24,
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    gap: 12,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 4,
  },
  userName: { fontSize: fs(20) },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#FFF8E1",
    borderRadius: 99,
  },
  pointsText: { fontSize: fs(15) },
  codeText: { fontSize: fs(12), letterSpacing: 1.5, marginTop: 4 },
  progressSection: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 12,
  },
  progressTitle: { fontSize: fs(15), marginBottom: 4 },
  progressItem: { gap: 4 },
  progressItemHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  merchantDot: { width: 8, height: 8, borderRadius: 4 },
  merchantName: { fontSize: fs(14), flex: 1 },
  progressPts: { fontSize: fs(13) },
  barTrack: { height: 6, borderRadius: 99, overflow: "hidden" },
  barFill: { height: 6, borderRadius: 99 },
  progressHint: { fontSize: fs(11) },
  hintBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    width: "100%",
    marginBottom: 16,
    alignItems: "flex-start",
  },
  hintText: { flex: 1, fontSize: fs(13), lineHeight: 19 },
  actionsRow: { flexDirection: "row", gap: 12, width: "100%" },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderWidth: 1.5,
  },
  actionBtnText: { fontSize: fs(13) },
});
