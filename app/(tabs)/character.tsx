import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GEAR_SLOT_LABELS } from '@/content';
import { expToNext, GEAR_SLOTS, STAT_PER_POINT, type GearSlot } from '@/game/formulas';
import {
  bagFull,
  bagItems,
  equippedStats,
  itemDef,
  itemPower,
  itemStats,
  statText,
} from '@/game/items';
import {
  primaryStats,
  respecCost,
  RESPEC_FREE_BELOW,
  statsOf,
  type StatKey,
} from '@/game/progression';
import type { ItemInstance } from '@/save/schema';
import { usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { itemIcons } from '@/ui/itemIcons';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { border, colors, rarity, space } from '@/ui/theme';

const TABS = ['캐릭터', '장비', '가방'] as const;
type Tab = (typeof TABS)[number];

/** 확률 계수를 "%p"로. 0.0025 → "0.25%p" */
const pp = (v: number) => `${+(v * 100).toFixed(2)}%p`;
/** 배율에 더하는 몫을 "%"로. 0.01 → "1%" — 드랍·골드는 1점당 +1%씩 더해진다 (T17_4) */
const pct = (v: number) => `${+(v * 100).toFixed(2)}%`;

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
      ` · 장비 드랍 +${pct(STAT_PER_POINT.luk.dropRate)} · 골드 +${pct(STAT_PER_POINT.luk.goldFind)}`,
  },
];

/**
 * 인형 배치 (T17_1). 3열 × 4행에 부위를 사람 모양으로 앉힌다. 하의는 다리 자리다 (T17_4).
 * null은 빈 칸 — 무기가 손 위치에 오려면 양옆이 비어 있어야 한다.
 */
const DOLL: (GearSlot | null)[][] = [
  [null, 'helm', null],
  ['weapon', 'armor', 'accessory'],
  ['gloves', 'pants', null],
  [null, 'boots', null],
];

/** 장비가 얹어준 몫. 맨몸이 얼마인지 보여야 장비 값어치가 보인다 (§4.5). */
function bonus(value: number): string {
  return value > 0 ? ` (+${value})` : '';
}

export default function Character() {
  const save = usePlayer((s) => s.save);
  const allocate = usePlayer((s) => s.allocate);
  const respec = usePlayer((s) => s.respec);
  const equip = usePlayer((s) => s.equip);
  const unequip = usePlayer((s) => s.unequip);
  const sortBag = usePlayer((s) => s.sortBag);

  const [tab, setTab] = useState<Tab>('캐릭터');
  /** 장비·가방 모두 보기 방식을 고를 수 있다 (T17_1). 취향이라 기본은 그림 쪽으로 둔다 */
  const [doll, setDoll] = useState(true);
  const [grid, setGrid] = useState(true);
  const [filter, setFilter] = useState<GearSlot | null>(null);
  /** 빈 칸을 누르면 그 부위에 낄 수 있는 것들을 편다 (T17_2) */
  const [picking, setPicking] = useState<GearSlot | null>(null);

  const stats = statsOf(save);
  const { unspent } = save.statPoints;
  const primary = primaryStats(save);
  const cost = respecCost(save.player.level);
  const spent = STATS.reduce((sum, { key }) => sum + save.statPoints[key], 0);

  const gear = equippedStats(save);

  const equippedIn = (slot: GearSlot) => {
    const uid = save.equipped[slot];
    return uid === null ? undefined : save.inventory.find((i) => i.uid === uid);
  };

  /**
   * 가방에는 **안 낀 것만** 들어 있다 (T17_2). 낀 물건까지 같이 두면 같은 물건이
   * 두 군데 보여서, 어느 쪽을 눌러야 하는지가 매번 헷갈린다.
   */
  const unworn = bagItems(save);
  /** 차 있으면 못 벗는다 — 벗는 순간 한 칸이 필요해서다 (T17_3) */
  const full = bagFull(save);
  const bag = unworn.filter((i) => filter === null || itemDef(i).slot === filter);

  /** 낀 칸은 벗고, 빈 칸은 후보를 편다 (T17_2). */
  const onSlot = (slot: GearSlot) => {
    if (equippedIn(slot)) {
      unequip(slot);
      setPicking(null);
    } else {
      setPicking((cur) => (cur === slot ? null : slot));
    }
  };

  /** 그 부위에 지금 낄 수 있는 것들. 센 것부터 — 고르려고 여는 목록이라서다 */
  const candidates = (slot: GearSlot) =>
    unworn
      .filter((i) => itemDef(i).slot === slot && save.player.level >= itemDef(i).level)
      .sort((a, b) => itemPower(b) - itemPower(a));

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text size="xl">캐릭터</Text>
        <Text size="sm" dim>
          Lv {save.player.level}
        </Text>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => (
          <Button
            key={t}
            label={t}
            tone={t === tab ? 'gold' : 'normal'}
            onPress={() => setTab(t)}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {tab === '캐릭터' && (
          <>
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

              {/* 재분배 (§4.3). 되돌리면 현재 HP가 새 최대치로 잘린다 — 비율은 안 지킨다 */}
              <View style={styles.row}>
                <View style={styles.name}>
                  <Text size="sm" dim>
                    {cost === 0
                      ? `Lv${RESPEC_FREE_BELOW} 전까지는 재분배가 무료입니다`
                      : `재분배 ${cost.toLocaleString()} WP · 지금 ${save.wp.current.toLocaleString()} WP`}
                  </Text>
                  <Text size="sm" dim>
                    되돌리면 HP가 새 최대치까지 잘립니다
                  </Text>
                </View>
                <Button
                  label="재분배"
                  disabled={spent === 0 || save.wp.current < cost}
                  onPress={respec}
                />
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
                장비 드랍 +{((stats.dropMult - 1) * 100).toFixed(1)}% · 골드 +
                {((stats.goldMult - 1) * 100).toFixed(1)}%
              </Text>
            </Panel>
          </>
        )}

        {tab === '장비' && (
          <>
            <View style={styles.tabs}>
              <Button label="인형" tone={doll ? 'gold' : 'normal'} onPress={() => setDoll(true)} />
              <Button label="목록" tone={doll ? 'normal' : 'gold'} onPress={() => setDoll(false)} />
            </View>

            {doll ? (
              <Panel title="장비 — 낀 칸은 벗고, 빈 칸은 후보를 엽니다">
                <View style={styles.doll}>
                  {/* 실루엣. 칸 뒤에 깔아 사람 모양만 잡아준다 — 캐릭터 그림은 아직 없다 */}
                  <View style={styles.silhouette} pointerEvents="none">
                    <View style={styles.head} />
                    <View style={styles.torso} />
                    <View style={styles.legs} />
                  </View>
                  {DOLL.map((line, i) => (
                    <View key={i} style={styles.dollRow}>
                      {line.map((slot, j) =>
                        slot === null ? (
                          <View key={j} style={styles.cell} />
                        ) : (
                          <Slot
                            key={j}
                            label={GEAR_SLOT_LABELS[slot]}
                            item={equippedIn(slot)}
                            onPress={() => onSlot(slot)}
                          />
                        ),
                      )}
                    </View>
                  ))}
                </View>
              </Panel>
            ) : (
              <Panel title="장비">
                {GEAR_SLOTS.map((slot) => {
                  const item = equippedIn(slot);
                  return (
                    <View key={slot} style={styles.row}>
                      <View style={styles.itemRow}>
                        <Icon item={item} size={36} />
                        <View style={styles.name}>
                          <Text>
                            {GEAR_SLOT_LABELS[slot]} — {item ? itemDef(item).name : '비어 있음'}
                            {item && item.enhance > 0 ? ` +${item.enhance}` : ''}
                          </Text>
                          {item ? (
                            <Text size="sm" dim>
                              품질 {Math.round(item.quality * 100)}% · {statLine(item)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                      <Button
                        label={item ? '해제' : '고르기'}
                        disabled={item ? full : candidates(slot).length === 0}
                        onPress={() => onSlot(slot)}
                      />
                    </View>
                  );
                })}
              </Panel>
            )}

            {full && (
              <Text size="sm" color={colors.hp}>
                가방이 꽉 차서 벗을 수 없습니다 ({unworn.length}/{save.bag.capacity}) — 상점에서
                팔거나 가방을 늘리세요.
              </Text>
            )}

            {/* 빈 칸을 눌렀을 때만 뜬다. 낄 수 있는 것만, 센 것부터 (T17_2) */}
            {picking && (
              <Panel title={`${GEAR_SLOT_LABELS[picking]} — 낄 수 있는 것`}>
                {candidates(picking).length === 0 ? (
                  <Text size="sm" dim>
                    가진 게 없습니다. 상점에서 사거나 사냥터에서 얻으세요.
                  </Text>
                ) : (
                  candidates(picking).map((item) => (
                    <View key={item.uid} style={styles.row}>
                      <View style={styles.itemRow}>
                        <Icon item={item} size={36} />
                        <View style={styles.name}>
                          <Text color={rarity[itemDef(item).rarity]}>
                            {itemDef(item).name}
                            {item.enhance > 0 ? ` +${item.enhance}` : ''} (
                            {Math.round(item.quality * 100)}%)
                          </Text>
                          <Text size="sm" dim>
                            {statLine(item)}
                          </Text>
                        </View>
                      </View>
                      <Button
                        label="장착"
                        tone="gold"
                        onPress={() => {
                          equip(item.uid);
                          setPicking(null);
                        }}
                      />
                    </View>
                  ))
                )}
                <Button label="닫기" onPress={() => setPicking(null)} />
              </Panel>
            )}
          </>
        )}

        {tab === '가방' && (
          <>
            <View style={styles.tabs}>
              <Button label="격자" tone={grid ? 'gold' : 'normal'} onPress={() => setGrid(true)} />
              <Button label="목록" tone={grid ? 'normal' : 'gold'} onPress={() => setGrid(false)} />
              {/* 누를 때마다 그 시점 기준으로 다시 줄 세운다. 뒤에 얻는 건 다시 맨 뒤로 */}
              <Button label="성능순 정렬" onPress={sortBag} />
            </View>

            <View style={styles.tabs}>
              <Button
                label="전체"
                tone={filter === null ? 'gold' : 'normal'}
                onPress={() => setFilter(null)}
              />
              {GEAR_SLOTS.map((slot) => (
                <Button
                  key={slot}
                  label={GEAR_SLOT_LABELS[slot]}
                  tone={filter === slot ? 'gold' : 'normal'}
                  onPress={() => setFilter(slot)}
                />
              ))}
            </View>

            <Panel title={`가방 ${unworn.length} / ${save.bag.capacity}`}>
              {bag.length === 0 ? (
                <Text size="sm" dim>
                  비어 있습니다.
                </Text>
              ) : grid ? (
                <View style={styles.grid}>
                  {bag.map((item) => {
                    const locked = save.player.level < itemDef(item).level;
                    return (
                      <Slot
                        key={item.uid}
                        item={item}
                        dim={locked}
                        onPress={() => !locked && equip(item.uid)}
                      />
                    );
                  })}
                </View>
              ) : (
                bag.map((item) => {
                  const def = itemDef(item);
                  const locked = save.player.level < def.level;
                  return (
                    <View key={item.uid} style={styles.row}>
                      <View style={styles.itemRow}>
                        <Icon item={item} size={36} />
                        <View style={styles.name}>
                          <Text color={rarity[def.rarity]}>
                            {def.name}
                            {item.enhance > 0 ? ` +${item.enhance}` : ''} (
                            {Math.round(item.quality * 100)}%)
                          </Text>
                          <Text size="sm" dim>
                            {GEAR_SLOT_LABELS[def.slot]} · {statLine(item)}
                            {locked ? ` · 요구 Lv${def.level}` : ''}
                          </Text>
                        </View>
                      </View>
                      <Button label="장착" disabled={locked} onPress={() => equip(item.uid)} />
                    </View>
                  );
                })
              )}
            </Panel>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 아이콘. 아직 1차분만 넣어서 없는 sprite가 많다 — 없으면 빈 칸으로 자리만 잡는다. */
function Icon({ item, size }: { item?: ItemInstance; size: number }) {
  const source = item ? itemIcons[itemDef(item).sprite] : undefined;
  const box = { width: size, height: size };
  if (!source) return <View style={box} />;
  return <Image source={source} style={box} resizeMode="contain" />;
}

/**
 * 격자 한 칸 (T17_1, T17_2). **테두리 색이 등급**이고,
 * 그림이 칸을 꽉 채운 위에 품질·강화를 아래쪽에 겹쳐 박는다 — 그림이 커야 뭘 주웠는지 보인다.
 * 가방에는 안 낀 것만 들어오므로 "낀 물건" 표시는 없다.
 */
function Slot({
  item,
  label,
  dim,
  onPress,
}: {
  item?: ItemInstance;
  label?: string;
  dim?: boolean;
  onPress?: () => void;
}) {
  const def = item && itemDef(item);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.cell, { borderColor: def ? rarity[def.rarity] : colors.edge }]}
    >
      <Icon item={item} size={CELL - border * 2} />
      {item ? (
        <View style={styles.tag}>
          <Text size="sm" dim={dim}>
            {Math.round(item.quality * 100)}%{item.enhance > 0 ? ` +${item.enhance}` : ''}
          </Text>
        </View>
      ) : (
        <View style={styles.tag}>
          <Text size="sm" dim>
            {label ?? ''}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function statLine(item: ItemInstance): string {
  return statText(itemStats(item));
}

const CELL = 84;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  tabs: {
    flexDirection: 'row',
    gap: space.sm,
    flexWrap: 'wrap',
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
  body: { padding: space.lg, gap: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  name: { gap: space.xs, flexShrink: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  cell: {
    width: CELL,
    height: CELL,
    borderWidth: border,
    borderColor: colors.edge,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 그림 위에 겹쳐 박는다. 반투명 바탕이 없으면 밝은 그림에서 글씨가 안 보인다
  tag: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(26, 22, 38, 0.75)',
  },

  doll: { gap: space.sm, alignItems: 'center' },
  dollRow: { flexDirection: 'row', gap: space.sm },
  silhouette: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  head: { width: 28, height: 28, backgroundColor: colors.edge },
  torso: { width: 52, height: 72, backgroundColor: colors.edge, marginTop: space.xs },
  legs: { width: 34, height: 60, backgroundColor: colors.edge, marginTop: space.xs },
});
