import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { consumableById, fieldById, regionById } from '@/content';
import { potionHeal } from '@/game/economy';
import { currentMonster } from '@/game/field';
import { type BossBuffStat } from '@/game/formulas';
import { bossBuffMult, statsOf } from '@/game/progression';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 보스 버프 이름 (T17_6 검수) — 전투력 탭과 같은 말을 쓴다 */
const BUFF_LABEL: Record<BossBuffStat, string> = {
  atk: 'ATK',
  def: 'DEF',
  spd: 'SPD',
  cri: '치명',
  crd: '치명 피해',
  eva: '회피',
};

/**
 * ["atk", "cri", "atk"] → "ATK ×1.21 · 치명 ×1.10" — 같은 게 겹치면 곱해서 한 번에 보여준다.
 * 배율은 결의의 반지(T17_7)가 올릴 수 있어서 받는다.
 */
function buffText(buffs: BossBuffStat[], mult: number): string {
  const counts = new Map<BossBuffStat, number>();
  for (const b of buffs) counts.set(b, (counts.get(b) ?? 0) + 1);
  return [...counts].map(([b, n]) => `${BUFF_LABEL[b]} ×${(mult ** n).toFixed(2)}`).join(' · ');
}

/**
 * 사냥터 한 판의 진행 화면 (§4.4).
 *
 * **남은 마릿수를 절대 보여주지 않는다.** "N번째 처치"라는 누적 카운터만 뜬다 —
 * 알면 도박이 아니라 계산이 되고, 그 비공개가 이 시스템의 전부다.
 * 물약은 여기서도, 전투 중에도 쓸 수 있다 (§4.4). 전투 화면에서 마시면 남은 싸움을
 * 다시 계산한다 — 여기서는 싸우는 중이 아니라 그냥 회복하면 된다.
 */
export default function Field() {
  const router = useRouter();
  const save = usePlayer((s) => s.save);
  const drink = usePlayer((s) => s.drink);
  const finishBattle = usePlayer((s) => s.finishBattle);

  const run = save.run;
  if (!run) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Panel>
          <Text>진행 중인 사냥이 없습니다.</Text>
          <Button label="마을로" tone="gold" onPress={() => router.replace('/')} />
        </Panel>
      </SafeAreaView>
    );
  }

  // 보스전도 같은 화면이다 (T17_5) — 1:1이라 "N번째 처치" 대신 보스 이름을 건다
  const title = run.boss ? currentMonster(save)!.name : fieldById(run.fieldId).name;
  const region = regionById(save.regionProgress.current);
  const stats = statsOf(save);
  const next = currentMonster(save);
  const potions = Object.entries(run.potions).filter(([, n]) => n > 0);

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text size="xl">{title}</Text>
        <Text size="sm" dim>
          {region.name}
        </Text>
      </View>

      <Panel
        title={
          run.boss ? '보스' : run.killed === 0 ? '사냥터에 들어섰다' : `${run.killed}번째 처치`
        }
      >
        <Bar label="HP" value={save.player.hp} max={stats.maxHp} color={colors.hp} />
        {run.buffs.length > 0 && (
          <Text color={colors.gold}>버프 — {buffText(run.buffs, bossBuffMult(save))}</Text>
        )}
        <Text size="sm" dim>
          {run.boss
            ? '물러설 곳이 없다.'
            : run.killed === 0
              ? '무언가 다가온다...'
              : '또 다른 기척이 느껴진다...'}
        </Text>
        {next && <Text>{next.name}</Text>}
      </Panel>

      <Panel title={`물약 ${potions.reduce((s, [, n]) => s + n, 0)}개`}>
        {potions.length === 0 ? (
          <Text size="sm" dim>
            들고 온 물약이 없습니다. 사냥터 안에서는 살 수 없습니다.
          </Text>
        ) : (
          potions.map(([id, n]) => {
            const def = consumableById(id);
            const heal = potionHeal(save, id);
            return (
              <View key={id} style={styles.row}>
                <View style={styles.name}>
                  <Text>
                    {def.name} × {n}
                  </Text>
                  <Text size="sm" dim>
                    HP +{heal}
                  </Text>
                </View>
                <Button
                  label="사용"
                  disabled={save.player.hp >= stats.maxHp}
                  onPress={() => drink(id)}
                />
              </View>
            );
          })
        )}
      </Panel>

      <View style={styles.row}>
        <Button
          label={run.boss ? '싸운다' : '계속 싸운다'}
          tone="gold"
          onPress={() => router.push('/battle')}
        />
        {/* 나가면 개별 보상은 그대로 두고 클리어 보너스만 잃는다 (§4.4) */}
        <Button
          label="나가기"
          onPress={() => {
            finishBattle('flee', save.player.hp);
            router.replace('/');
          }}
        />
      </View>
      <Text size="sm" dim>
        {run.boss
          ? '나가면 도전 비용은 돌아오지 않고, 다음 도전은 재도전 값입니다.'
          : '나가면 지금까지 받은 보상은 그대로지만 **클리어 보너스**는 없습니다.'}
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.lg },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  name: { gap: space.xs, flexShrink: 1 },
});
