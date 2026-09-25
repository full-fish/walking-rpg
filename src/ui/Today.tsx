import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { consumableById, fieldById } from '@/content';
import { goalCells, goalsReady, rewardGold, streakNext, type Got } from '@/game/daily';
import { STEP_GOAL, STEP_GOAL_REWARDS, STREAK_REWARDS, type DailyReward } from '@/game/formulas';
import { bagFull, itemDef, itemLabel } from '@/game/items';
import { dayKey } from '@/health/steps';
import { usePlayer } from '@/stores/usePlayer';

import { Button } from './Button';
import { Popup } from './ItemCell';
import { Panel } from './Panel';
import { Text } from './Text';
import { border, colors, rarity, space } from './theme';

type CellState = 'done' | 'ready' | 'locked';

/** 5,000 → "5천", 15,000 → "1.5만" */
function stepsLabel(steps: number): string {
  return steps >= 10_000 ? `${steps / 10_000}만` : `${steps / 1_000}천`;
}

/** 칸 하나에 적는 보상 — 좁아서 짧게. 골드는 지금 지역 값이다 */
function rewardLabel(reward: DailyReward, region: number): string {
  const parts: string[] = [];
  if (reward.gold) parts.push(`${rewardGold(reward, region).toLocaleString()}G`);
  if (reward.potion) parts.push(`물약 ${reward.potion}`);
  if (reward.material) parts.push(`소재 ${reward.material}`);
  if (reward.gear) parts.push('장비');
  return parts.join(' ');
}

function Cell({ head, label, state }: { head: string; label: string; state: CellState }) {
  const color = state === 'ready' ? colors.gold : state === 'done' ? colors.wp : colors.dim;
  return (
    <View style={[styles.cell, { borderColor: state === 'locked' ? colors.edge : color }]}>
      <Text size="sm" color={color}>
        {state === 'done' ? '✓' : head}
      </Text>
      <Text size="sm" dim={state !== 'ready'} style={styles.center}>
        {label}
      </Text>
    </View>
  );
}

/** 받은 것 목록 — 소재는 같은 것끼리 묶는다 */
function GotList({ got }: { got: Got }) {
  const materials = new Map<string, number>();
  for (const id of got.materials) materials.set(id, (materials.get(id) ?? 0) + 1);
  return (
    <>
      {got.gold > 0 && <Text color={colors.gold}>골드 +{got.gold.toLocaleString()}</Text>}
      {Object.entries(got.potions).map(([id, n]) => (
        <Text key={id}>
          {consumableById(id).name} × {n}
        </Text>
      ))}
      {[...materials].map(([id, n]) => (
        <Text key={id}>
          {fieldById(id).material.name} × {n}
        </Text>
      ))}
      {got.items.map((item) => (
        <Text key={item.uid} color={rarity[itemDef(item).rarity]}>
          {itemLabel(item)}
        </Text>
      ))}
    </>
  );
}

/**
 * 모험 탭 [보상] (T19, 칸 이름은 검수 2차) — 걸음 목표 6칸과 7일 출석표. **둘 다 [받기]를 눌러야 들어온다.**
 * 걸음은 WP가 센 값(wp.grantedByDate)이라 HUD의 "오늘 걸음"과 같다.
 */
export function Today() {
  const save = usePlayer((s) => s.save);
  const claimGoals = usePlayer((s) => s.claimGoals);
  const claimStreak = usePlayer((s) => s.claimStreak);
  /** 방금 받은 것 — 창으로 보여 준다 */
  const [shown, setShown] = useState<{ title: string; got: Got } | null>(null);

  const now = new Date();
  const today = dayKey(now);
  const region = save.regionProgress.current;

  // 걸음 목표 — 오늘 칸 + 지난 이틀 동안 못 받은 칸
  const claimed = save.daily[today] ?? 0;
  const open = goalCells(save.wp.grantedByDate[today] ?? 0);
  const ready = goalsReady(save, now);
  const readyCount = ready.reduce((sum, d) => sum + d.to - d.from, 0);
  const earlier = ready.filter((d) => d.date !== today).reduce((sum, d) => sum + d.to - d.from, 0);
  // 남은 게 장비 칸 하나뿐인데 가방이 차 있으면 누를 게 없다
  const gearOnly =
    readyCount > 0 && ready.every((d) => d.from === STEP_GOAL_REWARDS.length - 1) && bagFull(save);
  const waiting = ready.some((d) => d.to === STEP_GOAL_REWARDS.length) && bagFull(save);

  // 출석 — 안 받았으면 오늘 받을 칸, 받았으면 받은 칸까지 ✓
  const next = streakNext(save, now);
  const streak = next ? next.count - 1 : save.streak.count;
  const doneUpTo = next ? next.cell : ((save.streak.count - 1) % STREAK_REWARDS.length) + 1;

  return (
    <Panel title="보상">
      <Text size="sm" dim>
        걸음 목표 — {STEP_GOAL.toLocaleString()}보마다 한 칸
      </Text>
      <View style={styles.cells}>
        {STEP_GOAL_REWARDS.map((reward, i) => (
          <Cell
            key={i}
            head={stepsLabel((i + 1) * STEP_GOAL)}
            label={rewardLabel(reward, region)}
            state={i < claimed ? 'done' : i < open ? 'ready' : 'locked'}
          />
        ))}
      </View>
      {earlier > 0 && (
        <Text size="sm" dim>
          지난 날 못 받은 {earlier}칸도 같이 받는다 (3일 안)
        </Text>
      )}
      {waiting && (
        <Text size="sm" color={colors.hp}>
          가방이 꽉 차 장비 칸은 기다린다 — 비우면 받을 수 있다
        </Text>
      )}
      <Button
        label={readyCount > 0 ? `받기 ${readyCount}칸` : '받기'}
        tone="gold"
        disabled={readyCount === 0 || gearOnly}
        onPress={() => {
          const r = claimGoals();
          if (r) setShown({ title: '걸음 목표', got: r.got });
        }}
      />

      <Text size="sm" dim>
        출석 — 연속 {streak}일 (하루라도 빠지면 1일째부터)
      </Text>
      <View style={styles.cells}>
        {STREAK_REWARDS.map((reward, i) => (
          <Cell
            key={i}
            head={`${i + 1}일`}
            label={rewardLabel(reward, region)}
            state={i < doneUpTo ? 'done' : next && i === next.cell ? 'ready' : 'locked'}
          />
        ))}
      </View>
      <Button
        label={next ? '출석 받기' : '오늘은 받았다'}
        tone="gold"
        disabled={!next}
        onPress={() => {
          const r = claimStreak();
          if (r) setShown({ title: `출석 ${r.count}일째`, got: r.got });
        }}
      />

      <Popup visible={shown !== null} onClose={() => setShown(null)}>
        <Text>{shown?.title}</Text>
        {shown && <GotList got={shown.got} />}
        <Button label="닫기" onPress={() => setShown(null)} />
      </Popup>
    </Panel>
  );
}

const styles = StyleSheet.create({
  cells: { flexDirection: 'row', gap: space.xs },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    borderWidth: border,
  },
  center: { textAlign: 'center' },
});
