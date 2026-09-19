# 내가 직접 해야 하는 일

에이전트가 못 하는 것만 모아둡니다. 코드 작업이 끝나면 여기부터 보세요.
(끝낸 항목은 `[x]`로 바꾸세요.)

---

## 지금 대기 중 — T3까지 끝난 뒤 한 번에

### 1. EAS dev build로 실기기 설치 (T1 완료 조건)

T3에서 MMKV(네이티브 모듈)가 들어가므로 **T3까지 끝난 뒤 빌드하면 한 번으로 충분합니다.**

```bash
npm i -g eas-cli
eas login                                            # Expo 계정 (없으면 expo.dev에서 가입)
eas init                                             # 프로젝트 생성 + app.json에 projectId 기록
eas build --profile development --platform android   # 15~25분, 완료되면 QR/링크
# 링크로 APK 설치 → 폰에서 앱 실행
npm start                                            # PC에서 Metro 실행, 앱이 여기에 붙음
```

- Expo Go로는 안 됩니다 (네이티브 모듈 사용).
- 무료 플랜은 빌드 대기열이 있어 길면 30분 넘게 걸립니다.

### 2. 설치 후 눈으로 확인할 것

- [ ] **T1** — 앱이 켜진다
- [ ] **T2** — 하단 탭 4개(모험/캐릭터/상점/설정)가 전환되고, 글씨가 도트 폰트(Galmuri)로 보인다
- [ ] **T3** — 값을 바꾸고 앱을 완전히 종료 후 다시 켰을 때 값이 남아 있다

---

## 확인/결정 필요

- [ ] **패키지명** `com.choimanseon.wakingRPG` — 스토어 출시 후에는 **영구히 변경 불가**입니다.
      리포지토리 이름은 `walking_rpg`인데 패키지는 `wakingRPG`(l 없음)입니다. 의도한 게 맞는지 확인하세요.
      바꾸려면 [app.json](app.json)의 `android.package` 한 줄. 빌드 전에 바꿔야 합니다.

---

## 앞으로 또 빌드가 필요해지는 시점

네이티브 모듈이 추가되면 dev build를 **다시** 받아야 합니다. 그 외 JS 변경은 `npm start`만으로 반영됩니다.

| 시점 | 추가되는 네이티브 모듈 |
| ---- | ---------------------- |
| T3   | react-native-mmkv      |
| T4   | react-native-health-connect (+ 폰에 Health Connect 앱 설치 필요) |
| S6   | RevenueCat, AdMob, Firebase |

## 나중에 (출시 전, S6)

- [ ] 개인정보처리방침 URL — 건강 데이터를 읽으므로 **필수**
- [ ] Google Play 개발자 계정 ($25 1회)
- [ ] AdMob / RevenueCat 계정과 키 발급
