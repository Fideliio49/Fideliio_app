import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  { key: "terracotta",    value: "#C85A17" },
  { key: "gold",          value: "#F9A602" },
  { key: "teal",          value: "#00B4D8" },
  { key: "violet",        value: "#7B2D8B" },
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEYS = {
  LANGUAGE:              "@loyalty_language",
  ONBOARDED:             "@loyalty_onboarded",
  CUSTOMER_THEME:        "@customer_theme",
  ACCENT_COLOR:          "@accent_color",
  MERCHANT_ACCENT_COLOR: "@merchant_accent_color",
  DEVICE_TOKEN:          "@device_token",
};

const DEFAULT_ACCENT          = "#C85A17";
const DEFAULT_MERCHANT_ACCENT = "#2D9CDB";

// ✅ Générer un token unique par installation d'app
async function getOrCreateDeviceToken(): Promise<string> {
  try {
    let token = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
    if (!token) {
      const appId  = Application.applicationId ?? "fideliio";
      const instId = await Application.getIosIdForVendorAsync().catch(() => null)
                  ?? Device.modelId
                  ?? Math.random().toString(36);
      token = `${appId}-${instId}-${Date.now()}`;
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_TOKEN, token);
    }
    return token;
  } catch {
    return `device-${Date.now()}-${Math.random().toString(36)}`;
  }
}

function buildUserFromSession(session: Session, fallbackLanguage: Language): User {
  const meta = session.user.user_metadata ?? {};
  const firstName =
    meta.given_name ?? meta.firstName ?? meta.first_name ??
    (meta.full_name ?? meta.name ?? "").split(" ")[0] ?? "";
  const lastName =
    meta.family_name ?? meta.lastName ?? meta.last_name ??
    (meta.full_name ?? meta.name ?? "").split(" ").slice(1).join(" ") ?? "";
  const role = (meta.role ?? "customer") as UserRole;
  return {
    id: session.user.id,
    role,
    firstName,
    lastName,
    email: session.user.email,
    phone: session.user.phone,
    language: (meta.language ?? fallbackLanguage) as Language,
    businessName:     meta.businessName     ?? meta.business_name     ?? undefined,
    businessCategory: meta.businessCategory ?? meta.business_category ?? undefined,
    pointsRate:  meta.pointsRate  ?? meta.points_rate  ?? undefined,
    totalPoints: meta.totalPoints ?? meta.total_points ?? undefined,
    logoUrl:     meta.logoUrl     ?? meta.logo_url     ?? undefined,
  };
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUserState]                     = useState<User | null>(null);
  const [activeRole, setActiveRole]              = useState<"customer" | "merchant" | null>(null);
  const [globalToastMsg, setGlobalToastMsg]      = useState("");
  const [globalToastVisible, setGlobalToastVisible] = useState(false);
  const [language, setLanguageState]             = useState<Language>("fr");
  const [isOnboarded, setIsOnboarded]            = useState(false);
  const [isLoading, setIsLoading]                = useState(true);
  const [colorTheme, setColorThemeState]         = useState<ColorTheme>("light");
  const [accentColor, setAccentColorState]       = useState(DEFAULT_ACCENT);
  const [merchantAccentColor, setMerchantAccentColorState] = useState(DEFAULT_MERCHANT_ACCENT);

  const channelRef      = useRef<any>(null);
  const sessionCheckRef = useRef<ReturnType<typeof setInterval> | null>(null); // ✅ session unique Pro
  const globalToastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRTL = language === "ar";

  useEffect(() => {
    loadSettings().then((resolvedLang) => {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const builtUser = buildUserFromSession(session, resolvedLang);
          setUserState(builtUser);
          setIsOnboarded(true);
          AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, "true");
          registerPushToken(builtUser.id, builtUser.role).catch(() => {});
          setupRealtimeChannel(session.user.id);
        }
        setIsLoading(false);
      });
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setUserState((prev) => buildUserFromSession(session, prev ? prev.language : "fr"));
        setIsOnboarded(true);
        AsyncStorage.setItem(STORAGE_KEYS.ONBOARDED, "true");
        AsyncStorage.getItem("@active_role").then((r) => {
          if (r) setActiveRole(r as "customer" | "merchant");
        });
      } else {
        setUserState(null);
        setActiveRole(null);
        stopSessionCheck();
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current);
          channelRef.current = null;
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      stopSessionCheck();
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  // ✅ Enregistrer la session device pour plan Pro (session unique)
  async function registerMerchantSession(merchantId: string) {
    try {
      const deviceToken = await getOrCreateDeviceToken();
      await supabase.from("merchant_sessions").upsert({
        merchant_id  : merchantId,
        device_token : deviceToken,
        last_seen_at : new Date().toISOString(),
      }, { onConflict: "merchant_id" });
    } catch (e) {
      console.warn("registerMerchantSession error:", e);
    }
  }

  // ✅ Vérifier si ce device est toujours la session active (plan Pro)
  async function checkMerchantSession(merchantId: string): Promise<boolean> {
    try {
      const deviceToken = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_TOKEN);
      if (!deviceToken) return true; // pas encore de token → laisser passer

      const { data } = await supabase
        .from("merchant_sessions")
        .select("device_token")
        .eq("merchant_id", merchantId)
        .maybeSingle();

      if (!data) return true; // pas de session enregistrée → OK
      return data.device_token === deviceToken;
    } catch {
      return true; // en cas d'erreur réseau → ne pas déconnecter
    }
  }

  // ✅ Démarrer la vérification périodique de session (toutes les 30s)
  function startSessionCheck(merchantId: string, plan: string) {
    if (plan !== "pro") return; // uniquement pour le plan Pro
    stopSessionCheck();
    sessionCheckRef.current = setInterval(async () => {
      const isValid = await checkMerchantSession(merchantId);
      if (!isValid) {
        console.warn("Session invalidée — autre device connecté");
        stopSessionCheck();
        await supabase.auth.signOut();
        showGlobalToast("⚠️ Votre session a été ouverte sur un autre appareil.");
      }
    }, 30000); // vérifier toutes les 30 secondes
  }

  function stopSessionCheck() {
    if (sessionCheckRef.current) {
      clearInterval(sessionCheckRef.current);
      sessionCheckRef.current = null;
    }
  }

  // ✅ Appeler quand le merchant se connecte en mode marchand
  async function onMerchantLogin(userId: string) {
    try {
      const { data: merchant } = await supabase
        .from("merchants")
        .select("id, plan")
        .eq("user_id", userId)
        .maybeSingle();

      if (!merchant) return;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan, status")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const activePlan = sub?.plan ?? "free";

      if (activePlan === "pro") {
        // ✅ Enregistrer ce device comme session active
        await registerMerchantSession(merchant.id);
        // ✅ Démarrer la vérification périodique
        startSessionCheck(merchant.id, "pro");
      }
    } catch (e) {
      console.warn("onMerchantLogin error:", e);
    }
  }

  async function setupRealtimeChannel(userId: string) {
    try {
      const { data: cust } = await supabase
        .from("customers").select("id").eq("user_id", userId).maybeSingle();
      if (!cust?.id) return;

      if (channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }

      channelRef.current = supabase
        .channel(`global-tx-${cust.id}-${Date.now()}`)
        .on("postgres_changes", {
          event: "INSERT", schema: "public",
          table: "transactions", filter: `customer_id=eq.${cust.id}`,
        }, (payload) => {
          const tx = payload.new as any;
          if (tx.points_earned > 0) {
            showGlobalToast(`+${tx.points_earned} pts chez ${tx.merchant_name} 🎉`);
          }
        }).subscribe();
    } catch (e) {
      console.warn("setupRealtimeChannel error:", e);
    }
  }

  async function loadSettings(): Promise<Language> {
    try {
      const [
        storedLang, storedOnboarded, storedTheme,
        storedAccent, storedMerchantAccent, storedActiveRole,
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
      if (storedActiveRole) setActiveRole(storedActiveRole as "customer" | "merchant");
      if (storedTheme) setColorThemeState(storedTheme as ColorTheme);
      if (storedAccent) setAccentColorState(storedAccent);
      if (storedMerchantAccent) setMerchantAccentColorState(storedMerchantAccent);

      return resolvedLang;
    } catch (e) {
      console.warn("Error loading settings:", e);
      return "fr";
    }
  }

  async function setLanguage(lang: Language) {
    setLanguageState(lang);
    await i18n.changeLanguage(lang);
    applyRTL(lang);
    await AsyncStorage.setItem(STORAGE_KEYS.LANGUAGE, lang);
  }

  function setUser(newUser: User | null) { setUserState(newUser); }

  function showGlobalToast(msg: string) {
    if (globalToastTimer.current) clearTimeout(globalToastTimer.current);
    setGlobalToastMsg(msg);
    setGlobalToastVisible(true);
    globalToastTimer.current = setTimeout(() => setGlobalToastVisible(false), 3500);
  }

  async function logout() {
    stopSessionCheck();
    await AuthLib.logout();
    setUserState(null);
    setActiveRole(null);
    await AsyncStorage.removeItem("@active_role");
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }

  async function deleteAccount() {
    stopSessionCheck();
    if (user) {
      try { await AuthLib.deleteAccount(user.role); } catch (e) { console.warn("deleteAccount error:", e); }
    }
    setUserState(null);
    setIsOnboarded(false);
    setColorThemeState("light");
    setAccentColorState(DEFAULT_ACCENT);
    setMerchantAccentColorState(DEFAULT_MERCHANT_ACCENT);
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
    <AppContext.Provider value={{
      user, language, isRTL, isOnboarded, colorTheme,
      accentColor, merchantAccentColor, setLanguage, setUser,
      logout, deleteAccount, completeOnboarding, setColorTheme,
      setAccentColor, setMerchantAccentColor, activeRole,
      globalToastMsg, globalToastVisible, showGlobalToast,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}