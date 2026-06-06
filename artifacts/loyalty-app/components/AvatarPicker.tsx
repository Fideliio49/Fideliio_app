import React, { useState } from "react";
import {
  View,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Text,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Feather } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import * as FileSystem from "expo-file-system/legacy";
import { useColors } from "@/hooks/useColors";
import { fs, iconSize, sp } from "@/utils/responsive";

interface AvatarPickerProps {
  userId: string;
  currentUrl?: string | null;
  size?: number;
  initials?: string;
  accentColor?: string;
  bucket?: "avatars"; // extensible
  folder?: string; // "customer" | "merchant"
  onUploaded?: (url: string) => void;
  editable?: boolean;
}

export function AvatarPicker({
  userId,
  currentUrl,
  size = 80,
  initials = "?",
  accentColor = "#C85A17",
  bucket = "avatars",
  folder = "customer",
  onUploaded,
  editable = true,
}: AvatarPickerProps) {
  const colors = useColors();
  const [uploading, setUploading] = useState(false);
  const [localUrl, setLocalUrl] = useState<string | null>(currentUrl ?? null);

  const displayUrl = localUrl ?? currentUrl ?? null;

  async function deleteImage() {
    try {
      setUploading(true);
      const filePath = `${userId}/${folder}/avatar.jpg`;
      await supabase.storage.from(bucket).remove([filePath]);
      setLocalUrl(null);
      onUploaded?.("");
    } catch (e: any) {
      Alert.alert("Erreur", e?.message || "Suppression échouée.");
    } finally {
      setUploading(false);
    }
  }

  async function handlePick() {
    if (!editable) return;

    const buttons: any[] = [
      { text: "📷 Appareil photo", onPress: () => pickImage("camera") },
      { text: "🖼 Galerie", onPress: () => pickImage("gallery") },
    ];

    // ✅ Option supprimer uniquement si une photo existe
    if (displayUrl) {
      buttons.push({
        text: "🗑 Supprimer la photo",
        style: "destructive",
        onPress: () => {
          Alert.alert(
            "Supprimer la photo ?",
            "Cette action est irréversible.",
            [
              { text: "Annuler", style: "cancel" },
              { text: "Supprimer", style: "destructive", onPress: deleteImage },
            ],
          );
        },
      });
    }

    buttons.push({ text: "Annuler", style: "cancel" });

    Alert.alert("Photo de profil", "Choisir une action", buttons);
  }

  async function pickImage(source: "camera" | "gallery") {
    try {
      // ✅ Demander les permissions
      if (source === "camera") {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "L'accès à la caméra est nécessaire.",
          );
          return;
        }
      } else {
        const { status } =
          await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert(
            "Permission refusée",
            "L'accès à la galerie est nécessaire.",
          );
          return;
        }
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          })
          : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
          });

      if (result.canceled || !result.assets?.[0]) return;

      await uploadImage(result.assets[0].uri);
    } catch (e: any) {
      Alert.alert(
        "Erreur",
        e?.message || "Impossible de sélectionner l'image.",
      );
    }
  }

  async function uploadImage(uri: string) {
    setUploading(true);
    try {
      const filePath = `${userId}/${folder}/avatar.jpg`;

      // ✅ Lire en base64 via expo-file-system (fonctionne avec les URI locales Expo)
      // ✅ Utiliser la string directement — EncodingType peut être undefined dans Expo Go
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: "base64" as any,
      });

      // ✅ Convertir base64 → ArrayBuffer pour Supabase Storage
      const byteCharacters = atob(base64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(filePath, byteArray, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // ✅ URL publique avec cache busting
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      const publicUrl = data.publicUrl + `?t=${Date.now()}`;
      setLocalUrl(publicUrl);
      onUploaded?.(publicUrl);
    } catch (e: any) {
      Alert.alert("Erreur upload", e?.message || "Upload échoué.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <TouchableOpacity
      onPress={handlePick}
      activeOpacity={editable ? 0.8 : 1}
      style={[styles.container, { width: size, height: size }]}
    >
      {/* Avatar image ou initiales */}
      {displayUrl ? (
        <Image
          source={{ uri: displayUrl }}
          style={[
            styles.image,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: accentColor + "40",
            },
          ]}
          resizeMode="cover"
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              // ✅ Couleur solide visible — pas de transparence
              backgroundColor: accentColor,
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                // ✅ Texte blanc sur fond coloré
                color: "#FFFFFF",
                fontSize: fs(size * 0.35),
                fontFamily: "Inter_700Bold",
              },
            ]}
          >
            {initials}
          </Text>
        </View>
      )}

      {/* Loading overlay */}
      {uploading && (
        <View
          style={[
            styles.overlay,
            { width: size, height: size, borderRadius: size / 2 },
          ]}
        >
          <ActivityIndicator color="#fff" size="small" />
        </View>
      )}

      {/* Badge caméra — visible si editable */}
      {editable && !uploading && (
        <View style={[styles.badge, { backgroundColor: accentColor }]}>
          <Feather name="camera" size={iconSize(12)} color="#fff" />
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative" },
  image: { borderWidth: 2 },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: { lineHeight: undefined },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
});
