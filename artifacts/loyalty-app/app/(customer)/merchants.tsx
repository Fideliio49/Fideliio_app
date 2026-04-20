import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { useApp } from "@/context/AppContext";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { supabase } from "@/lib/supabase";

const CATS = ["all", "restaurant", "clothing", "hairSalon", "hotel", "other"];

const CAT_LABELS: Record<string, string> = {
  all: "Tous",
  restaurant: "Restaurant",
  clothing: "Vêtements",
  hairSalon: "Coiffure",
  hotel: "Hôtel",
  other: "Autre",
};

const CAT_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  restaurant: "coffee",
  clothing: "shopping-bag",
  hairSalon: "scissors",
  hotel: "home",
  other: "star",
};

export default function MerchantsScreen() {
  const colors = useColors();
  const { user } = useApp();
  const insets = useSafeAreaInsets();

  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");
  const [merchants, setMerchants] = useState<any[]>([]);

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useFocusEffect(
    useCallback(() => {
      loadMerchants();
    }, [user?.id]),
  );

  async function loadMerchants() {
    if (!user?.id) return;

    // Trouver le customer
    const { data: customerData } = await supabase
      .from("customers")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!customerData) return;

    // Charger les merchants où le client a des transactions
    // avec les points du client chez chaque merchant
    const { data: merchantPoints } = await supabase
      .from("customer_merchant_points")
      .select(
        `
        merchant_id,
        total_points,
        visit_count,
        last_visit,
        business_name,
        category,
        logo_url,
        points_rate
      `,
      )
      .eq("customer_id", customerData.id);

    setMerchants(merchantPoints ?? []);
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
          Commerçants
        </Text>
        <Input
          placeholder="Rechercher..."
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
        renderItem={({ item }) => (
          <Card style={styles.merchantCard}>
            <View style={styles.merchantRow}>
              {/* Icône catégorie */}
              <View
                style={[
                  styles.merchantIcon,
                  { backgroundColor: colors.primary + "20" },
                ]}
              >
                <Feather
                  name={CAT_ICONS[item.category] ?? "star"}
                  size={22}
                  color={colors.primary}
                />
              </View>

              {/* Infos */}
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
                  {item.visit_count} visite{item.visit_count > 1 ? "s" : ""}
                </Text>
              </View>

              {/* Points */}
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
                  pts
                </Text>
                <Text
                  style={[
                    styles.rateLabel,
                    {
                      color: colors.mutedForeground,
                      fontFamily: "Inter_400Regular",
                    },
                  ]}
                >
                  {item.points_rate} pt/DH
                </Text>
              </View>
            </View>
          </Card>
        )}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="map-pin" size={40} color={colors.mutedForeground} />
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
                ? "Aucun résultat"
                : "Visitez un commerce pour le voir apparaître ici"}
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 0,
    borderBottomWidth: 1,
  },
  title: { fontSize: 24 },
  catScroll: { marginTop: 8 },
  catContent: { paddingBottom: 12, gap: 8, paddingRight: 8 },
  catBtn: {},
  list: { padding: 16 },
  empty: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 15, textAlign: "center" },
  merchantCard: { marginBottom: 10 },
  merchantRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  merchantIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  merchantInfo: { flex: 1, gap: 2 },
  merchantName: { fontSize: 15 },
  merchantCategory: { fontSize: 12 },
  merchantVisits: { fontSize: 11 },
  merchantPoints: { alignItems: "flex-end", gap: 2 },
  pointsValue: { fontSize: 20 },
  pointsLabel: { fontSize: 11 },
  rateLabel: { fontSize: 11 },
});
