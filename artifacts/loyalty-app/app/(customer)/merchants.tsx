import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  ScrollView,
  Image,
} from "react-native";
import { fs, iconSize, sp } from "@/utils/responsive";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useTranslation } from "react-i18next";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";

const CATS = ["all", "restaurant", "clothing", "hairSalon", "hotel", "other"];

const CAT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  restaurant: "coffee",
  clothing: "shopping-bag",
  hairSalon: "scissors",
  hotel: "home",
  other: "star",
};

// ✅ Composant avatar commerçant — affiche le logo ou les initiales
function MerchantAvatar({
  logoUrl,
  name,
  accentColor,
  size = 48,
}: {
  logoUrl?: string | null;
  name: string;
  accentColor: string;
  size?: number;
}) {
  const colors = useColors();
  const initial = (name?.[0] ?? "M").toUpperCase();

  if (logoUrl) {
    return (
      <Image
        source={{ uri: logoUrl }}
        style={{
          width: size,
          height: size,
          borderRadius: size * 0.25,
          borderWidth: 1,
          borderColor: accentColor + "30",
        }}
        resizeMode="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.25,
        backgroundColor: accentColor + "20",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: accentColor,
          fontSize: fs(size * 0.38),
          fontFamily: "Inter_700Bold",
        }}
      >
        {initial}
      </Text>
    </View>
  );
}

export default function MerchantsScreen() {
  const colors = useColors();
  const { user, language, accentColor } = useApp();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [merchants, setMerchants] = useState<any[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const CAT_LABELS: Record<string, string> = {
    all: t("merchants.all"),
    restaurant: t("auth.categories.restaurant"),
    clothing: t("auth.categories.clothing"),
    hairSalon: t("auth.categories.hairSalon"),
    hotel: t("auth.categories.hotel"),
    other: t("auth.categories.other"),
  };

  const visitLabel = (count: number) => {
    if (language === "ar") return `${count} زيارة`;
    if (language === "en") return `${count} visit${count > 1 ? "s" : ""}`;
    return `${count} visite${count > 1 ? "s" : ""}`;
  };

  useFocusEffect(
    useCallback(() => {
      loadMerchants();
    }, [user?.id]),
  );

  async function loadMerchants() {
    if (!user?.id) return;
    const { data: customerData } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .single();
    if (!customerData) return;

    // ✅ Récupérer aussi avatar_url depuis merchants via une jointure
    const { data: merchantPoints } = await supabase
      .from("customer_merchant_points")
      .select(
        "merchant_id, total_points, visit_count, last_visit, business_name, category, logo_url, points_rate",
      )
      .eq("customer_id", customerData.id);

    if (!merchantPoints) {
      setMerchants([]);
      return;
    }

    // ✅ Enrichir avec avatar_url depuis la table merchants
    const merchantIds = merchantPoints.map((m: any) => m.merchant_id);
    const { data: merchantDetails } = await supabase
      .from("merchants")
      .select("id, avatar_url")
      .in("id", merchantIds);

    const enriched = merchantPoints.map((m: any) => {
      const detail = merchantDetails?.find((d: any) => d.id === m.merchant_id);
      return { ...m, avatar_url: detail?.avatar_url ?? m.logo_url ?? null };
    });

    setMerchants(enriched);
  }

  const filtered = merchants.filter((m) => {
    const matchSearch =
      search.trim() === "" ||
      m.business_name.toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "all" || m.category === cat;
    return matchSearch && matchCat;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: topPad + 12,
            backgroundColor: colors.background,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.title,
            { color: colors.foreground, fontFamily: "Inter_700Bold" },
          ]}
        >
          {t("merchants.title")}
        </Text>
        <Input
          placeholder={t("merchants.search")}
          value={search}
          onChangeText={setSearch}
          leftIcon="search"
          containerStyle={{ marginBottom: 0, marginTop: 12 }}
        />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.catScroll}
          contentContainerStyle={styles.catContent}
        >
          {CATS.map((c) => (
            <TouchableOpacity
              key={c}
              onPress={() => setCat(c)}
              style={styles.catBtn}
            >
              <Badge
                label={CAT_LABELS[c] ?? c}
                variant={cat === c ? "purple" : "default"}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.merchant_id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => {
          // ✅ Mode bannière si logo, mode compact sinon
          const hasLogo = !!item.avatar_url;
          return hasLogo ? (
            // ── Mode bannière ──
            <Card
              style={[styles.merchantCard, { padding: 0, overflow: "hidden" }]}
            >
              <Image
                source={{ uri: item.avatar_url }}
                style={styles.bannerImage}
                resizeMode="cover"
              />
              <View style={styles.bannerContent}>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.merchantName,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {item.business_name}
                  </Text>
                  <Text
                    style={[
                      styles.merchantCategory,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {CAT_LABELS[item.category] ?? item.category} ·{" "}
                    {visitLabel(item.visit_count)}
                  </Text>
                </View>
                <View style={styles.merchantPoints}>
                  <Text
                    style={[
                      styles.pointsValue,
                      { color: "#F9A602", fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {item.total_points}
                  </Text>
                  <Text
                    style={[
                      styles.pointsLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {t("common.points").toLowerCase()}
                  </Text>
                </View>
              </View>
            </Card>
          ) : (
            // ── Mode compact ──
            <Card style={styles.merchantCard}>
              <View style={styles.merchantRow}>
                <MerchantAvatar
                  logoUrl={null}
                  name={item.business_name}
                  accentColor={accentColor}
                  size={48}
                />
                <View style={styles.merchantInfo}>
                  <Text
                    style={[
                      styles.merchantName,
                      { color: colors.foreground, fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {item.business_name}
                  </Text>
                  <Text
                    style={[
                      styles.merchantCategory,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {CAT_LABELS[item.category] ?? item.category}
                  </Text>
                  <Text
                    style={[
                      styles.merchantVisits,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {visitLabel(item.visit_count)}
                  </Text>
                </View>
                <View style={styles.merchantPoints}>
                  <Text
                    style={[
                      styles.pointsValue,
                      { color: "#F9A602", fontFamily: "Inter_700Bold" },
                    ]}
                  >
                    {item.total_points}
                  </Text>
                  <Text
                    style={[
                      styles.pointsLabel,
                      {
                        color: colors.mutedForeground,
                        fontFamily: "Inter_400Regular",
                      },
                    ]}
                  >
                    {t("common.points").toLowerCase()}
                  </Text>
                </View>
              </View>
            </Card>
          );
        }}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather
              name="map-pin"
              size={iconSize(40)}
              color={colors.mutedForeground}
            />
            <Text
              style={[
                styles.emptyText,
                {
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                },
              ]}
            >
              {search
                ? language === "ar"
                  ? "لا توجد نتائج"
                  : language === "en"
                    ? "No results"
                    : "Aucun résultat"
                : t("merchants.noMerchants")}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0, borderBottomWidth: 1 },
  title: { fontSize: fs(24) },
  catScroll: { marginTop: 8 },
  catContent: { paddingBottom: 12, gap: 8, paddingRight: 8 },
  catBtn: {},
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: fs(15), textAlign: "center" },
  merchantCard: { marginBottom: 10 },
  // ✅ Banner styles
  bannerImage: {
    width: "100%",
    height: 130,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  merchantRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  merchantInfo: { flex: 1, gap: 2 },
  merchantName: { fontSize: fs(15) },
  merchantCategory: { fontSize: fs(12) },
  merchantVisits: { fontSize: fs(11) },
  merchantPoints: { alignItems: "flex-end", gap: 2 },
  pointsValue: { fontSize: fs(20) },
  pointsLabel: { fontSize: fs(11) },
});
