import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

export default defineConfig(({ mode }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1];

  return {
    // Lovable and normal Vite previews should use root-relative assets.
    // GitHub Pages workflows already provide GITHUB_REPOSITORY, so use it
    // to restore the project-site base path without requiring a separate flag.
    base: repoName ? `/${repoName}/` : "/",

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
