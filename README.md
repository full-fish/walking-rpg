# StepQuest

걸음으로 노는 방치형 RPG. 계획: [implementation_plan.v2.md](implementation_plan.v2.md)

## 개발

```bash
npm install
npm start          # Metro (dev build 설치된 기기에서 접속)
npm run typecheck
npm run lint
npm run format
```

## 실기기 dev build (Android)

```bash
npm i -g eas-cli
eas login
eas build --profile development --platform android   # 빌드 완료 후 나오는 QR/링크로 APK 설치
npm start                                             # 설치된 앱에서 Metro 접속
```

Health Connect 등 네이티브 모듈을 쓰므로 Expo Go로는 돌아가지 않습니다.
