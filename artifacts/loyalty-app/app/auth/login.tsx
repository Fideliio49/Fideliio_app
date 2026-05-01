import React, { useState } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Platform, Keyboard,
} from "react-native";
import { fs } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { FideliioLogo } from "@/components/FideliioLogo";
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { completeOnboarding } = useApp();

  const [mode, setMode] = useState<"login" | "register">("login");
  const [inputMode, setInputMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = t("auth.atLeastOne");
    if (!password.trim()) errs.password = "Required";
    if (mode === "register") {
      if (!firstName.trim()) errs.firstName = "Required";
      if (!lastName.trim()) errs.lastName = "Required";
      if (password.length < 6) errs.password = "Au moins 6 caractères";
      if (password !== confirmPw) errs.confirmPw = t("auth.passwordsMatch");
    }
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(), password,
        });
        if (error) throw error;

        // ✅ Vérifier si l'utilisateur a déjà un rôle actif
        const storedRole = await AsyncStorage.getItem("@active_role");
        await completeOnboarding();

        if (storedRole) {
          // Connexion existante → aller directement
          router.replace(storedRole === "merchant" ? "/(merchant)/home" : "/(customer)/home");
        } else {
          // Première connexion → choisir le rôle
          router.replace("/auth/role");
        }
      } else {
        // Inscription
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              first_name: firstName.trim(),
              last_name: lastName.trim(),
              firstName: firstName.trim(),
              lastName: lastName.trim(),
            },
          },
        });
        if (error) {
          if (error.message.includes("already registered") || error.message.includes("User already registered")) {
            Alert.alert(
              "Email déjà utilisé",
              "Ce compte existe déjà. Connectez-vous.",
              [{ text: "Se connecter", onPress: () => setMode("login") }, { text: "Annuler", style: "cancel" }]
            );
            return;
          }
          throw error;
        }
        await completeOnboarding();
        // Nouvel utilisateur → choisir son rôle
        router.replace("/auth/role");
      }
    } catch (e: any) {
      const msg = e?.message ?? "";
      if (msg.includes("Invalid login credentials")) {
        Alert.alert("Erreur", "Email ou mot de passe incorrect.");
      } else if (msg.includes("Email not confirmed")) {
        Alert.alert("Erreur", "Veuillez confirmer votre email.");
      } else {
        Alert.alert("Erreur", msg || "Une erreur est survenue.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: "#fff" }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={[styles.scroll, { paddingTop: Platform.OS === "web" ? 80 : 60 }]}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={Keyboard.dismiss}
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <FideliioLogo size={60} />
          <Text style={[styles.appName, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>Fideliio</Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("splash.tagline")}
          </Text>
        </View>

        {/* Toggle login / register */}
        <View style={[styles.toggleRow, { backgroundColor: colors.muted, borderRadius: 12 }]}>
          {(["login", "register"] as const).map((m) => (
            <TouchableOpacity key={m} onPress={() => { setMode(m); setErrors({}); }}
              style={[styles.toggleBtn, { backgroundColor: mode === m ? "#fff" : "transparent", borderRadius: 10, shadowColor: mode === m ? "#000" : "transparent", shadowOpacity: 0.08, shadowRadius: 4, elevation: mode === m ? 2 : 0 }]}>
              <Text style={[styles.toggleText, { color: mode === m ? colors.foreground : colors.mutedForeground, fontFamily: mode === m ? "Inter_700Bold" : "Inter_400Regular" }]}>
                {m === "login" ? t("auth.login") : t("auth.register")}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Form */}
        <View style={styles.form}>
          {mode === "register" && (
            <View style={styles.row2}>
              <Input label={t("auth.firstName")} placeholder={t("auth.firstName")} value={firstName} onChangeText={setFirstName} leftIcon="user" error={errors.firstName} containerStyle={{ flex: 1 }} />
              <Input label={t("auth.lastName")} placeholder={t("auth.lastName")} value={lastName} onChangeText={setLastName} leftIcon="user" error={errors.lastName} containerStyle={{ flex: 1 }} />
            </View>
          )}
          <Input label={t("auth.email")} placeholder="email@exemple.com" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" leftIcon="mail" error={errors.email} />
          <Input label={t("auth.password")} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry={!showPw} leftIcon="lock" rightIcon={showPw ? "eye-off" : "eye"} onRightIconPress={() => setShowPw(v => !v)} error={errors.password} />
          {mode === "register" && (
            <Input label={t("auth.confirmPassword")} placeholder="••••••••" value={confirmPw} onChangeText={setConfirmPw} secureTextEntry={!showConfirmPw} leftIcon="lock" rightIcon={showConfirmPw ? "eye-off" : "eye"} onRightIconPress={() => setShowConfirmPw(v => !v)} error={errors.confirmPw} />
          )}
          {mode === "login" && (
            <TouchableOpacity onPress={() => router.push("/auth/forgot")} style={styles.forgotBtn}>
              <Text style={[styles.forgotText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>{t("auth.forgotPassword")}</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* CTA */}
        <TouchableOpacity onPress={handleSubmit} activeOpacity={0.88} disabled={loading}>
          <LinearGradient colors={["#C85A17", "#E67E22"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[styles.ctaBtn, { borderRadius: colors.radius }]}>
            <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
              {loading ? t("common.loading") : mode === "login" ? t("auth.login") : t("auth.register")}
            </Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>{t("common.or")}</Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        {/* Google */}
        <TouchableOpacity style={[styles.googleBtn, { borderColor: colors.border, borderRadius: colors.radius }]}>
          <Text style={styles.googleIcon}>G</Text>
          <Text style={[styles.googleText, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>{t("auth.google")}</Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24 },
  header: { alignItems: "center", gap: 8, marginBottom: 32 },
  appName: { fontSize: fs(28) },
  tagline: { fontSize: fs(14) },
  toggleRow: { flexDirection: "row", padding: 4, marginBottom: 24 },
  toggleBtn: { flex: 1, paddingVertical: 10, alignItems: "center" },
  toggleText: { fontSize: fs(15) },
  form: { gap: 0 },
  row2: { flexDirection: "row", gap: 12 },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 8, marginTop: 4 },
  forgotText: { fontSize: fs(13) },
  ctaBtn: { paddingVertical: 16, alignItems: "center", marginTop: 8 },
  ctaText: { color: "#fff", fontSize: fs(16) },
  dividerRow: { flexDirection: "row", alignItems: "center", marginVertical: 20, gap: 12 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: fs(14) },
  googleBtn: { borderWidth: 1.5, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 10 },
  googleIcon: { fontSize: fs(18), fontWeight: "bold", color: "#4285F4" },
  googleText: { fontSize: fs(15) },
});