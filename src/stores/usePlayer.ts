import { create } from 'zustand';

import { gearSetFor } from '@/content';
import type { Outcome } from '@/game/battle';
import type { GearSlot } from '@/game/formulas';
import { makeItem } from '@/game/items';
import { grantWp, spendWp } from '@/game/wp';
import {
  addItem,
  applyRegen,
  equipAll,
  equipItem,
  settleBattle,
  spendPoint,
  statsOf,
  unequipSlot,
  type Reward,
  type Settlement,
  type StatKey,
} from '@/game/progression';
import type { DailySteps } from '@/health/steps';
import type { Save } from '@/save/schema';
import { loadSave, resetSave, writeSave } from '@/save/store';

type PlayerStore = {
  save: Save;
  /** 걸음 기록을 WP로 바꾼다. 중복 지급은 grantWp가 막으므로 몇 번 불러도 안전하다 */
  grantFromSteps: (steps: DailySteps) => void;
  /** WP를 쓴다. 모자라면 아무것도 바꾸지 않고 false */
  spend: (cost: number) => boolean;
  /** 안 켠 동안의 HP 자연회복을 반영한다. 회복할 게 없으면 아무것도 안 한다 */
  regen: () => void;
  /** 전투 하나를 정산한다. 화면이 결과를 보여줄 수 있게 정산 내역을 돌려준다 */
  settle: (outcome: Outcome, playerHp: number, reward: Reward) => Settlement;
  /** 남은 포인트 1점을 스탯에 넣는다. 포인트가 없으면 false */
  allocate: (stat: StatKey) => boolean;
  /** 장비를 낀다. 레벨이 모자라거나 없는 개체면 false */
  equip: (uid: string) => boolean;
  unequip: (slot: GearSlot) => void;
  addGold: (amount: number) => void;
  /** 실기기 확인용 — 지금 레벨의 common 풀세트를 공짜로 준다. T14 상점이 이 자리를 대체한다 */
  grantGearSet: () => void;
  reset: () => void;
};

/** 상태가 바뀔 때마다 즉시 MMKV에 쓴다. 스로틀 없음 — 동기 저장이라 1ms 미만 (§5.5). */
function persist(save: Save): Save {
  writeSave(save);
  return save;
}

/**
 * 게임 상태 한 곳. 원본은 항상 MMKV에 있고 이 스토어는 그 사본이다.
 * MMKV가 동기라 첫 렌더 전에 loadSave()로 채울 수 있다(로딩 상태 불필요).
 */
export const usePlayer = create<PlayerStore>((set, get) => ({
  // 앱을 켠 순간, 꺼져 있던 동안의 HP 회복을 먼저 반영한다 (§4.2).
  save: applyRegen(loadSave(), Date.now()),

  grantFromSteps: (steps) => {
    const { save } = get();
    const { state, granted } = grantWp(save.wp, steps, new Date());
    // 받을 게 없으면 저장도 리렌더도 하지 않는다. 60초마다 불리는 경로다.
    if (granted === 0) return;
    set({ save: persist({ ...save, wp: state }) });
  },

  spend: (cost) => {
    const { save } = get();
    const wp = spendWp(save.wp, cost);
    if (!wp) return false;
    set({ save: persist({ ...save, wp }) });
    return true;
  },

  regen: () => {
    const { save } = get();
    const next = applyRegen(save, Date.now());
    if (next === save) return;
    set({ save: persist(next) });
  },

  settle: (outcome, playerHp, reward) => {
    const result = settleBattle(get().save, outcome, playerHp, reward, Date.now());
    set({ save: persist(result.save) });
    return result;
  },

  allocate: (stat) => {
    const next = spendPoint(get().save, stat);
    if (!next) return false;
    set({ save: persist(next) });
    return true;
  },

  equip: (uid) => {
    const next = equipItem(get().save, uid);
    if (!next) return false;
    set({ save: persist(next) });
    return true;
  },

  unequip: (slot) => {
    const { save } = get();
    const next = unequipSlot(save, slot);
    if (next === save) return;
    set({ save: persist(next) });
  },

  addGold: (amount) => {
    const { save } = get();
    const gold = Math.max(0, save.player.gold + amount);
    set({ save: persist({ ...save, player: { ...save.player, gold } }) });
  },

  grantGearSet: () => {
    let save = get().save;
    const uids: string[] = [];
    for (const def of gearSetFor(save.player.level)) {
      // 품질은 여기서 굴린다 — 드랍이든 구매든 같은 함수를 지나야 개체차가 생긴다 (§4.5)
      const item = makeItem(save.inventory, def.id, Math.random);
      save = addItem(save, item);
      uids.push(item.uid);
    }
    set({ save: persist(equipAll(save, uids)) });
  },

  reset: () => set({ save: resetSave() }),
}));

/** 화면들이 전투 스탯을 볼 때 쓰는 선택자. 세이브가 바뀌면 같이 갱신된다. */
export const selectStats = (s: PlayerStore) => statsOf(s.save);
