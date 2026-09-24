// app.json 위에 빌드 프로필별 차이만 얹는다. APP_VARIANT 는 eas.json 의 env 에서 온다.
const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? `${config.name} (dev)` : config.name,
  android: {
    ...config.android,
    package: IS_DEV ? `${config.android.package}.dev` : config.android.package,
  },
});
