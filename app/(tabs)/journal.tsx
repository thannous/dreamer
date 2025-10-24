import React from 'react';
import { View, Text, FlatList, Pressable, StyleSheet } from 'react-native';
import { useDreams } from '@/context/DreamsContext';
import { router } from 'expo-router';

export default function JournalListScreen() {
  const { dreams } = useDreams();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>My Dream Journal</Text>
      <FlatList
        data={dreams}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingVertical: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push(`/journal/${item.id}`)}>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={styles.cardTitle}>{item.title}</Text>
              <Text style={styles.cardSubtitle}>{new Date(item.id).toDateString()}</Text>
            </View>
            {item.isFavorite ? <Text style={styles.favorite}>★</Text> : null}
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#666', marginTop: 24 }}>No dreams yet.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  card: { flexDirection: 'row', padding: 12, borderRadius: 12, backgroundColor: '#111827', alignItems: 'center', gap: 12 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  cardSubtitle: { fontSize: 12, color: '#9CA3AF' },
  favorite: { color: '#F59E0B', fontSize: 18, marginLeft: 8 },
});

