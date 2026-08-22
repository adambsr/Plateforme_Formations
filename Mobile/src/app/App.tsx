import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Plateforme de Formations</Text>
      <Text style={styles.subtitle}>
        Le socle de l'application mobile est prêt.
      </Text>
      <StatusBar style="dark" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f5f7fb',
  },
  title: {
    color: '#172033',
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 12,
    color: '#526078',
    fontSize: 16,
    textAlign: 'center',
  },
});
