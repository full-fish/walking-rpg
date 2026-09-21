import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { usePlayer } from '@/stores/usePlayer';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

export default function Settings() {
  const save = usePlayer((s) => s.save);
  const addGold = usePlayer((s) => s.addGold);
  const reset = usePlayer((s) => s.reset);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">설정</Text>

      {/* 저장 동작 확인용. 실제 설정 항목은 나중에 이 자리를 대체한다. */}
      <Panel title="세이브">
        <Text>골드 {save.player.gold}</Text>
        <Text>WP {save.wp.current}</Text>
        <Text size="sm" dim>
          세이브 버전 {save.version}
        </Text>
        <View style={styles.row}>
          <Button label="골드 +100" tone="gold" onPress={() => addGold(100)} />
          <Button label="초기화" onPress={reset} />
        </View>
        <Text size="sm" dim>
          앱을 완전히 끄고 다시 켜도 값이 남아 있어야 합니다.
        </Text>
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
});
