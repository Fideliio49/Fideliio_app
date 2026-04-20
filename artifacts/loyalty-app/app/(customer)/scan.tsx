import React, { useCallback, useEffect, useState } from "react";
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
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";

export default function CustomerQrCodeScreen() {
  const colors = useColors();
  const { user, colorTheme } = useApp();
  const insets = useSafeAreaInsets();

  const [customer, setCustomer] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : 0;
  const isDark = colorTheme === "dark";

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(isDark ? "#121212" : "#F9FAFB", true);
      }
      loadCustomer();
    }, [isDark, user]),
  );

  async function loadCustomer() {
    if (!user?.id) return;
    try {
      setLoading(true);

      // Charger le profil client depuis Supabase
      const { data: customerData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Erreur chargement client:", error);
        return;
      }

      setCustomer(customerData);

      // Charger les points totaux depuis la vue
      const { data: pointsData } = await supabase
        .from("customer_total_points")
        .select("total_points")
        .eq("customer_id", customerData.id)
        .single();

      setTotalPoints(pointsData?.total_points ?? 0);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  }

  // QR code = valeur exacte depuis la base de données
  const qrCodeValue = customer?.qr_code ?? null;

  async function handleShare() {
    if (!qrCodeValue) return;
    try {
      await Share.share({
        message: `Mon code Fideliio : ${qrCodeValue}`,
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
        <Feather name="alert-circle" size={48} color={colors.mutedForeground} />
        <Text
          style={[
            styles.title,
            { color: colors.foreground, textAlign: "center", marginTop: 16 },
          ]}
        >
          QR Code non disponible
        </Text>
        <Text
          style={[
            styles.subtitle,
            { color: colors.mutedForeground, textAlign: "center" },
          ]}
        >
          Veuillez vous reconnecter pour générer votre QR code.
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
        Mon QR Code
      </Text>
      <Text
        style={[
          styles.subtitle,
          { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
        ]}
      >
        Présentez ce code lors de chaque achat
      </Text>

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
          <Feather name="star" size={14} color="#F9A602" />
          <Text
            style={[
              styles.pointsText,
              { color: "#F9A602", fontFamily: "Inter_700Bold" },
            ]}
          >
            {totalPoints} points
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

      <View
        style={[
          styles.hintBox,
          {
            backgroundColor: colors.primary + "12",
            borderColor: colors.primary + "30",
          },
        ]}
      >
        <Feather name="info" size={16} color={colors.primary} />
        <Text
          style={[
            styles.hintText,
            { color: colors.primary, fontFamily: "Inter_400Regular" },
          ]}
        >
          Le marchand scannera ce QR code pour valider votre achat et créditer
          vos points.
        </Text>
      </View>

      <TouchableOpacity
        onPress={handleShare}
        style={[
          styles.shareBtn,
          {
            backgroundColor: colors.primary + "12",
            borderColor: colors.primary + "40",
            borderRadius: colors.radius,
          },
        ]}
        activeOpacity={0.8}
      >
        <Feather name="share-2" size={18} color={colors.primary} />
        <Text
          style={[
            styles.shareBtnText,
            { color: colors.primary, fontFamily: "Inter_600SemiBold" },
          ]}
        >
          Partager mon QR Code
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { paddingHorizontal: 24, alignItems: "center" },
  title: { fontSize: 24, marginBottom: 6, alignSelf: "flex-start" },
  subtitle: { fontSize: 14, marginBottom: 28, alignSelf: "flex-start" },
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
    marginBottom: 20,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 16,
    marginBottom: 4,
  },
  userName: { fontSize: 20 },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    backgroundColor: "#FFF8E1",
    borderRadius: 99,
  },
  pointsText: { fontSize: 15 },
  codeText: { fontSize: 12, letterSpacing: 1.5, marginTop: 4 },
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
  hintText: { flex: 1, fontSize: 13, lineHeight: 19 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    width: "100%",
    justifyContent: "center",
  },
  shareBtnText: { fontSize: 15 },
});
