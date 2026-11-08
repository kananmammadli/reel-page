import { useEffect, useState } from "react";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { searchTitles, type CatalogFilter, type Title } from "@reel-and-page/shared";

import { PosterCard } from "@/components/catalog/poster-card";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { supabase } from "@/lib/supabase";

const FILTERS: { key: CatalogFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "film", label: "Films" },
  { key: "story", label: "Stories" },
  { key: "free", label: "Free" },
];

export default function CatalogScreen() {
  const theme = useTheme();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<CatalogFilter>("all");
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      try {
        const results = await searchTitles(supabase, query, filter);
        if (!cancelled) setTitles(results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [query, filter]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={["top"]}>
        <ThemedText type="title" style={styles.title}>
          Catalog
        </ThemedText>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search films, stories, directors"
          placeholderTextColor={theme.textSecondary}
          accessibilityLabel="Search films, stories, directors"
          style={[styles.search, { borderColor: theme.backgroundSelected, color: theme.text }]}
        />
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[
                  styles.chip,
                  { borderColor: theme.backgroundSelected },
                  active && { backgroundColor: theme.text, borderColor: theme.text },
                ]}
              >
                <ThemedText type="small" style={active ? { color: theme.background } : undefined}>
                  {f.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Loading…
          </ThemedText>
        ) : titles.length === 0 ? (
          <ThemedText themeColor="textSecondary" style={styles.empty}>
            Nothing matches that search. Try a director or author name.
          </ThemedText>
        ) : (
          <FlatList
            data={titles}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.row, { borderBottomColor: theme.backgroundSelected }]}
                onPress={() => router.push(`/titles/${item.id}`)}
              >
                <PosterCard
                  id={item.id}
                  title={item.title}
                  year={item.year}
                  type={item.type}
                  posterUrl={item.poster_url}
                  style={styles.rowPoster}
                  compact
                />
                <View style={styles.rowMeta}>
                  <ThemedText type="smallBold">{item.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.creator} · {item.genre}
                  </ThemedText>
                </View>
                {item.is_free && (
                  <ThemedText type="small" themeColor="text">
                    Free
                  </ThemedText>
                )}
              </Pressable>
            )}
          />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  title: {
    fontSize: 28,
  },
  search: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chips: {
    flexDirection: "row",
    gap: Spacing.one,
    flexWrap: "wrap",
  },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: Spacing.two,
    paddingVertical: 6,
  },
  empty: {
    marginTop: Spacing.four,
  },
  list: {
    gap: Spacing.one,
    paddingBottom: Spacing.six,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.two,
    borderBottomWidth: 1,
  },
  rowPoster: {
    width: 52,
  },
  rowMeta: {
    flex: 1,
    minWidth: 0,
  },
});
