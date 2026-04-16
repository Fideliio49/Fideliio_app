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
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";


const LANGS: { code: Language; label: string }[] = [
  { code: "fr", label: "Français" },
  { code: "ar", label: "العربية" },
  { code: "en", label: "English" },
];

const CATEGORY_KEYS = ["restaurant", "clothing", "hairSalon", "hotel", "other"] as const;

export default function MerchantProfileScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { user, setUser, language, setLanguage, logout, colorTheme, setColorTheme, merchantAccentColor, setMerchantAccentColor } = useApp();
  const router = useRouter();
  const { getMerchantByUserId, updateMerchant } = useData();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const merchant = user ? getMerchantByUserId(user.id) : null;
  const isDark = colorTheme === "dark";

  const [rate, setRate] = useState(String(merchant?.pointsRate ?? 1));
  const [savingRate, setSavingRate] = useState(false);
  const [notifications, setNotifications] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState(user?.firstName ?? "");
  const [lastName, setLastName] = useState(user?.lastName ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [bizName, setBizName] = useState(merchant?.businessName ?? user?.businessName ?? "");
  const [category, setCategory] = useState(merchant?.category ?? "other");
  const [prevInfo, setPrevInfo] = useState({
    firstName: user?.firstName ?? "",
    lastName: user?.lastName ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
    bizName: merchant?.businessName ?? user?.businessName ?? "",
    category: merchant?.category ?? "other",
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

  async function handleSaveInfo() {
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
      if (merchant) {
        await updateMerchant(merchant.id, {
          businessName: bizName.trim() || merchant.businessName,
          category,
        });
      }
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
    setBizName(prevInfo.bizName);
    setCategory(prevInfo.category);
    setIsEditing(false);
  }

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
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
      >
        <View style={[styles.header, { paddingTop: topPad + 12 }]}>
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
                    setPrevInfo({ firstName, lastName, email, phone, bizName, category });
                    setIsEditing(true);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather name={isEditing ? "x" : "edit-2"} size={18} color={merchantAccentColor} />
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
                      borderColor: isEditing ? merchantAccentColor : colors.border,
                      borderWidth: isEditing ? 1.5 : 1,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                  placeholderTextColor={colors.mutedForeground}
                />
              </View>
            ))}

            <View style={styles.infoField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("auth.businessName")}
              </Text>
              <TextInput
                value={bizName}
                onChangeText={setBizName}
                editable={isEditing}
                style={[
                  styles.fieldInput,
                  {
                    color: colors.foreground,
                    backgroundColor: isEditing ? colors.card : "transparent",
                    borderColor: isEditing ? merchantAccentColor : colors.border,
                    borderWidth: isEditing ? 1.5 : 1,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
                placeholderTextColor={colors.mutedForeground}
              />
            </View>

            <View style={styles.infoField}>
              <Text style={[styles.fieldLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {t("auth.businessCategory")}
              </Text>
              {isEditing ? (
                <View style={styles.catGrid}>
                  {CATEGORY_KEYS.map((key) => (
                    <TouchableOpacity
                      key={key}
                      onPress={() => setCategory(key)}
                      style={[
                        styles.catChip,
                        {
                          borderColor: category === key ? merchantAccentColor : colors.border,
                          backgroundColor: category === key ? merchantAccentColor + "15" : colors.background,
                          borderRadius: 20,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          {
                            color: category === key ? merchantAccentColor : colors.mutedForeground,
                            fontFamily: category === key ? "Inter_600SemiBold" : "Inter_400Regular",
                          },
                        ]}
                      >
                        {t(`auth.categories.${key}` as any)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={[styles.fieldReadonly, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {t(`auth.categories.${category}` as any)}
                </Text>
              )}
            </View>

            {isEditing && (
              <View style={styles.editActions}>
                <Button title={t("common.cancel")} onPress={handleCancel} variant="outline" size="sm" style={{ flex: 1 }} />
                <Button
                  title={t("common.save")}
                  onPress={handleSaveInfo}
                  loading={saving}
                  size="sm"
                  style={{ flex: 1, backgroundColor: merchantAccentColor, borderRadius: 99 }}
                />
              </View>
            )}
          </Card>

          <Card style={styles.bizCard}>
            <View style={[styles.bizIcon, { backgroundColor: merchantAccentColor + "18" }]}>
              <Feather name="briefcase" size={28} color={merchantAccentColor} />
            </View>
            <Text style={[styles.bizName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
              {merchant?.businessName ?? user?.businessName}
            </Text>
            <Text style={[styles.bizCat, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t(`auth.categories.${merchant?.category ?? "other"}` as any)}
            </Text>
            <View style={styles.bizStats}>
              <View style={styles.bizStat}>
                <Text style={[styles.statVal, { color: "#F9A602", fontFamily: "Inter_700Bold" }]}>
                  {merchant?.totalCustomers ?? 0}
                </Text>
                <Text style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("merchant.activeCustomers")}
                </Text>
              </View>
              <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
              <View style={styles.bizStat}>
                <Text style={[styles.statVal, { color: "#F9A602", fontFamily: "Inter_700Bold" }]}>
                  {merchant?.pointsThisMonth ?? 0}
                </Text>
                <Text style={[styles.statLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  {t("merchant.pointsDistributed")}
                </Text>
              </View>
            </View>
          </Card>

          {merchant?.qrCode && (
            <Card style={styles.qrCard}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                Mon QR Code Marchand
              </Text>
              <Text style={[styles.qrSubtitle, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Affichez ce code à votre comptoir pour que vos clients puissent vous identifier.
              </Text>
              <View style={styles.qrWrap}>
                <QRCode value={merchant.qrCode} size={160} color="#1a1a2e" backgroundColor="white" />
              </View>
              <Text style={[styles.qrCodeText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                {merchant.qrCode}
              </Text>
            </Card>
          )}

          <Card>
            <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
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
              <Text style={[styles.rateLbl, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                DH = {rate || "1"} pts
              </Text>
            </View>
            <Button
              title={t("common.save")}
              onPress={handleSaveRate}
              loading={savingRate}
              size="sm"
              style={{ marginTop: 10, alignSelf: "flex-start", backgroundColor: merchantAccentColor, borderRadius: 99 }}
            />
          </Card>

          <Card>
            <View style={styles.notifRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]}>
                  {t("profile.notifications")}
                </Text>
                <Text style={[styles.notifSub, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                  Alertes transactions
                </Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: colors.border, true: merchantAccentColor + "80" }}
                thumbColor={notifications ? merchantAccentColor : colors.mutedForeground}
              />
            </View>
          </Card>

          <Card>
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
                      borderColor: language === l.code ? merchantAccentColor : colors.border,
                      backgroundColor: language === l.code ? merchantAccentColor + "15" : colors.background,
                      borderRadius: colors.radius,
                      borderWidth: language === l.code ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.langLabel,
                      {
                        color: language === l.code ? merchantAccentColor : colors.mutedForeground,
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
                <Feather name="sun" size={18} color={!isDark ? merchantAccentColor : colors.mutedForeground} />
                <Text style={[styles.themeLabel, { color: colors.foreground, fontFamily: "Inter_400Regular" }]}>
                  {isDark ? "Mode sombre" : "Mode clair"}
                </Text>
                <Feather name="moon" size={18} color={isDark ? merchantAccentColor : colors.mutedForeground} />
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => setColorTheme(val ? "dark" : "light")}
                trackColor={{ false: colors.border, true: merchantAccentColor + "80" }}
                thumbColor={isDark ? merchantAccentColor : colors.mutedForeground}
              />
            </View>
            <View style={styles.accentSection}>
              <Text style={[styles.accentLabel, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
                Couleur principale
              </Text>
              <View style={styles.swatchRow}>
                {ACCENT_COLORS.map((swatch) => {
                  const isSelected = merchantAccentColor === swatch.value;
                  return (
                    <TouchableOpacity
                      key={swatch.key}
                      onPress={() => setMerchantAccentColor(swatch.value)}
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

          <Button title={t("profile.logout")} onPress={handleLogout} variant="danger" size="lg" />
        </View>
      </ScrollView>

      {toastVisible && (
        <View style={[styles.toast, { backgroundColor: toastType === "success" ? "#27AE60" : "#E74C3C" }]}>
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24 },
  content: { padding: 16, gap: 16 },
  section: {},
  sectionTitle: { fontSize: 15, marginBottom: 12 },
  bizCard: { alignItems: "center", gap: 6 },
  bizIcon: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  bizName: { fontSize: 20 },
  bizCat: { fontSize: 14 },
  bizStats: { flexDirection: "row", alignItems: "center", gap: 24, marginTop: 8 },
  bizStat: { alignItems: "center", gap: 2 },
  statVal: { fontSize: 22 },
  statLbl: { fontSize: 12 },
  statDivider: { width: 1, height: 36 },
  qrCard: { alignItems: "center", gap: 10 },
  qrSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  qrWrap: { padding: 16, backgroundColor: "white", borderRadius: 12, marginTop: 4 },
  qrCodeText: { fontSize: 12, letterSpacing: 1, marginTop: 2 },
  rateRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rateLbl: { fontSize: 14, flex: 1 },
  notifRow: { flexDirection: "row", alignItems: "center" },
  notifSub: { fontSize: 13, marginTop: 2 },
  langRow: { flexDirection: "row", gap: 8 },
  langBtn: { flex: 1, padding: 10, alignItems: "center", gap: 4 },
  langLabel: { fontSize: 12, textAlign: "center" },
  infoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  infoField: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  fieldInput: { paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, borderRadius: 8 },
  themeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  themeIconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeLabel: { fontSize: 14 },
  accentSection: { gap: 10 },
  accentLabel: { fontSize: 13 },
  swatchRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  swatch: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  fieldReadonly: { fontSize: 14, paddingVertical: 10 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1.5 },
  catChipText: { fontSize: 13 },
  editActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  toast: { position: "absolute", bottom: 90, left: 24, right: 24, padding: 16, borderRadius: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 8, zIndex: 1000 },
  toastText: { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 14, textAlign: "center" },
});
