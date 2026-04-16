import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Language } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const LANGS: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

export default function MerchantProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, language, setLanguage, logout } = useApp();
  const router = useRouter();
  const { getMerchantByUserId, updateMerchant } = useData();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const merchant = user ? getMerchantByUserId(user.id) : null;

  const [rate, setRate] = useState(String(merchant?.pointsRate ?? 1));
  const [savingRate, setSavingRate] = useState(false);
  const [notifications, setNotifications] = useState(true);

  async function handleSaveRate() {
    const val = parseFloat(rate);
    if (isNaN(val) || val <= 0) {
      Alert.alert("", "Veuillez entrer un taux valide");
      return;
    }
    setSavingRate(true);
    try {
      if (merchant) await updateMerchant(merchant.id, { pointsRate: val });
    } finally {
      setSavingRate(false);
    }
  }

  async function handleLogout() {
    Alert.alert(t("profile.logout"), "", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("profile.logout"),
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/onboarding/language");
        },
      },
    ]);
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: 100 }}
      showsVerticalScrollIndicator={false}
    >
      <StatusBar style="dark" />
      <View style={[styles.header, { paddingTop: topPad + 12 }]}>
        <Text
          style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
        >
          {t("profile.settings")}
        </Text>
      </View>

      <View style={styles.content}>
        <Card style={styles.bizCard}>
          <View style={[styles.bizIcon, { backgroundColor: colors.green100 }]}>
            <Feather name="briefcase" size={28} color={colors.secondary} />
          </View>
          <Text
            style={[styles.bizName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
          >
            {merchant?.businessName ?? user?.businessName}
          </Text>
          <Text
            style={[styles.bizCat, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
          >
            {t(`auth.categories.${merchant?.category ?? "other"}` as any)}
          </Text>
          <View style={styles.bizStats}>
            <View style={styles.bizStat}>
              <Text
                style={[styles.statVal, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
              >
                {merchant?.totalCustomers ?? 0}
              </Text>
              <Text
                style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              >
                {t("merchant.activeCustomers")}
              </Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.bizStat}>
              <Text
                style={[styles.statVal, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}
              >
                {merchant?.pointsThisMonth ?? 0}
              </Text>
              <Text
                style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              >
                {t("merchant.pointsDistributed")}
              </Text>
            </View>
          </View>
        </Card>

        {merchant?.qrCode && (
          <Card style={styles.qrCard}>
            <Text
              style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
            >
              Mon QR Code Marchand
            </Text>
            <Text
              style={[styles.qrSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            >
              Affichez ce code à votre comptoir pour que vos clients puissent vous identifier.
            </Text>
            <View style={styles.qrWrap}>
              <QRCode
                value={merchant.qrCode}
                size={160}
                color="#1a1a2e"
                backgroundColor="white"
              />
            </View>
            <Text
              style={[styles.qrCodeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            >
              {merchant.qrCode}
            </Text>
          </Card>
        )}

        <Card>
          <Text
            style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
          >
            {t("profile.pointsRate")}
          </Text>
          <View style={styles.rateRow}>
            <Input
              placeholder="1"
              value={rate}
              onChangeText={setRate}
              keyboardType="decimal-pad"
              leftIcon="zap"
              containerStyle={{ flex: 1, marginBottom: 0 }}
            />
            <Text
              style={[styles.rateLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
            >
              DH = {rate || "1"} pts
            </Text>
          </View>
          <Button
            title={t("common.save")}
            onPress={handleSaveRate}
            loading={savingRate}
            variant="secondary"
            size="sm"
            style={{ marginTop: 10, alignSelf: "flex-start" }}
          />
        </Card>

        <Card>
          <View style={styles.notifRow}>
            <View style={{ flex: 1 }}>
              <Text
                style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
              >
                {t("profile.notifications")}
              </Text>
              <Text
                style={[styles.notifSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}
              >
                Alertes transactions
              </Text>
            </View>
            <Switch
              value={notifications}
              onValueChange={setNotifications}
              trackColor={{ false: colors.border, true: colors.secondary + "80" }}
              thumbColor={notifications ? colors.secondary : colors.mutedForeground}
            />
          </View>
        </Card>

        <Card>
          <Text
            style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}
          >
            {t("profile.language")}
          </Text>
          <View style={styles.langRow}>
            {LANGS.map((l) => (
              <TouchableOpacity
                key={l.code}
                onPress={() => setLanguage(l.code)}
                style={[
                  styles.langBtn,
                  {
                    borderColor: language === l.code ? colors.secondary : colors.border,
                    backgroundColor: language === l.code ? colors.green100 : colors.background,
                    borderRadius: colors.radius,
                    borderWidth: language === l.code ? 2 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.langLabel,
                    {
                      color: language === l.code ? colors.teal : colors.mutedForeground,
                      fontFamily: language === l.code ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {l.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Card>

        <Button
          title={t("profile.logout")}
          onPress={handleLogout}
          variant="danger"
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24 },
  content: { padding: 16, gap: 16 },
  bizCard: { alignItems: "center", gap: 6 },
  bizIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  bizName: { fontSize: 20 },
  bizCat: { fontSize: 14 },
  bizStats: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 8 },
  bizStat: { alignItems: "center", gap: 2 },
  statVal: { fontSize: 22 },
  statLbl: { fontSize: 12 },
  statDivider: { width: 1, height: 36 },
  qrCard: { alignItems: "center", gap: 10 },
  qrSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  qrWrap: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 12,
    marginTop: 4,
  },
  qrCodeText: { fontSize: 12, letterSpacing: 1, marginTop: 2 },
  sectionTitle: { fontSize: 15, marginBottom: 12 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rateLbl: { fontSize: 14, flex: 1 },
  notifRow: { flexDirection: "row", alignItems: "center" },
  notifSub: { fontSize: 13, marginTop: 2 },
  langRow: { flexDirection: "row", gap: 8 },
  langBtn: { flex: 1, padding: 10, alignItems: "center", gap: 4 },
  langLabel: { fontSize: 12, textAlign: "center" },
});
