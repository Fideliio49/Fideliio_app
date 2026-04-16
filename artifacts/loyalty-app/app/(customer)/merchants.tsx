import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
} from "react-native";
import { useTranslation } from "react-i18next";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useData } from "@/context/DataContext";
import { Input } from "@/components/ui/Input";
import { MerchantCard } from "@/components/MerchantCard";
import { Badge } from "@/components/ui/Badge";
import { TouchableOpacity, ScrollView } from "react-native";

const CATS = ["all", "restaurant", "clothing", "hairSalon", "hotel", "other"];

export default function MerchantsScreen() {
  const colors = useColors();
  const { t } = useTranslation();
  const { merchants } = useData();
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [cat, setCat] = useState("all");

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = merchants.filter((m) => {
    const matchSearch =
      search.trim() === "" ||
      m.businessName.toLowerCase().includes(search.toLowerCase());
    const matchCat = cat === "all" || m.category === cat;
    return matchSearch && matchCat;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad + 12, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.foreground, fontFamily: "Inter_700Bold" }]}>
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
            <TouchableOpacity key={c} onPress={() => setCat(c)} style={styles.catBtn}>
              <Badge
                label={c === "all" ? t("merchants.all") : t(`auth.categories.${c}` as any, { defaultValue: c })}
                variant={cat === c ? "purple" : "default"}
              />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(m) => m.id}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <MerchantCard merchant={item} />}
        contentContainerStyle={[styles.list, { paddingBottom: 100 }]}
        scrollEnabled={filtered.length > 0}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="map-pin" size={40} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
              {t("merchants.noMerchants")}
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
  emptyText: { fontSize: 15 },
});
