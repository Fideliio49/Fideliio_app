import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
  Share,
  StatusBar,
  TextInput,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import QRCode from "react-native-qrcode-svg";
import { useTranslation } from "react-i18next";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp, Language, ACCENT_COLORS } from "@/context/AppContext";
import { KEYBOARD_TOOLBAR_ID } from "@/constants/keyboard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { supabase } from "@/lib/supabase";

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
    language,
    setLanguage,
    logout,
    deleteAccount,
    colorTheme,
    setColorTheme,
    accentColor,
    setAccentColor,
  } = useApp();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const isDark = colorTheme === "dark";

  // ─── State depuis Supabase ────────────────────────────────
  const [customer, setCustomer] = useState<any>(null);
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const [isEditing, setIsEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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
      loadProfile();
    }, [isDark, user]),
  );

  // ─── Charger le profil depuis Supabase ────────────────────
  async function loadProfile() {
    if (!user?.id) return;
    try {
      setLoading(true);

      const { data: customerData, error } = await supabase
        .from("customers")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Erreur chargement profil:", error);
        return;
      }

      setCustomer(customerData);
      setFirstName(customerData.first_name ?? "");
      setLastName(customerData.last_name ?? "");
      setEmail(customerData.email ?? "");
      setPhone(customerData.phone ?? "");

      // Points depuis la vue dynamique
      const { data: pointsData } = await supabase
        .from("customer_total_points")
        .select("total_points")
        .eq("customer_id", customerData.id)
        .maybeSingle();

      setTotalPoints(pointsData?.total_points ?? 0);
    } catch (err) {
      console.error("Erreur:", err);
    } finally {
      setLoading(false);
    }
  }

  // ─── Sauvegarder les modifications ────────────────────────
  async function handleSave() {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email.trim() && !emailRegex.test(email.trim())) {
      showToast("Email invalide", "error");
      return;
    }
    if (!email.trim() && !phone.trim()) {
      showToast("Email ou téléphone requis", "error");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
        })
        .eq("user_id", user!.id);

      if (error) throw error;

      setCustomer((prev: any) => ({
        ...prev,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
      }));

      setIsEditing(false);
      showToast("✓ Informations mises à jour");
    } catch (err: any) {
      showToast(err.message || "Erreur lors de la sauvegarde", "error");
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFirstName(customer?.first_name ?? "");
    setLastName(customer?.last_name ?? "");
    setEmail(customer?.email ?? "");
    setPhone(customer?.phone ?? "");
    setIsEditing(false);
  }

  async function handleLogout() {
    Alert.alert("Déconnexion", "", [
      { text: "Annuler", style: "cancel" },
      {
        text: "Se déconnecter",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/onboarding/language");
        },
      },
    ]);
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Supprimer votre compte ?",
      "Cette action est irréversible. Toutes vos données seront définitivement supprimées.",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer définitivement",
          style: "destructive",
          onPress: async () => {
            await deleteAccount();
            router.replace("/onboarding/language");
          },
        },
      ],
    );
  }

  const tierColor = TIER_COLORS[customer?.tier ?? "bronze"];
  const qrCodeValue = customer?.qr_code ?? null;

  async function handleShareQr() {
    if (!qrCodeValue) return;
    try {
      await Share.share({ message: `Mon code Fideliio : ${qrCodeValue}` });
    } catch {}
  }

  const infoFields = [
    {
      label: "Prénom",
      value: firstName,
      onChange: setFirstName,
      kbType: "default" as const,
    },
    {
      label: "Nom",
      value: lastName,
      onChange: setLastName,
      kbType: "default" as const,
    },
    {
      label: "Email",
      value: email,
      onChange: setEmail,
      kbType: "email-address" as const,
    },
    {
      label: "Téléphone",
      value: phone,
      onChange: setPhone,
      kbType: "phone-pad" as const,
    },
  ];

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <KeyboardAwareScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={Platform.OS === "ios" ? 20 : 60}
      >
        <View
          style={[
            styles.header,
            { paddingTop: topPad + 12, backgroundColor: colors.background },
          ]}
        >
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            Profil
          </Text>
        </View>

        <View style={styles.content}>
          {/* Mes informations */}
          <Card style={styles.section}>
            <View style={styles.infoHeader}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Mes informations
              </Text>
              <TouchableOpacity
                onPress={() => {
                  if (isEditing) {
                    handleCancel();
                  } else {
                    setIsEditing(true);
                  }
                }}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Feather
                  name={isEditing ? "x" : "edit-2"}
                  size={18}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>

            {infoFields.map(({ label, value, onChange, kbType }) => (
              <View key={label} style={styles.infoField}>
                <Text
                  style={[
                    styles.fieldLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {label}
                </Text>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  editable={isEditing}
                  keyboardType={kbType}
                  inputAccessoryViewID={
                    Platform.OS === "ios" ? KEYBOARD_TOOLBAR_ID : undefined
                  }
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
                <Button
                  title="Annuler"
                  onPress={handleCancel}
                  variant="outline"
                  size="sm"
                  style={{ flex: 1 }}
                />
                <Button
                  title="Enregistrer"
                  onPress={handleSave}
                  loading={saving}
                  size="sm"
                  style={{ flex: 1 }}
                />
              </View>
            )}
          </Card>

          {/* Carte profil */}
          <Card style={styles.profileCard}>
            <View
              style={[
                styles.avatar,
                { backgroundColor: colors.primary + "20" },
              ]}
            >
              <Text
                style={[
                  styles.avatarText,
                  { color: colors.primary, fontFamily: "Inter_700Bold" },
                ]}
              >
                {(customer?.first_name?.[0] ?? "").toUpperCase()}
                {(customer?.last_name?.[0] ?? "").toUpperCase()}
              </Text>
            </View>
            <Text
              style={[
                styles.userName,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              {customer?.first_name} {customer?.last_name}
            </Text>
            {customer?.email && (
              <Text
                style={[
                  styles.userContact,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {customer.email}
              </Text>
            )}
            {customer?.phone && (
              <Text
                style={[
                  styles.userContact,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {customer.phone}
              </Text>
            )}
            <View style={styles.tierRow}>
              <Badge
                label={customer?.tier ?? "bronze"}
                style={{
                  borderWidth: 1.5,
                  borderColor: tierColor,
                  backgroundColor: tierColor + "20",
                }}
              />
              <Text
                style={[
                  styles.tierPoints,
                  { color: "#F9A602", fontFamily: "Inter_600SemiBold" },
                ]}
              >
                {totalPoints} points
              </Text>
            </View>
          </Card>

          {/* QR Code */}
          {qrCodeValue && (
            <Card style={styles.qrCard}>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
                ]}
              >
                Mon QR Code
              </Text>
              <View style={styles.qrWrap}>
                <QRCode
                  value={qrCodeValue}
                  size={150}
                  color="#1a1a2e"
                  backgroundColor="white"
                />
              </View>
              <Text
                style={[
                  styles.qrCodeText,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {qrCodeValue}
              </Text>
              <TouchableOpacity
                onPress={handleShareQr}
                style={[
                  styles.qrShareBtn,
                  {
                    borderColor: colors.primary + "40",
                    borderRadius: colors.radius,
                  },
                ]}
              >
                <Feather name="share-2" size={15} color={colors.primary} />
                <Text
                  style={[
                    styles.qrShareText,
                    { color: colors.primary, fontFamily: "Inter_600SemiBold" },
                  ]}
                >
                  Partager
                </Text>
              </TouchableOpacity>
            </Card>
          )}

          {/* Langue */}
          <Card style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Langue
            </Text>
            <View style={styles.langRow}>
              {LANGS.map((l) => (
                <TouchableOpacity
                  key={l.code}
                  onPress={() => setLanguage(l.code)}
                  style={[
                    styles.langBtn,
                    {
                      borderColor:
                        language === l.code ? colors.primary : colors.border,
                      backgroundColor:
                        language === l.code
                          ? colors.primary + "15"
                          : colors.background,
                      borderRadius: colors.radius,
                      borderWidth: language === l.code ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.langLabel,
                      {
                        color:
                          language === l.code
                            ? colors.primary
                            : colors.mutedForeground,
                        fontFamily:
                          language === l.code
                            ? "Inter_600SemiBold"
                            : "Inter_400Regular",
                      },
                    ]}
                  >
                    {l.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Card>

          {/* Apparence */}
          <Card style={styles.section}>
            <Text
              style={[
                styles.sectionTitle,
                { color: colors.foreground, fontFamily: "Inter_600SemiBold" },
              ]}
            >
              Apparence
            </Text>
            <View style={styles.themeRow}>
              <View style={styles.themeIconRow}>
                <Feather
                  name="sun"
                  size={18}
                  color={!isDark ? colors.primary : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.themeLabel,
                    {
                      color: colors.foreground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {isDark ? "Mode sombre" : "Mode clair"}
                </Text>
                <Feather
                  name="moon"
                  size={18}
                  color={isDark ? colors.primary : colors.mutedForeground}
                />
              </View>
              <Switch
                value={isDark}
                onValueChange={(val) => setColorTheme(val ? "dark" : "light")}
                trackColor={{
                  false: colors.border,
                  true: colors.primary + "80",
                }}
                thumbColor={isDark ? colors.primary : colors.mutedForeground}
              />
            </View>
            <View style={styles.accentSection}>
              <Text
                style={[
                  styles.accentLabel,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
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
                          borderColor: isSelected
                            ? swatch.value
                            : "transparent",
                          transform: [{ scale: isSelected ? 1.15 : 1 }],
                        },
                      ]}
                    >
                      {isSelected && (
                        <Feather name="check" size={14} color="white" />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </Card>

          <Button
            title="Se déconnecter"
            onPress={handleLogout}
            variant="danger"
            size="lg"
            style={styles.logoutBtn}
          />

          <TouchableOpacity
            onPress={handleDeleteAccount}
            style={styles.deleteAccountBtn}
          >
            <Text style={styles.deleteAccountText}>Supprimer mon compte</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>

      {toastVisible && (
        <View
          style={[
            styles.toast,
            {
              backgroundColor: toastType === "success" ? "#27AE60" : "#E74C3C",
            },
          ]}
        >
          <Text style={styles.toastText}>{toastMsg}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  title: { fontSize: 24 },
  content: { padding: 16, gap: 16 },
  profileCard: { alignItems: "center", gap: 6 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 28 },
  userName: { fontSize: 20 },
  userContact: { fontSize: 14 },
  tierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 4,
  },
  tierPoints: { fontSize: 15 },
  section: {},
  sectionTitle: { fontSize: 15, marginBottom: 14 },
  qrCard: { alignItems: "center", gap: 10 },
  qrWrap: { padding: 14, backgroundColor: "white", borderRadius: 12 },
  qrCodeText: { fontSize: 11, letterSpacing: 1.2 },
  qrShareBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderWidth: 1.5,
  },
  qrShareText: { fontSize: 14 },
  langRow: { flexDirection: "row", gap: 8 },
  langBtn: { flex: 1, padding: 10, alignItems: "center", gap: 4 },
  langLabel: { fontSize: 12, textAlign: "center" },
  themeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  themeIconRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeLabel: { fontSize: 14 },
  accentSection: { gap: 10 },
  accentLabel: { fontSize: 13 },
  swatchRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {},
  deleteAccountBtn: {
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  deleteAccountText: { color: "#E74C3C", fontSize: 14, textAlign: "center" },
  infoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  infoField: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, marginBottom: 4 },
  fieldInput: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderRadius: 8,
  },
  editActions: { flexDirection: "row", gap: 12, marginTop: 8 },
  toast: {
    position: "absolute",
    bottom: 90,
    left: 24,
    right: 24,
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 1000,
  },
  toastText: {
    color: "white",
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
    textAlign: "center",
  },
});
