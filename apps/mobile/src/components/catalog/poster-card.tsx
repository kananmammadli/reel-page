import { Image, type ImageStyle } from "expo-image";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";

// No poster_url in the seed data yet (real artwork comes with the admin
// panel in milestone 5), so render a gradient card from the title id. This
// mirrors the web app's PosterCard (apps/web/src/components/catalog/PosterCard.tsx).
const GRADIENTS = [
  ["#6b1d2a", "#2a1018"],
  ["#3d3a52", "#15131f"],
  ["#2f3b2c", "#0f1410"],
  ["#8a5a1c", "#2b1b08"],
  ["#4f2a46", "#1b0d18"],
  ["#5a1a1a", "#1a0707"],
  ["#8c7a2c", "#2d2709"],
  ["#2c4a5a", "#0b1820"],
] as const;

function colorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length]![0];
}

export function PosterCard({
  id,
  title,
  year,
  type,
  posterUrl,
  style,
  compact = false,
}: {
  id: string;
  title: string;
  year: number | null;
  type: "film" | "story";
  posterUrl?: string | null;
  style?: ViewStyle;
  compact?: boolean;
}) {
  if (posterUrl) {
    return (
      <Image
        source={{ uri: posterUrl }}
        style={[styles.poster, style as StyleProp<ImageStyle>]}
        contentFit="cover"
      />
    );
  }

  return (
    <View style={[styles.poster, { backgroundColor: colorFor(id) }, style]}>
      {!compact && (
        <ThemedText type="small" style={styles.label}>
          {type === "film" ? "Film" : "Story"} {year ? `· ${year}` : ""}
        </ThemedText>
      )}
      <ThemedText type={compact ? "small" : "smallBold"} style={styles.label} numberOfLines={2}>
        {title}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  poster: {
    aspectRatio: 2 / 3,
    borderRadius: 8,
    padding: 10,
    justifyContent: "space-between",
  },
  label: {
    color: "#fff8f2",
  },
});
