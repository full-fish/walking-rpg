import { create } from 'zustand';

import { EQUIPMENT, gearSetFor } from '@/content';
import type { Outcome } from '@/game/battle';
import { enterField, settleRun, drinkPotion, type RunResult } from '@/game/field';
import {
  buyConsumable,
  bagExpand,
  buyEquipment,
  enhanceItem,
  exchangeUnique,
  type EnhanceResult,
  sellItem,
  stayInn,
  consumeItem,
  vaultDeposit,
  vaultExpand,
  vaultWithdraw,
} from '@/game/economy';
import type { GearSlot } from '@/game/formulas';
import { makeItem } from '@/game/items';
import { enterBoss, travel, unlockNext } from '@/game/region';
import { grantWp, spendWp } from '@/game/wp';
import {
  addItem,
  applyRegen,
  equipAll,
  equipItem,
  settleBattle,
  respec,
  sortInventory,
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
  /** 사냥터에 들어간다 (§4.4). WP가 모자라거나 이미 판 안이면 false */
  enter: (fieldId: string) => boolean;
  /** 전투 하나를 판에 반영한다. 클리어·소재·보너스까지 여기서 나온다 */
  finishBattle: (outcome: Outcome, playerHp: number) => RunResult;
  /**
   * 사냥터 안에서 물약을 쓴다. 만피거나 없으면 false.
   * atHp는 전투 재생 중의 현재 HP — 세이브의 HP는 전투가 끝나야 갱신된다 (§4.2).
   */
  drink: (id: string, atHp?: number) => boolean;
  /** 남은 포인트 1점을 스탯에 넣는다. 포인트가 없으면 false */
  allocate: (stat: StatKey) => boolean;
  /** 배분을 전부 되돌린다 (§4.3). WP가 모자라면 false */
  respec: () => boolean;
  /** 장비를 낀다. 레벨이 모자라거나 없는 개체면 false */
  equip: (uid: string) => boolean;
  unequip: (slot: GearSlot) => void;
  /** 가방을 지금 기준으로 성능순 정렬한다 (T17_2) */
  sortBag: () => void;
  addGold: (amount: number) => void;
  addWp: (amount: number) => void;
  /**
   * 경제 동작 하나 (§4.5). economy.ts가 null을 주면 아무것도 안 바꾸고 false.
   * 상점·여관·창고·교환이 전부 이 하나를 지난다 — 화면마다 저장 코드를 두지 않는다.
   */
  trade: (change: (save: Save) => Save | null) => boolean;
  /** 실기기 확인용 — 지금 레벨의 common 풀세트를 공짜로 준다 */
  grantGearSet: () => void;
  /** 실기기 확인용 — 그림(sprite)마다 장비 하나씩 가방에 넣는다. 고유 장비 포함 */
  grantAllSprites: () => void;
  /** 실기기 확인용 — 가방 칸 수를 바로 정한다 */
  setBagCapacity: (capacity: number) => void;
  /**
   * 장비 한 점을 한 단계 올려 본다 (§4.5). 성공·실패를 화면이 보여줘야 해서
   * trade()와 달리 결과를 그대로 돌려준다. 골드가 모자라면 null.
   */
  enhance: (uid: string) => EnhanceResult | null;
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

  enter: (fieldId) => {
    const next = enterField(get().save, fieldId, Math.random);
    if (!next) return false;
    set({ save: persist(next) });
    return true;
  },

  finishBattle: (outcome, playerHp) => {
    const result = settleRun(get().save, outcome, playerHp, Math.random, Date.now());
    set({ save: persist(result.save) });
    return result;
  },

  drink: (id, atHp) => {
    const next = drinkPotion(get().save, id, atHp);
    if (!next) return false;
    set({ save: persist(next) });
    return true;
  },

  allocate: (stat) => {
    const next = spendPoint(get().save, stat);
    if (!next) return false;
    set({ save: persist(next) });
    return true;
  },

  respec: () => {
    const next = respec(get().save);
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

  sortBag: () => set({ save: persist(sortInventory(get().save)) }),

  trade: (change) => {
    const next = change(get().save);
    if (!next) return false;
    set({ save: persist(next) });
    return true;
  },

  addGold: (amount) => {
    const { save } = get();
    const gold = Math.max(0, save.player.gold + amount);
    set({ save: persist({ ...save, player: { ...save.player, gold } }) });
  },

  addWp: (amount) => {
    const { save } = get();
    const current = Math.max(0, save.wp.current + amount);
    set({ save: persist({ ...save, wp: { ...save.wp, current } }) });
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

  grantAllSprites: () => {
    let save = get().save;
    const seen = new Set<string>();
    for (const def of EQUIPMENT) {
      // 고유 장비도 넣는다 — 그림이 따로(uniq_…)라 한 종씩 따로 들어온다. 설정의 [가방 300칸]과 짝이다
      if (seen.has(def.sprite)) continue;
      seen.add(def.sprite);
      save = addItem(save, makeItem(save.inventory, def.id, Math.random));
    }
    set({ save: persist(save) });
  },

  setBagCapacity: (capacity) => {
    const { save } = get();
    set({ save: persist({ ...save, bag: { ...save.bag, capacity } }) });
  },

  enhance: (uid) => {
    const result = enhanceItem(get().save, uid, Math.random);
    if (!result) return null;
    set({ save: persist(result.save) });
    return result;
  },

  reset: () => set({ save: resetSave() }),
}));

/** 화면들이 전투 스탯을 볼 때 쓰는 선택자. 세이브가 바뀌면 같이 갱신된다. */
export const selectStats = (s: PlayerStore) => statsOf(s.save);

/** 화면이 economy.ts를 직접 부르지 않게 묶어둔 것. 전부 trade()를 지난다. */
export const trades = {
  buyEquipment: (defId: string) => (save: Save) => buyEquipment(save, defId, Math.random),
  sellItem: (uid: string) => (save: Save) => sellItem(save, uid),
  buyConsumable: (id: string) => (save: Save) => buyConsumable(save, id),
  consumeItem: (id: string) => (save: Save) => consumeItem(save, id),
  stayInn: (cost: number) => (save: Save) => stayInn(save, cost, Date.now()),
  deposit: (amount: number) => (save: Save) => vaultDeposit(save, amount),
  withdraw: (amount: number) => (save: Save) => vaultWithdraw(save, amount),
  expand: () => (save: Save) => vaultExpand(save),
  expandBag: () => (save: Save) => bagExpand(save),
  exchange: (fieldId: string) => (save: Save) => exchangeUnique(save, fieldId, Math.random),
  /** 지역 관문 (T17_5) — 보스 도전 · 해금 · 이동은 따로 낸다 */
  /** 소재를 쓰면 하나에 하나씩 무작위 버프 (T17_6 검수) */
  challengeBoss: (materials: number) => (save: Save) => enterBoss(save, materials),
  unlockRegion: () => (save: Save) => unlockNext(save),
  travel: (region: number) => (save: Save) => travel(save, region),
};
