// Detect changes to the operational pages referenced by Academy walkthroughs.
import { appendFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { posix } from "node:path";
import ts from "typescript";

const base = process.env.ACADEMY_BASE_SHA || "";
const head = process.env.ACADEMY_HEAD_SHA || "HEAD";
const curriculumFiles = [
  "src/data/academyCoreTracks.ts",
  "src/data/academyWorkspaceTracks.ts",
];

const git = (...args) => execFileSync("git", args, { encoding: "utf8" });
const readRevision = (revision, file) => git("show", `${revision}:${file}`);
const fileList = (output) => output.trim().split("\n").filter(Boolean);

function resolveImport(specifier, files) {
  const stem = specifier.startsWith("./")
    ? posix.normalize(`src/${specifier}`)
    : specifier.startsWith("@/") ? `src/${specifier.slice(2)}` : "";
  if (!stem) return undefined;
  return [stem, `${stem}.tsx`, `${stem}.ts`, `${stem}/index.tsx`, `${stem}/index.ts`]
    .find((candidate) => files.has(candidate));
}

function routesAt(revision) {
  const files = new Set(fileList(git("ls-tree", "-r", "--name-only", revision, "src")));
  const app = ts.createSourceFile(
    "src/App.tsx", readRevision(revision, "src/App.tsx"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  );
  const imports = new Map();
  for (const statement of app.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const file = resolveImport(statement.moduleSpecifier.text, files);
    if (!file || !statement.importClause) continue;
    const { name, namedBindings } = statement.importClause;
    if (name) imports.set(name.text, file);
    if (namedBindings && ts.isNamedImports(namedBindings)) {
      for (const { name: binding } of namedBindings.elements) imports.set(binding.text, file);
    }
  }

  const routes = new Map();
  function visit(node) {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))
        && ts.isIdentifier(node.tagName) && node.tagName.text === "Route") {
      const attribute = (name) => node.attributes.properties.find(
        (prop) => ts.isJsxAttribute(prop) && prop.name.getText(app) === name,
      )?.initializer;
      const path = attribute("path");
      const element = attribute("element");
      if (path && ts.isStringLiteral(path) && element && ts.isJsxExpression(element)) {
        const routeFiles = routes.get(path.text) ?? new Set();
        function visitElement(child) {
          if ((ts.isJsxOpeningElement(child) || ts.isJsxSelfClosingElement(child))
              && ts.isIdentifier(child.tagName)) {
            const file = imports.get(child.tagName.text);
            if (file) routeFiles.add(file);
          }
          ts.forEachChild(child, visitElement);
        }
        if (element.expression) visitElement(element.expression);
        routes.set(path.text, routeFiles);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(app);
  return routes;
}

function taughtPathsAt(revision) {
  return curriculumFiles.flatMap((file) =>
    [...readRevision(revision, file).matchAll(/\bpath:\s*"([^"]+)"/g)].map((match) => match[1]),
  );
}

const changed = base ? new Set(fileList(git("diff", "--name-only", "--no-renames", base, head))) : new Set();
const touchedCurriculum = curriculumFiles.some((file) => changed.has(file));
const affected = [];

if (changed.size) {
  const headRoutes = routesAt(head);
  const baseRoutes = changed.has("src/App.tsx") ? routesAt(base) : headRoutes;
  const taughtPaths = new Set(taughtPathsAt(head));
  if (touchedCurriculum) {
    for (const path of taughtPathsAt(base)) taughtPaths.add(path);
  }
  for (const path of [...taughtPaths].sort()) {
    const previous = baseRoutes.get(path) ?? new Set();
    const current = headRoutes.get(path) ?? new Set();
    const routeEntryChanged = previous.size !== current.size || [...previous].some((file) => !current.has(file));
    for (const file of new Set([...previous, ...current])) {
      if (changed.has(file) || routeEntryChanged) affected.push({ path, file, routeEntryChanged });
    }
  }
}

const report = {
  base: base || "not supplied",
  head,
  changedFiles: changed.size,
  taughtRouteChanges: affected,
  curriculumEditedInSameChange: touchedCurriculum,
  humanCurriculumReviewRequired: affected.length > 0 && !touchedCurriculum,
  explanation: "This automated check identifies changed route mappings and direct page files. Staff acceptance is verified separately.",
};
writeFileSync("academy-impact-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  const lines = ["## Academy operational change impact", ""];
  if (affected.length) {
    lines.push("These operational routes or page files changed and are referenced in Workspace Training.");
    for (const { path, file, routeEntryChanged } of affected) {
      lines.push(`- \`${path}\` (\`${file}\`)${routeEntryChanged ? " — route mapping changed" : ""}`);
    }
    lines.push("");
    lines.push(touchedCurriculum
      ? "Academy curriculum also changed. Review instructional accuracy before release."
      : "**Curriculum review required.** Review the affected walkthroughs against the changed pages.");
  } else {
    lines.push("No directly taught operational page changes were detected.");
  }
  lines.push("", report.explanation);
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join("\n") + "\n");
}
