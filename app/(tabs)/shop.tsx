import { useState, type ReactElement, type ReactNode } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  equipmentById,
  GEAR_SLOT_LABELS,
  regionById,
  shopConsumables,
  shopGear,
  type Equipment,
} from '@/content';
import {
  depositNet,
  enhancePick,
  pickMaterials,
  ringEnhancePick,
  ringNext,
  ringPrice,
  sellPrice,
} from '@/game/economy';
import { inTown } from '@/game/field';
import {
  BAG,
  bagExpandCost,
  ENHANCE_MAX,
  enhanceCost,
  enhanceExpected,
  enhanceMaterials,
  enhanceRate,
  GEAR_SLOTS,
  RING_COST,
  ringValue,
  VAULT,
  vaultExpandCost,
  type GearSlot,
} from '@/game/formulas';
import { bagFull, bagItems, itemDef, itemLabel, statText } from '@/game/items';
import type { ItemInstance, Ring } from '@/save/schema';
import { statsOf } from '@/game/progression';
import { trades, usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { ItemCell, ItemGrid, ItemIcon, ItemInfo, Popup, qualityTag, RingCell } from '@/ui/ItemCell';
import { MaterialPicker, usePicked } from '@/ui/MaterialPicker';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { RARITY_LABEL, RING_INFO, ringName, ringText } from '@/ui/rings';
import { colors, rarity, space } from '@/ui/theme';

const TABS = ['상점', '강화', '여관', '창고', '반지'] as const;
type Tab = (typeof TABS)[number];

/** 한 줄 = (그림) 이름·설명 + 버튼. 상점 전체가 이 모양이라 화면 안에 둔다. */
function Row({
  title,
  detail,
  action,
  disabled,
  onPress,
  tone,
  icon,
}: {
  /** 비우면 줄에 이름을 안 쓴다 — 격자 창 안에서는 위의 ItemInfo가 이미 보여준다 */
  title?: string;
  detail: string;
  action: string;
  disabled?: boolean;
  onPress: () => void;
  tone?: 'normal' | 'gold';
  /** 장비면 그림을 앞에 붙인다 (T17_6). 물약·여관 줄은 그림이 없다 */
  icon?: Equipment;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.itemRow}>
        {icon && <ItemIcon def={icon} size={36} />}
        <View style={styles.name}>
          {title ? <Text>{title}</Text> : null}
          <Text size="sm" dim>
            {detail}
          </Text>
        </View>
      </View>
      <Button label={action} disabled={disabled} tone={tone} onPress={onPress} />
    </View>
  );
}

/**
 * 한 줄 + 쓸 소재 고르기 (T17_7 검수 4차) — 장비 강화 · 반지 교환 · 올리기 · 강화가 같이 쓴다.
 * 소재가 드는 줄이면 아래에 고르는 칸이 붙는다. 처음엔 가진 게 많은 곳부터 채워 두니 그냥 눌러도 된다.
 * **부르는 쪽이 key에 단계를 넣는다** — 성공해서 단계가 오르면(쓸 개수가 바뀌면) 새로 채운다.
 */
function PickRow({
  region,
  need,
  auto,
  disabled,
  onPress,
  ...row
}: {
  title?: string;
  detail: string;
  action: string;
  tone?: 'normal' | 'gold';
  icon?: Equipment;
  disabled?: boolean;
  region: number;
  /** 쓸 소재 수. 0이면 고르는 칸이 없다 */
  need: number;
  /** 알아서 고른 것 — 처음에 채워 둔다. 모자라면 null */
  auto: readonly string[] | null;
  onPress: (picked: string[]) => void;
}) {
  const owned = usePlayer((s) => s.save.materials);
  const [picked, setPicked] = usePicked(auto);
  return (
    <>
      <Row {...row} disabled={disabled || picked.length < need} onPress={() => onPress(picked)} />
      {need > 0 && (
        <MaterialPicker
          region={region}
          need={need}
          distinct
          owned={owned}
          picked={picked}
          onChange={setPicked}
        />
      )}
    </>
  );
}

/**
 * 되돌릴 수 없는 거래는 한 번 더 묻는다 (T17_6 검수) — 장비 사고팔기 · 교환 · 확장.
 * 물약은 자주 사는 거라 안 묻고, 강화는 연달아 두드리는 거라 안 묻는다.
 */
function confirm(title: string, message: string, action: string, onOk: () => void) {
  Alert.alert(title, message, [
    { text: '취소', style: 'cancel' },
    { text: action, onPress: onOk },
  ]);
}

/**
 * 장비 목록을 격자나 줄로 편다 (T17_6) — 가방 탭과 같은 칸(ItemCell)을 쓴다.
 * 격자는 **눌러서 고르면 창이 뜨고, 그 안에서 사고판다** (T17_6 검수). 전에는 고른 것의 줄이
 * 목록 맨 아래에 붙어서, 목록이 길면 위쪽 칸을 눌러도 줄이 화면 밖이라 안 보였다.
 * 칸을 누르자마자 사거나 팔지는 않는다 — 스크롤하다 잘못 건드린 한 번이 골드로 나간다.
 */
function ItemList<T>({
  items,
  grid,
  keyOf,
  defOf,
  instOf,
  tagOf,
  row,
  empty,
  note,
}: {
  items: T[];
  grid: boolean;
  keyOf: (item: T) => string;
  defOf: (item: T) => Equipment;
  /** 가진 물건이면 개체를 준다 — 꾹 눌렀을 때 품질·강화가 붙은 스탯이 뜬다 */
  instOf?: (item: T) => ItemInstance;
  tagOf: (item: T) => string;
  /** 줄 하나. `compact`면 창 안이라 그림·이름을 빼고 설명과 버튼만 */
  row: (item: T, compact?: boolean) => ReactElement;
  empty: string;
  /** 창에 같이 띄울 것 — 강화 결과 한 줄 */
  note?: ReactNode;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  if (items.length === 0) {
    return (
      <Text size="sm" dim>
        {empty}
      </Text>
    );
  }
  if (!grid)
    return (
      <>
        {items.map((item) => (
          <View key={keyOf(item)}>{row(item)}</View>
        ))}
      </>
    );

  const chosen = items.find((item) => keyOf(item) === picked);
  return (
    <>
      <ItemGrid>
        {items.map((item) => (
          <ItemCell
            key={keyOf(item)}
            def={defOf(item)}
            item={instOf?.(item)}
            tag={tagOf(item)}
            selected={keyOf(item) === picked}
            onPress={() => setPicked(keyOf(item))}
          />
        ))}
      </ItemGrid>
      <Popup visible={chosen !== undefined} onClose={() => setPicked(null)}>
        {chosen !== undefined && (
          <>
            <ItemInfo def={defOf(chosen)} item={instOf?.(chosen)} />
            {note}
            {row(chosen, true)}
          </>
        )}
      </Popup>
    </>
  );
}

export default function Shop() {
  const save = usePlayer((s) => s.save);
  const trade = usePlayer((s) => s.trade);
  const enhance = usePlayer((s) => s.enhance);
  const enhanceRing = usePlayer((s) => s.enhanceRing);
  const [tab, setTab] = useState<Tab>('상점');
  const [amount, setAmount] = useState(1_000);
  /** 마지막 강화 결과. 성공·실패를 한 줄로 보여주려고 들고 있는다 */
  const [lastEnhance, setLastEnhance] = useState<string | null>(null);
  /** 반지 탭의 마지막 결과 한 줄 (T17_7) */
  const [lastRing, setLastRing] = useState<string | null>(null);
  /** 장비 목록을 격자로 볼지 (T17_6). 가방 탭처럼 그림 쪽이 기본이다 */
  const [grid, setGrid] = useState(true);
  const [slot, setSlot] = useState<GearSlot | null>(null);
  /** 강화 탭 격자에서 연 반지 (T17_7 검수 4차) */
  const [openRing, setOpenRing] = useState<string | null>(null);

  const region = regionById(save.regionProgress.current);
  const stats = statsOf(save);
  const gold = save.player.gold;
  const bySlot = (s: GearSlot) => slot === null || s === slot;
  const equipped = new Set(Object.values(save.equipped));

  // **지금 지역의 티어 두 개**를 편다 (T17_6 검수). 레벨이 모자란 뒷단도 보여준다 — 미리 사 둔다
  const stock = shopGear(region.id);
  const tiers = stock.map((e) => e.tier);
  const onSale = stock.filter((e) => bySlot(e.slot));
  const sellable = save.inventory.filter((i) => !equipped.has(i.uid) && bySlot(itemDef(i).slot));
  const upgradable = save.inventory.filter((i) => bySlot(itemDef(i).slot));

  /** 격자·목록 전환과 부위 필터. 상점과 강화 탭이 같이 쓴다 */
  const viewBar = (
    <>
      <View style={styles.tabs}>
        <Button label="격자" tone={grid ? 'gold' : 'normal'} onPress={() => setGrid(true)} />
        <Button label="목록" tone={grid ? 'normal' : 'gold'} onPress={() => setGrid(false)} />
      </View>
      <View style={styles.tabs}>
        <Button
          label="전체"
          tone={slot === null ? 'gold' : 'normal'}
          onPress={() => setSlot(null)}
        />
        {GEAR_SLOTS.map((s) => (
          <Button
            key={s}
            label={GEAR_SLOT_LABELS[s]}
            tone={slot === s ? 'gold' : 'normal'}
            onPress={() => setSlot(s)}
          />
        ))}
      </View>
    </>
  );

  const enhanceRow = (item: ItemInstance, compact?: boolean) => {
    const def = itemDef(item);
    const next = item.enhance + 1;
    const maxed = item.enhance >= ENHANCE_MAX;
    const cost = maxed ? 0 : enhanceCost(def.price, next);
    // +6부터는 그 장비 지역의 서로 다른 사냥터 소재가 든다 (T17_6 검수) — 쓸 것을 고른다 (4차)
    const need = maxed ? 0 : enhanceMaterials(next);
    const worn = equipped.has(item.uid);
    return (
      <PickRow
        key={`${item.uid}-${item.enhance}`}
        icon={compact ? undefined : def}
        title={compact ? undefined : `${worn ? '[착용] ' : ''}${itemLabel(item)}`}
        detail={
          (compact && worn ? '착용 중 · ' : '') +
          (maxed
            ? '최대 단계입니다'
            : `+${next} 성공률 ${(enhanceRate(next) * 100).toFixed(0)}% · ${cost.toLocaleString()}G` +
              ` · +10까지 기대 ${enhanceExpected(def.price).gold.toLocaleString()}G`)
        }
        action={maxed ? '완료' : '강화'}
        tone={worn ? 'gold' : 'normal'}
        disabled={maxed || gold < cost}
        region={def.region}
        need={need}
        auto={need > 0 ? enhancePick(save, item) : null}
        onPress={(picked) => {
          const r = enhance(item.uid, need > 0 ? picked : undefined);
          if (!r) return;
          setLastEnhance(
            r.success
              ? `성공! ${def.name} +${r.step} (${r.cost.toLocaleString()}G` +
                  (r.materials > 0 ? ` · 소재 ${r.materials}개` : '') +
                  ')'
              : `실패… +${r.step} 못 붙었습니다 (${r.cost.toLocaleString()}G — 소재는 그대로)`,
          );
        }}
      />
    );
  };
  const worn = new Set(save.ringSlots);

  /**
   * 반지 하나 (T17_7) — 이름·효과, 그 아래 [올리기] · [강화]. 강화 탭의 장신구에 같이 선다 (T17_7 검수 4차).
   * 올려도 강화 단계는 그대로다 — 다음 등급 값에 지금 강화가 곱해진 값을 미리 보여준다.
   */
  const ringBlock = (ring: Ring) => {
    const next = ringNext(ring);
    const maxed = ring.enhance >= ENHANCE_MAX;
    const step = ring.enhance + 1;
    const cost = maxed ? 0 : enhanceCost(ringPrice(ring), step);
    const need = maxed ? 0 : enhanceMaterials(step);
    return (
      <>
        <Text color={rarity[ring.rarity]}>
          {ringName(ring)}
          {worn.has(ring.uid) ? ' [착용]' : ''}
        </Text>
        <Text size="sm" dim>
          {RARITY_LABEL[ring.rarity]} · {ringText(ring)}
        </Text>
        <PickRow
          key={`up-${ring.uid}-${ring.tier}-${ring.rarity}`}
          detail={
            next
              ? `→ ${RARITY_LABEL[next.rarity]}${next.tier !== ring.tier ? ` ★${next.tier}` : ''} (` +
                RING_INFO[ring.kind].effect(
                  ringValue(ring.kind, next.tier, next.rarity, ring.enhance),
                ) +
                ')'
              : '★5 전설 — 더 못 올립니다'
          }
          action="올리기"
          disabled={!next}
          region={next?.tier ?? ring.tier}
          need={next?.cost ?? 0}
          auto={next ? pickMaterials(save, next.tier, next.cost, true) : null}
          onPress={(picked) =>
            next &&
            confirm(
              '올릴까요?',
              `${ringName(ring)} → ${RARITY_LABEL[next.rarity]} ★${next.tier}`,
              '올리기',
              () => {
                if (trade(trades.upgradeRing(ring.uid, picked))) {
                  setLastRing(`올렸습니다 — ${RING_INFO[ring.kind].name} ★${next.tier}`);
                }
              },
            )
          }
        />
        <PickRow
          key={`en-${ring.uid}-${ring.enhance}`}
          detail={
            maxed
              ? '강화 최대 단계입니다'
              : `+${step} 성공률 ${(enhanceRate(step) * 100).toFixed(0)}% · ${cost.toLocaleString()}G`
          }
          action="강화"
          disabled={maxed || gold < cost}
          region={ring.tier}
          need={need}
          auto={need > 0 ? ringEnhancePick(save, ring) : null}
          onPress={(picked) => {
            const r = enhanceRing(ring.uid, need > 0 ? picked : undefined);
            if (!r) return;
            setLastRing(
              r.success
                ? `성공! ${RING_INFO[ring.kind].name} +${r.step} (${r.cost.toLocaleString()}G` +
                    (r.materials > 0 ? ` · 소재 ${r.materials}개` : '') +
                    ')'
                : `실패… +${r.step} 못 붙었습니다 (${r.cost.toLocaleString()}G — 소재는 그대로)`,
            );
          }}
        />
      </>
    );
  };
  const shownRing = save.rings.find((r) => r.uid === openRing);

  // 가방이 차면 사도 들어갈 데가 없다. 버튼만 안 먹으면 왜 안 되는지 모른다 (T17_3)
  const full = bagFull(save);
  const fullNote = full && (
    <Text size="sm" color={colors.hp}>
      가방이 꽉 찼습니다 ({bagItems(save).length}/{save.bag.capacity}) — 상점 탭의 [가방]에서
      늘리거나 [팔기]로 비우세요.
    </Text>
  );

  // 창고·여관·상점은 마을에서만이다 (§3.7). 아무 데서나 되면 사냥터 나올 때마다
  // 예치 버튼을 누르는 게 최적 플레이가 되고, 그건 게임이 아니라 잡일이다.
  if (!inTown(save)) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <Text size="xl">{region.town.name}</Text>
        <Panel>
          <Text>사냥터 안에서는 이용할 수 없습니다.</Text>
          <Text size="sm" dim>
            물약은 들고 들어간 것만 쓸 수 있습니다 (§4.4).
          </Text>
        </Panel>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text size="xl">{region.town.name}</Text>
        <Text color={colors.gold}>{gold.toLocaleString()} G</Text>
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
        {tab === '상점' && (
          <>
            <Panel title="물약">
              {shopConsumables(region.id).map((c) => (
                <Row
                  key={c.id}
                  title={`${c.name} × ${save.consumables[c.id] ?? 0}`}
                  detail={`${c.heal > 0 ? `HP +${c.heal}` : `HP ${c.healRatio * 100}% 회복`} · ${c.price}G`}
                  action="구매"
                  disabled={gold < c.price}
                  onPress={() => trade(trades.buyConsumable(c.id))}
                />
              ))}
              <Text size="sm" dim>
                사냥터에는 3개까지 들고 갑니다. 쓰는 건 전투 중에 (T16).
              </Text>
            </Panel>

            {viewBar}

            <Panel
              title={`장비 — 티어 ${Math.min(...tiers)}~${Math.max(...tiers)} (${region.name})`}
            >
              <Text size="sm" dim>
                전설은 팔지 않습니다 — 몬스터에게서만 나옵니다.
              </Text>
              {fullNote}
              <ItemList
                items={onSale}
                grid={grid}
                keyOf={(e) => e.id}
                defOf={(e) => e}
                tagOf={(e) => `${e.price.toLocaleString()}G`}
                empty="이 부위는 파는 게 없습니다."
                row={(e, compact) => (
                  <Row
                    icon={compact ? undefined : e}
                    title={compact ? undefined : e.name}
                    detail={
                      `${GEAR_SLOT_LABELS[e.slot]} · ${statText(e)} · ${e.price.toLocaleString()}G` +
                      // 레벨이 모자라도 산다 — 미리 사 두고 레벨이 되면 낀다
                      (e.level > save.player.level ? ` · 착용 Lv${e.level}` : '')
                    }
                    action="구매"
                    disabled={full || gold < e.price}
                    onPress={() =>
                      confirm(
                        '구매할까요?',
                        `${e.name} · ${e.price.toLocaleString()}G`,
                        '구매',
                        () => trade(trades.buyEquipment(e.id)),
                      )
                    }
                  />
                )}
              />
            </Panel>

            <Panel title={`가방 — ${bagItems(save).length} / ${save.bag.capacity}칸`}>
              <Row
                title={`가방 ${BAG.step}칸 늘리기`}
                detail={
                  save.bag.expansions >= BAG.maxExpansions
                    ? `더 못 늘립니다 (${BAG.maxExpansions}회 상한)`
                    : `${bagExpandCost(save.bag.expansions).toLocaleString()}G · ${save.bag.capacity} → ${save.bag.capacity + BAG.step}칸`
                }
                action="확장"
                disabled={
                  save.bag.expansions >= BAG.maxExpansions ||
                  gold < bagExpandCost(save.bag.expansions)
                }
                onPress={() =>
                  confirm(
                    '가방을 늘릴까요?',
                    `${bagExpandCost(save.bag.expansions).toLocaleString()}G · ${save.bag.capacity} → ${save.bag.capacity + BAG.step}칸`,
                    '확장',
                    () => trade(trades.expandBag()),
                  )
                }
              />
              <Text size="sm" dim>
                낀 장비는 칸을 안 씁니다. 가방이 차면 드랍을 못 줍고 장비도 못 벗습니다.
              </Text>
            </Panel>

            <Panel title="팔기 — 낀 것은 안 팝니다">
              <ItemList
                items={sellable}
                grid={grid}
                keyOf={(i) => i.uid}
                defOf={itemDef}
                instOf={(i) => i}
                tagOf={(i) => `${sellPrice(i).toLocaleString()}G`}
                empty="팔 게 없습니다."
                row={(item, compact) => (
                  <Row
                    icon={compact ? undefined : itemDef(item)}
                    title={compact ? undefined : itemLabel(item)}
                    detail={`${GEAR_SLOT_LABELS[equipmentById(item.defId).slot]} · ${sellPrice(item).toLocaleString()}G`}
                    action="팔기"
                    onPress={() =>
                      confirm(
                        '팔까요?',
                        `${itemLabel(item)} · ${sellPrice(item).toLocaleString()}G`,
                        '팔기',
                        () => trade(trades.sellItem(item.uid)),
                      )
                    }
                  />
                )}
              />
            </Panel>
          </>
        )}

        {tab === '강화' && (
          <>
            {viewBar}
            <Panel title="강화 — 실패해도 단계는 안 내려갑니다">
              {lastEnhance && <Text color={colors.gold}>{lastEnhance}</Text>}
              <Text size="sm" dim>
                골드만 사라집니다. 장비가 깨지거나 단계가 떨어지지는 않습니다. 금색 버튼이 낀
                장비입니다.
              </Text>
              <Text size="sm" dim>
                +6부터는 그 장비 지역의 소재가 서로 다른 사냥터에서 1 · 2 · 3 · 4 · 7종 듭니다 —
                성공했을 때만 씁니다. 쓸 소재는 눌러서 고릅니다.
              </Text>
              <ItemList
                items={upgradable}
                grid={grid}
                keyOf={(i) => i.uid}
                defOf={itemDef}
                instOf={(i) => i}
                tagOf={(i) => `${equipped.has(i.uid) ? '착용 ' : ''}${qualityTag(i)}`}
                empty="강화할 장비가 없습니다."
                row={enhanceRow}
                note={lastEnhance && <Text color={colors.gold}>{lastEnhance}</Text>}
              />
            </Panel>

            {/* 반지는 장신구다 (T17_7 검수 4차) — 올리기와 강화를 여기서 한다 */}
            {(slot === null || slot === 'accessory') && (
              <Panel title={`반지 ${save.rings.length}개 — 올리기 · 강화`}>
                {lastRing && <Text color={colors.gold}>{lastRing}</Text>}
                <Text size="sm" dim>
                  올리기: 등급을 하나씩, 전설 다음은 다음 지역 소재로 ★ 하나 위 일반이 됩니다 — 그
                  순간은 전보다 약하지만 더 높이 갑니다. 소재만 들고, 강화 단계는 그대로입니다.
                </Text>
                {save.rings.length === 0 ? (
                  <Text size="sm" dim>
                    아직 없습니다. 반지 탭에서 소재로 바꿉니다.
                  </Text>
                ) : grid ? (
                  <>
                    <ItemGrid>
                      {save.rings.map((ring) => (
                        <RingCell
                          key={ring.uid}
                          ring={ring}
                          selected={ring.uid === openRing}
                          onPress={() => setOpenRing(ring.uid)}
                        />
                      ))}
                    </ItemGrid>
                    <Popup visible={shownRing !== undefined} onClose={() => setOpenRing(null)}>
                      {shownRing && ringBlock(shownRing)}
                      {lastRing && <Text color={colors.gold}>{lastRing}</Text>}
                    </Popup>
                  </>
                ) : (
                  save.rings.map((ring) => (
                    <View key={ring.uid} style={styles.ring}>
                      {ringBlock(ring)}
                    </View>
                  ))
                )}
              </Panel>
            )}
          </>
        )}

        {tab === '여관' && (
          <Panel title={`${region.town.name}의 여관`}>
            <Bar label="HP" value={save.player.hp} max={stats.maxHp} color={colors.hp} />
            <Row
              title="하룻밤 묵는다"
              detail={`${region.town.inn.toLocaleString()}G · HP를 전부 회복합니다`}
              action="묵는다"
              tone="gold"
              disabled={gold < region.town.inn || save.player.hp >= stats.maxHp}
              onPress={() => trade(trades.stayInn(region.town.inn))}
            />
            <Text size="sm" dim>
              그냥 두면 10분마다 최대 HP의 1%씩 저절로 찹니다.
            </Text>
          </Panel>
        )}

        {tab === '창고' && (
          <Panel title="창고">
            <Text>
              보관 {save.vault.gold.toLocaleString()} / {save.vault.capacity.toLocaleString()} G
            </Text>
            <Text size="sm" dim>
              죽어도 창고 골드는 안 잃습니다. 넘치는 만큼은 들고 다녀야 합니다.
            </Text>
            <View style={styles.tabs}>
              {[1_000, 10_000, 100_000].map((v) => (
                <Button
                  key={v}
                  label={v.toLocaleString()}
                  tone={v === amount ? 'gold' : 'normal'}
                  onPress={() => setAmount(v)}
                />
              ))}
            </View>
            {/* 넣은 액수와 들어간 액수가 다르다. 그 차이를 골드로 못 박아 둔다 */}
            <Row
              title={`${amount.toLocaleString()}G 내고 ${depositNet(amount).toLocaleString()}G 넣기`}
              detail={`수수료 ${VAULT.fee * 100}% = ${(amount - depositNet(amount)).toLocaleString()}G — 넣고 바로 빼면 그만큼 손해입니다`}
              action="입금"
              disabled={gold < amount || save.vault.gold + depositNet(amount) > save.vault.capacity}
              onPress={() => trade(trades.deposit(amount))}
            />
            <Row
              title="소지 골드 전부 넣기"
              detail={`${gold.toLocaleString()}G → ${depositNet(gold).toLocaleString()}G`}
              action="전액"
              disabled={gold <= 0 || save.vault.gold + depositNet(gold) > save.vault.capacity}
              onPress={() => trade(trades.deposit(gold))}
            />
            <Row
              title={`${Math.min(amount, save.vault.gold).toLocaleString()}G 찾기`}
              detail="출금은 수수료가 없습니다 — 낸 만큼 그대로 나옵니다"
              action="출금"
              disabled={save.vault.gold <= 0}
              onPress={() => trade(trades.withdraw(Math.min(amount, save.vault.gold)))}
            />
            <Row
              title={`한도 확장 (${save.vault.expansions}/${VAULT.maxExpansions})`}
              detail={
                save.vault.expansions >= VAULT.maxExpansions
                  ? '더 늘릴 수 없습니다'
                  : `${vaultExpandCost(save.vault.capacity).toLocaleString()}G → 한도 ${(save.vault.capacity * VAULT.step).toLocaleString()}G`
              }
              action="확장"
              disabled={
                save.vault.expansions >= VAULT.maxExpansions ||
                gold < vaultExpandCost(save.vault.capacity)
              }
              onPress={() =>
                confirm(
                  '창고 한도를 늘릴까요?',
                  `${vaultExpandCost(save.vault.capacity).toLocaleString()}G → 한도 ${(save.vault.capacity * VAULT.step).toLocaleString()}G`,
                  '확장',
                  () => trade(trades.expand()),
                )
              }
            />
          </Panel>
        )}

        {/* 반지 탭은 교환만 한다 (T17_7 검수 4차) — 올리기·강화는 강화 탭의 장신구, 끼기는 캐릭터 탭 */}
        {tab === '반지' && (
          <Panel title="새 반지">
            <Text size="sm" dim>
              {regionById(1).name}의 서로 다른 사냥터 소재 {RING_COST.exchange}개로 ★1 일반 반지를
              하나 받습니다. 무엇이 나올지는 모릅니다(11종). 같은 반지 두 개를 같이 껴도 됩니다.
            </Text>
            {lastRing && <Text color={colors.gold}>{lastRing}</Text>}
            <PickRow
              key={`ex-${save.rings.length}`}
              title="반지 교환"
              detail="무작위 반지 ★1 일반"
              action="교환"
              tone="gold"
              region={1}
              need={RING_COST.exchange}
              auto={pickMaterials(save, 1, RING_COST.exchange, true)}
              onPress={(picked) =>
                confirm(
                  '교환할까요?',
                  `${regionById(1).name} 소재 ${RING_COST.exchange}종 → 무작위 반지 ★1 일반`,
                  '교환',
                  () => {
                    if (trade(trades.exchangeRing(picked))) {
                      const got = usePlayer.getState().save.rings.at(-1)!;
                      setLastRing(`${ringName(got)}을(를) 받았습니다 — ${ringText(got)}`);
                    }
                  },
                )
              }
            />
            <Text size="sm" dim>
              가진 반지 {save.rings.length}개 — 올리기·강화는 강화 탭의 [장신구], 끼는 곳은 캐릭터
              탭입니다.
            </Text>
          </Panel>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: space.lg, gap: space.md },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  tabs: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  body: { gap: space.lg, paddingBottom: space.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  name: { gap: space.xs, flexShrink: 1 },
  ring: { gap: space.xs, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.edge },
});
