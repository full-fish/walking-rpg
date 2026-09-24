// 원본(img/<부위>/*.png, 2048px) → assets/images/items/<sprite id>.png (256px).
// 격자 칸(84dp) × 3배 밀도 ≈ 250px 기준. 여백은 자르지 않는다 — 원본의 크기 차이(단검 < 대검)를 살린다.
// 보스(img/boss/boss_N.png)는 전투 무대에 크게 띄우므로 512px로 assets/images/monsters/boss_rN.png에 간다 (T17_7).
// 원본은 건드리지 않는다.
// 실행: node tools/crop-sprites.mjs         — 전부
//       node tools/crop-sprites.mjs boss    — 그 폴더만. 아직 안 붙일 폴더(img/pants)를 건드리지 않으려고 둔다
import { readdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'img';
const OUT = 'assets/images/items';
const SIZE = 256;
const rename = (name) => name.replace(/^glove_/, 'gloves_'); // 폴더는 glove, sprite id는 gloves
/** 폴더마다 다른 곳으로 가는 것 — 나머지는 전부 장비 그림이다 */
const TARGETS = {
  boss: { out: 'assets/images/monsters', size: 512, rename: (n) => n.replace(/^boss_/, 'boss_r') },
};
const only = process.argv[2];

for (const dir of readdirSync(SRC, { withFileTypes: true })) {
  if (!dir.isDirectory() || (only && dir.name !== only)) continue;
  const target = TARGETS[dir.name] ?? { out: OUT, size: SIZE, rename };
  for (const file of readdirSync(`${SRC}/${dir.name}`)) {
    if (!file.endsWith('.png')) continue;
    await sharp(`${SRC}/${dir.name}/${file}`)
      .resize(target.size, target.size, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toFile(`${target.out}/${target.rename(file)}`);
  }
}
