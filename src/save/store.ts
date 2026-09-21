import { createMMKV } from 'react-native-mmkv';

import { newGame } from '../game/progression';
import { migrate } from './migrations';
import { SaveSchema, type Save } from './schema';

const storage = createMMKV();
const KEY = 'save';
/** 못 읽은 세이브의 원본. 덮어쓰기 전에 여기에 남긴다(복구 문의 대응용). */
const CORRUPT_KEY = 'save.corrupt';

/** 저장된 세이브를 읽어 최신 스키마로 돌려준다. 없거나 깨졌으면 새 세이브. */
export function loadSave(): Save {
  const raw = storage.getString(KEY);
  if (!raw) return newGame();
  try {
    return SaveSchema.parse(migrate(JSON.parse(raw)));
  } catch (e) {
    storage.set(CORRUPT_KEY, raw);
    console.warn('[save] 불러오기 실패 — 새 세이브로 시작합니다.', e);
    return newGame();
  }
}

export function writeSave(save: Save): void {
  storage.set(KEY, JSON.stringify(save));
}

/** 세이브 삭제 후 새 세이브 반환. */
export function resetSave(): Save {
  storage.remove(KEY);
  return newGame();
}
