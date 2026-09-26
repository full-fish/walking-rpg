# 스프라이트 생성 목록

이미지 생성 AI에 하나씩 넣을 프롬프트용 목록. 파일명 = sprite id 그대로 써서 `img/<종류>/`에 두고
`node tools/crop-sprites.mjs <종류>` — 줄여서 `assets/images/items/<종류>/` · `monsters/<종족>/`에 넣는다.
들어간 그림은 [gallery.html](gallery.html)에서 한눈에 본다.

## 프롬프트 쓰는 법 (나노바나나)

**실제로 뽑아서 마음에 든 방식을 기준으로 삼았습니다** — 검 1·2번이 그 문장 그대로입니다.

- **부위마다 1번은 완전한 프롬프트**, 2~10번은 `Same art style as before, now …`로 잇습니다.
  같은 대화창에서 1번부터 차례로 붙여 넣으면 그림체가 맞춰집니다.
- 대화가 길어져 그림체가 흔들리면 **그 부위의 1번부터 새 대화**로 다시 시작하세요.
  1번은 혼자서도 완결된 문장이라 새 대화에서도 됩니다.
- **배경은 마젠타(#FF00FF)** 입니다. 잘라낼 때 이 색을 지우므로, 아이템 쪽에는
  **보라·분홍을 일부러 안 썼습니다** — 같이 지워집니다. 수정·흑요석·심연을 파랑·청록으로 잡은 이유입니다.
- 한 장이 **같은 티어의 5등급 전부**에 쓰입니다(아래 "등급과 그림"). 그래서 이름보다 **재질**을 묘사합니다.
- **몬스터는 정면 3/4**(전투 화면에서 나를 보는 쪽), **보스는 화면을 채울 만큼 크게** 잡았습니다.
  몬스터에도 보라·분홍을 안 썼습니다 — 마족·공허·심연은 **검정 + 청록**으로 통일했습니다.

---

## 1. 장비 (70개, assets/images/items/<부위>/)

슬롯 7종 × 티어 10단계. 파일명: `<sprite>.png`

> **등급과 그림.** 70장이 **장비 350종 전부**를 덮습니다. sprite id에 등급이 없어서(`sword_3`),
> 강철 장검은 일반부터 전설까지 **같은 그림 · 같은 이름**입니다(T17_7 검수 4차 — 전에는 등급마다
> 장검·대검·마검처럼 이름만 바뀌어 그림과 어긋났습니다). 등급은 **테두리 색**으로 구분합니다.
> 이름은 티어 1만 검·두건·옷·바지·손싸개·신·부적이고, 티어 2~10은 장검·투구·갑옷·하갑·건틀릿·각반·펜던트입니다.
>
> **고유 장비 35종은 T17_7에 없앴습니다** — 반지로 바꿨습니다. 반지 그림 프롬프트는 아래 "1-2. 반지"입니다.

### sword

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| sword_1 | sword_1.png | 낡은 검 |
| sword_2 | sword_2.png | 무쇠 장검 |
| sword_3 | sword_3.png | 강철 장검 |
| sword_4 | sword_4.png | 은빛 장검 |
| sword_5 | sword_5.png | 흑철 장검 |
| sword_6 | sword_6.png | 용린 장검 |
| sword_7 | sword_7.png | 수정 장검 |
| sword_8 | sword_8.png | 흑요석 장검 |
| sword_9 | sword_9.png | 월광 장검 |
| sword_10 | sword_10.png | 심연 장검 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`sword_1.png` ✅ 뽑음

```
Flat 2D pixel art game icon of a worn old sword, simple fantasy RPG weapon icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, side view.
```

`sword_2.png` ✅ 뽑음

```
Same art style as before, now an iron sword (slightly better quality/shinier).
```

`sword_3.png`

```
Same art style as before, now a steel sword (polished steel blade, sturdier crossguard).
```

`sword_4.png`

```
Same art style as before, now a silver sword (bright silver blade with a small engraved pattern).
```

`sword_5.png`

```
Same art style as before, now a black iron sword (dark blackened blade, heavier and more menacing).
```

`sword_6.png`

```
Same art style as before, now a dragon-scale sword (deep red scale-textured blade, claw-shaped crossguard).
```

`sword_7.png`

```
Same art style as before, now a crystal sword (translucent pale blue crystal blade, faint glow).
```

`sword_8.png`

```
Same art style as before, now an obsidian sword (glossy black volcanic glass blade with a dark blue sheen).
```

`sword_9.png`

```
Same art style as before, now a moonlight sword (pale silver-blue blade, crescent moon hilt, soft white glow).
```

`sword_10.png`

```
Same art style as before, now an abyss sword (near-black blade with glowing teal cracks, ominous).
```

### helm

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| helm_1 | helm_1.png | 낡은 두건 |
| helm_2 | helm_2.png | 무쇠 투구 |
| helm_3 | helm_3.png | 강철 투구 |
| helm_4 | helm_4.png | 은빛 투구 |
| helm_5 | helm_5.png | 흑철 투구 |
| helm_6 | helm_6.png | 용린 투구 |
| helm_7 | helm_7.png | 수정 투구 |
| helm_8 | helm_8.png | 흑요석 투구 |
| helm_9 | helm_9.png | 월광 투구 |
| helm_10 | helm_10.png | 심연 투구 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`helm_1.png`

```
Flat 2D pixel art game icon of a worn old cloth hood, simple fantasy RPG headgear icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, front view.
```

`helm_2.png`

```
Same art style as before, now an iron cap helmet (simple iron headgear, slightly better quality/shinier).
```

`helm_3.png`

```
Same art style as before, now a steel helmet (polished steel with a nose guard, sturdier).
```

`helm_4.png`

```
Same art style as before, now a silver helmet (bright silver with a small engraved pattern).
```

`helm_5.png`

```
Same art style as before, now a black iron helmet (dark blackened metal, heavier and more menacing).
```

`helm_6.png`

```
Same art style as before, now a dragon-scale helmet (deep red scale plating with two small horn crests).
```

`helm_7.png`

```
Same art style as before, now a crystal helmet (translucent pale blue crystal, faint glow).
```

`helm_8.png`

```
Same art style as before, now an obsidian helmet (glossy black volcanic glass with a dark blue sheen).
```

`helm_9.png`

```
Same art style as before, now a moonlight helmet (pale silver-blue with a crescent moon crest, soft white glow).
```

`helm_10.png`

```
Same art style as before, now an abyss helmet (near-black with glowing teal cracks, ominous).
```

### armor

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| armor_1 | armor_1.png | 낡은 옷 |
| armor_2 | armor_2.png | 무쇠 갑옷 |
| armor_3 | armor_3.png | 강철 갑옷 |
| armor_4 | armor_4.png | 은빛 갑옷 |
| armor_5 | armor_5.png | 흑철 갑옷 |
| armor_6 | armor_6.png | 용린 갑옷 |
| armor_7 | armor_7.png | 수정 갑옷 |
| armor_8 | armor_8.png | 흑요석 갑옷 |
| armor_9 | armor_9.png | 월광 갑옷 |
| armor_10 | armor_10.png | 심연 갑옷 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`armor_1.png`

```
Flat 2D pixel art game icon of a worn old cloth tunic, simple fantasy RPG body armor icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, front view.
```

`armor_2.png`

```
Same art style as before, now an iron chainmail shirt (slightly better quality/shinier).
```

`armor_3.png`

```
Same art style as before, now a steel breastplate (polished steel plates, sturdier).
```

`armor_4.png`

```
Same art style as before, now a silver breastplate (bright silver with a small engraved pattern).
```

`armor_5.png`

```
Same art style as before, now a black iron plate armor (dark blackened metal, heavier and more menacing).
```

`armor_6.png`

```
Same art style as before, now a dragon-scale armor (deep red overlapping scales).
```

`armor_7.png`

```
Same art style as before, now a crystal armor (translucent pale blue crystal plates, faint glow).
```

`armor_8.png`

```
Same art style as before, now an obsidian armor (glossy black volcanic glass plates with a dark blue sheen).
```

`armor_9.png`

```
Same art style as before, now a moonlight armor (pale silver-blue with a crescent moon emblem, soft white glow).
```

`armor_10.png`

```
Same art style as before, now an abyss armor (near-black plates with glowing teal cracks, ominous).
```

### pants

T17_4에서 들어온 부위입니다. 투구·갑옷·장갑에서 HP·DEF를 조금씩 떼어 만들었습니다.
인형 화면에서 **다리 자리**(장갑 옆)에 놓입니다. 다른 부위와 헷갈리지 않게
**허리부터 발목 위까지의 바지 모양**이 보여야 하고, 신발은 그리지 않습니다(신발은 따로 있음).

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| pants_1 | pants_1.png | 낡은 바지 |
| pants_2 | pants_2.png | 무쇠 하갑 |
| pants_3 | pants_3.png | 강철 하갑 |
| pants_4 | pants_4.png | 은빛 하갑 |
| pants_5 | pants_5.png | 흑철 하갑 |
| pants_6 | pants_6.png | 용린 하갑 |
| pants_7 | pants_7.png | 수정 하갑 |
| pants_8 | pants_8.png | 흑요석 하갑 |
| pants_9 | pants_9.png | 월광 하갑 |
| pants_10 | pants_10.png | 심연 하갑 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`pants_1.png`

```
Flat 2D pixel art game icon of a pair of worn old cloth trousers, simple fantasy RPG legwear icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, front view.
```

`pants_2.png`

```
Same art style as before, now a pair of iron-studded trousers (leather with small iron plates on the knees, slightly better quality/shinier).
```

`pants_3.png`

```
Same art style as before, now a pair of steel leg guards (polished steel thigh and knee plates over cloth, sturdier).
```

`pants_4.png`

```
Same art style as before, now a pair of silver leg armor (bright silver plates with a small engraved pattern).
```

`pants_5.png`

```
Same art style as before, now a pair of black iron leg armor (dark blackened metal, heavier and more menacing).
```

`pants_6.png`

```
Same art style as before, now a pair of dragon-scale leg armor (deep red overlapping scales).
```

`pants_7.png`

```
Same art style as before, now a pair of crystal leg armor (translucent pale blue crystal plates, faint glow).
```

`pants_8.png`

```
Same art style as before, now a pair of obsidian leg armor (glossy black volcanic glass plates with a dark blue sheen).
```

`pants_9.png`

```
Same art style as before, now a pair of moonlight leg armor (pale silver-blue with a crescent moon emblem on the belt, soft white glow).
```

`pants_10.png`

```
Same art style as before, now a pair of abyss leg armor (near-black plates with glowing teal cracks, ominous).
```

### gloves

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| gloves_1 | gloves_1.png | 낡은 손싸개 |
| gloves_2 | gloves_2.png | 무쇠 건틀릿 |
| gloves_3 | gloves_3.png | 강철 건틀릿 |
| gloves_4 | gloves_4.png | 은빛 건틀릿 |
| gloves_5 | gloves_5.png | 흑철 건틀릿 |
| gloves_6 | gloves_6.png | 용린 건틀릿 |
| gloves_7 | gloves_7.png | 수정 건틀릿 |
| gloves_8 | gloves_8.png | 흑요석 건틀릿 |
| gloves_9 | gloves_9.png | 월광 건틀릿 |
| gloves_10 | gloves_10.png | 심연 건틀릿 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`gloves_1.png`

```
Flat 2D pixel art game icon of a single worn old cloth hand-wrap glove, simple fantasy RPG glove icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, front view.
```

`gloves_2.png`

```
Same art style as before, now a single iron-plated glove (slightly better quality/shinier).
```

`gloves_3.png`

```
Same art style as before, now a single steel gauntlet (polished steel, sturdier knuckle plates).
```

`gloves_4.png`

```
Same art style as before, now a single silver gauntlet (bright silver with a small engraved pattern).
```

`gloves_5.png`

```
Same art style as before, now a single black iron gauntlet (dark blackened metal, heavier and more menacing).
```

`gloves_6.png`

```
Same art style as before, now a single dragon-scale gauntlet (deep red scales, claw-tipped fingers).
```

`gloves_7.png`

```
Same art style as before, now a single crystal gauntlet (translucent pale blue crystal, faint glow).
```

`gloves_8.png`

```
Same art style as before, now a single obsidian gauntlet (glossy black volcanic glass with a dark blue sheen).
```

`gloves_9.png`

```
Same art style as before, now a single moonlight gauntlet (pale silver-blue with a crescent moon emblem, soft white glow).
```

`gloves_10.png`

```
Same art style as before, now a single abyss gauntlet (near-black with glowing teal cracks, ominous).
```

### boots

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| boots_1 | boots_1.png | 낡은 신 |
| boots_2 | boots_2.png | 무쇠 각반 |
| boots_3 | boots_3.png | 강철 각반 |
| boots_4 | boots_4.png | 은빛 각반 |
| boots_5 | boots_5.png | 흑철 각반 |
| boots_6 | boots_6.png | 용린 각반 |
| boots_7 | boots_7.png | 수정 각반 |
| boots_8 | boots_8.png | 흑요석 각반 |
| boots_9 | boots_9.png | 월광 각반 |
| boots_10 | boots_10.png | 심연 각반 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`boots_1.png`

```
Flat 2D pixel art game icon of a pair of worn old leather shoes, simple fantasy RPG footwear icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, side view.
```

`boots_2.png`

```
Same art style as before, now a pair of iron-toed boots (slightly better quality/shinier).
```

`boots_3.png`

```
Same art style as before, now a pair of steel boots (polished steel plates, sturdier).
```

`boots_4.png`

```
Same art style as before, now a pair of silver boots (bright silver with a small engraved pattern).
```

`boots_5.png`

```
Same art style as before, now a pair of black iron boots (dark blackened metal, heavier and more menacing).
```

`boots_6.png`

```
Same art style as before, now a pair of dragon-scale boots (deep red scales).
```

`boots_7.png`

```
Same art style as before, now a pair of crystal boots (translucent pale blue crystal, faint glow).
```

`boots_8.png`

```
Same art style as before, now a pair of obsidian boots (glossy black volcanic glass with a dark blue sheen).
```

`boots_9.png`

```
Same art style as before, now a pair of moonlight boots (pale silver-blue with small crescent wings, soft white glow).
```

`boots_10.png`

```
Same art style as before, now a pair of abyss boots (near-black with glowing teal cracks, ominous).
```

### accessory

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| accessory_1 | accessory_1.png | 낡은 부적 |
| accessory_2 | accessory_2.png | 무쇠 펜던트 |
| accessory_3 | accessory_3.png | 강철 펜던트 |
| accessory_4 | accessory_4.png | 은빛 펜던트 |
| accessory_5 | accessory_5.png | 흑철 펜던트 |
| accessory_6 | accessory_6.png | 용린 펜던트 |
| accessory_7 | accessory_7.png | 수정 펜던트 |
| accessory_8 | accessory_8.png | 흑요석 펜던트 |
| accessory_9 | accessory_9.png | 월광 펜던트 |
| accessory_10 | accessory_10.png | 심연 펜던트 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`accessory_1.png`

```
Flat 2D pixel art game icon of a worn old paper talisman with a faded red symbol, simple fantasy RPG accessory icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, front view.
```

`accessory_2.png`

```
Same art style as before, now an iron amulet (a small iron charm on a chain, slightly better quality/shinier).
```

`accessory_3.png`

```
Same art style as before, now a steel amulet (polished steel charm with a small round stone).
```

`accessory_4.png`

```
Same art style as before, now a silver amulet (bright silver charm with a small engraved pattern).
```

`accessory_5.png`

```
Same art style as before, now a black iron amulet (dark blackened charm, heavier and more menacing).
```

`accessory_6.png`

```
Same art style as before, now a dragon-scale amulet (a deep red dragon scale set in gold).
```

`accessory_7.png`

```
Same art style as before, now a crystal amulet (translucent pale blue crystal pendant, faint glow).
```

`accessory_8.png`

```
Same art style as before, now an obsidian amulet (glossy black volcanic glass pendant with a dark blue sheen).
```

`accessory_9.png`

```
Same art style as before, now a moonlight amulet (pale silver-blue crescent moon pendant, soft white glow).
```

`accessory_10.png`

```
Same art style as before, now an abyss amulet (near-black pendant with glowing teal cracks, ominous).
```

---

## 1-1. 캐릭터 (1개, assets/images/character/)

캐릭터 탭 → 장비 → [인형]의 **배경 실루엣**입니다. 지금은 네모 세 개로 자리만 잡아뒀고,
이 그림이 들어오면 그 자리를 그대로 대체합니다.

장비 칸이 머리·가슴·양손·발 위에 겹쳐 놓이므로 **정면을 보고 팔을 살짝 벌린 자세**여야 하고,
**장비를 입지 않은 맨몸**(속옷 차림)이어야 합니다. 세로로 길쭉한 비율이 좋습니다.

| sprite id | 파일명 | 프롬프트 |
|---|---|---|
| character_base | character_base.png | `flat 2D pixel art, 96x160, transparent background, front-facing humanoid adventurer standing with arms slightly out, plain undergarments only, no weapons or armor, no gradient shading, consistent light source from top-left` |

---

## 1-2. 반지 (11개, 붙임)

T17_7에 고유 장비 대신 들어온 반지 11종입니다. **한 종에 한 장**이고,
★(1~5)와 등급은 게임 안에서 테두리 색과 "★N +강화" 글자로 구분합니다 — 그래서 재질보다 **보석·문양으로 효과를** 말하게 잡았습니다.
붙인 곳: `assets/images/items/ring/` · `itemIcons`의 `ring_<종류>`.

| sprite id | 이름 | 효과 | 그림의 뜻 |
|---|---|---|---|
| ring_fieldWp | 나그네의 반지 | 사냥터 입장 WP 할인 | 나침반 문양 |
| ring_midnightWp | 새벽의 반지 | 자정 WP 추가 | 떠오르는 해 |
| ring_bigRun | 사냥꾼의 반지 | 6마리 판 확률 | 늑대 송곳니 |
| ring_clearBonus | 정복자의 반지 | 클리어 보너스 | 월계관과 엇갈린 검 |
| ring_exp | 현자의 반지 | EXP | 푸른 보석과 룬 |
| ring_gold | 상인의 반지 | 골드 | 금화 |
| ring_drop | 도굴꾼의 반지 | 드랍 (장비·소재) | 작은 열쇠와 원석 |
| ring_potion | 약초꾼의 반지 | 물약 회복 | 덩굴과 붉은 물방울 |
| ring_shield | 수호자의 반지 | 전투 시작 보호막 | 방패 문장 |
| ring_bossBuff | 결의의 반지 | 보스 버프 배율 | 타오르는 불꽃 보석 |
| ring_bossDamage | 용사의 반지 | 보스에게 주는 피해 | 루비 위의 검 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`ring_fieldWp.png`

```
Flat 2D pixel art game icon of a single fantasy ring seen at a slight angle, a plain worn bronze band with a small compass rose engraved on a flat round top, simple fantasy RPG accessory icon, solid magenta (#FF00FF) background, no pink or purple on the ring, no gradient shading, clean silhouette, centered, no text.
```

`ring_midnightWp.png`

```
Same art style as before, now a different ring: a silver band set with a pale golden stone shaped like a rising sun, thin rays engraved around it.
```

`ring_bigRun.png`

```
Same art style as before, now a different ring: a dark iron band wrapped in brown leather, with a white wolf fang set on top.
```

`ring_clearBonus.png`

```
Same art style as before, now a different ring: a heavy gold signet ring with a laurel wreath and two crossed swords on the seal.
```

`ring_exp.png`

```
Same art style as before, now a different ring: a silver band with a deep blue sapphire and tiny glowing white runes engraved along the band.
```

`ring_gold.png`

```
Same art style as before, now a different ring: a thick gold band with a shiny gold coin set flat on top.
```

`ring_drop.png`

```
Same art style as before, now a different ring: a tarnished bronze band set with a rough uncut green gem, a tiny old key hanging from it.
```

`ring_potion.png`

```
Same art style as before, now a different ring: a light wooden band wrapped in green vines and small leaves, with a red teardrop-shaped gem.
```

`ring_shield.png`

```
Same art style as before, now a different ring: a polished steel band with a small kite-shield crest holding a blue gem.
```

`ring_bossBuff.png`

```
Same art style as before, now a different ring: a black iron band with an orange gem that burns with a small flame.
```

`ring_bossDamage.png`

```
Same art style as before, now a different ring: a gold band with a red ruby and a tiny silver sword laid across the ruby.
```

---

## 1-3. 무기 계열 (T18, 55개, 붙임)

T18에 직업 대신 들어온 무기 계열의 손 장비입니다 — 소검 · 방패 · 단검 · 대검 · 활 각 10티어 + 화살 5티어.
**장검은 위 sword 그대로**입니다(한손검). 장비와 같은 규칙 — 한 장이 5등급을 다 덮고,
재질은 sword와 같은 순서(낡은 → 무쇠 → 강철 → 은빛 → 흑철 → 용린 → 수정 → 흑요석 → 월광 → 심연)입니다.
붙인 곳: `assets/images/items/<줄>/` · `itemIcons`.

**줄마다 1번은 완전한 프롬프트**, 2~10번은 같은 대화창에서 이어 붙입니다.

### shortsword (소검)

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| shortsword_1 | 낡은 소검 | `Flat 2D pixel art game icon of a worn old short sword (short broad blade, simple one-handed grip, small crossguard), simple fantasy RPG weapon icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, side view.` |
| shortsword_2 | 무쇠 소검 | `Same art style as before, now an iron short sword (slightly better quality, shinier).` |
| shortsword_3 | 강철 소검 | `Same art style as before, now a steel short sword (polished steel, sturdier).` |
| shortsword_4 | 은빛 소검 | `Same art style as before, now a silver short sword (bright silver with a small engraved pattern).` |
| shortsword_5 | 흑철 소검 | `Same art style as before, now a black iron short sword (dark blackened metal, heavier and more menacing).` |
| shortsword_6 | 용린 소검 | `Same art style as before, now a dragon-scale short sword (deep red scale texture, claw-shaped details).` |
| shortsword_7 | 수정 소검 | `Same art style as before, now a crystal short sword (translucent pale blue crystal, faint glow).` |
| shortsword_8 | 흑요석 소검 | `Same art style as before, now an obsidian short sword (glossy black volcanic glass with a dark blue sheen).` |
| shortsword_9 | 월광 소검 | `Same art style as before, now a moonlight short sword (pale silver-blue, crescent moon motif, soft white glow).` |
| shortsword_10 | 심연 소검 | `Same art style as before, now an abyss short sword (near-black with glowing teal cracks, ominous).` |

### shield (방패)

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| shield_1 | 낡은 방패 | `Flat 2D pixel art game icon of a worn old shield (round shield with a metal rim and a center boss), simple fantasy RPG weapon icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, front view.` |
| shield_2 | 무쇠 방패 | `Same art style as before, now an iron shield (slightly better quality, shinier).` |
| shield_3 | 강철 방패 | `Same art style as before, now a steel shield (polished steel, sturdier).` |
| shield_4 | 은빛 방패 | `Same art style as before, now a silver shield (bright silver with a small engraved pattern).` |
| shield_5 | 흑철 방패 | `Same art style as before, now a black iron shield (dark blackened metal, heavier and more menacing).` |
| shield_6 | 용린 방패 | `Same art style as before, now a dragon-scale shield (deep red scale texture, claw-shaped details).` |
| shield_7 | 수정 방패 | `Same art style as before, now a crystal shield (translucent pale blue crystal, faint glow).` |
| shield_8 | 흑요석 방패 | `Same art style as before, now an obsidian shield (glossy black volcanic glass with a dark blue sheen).` |
| shield_9 | 월광 방패 | `Same art style as before, now a moonlight shield (pale silver-blue, crescent moon motif, soft white glow).` |
| shield_10 | 심연 방패 | `Same art style as before, now an abyss shield (near-black with glowing teal cracks, ominous).` |

### dagger (단검)

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| dagger_1 | 낡은 단검 | `Flat 2D pixel art game icon of a worn old dagger (short narrow blade, simple grip), simple fantasy RPG weapon icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, side view.` |
| dagger_2 | 무쇠 단검 | `Same art style as before, now an iron dagger (slightly better quality, shinier).` |
| dagger_3 | 강철 단검 | `Same art style as before, now a steel dagger (polished steel, sturdier).` |
| dagger_4 | 은빛 단검 | `Same art style as before, now a silver dagger (bright silver with a small engraved pattern).` |
| dagger_5 | 흑철 단검 | `Same art style as before, now a black iron dagger (dark blackened metal, heavier and more menacing).` |
| dagger_6 | 용린 단검 | `Same art style as before, now a dragon-scale dagger (deep red scale texture, claw-shaped details).` |
| dagger_7 | 수정 단검 | `Same art style as before, now a crystal dagger (translucent pale blue crystal, faint glow).` |
| dagger_8 | 흑요석 단검 | `Same art style as before, now an obsidian dagger (glossy black volcanic glass with a dark blue sheen).` |
| dagger_9 | 월광 단검 | `Same art style as before, now a moonlight dagger (pale silver-blue, crescent moon motif, soft white glow).` |
| dagger_10 | 심연 단검 | `Same art style as before, now an abyss dagger (near-black with glowing teal cracks, ominous).` |

### greatsword (대검)

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| greatsword_1 | 낡은 대검 | `Flat 2D pixel art game icon of a worn old two-handed greatsword (very long wide blade, long two-handed grip), simple fantasy RPG weapon icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, side view, diagonal.` |
| greatsword_2 | 무쇠 대검 | `Same art style as before, now an iron two-handed greatsword (slightly better quality, shinier).` |
| greatsword_3 | 강철 대검 | `Same art style as before, now a steel two-handed greatsword (polished steel, sturdier).` |
| greatsword_4 | 은빛 대검 | `Same art style as before, now a silver two-handed greatsword (bright silver with a small engraved pattern).` |
| greatsword_5 | 흑철 대검 | `Same art style as before, now a black iron two-handed greatsword (dark blackened metal, heavier and more menacing).` |
| greatsword_6 | 용린 대검 | `Same art style as before, now a dragon-scale two-handed greatsword (deep red scale texture, claw-shaped details).` |
| greatsword_7 | 수정 대검 | `Same art style as before, now a crystal two-handed greatsword (translucent pale blue crystal, faint glow).` |
| greatsword_8 | 흑요석 대검 | `Same art style as before, now an obsidian two-handed greatsword (glossy black volcanic glass with a dark blue sheen).` |
| greatsword_9 | 월광 대검 | `Same art style as before, now a moonlight two-handed greatsword (pale silver-blue, crescent moon motif, soft white glow).` |
| greatsword_10 | 심연 대검 | `Same art style as before, now an abyss two-handed greatsword (near-black with glowing teal cracks, ominous).` |

### bow (활)

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| bow_1 | 낡은 활 | `Flat 2D pixel art game icon of a worn old bow (curved bow with a taut string), simple fantasy RPG weapon icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, side view.` |
| bow_2 | 무쇠 장궁 | `Same art style as before, now an iron bow (slightly better quality, shinier).` |
| bow_3 | 강철 장궁 | `Same art style as before, now a steel bow (polished steel, sturdier).` |
| bow_4 | 은빛 장궁 | `Same art style as before, now a silver bow (bright silver with a small engraved pattern).` |
| bow_5 | 흑철 장궁 | `Same art style as before, now a black iron bow (dark blackened metal, heavier and more menacing).` |
| bow_6 | 용린 장궁 | `Same art style as before, now a dragon-scale bow (deep red scale texture, claw-shaped details).` |
| bow_7 | 수정 장궁 | `Same art style as before, now a crystal bow (translucent pale blue crystal, faint glow).` |
| bow_8 | 흑요석 장궁 | `Same art style as before, now an obsidian bow (glossy black volcanic glass with a dark blue sheen).` |
| bow_9 | 월광 장궁 | `Same art style as before, now a moonlight bow (pale silver-blue, crescent moon motif, soft white glow).` |
| bow_10 | 심연 장궁 | `Same art style as before, now an abyss bow (near-black with glowing teal cracks, ominous).` |

### arrow (화살)

효과(일반 · 관통 · 불)는 글자로 구분하고 그림은 티어마다 한 장입니다.

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| arrow_1 | 나무 화살 | `Flat 2D pixel art game icon of a small bundle of three wooden arrows (simple arrowheads, feather fletching), simple fantasy RPG item icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, diagonal.` |
| arrow_2 | 쇠 화살 | `Same art style as before, now a bundle of three iron-tipped arrows (iron arrowheads).` |
| arrow_3 | 강철 화살 | `Same art style as before, now a bundle of three steel-tipped arrows (polished steel arrowheads).` |
| arrow_4 | 은 화살 | `Same art style as before, now a bundle of three silver-tipped arrows (bright silver arrowheads with white fletching).` |
| arrow_5 | 흑요석 화살 | `Same art style as before, now a bundle of three obsidian-tipped arrows (glossy black glass arrowheads with dark blue fletching).` |

---

## 1-4. 특수 화살 (T18_1, 17장, 붙임)

T18_1에 들어온 특수 화살 여덟 종입니다 — 몬스터가 떨구고, 지역마다 티어가 있습니다(40종). **그림은 종류마다 한 장**이고
티어는 이름(나무 · 쇠 · 강철 · 은 · 흑요석)으로 가릅니다 — 장비 한 장이 등급 다섯을 덮는 것과 같습니다.
위 기본 화살(arrow_1~5)은 그대로 씁니다. 붙인 곳: `assets/images/items/arrow/` — 아이콘은 `itemIcons`, 날아가는 화살은 `arrowIcons`.

**아이콘 (8장)** — 화살통 칸 · 화살 목록에 뜹니다. 1번은 완전한 프롬프트, 나머지는 같은 대화창에서 이어 붙입니다.

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| arrow_pierce | 관통 화살 | `Flat 2D pixel art game icon of a small bundle of three long slim arrows with needle-like armor-piercing steel tips and pale cyan fletching, simple fantasy RPG item icon, solid magenta (#FF00FF) background, no gradient shading, clean silhouette, diagonal.` |
| arrow_fire | 불화살 | `Same art style as before, now a bundle of three arrows whose heads are wrapped in cloth and burning with small orange flames.` |
| arrow_bomb | 폭탄 화살 | `Same art style as before, now a bundle of three arrows each carrying a small round black bomb with a short lit fuse near the tip.` |
| arrow_thin | 가는 화살 | `Same art style as before, now a bundle of five very thin short darts with tiny white fletching.` |
| arrow_ice | 얼음 화살 | `Same art style as before, now a bundle of three arrows with pale blue crystal ice heads and frost on the shafts.` |
| arrow_vamp | 흡혈 화살 | `Same art style as before, now a bundle of three dark red arrows with fang-shaped heads and crimson fletching.` |
| arrow_shock | 번개 화살 | `Same art style as before, now a bundle of three arrows with bright yellow zigzag lightning-bolt heads crackling with small sparks.` |
| arrow_heavy | 무거운 화살 | `Same art style as before, now a bundle of two short very thick heavy arrows with large blunt iron heads.` |

**날아가는 화살 (9장)** — 전투 무대에서 아래에서 적에게 날아가는 그림입니다(연출 "나"). 설정의
[화살 연출: 그림]을 누르면 이 그림으로 날고, 없는 것은 코드로 그린 선으로 납니다. **세로로 긴 그림**(화살촉이 위)입니다.

| sprite id | 이름(참고) | 프롬프트 |
|---|---|---|
| fly_basic | 기본 | `Flat 2D pixel art game sprite of a single wooden arrow flying straight upward, arrowhead pointing up, feather fletching at the bottom, slight motion lines, simple fantasy RPG effect sprite, tall vertical composition, solid magenta (#FF00FF) background, no gradient shading, clean silhouette.` |
| fly_pierce | 관통 | `Same art style as before, now a long slim arrow with a needle steel tip trailing a thin pale cyan light streak.` |
| fly_fire | 불 | `Same art style as before, now a flaming arrow with orange fire trailing behind it.` |
| fly_bomb | 폭탄 | `Same art style as before, now an arrow carrying a small round black bomb with a sparking fuse, trailing grey smoke.` |
| fly_thin | 가는 | `Same art style as before, now three very thin short darts flying side by side.` |
| fly_ice | 얼음 | `Same art style as before, now an arrow with a pale blue ice crystal head trailing frost sparkles.` |
| fly_vamp | 흡혈 | `Same art style as before, now a dark red arrow with a fang head trailing crimson mist.` |
| fly_shock | 번개 | `Same art style as before, now an arrow with a yellow lightning-bolt head surrounded by small electric sparks.` |
| fly_heavy | 무거운 | `Same art style as before, now a short very thick heavy arrow with a large blunt iron head and strong motion lines.` |

---

## 1-5. 물약 · 소재 (41장, 아직 안 붙임)

물약 6종과 사냥터 소재 35종(지역 5 × 사냥터 7)입니다. 지금은 상점 · 전투 · 소재 고르기 창에 글자로만 보입니다.
원본은 `img/potion/<sprite id>.png` · `img/material/<sprite id>.png`로 두면 됩니다(sprite id = 게임 안 id).
장비와 같은 그림체라 **1번은 완전한 프롬프트**, 나머지는 같은 대화창에서 이어 붙입니다.

**물약 (6장)** — 병이 클수록 · 화려할수록 좋은 물약. 붉은 물약 다섯에 엘릭서만 금빛입니다.

| sprite id | 이름 | 프롬프트 |
|---|---|---|
| pot_small | 물약(소) | `Flat 2D pixel art game icon of a small round glass potion vial filled with bright red liquid, a simple cork stopper, simple fantasy RPG item icon, solid magenta (#FF00FF) background, no pink or purple on the item, no gradient shading, clean silhouette, centered, no text.` |
| pot_mid | 물약(중) | `Same art style as before, now a medium round-bottom glass flask of red potion with a cork and a twine tie around the neck.` |
| pot_large | 물약(대) | `Same art style as before, now a large round glass flask of deep red potion with a cork and a small paper label.` |
| pot_super | 물약(특) | `Same art style as before, now a tall faceted crystal bottle of glowing red potion with a silver cap.` |
| pot_best | 물약(최상급) | `Same art style as before, now an ornate gold-trimmed crystal bottle of shining crimson potion with a small ruby on the stopper.` |
| elixir | 엘릭서 | `Same art style as before, now an ornate golden bottle of glowing golden elixir with soft light rays around it.` |

**소재 (35장)** — 그 사냥터에서만 나는 물건입니다. 이름이 곧 그림이라 이름을 그대로 옮겼습니다.
1번(mat_r1_meadow)만 완전한 프롬프트입니다. 지역이 바뀌어도 같은 대화창에서 이어 붙이면 됩니다.

| sprite id | 이름 (사냥터) | 프롬프트 |
|---|---|---|
| mat_r1_meadow | 들판의 마른 풀 (시작의 들판) | `Flat 2D pixel art game icon of a small bundle of dry golden meadow grass tied with twine, simple fantasy RPG crafting material icon, solid magenta (#FF00FF) background, no pink or purple on the item, no gradient shading, clean silhouette, centered, no text.` |
| mat_r1_windmill | 멈추지 않는 바람개비 (바람개비 언덕) | `Same art style as before, now a small wooden pinwheel with four cream cloth blades and faint motion lines as if still spinning.` |
| mat_r1_mushroom | 마르지 않는 홀씨 (버섯 골짜기) | `Same art style as before, now a moist brown mushroom spore pod releasing a few glowing pale green spores.` |
| mat_r1_bramble | 부러지지 않는 가시 (가시덤불 길) | `Same art style as before, now a single long dark green thorn, hard and shiny like metal.` |
| mat_r1_goblin | 고블린이 훔친 천 조각 (고블린 굴) | `Same art style as before, now a torn patch of red-and-yellow striped cloth with crude stitches.` |
| mat_r1_tower | 금이 간 초석 (무너진 돌탑) | `Same art style as before, now a square grey foundation stone with a deep crack and a little moss.` |
| mat_r1_camp | 빼앗긴 인장 (도적 야영지) | `Same art style as before, now a bronze seal stamp with a wooden handle and an engraved crest on the bottom.` |
| mat_r2_cave | 빛나는 동굴 이끼 (이끼 낀 동굴) | `Same art style as before, now a clump of glowing teal-green cave moss on a small dark rock.` |
| mat_r2_oldwood | 말을 거는 나뭇잎 (속삭이는 고목숲) | `Same art style as before, now a large green leaf whose veins form a faint sleepy face.` |
| mat_r2_web | 끊어지지 않는 거미줄 (거미줄 수풀) | `Same art style as before, now a coil of shiny silver-white spider silk wound around a small twig.` |
| mat_r2_grave | 삭지 않은 수의 조각 (잊혀진 무덤가) | `Same art style as before, now a neatly folded piece of pale grey burial cloth with a faded stitched pattern.` |
| mat_r2_logging | 타다 만 장작 (버려진 벌목지) | `Same art style as before, now a half-burnt log with a charred black end and a few faint orange embers.` |
| mat_r2_quarry | 결이 고운 석재 (무너진 채석장) | `Same art style as before, now a smooth rectangular block of fine-grained grey stone with neat thin layers.` |
| mat_r2_marsh | 걷히지 않는 늪안개 (안개 낀 늪) | `Same art style as before, now a small corked glass jar holding swirling greenish-grey fog.` |
| mat_r3_oasis | 마지막 한 모금의 물 (말라붙은 오아시스) | `Same art style as before, now a small worn leather waterskin with one clear blue drop of water at the spout.` |
| mat_r3_cliff | 절벽의 부서진 뼈대 (무너진 절벽길) | `Same art style as before, now a broken sun-bleached rib bone with a jagged end.` |
| mat_r3_riverbed | 마른 강바닥의 흔적 (마른 강바닥) | `Same art style as before, now a cracked slab of dried riverbed mud with a wavy ripple pattern.` |
| mat_r3_fossil | 돌이 된 송곳니 (화석 골짜기) | `Same art style as before, now a large fossilized fang turned to tan stone.` |
| mat_r3_saltflat | 굳은 소금 결정 (소금 평원) | `Same art style as before, now a cluster of white cubic salt crystals.` |
| mat_r3_ridge | 능선의 마른 깃털 (바람 능선) | `Same art style as before, now a dry tan-and-brown hawk feather.` |
| mat_r3_outpost | 초소의 녹슨 열쇠 (버려진 초소) | `Same art style as before, now a large old rusty iron key.` |
| mat_r4_crater | 식지 않는 분화구 재 (분화구 가장자리) | `Same art style as before, now a small pile of grey ash with glowing orange embers inside.` |
| mat_r4_hotspring | 식지 않는 온천석 (유황 온천) | `Same art style as before, now a smooth round yellowish stone giving off pale yellow sulfur steam.` |
| mat_r4_ashfield | 들판에 쌓인 화산재 (재의 들판) | `Same art style as before, now a small cloth pouch spilling dark grey volcanic ash.` |
| mat_r4_lavatube | 식은 용암 덩이 (용암 동굴) | `Same art style as before, now a lump of black cooled lava rock with faint glowing red cracks.` |
| mat_r4_hideout | 피로 맺은 서약서 (검은 손 은신처) | `Same art style as before, now a rolled parchment scroll sealed with dark red wax and a black handprint.` |
| mat_r4_obsidian | 깨진 흑요석 조각 (흑요석 비탈) | `Same art style as before, now a sharp broken shard of glossy black obsidian with a dark blue sheen.` |
| mat_r4_forge | 꺼지지 않은 불씨 (버려진 대장간) | `Same art style as before, now a small glowing orange ember held in a tiny iron cage.` |
| mat_r5_abyss | 심연에서 건진 조각 (심연 입구) | `Same art style as before, now a jagged black fragment with glowing teal cracks.` |
| mat_r5_temple | 물에 불은 기도서 (가라앉은 신전) | `Same art style as before, now a swollen waterlogged old prayer book with a dripping blue cover.` |
| mat_r5_frost | 녹지 않는 서리 (서리 회랑) | `Same art style as before, now a jagged chunk of pale blue ice covered in frost crystals.` |
| mat_r5_hall | 대전의 깨진 왕관 (무너진 대전) | `Same art style as before, now a broken gold crown with one piece missing and a single blue gem.` |
| mat_r5_root | 세계수의 잔뿌리 (세계수 뿌리) | `Same art style as before, now a small tangle of fine roots glowing with golden-green light.` |
| mat_r5_rift | 공허의 파편 (공허의 균열) | `Same art style as before, now a floating shard of dark void glass edged with teal light.` |
| mat_r5_throne | 폐왕의 부러진 홀 (폐왕의 옥좌) | `Same art style as before, now the broken top half of a royal scepter with a dull blue orb.` |

---

## 2. 몬스터 — 1차: 아키타입 15개만 (assets/images/monsters/)

처음엔 이것만 만들면 됨. 같은 종족 몬스터는 티어 구분 없이 이 이미지 하나를 공유.
**goblin · aquatic · demon은 T17_4에 새로 생긴 종족입니다** (고블린 / 물가·심해 / 마족).

| arch | 파일명 | 대표 몬스터(참고) |
|---|---|---|
| arch_aquatic | aquatic.png | 늪 두꺼비 등 6종 |
| arch_bandit | bandit.png | 초원 좀도둑 등 9종 |
| arch_beast | beast.png | 들개 등 13종 |
| arch_bird | bird.png | 칼깃 참새 등 11종 |
| arch_demon | demon.png | 불꽃 임프 등 5종 |
| arch_fungus | fungus.png | 홀씨 버섯 등 6종 |
| arch_goblin | goblin.png | 고블린 졸개 등 4종 |
| arch_golem | golem.png | 돌무더기 등 10종 |
| arch_insect | insect.png | 왕개미 등 14종 |
| arch_knight | knight.png | 녹슨 갑주병 등 5종 |
| arch_lizard | lizard.png | 새끼 도마뱀 등 10종 |
| arch_plant | plant.png | 가시덩굴 등 10종 |
| arch_slime | slime.png | 초록 슬라임 등 13종 |
| arch_spirit | spirit.png | 산들바람 정령 등 10종 |
| arch_undead | undead.png | 떠도는 해골 등 15종 |

**프롬프트** — 같은 대화창에서 위에서부터 차례로 (종족 대표 그림이라 특정 개체가 아닙니다)

`aquatic.png`

```
Flat 2D pixel art game sprite of a big warty swamp toad with webbed feet, bulging yellow eyes and a wide mouth, olive-green and brown, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`bandit.png`

```
Same art style as before, now a hooded human bandit with a scarf over the face, holding a short curved dagger, brown leather clothes.
```

`beast.png`

```
Same art style as before, now a snarling wild dog with bristling brown-grey fur and bared fangs.
```

`bird.png`

```
Same art style as before, now a sharp-beaked black crow with wings spread, ready to dive.
```

`demon.png`

```
Same art style as before, now a small horned demon with red skin, bat wings and a pointed tail, black claws.
```

`fungus.png`

```
Same art style as before, now a walking mushroom creature with a spotted brown-and-cream cap and stubby little legs.
```

`goblin.png`

```
Same art style as before, now a scrawny green goblin with big pointed ears, a ragged loincloth and a crude wooden club.
```

`golem.png`

```
Same art style as before, now a lumbering golem of stacked grey stone blocks with glowing yellow eyes.
```

`insect.png`

```
Same art style as before, now a giant ant with a shiny dark brown carapace and big mandibles.
```

`knight.png`

```
Same art style as before, now an empty suit of dark iron armor walking on its own, sword and shield, glowing eyes in the helmet slit.
```

`lizard.png`

```
Same art style as before, now an upright lizardman warrior with green scales holding a spear.
```

`plant.png`

```
Same art style as before, now a thorny vine monster with a toothy red-and-yellow flower head.
```

`slime.png`

```
Same art style as before, now a round green slime with a glossy highlight and simple dot eyes.
```

`spirit.png`

```
Same art style as before, now a floating wind spirit of swirling pale cyan air with two bright eyes.
```

`undead.png`

```
Same art style as before, now a walking skeleton warrior with cracked bones and a rusty sword.
```

---

## 2-1. 보스 (5개, assets/images/monsters/)

T17_5부터 보스는 **그림을 따로** 씁니다(`boss_r{지역}`). 전에는 같은 티어 일반 몬스터와
sprite id가 겹쳐 그림도 같이 쓸 뻔했습니다. 지역 마지막 관문이라 일반 몬스터보다 크고 위압적으로.

**T17_7부터 보스전 무대에 뜹니다.** 원본을 `img/boss/boss_N.png`(2048px, 투명 배경)로 넣고
`node tools/crop-sprites.mjs boss` → `assets/images/monsters/boss/boss_rN.png`(512px), 그다음 `src/ui/monsterIcons.ts`에 한 줄.
무대는 **1인칭**이라(T17_7 검수 4차) 보스가 한가운데서 **화면(나)을 봅니다** — 정면이나 정면 3/4 그림이 맞습니다.
(칼 버전 무대 BossStageSword는 보스가 왼쪽에서 오른쪽을 봤습니다.)
다섯 다 붙였습니다. `img/boss/boss_2_1.png`(악어 옆모습)은 여분이라 `boss_r2_1.png`로 줄이기만 하고 안 붙였습니다.

| sprite id | 파일명 | 이름 | 지역 | 원형 |
|---|---|---|---|---|
| boss_r1 | boss_r1.png | 들개 우두머리 | 바람 부는 초원 | 야수형 |
| boss_r2 | boss_r2.png | 늪을 삼킨 악어 | 속삭이는 숲 | 파충류형 |
| boss_r3 | boss_r3.png | 협곡을 지키는 거상 | 메마른 협곡 | 바위형 |
| boss_r4 | boss_r4.png | 대장간의 마지막 기사 | 잿빛 화산지대 | 기갑형 |
| boss_r5 | boss_r5.png | 심연의 지배자 | 잊혀진 심연 | 마족형 |

**프롬프트** — 새 대화에서 1번부터 차례로

`boss_r1.png`

```
Flat 2D pixel art game sprite of a huge scarred alpha wild dog, the pack leader, thick ruff of grey-brown fur, a torn ear, bared fangs and a spiked leather bandit collar, fantasy RPG boss monster, large and imposing, filling most of the frame, front three-quarter view facing the viewer, full body, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`boss_r2.png`

```
Same art style as before, now another boss: a gigantic moss-covered swamp crocodile rising out of murky green water, jaws wide open, reeds and vines hanging from its back, glowing yellow eyes. Large and imposing, filling most of the frame.
```

`boss_r3.png`

```
Same art style as before, now another boss: a towering sandstone colossus carved out of canyon rock, red-orange rock layers across its body, sand pouring from cracked joints, glowing amber eyes. Large and imposing, filling most of the frame.
```

`boss_r4.png`

```
Same art style as before, now another boss: a massive knight in soot-blackened forged armor with glowing orange-hot seams, gripping a huge greatsword still red-hot from the forge, embers drifting around. Large and imposing, filling most of the frame.
```

`boss_r5.png`

```
Same art style as before, now another boss: a colossal demon lord of the abyss, black armored body with glowing teal cracks, four curved horns, tattered black wings and a dark iron crown, teal fire in its eyes. Large and imposing, filling most of the frame.
```

---

## 3. 몬스터 — 2차 확장: 티어별 세부 이미지 (총 141개, beast 13개 빼고 붙임)

1차로 부족하면 여기서 추가. 파일명: `<sprite>.png`
종족마다 **새 대화**에서 1번부터 붙여 넣으세요 — 1번만 완결된 문장입니다.

### aquatic

| sprite id | 파일명 | 이름 |
|---|---|---|
| aquatic_8 | aquatic_8.png | 늪 두꺼비 |
| aquatic_11 | aquatic_11.png | 진흙 메기 |
| aquatic_12 | aquatic_12.png | 소금 게 |
| aquatic_16 | aquatic_16.png | 유황 두꺼비 |
| aquatic_21 | aquatic_21.png | 심해 아귀 |
| aquatic_23 | aquatic_23.png | 심연 촉수 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`aquatic_8.png`

```
Flat 2D pixel art game sprite of a big warty swamp toad, olive-green and brown, with bulging yellow eyes and a wide mouth, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`aquatic_11.png`

```
Same art style as before, now a mud catfish crawling out of cracked mud, slimy brown-grey skin and long whiskers.
```

`aquatic_12.png`

```
Same art style as before, now a large crab crusted with white salt crystals, pale grey shell, claws raised.
```

`aquatic_16.png`

```
Same art style as before, now a sulfur toad with warty yellow-orange skin, yellow sulfur crust and steam rising from its back.
```

`aquatic_21.png`

```
Same art style as before, now a deep-sea anglerfish with a dark navy body, a glowing teal lure and a huge needle-toothed mouth.
```

`aquatic_23.png`

```
Same art style as before, now a mass of dark tentacles rising from black water, glowing teal suckers and a single eye in the middle.
```

### bandit

| sprite id | 파일명 | 이름 |
|---|---|---|
| bandit_4 | bandit_4.png | 초원 좀도둑 |
| bandit_5 | bandit_5.png | 떠돌이 도적 |
| bandit_8 | bandit_8.png | 도끼 산적 |
| bandit_9 | bandit_9.png | 도굴꾼 |
| bandit_12 | bandit_12.png | 사막 약탈자 |
| bandit_14 | bandit_14.png | 사막 척후병 |
| bandit_16 | bandit_16.png | 검은 손 자객 |
| bandit_20 | bandit_20.png | 혈맹 검객 |
| bandit_25 | bandit_25.png | 배신자 장군 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`bandit_4.png`

```
Flat 2D pixel art game sprite of a scrawny grassland thief in a patched brown hood, holding a small knife and a stolen coin pouch, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`bandit_5.png`

```
Same art style as before, now a wandering bandit in a worn leather coat with a scarf mask, holding a short sword.
```

`bandit_8.png`

```
Same art style as before, now a burly bearded mountain bandit in a fur vest carrying a big woodcutter's axe.
```

`bandit_9.png`

```
Same art style as before, now a grave robber in a dirty grey cloak with a shovel, a lantern and a sack of loot on his back.
```

`bandit_12.png`

```
Same art style as before, now a desert raider wrapped in sand-colored cloth, face covered, holding a curved scimitar.
```

`bandit_14.png`

```
Same art style as before, now a desert scout in light tan leather armor with a short bow and a spyglass on the belt.
```

`bandit_16.png`

```
Same art style as before, now an assassin dressed all in black with a black hand emblem on the chest, twin daggers, red eyes above a mask.
```

`bandit_20.png`

```
Same art style as before, now a blood-oath swordsman in dark red and black armor, bandaged face, holding a long single-edged blade.
```

`bandit_25.png`

```
Same art style as before, now a traitor general in ornate dark steel armor with a torn royal cape, holding a greatsword, cold teal eyes.
```

### beast

| sprite id | 파일명 | 이름 |
|---|---|---|
| beast_1 | beast_1.png | 들개 |
| beast_2 | beast_2.png | 잿빛 늑대 |
| beast_3 | beast_3.png | 뿔토끼 |
| beast_4 | beast_4.png | 굶주린 살쾡이 |
| beast_5 | beast_5.png | 도적단 사냥개 |
| beast_6 | beast_6.png | 동굴 박쥐 |
| beast_7 | beast_7.png | 그림자 늑대 |
| beast_8 | beast_8.png | 검은 멧돼지 |
| beast_12 | beast_12.png | 뼈 하이에나 |
| beast_13 | beast_13.png | 뿔 산양 |
| beast_15 | beast_15.png | 능선 늑대 |
| beast_16 | beast_16.png | 화산 비룡 |
| beast_21 | beast_21.png | 설원 이리 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`beast_1.png`

```
Flat 2D pixel art game sprite of a scrappy wild dog with brown fur and bared teeth, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`beast_2.png`

```
Same art style as before, now a lean hungry grey wolf with ash-colored fur.
```

`beast_3.png`

```
Same art style as before, now a white rabbit with a single sharp horn on its forehead and angry red eyes.
```

`beast_4.png`

```
Same art style as before, now a starving wildcat with tawny striped fur and visible ribs, hissing.
```

`beast_5.png`

```
Same art style as before, now a dark brown bandit hound with a spiked leather collar and a broken chain leash.
```

`beast_6.png`

```
Same art style as before, now a large cave bat with dark brown leathery wings spread wide, big ears and small fangs.
```

`beast_7.png`

```
Same art style as before, now a shadow wolf with black smoke-like fur and glowing white eyes.
```

`beast_8.png`

```
Same art style as before, now a black wild boar with long curved tusks and bristly fur.
```

`beast_12.png`

```
Same art style as before, now a gaunt hyena with sandy spotted fur, patches of exposed bone and a skull-like face.
```

`beast_13.png`

```
Same art style as before, now a mountain goat with huge curled horns and a shaggy white-grey coat, standing on a rock.
```

`beast_15.png`

```
Same art style as before, now a ridge wolf with thick grey-white fur blowing in the wind and fierce yellow eyes.
```

`beast_16.png`

```
Same art style as before, now a small volcanic wyvern with charcoal-black scales, glowing orange cracks and ember-lit wings.
```

`beast_21.png`

```
Same art style as before, now a snowfield wolf with frosty white-blue fur, icicles hanging from its coat, misty breath.
```

### bird

| sprite id | 파일명 | 이름 |
|---|---|---|
| bird_2 | bird_2.png | 칼깃 참새 |
| bird_3 | bird_3.png | 들까마귀 |
| bird_5 | bird_5.png | 망보는 까마귀 |
| bird_6 | bird_6.png | 매부리 |
| bird_8 | bird_8.png | 무덤 까마귀 |
| bird_10 | bird_10.png | 절벽 독수리 |
| bird_11 | bird_11.png | 벼랑 매 |
| bird_14 | bird_14.png | 폭풍 까마귀 |
| bird_18 | bird_18.png | 잿빛 하피 |
| bird_21 | bird_21.png | 옥좌의 까마귀 |
| bird_22 | bird_22.png | 뇌명조 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`bird_2.png`

```
Flat 2D pixel art game sprite of a small brown-grey sparrow whose feathers are sharp metal blades, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`bird_3.png`

```
Same art style as before, now a black field crow with ruffled feathers and a sharp beak.
```

`bird_5.png`

```
Same art style as before, now a lookout crow wearing a tiny red bandana, perched and alert.
```

`bird_6.png`

```
Same art style as before, now a hawk with a sharply hooked beak and brown-and-cream plumage, wings half spread.
```

`bird_8.png`

```
Same art style as before, now a gaunt graveyard crow with dull black feathers, pale eyes and a bone in its talons.
```

`bird_10.png`

```
Same art style as before, now a cliff eagle with dark brown wings spread wide, a white head and powerful talons.
```

`bird_11.png`

```
Same art style as before, now a sand-colored cliff falcon in a diving pose with sharp talons.
```

`bird_14.png`

```
Same art style as before, now a storm crow with dark grey feathers crackling with small yellow lightning sparks.
```

`bird_18.png`

```
Same art style as before, now an ash harpy, half woman and half bird, with soot-grey feathered wings, talons and wild white hair.
```

`bird_21.png`

```
Same art style as before, now a large glossy black raven wearing a small tarnished gold crown, glowing teal eyes.
```

`bird_22.png`

```
Same art style as before, now a thunderbird with deep blue and white feathers crackling with bright yellow lightning, wings spread wide.
```

### demon

| sprite id | 파일명 | 이름 |
|---|---|---|
| demon_16 | demon_16.png | 불꽃 임프 |
| demon_18 | demon_18.png | 재의 악마 |
| demon_21 | demon_21.png | 심연의 하수인 |
| demon_22 | demon_22.png | 공허 추적자 |
| demon_25 | demon_25.png | 공허의 문지기 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`demon_16.png`

```
Flat 2D pixel art game sprite of a small fire imp with red skin, tiny bat wings, little horns and a flame at the tip of its tail, grinning, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`demon_18.png`

```
Same art style as before, now an ash demon with cracked charcoal-grey skin, curved horns, glowing orange eyes and embers falling off its body.
```

`demon_21.png`

```
Same art style as before, now an abyssal minion, a hunched black-skinned demon with small horns, long claws and glowing teal eyes.
```

`demon_22.png`

```
Same art style as before, now a void stalker, a lean shadowy demon on all fours with a featureless face, long clawed limbs and teal cracks along its body.
```

`demon_25.png`

```
Same art style as before, now a void gatekeeper, a tall armored demon holding a huge black key-shaped halberd, teal flames around its horns.
```

### fungus

| sprite id | 파일명 | 이름 |
|---|---|---|
| fungus_1 | fungus_1.png | 홀씨 버섯 |
| fungus_4 | fungus_4.png | 독포자 버섯 |
| fungus_7 | fungus_7.png | 부패한 균사체 |
| fungus_12 | fungus_12.png | 유황 버섯 |
| fungus_17 | fungus_17.png | 발광 포자군 |
| fungus_23 | fungus_23.png | 심연 균사왕 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`fungus_1.png`

```
Flat 2D pixel art game sprite of a small walking mushroom with a spotted brown cap and stubby legs, puffing spores, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`fungus_4.png`

```
Same art style as before, now a poison spore mushroom with a sickly yellow-green cap releasing a green toxic spore cloud.
```

`fungus_7.png`

```
Same art style as before, now a rotting blob of grey-white fungal threads with small mushrooms sprouting from it and a gaping mouth.
```

`fungus_12.png`

```
Same art style as before, now a sulfur mushroom with a bright yellow crusty cap, puffing yellow spores.
```

`fungus_17.png`

```
Same art style as before, now a cluster of glowing mushrooms with bright cyan-green bioluminescent caps.
```

`fungus_23.png`

```
Same art style as before, now a giant mushroom king with a wide black cap crowned by smaller mushrooms, glowing teal gills and root-like tendrils.
```

### goblin

| sprite id | 파일명 | 이름 |
|---|---|---|
| goblin_3 | goblin_3.png | 고블린 졸개 |
| goblin_4 | goblin_4.png | 고블린 투석꾼 |
| goblin_5 | goblin_5.png | 고블린 주술사 |
| goblin_9 | goblin_9.png | 고블린 채굴꾼 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`goblin_3.png`

```
Flat 2D pixel art game sprite of a small green goblin grunt in ragged clothes with a crude wooden club, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`goblin_4.png`

```
Same art style as before, now a goblin slinger swinging a leather sling with a stone, a pouch of rocks on its belt.
```

`goblin_5.png`

```
Same art style as before, now a goblin shaman in a bone mask and feathered headdress, holding a staff topped with a skull and a green flame.
```

`goblin_9.png`

```
Same art style as before, now a goblin miner with a pickaxe, a helmet with a candle on top and a sack of ore.
```

### golem

| sprite id | 파일명 | 이름 |
|---|---|---|
| golem_3 | golem_3.png | 돌무더기 |
| golem_9 | golem_9.png | 깎다 만 석상 |
| golem_11 | golem_11.png | 모래 골렘 |
| golem_13 | golem_13.png | 화석 골렘 |
| golem_14 | golem_14.png | 소금 결정 골렘 |
| golem_17 | golem_17.png | 용암 골렘 |
| golem_19 | golem_19.png | 무쇠 수호자 |
| golem_22 | golem_22.png | 서리 거상 |
| golem_23 | golem_23.png | 대전 수호 석상 |
| golem_25 | golem_25.png | 태고의 거인 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`golem_3.png`

```
Flat 2D pixel art game sprite of a small rubble golem, a pile of grey stones held together by a glowing yellow core, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`golem_9.png`

```
Same art style as before, now a half-carved stone statue come to life, one side smooth and sculpted, the other side raw rock with chisel marks.
```

`golem_11.png`

```
Same art style as before, now a sand golem of packed tan sand with grains streaming off its arms.
```

`golem_13.png`

```
Same art style as before, now a fossil golem, a stone body with embedded dinosaur bones and ammonite shells.
```

`golem_14.png`

```
Same art style as before, now a golem made of jagged white and pale grey salt crystals.
```

`golem_17.png`

```
Same art style as before, now a lava golem of black rock plates with glowing orange molten cracks, dripping lava.
```

`golem_19.png`

```
Same art style as before, now an iron guardian, a heavy riveted cast-iron construct with a furnace glowing in its chest.
```

`golem_22.png`

```
Same art style as before, now a frost colossus made of blue ice blocks and packed snow, icicle spikes on its shoulders.
```

`golem_23.png`

```
Same art style as before, now a great-hall guardian statue, an ornate marble knight statue with cracked gold trim and glowing teal eyes.
```

`golem_25.png`

```
Same art style as before, now a primordial giant of ancient moss-covered stone with tree roots growing through its body and glowing green runes.
```

### insect

| sprite id | 파일명 | 이름 |
|---|---|---|
| insect_2 | insect_2.png | 왕개미 |
| insect_4 | insect_4.png | 독거미 |
| insect_6 | insect_6.png | 날개미 떼 |
| insect_7 | insect_7.png | 그늘 거미 |
| insect_8 | insect_8.png | 독니 거미 |
| insect_9 | insect_9.png | 뿔풍뎅이 |
| insect_11 | insect_11.png | 모래 파리 떼 |
| insect_12 | insect_12.png | 모래 전갈 |
| insect_13 | insect_13.png | 뼈 먹는 딱정벌레 |
| insect_16 | insect_16.png | 검은 말벌 |
| insect_17 | insect_17.png | 독 사육 지네 |
| insect_19 | insect_19.png | 흑요석 전갈 |
| insect_21 | insect_21.png | 심연 지네 |
| insect_22 | insect_22.png | 뿌리 갉는 벌레 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`insect_2.png`

```
Flat 2D pixel art game sprite of a giant ant with a shiny dark brown carapace and big mandibles, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`insect_4.png`

```
Same art style as before, now a poison spider with a black body and green markings, dripping green venom.
```

`insect_6.png`

```
Same art style as before, now a swarm of winged ants flying together in a tight cluster.
```

`insect_7.png`

```
Same art style as before, now a shade spider with a dark grey hairy body and many glowing yellow eyes, hanging from a web thread.
```

`insect_8.png`

```
Same art style as before, now a fang spider with a dark brown body, red markings and huge dripping green-tipped fangs.
```

`insect_9.png`

```
Same art style as before, now a rhinoceros beetle with a big horn and a glossy dark green-brown shell.
```

`insect_11.png`

```
Same art style as before, now a buzzing swarm of small tan sand flies.
```

`insect_12.png`

```
Same art style as before, now a sand scorpion with a tan carapace, pincers open and stinger raised.
```

`insect_13.png`

```
Same art style as before, now a bone-eating beetle with an ivory-white shell, gnawing on a bone.
```

`insect_16.png`

```
Same art style as before, now a black wasp with a black-and-orange striped abdomen and a huge stinger.
```

`insect_17.png`

```
Same art style as before, now a long dark red centipede wearing a metal collar, dripping green venom.
```

`insect_19.png`

```
Same art style as before, now an obsidian scorpion with a glossy black glass-like carapace and a sharp crystal stinger.
```

`insect_21.png`

```
Same art style as before, now a giant black centipede with glowing teal segments.
```

`insect_22.png`

```
Same art style as before, now a fat pale grub with strong jaws, burrowing through thick tree roots.
```

### knight

| sprite id | 파일명 | 이름 |
|---|---|---|
| knight_15 | knight_15.png | 녹슨 갑주병 |
| knight_18 | knight_18.png | 흑철 기사 |
| knight_20 | knight_20.png | 성채 수호병 |
| knight_22 | knight_22.png | 심판의 기사 |
| knight_24 | knight_24.png | 폐왕의 근위대 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`knight_15.png`

```
Flat 2D pixel art game sprite of a walking suit of rusty orange-brown armor with a dented helmet and a notched sword, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`knight_18.png`

```
Same art style as before, now a black iron knight in heavy dark steel plate armor with a tower shield and a longsword.
```

`knight_20.png`

```
Same art style as before, now a fortress guard in bulky steel armor with a halberd and a large rectangular shield.
```

`knight_22.png`

```
Same art style as before, now a knight of judgment in white-and-gold armor with a blindfolded helmet, holding a greatsword and a set of scales.
```

`knight_24.png`

```
Same art style as before, now a royal guard of a fallen king in tarnished gold and black armor with a torn cloak, spear and a shield with a broken crown crest.
```

### lizard

| sprite id | 파일명 | 이름 |
|---|---|---|
| lizard_4 | lizard_4.png | 새끼 도마뱀 |
| lizard_7 | lizard_7.png | 도마뱀 전사 |
| lizard_9 | lizard_9.png | 바위 도마뱀 |
| lizard_10 | lizard_10.png | 늪지 악어 |
| lizard_13 | lizard_13.png | 협곡 이구아나 |
| lizard_16 | lizard_16.png | 온천 도롱뇽 |
| lizard_17 | lizard_17.png | 비늘 사냥꾼 |
| lizard_18 | lizard_18.png | 샐러맨더 |
| lizard_20 | lizard_20.png | 용린 전사 |
| lizard_23 | lizard_23.png | 고룡의 후예 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`lizard_4.png`

```
Flat 2D pixel art game sprite of a small green baby lizard with big eyes, crawling, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`lizard_7.png`

```
Same art style as before, now an upright lizardman warrior with green scales, a wooden shield and a spear.
```

`lizard_9.png`

```
Same art style as before, now a rock lizard whose grey scales look like stone plates.
```

`lizard_10.png`

```
Same art style as before, now a dark green swamp crocodile half out of murky water, jaws open.
```

`lizard_13.png`

```
Same art style as before, now a canyon iguana with spiky orange-brown scales and a spiny crest.
```

`lizard_16.png`

```
Same art style as before, now a hot-spring salamander with smooth orange and yellow skin, steam rising around it.
```

`lizard_17.png`

```
Same art style as before, now a lizardman hunter with dark red scales, a bone spear and a necklace of trophy teeth.
```

`lizard_18.png`

```
Same art style as before, now a salamander with fiery red-orange skin and flames running along its back.
```

`lizard_20.png`

```
Same art style as before, now a tall lizardman in dragon-scale armor with small horns and a curved blade.
```

`lizard_23.png`

```
Same art style as before, now a young dragon with bronze-green scales, small wings and glowing teal eyes.
```

### plant

| sprite id | 파일명 | 이름 |
|---|---|---|
| plant_3 | plant_3.png | 가시덩굴 |
| plant_5 | plant_5.png | 식인초 |
| plant_6 | plant_6.png | 속삭이는 나무 |
| plant_7 | plant_7.png | 끈끈이 덩굴 |
| plant_8 | plant_8.png | 뒤틀린 고목 |
| plant_12 | plant_12.png | 말라가는 야자수 |
| plant_13 | plant_13.png | 사막 선인장 |
| plant_18 | plant_18.png | 유리 가시덤불 |
| plant_19 | plant_19.png | 무쇠 덩굴 |
| plant_24 | plant_24.png | 세계수의 가지 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`plant_3.png`

```
Flat 2D pixel art game sprite of a thorny vine creature of twisting green vines covered in sharp thorns, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`plant_5.png`

```
Same art style as before, now a man-eating plant with a big red-and-yellow toothy flower head on a thick green stem.
```

`plant_6.png`

```
Same art style as before, now an old mossy tree with a sleepy face in its bark, leaves rustling as if whispering.
```

`plant_7.png`

```
Same art style as before, now a sticky vine monster dripping clear sap, covered in sticky pods.
```

`plant_8.png`

```
Same art style as before, now a twisted ancient tree with claw-like gnarled branches and an angry face in the bark.
```

`plant_12.png`

```
Same art style as before, now a withering palm tree monster with drooping brown fronds and coconut eyes.
```

`plant_13.png`

```
Same art style as before, now a desert cactus monster with arms, long spines and a small yellow flower on top.
```

`plant_18.png`

```
Same art style as before, now a glass thornbush with glassy branches and sharp black obsidian thorns.
```

`plant_19.png`

```
Same art style as before, now a tangle of rusty iron vines with nail-like thorns, twisting like chains.
```

`plant_24.png`

```
Same art style as before, now a living branch of the world tree, a massive ancient branch with glowing golden-green leaves and roots like arms.
```

### slime

| sprite id | 파일명 | 이름 |
|---|---|---|
| slime_1 | slime_1.png | 초록 슬라임 |
| slime_2 | slime_2.png | 끈적이 |
| slime_3 | slime_3.png | 늪 젤리 |
| slime_11 | slime_11.png | 모래 점액 |
| slime_13 | slime_13.png | 석영 슬라임 |
| slime_16 | slime_16.png | 잿빛 점액 |
| slime_17 | slime_17.png | 끓는 점액 |
| slime_18 | slime_18.png | 용암 슬라임 |
| slime_19 | slime_19.png | 쇳물 점액 |
| slime_21 | slime_21.png | 심연 젤리 |
| slime_22 | slime_22.png | 심해 해파리 |
| slime_23 | slime_23.png | 서리 젤리 |
| slime_24 | slime_24.png | 공허 점액 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`slime_1.png`

```
Flat 2D pixel art game sprite of a round green slime with a glossy highlight and simple dot eyes, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`slime_2.png`

```
Same art style as before, now a lopsided sticky light-brown slime dripping goo.
```

`slime_3.png`

```
Same art style as before, now a murky olive-green swamp jelly with bits of weeds inside.
```

`slime_11.png`

```
Same art style as before, now a tan sand slime with sand grains mixed into its body.
```

`slime_13.png`

```
Same art style as before, now a clear white slime with quartz crystals growing out of it.
```

`slime_16.png`

```
Same art style as before, now a grey ash-covered slime with tiny ember sparks.
```

`slime_17.png`

```
Same art style as before, now a yellow-orange slime bubbling and steaming as if boiling.
```

`slime_18.png`

```
Same art style as before, now a molten orange-red lava slime with a dark cooling crust.
```

`slime_19.png`

```
Same art style as before, now a slime of molten iron, bright orange-white liquid metal with grey slag.
```

`slime_21.png`

```
Same art style as before, now a dark navy translucent jelly with a glowing teal core.
```

`slime_22.png`

```
Same art style as before, now a deep-sea jellyfish with a translucent blue bell and long glowing teal tentacles.
```

`slime_23.png`

```
Same art style as before, now an icy pale blue slime with frost crystals on top.
```

`slime_24.png`

```
Same art style as before, now a pitch-black slime with glowing teal cracks and tiny white star-like specks inside.
```

### spirit

| sprite id | 파일명 | 이름 |
|---|---|---|
| spirit_2 | spirit_2.png | 산들바람 정령 |
| spirit_8 | spirit_8.png | 숲 요정 |
| spirit_9 | spirit_9.png | 도깨비불 |
| spirit_11 | spirit_11.png | 모래 소용돌이 |
| spirit_12 | spirit_12.png | 신기루 정령 |
| spirit_14 | spirit_14.png | 돌개바람 정령 |
| spirit_16 | spirit_16.png | 증기 정령 |
| spirit_17 | spirit_17.png | 화염 정령 |
| spirit_21 | spirit_21.png | 흑염 정령 |
| spirit_24 | spirit_24.png | 태초의 불꽃 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`spirit_2.png`

```
Flat 2D pixel art game sprite of a gentle breeze spirit, a small swirl of pale green-white wind with two bright eyes, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`spirit_8.png`

```
Same art style as before, now a small mischievous forest fairy with leaf wings and a green glow.
```

`spirit_9.png`

```
Same art style as before, now a will-o'-the-wisp, a floating blue-white flame with a faint face.
```

`spirit_11.png`

```
Same art style as before, now a spinning tan sand vortex spirit with glowing eyes.
```

`spirit_12.png`

```
Same art style as before, now a mirage spirit, a shimmering semi-transparent heat-haze figure in pale gold and light blue.
```

`spirit_14.png`

```
Same art style as before, now a whirlwind spirit, a strong grey-white tornado carrying debris, with angry eyes.
```

`spirit_16.png`

```
Same art style as before, now a steam spirit, a cloud of white steam with a face and wispy arms.
```

`spirit_17.png`

```
Same art style as before, now a fire elemental, a humanoid figure made of orange and yellow flames.
```

`spirit_21.png`

```
Same art style as before, now a spirit of black fire with teal edges and glowing white eyes.
```

`spirit_24.png`

```
Same art style as before, now the primordial flame, a large radiant white-gold flame spirit wearing a crown of fire.
```

### undead

| sprite id | 파일명 | 이름 |
|---|---|---|
| undead_5 | undead_5.png | 떠도는 해골 |
| undead_7 | undead_7.png | 무덤지기 |
| undead_8 | undead_8.png | 고치 속 망자 |
| undead_9 | undead_9.png | 굶주린 구울 |
| undead_10 | undead_10.png | 창백한 망령 |
| undead_12 | undead_12.png | 되살아난 화석 |
| undead_13 | undead_13.png | 말라붙은 파수꾼 |
| undead_15 | undead_15.png | 원한의 유령 |
| undead_17 | undead_17.png | 재투성이 망자 |
| undead_18 | undead_18.png | 흑요석 리치 |
| undead_19 | undead_19.png | 버려진 제물 |
| undead_21 | undead_21.png | 익사한 사제 |
| undead_22 | undead_22.png | 얼어붙은 망령 |
| undead_23 | undead_23.png | 망령 사제 |
| undead_25 | undead_25.png | 폐허의 군주 |

**프롬프트** — 같은 대화창에서 1번부터 차례로

`undead_5.png`

```
Flat 2D pixel art game sprite of a wandering skeleton with cracked bones and a rusty short sword, simple fantasy RPG monster, front three-quarter view facing the viewer, full body, centered, solid magenta (#FF00FF) background, no pink or purple on the creature, no gradient shading, clean silhouette, no text.
```

`undead_7.png`

```
Same art style as before, now a gravekeeper zombie in tattered grey clothes with a shovel and a lantern.
```

`undead_8.png`

```
Same art style as before, now a corpse wrapped in a spider silk cocoon, only a skeletal face and one hand showing.
```

`undead_9.png`

```
Same art style as before, now a hungry ghoul, a gaunt grey-green creature with long claws and a wide mouth.
```

`undead_10.png`

```
Same art style as before, now a pale wraith, a translucent white-blue ghost in a tattered shroud.
```

`undead_12.png`

```
Same art style as before, now a reanimated fossil, a dinosaur-like skeleton of stone-brown fossil bones.
```

`undead_13.png`

```
Same art style as before, now a mummified sentry in old desert armor holding a spear.
```

`undead_15.png`

```
Same art style as before, now a vengeful ghost with a twisted screaming face, wrapped in chains, cold blue glow.
```

`undead_17.png`

```
Same art style as before, now an ash-covered corpse shambling forward, grey soot-caked body with glowing ember eyes.
```

`undead_18.png`

```
Same art style as before, now an obsidian lich, a skeletal sorcerer in dark robes with a black glass crown, a staff and teal soul-fire.
```

`undead_19.png`

```
Same art style as before, now an abandoned sacrifice, a bound undead figure in ritual wrappings with red markings.
```

`undead_21.png`

```
Same art style as before, now a drowned priest, a waterlogged undead in soaked white robes draped with seaweed, holding a rusted censer.
```

`undead_22.png`

```
Same art style as before, now a frozen wraith, an icy blue ghost encased in frost with icicles hanging from it.
```

`undead_23.png`

```
Same art style as before, now a hooded ghost priest with a staff and a pale teal glow.
```

`undead_25.png`

```
Same art style as before, now the lord of ruins, a towering undead king with a broken crown, a tattered royal cloak and a massive sword.
```
