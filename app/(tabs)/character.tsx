import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GEAR_SLOT_LABELS } from '@/content';
import { expToNext, GEAR_SLOTS, STAT_PER_POINT } from '@/game/formulas';
import { equippedStats, itemDef, itemLabel, itemStats } from '@/game/items';
import { primaryStats, statsOf, type StatKey } from '@/game/progression';
import type { ItemInstance } from '@/save/schema';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

/** 확률 계수를 "%p"로. 0.0025 → "0.25%p" */
const pp = (v: number) => `${+(v * 100).toFixed(2)}%p`;

/**
 * 배분할 수 있는 1차 스탯 4종과 그게 뭘 하는지 (§4.3).
 * 문구를 STAT_PER_POINT에서 만든다 — 손으로 적어두니 LUK이 4종이 된 뒤에도
 * 2종만 적혀 있었다 (T16_1).
 */
const STATS: { key: StatKey; label: string; effect: string }[] = [
  { key: 'str', label: '힘 STR', effect: `ATK +${STAT_PER_POINT.str.atk}` },
  {
    key: 'vit',
    label: '체력 VIT',
    effect: `HP +${STAT_PER_POINT.vit.maxHp} · DEF +${STAT_PER_POINT.vit.def}`,
  },
  {
    key: 'agi',
    label: '민첩 AGI',
    effect: `SPD +${STAT_PER_POINT.agi.spd} · 회피 +${pp(STAT_PER_POINT.agi.eva)}`,
  },
  {
    key: 'luk',
    label: '행운 LUK',
    effect:
      `치명 +${pp(STAT_PER_POINT.luk.cri)} · 치명피해 +${pp(STAT_PER_POINT.luk.crd)}` +
      ` · 드랍 +${pp(STAT_PER_POINT.luk.dropRate)} · 골드 +${pp(STAT_PER_POINT.luk.goldFind)}`,
  },
];

/** 장비가 얹어준 몫. 맨몸이 얼마인지 보여야 장비 값어치가 보인다 (§4.5). */
function bonus(value: number): string {
  return value > 0 ? ` (+${value})` : '';
}

export default function Character() {
  const save = usePlayer((s) => s.save);
  const allocate = usePlayer((s) => s.allocate);
  const equip = usePlayer((s) => s.equip);
  const unequip = usePlayer((s) => s.unequip);
  const stats = statsOf(save);
  const { unspent } = save.statPoints;
  const primary = primaryStats(save);

  const gear = equippedStats(save);
  const worn = new Set(Object.values(save.equipped));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text size="xl">캐릭터</Text>

        <Panel title={`Lv ${save.player.level} 전사`}>
          <Bar label="HP" value={save.player.hp} max={stats.maxHp} color={colors.hp} />
          {/* MP를 쓰는 건 스킬(T18)이라 지금은 늘 가득 차 있다 */}
          <Bar label="MP" value={stats.maxMp} max={stats.maxMp} color={colors.exp} />
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
          <View style={styles.row}>
            <View style={styles.name}>
              <Text dim>지능 INT {primary.int}</Text>
              <Text size="sm" dim>
                MP +10 · 마법공격 +2 — 스킬이 생기면 배분할 수 있습니다
              </Text>
            </View>
          </View>
        </Panel>

        <Panel title="전투력">
          <Text size="sm" dim>
            ATK {stats.atk.toFixed(1)}
            {bonus(gear.atk)} · DEF {stats.def.toFixed(1)}
            {bonus(gear.def)} · SPD {stats.spd.toFixed(1)}
          </Text>
          <Text size="sm" dim>
            치명 {(stats.cri * 100).toFixed(1)}% (×{stats.crd.toFixed(2)}) · 회피{' '}
            {(stats.eva * 100).toFixed(1)}% · 마법공격 {stats.matk.toFixed(1)}
          </Text>
          <Text size="sm" dim>
            드랍 {(stats.dropRate * 100).toFixed(1)}% · 골드 +
            {(stats.goldFind * 100).toFixed(1)}%
          </Text>
        </Panel>

        <Panel title="장비">
          {GEAR_SLOTS.map((slot) => {
            const uid = save.equipped[slot];
            const item = uid === null ? undefined : save.inventory.find((i) => i.uid === uid);
            return (
              <View key={slot} style={styles.row}>
                <View style={styles.name}>
                  <Text>
                    {GEAR_SLOT_LABELS[slot]} — {item ? itemLabel(item) : '비어 있음'}
                  </Text>
                  {item ? <Text size="sm" dim>{statLine(item)}</Text> : null}
                </View>
                {item ? <Button label="해제" onPress={() => unequip(slot)} /> : null}
              </View>
            );
          })}
        </Panel>

        <Panel title={`가방 ${save.inventory.length}`}>
          {save.inventory.length === 0 ? (
            <Text size="sm" dim>
              비어 있습니다.
            </Text>
          ) : (
            save.inventory.map((item) => {
              const def = itemDef(item);
              const locked = save.player.level < def.level;
              return (
                <View key={item.uid} style={styles.row}>
                  <View style={styles.name}>
                    <Text color={worn.has(item.uid) ? colors.gold : colors.text}>
                      {itemLabel(item)}
                    </Text>
                    <Text size="sm" dim>
                      {GEAR_SLOT_LABELS[def.slot]} · {statLine(item)}
                      {locked ? ` · 요구 Lv${def.level}` : ''}
                    </Text>
                  </View>
                  {worn.has(item.uid) ? null : (
                    <Button label="장착" disabled={locked} onPress={() => equip(item.uid)} />
                  )}
                </View>
              );
            })
          )}
        </Panel>
      </ScrollView>
    </SafeAreaView>
  );
}

/** "ATK +12 HP +40 DEF +5" — 0인 항목은 뺀다. */
function statLine(item: ItemInstance): string {
  const s = itemStats(item);
  return (
    [
      s.atk > 0 ? `ATK +${s.atk}` : '',
      s.maxHp > 0 ? `HP +${s.maxHp}` : '',
      s.def > 0 ? `DEF +${s.def}` : '',
    ]
      .filter(Boolean)
      .join(' ') || '스탯 없음'
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  body: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { gap: space.xs, flexShrink: 1 },
});
