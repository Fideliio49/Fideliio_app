import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  Share,
  StatusBar,
  TextInput,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
} from "react-native";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Language, ACCENT_COLORS } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TransactionRow } from "@/components/TransactionRow";

const LANGS: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
};

export default function CustomerProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const {
    user,
    setUser,
    language,
    setLanguage,
    logout,
    colorTheme,
    setColorTheme,
    accentColor,
    setAccentColor,
  } = useApp();
  const router = useRouter();
  const { getCustomerByUserId, getCustomerTransactions } = useData();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const customer = user ? getCustomerByUserId(user.id) : null;
  const transactions = customer ? getCustomerTransactions(customer.id) : [];
  const isDark = colorTheme === "dark";

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [prevInfo, setPrevInfo] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(message: string, type: "success" | "error" = "success") {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(message);
    setToastType(type);
    setToastVisible(true);
    toastTimer.current = setTimeout(() => setToastVisible(false), 2500);
  }

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle(isDark ? "light-content" : "dark-content", true);
      if (Platform.OS === "android") {
        StatusBar.setBackgroundColor(isDark ? "#121212" : "#F9FAFB", true);
      }
    }, [isDark])
  );

  async function handleSave() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      showToast(t("profile.invalidEmail"), "error");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      showToast(t("profile.atLeastContact"), "error");
      return;
    }
    setSaving(true);
    try {
      setUser({
        ...user!,
        firstName: firstName.trim() || user!.firstName,
        lastName: lastName.trim() || user!.lastName,
        email: email.trim() || user!.email,
        phone: phone.trim() || user!.phone,
      });
      setIsEditing(false);
      showToast("✓ " + t("profile.saveSuccess"));
    } catch {
      showToast(t("common.error"), "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFirstName(prevInfo.firstName);
    setLastName(prevInfo.lastName);
    setEmail(prevInfo.email);
    setPhone(prevInfo.phone);
    setIsEditing(false);
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

  const tierColor = TIER_COLORS[customer?.tier ?? "bronze"];
  const qrCodeValue = customer?.qrCode ?? `FID-CUST-${user?.id ?? "UNKNOWN"}`;

  async function handleShareQr() {
    try {
      await Share.share({ message: `Mon code Fideliio : ${qrCodeValue}` });
    } catch {}
  }

  const infoFields = [
    { label: t("auth.firstName"), value: firstName, onChange: setFirstName, kbType: "default" as const },
    { label: t("auth.lastName"), value: lastName, onChange: setLastName, kbType: "default" as const },
    { label: t("auth.email"), value: email, onChange: setEmail, kbType: "email-address" as const },
    { label: t("auth.phone"), value: phone, onChange: setPhone, kbType: "phone-pad" as const },
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <View style={{ flex: 1 }}>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background }]}>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("profile.title")}
          </Text>
        </View>

        <View style={styles.content}>

          <Card style={styles.section}>
            <View style={styles.infoHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("profile.myInfo")}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (isEditing) {
                    handleCancel();
                  } else {
                    setPrevInfo({ firstName, lastName, email, phone });
                    setIsEditing(true);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name={isEditing ? "x" : "edit-2"} size={18} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {infoFields.map(({ label, value, onChange, kbType }) => (
              <View key={label} style={styles.infoField}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {label}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  editable={isEditing}
                  keyboardType={kbType}
                  style={[
                    styles.fieldInput,
                    {
                      color: colors.foreground,
                      backgroundColor: isEditing ? colors.card : "transparent",
                      borderColor: isEditing ? colors.primary : colors.border,
                      borderWidth: isEditing ? 1.5 : 1,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            ))}

            {isEditing && (
              <View style={styles.editActions}>
                <Button title={t("common.cancel")} onPress={handleCancel} variant="outline" size="sm" style={{ flex: 1 }} />
                <Button title={t("common.save")} onPress={handleSave} loading={saving} size="sm" style={{ flex: 1 }} />
              </View>
            )}
          </Card>

          <Card style={styles.profileCard}>
            <View style={[styles.avatar, { backgroundColor: colors.primary + "20" }]}>
              <Text style={[styles.avatarText, { color: colors.primary, fontFamily: "Inter_700Bold" }]}>
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </Text>
            </View>
            <Text style={[styles.userName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {user?.firstName} {user?.lastName}
            </Text>
            {user?.email && (
              <Text style={[styles.userContact, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {user.email}
              </Text>
            )}
            {user?.phone && (
              <Text style={[styles.userContact, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {user.phone}
              </Text>
            )}
            <View style={styles.tierRow}>
              <Badge
                label={t(`customers.${customer?.tier ?? "bronze"}` as any)}
                style={{ borderWidth: 1.5, borderColor: tierColor, backgroundColor: tierColor + "20" }}
              />
              <Text style={[styles.tierPoints, { color: "#F9A602", fontFamily: "Inter_600SemiBold" }]}>
                {customer?.totalPoints ?? 0} {t("customer.points")}
              </Text>
            </View>
          </Card>

          <Card style={styles.qrCard}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Mon QR Code
            </Text>
            <View style={styles.qrWrap}>
              <QRCode value={qrCodeValue} size={150} color="#1a1a2e" backgroundColor="white" />
            </View>
            <Text style={[styles.qrCodeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {qrCodeValue}
            </Text>
            <TouchableOpacity
              onPress={handleShareQr}
              style={[styles.qrShareBtn, { borderColor: colors.primary + "40", borderRadius: colors.radius }]}
            >
              <Feather name="share-2" size={15} color={colors.primary} />
              <Text style={[styles.qrShareText, { color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
                Partager
              </Text>
            </TouchableOpacity>
          </Card>

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
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
                      borderColor: language === l.code ? colors.primary : colors.border,
                      backgroundColor: language === l.code ? colors.primary + "15" : colors.background,
                      borderRadius: colors.radius,
                      borderWidth: language === l.code ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.langLabel,
                      {
                        color: language === l.code ? colors.primary : colors.mutedForeground,
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

          <Card style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
              Apparence
            </Text>
            <View style={styles.themeRow}>
              <View style={styles.themeIconRow}>
                <Feather name="sun" size={18} color={!isDark ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.themeLabel, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {isDark ? "Mode sombre" : "Mode clair"}
                </Text>
                <Feather name="moon" size={18} color={isDark ? colors.primary : colors.mutedForeground} />
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => setColorTheme(val ? "dark" : "light")}
                trackColor={{ false: colors.border, true: colors.primary + "80" }}
                thumbColor={isDark ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={styles.accentSection}>
              <Text style={[styles.accentLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Couleur principale
              </Text>
              <View style={styles.swatchRow}>
                {ACCENT_COLORS.map((swatch) => {
                  const isSelected = accentColor === swatch.value;
                  return (
                    <TouchableOpacity
                      key={swatch.key}
                      onPress={() => setAccentColor(swatch.value)}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: swatch.value,
                          borderWidth: isSelected ? 3 : 2,
                          borderColor: isSelected ? swatch.value : "transparent",
                          shadowColor: isSelected ? swatch.value : "transparent",
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isSelected ? 0.5 : 0,
                          shadowRadius: 4,
                          elevation: isSelected ? 4 : 0,
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        },
                      ]}
                    >
                      {isSelected && <Feather name="check" size={14} color="white" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>

          {transactions.length > 0 && (
            <Card style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                {t("profile.pointsHistory")}
              </Text>
              {transactions.slice(0, 5).map((tx) => (
                <TransactionRow key={tx.id} transaction={tx} />
              ))}
            </Card>
          )}

          <Button title={t("profile.logout")} onPress={handleLogout} variant="danger" size="lg" style={styles.logoutBtn} />
        </View>
      </ScrollView>

      {toastVisible && (
        <View style={[styles.toast, { backgroundColor: toastType === "success" ? "#27AE60" : "#E74C3C" }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
      </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24 },
  content: { padding: 16, gap: 16 },
  profileCard: { alignItems: "center", gap: 6 },
  avatar: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatarText: { fontSize: 28 },
  userName: { fontSize: 20 },
  userContact: { fontSize: 14 },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 4 },
  tierPoints: { fontSize: 15 },
  section: {},
  sectionTitle: { fontSize: 15, marginBottom: 14 },
  qrCard: { alignItems: "center", gap: 10 },
  qrWrap: { padding: 14, backgroundColor: "white", borderRadius: 12 },
  qrCodeText: { fontSize: 11, letterSpacing: 1.2 },
  qrShareBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 20, borderWidth: 1.5 },
  qrShareText: { fontSize: 14 },
  langRow: { flexDirection: "row", gap: 8 },
  langBtn: { flex: 1, padding: 10, alignItems: "center", gap: 4 },
  langLabel: { fontSize: 12, textAlign: "center" },
  themeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  themeIconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeLabel: { fontSize: 14 },
  accentSection: { gap: 10 },
  accentLabel: { fontSize: 13 },
  swatchRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  logoutBtn: {},
  infoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  infoField: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  fieldInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderRadius: 8 },
  editActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  toast: { position: "absolute", bottom: 90, left: 24, right: 24, padding: 16, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8, zIndex: 1000 },
  toastText: { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "center" },
});
