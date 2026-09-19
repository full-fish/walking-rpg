import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 모험 탭. 지금은 UI 토큰/컴포넌트 확인용 뼈대 (실제 내용은 S1~S2에서). */
export default function Adventure() {
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">StepQuest</Text>

      <Panel title="기력">
        <Bar label="기력" value={4820} max={30000} />
        <Text size="sm" dim>
          걸으면 기력이 쌓입니다. 1보 = 1기력
        </Text>
      </Panel>

      <Panel title="사냥터">
        <Text>시작의 들판</Text>
        <View style={styles.row}>
          <Button label="사냥 시작" tone="gold" />
          <Button label="이동" />
        </View>
      </Panel>

      <Panel title="상태">
        <Bar label="HP" value={72} max={100} color={colors.hp} />
        <Bar label="EXP" value={130} max={400} color={colors.exp} />
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', gap: space.sm },
});
