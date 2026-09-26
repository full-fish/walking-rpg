import { useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, StyleSheet, View } from 'react-native';

import { GEAR_SLOT_LABELS, type Equipment } from '@/content';
import { itemLabel, itemStats, statText } from '@/game/items';
import type { ItemInstance, Ring } from '@/save/schema';
import { itemIcons } from '@/ui/itemIcons';
import { Panel } from '@/ui/Panel';
import { RARITY_LABEL, ringName, ringText } from '@/ui/rings';
import { Text } from '@/ui/Text';
import { border, colors, rarity, space } from '@/ui/theme';

/** 격자 한 칸 (T17_2). 그림이 칸을 꽉 채운다 — 테두리만 빼고 80px. */
export const CELL = 84;

/** 장비 그림 — 반지 · 화살은 `sprite`로 부른다. 아직 그림이 없는 sprite는 빈 칸으로 자리만 잡는다. */
export function ItemIcon({
  def,
  sprite,
  size,
}: {
  def?: Equipment;
  sprite?: string;
  size: number;
}) {
  const id = sprite ?? def?.sprite;
  const source = id ? itemIcons[id] : undefined;
  const box = { width: size, height: size };
  if (!source) return <View style={box} />;
  return <Image source={source} style={box} resizeMode="contain" />;
}

/**
 * 목록 줄 앞의 그림 (T17_7 검수 5차) — 격자 칸처럼 **테두리 색이 등급**이다.
 * 전에는 목록에서 이름 글자색만 등급을 따라서 한눈에 안 갈렸다.
 */
export function ListIcon({
  def,
  ring,
  size = 36,
}: {
  def?: Equipment;
  ring?: Ring;
  size?: number;
}) {
  const tone = def?.rarity ?? ring?.rarity;
  const box = { width: size + border * 2, height: size + border * 2 };
  return (
    <View style={[styles.listIcon, box, { borderColor: tone ? rarity[tone] : colors.edge }]}>
      <ItemIcon def={def} sprite={ring && `ring_${ring.kind}`} size={size} />
    </View>
  );
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
  faded,
  selected,
  onPress,
}: {
  def?: Equipment;
  item?: ItemInstance;
  tag?: string;
  label?: string;
  dim?: boolean;
  /** 그림까지 흐리게 — 두 손 무기가 다른 손 칸에 비칠 때 (T18 확인) */
  faded?: boolean;
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
          faded && styles.faded,
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
        <Popup visible={info} onClose={() => setInfo(false)}>
          <ItemInfo def={def} item={item} />
        </Popup>
      )}
    </>
  );
}

/**
 * 화면 가운데 뜨는 창 — 바깥이나 창의 빈 곳을 누르면 닫힌다. 안의 버튼은 버튼대로 먹는다.
 * 꾹 누르기 정보창과 상점 격자에서 고른 칸(T17_6 검수)이 같이 쓴다.
 */
export function Popup({
  visible,
  onClose,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Panel>{children}</Panel>
      </Pressable>
    </Modal>
  );
}

/** 장비 한 점의 이름 · 부위 · 착용 Lv · 스탯. 가진 물건(`item`)이면 품질·강화가 붙은 값이다 */
export function ItemInfo({ def, item }: { def: Equipment; item?: ItemInstance }) {
  return (
    <>
      <View style={styles.infoHead}>
        <ItemIcon def={def} size={48} />
        <View style={styles.infoName}>
          <Text color={rarity[def.rarity]}>{item ? itemLabel(item) : def.name}</Text>
          <Text size="sm" dim>
            {GEAR_SLOT_LABELS[def.slot]} · 착용 Lv{def.level}
          </Text>
        </View>
      </View>
      <Text>{statText(item ? itemStats(item) : def)}</Text>
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

/**
 * 반지 칸 (T17_7). 그림은 종류마다 한 장 — 테두리 색이 등급, 아래 한 줄이 ★·강화다.
 * 비어 있으면 "반지"라고만 쓴다. **꾹 누르면 이름과 효과가 뜬다** — 장비 칸과 같다 (T17_7 검수 5차).
 */
export function RingCell({
  ring,
  selected,
  onPress,
}: {
  ring?: Ring;
  selected?: boolean;
  onPress?: () => void;
}) {
  const [info, setInfo] = useState(false);
  return (
    <>
      <Pressable
        onPress={onPress}
        onLongPress={ring && (() => setInfo(true))}
        style={[
          styles.cell,
          { borderColor: ring ? rarity[ring.rarity] : colors.edge },
          selected && styles.selected,
        ]}
      >
        {ring && <ItemIcon sprite={`ring_${ring.kind}`} size={CELL - border * 2} />}
        <View style={styles.tag}>
          <Text size="sm" dim={!ring}>
            {ring ? `★${ring.tier}${ring.enhance > 0 ? ` +${ring.enhance}` : ''}` : '반지'}
          </Text>
        </View>
      </Pressable>
      {ring && (
        <Popup visible={info} onClose={() => setInfo(false)}>
          <View style={styles.infoHead}>
            <ListIcon ring={ring} />
            <View style={styles.infoName}>
              <Text color={rarity[ring.rarity]}>{ringName(ring)}</Text>
              <Text size="sm" dim>
                반지 · {RARITY_LABEL[ring.rarity]}
              </Text>
            </View>
          </View>
          <Text>{ringText(ring)}</Text>
        </Popup>
      )}
    </>
  );
}

/**
 * 화살 칸 (T18_1) — 인형의 투구 오른쪽. 먹인 화살의 그림 · 이름 · 남은 수, 안 먹였으면 흐린 🏹와 "화살".
 * 누르면 가진 화살을 편다(캐릭터 탭).
 */
export function ArrowCell({
  name,
  sprite,
  count,
  selected,
  onPress,
}: {
  name?: string;
  sprite?: string;
  count: number;
  selected?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.cell, selected && styles.selected]}>
      {sprite ? (
        <View style={count === 0 && styles.faded}>
          <ItemIcon sprite={sprite} size={CELL - border * 2} />
        </View>
      ) : (
        <Text size="xl" dim>
          🏹
        </Text>
      )}
      <View style={styles.tag}>
        <Text
          size="sm"
          dim={!name || count === 0}
          color={name && count === 0 ? colors.hp : undefined}
        >
          {name ? `${name.split(' ')[0]} ${count}` : '화살'}
        </Text>
      </View>
    </Pressable>
  );
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
  faded: { opacity: 0.35 },
  listIcon: { borderWidth: border, alignItems: 'center', justifyContent: 'center' },
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
