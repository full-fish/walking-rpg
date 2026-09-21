import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  equipmentById,
  GEAR_SLOT_LABELS,
  regionById,
  shopConsumables,
  shopGear,
  type Field,
} from '@/content';
import { depositNet, sellPrice } from '@/game/economy';
import { inTown } from '@/game/field';
import {
  ENHANCE_MAX,
  enhanceCost,
  enhanceExpected,
  enhanceRate,
  VAULT,
  vaultExpandCost,
} from '@/game/formulas';
import { itemLabel } from '@/game/items';
import { statsOf } from '@/game/progression';
import { trades, usePlayer } from '@/stores/usePlayer';
import { Bar } from '@/ui/Bar';
import { Button } from '@/ui/Button';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { colors, space } from '@/ui/theme';

const TABS = ['상점', '강화', '여관', '창고', '특별 교환'] as const;
type Tab = (typeof TABS)[number];

/** 한 줄 = 이름·설명 + 버튼. 상점 전체가 이 모양이라 화면 안에 둔다. */
function Row({
  title,
  detail,
  action,
  disabled,
  onPress,
  tone,
}: {
  title: string;
  detail: string;
  action: string;
  disabled?: boolean;
  onPress: () => void;
  tone?: 'normal' | 'gold';
}) {
  return (
    <View style={styles.row}>
      <View style={styles.name}>
        <Text>{title}</Text>
        <Text size="sm" dim>
          {detail}
        </Text>
      </View>
      <Button label={action} disabled={disabled} tone={tone} onPress={onPress} />
    </View>
  );
}

export default function Shop() {
  const save = usePlayer((s) => s.save);
  const trade = usePlayer((s) => s.trade);
  const enhance = usePlayer((s) => s.enhance);
  const [tab, setTab] = useState<Tab>('상점');
  const [amount, setAmount] = useState(1_000);
  /** 마지막 강화 결과. 성공·실패를 한 줄로 보여주려고 들고 있는다 */
  const [lastEnhance, setLastEnhance] = useState<string | null>(null);

  const region = regionById(save.regionProgress.current);
  const stats = statsOf(save);
  const gold = save.player.gold;

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
          <Button key={t} label={t} tone={t === tab ? 'gold' : 'normal'} onPress={() => setTab(t)} />
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

            <Panel title={`장비 — 낄 수 있는 것만 (Lv${save.player.level})`}>
              {shopGear(save.player.level)
                .slice(0, 12)
                .map((e) => (
                  <Row
                    key={e.id}
                    title={e.name}
                    detail={`${GEAR_SLOT_LABELS[e.slot]} · ATK +${e.atk} HP +${e.maxHp} DEF +${e.def}${e.spd > 0 ? ` SPD +${e.spd}` : ''} · ${e.price.toLocaleString()}G`}
                    action="구매"
                    disabled={gold < e.price}
                    onPress={() => trade(trades.buyEquipment(e.id))}
                  />
                ))}
            </Panel>

            <Panel title="팔기 — 낀 것은 안 팝니다">
              {save.inventory.filter((i) => !Object.values(save.equipped).includes(i.uid)).length ===
              0 ? (
                <Text size="sm" dim>
                  팔 게 없습니다.
                </Text>
              ) : (
                save.inventory
                  .filter((i) => !Object.values(save.equipped).includes(i.uid))
                  .map((item) => (
                    <Row
                      key={item.uid}
                      title={itemLabel(item)}
                      detail={`${GEAR_SLOT_LABELS[equipmentById(item.defId).slot]} · ${sellPrice(item).toLocaleString()}G`}
                      action="팔기"
                      onPress={() => trade(trades.sellItem(item.uid))}
                    />
                  ))
              )}
            </Panel>
          </>
        )}

        {tab === '강화' && (
          <Panel title="강화 — 실패해도 단계는 안 내려갑니다">
            {lastEnhance && <Text color={colors.gold}>{lastEnhance}</Text>}
            <Text size="sm" dim>
              골드만 사라집니다. 장비가 깨지거나 단계가 떨어지지는 않습니다.
            </Text>
            {save.inventory.length === 0 ? (
              <Text size="sm" dim>
                강화할 장비가 없습니다.
              </Text>
            ) : (
              save.inventory.map((item) => {
                const def = equipmentById(item.defId);
                const next = item.enhance + 1;
                const maxed = item.enhance >= ENHANCE_MAX;
                const cost = maxed ? 0 : enhanceCost(def.price, next);
                return (
                  <Row
                    key={item.uid}
                    title={itemLabel(item)}
                    detail={
                      maxed
                        ? '최대 단계입니다'
                        : `+${next} 성공률 ${(enhanceRate(next) * 100).toFixed(0)}% · ${cost.toLocaleString()}G` +
                          ` · +10까지 기대 ${enhanceExpected(def.price).gold.toLocaleString()}G`
                    }
                    action={maxed ? '완료' : '강화'}
                    tone={Object.values(save.equipped).includes(item.uid) ? 'gold' : 'normal'}
                    disabled={maxed || gold < cost}
                    onPress={() => {
                      const r = enhance(item.uid);
                      if (!r) return;
                      setLastEnhance(
                        r.success
                          ? `성공! ${def.name} +${r.step} (${r.cost.toLocaleString()}G)`
                          : `실패… +${r.step} 못 붙었습니다 (${r.cost.toLocaleString()}G)`,
                      );
                    }}
                  />
                );
              })
            )}
          </Panel>
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
              onPress={() => trade(trades.expand())}
            />
          </Panel>
        )}

        {tab === '특별 교환' && (
          <Panel title={`${region.name}의 사냥터 전용 장비`}>
            <Text size="sm" dim>
              소재는 한 판을 끝까지 깨면 나옵니다 (T16). 지금은 설정 탭에서 받을 수 있습니다.
            </Text>
            {region.fields.map((field: Field) => {
              const have = save.materials[field.id] ?? 0;
              const { material, gold: cost } = field.reward.cost;
              const item = equipmentById(field.reward.id);
              return (
                <Row
                  key={field.id}
                  title={`${field.reward.name} (${GEAR_SLOT_LABELS[item.slot]})`}
                  detail={`${field.material.name} ${have}/${material} + ${cost.toLocaleString()}G · ATK +${item.atk} HP +${item.maxHp} DEF +${item.def}`}
                  action="교환"
                  disabled={have < material || gold < cost}
                  onPress={() => trade(trades.exchange(field.id))}
                />
              );
            })}
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { gap: space.xs, flexShrink: 1 },
});
