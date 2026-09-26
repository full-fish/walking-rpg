// 원본(img/<종류>/*.png, 2048px 투명 배경) → assets/images/<묶음>/<종류>/<sprite id>.png. 원본은 건드리지 않는다.
//   장비 · 반지 · 화살 · 물약 · 소재  items/<종류>/  256px — 격자 칸(84dp) × 3배 밀도
//   몬스터             monsters/<종족>/  384px — 사냥터 무대(150dp)
//   보스               monsters/boss/    512px — 보스 무대에 크게 (T17_7)
// 여백은 자르지 않는다 — 원본의 크기 차이(단검 < 대검)를 살린다.
// 256색 팔레트로 저장한다 — 눈으로는 같고 용량이 ⅓이다.
// 끝나면 그림 모음(assets/images/gallery.html)과 README의 "이미지 갤러리"를 assets 기준으로 다시 쓴다.
// 실행: node tools/crop-sprites.mjs         — 전부
//       node tools/crop-sprites.mjs boss    — 그 폴더만
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'img';
const ASSETS = 'assets/images';
/** 장비 · 반지 · 화살 폴더 — 순서가 갤러리 순서다. 나머지 폴더는 몬스터 종족 */
const ITEMS = [
  'sword',
  'shortsword',
  'shield',
  'dagger',
  'greatsword',
  'bow',
  'helm',
  'armor',
  'pants',
  'gloves',
  'boots',
  'accessory',
  'ring',
  'arrow',
  'potion',
  'material',
];
// 원본 폴더는 glove · boss_N, sprite id는 gloves · boss_rN
const kindOf = (dir) => (dir === 'glove' ? 'gloves' : dir);
const rename = (name) => name.replace(/^glove_/, 'gloves_').replace(/^boss_/, 'boss_r');
const target = (kind) =>
  kind === 'boss'
    ? { out: 'monsters/boss', size: 512 }
    : ITEMS.includes(kind)
      ? { out: `items/${kind}`, size: 256 }
      : { out: `monsters/${kind}`, size: 384 };
const only = process.argv[2];

for (const dir of readdirSync(SRC, { withFileTypes: true })) {
  if (!dir.isDirectory() || (only && dir.name !== only)) continue;
  const { out, size } = target(kindOf(dir.name));
  mkdirSync(`${ASSETS}/${out}`, { recursive: true });
  for (const file of readdirSync(`${SRC}/${dir.name}`)) {
    if (!file.endsWith('.png')) continue;
    await sharp(`${SRC}/${dir.name}/${file}`)
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ palette: true, compressionLevel: 9 })
      .toFile(`${ASSETS}/${out}/${rename(file)}`);
  }
}

// 그림 모음 — assets에 있는 것 전부를 종류별로
const json = (path) => JSON.parse(readFileSync(path, 'utf8'));
const LABELS = {
  ...Object.fromEntries(
    json('src/content/archetypes/equipment.json').lines.map((l) => [l.spriteTag, l.label]),
  ),
  ...Object.fromEntries(
    json('src/content/archetypes/monsters.json').map((a) => [a.spriteTag, a.label]),
  ),
  ring: '반지',
  arrow: '화살',
  potion: '물약',
  material: '소재',
  boss: '보스',
};
const kinds = (group) =>
  readdirSync(`${ASSETS}/${group}`, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);
const byNumber = (a, b) => a.localeCompare(b, undefined, { numeric: true });
const monsters = kinds('monsters').sort((a, b) =>
  a === 'boss' ? -1 : b === 'boss' ? 1 : byNumber(a, b),
);
const sprites = [
  ...ITEMS.filter((k) => kinds('items').includes(k)).map((kind) => ({ group: 'item', kind })),
  ...monsters.map((kind) => ({ group: 'monster', kind })),
].map(({ group, kind }) => {
  const dir = `${group === 'item' ? 'items' : 'monsters'}/${kind}`;
  const files = readdirSync(`${ASSETS}/${dir}`)
    .filter((f) => f.endsWith('.png'))
    .sort(byNumber);
  return { group, kind, label: LABELS[kind] ?? kind, files: files.map((f) => `${dir}/${f}`) };
});

/** `file`에서 start와 end 사이를 `body`로 바꾼다 */
const fill = (file, start, end, body) => {
  const text = readFileSync(file, 'utf8');
  const [head, rest] = text.split(start);
  writeFileSync(file, head + start + body + end + rest.split(end)[1]);
};
fill(
  `${ASSETS}/gallery.html`,
  '/* sprites:start */',
  '/* sprites:end */',
  `const SPRITES = ${JSON.stringify(sprites)};`,
);
fill(
  'README.md',
  '<!-- gallery:start -->',
  '<!-- gallery:end -->',
  `\n${sprites
    .map(
      (k) =>
        `<details open><summary><b>${k.label}</b> ${k.kind} · ${k.files.length}</summary>\n\n` +
        k.files
          .map((f) => `<img src="${ASSETS}/${f}" width="56" title="${f.split('/').pop()}">`)
          .join(' ') +
        '\n\n</details>\n',
    )
    .join('\n')}`,
);
