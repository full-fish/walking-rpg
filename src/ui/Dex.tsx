import { useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import {
  bossOf,
  FIELDS,
  GEAR_SLOT_LABELS,
  MONSTER_ARCHETYPES,
  monstersOfField,
  REGIONS,
  regionById,
  type Monster,
} from '@/content';
import {
  bossBonus,
  dexKills,
  dexStage,
  dexStat,
  dexStats,
  dexSteps,
  DEX_MONSTERS,
  fieldDone,
  regionDone,
  type DexUp,
} from '@/game/dex';
import { DEX, DEX_MAX } from '@/game/formulas';
import type { Save } from '@/save/schema';

import { Button } from './Button';
import { BOSS_REVEAL, BOSS_REWARDS, DEX_REVEAL, STAT_LABEL } from './dexText';
import { Popup } from './ItemCell';
import { monsterIcons } from './monsterIcons';
import { Panel } from './Panel';
import { Text } from './Text';
import { border, colors, rarity, space } from './theme';

/** 카드 단계 1~5의 테두리 — 장비 등급 색을 그대로 쓴다. 흔한 것일수록 어둡다 */
const STAGE_COLOR = [rarity.common, rarity.uncommon, rarity.rare, rarity.epic, rarity.legendary];

const ARCH_LABEL = new Map(MONSTER_ARCHETYPES.map((a) => [a.id, a.label]));

export function stageColor(stage: number): string {
  return stage === 0 ? colors.edge : STAGE_COLOR[stage - 1];
}

const revealOf = (m: Monster) => (m.boss ? BOSS_REVEAL : DEX_REVEAL);

/** 전투 결과 한 줄 — "도감 초록 슬라임 10마리 — 원형 · 티어 · … 열림" */
export function dexUpText(up: DexUp): string {
  const { monster, stage } = up;
  if (stage === 1) return `도감 ${monster.name} — 새로 올랐다`;
  const n = dexSteps(monster)[stage - 1];
  return `도감 ${monster.name} ${n}${monster.boss ? '번째 처치' : '마리'} — ${revealOf(monster)[stage - 1]}`;
}

function Card({
  monster,
  kills,
  onPress,
}: {
  monster: Monster;
  kills: number;
  onPress: () => void;
}) {
  const stage = dexStage(monster, kills);
  const art = monsterIcons[monster.sprite];
  return (
    <Pressable
      disabled={stage === 0}
      onPress={onPress}
      style={[styles.card, { borderColor: stageColor(stage) }]}
    >
      {stage === 0 ? (
        <Text dim>???</Text>
      ) : art ? (
        <Image source={art} style={styles.art} resizeMode="contain" />
      ) : (
        <Text size="sm" style={styles.center}>
          {monster.name}
        </Text>
      )}
      <Text size="sm" dim>
        {monster.boss ? (stage > 0 ? `처치 ${kills}` : '보스') : `${kills}`}
      </Text>
    </Pressable>
  );
}

/** 카드를 누르면 — 큰 그림 아래로 단계만큼 열린 정보와 다음 단계까지 (카드 모양, T19 검수) */
function Info({ save, monster }: { save: Save; monster: Monster }) {
  const kills = dexKills(save, monster);
  const stage = dexStage(monster, kills);
  const next = dexSteps(monster).find((s) => kills < s);
  const fields = FIELDS.filter((f) => monstersOfField(f).some((m) => m.id === monster.id));
  const art = monsterIcons[monster.sprite];
  return (
    <>
      <View style={[styles.frame, { borderColor: stageColor(stage) }]}>
        {art ? (
          <Image source={art} style={styles.big} resizeMode="contain" />
        ) : (
          // 그림이 아직 없는 몬스터 — 자리는 그대로 두고 이름을 크게
          <Text size="lg" dim style={styles.center}>
            {monster.name}
          </Text>
        )}
      </View>
      <View style={styles.title}>
        <Text size="lg" color={stageColor(stage)}>
          {monster.name}
        </Text>
        <Text size="sm" dim>
          {monster.boss
            ? `지역 ${monster.region} 보스 · 처치 ${kills}`
            : `잡은 수 ${kills} / ${DEX_MAX}`}
        </Text>
      </View>
      {stage >= 2 && (
        <>
          <Text size="sm">
            {ARCH_LABEL.get(monster.arch)} · 티어 {monster.tier}
          </Text>
          {!monster.boss && (
            <Text size="sm" dim>
              {fields.map((f) => f.name).join(' · ')}
            </Text>
          )}
        </>
      )}
      {stage >= 3 && (
        <Text size="sm">
          EXP {monster.exp} · 골드 {monster.gold}
        </Text>
      )}
      {stage >= 4 && monster.boss && (
        <Text size="sm">첫 처치 보상 · 장비 1개 확정 (희귀 이상)</Text>
      )}
      {stage >= 4 && monster.drop && <Text size="sm">드랍 · {GEAR_SLOT_LABELS[monster.drop]}</Text>}
      {stage >= 5 && (
        <Text size="sm">
          HP {monster.maxHp.toLocaleString()} · ATK {monster.atk} · DEF {monster.def} · SPD{' '}
          {monster.spd}
        </Text>
      )}
      {!monster.boss && stage >= 2 && (
        <Text size="sm" color={colors.gold}>
          장비 드랍 ×{DEX.dropMult}
          {stage >= 5 ? ` · ${STAT_LABEL[dexStat(monster)]} +${DEX.cardStat}` : ''}
        </Text>
      )}
      {/* 보스 보상 (T19 검수 3차) — 받은 것까지 */}
      {monster.boss && stage >= DEX.bossDropAt && (
        <Text size="sm" color={colors.gold}>
          {BOSS_REWARDS.slice(0, stage - 1).join(' · ')} (그 지역 = 지역 {monster.region})
        </Text>
      )}
      {next !== undefined && (
        <Text size="sm" dim>
          {next}
          {monster.boss ? '번째 처치' : '마리'} ({next - kills} 남음) — {revealOf(monster)[stage]}
        </Text>
      )}
    </>
  );
}

/**
 * 캐릭터 탭 [도감] (T19). 지역마다 카드 격자 — 못 잡은 몬스터는 "???"로 자리만 선다(몇 장 남았는지가 보인다).
 * 어느 사냥터에 나오는지는 10마리에 열린다(검수 주석)라 사냥터별로 묶지 않고, 사냥터 완성은 개수로만 보여 준다.
 */
export function Dex({ save }: { save: Save }) {
  const [region, setRegion] = useState(save.regionProgress.current);
  const [open, setOpen] = useState<Monster | null>(null);

  const all = [...DEX_MONSTERS.values()].flat();
  const seen = all.filter((m) => dexKills(save, m) > 0).length;
  const full = all.filter((m) => dexKills(save, m) >= DEX_MAX).length;
  const stats = dexStats(save);
  const bonus = bossBonus(save);
  const statLine = (Object.keys(STAT_LABEL) as (keyof typeof STAT_LABEL)[])
    .map((k) => `${STAT_LABEL[k]} +${stats[k]}`)
    .join(' · ');

  const monsters = [...DEX_MONSTERS.get(region)!].sort(
    (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
  );
  const done = monsters.filter((m) => dexKills(save, m) >= DEX_MAX).length;
  const boss = bossOf(region);

  return (
    <>
      <Panel title={`도감 — ${seen} / ${all.length}`}>
        <Text size="sm" dim>
          100마리 {full}장 · 사냥터 완성 {FIELDS.filter((f) => fieldDone(save, f)).length} /{' '}
          {FIELDS.length} · 지역 완성 {REGIONS.filter((r) => regionDone(save, r.id)).length} /{' '}
          {REGIONS.length}
        </Text>
        <Text size="sm" color={colors.gold}>
          도감 스탯 — {statLine}
        </Text>
        <Text size="sm" color={colors.gold}>
          보스 — EXP · 골드 +{Math.round(bonus.expGold * 100)}% · 강화 성공률 +
          {Math.round(bonus.enhance * 100)}%p
        </Text>
        <Text size="sm" dim>
          1 · 10 · 25 · 50 · 100마리마다 테두리 색이 바뀌고 정보가 열린다. 10마리부터 그 몬스터 장비
          드랍 ×{DEX.dropMult}, 100마리면 1차 스탯 +{DEX.cardStat}. 보스는 잡을 때마다 한 단계 —{' '}
          {BOSS_REWARDS.map((t, i) => `${i + 2}번 ${t}`).join(' · ')}.
        </Text>
      </Panel>

      <View style={styles.tabs}>
        {REGIONS.map((r) => (
          <Button
            key={r.id}
            label={`${r.id}`}
            tone={r.id === region ? 'gold' : 'normal'}
            onPress={() => setRegion(r.id)}
          />
        ))}
      </View>

      <Panel title={`${regionById(region).name} — ${done} / ${monsters.length}`}>
        <View style={styles.grid}>
          {monsters.map((m) => (
            <Card key={m.id} monster={m} kills={dexKills(save, m)} onPress={() => setOpen(m)} />
          ))}
          <Card monster={boss} kills={dexKills(save, boss)} onPress={() => setOpen(boss)} />
        </View>
      </Panel>

      <Panel title={`완성 — 사냥터 하나에 스탯 포인트 +${DEX.fieldPoints}`}>
        {regionById(region).fields.map((f) => {
          const pool = monstersOfField(f);
          const n = pool.filter((m) => dexKills(save, m) >= DEX_MAX).length;
          return (
            <Text
              key={f.id}
              size="sm"
              color={n === pool.length ? colors.gold : undefined}
              dim={n < pool.length}
            >
              {f.name} — {n} / {pool.length}
              {n === pool.length ? ' ✓' : ''}
            </Text>
          );
        })}
        <Text size="sm" color={regionDone(save, region) ? colors.gold : colors.dim}>
          지역 완성 (전부 100마리) — 네 스탯 +{DEX.regionStat}
          {regionDone(save, region) ? ' ✓' : ''}
        </Text>
      </Panel>

      <Popup visible={open !== null} onClose={() => setOpen(null)}>
        {open && <Info save={save} monster={open} />}
        <Button label="닫기" onPress={() => setOpen(null)} />
      </Popup>
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  card: {
    width: 64,
    minHeight: 72,
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: space.xs,
    borderWidth: border,
    backgroundColor: colors.bg,
  },
  art: { width: 40, height: 40 },
  center: { textAlign: 'center' },
  // 창 폭을 다 쓰는 그림 칸 — 테두리가 카드 단계 색
  frame: {
    height: 176,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.sm,
    borderWidth: border * 2,
    backgroundColor: colors.bg,
  },
  big: { width: 144, height: 144 },
  title: { alignItems: 'center', gap: space.xs },
});
