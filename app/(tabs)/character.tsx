import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GEAR_SLOT_LABELS, REGIONS } from '@/content';
import { expToNext, GEAR_SLOTS, STAT_PER_POINT, type GearSlot } from '@/game/formulas';
import {
  bagFull,
  bagItems,
  equippedRings,
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
import { trades, usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { EmptyCell, ItemCell, ItemGrid, ItemIcon, qualityTag, RingCell } from '@/ui/ItemCell';
import { Panel } from '@/ui/Panel';
import { ringName, ringText } from '@/ui/rings';
import { Text } from '@/ui/Text';
import { colors, rarity, space } from '@/ui/theme';

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
  {
    key: 'str',
    label: '힘 STR',
    effect: `ATK +${STAT_PER_POINT.str.atk} · 치명 피해 +${STAT_PER_POINT.str.crd}배`,
  },
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
      `치명 +${pp(STAT_PER_POINT.luk.cri)}` +
      ` · 드랍 +${pct(STAT_PER_POINT.luk.dropRate)} · 골드 +${pct(STAT_PER_POINT.luk.goldFind)}`,
  },
];

/**
 * 인형 배치 (T17_1). 3열 × 4행에 부위를 사람 모양으로 앉힌다. 하의는 다리 자리다 (T17_4).
 * null은 빈 칸 — 무기가 손 위치에 오려면 양옆이 비어 있어야 한다. 숫자는 반지 칸 번호다 (T17_7).
 */
const DOLL: (GearSlot | number | null)[][] = [
  [null, 'helm', null],
  ['weapon', 'armor', 'accessory'],
  ['gloves', 'pants', null],
  [0, 'boots', 1],
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
  const trade = usePlayer((s) => s.trade);
  const sortBag = usePlayer((s) => s.sortBag);

  const [tab, setTab] = useState<Tab>('캐릭터');
  /** 장비·가방 모두 보기 방식을 고를 수 있다 (T17_1). 취향이라 기본은 그림 쪽으로 둔다 */
  const [doll, setDoll] = useState(true);
  const [grid, setGrid] = useState(true);
  /** 부위 · 전체(null) · 소재 (T17_7 검수 4차 — 가방에서 소재를 본다) */
  const [filter, setFilter] = useState<GearSlot | '소재' | null>(null);
  /** 빈 칸을 누르면 그 부위에 낄 수 있는 것들을 편다 (T17_2) */
  const [picking, setPicking] = useState<GearSlot | null>(null);
  /** 빈 반지 칸을 누르면 안 낀 반지들을 편다 (T17_7) */
  const [pickingRing, setPickingRing] = useState<number | null>(null);

  const stats = statsOf(save);
  const { unspent } = save.statPoints;
  const primary = primaryStats(save);
  const cost = respecCost(save.player.level);
  const spent = STATS.reduce((sum, { key }) => sum + save.statPoints[key], 0);

  const gear = equippedStats(save);
  /** 장비가 주는 1차 스탯 — 장갑 STR · 신발 AGI · 장신구 LUK (T17_7 검수 5차). 체력은 안 준다 */
  const gearPrimary: Record<StatKey, number> = {
    str: gear.str,
    vit: 0,
    agi: gear.agi,
    luk: gear.luk,
  };

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
    setPickingRing(null);
  };

  const ringIn = (slot: number) => save.rings.find((r) => r.uid === save.ringSlots[slot]);
  /** 낀 반지 칸은 빼고, 빈 칸은 안 낀 반지를 편다 (T17_7) */
  const onRing = (slot: number) => {
    if (ringIn(slot)) {
      trade(trades.unequipRing(slot));
      setPickingRing(null);
    } else {
      setPickingRing((cur) => (cur === slot ? null : slot));
    }
    setPicking(null);
  };
  const spareRings = save.rings.filter((r) => !save.ringSlots.includes(r.uid));
  /** 가방의 반지 — 안 낀 것. 장신구라 전체·장신구에 같이 선다 (T17_7 검수 4차). 칸은 안 쓴다 */
  const bagRings = filter === null || filter === 'accessory' ? spareRings : [];
  /** 가방에서 반지를 누르면 빈 반지 칸에, 둘 다 차 있으면 첫 칸에 낀다 */
  const wearRing = (uid: string) => {
    const empty = save.ringSlots.indexOf(null);
    trade(trades.equipRing(uid, empty < 0 ? 0 : empty));
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
                      {bonus(gearPrimary[key])}
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
                드랍 +{((stats.dropMult - 1) * 100).toFixed(1)}% · 골드 +
                {((stats.goldMult - 1) * 100).toFixed(1)}%
              </Text>
              {/* 반지 (T17_7) — 전투력 축 밖의 효과라 한 줄씩 따로 적는다 */}
              {equippedRings(save).map((ring, i) => (
                <Text key={i} size="sm" color={rarity[ring.rarity]}>
                  {ringName(ring)} — {ringText(ring)}
                </Text>
              ))}
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
                          <EmptyCell key={j} />
                        ) : typeof slot === 'number' ? (
                          <RingCell key={j} ring={ringIn(slot)} onPress={() => onRing(slot)} />
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
                {save.ringSlots.map((_, slot) => {
                  const ring = ringIn(slot);
                  return (
                    <View key={`ring${slot}`} style={styles.row}>
                      <View style={styles.name}>
                        <Text color={ring && rarity[ring.rarity]}>
                          반지 {slot + 1} — {ring ? ringName(ring) : '비어 있음'}
                        </Text>
                        {ring ? (
                          <Text size="sm" dim>
                            {ringText(ring)}
                          </Text>
                        ) : null}
                      </View>
                      <Button
                        label={ring ? '해제' : '고르기'}
                        disabled={!ring && spareRings.length === 0}
                        onPress={() => onRing(slot)}
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

            {/* 빈 반지 칸을 눌렀을 때만 뜬다 (T17_7). 반지는 상점의 반지 탭에서 바꾸고 올린다 */}
            {pickingRing !== null && (
              <Panel title={`반지 ${pickingRing + 1} — 낄 수 있는 것`}>
                {spareRings.length === 0 ? (
                  <Text size="sm" dim>
                    안 낀 반지가 없습니다. 상점의 반지 탭에서 소재로 바꿉니다.
                  </Text>
                ) : (
                  spareRings.map((ring) => (
                    <View key={ring.uid} style={styles.row}>
                      <View style={styles.name}>
                        <Text color={rarity[ring.rarity]}>{ringName(ring)}</Text>
                        <Text size="sm" dim>
                          {ringText(ring)}
                        </Text>
                      </View>
                      <Button
                        label="장착"
                        tone="gold"
                        onPress={() => {
                          trade(trades.equipRing(ring.uid, pickingRing));
                          setPickingRing(null);
                        }}
                      />
                    </View>
                  ))
                )}
                <Button label="닫기" onPress={() => setPickingRing(null)} />
              </Panel>
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
              <Button
                label="소재"
                tone={filter === '소재' ? 'gold' : 'normal'}
                onPress={() => setFilter('소재')}
              />
            </View>

            {/* 소재 (T17_7 검수 4차) — 지역마다 사냥터 일곱 곳의 소재와 가진 수. 칸은 안 쓴다 */}
            {filter === '소재' ? (
              REGIONS.map((region) => (
                <Panel
                  key={region.id}
                  title={`${region.id}. ${region.name} — ${region.fields.reduce((n, f) => n + (save.materials[f.id] ?? 0), 0)}개`}
                >
                  {region.fields.map((f) => (
                    <View key={f.id} style={styles.row}>
                      <Text size="sm" dim={!save.materials[f.id]}>
                        {f.material.name}
                      </Text>
                      <Text size="sm" dim={!save.materials[f.id]}>
                        {f.name} · {save.materials[f.id] ?? 0}개
                      </Text>
                    </View>
                  ))}
                </Panel>
              ))
            ) : (
              <Panel title={`가방 ${unworn.length} / ${save.bag.capacity}`}>
                {bag.length === 0 && bagRings.length === 0 ? (
                  <Text size="sm" dim>
                    비어 있습니다.
                  </Text>
                ) : grid ? (
                  <ItemGrid>
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
                    {bagRings.map((ring) => (
                      <RingCell
                        key={`ring${ring.uid}`}
                        ring={ring}
                        onPress={() => wearRing(ring.uid)}
                      />
                    ))}
                  </ItemGrid>
                ) : (
                  <>
                    {bagRings.map((ring) => (
                      <View key={`ring${ring.uid}`} style={styles.row}>
                        <View style={styles.name}>
                          <Text color={rarity[ring.rarity]}>{ringName(ring)}</Text>
                          <Text size="sm" dim>
                            반지 · {ringText(ring)}
                          </Text>
                        </View>
                        <Button label="장착" onPress={() => wearRing(ring.uid)} />
                      </View>
                    ))}
                    {bag.map((item) => {
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
                    })}
                  </>
                )}
              </Panel>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 개체 아이콘. 그림은 정의(sprite)를 따른다. */
function Icon({ item, size }: { item?: ItemInstance; size: number }) {
  return <ItemIcon def={item && itemDef(item)} size={size} />;
}

/**
 * 개체 한 칸 — 그림 위에 품질·강화를 박는다 (T17_2). 칸 모양은 ItemCell이 정한다.
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
  return (
    <ItemCell
      def={item && itemDef(item)}
      item={item}
      tag={item && qualityTag(item)}
      label={label}
      dim={dim}
      onPress={onPress}
    />
  );
}

function statLine(item: ItemInstance): string {
  return statText(itemStats(item));
}

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
