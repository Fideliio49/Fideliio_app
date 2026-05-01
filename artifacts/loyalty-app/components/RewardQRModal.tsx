import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { useColors } from "@/hooks/useColors";

interface RewardQRModalProps {
  visible: boolean;
  reward: any | null;
  customer: any | null;
  onClose: () => void;
  onValidated?: () => void;
}

export function RewardQRModal({
  visible,
  reward,
  customer,
  onClose,
  onValidated,
}: RewardQRModalProps) {
  const { accentColor } = useApp();
  const colors = useColors();

  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [tokenExpiry, setTokenExpiry] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(120);
  const [generating, setGenerating] = useState(false);

  const toastOpacity = useRef(new Animated.Value(0)).current;
  const [toastMsg, setToastMsg] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showToast(msg: string) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToastMsg(msg);
    setToastVisible(true);
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.delay(2500),
      Animated.timing(toastOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start(() => setToastVisible(false));
  }

  // Générer le token dès que le modal s'ouvre
  useEffect(() => {
    if (visible && reward && customer) {
      generateToken();
    }
    if (!visible) {
      setActiveToken(null);
      setTokenExpiry(null);
      setCountdown(120);
    }
  }, [visible, reward?.id]);

  // Countdown timer
  useEffect(() => {
    if (!visible || !tokenExpiry) return;
    const interval = setInterval(() => {
      const remaining = Math.max(
        0,
        Math.floor((tokenExpiry.getTime() - Date.now()) / 1000),
      );
      setCountdown(remaining);
      if (remaining === 0) {
        setActiveToken(null);
        showToast("⏱ QR code expiré. Ferme et réessaie.");
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, tokenExpiry]);

  // Realtime — fermer quand merchant valide
  useEffect(() => {
    if (!activeToken || !visible) return;
    const channel = supabase
      .channel(`reward-qr-${activeToken}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "redemption_tokens",
          filter: `token=eq.${activeToken}`,
        },
        (payload) => {
          if (payload.new?.used_at) {
            showToast("🎁 Récompense validée ! Appliquée avec succès.");
            setTimeout(() => {
              onClose();
              onValidated?.();
            }, 2000);
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activeToken, visible]);

  async function generateToken() {
    if (!customer || !reward) return;
    setGenerating(true);
    try {
      // Vérifier le solde actuel
      const { data: currentPoints } = await supabase
        .from("customer_merchant_points")
        .select("total_points")
        .eq("customer_id", customer.id)
        .eq("merchant_id", reward.merchant_id)
        .maybeSingle();

      const solde = Math.max(0, currentPoints?.total_points ?? 0);
      if (solde < reward.points_required) {
        Alert.alert(
          "Points insuffisants",
          `Il vous faut ${reward.points_required} pts.\nVous avez ${solde} pts.`,
        );
        onClose();
        return;
      }

      const { nanoid } = await import("nanoid/non-secure");
      const token = `REDEEM-${nanoid(16).toUpperCase()}`;
      const expiresAt = new Date(Date.now() + 2 * 60 * 1000);

      // Supprimer anciens tokens non utilisés
      await supabase
        .from("redemption_tokens")
        .delete()
        .eq("customer_id", customer.id)
        .eq("reward_id", reward.id)
        .is("used_at", null);

      const { error } = await supabase.from("redemption_tokens").insert({
        id: nanoid(),
        customer_id: customer.id,
        reward_id: reward.id,
        merchant_id: reward.merchant_id,
        token,
        expires_at: expiresAt.toISOString(),
      });
      if (error) throw error;

      setActiveToken(token);
      setTokenExpiry(expiresAt);
      setCountdown(120);
    } catch (err: any) {
      Alert.alert("Erreur", err.message || "Impossible de générer le QR code.");
      onClose();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.handle} />

          {/* Header */}
          <View style={styles.header}>
            <Text
              style={[
                styles.title,
                { color: colors.foreground, fontFamily: "Inter_700Bold" },
              ]}
            >
              QR Code récompense
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={22} color={colors.mutedForeground} />
            </TouchableOpacity>
          </View>

          {/* Reward info */}
          {reward && (
            <View
              style={[
                styles.rewardInfo,
                { backgroundColor: accentColor + "15", borderRadius: 12 },
              ]}
            >
              <Text
                style={[
                  styles.rewardName,
                  { color: accentColor, fontFamily: "Inter_700Bold" },
                ]}
              >
                {reward.name}
              </Text>
              <Text
                style={[
                  styles.rewardSub,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                {reward.merchant_name ?? reward.merchant_name_label} ·{" "}
                {reward.points_required} pts
              </Text>
            </View>
          )}

          {/* QR Code */}
          {generating ? (
            <View style={styles.qrPlaceholder}>
              <Text
                style={{
                  color: colors.mutedForeground,
                  fontFamily: "Inter_400Regular",
                }}
              >
                Génération en cours...
              </Text>
            </View>
          ) : activeToken ? (
            <View style={styles.qrContainer}>
              <View style={styles.qrWrap}>
                <QRCode
                  value={activeToken}
                  size={200}
                  color="#1a1a2e"
                  backgroundColor="white"
                />
              </View>
              <Text
                style={[
                  styles.qrHint,
                  {
                    color: colors.mutedForeground,
                    fontFamily: "Inter_400Regular",
                  },
                ]}
              >
                Présentez ce QR code au commerçant
              </Text>
            </View>
          ) : (
            <View style={styles.qrPlaceholder}>
              <Text
                style={{ color: "#E74C3C", fontFamily: "Inter_400Regular" }}
              >
                QR code expiré
              </Text>
            </View>
          )}

          {/* Countdown */}
          {activeToken && (
            <View
              style={[
                styles.countdownWrap,
                {
                  backgroundColor:
                    countdown <= 30 ? "#E74C3C15" : accentColor + "15",
                },
              ]}
            >
              <Feather
                name="clock"
                size={16}
                color={countdown <= 30 ? "#E74C3C" : accentColor}
              />
              <Text
                style={[
                  styles.countdownText,
                  {
                    color: countdown <= 30 ? "#E74C3C" : accentColor,
                    fontFamily: "Inter_700Bold",
                  },
                ]}
              >
                Expire dans {Math.floor(countdown / 60)}:
                {String(countdown % 60).padStart(2, "0")}
              </Text>
            </View>
          )}

          <Text
            style={[
              styles.secNote,
              { color: colors.mutedForeground, fontFamily: "Inter_400Regular" },
            ]}
          >
            🔒 Ce code est unique et valable une seule fois
          </Text>

          {/* Toast interne */}
          {toastVisible && (
            <Animated.View
              style={[
                styles.toast,
                { backgroundColor: "#27AE60", opacity: toastOpacity },
              ]}
            >
              <Feather name="check-circle" size={16} color="#fff" />
              <Text
                style={[styles.toastText, { fontFamily: "Inter_600SemiBold" }]}
              >
                {toastMsg}
              </Text>
            </Animated.View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E0E0E0",
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  title: { fontSize: 18 },
  rewardInfo: { padding: 14, marginBottom: 20, alignItems: "center" },
  rewardName: { fontSize: 16 },
  rewardSub: { fontSize: 13, marginTop: 4 },
  qrContainer: { alignItems: "center", gap: 12, marginBottom: 20 },
  qrPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    height: 200,
    marginBottom: 20,
  },
  qrWrap: {
    padding: 16,
    backgroundColor: "white",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  qrHint: { fontSize: 13, textAlign: "center" },
  countdownWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    justifyContent: "center",
  },
  countdownText: { fontSize: 16 },
  secNote: { fontSize: 12, textAlign: "center" },
  toast: {
    position: "absolute",
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 14,
    borderRadius: 12,
    elevation: 8,
  },
  toastText: { color: "#fff", fontSize: 13, flex: 1 },
});
