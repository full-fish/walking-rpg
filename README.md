# StepQuest

**걸어서 번 WP로 하루 10~20분, 사냥터를 하나씩 쓸어 담으며 천천히 강해지는 도트 RPG.**

폰이 센 걸음이 WP(행동력)가 되고, WP로 사냥터에 들어가 몬스터를 잡고 보스를 넘어 다음 지역으로 갑니다.
전투는 자동이고, 고르는 것은 스탯 배분 · 장비(무기 계열) · 물약 · 들어갈 사냥터입니다. Android 전용입니다.

| 문서 | 내용 |
|---|---|
| [implementation_plan.v5.md](implementation_plan.v5.md) | 계획서 — 규칙 · 공식 · 태스크(T번호)와 결정 기록 |
| [MY-TASKS.md](MY-TASKS.md) | 실기기에서 확인할 것 · 답해 줄 것 (`->` 줄이 요청) |
| [balance.md](balance.md) | 밸런스 표 — `npm run balance`가 다시 쓴다 |
| [assets/images/sprite-list.md](assets/images/sprite-list.md) | 그림 목록과 생성 프롬프트 |
| [이미지 갤러리](#이미지-갤러리) | 지금 게임에 들어간 그림 전부 — 이 문서 맨 아래 |

## 개발

```bash
npm install
npm start            # Metro (dev build를 설치한 기기에서 접속)

npm run typecheck    # tsc --noEmit
npm run lint
npm test             # src/ 단위 테스트 (vitest)
npm run format       # prettier
```

작업 하나가 끝나면 `npm run typecheck && npm run lint && npm test`가 통과해야 합니다.

**콘텐츠 · 밸런스 도구** (tools/, vitest로 돈다)

| 명령 | 하는 일 |
|---|---|
| `npm run gen` | 원형(src/content/archetypes)에서 몬스터 · 장비 데이터(src/content/data)를 다시 뽑는다 |
| `npm run validate` | 콘텐츠 데이터 검증 |
| `npm run bench` | 보스 승률 등 전투 벤치 |
| `npm run sim` | 가상의 플레이어로 Lv50까지 며칠 걸리나 |
| `npm run balance` | balance.md를 다시 쓴다 |

## 실기기 dev build (Android)

```bash
npm i -g eas-cli
eas login
eas build --profile development --platform android   # 빌드 완료 후 나오는 QR/링크로 APK 설치
npm start                                             # 설치된 앱에서 Metro 접속
```

Health Connect 등 네이티브 모듈을 쓰므로 Expo Go로는 돌아가지 않습니다.

## 폴더

```
app/              화면 (expo-router) — (tabs)/ 모험 · 캐릭터 · 상점 · 설정, battle · field
src/game/         게임 규칙 — 순수 TS. 숫자와 공식은 전부 formulas.ts 한 곳
src/content/      게임 데이터 — archetypes/(원형, 손으로 고침) → data/(npm run gen이 뽑음)
src/save/         세이브 스키마(zod)와 버전 올리기(migrations)
src/stores/       zustand 스토어 — 화면과 게임 규칙을 잇는다
src/ui/           공용 컴포넌트 · 그림 등록(itemIcons · monsterIcons · arrowIcons)
tools/            콘텐츠 생성 · 검증 · 벤치 · 시뮬 · 그림 자르기
assets/images/    게임에 들어가는 그림 (items/<종류>/ · monsters/<종족>/)
img/              그림 원본 2048px — git에 안 올린다
```

## 규칙

- `src/game/` · `src/content/`는 React를 import하지 않는다 — Node(테스트 · 도구)에서도 돈다.
- 수식과 숫자는 `src/game/formulas.ts`에만 둔다.
- 세이브 모양을 바꾸면 `src/save/migrations.ts`에 한 단계 + 테스트 하나.
- 새 의존성은 먼저 묻고, `npx expo install`로만 넣는다.
- 커밋: `feat(T{N}): 한글 요약` · 문서는 `docs(...)`. 밸런스와 기능 커밋은 나눈다.

## 그림 넣기

1. 원본(2048px, 투명 배경)을 `img/<종류>/<sprite id>.png`로 둔다 — 예: `img/sword/sword_3.png`, `img/slime/slime_1.png`
2. `node tools/crop-sprites.mjs <종류>` — 줄여서 `assets/images/`에 넣는다(인자 없이 돌리면 전부)
   - 장비 · 반지 · 화살 256px → `items/<종류>/`, 몬스터 384px → `monsters/<종족>/`, 보스 512px → `monsters/boss/`
   - 끝나면 [그림 모음 페이지](assets/images/gallery.html)와 아래 갤러리를 다시 쓴다
3. 새 sprite id면 `src/ui/itemIcons.ts`(장비 · 반지 · 화살) · `monsterIcons.ts` · `arrowIcons.ts`(날아가는 화살)에 한 줄씩 —
   React Native는 `require()` 경로를 조합할 수 없어서 한 장에 한 줄입니다

## 이미지 갤러리

종류를 누르면 접힙니다. 종류 고르기 · 칸 크기 조절은 **그림 모음 페이지**에서 합니다 —
`open assets/images/gallery.html`로 브라우저에서 여세요(GitHub에서는 HTML이 소스로만 보입니다).

<!-- gallery:start -->
<details open><summary><b>장검</b> sword · 10</summary>

<img src="assets/images/items/sword/sword_1.png" width="56" title="sword_1.png"> <img src="assets/images/items/sword/sword_2.png" width="56" title="sword_2.png"> <img src="assets/images/items/sword/sword_3.png" width="56" title="sword_3.png"> <img src="assets/images/items/sword/sword_4.png" width="56" title="sword_4.png"> <img src="assets/images/items/sword/sword_5.png" width="56" title="sword_5.png"> <img src="assets/images/items/sword/sword_6.png" width="56" title="sword_6.png"> <img src="assets/images/items/sword/sword_7.png" width="56" title="sword_7.png"> <img src="assets/images/items/sword/sword_8.png" width="56" title="sword_8.png"> <img src="assets/images/items/sword/sword_9.png" width="56" title="sword_9.png"> <img src="assets/images/items/sword/sword_10.png" width="56" title="sword_10.png">

</details>

<details open><summary><b>소검</b> shortsword · 10</summary>

<img src="assets/images/items/shortsword/shortsword_1.png" width="56" title="shortsword_1.png"> <img src="assets/images/items/shortsword/shortsword_2.png" width="56" title="shortsword_2.png"> <img src="assets/images/items/shortsword/shortsword_3.png" width="56" title="shortsword_3.png"> <img src="assets/images/items/shortsword/shortsword_4.png" width="56" title="shortsword_4.png"> <img src="assets/images/items/shortsword/shortsword_5.png" width="56" title="shortsword_5.png"> <img src="assets/images/items/shortsword/shortsword_6.png" width="56" title="shortsword_6.png"> <img src="assets/images/items/shortsword/shortsword_7.png" width="56" title="shortsword_7.png"> <img src="assets/images/items/shortsword/shortsword_8.png" width="56" title="shortsword_8.png"> <img src="assets/images/items/shortsword/shortsword_9.png" width="56" title="shortsword_9.png"> <img src="assets/images/items/shortsword/shortsword_10.png" width="56" title="shortsword_10.png">

</details>

<details open><summary><b>방패</b> shield · 10</summary>

<img src="assets/images/items/shield/shield_1.png" width="56" title="shield_1.png"> <img src="assets/images/items/shield/shield_2.png" width="56" title="shield_2.png"> <img src="assets/images/items/shield/shield_3.png" width="56" title="shield_3.png"> <img src="assets/images/items/shield/shield_4.png" width="56" title="shield_4.png"> <img src="assets/images/items/shield/shield_5.png" width="56" title="shield_5.png"> <img src="assets/images/items/shield/shield_6.png" width="56" title="shield_6.png"> <img src="assets/images/items/shield/shield_7.png" width="56" title="shield_7.png"> <img src="assets/images/items/shield/shield_8.png" width="56" title="shield_8.png"> <img src="assets/images/items/shield/shield_9.png" width="56" title="shield_9.png"> <img src="assets/images/items/shield/shield_10.png" width="56" title="shield_10.png">

</details>

<details open><summary><b>단검</b> dagger · 10</summary>

<img src="assets/images/items/dagger/dagger_1.png" width="56" title="dagger_1.png"> <img src="assets/images/items/dagger/dagger_2.png" width="56" title="dagger_2.png"> <img src="assets/images/items/dagger/dagger_3.png" width="56" title="dagger_3.png"> <img src="assets/images/items/dagger/dagger_4.png" width="56" title="dagger_4.png"> <img src="assets/images/items/dagger/dagger_5.png" width="56" title="dagger_5.png"> <img src="assets/images/items/dagger/dagger_6.png" width="56" title="dagger_6.png"> <img src="assets/images/items/dagger/dagger_7.png" width="56" title="dagger_7.png"> <img src="assets/images/items/dagger/dagger_8.png" width="56" title="dagger_8.png"> <img src="assets/images/items/dagger/dagger_9.png" width="56" title="dagger_9.png"> <img src="assets/images/items/dagger/dagger_10.png" width="56" title="dagger_10.png">

</details>

<details open><summary><b>대검</b> greatsword · 10</summary>

<img src="assets/images/items/greatsword/greatsword_1.png" width="56" title="greatsword_1.png"> <img src="assets/images/items/greatsword/greatsword_2.png" width="56" title="greatsword_2.png"> <img src="assets/images/items/greatsword/greatsword_3.png" width="56" title="greatsword_3.png"> <img src="assets/images/items/greatsword/greatsword_4.png" width="56" title="greatsword_4.png"> <img src="assets/images/items/greatsword/greatsword_5.png" width="56" title="greatsword_5.png"> <img src="assets/images/items/greatsword/greatsword_6.png" width="56" title="greatsword_6.png"> <img src="assets/images/items/greatsword/greatsword_7.png" width="56" title="greatsword_7.png"> <img src="assets/images/items/greatsword/greatsword_8.png" width="56" title="greatsword_8.png"> <img src="assets/images/items/greatsword/greatsword_9.png" width="56" title="greatsword_9.png"> <img src="assets/images/items/greatsword/greatsword_10.png" width="56" title="greatsword_10.png">

</details>

<details open><summary><b>활</b> bow · 10</summary>

<img src="assets/images/items/bow/bow_1.png" width="56" title="bow_1.png"> <img src="assets/images/items/bow/bow_2.png" width="56" title="bow_2.png"> <img src="assets/images/items/bow/bow_3.png" width="56" title="bow_3.png"> <img src="assets/images/items/bow/bow_4.png" width="56" title="bow_4.png"> <img src="assets/images/items/bow/bow_5.png" width="56" title="bow_5.png"> <img src="assets/images/items/bow/bow_6.png" width="56" title="bow_6.png"> <img src="assets/images/items/bow/bow_7.png" width="56" title="bow_7.png"> <img src="assets/images/items/bow/bow_8.png" width="56" title="bow_8.png"> <img src="assets/images/items/bow/bow_9.png" width="56" title="bow_9.png"> <img src="assets/images/items/bow/bow_10.png" width="56" title="bow_10.png">

</details>

<details open><summary><b>투구</b> helm · 10</summary>

<img src="assets/images/items/helm/helm_1.png" width="56" title="helm_1.png"> <img src="assets/images/items/helm/helm_2.png" width="56" title="helm_2.png"> <img src="assets/images/items/helm/helm_3.png" width="56" title="helm_3.png"> <img src="assets/images/items/helm/helm_4.png" width="56" title="helm_4.png"> <img src="assets/images/items/helm/helm_5.png" width="56" title="helm_5.png"> <img src="assets/images/items/helm/helm_6.png" width="56" title="helm_6.png"> <img src="assets/images/items/helm/helm_7.png" width="56" title="helm_7.png"> <img src="assets/images/items/helm/helm_8.png" width="56" title="helm_8.png"> <img src="assets/images/items/helm/helm_9.png" width="56" title="helm_9.png"> <img src="assets/images/items/helm/helm_10.png" width="56" title="helm_10.png">

</details>

<details open><summary><b>갑옷</b> armor · 10</summary>

<img src="assets/images/items/armor/armor_1.png" width="56" title="armor_1.png"> <img src="assets/images/items/armor/armor_2.png" width="56" title="armor_2.png"> <img src="assets/images/items/armor/armor_3.png" width="56" title="armor_3.png"> <img src="assets/images/items/armor/armor_4.png" width="56" title="armor_4.png"> <img src="assets/images/items/armor/armor_5.png" width="56" title="armor_5.png"> <img src="assets/images/items/armor/armor_6.png" width="56" title="armor_6.png"> <img src="assets/images/items/armor/armor_7.png" width="56" title="armor_7.png"> <img src="assets/images/items/armor/armor_8.png" width="56" title="armor_8.png"> <img src="assets/images/items/armor/armor_9.png" width="56" title="armor_9.png"> <img src="assets/images/items/armor/armor_10.png" width="56" title="armor_10.png">

</details>

<details open><summary><b>하의</b> pants · 10</summary>

<img src="assets/images/items/pants/pants_1.png" width="56" title="pants_1.png"> <img src="assets/images/items/pants/pants_2.png" width="56" title="pants_2.png"> <img src="assets/images/items/pants/pants_3.png" width="56" title="pants_3.png"> <img src="assets/images/items/pants/pants_4.png" width="56" title="pants_4.png"> <img src="assets/images/items/pants/pants_5.png" width="56" title="pants_5.png"> <img src="assets/images/items/pants/pants_6.png" width="56" title="pants_6.png"> <img src="assets/images/items/pants/pants_7.png" width="56" title="pants_7.png"> <img src="assets/images/items/pants/pants_8.png" width="56" title="pants_8.png"> <img src="assets/images/items/pants/pants_9.png" width="56" title="pants_9.png"> <img src="assets/images/items/pants/pants_10.png" width="56" title="pants_10.png">

</details>

<details open><summary><b>장갑</b> gloves · 10</summary>

<img src="assets/images/items/gloves/gloves_1.png" width="56" title="gloves_1.png"> <img src="assets/images/items/gloves/gloves_2.png" width="56" title="gloves_2.png"> <img src="assets/images/items/gloves/gloves_3.png" width="56" title="gloves_3.png"> <img src="assets/images/items/gloves/gloves_4.png" width="56" title="gloves_4.png"> <img src="assets/images/items/gloves/gloves_5.png" width="56" title="gloves_5.png"> <img src="assets/images/items/gloves/gloves_6.png" width="56" title="gloves_6.png"> <img src="assets/images/items/gloves/gloves_7.png" width="56" title="gloves_7.png"> <img src="assets/images/items/gloves/gloves_8.png" width="56" title="gloves_8.png"> <img src="assets/images/items/gloves/gloves_9.png" width="56" title="gloves_9.png"> <img src="assets/images/items/gloves/gloves_10.png" width="56" title="gloves_10.png">

</details>

<details open><summary><b>신발</b> boots · 10</summary>

<img src="assets/images/items/boots/boots_1.png" width="56" title="boots_1.png"> <img src="assets/images/items/boots/boots_2.png" width="56" title="boots_2.png"> <img src="assets/images/items/boots/boots_3.png" width="56" title="boots_3.png"> <img src="assets/images/items/boots/boots_4.png" width="56" title="boots_4.png"> <img src="assets/images/items/boots/boots_5.png" width="56" title="boots_5.png"> <img src="assets/images/items/boots/boots_6.png" width="56" title="boots_6.png"> <img src="assets/images/items/boots/boots_7.png" width="56" title="boots_7.png"> <img src="assets/images/items/boots/boots_8.png" width="56" title="boots_8.png"> <img src="assets/images/items/boots/boots_9.png" width="56" title="boots_9.png"> <img src="assets/images/items/boots/boots_10.png" width="56" title="boots_10.png">

</details>

<details open><summary><b>장신구</b> accessory · 10</summary>

<img src="assets/images/items/accessory/accessory_1.png" width="56" title="accessory_1.png"> <img src="assets/images/items/accessory/accessory_2.png" width="56" title="accessory_2.png"> <img src="assets/images/items/accessory/accessory_3.png" width="56" title="accessory_3.png"> <img src="assets/images/items/accessory/accessory_4.png" width="56" title="accessory_4.png"> <img src="assets/images/items/accessory/accessory_5.png" width="56" title="accessory_5.png"> <img src="assets/images/items/accessory/accessory_6.png" width="56" title="accessory_6.png"> <img src="assets/images/items/accessory/accessory_7.png" width="56" title="accessory_7.png"> <img src="assets/images/items/accessory/accessory_8.png" width="56" title="accessory_8.png"> <img src="assets/images/items/accessory/accessory_9.png" width="56" title="accessory_9.png"> <img src="assets/images/items/accessory/accessory_10.png" width="56" title="accessory_10.png">

</details>

<details open><summary><b>반지</b> ring · 11</summary>

<img src="assets/images/items/ring/ring_bigRun.png" width="56" title="ring_bigRun.png"> <img src="assets/images/items/ring/ring_bossBuff.png" width="56" title="ring_bossBuff.png"> <img src="assets/images/items/ring/ring_bossDamage.png" width="56" title="ring_bossDamage.png"> <img src="assets/images/items/ring/ring_clearBonus.png" width="56" title="ring_clearBonus.png"> <img src="assets/images/items/ring/ring_drop.png" width="56" title="ring_drop.png"> <img src="assets/images/items/ring/ring_exp.png" width="56" title="ring_exp.png"> <img src="assets/images/items/ring/ring_fieldWp.png" width="56" title="ring_fieldWp.png"> <img src="assets/images/items/ring/ring_gold.png" width="56" title="ring_gold.png"> <img src="assets/images/items/ring/ring_midnightWp.png" width="56" title="ring_midnightWp.png"> <img src="assets/images/items/ring/ring_potion.png" width="56" title="ring_potion.png"> <img src="assets/images/items/ring/ring_shield.png" width="56" title="ring_shield.png">

</details>

<details open><summary><b>화살</b> arrow · 22</summary>

<img src="assets/images/items/arrow/arrow_1.png" width="56" title="arrow_1.png"> <img src="assets/images/items/arrow/arrow_2.png" width="56" title="arrow_2.png"> <img src="assets/images/items/arrow/arrow_3.png" width="56" title="arrow_3.png"> <img src="assets/images/items/arrow/arrow_4.png" width="56" title="arrow_4.png"> <img src="assets/images/items/arrow/arrow_5.png" width="56" title="arrow_5.png"> <img src="assets/images/items/arrow/arrow_bomb.png" width="56" title="arrow_bomb.png"> <img src="assets/images/items/arrow/arrow_fire.png" width="56" title="arrow_fire.png"> <img src="assets/images/items/arrow/arrow_heavy.png" width="56" title="arrow_heavy.png"> <img src="assets/images/items/arrow/arrow_ice.png" width="56" title="arrow_ice.png"> <img src="assets/images/items/arrow/arrow_pierce.png" width="56" title="arrow_pierce.png"> <img src="assets/images/items/arrow/arrow_shock.png" width="56" title="arrow_shock.png"> <img src="assets/images/items/arrow/arrow_thin.png" width="56" title="arrow_thin.png"> <img src="assets/images/items/arrow/arrow_vamp.png" width="56" title="arrow_vamp.png"> <img src="assets/images/items/arrow/fly_basic.png" width="56" title="fly_basic.png"> <img src="assets/images/items/arrow/fly_bomb.png" width="56" title="fly_bomb.png"> <img src="assets/images/items/arrow/fly_fire.png" width="56" title="fly_fire.png"> <img src="assets/images/items/arrow/fly_heavy.png" width="56" title="fly_heavy.png"> <img src="assets/images/items/arrow/fly_ice.png" width="56" title="fly_ice.png"> <img src="assets/images/items/arrow/fly_pierce.png" width="56" title="fly_pierce.png"> <img src="assets/images/items/arrow/fly_shock.png" width="56" title="fly_shock.png"> <img src="assets/images/items/arrow/fly_thin.png" width="56" title="fly_thin.png"> <img src="assets/images/items/arrow/fly_vamp.png" width="56" title="fly_vamp.png">

</details>

<details open><summary><b>보스</b> boss · 6</summary>

<img src="assets/images/monsters/boss/boss_r1.png" width="56" title="boss_r1.png"> <img src="assets/images/monsters/boss/boss_r2_1.png" width="56" title="boss_r2_1.png"> <img src="assets/images/monsters/boss/boss_r2.png" width="56" title="boss_r2.png"> <img src="assets/images/monsters/boss/boss_r3.png" width="56" title="boss_r3.png"> <img src="assets/images/monsters/boss/boss_r4.png" width="56" title="boss_r4.png"> <img src="assets/images/monsters/boss/boss_r5.png" width="56" title="boss_r5.png">

</details>

<details open><summary><b>수생형</b> aquatic · 6</summary>

<img src="assets/images/monsters/aquatic/aquatic_8.png" width="56" title="aquatic_8.png"> <img src="assets/images/monsters/aquatic/aquatic_11.png" width="56" title="aquatic_11.png"> <img src="assets/images/monsters/aquatic/aquatic_12.png" width="56" title="aquatic_12.png"> <img src="assets/images/monsters/aquatic/aquatic_16.png" width="56" title="aquatic_16.png"> <img src="assets/images/monsters/aquatic/aquatic_21.png" width="56" title="aquatic_21.png"> <img src="assets/images/monsters/aquatic/aquatic_23.png" width="56" title="aquatic_23.png">

</details>

<details open><summary><b>인간형</b> bandit · 9</summary>

<img src="assets/images/monsters/bandit/bandit_4.png" width="56" title="bandit_4.png"> <img src="assets/images/monsters/bandit/bandit_5.png" width="56" title="bandit_5.png"> <img src="assets/images/monsters/bandit/bandit_8.png" width="56" title="bandit_8.png"> <img src="assets/images/monsters/bandit/bandit_9.png" width="56" title="bandit_9.png"> <img src="assets/images/monsters/bandit/bandit_12.png" width="56" title="bandit_12.png"> <img src="assets/images/monsters/bandit/bandit_14.png" width="56" title="bandit_14.png"> <img src="assets/images/monsters/bandit/bandit_16.png" width="56" title="bandit_16.png"> <img src="assets/images/monsters/bandit/bandit_20.png" width="56" title="bandit_20.png"> <img src="assets/images/monsters/bandit/bandit_25.png" width="56" title="bandit_25.png">

</details>

<details open><summary><b>조류형</b> bird · 11</summary>

<img src="assets/images/monsters/bird/bird_2.png" width="56" title="bird_2.png"> <img src="assets/images/monsters/bird/bird_3.png" width="56" title="bird_3.png"> <img src="assets/images/monsters/bird/bird_5.png" width="56" title="bird_5.png"> <img src="assets/images/monsters/bird/bird_6.png" width="56" title="bird_6.png"> <img src="assets/images/monsters/bird/bird_8.png" width="56" title="bird_8.png"> <img src="assets/images/monsters/bird/bird_10.png" width="56" title="bird_10.png"> <img src="assets/images/monsters/bird/bird_11.png" width="56" title="bird_11.png"> <img src="assets/images/monsters/bird/bird_14.png" width="56" title="bird_14.png"> <img src="assets/images/monsters/bird/bird_18.png" width="56" title="bird_18.png"> <img src="assets/images/monsters/bird/bird_21.png" width="56" title="bird_21.png"> <img src="assets/images/monsters/bird/bird_22.png" width="56" title="bird_22.png">

</details>

<details open><summary><b>마족형</b> demon · 5</summary>

<img src="assets/images/monsters/demon/demon_16.png" width="56" title="demon_16.png"> <img src="assets/images/monsters/demon/demon_18.png" width="56" title="demon_18.png"> <img src="assets/images/monsters/demon/demon_21.png" width="56" title="demon_21.png"> <img src="assets/images/monsters/demon/demon_22.png" width="56" title="demon_22.png"> <img src="assets/images/monsters/demon/demon_25.png" width="56" title="demon_25.png">

</details>

<details open><summary><b>균사형</b> fungus · 6</summary>

<img src="assets/images/monsters/fungus/fungus_1.png" width="56" title="fungus_1.png"> <img src="assets/images/monsters/fungus/fungus_4.png" width="56" title="fungus_4.png"> <img src="assets/images/monsters/fungus/fungus_7.png" width="56" title="fungus_7.png"> <img src="assets/images/monsters/fungus/fungus_12.png" width="56" title="fungus_12.png"> <img src="assets/images/monsters/fungus/fungus_17.png" width="56" title="fungus_17.png"> <img src="assets/images/monsters/fungus/fungus_23.png" width="56" title="fungus_23.png">

</details>

<details open><summary><b>소인형</b> goblin · 4</summary>

<img src="assets/images/monsters/goblin/goblin_3.png" width="56" title="goblin_3.png"> <img src="assets/images/monsters/goblin/goblin_4.png" width="56" title="goblin_4.png"> <img src="assets/images/monsters/goblin/goblin_5.png" width="56" title="goblin_5.png"> <img src="assets/images/monsters/goblin/goblin_9.png" width="56" title="goblin_9.png">

</details>

<details open><summary><b>바위형</b> golem · 10</summary>

<img src="assets/images/monsters/golem/golem_3.png" width="56" title="golem_3.png"> <img src="assets/images/monsters/golem/golem_9.png" width="56" title="golem_9.png"> <img src="assets/images/monsters/golem/golem_11.png" width="56" title="golem_11.png"> <img src="assets/images/monsters/golem/golem_13.png" width="56" title="golem_13.png"> <img src="assets/images/monsters/golem/golem_14.png" width="56" title="golem_14.png"> <img src="assets/images/monsters/golem/golem_17.png" width="56" title="golem_17.png"> <img src="assets/images/monsters/golem/golem_19.png" width="56" title="golem_19.png"> <img src="assets/images/monsters/golem/golem_22.png" width="56" title="golem_22.png"> <img src="assets/images/monsters/golem/golem_23.png" width="56" title="golem_23.png"> <img src="assets/images/monsters/golem/golem_25.png" width="56" title="golem_25.png">

</details>

<details open><summary><b>벌레형</b> insect · 14</summary>

<img src="assets/images/monsters/insect/insect_2.png" width="56" title="insect_2.png"> <img src="assets/images/monsters/insect/insect_4.png" width="56" title="insect_4.png"> <img src="assets/images/monsters/insect/insect_6.png" width="56" title="insect_6.png"> <img src="assets/images/monsters/insect/insect_7.png" width="56" title="insect_7.png"> <img src="assets/images/monsters/insect/insect_8.png" width="56" title="insect_8.png"> <img src="assets/images/monsters/insect/insect_9.png" width="56" title="insect_9.png"> <img src="assets/images/monsters/insect/insect_11.png" width="56" title="insect_11.png"> <img src="assets/images/monsters/insect/insect_12.png" width="56" title="insect_12.png"> <img src="assets/images/monsters/insect/insect_13.png" width="56" title="insect_13.png"> <img src="assets/images/monsters/insect/insect_16.png" width="56" title="insect_16.png"> <img src="assets/images/monsters/insect/insect_17.png" width="56" title="insect_17.png"> <img src="assets/images/monsters/insect/insect_19.png" width="56" title="insect_19.png"> <img src="assets/images/monsters/insect/insect_21.png" width="56" title="insect_21.png"> <img src="assets/images/monsters/insect/insect_22.png" width="56" title="insect_22.png">

</details>

<details open><summary><b>기갑형</b> knight · 5</summary>

<img src="assets/images/monsters/knight/knight_15.png" width="56" title="knight_15.png"> <img src="assets/images/monsters/knight/knight_18.png" width="56" title="knight_18.png"> <img src="assets/images/monsters/knight/knight_20.png" width="56" title="knight_20.png"> <img src="assets/images/monsters/knight/knight_22.png" width="56" title="knight_22.png"> <img src="assets/images/monsters/knight/knight_24.png" width="56" title="knight_24.png">

</details>

<details open><summary><b>파충류형</b> lizard · 10</summary>

<img src="assets/images/monsters/lizard/lizard_4.png" width="56" title="lizard_4.png"> <img src="assets/images/monsters/lizard/lizard_7.png" width="56" title="lizard_7.png"> <img src="assets/images/monsters/lizard/lizard_9.png" width="56" title="lizard_9.png"> <img src="assets/images/monsters/lizard/lizard_10.png" width="56" title="lizard_10.png"> <img src="assets/images/monsters/lizard/lizard_13.png" width="56" title="lizard_13.png"> <img src="assets/images/monsters/lizard/lizard_16.png" width="56" title="lizard_16.png"> <img src="assets/images/monsters/lizard/lizard_17.png" width="56" title="lizard_17.png"> <img src="assets/images/monsters/lizard/lizard_18.png" width="56" title="lizard_18.png"> <img src="assets/images/monsters/lizard/lizard_20.png" width="56" title="lizard_20.png"> <img src="assets/images/monsters/lizard/lizard_23.png" width="56" title="lizard_23.png">

</details>

<details open><summary><b>식물형</b> plant · 10</summary>

<img src="assets/images/monsters/plant/plant_3.png" width="56" title="plant_3.png"> <img src="assets/images/monsters/plant/plant_5.png" width="56" title="plant_5.png"> <img src="assets/images/monsters/plant/plant_6.png" width="56" title="plant_6.png"> <img src="assets/images/monsters/plant/plant_7.png" width="56" title="plant_7.png"> <img src="assets/images/monsters/plant/plant_8.png" width="56" title="plant_8.png"> <img src="assets/images/monsters/plant/plant_12.png" width="56" title="plant_12.png"> <img src="assets/images/monsters/plant/plant_13.png" width="56" title="plant_13.png"> <img src="assets/images/monsters/plant/plant_18.png" width="56" title="plant_18.png"> <img src="assets/images/monsters/plant/plant_19.png" width="56" title="plant_19.png"> <img src="assets/images/monsters/plant/plant_24.png" width="56" title="plant_24.png">

</details>

<details open><summary><b>점액형</b> slime · 13</summary>

<img src="assets/images/monsters/slime/slime_1.png" width="56" title="slime_1.png"> <img src="assets/images/monsters/slime/slime_2.png" width="56" title="slime_2.png"> <img src="assets/images/monsters/slime/slime_3.png" width="56" title="slime_3.png"> <img src="assets/images/monsters/slime/slime_11.png" width="56" title="slime_11.png"> <img src="assets/images/monsters/slime/slime_13.png" width="56" title="slime_13.png"> <img src="assets/images/monsters/slime/slime_16.png" width="56" title="slime_16.png"> <img src="assets/images/monsters/slime/slime_17.png" width="56" title="slime_17.png"> <img src="assets/images/monsters/slime/slime_18.png" width="56" title="slime_18.png"> <img src="assets/images/monsters/slime/slime_19.png" width="56" title="slime_19.png"> <img src="assets/images/monsters/slime/slime_21.png" width="56" title="slime_21.png"> <img src="assets/images/monsters/slime/slime_22.png" width="56" title="slime_22.png"> <img src="assets/images/monsters/slime/slime_23.png" width="56" title="slime_23.png"> <img src="assets/images/monsters/slime/slime_24.png" width="56" title="slime_24.png">

</details>

<details open><summary><b>정령형</b> spirit · 10</summary>

<img src="assets/images/monsters/spirit/spirit_2.png" width="56" title="spirit_2.png"> <img src="assets/images/monsters/spirit/spirit_8.png" width="56" title="spirit_8.png"> <img src="assets/images/monsters/spirit/spirit_9.png" width="56" title="spirit_9.png"> <img src="assets/images/monsters/spirit/spirit_11.png" width="56" title="spirit_11.png"> <img src="assets/images/monsters/spirit/spirit_12.png" width="56" title="spirit_12.png"> <img src="assets/images/monsters/spirit/spirit_14.png" width="56" title="spirit_14.png"> <img src="assets/images/monsters/spirit/spirit_16.png" width="56" title="spirit_16.png"> <img src="assets/images/monsters/spirit/spirit_17.png" width="56" title="spirit_17.png"> <img src="assets/images/monsters/spirit/spirit_21.png" width="56" title="spirit_21.png"> <img src="assets/images/monsters/spirit/spirit_24.png" width="56" title="spirit_24.png">

</details>

<details open><summary><b>망령형</b> undead · 15</summary>

<img src="assets/images/monsters/undead/undead_5.png" width="56" title="undead_5.png"> <img src="assets/images/monsters/undead/undead_7.png" width="56" title="undead_7.png"> <img src="assets/images/monsters/undead/undead_8.png" width="56" title="undead_8.png"> <img src="assets/images/monsters/undead/undead_9.png" width="56" title="undead_9.png"> <img src="assets/images/monsters/undead/undead_10.png" width="56" title="undead_10.png"> <img src="assets/images/monsters/undead/undead_12.png" width="56" title="undead_12.png"> <img src="assets/images/monsters/undead/undead_13.png" width="56" title="undead_13.png"> <img src="assets/images/monsters/undead/undead_15.png" width="56" title="undead_15.png"> <img src="assets/images/monsters/undead/undead_17.png" width="56" title="undead_17.png"> <img src="assets/images/monsters/undead/undead_18.png" width="56" title="undead_18.png"> <img src="assets/images/monsters/undead/undead_19.png" width="56" title="undead_19.png"> <img src="assets/images/monsters/undead/undead_21.png" width="56" title="undead_21.png"> <img src="assets/images/monsters/undead/undead_22.png" width="56" title="undead_22.png"> <img src="assets/images/monsters/undead/undead_23.png" width="56" title="undead_23.png"> <img src="assets/images/monsters/undead/undead_25.png" width="56" title="undead_25.png">

</details>
<!-- gallery:end -->
