import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const isGitHubPagesBuild = process.env.DEPLOY_TARGET === "github-pages";
  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];

  return {
    // Lovable and normal Vite previews should use root-relative assets.
    // GitHub Pages can opt into the repository subpath by setting
    // DEPLOY_TARGET=github-pages in that workflow.
    base: isGitHubPagesBuild && repoName ? `/${repoName}/` : "/",

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
