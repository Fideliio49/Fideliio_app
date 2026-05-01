import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Transaction } from "@/context/DataContext";
import { fs } from "@/utils/responsive";

interface TransactionRowProps {
  transaction: Transaction;
  showCustomer?: boolean;
  isRTL?: boolean;
}

export function TransactionRow({
  transaction,
  showCustomer = false,
  isRTL = false,
}: TransactionRowProps) {
  const colors = useColors();

  const date = new Date(transaction.createdAt);
  const dateStr = `${date.getDate().toString().padStart(2, "0")}/${(
    date.getMonth() + 1
  )
    .toString()
    .padStart(2, "0")}`;

  const pts = transaction.pointsEarned;
  const isNegative = pts < 0;
  const isZero = pts === 0;

  const ptsLabel = isZero ? "0" : isNegative ? `${pts}` : `+${pts}`;
  const ptsColor = isNegative
    ? "#E74C3C"
    : isZero
      ? colors.mutedForeground
      : "#F9A602";
  const dotColor = isNegative ? "#E74C3C" : "#F9A602";

  const rowDir = isRTL ? "row-reverse" : "row";
  const textAlign = isRTL ? "right" : "left";

  return (
    <View
      style={[
        styles.row,
        { borderBottomColor: colors.border, flexDirection: rowDir },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <View style={styles.info}>
        <Text
          allowFontScaling={false}
          style={[
            styles.name,
            {
              color: colors.foreground,
              fontFamily: "Inter_600SemiBold",
              textAlign,
            },
          ]}
        >
          {showCustomer
            ? (transaction.customerName ?? "Customer")
            : transaction.merchantName}
        </Text>
        <Text
          allowFontScaling={false}
          style={[
            styles.date,
            {
              color: colors.mutedForeground,
              fontFamily: "Inter_400Regular",
              textAlign,
            },
          ]}
        >
          {dateStr} · {transaction.amount} DH
        </Text>
      </View>
      <Text
        allowFontScaling={false}
        style={[
          styles.points,
          { color: ptsColor, fontFamily: "Inter_700Bold" },
        ]}
      >
        {ptsLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  info: { flex: 1, gap: 2 },
  name: { fontSize: fs(14) },
  date: { fontSize: fs(12) },
  points: { fontSize: fs(15) },
});
