import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
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
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function LoginScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { role } = useLocalSearchParams<{ role: "customer" | "merchant" }>();
  const { setUser, language, completeOnboarding } = useApp();
  const { getCustomerByUserId, getMerchantByUserId, registerCustomer, registerMerchant } = useData();

  const [mode, setMode] = useState<"email" | "phone">("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  async function handleLogin() {
    const errs: Record<string, string> = {};
    if (mode === "email") {
      if (!email.trim()) errs.email = "Required";
      if (!password.trim()) errs.password = "Required";
    } else {
      if (!phone.trim()) errs.phone = "Required";
    }
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    setLoading(true);
    try {
      await new Promise((r) => setTimeout(r, 600));

      const userId = `user_${Date.now()}`;
      const mockUser = {
        id: userId,
        role: role as "customer" | "merchant",
        firstName: role === "merchant" ? "Merchant" : "Client",
        lastName: "Demo",
        email: mode === "email" ? email : undefined,
        phone: mode === "phone" ? phone : undefined,
        language,
        businessName: role === "merchant" ? "Mon Commerce" : undefined,
        businessCategory: role === "merchant" ? "restaurant" : undefined,
        pointsRate: role === "merchant" ? 1 : undefined,
        totalPoints: role === "customer" ? 250 : undefined,
      };

      if (role === "customer") {
        let cust = getCustomerByUserId(userId);
        if (!cust) {
          cust = await registerCustomer({
            userId,
            firstName: mockUser.firstName,
            lastName: mockUser.lastName,
            email: mockUser.email,
            phone: mockUser.phone,
            totalPoints: 250,
          });
        }
      } else {
        let merch = getMerchantByUserId(userId);
        if (!merch) {
          await registerMerchant({
            userId,
            businessName: "Mon Commerce",
            category: "restaurant",
            pointsRate: 1,
          });
        }
      }

      setUser(mockUser);
      await completeOnboarding();
    } catch (e) {
      Alert.alert("Error", "Login failed");
    } finally {
      setLoading(false);
    }
  }

  const isCustomer = role === "customer";

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
          <View style={[styles.avatarBox, { backgroundColor: isCustomer ? colors.purple100 : colors.green100 }]}>
            <Feather
              name={isCustomer ? "user" : "briefcase"}
              size={28}
              color={isCustomer ? colors.primary : colors.secondary}
            />
          </View>
          <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
            {t("auth.login")}
          </Text>
        </View>

        <View style={styles.tabRow}>
          <TouchableOpacity
            onPress={() => setMode("email")}
            style={[
              styles.tab,
              {
                borderBottomColor: mode === "email" ? colors.primary : "transparent",
                borderBottomWidth: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: mode === "email" ? colors.primary : colors.mutedForeground,
                  fontFamily: mode === "email" ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
            >
              Email
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setMode("phone")}
            style={[
              styles.tab,
              {
                borderBottomColor: mode === "phone" ? colors.primary : "transparent",
                borderBottomWidth: 2,
              },
            ]}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: mode === "phone" ? colors.primary : colors.mutedForeground,
                  fontFamily: mode === "phone" ? "Inter_600SemiBold" : "Inter_400Regular",
                },
              ]}
            >
              {t("auth.phone")}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.form}>
          {mode === "email" ? (
            <>
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
                label={t("auth.password")}
                placeholder="••••••••"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                leftIcon="lock"
                rightIcon={showPassword ? "eye-off" : "eye"}
                onRightIconPress={() => setShowPassword((v) => !v)}
                error={errors.password}
              />
              <TouchableOpacity style={styles.forgotBtn}>
                <Text style={[styles.forgotText, { color: colors.primary, fontFamily: "Inter_400Regular" }]}>
                  {t("auth.forgotPassword")}
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <Input
              label={t("auth.phone")}
              placeholder="+212 6XX XXX XXX"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              leftIcon="smartphone"
              error={errors.phone}
            />
          )}
        </View>

        <Button
          title={t("auth.login")}
          onPress={handleLogin}
          loading={loading}
          size="lg"
          style={styles.loginBtn}
        />

        <View style={styles.dividerRow}>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("common.or")}
          </Text>
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
        </View>

        <TouchableOpacity
          onPress={() => router.push(`/auth/register?role=${role}`)}
          style={styles.registerLink}
        >
          <Text style={[styles.registerText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
            {t("auth.noAccount")}{" "}
            <Text style={[{ color: colors.primary, fontFamily: "Inter_600SemiBold" }]}>
              {t("auth.register")}
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
  header: { alignItems: "center", marginBottom: 32, gap: 12 },
  backBtn: { position: "absolute", left: 0, top: 0 },
  avatarBox: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  title: { fontSize: 24 },
  tabRow: { flexDirection: "row", marginBottom: 24 },
  tab: { flex: 1, alignItems: "center", paddingBottom: 10 },
  tabText: { fontSize: 15 },
  form: { gap: 4 },
  forgotBtn: { alignSelf: "flex-end", marginBottom: 8 },
  forgotText: { fontSize: 14 },
  loginBtn: { marginTop: 8 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
    gap: 12,
  },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 14 },
  registerLink: { alignItems: "center" },
  registerText: { fontSize: 15, textAlign: "center" },
});
