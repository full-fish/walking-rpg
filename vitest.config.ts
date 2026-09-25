import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const root = (dir: string) => fileURLToPath(new URL(dir, import.meta.url));

// tsconfig의 paths를 vitest에도 알려 준다 — 도구(balance)가 화면 쪽 이름표(src/ui/rings)를 같이 쓴다
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/assets\//, replacement: root('./assets/') },
      { find: /^@\//, replacement: root('./src/') },
    ],
  },
});
