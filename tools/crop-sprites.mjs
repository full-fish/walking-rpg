// 원본(img/<부위>/*.png, 2048px) → assets/images/items/<sprite id>.png (256px).
// 격자 칸(84dp) × 3배 밀도 ≈ 250px 기준. 여백은 자르지 않는다 — 원본의 크기 차이(단검 < 대검)를 살린다.
// 원본은 건드리지 않는다.
// 실행: node tools/crop-sprites.mjs
import { readdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'img';
const OUT = 'assets/images/items';
const SIZE = 256;
const rename = (name) => name.replace(/^glove_/, 'gloves_'); // 폴더는 glove, sprite id는 gloves

for (const dir of readdirSync(SRC, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  for (const file of readdirSync(`${SRC}/${dir.name}`)) {
    if (!file.endsWith('.png')) continue;
    await sharp(`${SRC}/${dir.name}/${file}`)
      .resize(SIZE, SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toFile(`${OUT}/${rename(file)}`);
  }
}
