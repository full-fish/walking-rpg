import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { GEAR_SLOT_LABELS, type Equipment } from '@/content';
import { itemLabel, itemStats, statText } from '@/game/items';
import type { ItemInstance } from '@/save/schema';
import { itemIcons } from '@/ui/itemIcons';
import { Panel } from '@/ui/Panel';
import { Text } from '@/ui/Text';
import { border, colors, rarity, space } from '@/ui/theme';

/** 격자 한 칸 (T17_2). 그림이 칸을 꽉 채운다 — 테두리만 빼고 80px. */
export const CELL = 84;

/** 장비 그림. 아직 그림이 없는 sprite는 빈 칸으로 자리만 잡는다. */
export function ItemIcon({ def, size }: { def?: Equipment; size: number }) {
  const source = def ? itemIcons[def.sprite] : undefined;
  const box = { width: size, height: size };
  if (!source) return <View style={box} />;
  return <Image source={source} style={box} resizeMode="contain" />;
}

/**
 * 격자 한 칸 (T17_1, T17_2) — 가방·장비·상점·강화가 같이 쓴다 (T17_6).
 * **테두리 색이 등급**이고, 그림 위 아래쪽에 한 줄(tag)을 겹쳐 박는다 —
 * 가방은 품질·강화, 상점은 값. 빈 칸이면 label(부위 이름)을 대신 보여준다.
 * 고른 칸은 바탕을 밝혀 표시한다 — 테두리는 등급 색이라 건드리지 않는다.
 *
 * **꾹 누르면 이름과 스탯이 뜬다** (T17_6 검수). 격자에는 그림과 한 줄뿐이라 뭔지 모른다.
 * `item`을 주면 품질·강화가 붙은 개체 스탯, 없으면(상점) 정의 그대로다. 아무 데나 누르면 닫힌다.
 */
export function ItemCell({
  def,
  item,
  tag,
  label,
  dim,
  selected,
  onPress,
}: {
  def?: Equipment;
  item?: ItemInstance;
  tag?: string;
  label?: string;
  dim?: boolean;
  selected?: boolean;
  onPress?: () => void;
}) {
  const [info, setInfo] = useState(false);
  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={def && (() => setInfo(true))}
        style={[
          styles.cell,
          { borderColor: def ? rarity[def.rarity] : colors.edge },
          selected && styles.selected,
        ]}
      >
        <ItemIcon def={def} size={CELL - border * 2} />
        <View style={styles.tag}>
          <Text size="sm" dim={dim || !def}>
            {def ? (tag ?? '') : (label ?? '')}
          </Text>
        </View>
      </Pressable>
      {/* 칸의 형제로 둔다 — 안에 두면 창 안을 누른 게 칸의 onPress까지 올라갈 수 있다 */}
      {def && (
        <Modal
          transparent
          visible={info}
          animationType="fade"
          onRequestClose={() => setInfo(false)}
        >
          <Pressable style={styles.backdrop} onPress={() => setInfo(false)}>
            <Panel>
              <View style={styles.infoHead}>
                <ItemIcon def={def} size={48} />
                <View style={styles.infoName}>
                  <Text color={rarity[def.rarity]}>{item ? itemLabel(item) : def.name}</Text>
                  <Text size="sm" dim>
                    {GEAR_SLOT_LABELS[def.slot]} · 요구 Lv{def.level}
                  </Text>
                </View>
              </View>
              <Text>{statText(item ? itemStats(item) : def)}</Text>
            </Panel>
          </Pressable>
        </Modal>
      )}
    </>
  );
}

/** 개체 칸 아래 한 줄 — "104% +3". 가방·팔기·강화가 같은 모양을 쓴다. */
export function qualityTag(item: ItemInstance): string {
  return `${Math.round(item.quality * 100)}%${item.enhance > 0 ? ` +${item.enhance}` : ''}`;
}

/** 칸을 줄 맞춰 까는 틀. 칸 사이 간격까지 여기서 정한다. */
export function ItemGrid({ children }: { children: ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

/** 빈 자리 — 인형 배치에서 칸이 없는 곳을 채운다. */
export function EmptyCell() {
  return <View style={styles.cell} />;
}

const styles = StyleSheet.create({
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
  selected: { backgroundColor: colors.edgeLit },
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  infoHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  infoName: { gap: space.xs, flexShrink: 1 },
  // 그림 위에 겹쳐 박는다. 반투명 바탕이 없으면 밝은 그림에서 글씨가 안 보인다
  tag: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(26, 22, 38, 0.75)',
  },
});
