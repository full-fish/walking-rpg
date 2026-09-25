import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { consumableById, fieldById, regionById } from '@/content';
import { potionHeal, regionMaterials } from '@/game/economy';
import { currentMonster } from '@/game/field';
import { MATERIAL_BUFF, type BuffStat } from '@/game/formulas';
import { buffMult, statsOf } from '@/game/progression';
import { trades, usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Popup } from '@/ui/ItemCell';
import { MaterialPicker } from '@/ui/MaterialPicker';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 소재 버프 이름 (T17_6 검수) — 전투력 탭과 같은 말을 쓴다 */
const BUFF_LABEL: Record<BuffStat, string> = {
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
function buffText(buffs: BuffStat[], mult: number): string {
  const counts = new Map<BuffStat, number>();
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
 * **소재 버프도 여기서 쓴다** (T17_7 검수 5차) — [버프]를 누르면 소재 고르는 창이 따로 뜬다.
 * 사냥터·보스 둘 다, 한 마리도 안 잡았을 때든 몇 마리 잡고서든 된다. 붙은 버프는 판이 끝날 때까지 간다.
 */
export default function Field() {
  const router = useRouter();
  const save = usePlayer((s) => s.save);
  const drink = usePlayer((s) => s.drink);
  const trade = usePlayer((s) => s.trade);
  const finishBattle = usePlayer((s) => s.finishBattle);
  /** 버프 창이 떠 있나, 그 창에서 고른 소재 */
  const [buffing, setBuffing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

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
  /** 이 판에 더 붙일 수 있는 버프 수 — 한 판에 3개까지 */
  const room = MATERIAL_BUFF.max - run.buffs.length;
  const closeBuff = () => {
    setBuffing(false);
    setPicked([]);
  };

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
          <Text color={colors.gold}>버프 — {buffText(run.buffs, buffMult(save))}</Text>
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
        <Button
          label={`버프 ${run.buffs.length}/${MATERIAL_BUFF.max}`}
          disabled={room === 0 || regionMaterials(save, region.id) === 0}
          onPress={() => setBuffing(true)}
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

      <Popup visible={buffing} onClose={closeBuff}>
        <Text>소재 버프</Text>
        <Text size="sm" dim>
          소재 하나에 무작위 버프 하나(전투력 값 ×{+buffMult(save).toFixed(3)}). 이 판이 끝날 때까지
          갑니다. 한 판에 {MATERIAL_BUFF.max}개까지 — 남은 자리 {room}.
        </Text>
        <MaterialPicker
          region={region.id}
          need={room}
          distinct={false}
          owned={save.materials}
          picked={picked}
          onChange={setPicked}
        />
        <View style={styles.row}>
          <Button
            label={`쓰기 ${picked.length}개`}
            tone="gold"
            disabled={picked.length === 0}
            onPress={() => {
              if (trade(trades.buff(picked))) closeBuff();
            }}
          />
          <Button label="닫기" onPress={closeBuff} />
        </View>
      </Popup>
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
