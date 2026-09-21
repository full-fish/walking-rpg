import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useSteps } from '@/health/useSteps';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 모험 탭. 지금은 걸음 표시까지 (전투/사냥터는 S2~). */
export default function Adventure() {
  const steps = useSteps();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">StepQuest</Text>

      <Panel title="오늘 걸음">
        <View style={styles.row}>
          <Text size="xl">{steps.today.toLocaleString()}</Text>
          <Button label="새로고침" onPress={steps.refresh} />
        </View>
        {steps.status === 'connected' ? (
          <Text size="sm" dim>
            걸으면 기력이 쌓입니다. 1보 = 1기력
          </Text>
        ) : (
          <>
            <Text size="sm" dim>
              {steps.status === 'unavailable'
                ? '이 기기에서 걸음을 셀 수 없습니다.'
                : 'Health Connect가 연결되지 않아 앱을 켠 동안의 걸음만 셉니다. 연결하면 워치 걸음과 지난 3일치도 반영됩니다.'}
            </Text>
            {steps.status === 'sensor-only' && (
              <Button label="Health Connect 연결" onPress={steps.connect} />
            )}
          </>
        )}
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
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
});
