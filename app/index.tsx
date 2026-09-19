import { StyleSheet, Text, View } from 'react-native';

export default function Home() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>StepQuest</Text>
      <Text style={styles.hint}>Hello</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A1626',
  },
  title: { color: '#F2E9DC', fontSize: 28, fontWeight: '700' },
  hint: { color: '#8C7FA6', fontSize: 16, marginTop: 8 },
});
