import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";

export default function Index() {
  const { user, isOnboarded } = useApp();

  // ── Si l'user est connecté, on le redirige directement
  // peu importe si isOnboarded est true ou false
  // (la session Supabase est persistée via SecureStore/localStorage)
  if (user) {
    if (user.role === "merchant") {
      return <Redirect href="/(merchant)/home" />;
    }
    return <Redirect href="/(customer)/home" />;
  }

  // ── Pas de session active ──
  // Si pas encore onboardé → onboarding
  if (!isOnboarded) {
    return <Redirect href="/onboarding/language" />;
  }

  // ── Onboardé mais pas connecté → login
  return <Redirect href="/auth/role" />;
}
