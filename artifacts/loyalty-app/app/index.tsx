import { Redirect } from "expo-router";
import { useApp } from "@/context/AppContext";

export default function Index() {
  const { user, isOnboarded, activeRole } = useApp();

  if (user) {
    // ✅ Utilisateur connecté avec un rôle actif → espace correspondant
    if (activeRole === "merchant") return <Redirect href="/(merchant)/home" />;
    if (activeRole === "customer") return <Redirect href="/(customer)/home" />;
    // Connecté mais pas de rôle → choisir le rôle
    return <Redirect href="/auth/role" />;
  }

  // Pas connecté
  if (!isOnboarded) return <Redirect href="/onboarding/language" />;

  // ✅ Onboardé mais pas connecté → page de login universelle
  return <Redirect href="/auth/login" />;
}
