import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { expToNext } from '@/game/formulas';
import { primaryStats, statsOf, type StatKey } from '@/game/progression';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 1차 스탯 4종과 그게 뭘 하는지 (§4.3). */
const STATS: { key: StatKey; label: string; effect: string }[] = [
  { key: 'str', label: '힘 STR', effect: 'ATK +2' },
  { key: 'vit', label: '체력 VIT', effect: 'HP +10 · DEF +0.5' },
  { key: 'agi', label: '민첩 AGI', effect: 'SPD +1.5 · 회피 +0.15%p' },
  { key: 'luk', label: '행운 LUK', effect: '치명 +0.25%p · 드랍 +0.2%p' },
];

export default function Character() {
  const save = usePlayer((s) => s.save);
  const allocate = usePlayer((s) => s.allocate);
  const stats = statsOf(save);
  const { unspent } = save.statPoints;
  const primary = primaryStats(save);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Text size="xl">캐릭터</Text>

      <Panel title={`Lv ${save.player.level} 전사`}>
        <Bar label="HP" value={save.player.hp} max={stats.maxHp} color={colors.hp} />
        <Bar
          label="EXP"
          value={save.player.exp}
          max={expToNext(save.player.level)}
          color={colors.exp}
        />
      </Panel>

      <Panel title={unspent > 0 ? `스탯 — 남은 포인트 ${unspent}` : '스탯'}>
        {STATS.map(({ key, label, effect }) => (
          <View key={key} style={styles.row}>
            <View style={styles.name}>
              <Text>
                {label} {primary[key]}
              </Text>
              <Text size="sm" dim>
                {effect}
              </Text>
            </View>
            <Button label="+" disabled={unspent <= 0} onPress={() => allocate(key)} />
          </View>
        ))}
        {unspent === 0 && (
          <Text size="sm" dim>
            레벨이 오르면 포인트를 3점씩 받습니다.
          </Text>
        )}
      </Panel>

      <Panel title="전투력">
        <Text size="sm" dim>
          ATK {stats.atk} · DEF {stats.def} · SPD {stats.spd.toFixed(1)}
        </Text>
        <Text size="sm" dim>
          치명 {(stats.cri * 100).toFixed(2)}% (×{stats.crd}) · 회피{' '}
          {(stats.eva * 100).toFixed(2)}%
        </Text>
      </Panel>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { gap: space.xs },
});
