import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useColors } from "@/hooks/useColors";
import type { Transaction } from "@/context/DataContext";

interface TransactionRowProps {
  transaction: Transaction;
  showCustomer?: boolean;
}

export function TransactionRow({ transaction, showCustomer = false }: TransactionRowProps) {
  const colors = useColors();
  const date = new Date(transaction.createdAt);
  const dateStr = `${date.getDate().toString().padStart(2, "0")}/${(date.getMonth() + 1).toString().padStart(2, "0")}`;

  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={[styles.iconBox, { backgroundColor: colors.green100, borderRadius: 8 }]}>
        <Feather name="trending-up" size={16} color={colors.secondary} />
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, { color: colors.foreground, fontFamily: "Inter_500Medium" }]}>
          {showCustomer ? (transaction.customerName ?? "Customer") : transaction.merchantName}
        </Text>
        <Text style={[styles.date, { color: colors.mutedForeground, fontFamily: "Inter_400Regular" }]}>
          {dateStr} · {transaction.amount} DH
        </Text>
      </View>
      <Text style={[styles.points, { color: colors.secondary, fontFamily: "Inter_700Bold" }]}>
        +{transaction.pointsEarned}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
  },
  iconBox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  name: {
    fontSize: 14,
  },
  date: {
    fontSize: 12,
  },
  points: {
    fontSize: 15,
  },
});
