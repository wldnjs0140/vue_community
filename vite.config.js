import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  base: "/timer-stopwatch-app/", // GitHub 레포지토리 이름으로 변경
});
