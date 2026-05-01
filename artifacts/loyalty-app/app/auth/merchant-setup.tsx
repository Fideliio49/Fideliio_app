import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  ScrollView,
} from "react-native";
import { fs, iconSize } from "@/utils/responsive";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { FideliioLogo } from "@/components/FideliioLogo";
import { supabase } from "@/lib/supabase";

const CATEGORIES = [
  { key: "restaurant", icon: "coffee" },
  { key: "clothing", icon: "shopping-bag" },
  { key: "hairSalon", icon: "scissors" },
  { key: "hotel", icon: "home" },
  { key: "other", icon: "star" },
] as const;

export default function MerchantSetupScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useApp();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("restaurant");
  const [loading, setLoading] = useState(false);

  async function handleSetup() {
    if (!businessName.trim()) {
      Alert.alert("Erreur", "Veuillez entrer le nom de votre commerce.");
      return;
    }
    setLoading(true);
    try {
      if (!user?.id) throw new Error("Utilisateur non connecté");

      // Mettre à jour le profil merchant
      const { error } = await supabase
        .from("merchants")
        .update({
          business_name: businessName.trim(),
          category,
        })
        .eq("user_id", user.id);

      if (error) throw error;

      router.replace("/(merchant)/home");
    } catch (e: any) {
      Alert.alert("Erreur", e.message || "Impossible de sauvegarder.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: "#fff", paddingTop: topPad },
      ]}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <FideliioLogo size={52} />
          <Text
            style={[
              styles.title,
              { color: colors.foreground, fontFamily: "Inter_700Bold" },
            ]}
          >
            {t("auth.registerMerchant")}
          </Text>
          <Text
            style={[
              styles.subtitle,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            {t("language") === "ar"
              ? "أخبرنا عن متجرك"
              : "Parlez-nous de votre commerce"}
          </Text>
        </View>

        {/* Nom du commerce */}
        <Input
          label={t("auth.businessName")}
          placeholder={t("auth.businessName")}
          value={businessName}
          onChangeText={setBusinessName}
          leftIcon="briefcase"
        />

        {/* Catégorie */}
        <Text
          style={[
            styles.catLabel,
            { color: colors.mutedForeground, fontFamily: "Inter_500Medium" },
          ]}
        >
          {t("auth.businessCategory")}
        </Text>
        <View style={styles.catGrid}>
          {CATEGORIES.map(({ key, icon }) => {
            const isSelected = category === key;
            return (
              <TouchableOpacity
                key={key}
                onPress={() => setCategory(key)}
                style={[
                  styles.catCard,
                  {
                    borderColor: isSelected ? "#2C3E8C" : colors.border,
                    backgroundColor: isSelected
                      ? "#2C3E8C12"
                      : colors.background,
                    borderWidth: isSelected ? 2 : 1,
                  },
                ]}
              >
                <Feather
                  name={icon as any}
                  size={22}
                  color={isSelected ? "#2C3E8C" : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.catText,
                    {
                      color: isSelected ? "#2C3E8C" : colors.mutedForeground,
                      fontFamily: isSelected
                        ? "Inter_600SemiBold"
                        : "Inter_400Regular",
                    },
                  ]}
                >
                  {t(`auth.categories.${key}` as any)}
                </Text>
                {isSelected && (
                  <View style={styles.catCheck}>
                    <Feather name="check" size={iconSize(12)} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Info */}
        <View
          style={[
            styles.infoBanner,
            { backgroundColor: "#2C3E8C12", borderColor: "#2C3E8C30" },
          ]}
        >
          <Feather name="info" size={iconSize(14)} color="#2C3E8C" />
          <Text
            style={[
              styles.infoText,
              { color: "#2C3E8C", fontFamily: "Inter_400Regular" },
            ]}
          >
            {t("language") === "ar"
              ? "سيتم إنشاء حساب عميل تلقائياً مع حسابك التجاري"
              : "Un compte client a été créé automatiquement avec votre compte commerçant"}
          </Text>
        </View>

        {/* CTA */}
        <TouchableOpacity
          onPress={handleSetup}
          activeOpacity={0.88}
          disabled={loading}
          style={{ marginTop: 8 }}
        >
          <LinearGradient
            colors={["#2C3E8C", "#00B4D8"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.ctaBtn, { borderRadius: colors.radius }]}
          >
            <Text style={[styles.ctaText, { fontFamily: "Inter_700Bold" }]}>
              {loading ? t("common.loading") : t("common.save") + " →"}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 60 },
  header: { alignItems: "center", gap: 10, marginBottom: 32 },
  title: { fontSize: fs(24), textAlign: "center" },
  subtitle: { fontSize: fs(14), textAlign: "center" },
  catLabel: { fontSize: fs(13), marginBottom: 12, marginTop: 8 },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 20,
  },
  catCard: {
    width: "47%",
    padding: 14,
    borderRadius: 12,
    alignItems: "center",
    gap: 8,
    position: "relative",
  },
  catText: { fontSize: fs(13), textAlign: "center" },
  catCheck: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2C3E8C",
    alignItems: "center",
    justifyContent: "center",
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  infoText: { fontSize: fs(12), flex: 1, lineHeight: 18 },
  ctaBtn: { paddingVertical: 16, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: fs(16) },
});
