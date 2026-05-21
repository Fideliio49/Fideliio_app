import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { Session } from "@supabase/supabase-js";
import i18n, { applyRTL } from "@/i18n";
import { supabase } from "@/lib/supabase";
import * as AuthLib from "@/lib/auth";
import { registerPushToken } from "@/lib/notifications";
import * as Device from "expo-device";
import * as Application from "expo-application";

export type Language = "fr" | "ar" | "en";
export type UserRole = "customer" | "merchant";
export type ColorTheme = "light" | "dark";

export const ACCENT_COLORS = [
  { key: "majorelleBlue", value: "#2D9CDB" },
  { key: "terracotta", value: "#C85A17" },
  { key: "gold", value: "#F9A602" },
  { key: "teal", value: "#00B4D8" },
  { key: "violet", value: "#7B2D8B" },
];

export interface User {
  id: string;
  role: UserRole;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  language: Language;
  businessName?: string;
  businessCategory?: string;
  pointsRate?: number;
  totalPoints?: number;
  logoUrl?: string;
}

interface AppContextType {
  user: User | null;
  language: Language;
  isRTL: boolean;
  isOnboarded: boolean;
  colorTheme: ColorTheme;
  accentColor: string;
  merchantAccentColor: string;
  setLanguage: (lang: Language) => Promise<void>;
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  completeOnboarding: () => Promise<void>;
  setColorTheme: (theme: ColorTheme) => Promise<void>;
  setAccentColor: (color: string) => Promise<void>;
  setMerchantAccentColor: (color: string) => Promise<void>;
  activeRole: "customer" | "merchant" | null;
  globalToastMsg: string;
  globalToastVisible: boolean;
  showGlobalToast: (msg: string) => void;
  onMerchantLogin: (userId: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  LANGUAGE: "@loyalty_language",
  ONBOARDED: "@loyalty_onboarded",
  CUSTOMER_THEME: "@customer_theme",
  ACCENT_COLOR: "@accent_color",
  MERCHANT_ACCENT_COLOR: "@merchant_accent_color",
  DEVICE_TOKEN: "@device_token",
};

const DEFAULT_ACCENT = "#C85A17";
const DEFAULT_MERCHANT_ACCENT = "#2D9CDB";

async function getOrCreateDeviceToken(): Promise<string> {
  try {
    let token = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
    if (!token) {
      const appId = Application.applicationId ?? "fideliio";
      const instId =
        (await Application.getIosIdForVendorAsync().catch(() => null)) ??
        Device.modelId ??
        Math.random().toString(36);
      token = `${appId}-${instId}-${Date.now()}`;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, token);
    }
    return token;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36)}`;
  }
}

function buildUserFromSession(
  session: Session,
  fallbackLanguage: Language,
): User {
  const meta = session.user.user_metadata ?? {};
  const firstName =
    meta.given_name ??
    meta.firstName ??
    meta.first_name ??
    (meta.full_name ?? meta.name ?? "").split(" ")[0] ??
    "";
  const lastName =
    meta.family_name ??
    meta.lastName ??
    meta.last_name ??
    (meta.full_name ?? meta.name ?? "").split(" ").slice(1).join(" ") ??
    "";
  const role = (meta.role ?? "customer") as UserRole;
  return {
    id: session.user.id,
    role,
    firstName,
    lastName,
    email: session.user.email,
    phone: session.user.phone,
    language: (meta.language ?? fallbackLanguage) as Language,
    businessName: meta.businessName ?? meta.business_name ?? undefined,
    businessCategory:
      meta.businessCategory ?? meta.business_category ?? undefined,
    pointsRate: meta.pointsRate ?? meta.points_rate ?? undefined,
    totalPoints: meta.totalPoints ?? meta.total_points ?? undefined,
    logoUrl: meta.logoUrl ?? meta.logo_url ?? undefined,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [activeRole, setActiveRole] = useState<"customer" | "merchant" | null>(
    null,
  );
  const [globalToastMsg, setGlobalToastMsg] = useState("");
  const [globalToastVisible, setGlobalToastVisible] = useState(false);
  const [language, setLanguageState] = useState<Language>("fr");
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>("light");
  const [accentColor, setAccentColorState] = useState(DEFAULT_ACCENT);
  const [merchantAccentColor, setMerchantAccentColorState] = useState(
    DEFAULT_MERCHANT_ACCENT,
  );

  const channelRef = useRef<any>(null);
  const globalToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionHandledRef = useRef(false);
  const currentUserRef = useRef<User | null>(null);

  const isRTL = language === "ar";

  useEffect(() => {
    return () => {
      if (globalToastTimer.current) clearTimeout(globalToastTimer.current);
    };
  }, []);

  // ── AppState listener — resynchronise quand l'app revient au premier plan ──
  // Utile quand le plan est activé depuis Supabase et que le merchant
  // revient sur l'app sans tuer le process.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" && currentUserRef.current) {
        // Rafraîchir le channel realtime si besoin
        setupRealtimeChannel(
          currentUserRef.current.id,
          currentUserRef.current.role,
        );
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    loadSettings().then((resolvedLang) => {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error?.message?.includes("Refresh Token Not Found")) {
          supabase.auth.signOut();
          setIsLoading(false);
          return;
        }
        if (session) {
          sessionHandledRef.current = true;
          const builtUser = buildUserFromSession(session, resolvedLang);
          setUserState(builtUser);
          currentUserRef.current = builtUser;
          setIsOnboarded(true);
          AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, "true");
          registerPushToken(builtUser.id, builtUser.role).catch(() => {});
          setupRealtimeChannel(session.user.id, builtUser.role);
        }
        setIsLoading(false);
      });
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        sessionHandledRef.current = true;

        const storedLang = (await AsyncStorage.getItem(
          STORAGE_KEYS.LANGUAGE,
        )) as Language | null;
        const builtUser = buildUserFromSession(session, storedLang ?? "fr");

        setUserState(builtUser);
        currentUserRef.current = builtUser;
        setIsOnboarded(true);
        AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, "true");

        if (_event === "TOKEN_REFRESHED" && !session) {
          await AsyncStorage.removeItem("@active_role");
          setUserState(null);
          currentUserRef.current = null;
          setActiveRole(null);
          return;
        }

        if (session) {
          registerPushToken(builtUser.id, builtUser.role).catch(() => {});
          setupRealtimeChannel(session.user.id, builtUser.role);
        }
      } else {
        sessionHandledRef.current = false;
        setUserState(null);
        currentUserRef.current = null;
        setActiveRole(null);
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // LOGIQUE SESSION DEVICE
  // ─────────────────────────────────────────────────────────────────────────
  async function onMerchantLogin(userId: string) {
    try {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!merchant) return;

      const { data: accessRaw } = await supabase.rpc("check_merchant_access", {
        p_merchant_id: merchant.id,
      });
      const acc = Array.isArray(accessRaw) ? accessRaw[0] : accessRaw;
      const plan = acc?.plan ?? "free";

      if (plan !== "pro" && plan !== "pro_plus") return;

      const deviceToken = await getOrCreateDeviceToken();

      if (plan === "pro") {
        await supabase
          .from("merchant_sessions")
          .delete()
          .eq("merchant_id", merchant.id)
          .neq("device_token", deviceToken);

        await supabase.from("merchant_sessions").upsert(
          {
            merchant_id: merchant.id,
            device_token: deviceToken,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "merchant_id,device_token" },
        );
        return;
      }

      if (plan === "pro_plus") {
        const { data: existing } = await supabase
          .from("merchant_sessions")
          .select("device_token")
          .eq("merchant_id", merchant.id)
          .eq("device_token", deviceToken)
          .maybeSingle();

        if (existing) {
          await supabase
            .from("merchant_sessions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("merchant_id", merchant.id)
            .eq("device_token", deviceToken);
          return;
        }

        const { data: checkRaw } = await supabase.rpc(
          "check_merchant_session",
          {
            p_merchant_id: merchant.id,
            p_device_token: deviceToken,
          },
        );
        const check = Array.isArray(checkRaw) ? checkRaw[0] : checkRaw;

        if (!check?.is_valid) {
          const maxAllowed = check?.max_allowed ?? acc?.max_stores ?? "?";
          showGlobalToast(
            `⚠️ Limite atteinte : ${maxAllowed} appareil(s) déjà connecté(s). Déconnectez un appareil pour continuer.`,
          );
          await supabase.auth.signOut();
          return;
        }

        await supabase.from("merchant_sessions").upsert(
          {
            merchant_id: merchant.id,
            device_token: deviceToken,
            last_seen_at: new Date().toISOString(),
          },
          { onConflict: "merchant_id,device_token" },
        );
      }
    } catch (e) {
      console.warn("onMerchantLogin error:", e);
    }
  }

  async function setupRealtimeChannel(userId: string, role: UserRole) {
    try {
      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      if (role === "customer") {
        const { data: cust } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!cust?.id) return;

        channelRef.current = supabase
          .channel(`global-tx-${cust.id}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "transactions",
              filter: `customer_id=eq.${cust.id}`,
            },
            (payload) => {
              const tx = payload.new as any;
              if (tx.points_earned > 0) {
                // ✅ Toast uniquement côté client — il reçoit les points
                showGlobalToast(
                  `+${tx.points_earned} pts chez ${tx.merchant_name} 🎉`,
                );
              }
            },
          )
          .subscribe();
      } else if (role === "merchant") {
        const { data: merchant } = await supabase
          .from("merchants")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();
        if (!merchant?.id) return;

        channelRef.current = supabase
          .channel(`merchant-tx-${merchant.id}-${Date.now()}`)
          .on(
            "postgres_changes",
            {
              event: "INSERT",
              schema: "public",
              table: "transactions",
              filter: `merchant_id=eq.${merchant.id}`,
            },
            (payload) => {
              const tx = payload.new as any;
              // FIX — Ne pas afficher de toast côté commerçant.
              // C'est lui qui valide la transaction depuis le scanner,
              // il voit déjà l'écran de succès. Le toast était la source
              // de la notification orange "+200 pts ajoutés 🎉" visible
              // sur l'écran du commerçant après validation.
              // Si un autre appareil valide (Pro+), on peut afficher
              // mais uniquement si la transaction date de moins de 10s.
              const age = Date.now() - new Date(tx.created_at).getTime();
              if (tx.points_earned > 0 && age > 10000) {
                // Transaction validée depuis un autre appareil (Pro+ multi-device)
                showGlobalToast(`+${tx.points_earned} pts ajoutés 🎉`);
              }
            },
          )
          .subscribe();
      }
    } catch (e) {
      console.warn("setupRealtimeChannel error:", e);
    }
  }

  async function loadSettings(): Promise<Language> {
    try {
      const [
        storedLang,
        storedOnboarded,
        storedTheme,
        storedAccent,
        storedMerchantAccent,
      ] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.LANGUAGE),
        AsyncStorage.getItem(STORAGE_KEYS.ONBOARDED),
        AsyncStorage.getItem(STORAGE_KEYS.CUSTOMER_THEME),
        AsyncStorage.getItem(STORAGE_KEYS.ACCENT_COLOR),
        AsyncStorage.getItem(STORAGE_KEYS.MERCHANT_ACCENT_COLOR),
        AsyncStorage.getItem("@active_role"),
      ]);

      let resolvedLang: Language = "fr";
      if (storedLang) {
        resolvedLang = storedLang as Language;
        setLanguageState(resolvedLang);
        i18n.changeLanguage(resolvedLang);
        applyRTL(resolvedLang);
      }
      if (storedOnboarded === "true") setIsOnboarded(true);
      if (storedTheme) setColorThemeState(storedTheme as ColorTheme);
      if (storedAccent) setAccentColorState(storedAccent);
      if (storedMerchantAccent)
        setMerchantAccentColorState(storedMerchantAccent);

      return resolvedLang;
    } catch {
      return "fr";
    }
  }

  async function setLanguage(lang: Language) {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    applyRTL(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  function setUser(newUser: User | null) {
    setUserState(newUser);
    currentUserRef.current = newUser;
  }

  function showGlobalToast(msg: string) {
    if (globalToastTimer.current) clearTimeout(globalToastTimer.current);
    setGlobalToastMsg(msg);
    setGlobalToastVisible(true);
    globalToastTimer.current = setTimeout(
      () => setGlobalToastVisible(false),
      4000,
    );
  }

  async function logout() {
    try {
      const deviceToken = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
      if (deviceToken) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          const { data: merchant } = await supabase
            .from("merchants")
            .select("id")
            .eq("user_id", session.user.id)
            .maybeSingle();
          if (merchant) {
            await supabase
              .from("merchant_sessions")
              .delete()
              .eq("merchant_id", merchant.id)
              .eq("device_token", deviceToken);
          }
        }
      }
    } catch {
      /* silencieux */
    }

    await AuthLib.logout();
    setUserState(null);
    currentUserRef.current = null;
    setActiveRole(null);
    sessionHandledRef.current = false;
    await AsyncStorage.removeItem("@active_role");
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  async function deleteAccount() {
    try {
      const deviceToken = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
      if (deviceToken && user) {
        const { data: merchant } = await supabase
          .from("merchants")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (merchant) {
          await supabase
            .from("merchant_sessions")
            .delete()
            .eq("merchant_id", merchant.id);
        }
      }
    } catch {
      /* silencieux */
    }

    if (user) {
      try {
        await AuthLib.deleteAccount(user.role);
      } catch {}
    }
    setUserState(null);
    currentUserRef.current = null;
    setIsOnboarded(false);
    setColorThemeState("light");
    setAccentColorState(DEFAULT_ACCENT);
    setMerchantAccentColorState(DEFAULT_MERCHANT_ACCENT);
    sessionHandledRef.current = false;
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    await AsyncStorage.clear();
  }

  async function completeOnboarding() {
    setIsOnboarded(true);
    await AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, "true");
  }

  async function setColorTheme(theme: ColorTheme) {
    setColorThemeState(theme);
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMER_THEME, theme);
  }

  async function setAccentColor(color: string) {
    setAccentColorState(color);
    await AsyncStorage.setItem(STORAGE_KEYS.ACCENT_COLOR, color);
  }

  async function setMerchantAccentColor(color: string) {
    setMerchantAccentColorState(color);
    await AsyncStorage.setItem(STORAGE_KEYS.MERCHANT_ACCENT_COLOR, color);
  }

  if (isLoading) return null;

  return (
    <AppContext.Provider
      value={{
        user,
        language,
        isRTL,
        isOnboarded,
        colorTheme,
        accentColor,
        merchantAccentColor,
        setLanguage,
        setUser,
        logout,
        deleteAccount,
        completeOnboarding,
        setColorTheme,
        setAccentColor,
        setMerchantAccentColor,
        activeRole,
        globalToastMsg,
        globalToastVisible,
        showGlobalToast,
        onMerchantLogin,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
