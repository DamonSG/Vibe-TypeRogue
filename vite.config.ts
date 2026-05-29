import { defineConfig } from "vite";

const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];
const pagesBase = repoName ? `/${repoName}/` : "/";

export default defineConfig({
  // Use the repository subpath when building on GitHub Actions for Pages.
  base: process.env.GITHUB_ACTIONS ? pagesBase : "/",
  build: {
    target: "es2022",
    outDir: "dist",
    assetsInlineLimit: 0,
  },
  server: {
    port: 5173,
    open: false,
  },
});
