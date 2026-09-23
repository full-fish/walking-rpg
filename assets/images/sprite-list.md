# 스프라이트 생성 목록

이미지 생성 AI에 하나씩 넣을 프롬프트용 목록. 파일명 = sprite id 그대로 써서 assets/images/ 밑에 저장.

## 프롬프트 쓰는 법 (나노바나나)

**실제로 뽑아서 마음에 든 방식을 기준으로 삼았습니다** — 검 1·2번이 그 문장 그대로입니다.

- **부위마다 1번은 완전한 프롬프트**, 2~10번은 `Same art style as before, now …`로 잇습니다.
  같은 대화창에서 1번부터 차례로 붙여 넣으면 그림체가 맞춰집니다.
- 대화가 길어져 그림체가 흔들리면 **그 부위의 1번부터 새 대화**로 다시 시작하세요.
  1번은 혼자서도 완결된 문장이라 새 대화에서도 됩니다.
- **배경은 마젠타(#FF00FF)** 입니다. 잘라낼 때 이 색을 지우므로, 아이템 쪽에는
  **보라·분홍을 일부러 안 썼습니다** — 같이 지워집니다. 수정·흑요석·심연을 파랑·청록으로 잡은 이유입니다.
- 한 장이 **같은 티어의 5등급 전부**에 쓰입니다(아래 "등급과 그림"). 그래서 이름보다 **재질**을 묘사합니다.

---

## 1. 장비 (60개, assets/images/items/)

슬롯 6종 × 티어 10단계. 파일명: `<sprite>.png`

> **등급과 그림.** 60장이 **장비 300종 전부**를 덮습니다. sprite id에 등급이 없어서(`sword_3`),
> 강철 검·강철 장검·강철 대검·강철 마검·강철 성검이 **같은 그림**을 씁니다. 등급은 게임 안에서
> **테두리 색**으로 구분합니다. 표의 이름은 common 기준입니다.
>
> **고유 장비 25종은 여기 없습니다.** sprite id가 따로(`uniq_<사냥터 id>`)라 60장에 안 들어갑니다.
> 지금은 그림 없이 빈 칸으로 보입니다.

### sword

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| sword_1 | sword_1.png | 낡은 검 |
| sword_2 | sword_2.png | 무쇠 검 |
| sword_3 | sword_3.png | 강철 검 |
| sword_4 | sword_4.png | 은빛 검 |
| sword_5 | sword_5.png | 흑철 검 |
| sword_6 | sword_6.png | 용린 검 |
| sword_7 | sword_7.png | 수정 검 |
| sword_8 | sword_8.png | 흑요석 검 |
| sword_9 | sword_9.png | 월광 검 |
| sword_10 | sword_10.png | 심연 검 |

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
| helm_2 | helm_2.png | 무쇠 두건 |
| helm_3 | helm_3.png | 강철 두건 |
| helm_4 | helm_4.png | 은빛 두건 |
| helm_5 | helm_5.png | 흑철 두건 |
| helm_6 | helm_6.png | 용린 두건 |
| helm_7 | helm_7.png | 수정 두건 |
| helm_8 | helm_8.png | 흑요석 두건 |
| helm_9 | helm_9.png | 월광 두건 |
| helm_10 | helm_10.png | 심연 두건 |

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
| armor_2 | armor_2.png | 무쇠 옷 |
| armor_3 | armor_3.png | 강철 옷 |
| armor_4 | armor_4.png | 은빛 옷 |
| armor_5 | armor_5.png | 흑철 옷 |
| armor_6 | armor_6.png | 용린 옷 |
| armor_7 | armor_7.png | 수정 옷 |
| armor_8 | armor_8.png | 흑요석 옷 |
| armor_9 | armor_9.png | 월광 옷 |
| armor_10 | armor_10.png | 심연 옷 |

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

### gloves

| sprite id | 파일명 | 이름(참고) |
|---|---|---|
| gloves_1 | gloves_1.png | 낡은 장갑 |
| gloves_2 | gloves_2.png | 무쇠 장갑 |
| gloves_3 | gloves_3.png | 강철 장갑 |
| gloves_4 | gloves_4.png | 은빛 장갑 |
| gloves_5 | gloves_5.png | 흑철 장갑 |
| gloves_6 | gloves_6.png | 용린 장갑 |
| gloves_7 | gloves_7.png | 수정 장갑 |
| gloves_8 | gloves_8.png | 흑요석 장갑 |
| gloves_9 | gloves_9.png | 월광 장갑 |
| gloves_10 | gloves_10.png | 심연 장갑 |

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
| boots_2 | boots_2.png | 무쇠 신 |
| boots_3 | boots_3.png | 강철 신 |
| boots_4 | boots_4.png | 은빛 신 |
| boots_5 | boots_5.png | 흑철 신 |
| boots_6 | boots_6.png | 용린 신 |
| boots_7 | boots_7.png | 수정 신 |
| boots_8 | boots_8.png | 흑요석 신 |
| boots_9 | boots_9.png | 월광 신 |
| boots_10 | boots_10.png | 심연 신 |

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
| accessory_2 | accessory_2.png | 무쇠 부적 |
| accessory_3 | accessory_3.png | 강철 부적 |
| accessory_4 | accessory_4.png | 은빛 부적 |
| accessory_5 | accessory_5.png | 흑철 부적 |
| accessory_6 | accessory_6.png | 용린 부적 |
| accessory_7 | accessory_7.png | 수정 부적 |
| accessory_8 | accessory_8.png | 흑요석 부적 |
| accessory_9 | accessory_9.png | 월광 부적 |
| accessory_10 | accessory_10.png | 심연 부적 |

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

## 2. 몬스터 — 1차: 아키타입 12개만 (assets/images/monsters/)

처음엔 이것만 만들면 됨. 같은 종족 몬스터는 티어 구분 없이 이 이미지 하나를 공유.

| arch | 파일명 | 대표 몬스터(참고) |
|---|---|---|
| arch_bandit | bandit.png | 떠돌이 도적 등 6종 |
| arch_beast | beast.png | 들개 등 7종 |
| arch_bird | bird.png | 들까마귀 등 6종 |
| arch_fungus | fungus.png | 홀씨 버섯 등 6종 |
| arch_golem | golem.png | 돌무더기 등 9종 |
| arch_insect | insect.png | 왕개미 등 7종 |
| arch_knight | knight.png | 녹슨 갑주병 등 5종 |
| arch_lizard | lizard.png | 새끼 도마뱀 등 7종 |
| arch_plant | plant.png | 가시덩굴 등 6종 |
| arch_slime | slime.png | 초록 슬라임 등 6종 |
| arch_spirit | spirit.png | 불씨 정령 등 6종 |
| arch_undead | undead.png | 떠도는 해골 등 6종 |

---

## 3. 몬스터 — 2차 확장: 티어별 세부 이미지 (총 77개, 나중에)

1차로 부족하면 여기서 추가. 파일명: `<sprite>.png`

### bandit

| sprite id | 파일명 | 이름 |
|---|---|---|
| bandit_5 | bandit_5.png | 떠돌이 도적 |
| bandit_8 | bandit_8.png | 산적 두목 |
| bandit_12 | bandit_12.png | 사막 약탈자 |
| bandit_16 | bandit_16.png | 검은 손 자객 |
| bandit_20 | bandit_20.png | 혈맹 검객 |
| bandit_25 | bandit_25.png | 배신자 장군 |

### beast

| sprite id | 파일명 | 이름 |
|---|---|---|
| beast_1 | beast_1.png | 들개 |
| beast_2 | beast_2.png | 잿빛 늑대 |
| beast_4 | beast_4.png | 굶주린 살쾡이 |
| beast_6 | beast_6.png | 동굴 박쥐 |
| beast_8 | beast_8.png | 검은 멧돼지 |
| beast_15 | beast_15.png | 설원 이리 |
| beast_16 | beast_16.png | 화산 비룡 |

### bird

| sprite id | 파일명 | 이름 |
|---|---|---|
| bird_3 | bird_3.png | 들까마귀 |
| bird_6 | bird_6.png | 매부리 |
| bird_10 | bird_10.png | 절벽 독수리 |
| bird_14 | bird_14.png | 폭풍 까마귀 |
| bird_18 | bird_18.png | 잿빛 하피 |
| bird_22 | bird_22.png | 뇌명조 |

### fungus

| sprite id | 파일명 | 이름 |
|---|---|---|
| fungus_1 | fungus_1.png | 홀씨 버섯 |
| fungus_4 | fungus_4.png | 독포자 버섯 |
| fungus_7 | fungus_7.png | 부패한 균사체 |
| fungus_12 | fungus_12.png | 유황 버섯 |
| fungus_17 | fungus_17.png | 발광 포자군 |
| fungus_23 | fungus_23.png | 심연 균사왕 |

### golem

| sprite id | 파일명 | 이름 |
|---|---|---|
| golem_3 | golem_3.png | 돌무더기 |
| golem_5 | golem_5.png | 이끼 덮인 수호석 |
| golem_9 | golem_9.png | 강철 조각상 |
| golem_11 | golem_11.png | 모래 골렘 |
| golem_14 | golem_14.png | 이끼 낀 석상 |
| golem_15 | golem_15.png | 협곡을 지키는 거상 |
| golem_19 | golem_19.png | 무쇠 수호자 |
| golem_22 | golem_22.png | 서리 거상 |
| golem_25 | golem_25.png | 심연의 지배자 |

### insect

| sprite id | 파일명 | 이름 |
|---|---|---|
| insect_2 | insect_2.png | 왕개미 |
| insect_4 | insect_4.png | 독거미 |
| insect_6 | insect_6.png | 날개미 떼 |
| insect_9 | insect_9.png | 뿔풍뎅이 |
| insect_12 | insect_12.png | 모래 전갈 |
| insect_16 | insect_16.png | 검은 말벌 |
| insect_21 | insect_21.png | 심연 지네 |

### knight

| sprite id | 파일명 | 이름 |
|---|---|---|
| knight_15 | knight_15.png | 녹슨 갑주병 |
| knight_18 | knight_18.png | 흑철 기사 |
| knight_20 | knight_20.png | 대장간의 마지막 기사 |
| knight_22 | knight_22.png | 심판의 기사 |
| knight_24 | knight_24.png | 폐왕의 근위대 |

### lizard

| sprite id | 파일명 | 이름 |
|---|---|---|
| lizard_4 | lizard_4.png | 새끼 도마뱀 |
| lizard_7 | lizard_7.png | 도마뱀 전사 |
| lizard_10 | lizard_10.png | 늪을 삼킨 악어 |
| lizard_13 | lizard_13.png | 협곡 이구아나 |
| lizard_17 | lizard_17.png | 비늘 사냥꾼 |
| lizard_20 | lizard_20.png | 용린 전사 |
| lizard_23 | lizard_23.png | 고룡의 후예 |

### plant

| sprite id | 파일명 | 이름 |
|---|---|---|
| plant_3 | plant_3.png | 가시덩굴 |
| plant_5 | plant_5.png | 식인초 |
| plant_8 | plant_8.png | 뒤틀린 고목 |
| plant_13 | plant_13.png | 사막 선인장 |
| plant_19 | plant_19.png | 무쇠 덩굴 |
| plant_24 | plant_24.png | 세계수의 가지 |

### slime

| sprite id | 파일명 | 이름 |
|---|---|---|
| slime_1 | slime_1.png | 초록 슬라임 |
| slime_2 | slime_2.png | 끈적이 |
| slime_3 | slime_3.png | 늪 젤리 |
| slime_11 | slime_11.png | 모래 점액 |
| slime_13 | slime_13.png | 석영 슬라임 |
| slime_21 | slime_21.png | 심연 젤리 |

### spirit

| sprite id | 파일명 | 이름 |
|---|---|---|
| spirit_9 | spirit_9.png | 불씨 정령 |
| spirit_11 | spirit_11.png | 모래 소용돌이 |
| spirit_14 | spirit_14.png | 물안개 정령 |
| spirit_17 | spirit_17.png | 번개 정령 |
| spirit_21 | spirit_21.png | 흑염 정령 |
| spirit_24 | spirit_24.png | 태초의 불꽃 |

### undead

| sprite id | 파일명 | 이름 |
|---|---|---|
| undead_5 | undead_5.png | 떠도는 해골 |
| undead_7 | undead_7.png | 무덤지기 |
| undead_10 | undead_10.png | 창백한 망령 |
| undead_15 | undead_15.png | 원한의 유령 |
| undead_18 | undead_18.png | 흑요석 리치 |
| undead_25 | undead_25.png | 폐허의 군주 |

