import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { supabase } from "./supabase";

// ── Config affichage des notifications reçues ─────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// ── Enregistrer le token push du user ─────────────────────
export async function registerPushToken(
  userId: string,
  role: "customer" | "merchant",
) {
  // Expo push ne fonctionne que sur device physique
  if (!Device.isDevice) return;
  if (Platform.OS === "web") return;

  // Demander la permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") return;

  // Configurer le channel Android
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("fideliio", {
      name: "Fideliio",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#C85A17",
    });
  }

  // Récupérer le token Expo
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID, // à ajouter dans .env
  });
  const token = tokenData.data;
  if (!token) return;

  // Sauvegarder le token dans la bonne table
  const table = role === "customer" ? "customers" : "merchants";
  await supabase
    .from(table)
    .update({ push_token: token })
    .eq("user_id", userId);
}

// ── Envoyer une notification push via Expo Push API ───────
export async function sendPushNotification({
  token,
  title,
  body,
  data = {},
}: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}) {
  if (!token || !token.startsWith("ExponentPushToken")) return;

  await fetch("https://exp.host/--/api/v2/push/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
    },
    body: JSON.stringify({
      to: token,
      title,
      body,
      data,
      sound: "default",
      priority: "high",
    }),
  });
}

// ── Envoyer notif au client après validation points ───────
export async function notifyCustomerPointsAdded({
  customerId,
  merchantName,
  points,
}: {
  customerId: string;
  merchantName: string;
  points: number;
}) {
  // Récupérer le token du client
  const { data: customer } = await supabase
    .from("customers")
    .select("push_token, first_name")
    .eq("id", customerId)
    .maybeSingle();

  if (!customer?.push_token) return;

  await sendPushNotification({
    token: customer.push_token,
    title: `+${points} points 🎉`,
    body: `Vous venez de gagner ${points} points chez ${merchantName} !`,
    data: { type: "points_earned", points, merchantName },
  });
}
