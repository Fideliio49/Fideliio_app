import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Platform,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { useData } from "@/context/DataContext";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";

const CATEGORIES = ["restaurant", "clothing", "hairSalon", "hotel", "other"] as const;

export default function RegisterScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "customer" | "merchant" }>();
  const { setUser, language, completeOnboarding } = useApp();
  const { registerCustomer, registerMerchant } = useData();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState<string>("restaurant");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleRegister() {
    const errs: Record<string, string> = {};
    if (!firstName.trim()) errs.firstName = "Required";
    if (!lastName.trim()) errs.lastName = "Required";
    if (!email.trim() && !phone.trim()) errs.email = "Email or phone required";
    if (!password.trim()) errs.password = "Required";
    if (role === "merchant" && !businessName.trim()) errs.businessName = "Required";
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 700));
      const userId = `user_${Date.now()}`;

      if (role === "customer") {
        const cust = await registerCustomer({
          userId,
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          totalPoints: 0,
        });
        setUser({
          id: userId,
          role: "customer",
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          language,
          totalPoints: 0,
        });
      } else {
        const merch = await registerMerchant({
          userId,
          businessName,
          category,
          pointsRate: 1,
        });
        setUser({
          id: userId,
          role: "merchant",
          firstName,
          lastName,
          email: email || undefined,
          phone: phone || undefined,
          language,
          businessName,
          businessCategory: category,
          pointsRate: 1,
        });
      }
      await completeOnboarding();
    } catch {
      Alert.alert("Error", "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="arrow-left" size={22} color={colors.foreground} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("auth.register")}
          </Text>
        </View>

        <View style={styles.row2}>
          <Input
            label={t("auth.firstName")}
            placeholder={t("auth.firstName")}
            value={firstName}
            onChangeText={setFirstName}
            leftIcon="user"
            error={errors.firstName}
            containerStyle={{ flex: 1 }}
          />
          <Input
            label={t("auth.lastName")}
            placeholder={t("auth.lastName")}
            value={lastName}
            onChangeText={setLastName}
            leftIcon="user"
            error={errors.lastName}
            containerStyle={{ flex: 1 }}
          />
        </View>

        <Input
          label={t("auth.email")}
          placeholder="email@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          leftIcon="mail"
          error={errors.email}
        />

        <Input
          label={t("auth.phone")}
          placeholder="+212 6XX XXX XXX"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          leftIcon="smartphone"
        />

        <Input
          label={t("auth.password")}
          placeholder="••••••••"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!showPw}
          leftIcon="lock"
          rightIcon={showPw ? "eye-off" : "eye"}
          onRightIconPress={() => setShowPw((v) => !v)}
          error={errors.password}
        />

        {role === "merchant" && (
          <>
            <Input
              label={t("auth.businessName")}
              placeholder={t("auth.businessName")}
              value={businessName}
              onChangeText={setBusinessName}
              leftIcon="briefcase"
              error={errors.businessName}
            />
            <Text style={[styles.catLabel, { color: colors.mutedForeground, fontFamily: "Inter_500Medium" }]}>
              {t("auth.businessCategory")}
            </Text>
            <View style={styles.catGrid}>
              {CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  onPress={() => setCategory(cat)}
                  style={[
                    styles.catBtn,
                    {
                      borderRadius: colors.radius,
                      borderColor: category === cat ? colors.primary : colors.border,
                      backgroundColor: category === cat ? colors.accent : colors.card,
                      borderWidth: category === cat ? 2 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.catText,
                      {
                        color: category === cat ? colors.primary : colors.mutedForeground,
                        fontFamily: category === cat ? "Inter_600SemiBold" : "Inter_400Regular",
                      },
                    ]}
                  >
                    {t(`auth.categories.${cat}` as any)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}

        <Button
          title={t("auth.register")}
          onPress={handleRegister}
          loading={loading}
          size="lg"
          style={styles.btn}
        />

        <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
          <Text style={[styles.loginText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("auth.haveAccount")}{" "}
            <Text style={{ color: colors.primary, fontFamily: "Inter_600SemiBold" }}>
              {t("auth.login")}
            </Text>
          </Text>
        </TouchableOpacity>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: Platform.OS === "web" ? 80 : 60 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 32, gap: 12 },
  backBtn: { padding: 4 },
  title: { fontSize: 24, flex: 1 },
  row2: { flexDirection: "row", gap: 12 },
  catLabel: { fontSize: 13, marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  catBtn: { paddingHorizontal: 14, paddingVertical: 8 },
  catText: { fontSize: 13 },
  btn: { marginTop: 8 },
  loginLink: { alignItems: "center", marginTop: 20, marginBottom: 20 },
  loginText: { fontSize: 15 },
});
