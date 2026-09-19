import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

export default function Shop() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">상점</Text>
      <Panel>
        <Text dim>아직 비어 있습니다.</Text>
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
});
