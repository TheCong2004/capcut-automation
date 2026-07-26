import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import fs from "fs";
import { resolve } from "node:path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

const SPARK_MODULE_SUBPATH = "/@sparkjsdev/spark/dist/spark.module.js";
const SPARK_WASM_PATTERN =
  /module_or_path = new URL\("(data:application\/wasm;base64,[^"]+)", import\.meta\.url\);/;

const sparkWasmDataUrlFix = (): Plugin => ({
  name: "spark-wasm-data-url-fix",
  enforce: "pre",
  apply: "serve",
  transform(code, id) {
    if (!id.includes(SPARK_MODULE_SUBPATH)) {
      return null;
    }

    const match = code.match(SPARK_WASM_PATTERN);
    if (!match) {
      return null;
    }

    const [, dataUrl] = match;
    const patched = code.replace(
      SPARK_WASM_PATTERN,
      `module_or_path = "${dataUrl}";`,
    );

    return {
      code: patched,
      map: null,
    };
  },
});

const projectRoot = __dirname;
const appRoot = path.resolve(projectRoot, "app");
const workspaceRoot = path.resolve(projectRoot, "..", "..");

function tryResolveCandidate(baseDir: string, subPath: string): string | null {
  const target = path.resolve(baseDir, subPath);
  const candidates = [
    target,
    target + ".ts",
    target + ".tsx",
    target + ".js",
    target + ".jsx",
    path.join(target, "index.ts"),
    path.join(target, "index.tsx"),
    path.join(target, "index.js"),
    path.join(target, "index.jsx"),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

// Custom resolver plugin to handle multi-target `@/` alias for PageYouwee & app/src (Cross-Platform)
const multiTargetAliasResolver = (): Plugin => ({
  name: "multi-target-alias-resolver",
  enforce: "pre",
  resolveId(source, importer) {
    if (source.startsWith("@/") && importer) {
      const subPath = source.slice(2);
      const normImporter = importer.replace(/\\/g, "/");

      // 1. If imported within PageYouwee, try resolving inside PageYouwee first
      if (normImporter.includes("PageYouwee")) {
        const youweeResolved = tryResolveCandidate(path.resolve(projectRoot, "app/src/pages/PageYouwee"), subPath);
        if (youweeResolved) return youweeResolved;
      }

      // 2. Default fallback to app/src
      const defaultResolved = tryResolveCandidate(path.resolve(projectRoot, "app/src"), subPath);
      if (defaultResolved) return defaultResolved;
    }
    return null;
  },
});

export default defineConfig({
  root: appRoot,
  optimizeDeps: {
    exclude: ["@sparkjsdev/spark"],
  },
  build: {
    outDir: path.resolve(projectRoot, "dist"),
    rollupOptions: {
      input: {
        index: resolve(projectRoot, "app/index.html"),
      },
    },
  },
  plugins: [multiTargetAliasResolver(), sparkWasmDataUrlFix(), tsconfigPaths(), wasm(), topLevelAwait()],
  server: {
    watch: {
      ignored: ["**/pages/freellmapi/server/**"],
    },
    fs: {
      allow: [workspaceRoot],
    },
  },
  resolve: {
    alias: {
      "~": path.resolve(projectRoot, "app/src"),
      "@mediacrawler": path.resolve(
        projectRoot,
        "app/src/pages/PageMediaCrawler/src",
      ),
      "@freellmapi": path.resolve(
        projectRoot,
        "app/src/pages/freellmapi/client/src",
      ),
    },
    dedupe: [
      "react",
      "react-dom",
      "@preact/signals-core",
      "@preact/signals-react"
    ],
  },
});
