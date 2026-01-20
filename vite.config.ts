import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isGitHubPages = process.env.GITHUB_PAGES === "true";

  return {
    // For GitHub Pages, we want /hpg-workspace/
    // For Lovable + localhost, we want root "/"
    base: isGitHubPages ? "/hpg-workspace/" : "/",

    server: {
      host: "::",
      port: 8080,
    },
    plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
  };
});
