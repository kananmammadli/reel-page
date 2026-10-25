import { View, StyleSheet } from "react-native";
import type { Episode } from "@reel-and-page/shared";

import { ThemedText } from "@/components/themed-text";
import { Spacing } from "@/constants/theme";

export function TranscriptView({ episode, currentTime }: { episode: Episode; currentTime: number }) {
  if (episode.transcript.length === 0) return null;

  const activeIndex = episode.transcript.findIndex(
    (entry) => currentTime >= entry.start_s && currentTime < entry.end_s,
  );

  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        TRANSCRIPT
      </ThemedText>
      {episode.transcript.map((entry, i) => (
        <ThemedText key={i} themeColor={i === activeIndex ? "text" : "textSecondary"}>
          {entry.text}
        </ThemedText>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Spacing.four,
    gap: Spacing.three,
  },
});
