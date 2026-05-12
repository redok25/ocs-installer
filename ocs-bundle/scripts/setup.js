const fs = require("fs");
const path = require("path");
const readline = require("readline");
const os = require("os");
const { execSync, execFileSync } = require("child_process");
const { pathToFileURL } = require("url");
const { createProgressMessenger, runWithProgress } = require("./progress-messenger.cjs");

const configsDir = path.join(__dirname, "../configs");
const packageJsonPath = path.join(__dirname, "../package.json");
const sourceOpencodeJson = path.join(__dirname, "../opencode.json");
const sourceAntigravityJson = path.join(__dirname, "../antigravity.json");
const sourceAntigravityTemplate = path.join(
  __dirname,
  "../backups/antigravity.json.template",
);
const profileCatalogPath = path.join(
  __dirname,
  "constants",
  "profile-catalog.json",
);
const setupRuntimeConfigPath = path.join(
  __dirname,
  "constants",
  "setup-runtime.json",
);
const setupFallbacksPath = path.join(
  __dirname,
  "constants",
  "setup-fallbacks.json",
);

function resolveInstallerPathContract(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    fallbackHome = os.homedir(),
  } = options;
  const pathApi = (() => {
    const styleHint = [
      env.OPENCODE_CONFIG_DIR,
      env.XDG_CONFIG_HOME,
      env.HOME,
      env.USERPROFILE,
      fallbackHome,
    ].find((candidate) => typeof candidate === "string" && candidate.trim().length > 0);
    if (styleHint) {
      if (/^[A-Za-z]:[\\/]/.test(styleHint) || styleHint.includes("\\")) {
        return path.win32;
      }
      if (styleHint.startsWith("/")) {
        return path.posix;
      }
    }
    return platform === "win32" ? path.win32 : path.posix;
  })();
  const explicitTargetConfigDir = env.OPENCODE_CONFIG_DIR;
  const homeDir =
    env.HOME ||
    env.USERPROFILE ||
    (platform === "win32" && env.HOMEDRIVE && env.HOMEPATH
      ? `${env.HOMEDRIVE}${env.HOMEPATH}`
      : fallbackHome) ||
    fallbackHome;
  const configHome =
    explicitTargetConfigDir
      ? pathApi.dirname(explicitTargetConfigDir)
      : env.XDG_CONFIG_HOME || pathApi.join(homeDir, ".config");
  const shellConfigHome = env.XDG_CONFIG_HOME || pathApi.join(homeDir, ".config");
  const targetConfigDir = explicitTargetConfigDir || pathApi.join(configHome, "opencode");
  const targetPluginsDir = pathApi.join(targetConfigDir, "plugins");
  const targetSkillsDir = pathApi.join(targetConfigDir, "skills");
  const shellSnippetDir = pathApi.join(shellConfigHome, "opencode", "shell");
  const targetCocoIndexDir = pathApi.join(targetConfigDir, "cocoindex");
  const nativeBinDir = pathApi.join(homeDir, ".opencode", "bin");
  const localBinDir = pathApi.join(homeDir, ".local", "bin");
  const bunBinDir = pathApi.join(homeDir, ".bun", "bin");
  const rtkExecutablePaths =
    platform === "win32"
      ? [pathApi.join(nativeBinDir, "rtk.exe")]
      : [pathApi.join(nativeBinDir, "rtk"), pathApi.join(localBinDir, "rtk")];

  return {
    homeDir,
    configHome,
    targetConfigDir,
    targetOhMyOpencodePath: pathApi.join(targetConfigDir, "oh-my-opencode.json"),
    targetOhMyOpenagentPath: pathApi.join(targetConfigDir, "oh-my-openagent.json"),
    targetOpencodeJsonPath: pathApi.join(targetConfigDir, "opencode.json"),
    targetAntigravityJsonPath: pathApi.join(targetConfigDir, "antigravity.json"),
    dcpConfigPath: pathApi.join(targetConfigDir, "dcp.jsonc"),
    policyFilePath: pathApi.join(targetConfigDir, "ocs-compression.json"),
    projectionFilePath: pathApi.join(targetConfigDir, "compression-routing.json"),
    targetSkillsDir,
    targetManagedSkillsManifestPath: pathApi.join(targetSkillsDir, ".ocs-managed-skills.json"),
    targetExtensionsDir: pathApi.join(targetConfigDir, "extensions"),
    targetPluginsDir,
    multiAuthPluginDir: pathApi.join(targetPluginsDir, "opencode-multi-auth"),
    shellSnippetDir,
    shellSnippetPath: pathApi.join(shellSnippetDir, "ocs-path.sh"),
    ocsCliCjsPath: pathApi.join(targetConfigDir, "bin", "ocs.cjs"),
    ocsCliJsPath: pathApi.join(targetConfigDir, "bin", "ocs.js"),
    pluginOcsCliCjsPath: pathApi.join(
      targetPluginsDir,
      "opencode-multi-auth",
      "bin",
      "ocs.cjs",
    ),
    pluginOcsCliJsPath: pathApi.join(
      targetPluginsDir,
      "opencode-multi-auth",
      "bin",
      "ocs.js",
    ),
    targetCocoIndexDir,
    targetCocoIndexEnvPath: pathApi.join(targetCocoIndexDir, ".env"),
    targetCocoIndexComposePath: pathApi.join(targetCocoIndexDir, "postgres.compose.yml"),
    targetCocoIndexRetentionManifestPath: pathApi.join(
      targetCocoIndexDir,
      "retention-state.json",
    ),
    localCocoIndexDataDir: pathApi.join(homeDir, ".cocoindex_code"),
    nativeBinDir,
    localBinDir,
    bunBinDir,
    rtkExecutablePath: rtkExecutablePaths[0],
    rtkExecutablePaths,
    rtkPluginPath: pathApi.join(targetPluginsDir, "rtk.ts"),
    cavemanSkillDir: pathApi.join(targetSkillsDir, "caveman"),
    cavemanSkillPath: pathApi.join(targetSkillsDir, "caveman", "SKILL.md"),
  };
}

const DEFAULT_INSTALLER_PATHS = resolveInstallerPathContract({
  env: {
    OPENCODE_CONFIG_DIR: process.env.OPENCODE_CONFIG_DIR,
    XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME,
  },
  fallbackHome: os.homedir(),
});
const targetDir = DEFAULT_INSTALLER_PATHS.targetConfigDir;
const targetOhMyOpencode = DEFAULT_INSTALLER_PATHS.targetOhMyOpencodePath;
const targetOhMyOpenagent = DEFAULT_INSTALLER_PATHS.targetOhMyOpenagentPath;
const targetOpencodeJson = DEFAULT_INSTALLER_PATHS.targetOpencodeJsonPath;
const targetAntigravityJson = DEFAULT_INSTALLER_PATHS.targetAntigravityJsonPath;
const targetDcpConfigJsonc = DEFAULT_INSTALLER_PATHS.dcpConfigPath;
const targetCompressionPolicyJson = DEFAULT_INSTALLER_PATHS.policyFilePath;
const targetCompressionProjectionJson = DEFAULT_INSTALLER_PATHS.projectionFilePath;
const targetSkillsDir = DEFAULT_INSTALLER_PATHS.targetSkillsDir;
const targetExtensionsDir = DEFAULT_INSTALLER_PATHS.targetExtensionsDir;
const targetCocoIndexDir = DEFAULT_INSTALLER_PATHS.targetCocoIndexDir;
const targetCocoIndexEnvPath = DEFAULT_INSTALLER_PATHS.targetCocoIndexEnvPath;
const targetCocoIndexComposePath = DEFAULT_INSTALLER_PATHS.targetCocoIndexComposePath;
const targetCocoIndexRetentionManifestPath =
  DEFAULT_INSTALLER_PATHS.targetCocoIndexRetentionManifestPath;
const localCocoIndexDataDir = DEFAULT_INSTALLER_PATHS.localCocoIndexDataDir;
const COCOINDEX_CODE_MCP_NAME = "cocoindex-code";
const COCOINDEX_CODE_PACKAGE_NAME = "cocoindex-code";
const COCOINDEX_CODE_INSTALL_SPEC = "cocoindex-code[full]";
const COCOINDEX_CODE_COMMAND = "ccc";
const COCOINDEX_MIN_PYTHON_MAJOR = 3;
const COCOINDEX_MIN_PYTHON_MINOR = 11;
const COCOINDEX_CODE_OFFICIAL_SOURCE_URL =
  "git+https://github.com/cocoindex-io/cocoindex-code.git";
const targetManagedSkillsManifestPath =
  DEFAULT_INSTALLER_PATHS.targetManagedSkillsManifestPath;
const sourceProjectSkillsDir = path.join(__dirname, "../.opencode", "skills");
const SKILL_NAME_PATTERN = /^[a-z0-9-]+$/;
const INSTALLER_SETUP_MODE = process.env.OCS_SETUP_INSTALLER_MODE === "1";
const DEFAULT_COCOINDEX_DATABASE_URL =
  "postgresql://postgres:postgres@127.0.0.1:5432/cocoindex";
const DEFAULT_COCOINDEX_APP_NAMESPACE = "opencode";
const DEFAULT_COCOINDEX_DATABASE_SCHEMA = "public";

function isInstallerSetupMode() {
  return INSTALLER_SETUP_MODE;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadJsonFile(filePath) {
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

function readBundledVersion(assetRoot, options = {}) {
  const {
    fsApi = fs,
    pathApi = path,
    fallbackVersion = "unknown",
  } = options;

  try {
    const provenancePath = pathApi.join(assetRoot, "BUILD_PROVENANCE.json");
    if (fsApi.existsSync(provenancePath)) {
      const provenance = JSON.parse(fsApi.readFileSync(provenancePath, "utf8"));
      const version = String(provenance?.version || "").trim();
      if (version) {
        return version;
      }
    }
  } catch {
    // Fall back to package.json.
  }

  try {
    const packageJsonPath = pathApi.join(assetRoot, "package.json");
    const parsed = JSON.parse(fsApi.readFileSync(packageJsonPath, "utf8"));
    const version = String(parsed?.version || "").trim();
    return version || fallbackVersion;
  } catch {
    return fallbackVersion;
  }
}


function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function mergeObjectWithExistingPriority(existingValue, baselineValue) {
  if (!isPlainObject(baselineValue)) {
    return existingValue === undefined ? baselineValue : existingValue;
  }

  const merged = { ...baselineValue };

  if (!isPlainObject(existingValue)) {
    return merged;
  }

  for (const [key, value] of Object.entries(existingValue)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeObjectWithExistingPriority(value, merged[key]);
      continue;
    }
    merged[key] = value;
  }

  return merged;
}

function loadJsonObjectOrNull(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    const parsed = loadJsonFile(filePath);
    return isPlainObject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}


const SETUP_FALLBACKS = loadJsonFile(setupFallbacksPath);

function loadProfileCatalog() {
  try {
    const parsed = loadJsonFile(profileCatalogPath);
    return {
      profileDisplayOrder: Array.isArray(parsed.profileDisplayOrder)
        ? parsed.profileDisplayOrder
        : clone(SETUP_FALLBACKS.profileCatalog.profileDisplayOrder),
      legacyProfileAliasMap:
        parsed.legacyProfileAliasMap &&
        typeof parsed.legacyProfileAliasMap === "object"
          ? parsed.legacyProfileAliasMap
          : clone(SETUP_FALLBACKS.profileCatalog.legacyProfileAliasMap),
      profileScopeHints:
        parsed.profileScopeHints && typeof parsed.profileScopeHints === "object"
          ? parsed.profileScopeHints
          : clone(SETUP_FALLBACKS.profileCatalog.profileScopeHints),
      profileDescriptionOverrides:
        parsed.profileDescriptionOverrides &&
        typeof parsed.profileDescriptionOverrides === "object"
          ? parsed.profileDescriptionOverrides
          : clone(SETUP_FALLBACKS.profileCatalog.profileDescriptionOverrides || {}),
      modelLabelReplacements: Array.isArray(parsed.modelLabelReplacements)
        ? parsed.modelLabelReplacements
        : clone(SETUP_FALLBACKS.profileCatalog.modelLabelReplacements),
    };
  } catch {
    return clone(SETUP_FALLBACKS.profileCatalog);
  }
}

const profileCatalog = loadProfileCatalog();
const PROFILE_DISPLAY_ORDER = profileCatalog.profileDisplayOrder;
const LEGACY_PROFILE_ALIAS_MAP = profileCatalog.legacyProfileAliasMap;
const PROFILE_SCOPE_HINTS = profileCatalog.profileScopeHints;
const PROFILE_DESCRIPTION_OVERRIDES =
  profileCatalog.profileDescriptionOverrides || {};
const MODEL_LABEL_REPLACEMENTS = profileCatalog.modelLabelReplacements;

const DEFAULT_SETUP_RUNTIME_CONFIG = clone(SETUP_FALLBACKS.setupRuntime);

function loadPackageVersion() {
  return readBundledVersion(path.join(__dirname, ".."), {
    fallbackVersion: "unknown",
  });
}

function loadSetupRuntimeConfig() {
  try {
    const parsed = loadJsonFile(setupRuntimeConfigPath);
    const fallbackModes = DEFAULT_SETUP_RUNTIME_CONFIG.resourceModes;
    const fallbackCompression = DEFAULT_SETUP_RUNTIME_CONFIG.compression;
    const parsedModes =
      parsed.resourceModes && typeof parsed.resourceModes === "object"
        ? parsed.resourceModes
        : {};

    const mergedResourceModes = {
      default: parsedModes.default || fallbackModes.default,
      options:
        Array.isArray(parsedModes.options) && parsedModes.options.length > 0
          ? parsedModes.options
          : fallbackModes.options,
      policies:
        parsedModes.policies && typeof parsedModes.policies === "object"
          ? {
              ...fallbackModes.policies,
              ...parsedModes.policies,
            }
          : fallbackModes.policies,
    };

    return {
      setupTitle: parsed.setupTitle || DEFAULT_SETUP_RUNTIME_CONFIG.setupTitle,
      runtimeLabel:
        parsed.runtimeLabel || DEFAULT_SETUP_RUNTIME_CONFIG.runtimeLabel,
      release:
        parsed.release && typeof parsed.release === "object"
          ? {
              githubRepo:
                parsed.release.githubRepo ||
                DEFAULT_SETUP_RUNTIME_CONFIG.release.githubRepo,
              updateCommand:
                parsed.release.updateCommand ||
                DEFAULT_SETUP_RUNTIME_CONFIG.release.updateCommand,
            }
          : DEFAULT_SETUP_RUNTIME_CONFIG.release,
      resourceModes: mergedResourceModes,
      compression:
        parsed.compression && typeof parsed.compression === "object"
          ? mergeObjectWithExistingPriority(
              parsed.compression,
              fallbackCompression,
            )
          : fallbackCompression,
    };
  } catch {
    return clone(DEFAULT_SETUP_RUNTIME_CONFIG);
  }
}

const SETUP_RUNTIME_CONFIG = loadSetupRuntimeConfig();
const CURRENT_SETUP_VERSION = loadPackageVersion();
const RESOURCE_MODE_CONFIG =
  SETUP_RUNTIME_CONFIG.resourceModes || DEFAULT_SETUP_RUNTIME_CONFIG.resourceModes;
const RESOURCE_MODE_OPTIONS = Array.isArray(RESOURCE_MODE_CONFIG.options)
  ? RESOURCE_MODE_CONFIG.options
  : [];
const RESOURCE_MODE_POLICIES =
  RESOURCE_MODE_CONFIG.policies && typeof RESOURCE_MODE_CONFIG.policies === "object"
    ? RESOURCE_MODE_CONFIG.policies
    : {};
const DEFAULT_RESOURCE_MODE = RESOURCE_MODE_CONFIG.default || "balanced";
const OAUTH_COMPATIBLE_PLUGIN_NAMES = [
  "oh-my-openagent",
  "oh-my-opencode",
  "@tarquinen/opencode-dcp",
  "cc-safety-net",
  "@ramtinj95/opencode-tokenscope",
];
const ARCHIVED_PROVIDER_NAMES = new Set(["ocsproxy", "enowxlabs"]);
const oauthCompatiblePluginVersionCache = new Map();
const DCP_SCHEMA_URL =
  "https://cdn.jsdelivr.net/gh/Opencode-DCP/opencode-dynamic-context-pruning@master/dcp.schema.json";
const COMPRESSION_EXTERNAL_ENGINE_STATUS = {
  managed: "managed",
  missing: "missing",
};
const RTK_WINDOWS_ZIP_URL =
  "https://github.com/rtk-ai/rtk/releases/latest/download/rtk-x86_64-pc-windows-msvc.zip";
const RTK_UNIX_INSTALL_URL =
  "https://raw.githubusercontent.com/rtk-ai/rtk/refs/heads/master/install.sh";
const CAVEMAN_UNIX_INSTALL_URL =
  "https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.sh";
const CAVEMAN_WINDOWS_INSTALL_URL =
  "https://raw.githubusercontent.com/JuliusBrussee/caveman/main/install.ps1";
const PSES_GITHUB_API_LATEST_RELEASE =
  "https://api.github.com/repos/PowerShell/PowerShellEditorServices/releases/latest";
const PSES_ZIP_ASSET_NAME = "PowerShellEditorServices.zip";
const PSES_INSTALL_ROOT = path.join(
  os.homedir(),
  ".local",
  "powershell-editor-services",
);
const PSES_CURRENT_DIR = path.join(PSES_INSTALL_ROOT, "current");
const PSES_RUNTIME_DIR = path.join(PSES_INSTALL_ROOT, "runtime");
const PSES_START_SCRIPT_RELATIVE_PATH = path.join(
  "PowerShellEditorServices",
  "Start-EditorServices.ps1",
);
const ANTHROPIC_FALLBACK_MODEL = "google/antigravity-claude-sonnet-4-6-thinking";
const OPENAI_FALLBACK_MODEL = "openai/gpt-5.4";
const AGENT_VARIANT_BASELINES = {
  sisyphus: "max",
  oracle: "max",
  librarian: "high",
  explore: "high",
  "multimodal-looker": "high",
  prometheus: "max",
  metis: "max",
  momus: "high",
  atlas: "high",
  hephaestus: "high",
  executor: "high",
  reviewer: "high",
  tester: "high",
  "security-auditor": "max",
  refactorer: "high",
  "doc-writer": "high",
};
const CATEGORY_VARIANT_BASELINES = {
  "visual-engineering": "high",
  artistry: "high",
  writing: "high",
  quick: "high",
  ultrabrain: "max",
  implementation: "high",
  review: "high",
  testing: "high",
  security: "max",
  "unspecified-low": "low",
  "unspecified-high": "high",
  deep: "max",
};

/**
 * Returns the recommended background_task.defaultConcurrency for a given
 * resource mode, based on the current machine's CPU count.
 *
 * Formula:
 *   spareCores = max(1, totalCores - 2)  // reserve 2 for OS + opencode itself
 *   low         -> max(1, floor(spareCores * 0.4))
 *   balanced    -> max(2, floor(spareCores * 0.8))
 *   performance -> max(3, spareCores - 1)
 */
function calcHardwareConcurrency(resourceModeId) {
  const totalCores = os.cpus().length;
  const spareCores = Math.max(1, totalCores - 2);

  if (resourceModeId === "low") {
    return Math.max(1, Math.floor(spareCores * 0.4));
  }
  if (resourceModeId === "performance") {
    return Math.max(3, spareCores - 1);
  }
  // balanced (default)
  return Math.max(2, Math.floor(spareCores * 0.8));
}

function normalizeVersionTag(versionTag) {
  return String(versionTag || "")
    .trim()
    .replace(/^v/i, "");
}

function isRemoteVersionNewer(currentVersion, latestVersion) {
  const current = normalizeVersionTag(currentVersion)
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
  const latest = normalizeVersionTag(latestVersion)
    .split(".")
    .map((part) => parseInt(part, 10) || 0);
  const length = Math.max(current.length, latest.length);

  for (let i = 0; i < length; i += 1) {
    const localPart = current[i] || 0;
    const remotePart = latest[i] || 0;
    if (remotePart > localPart) return true;
    if (remotePart < localPart) return false;
  }
  return false;
}

function checkRepositoryUpdateBadge() {
  const repo = SETUP_RUNTIME_CONFIG.release.githubRepo;
  if (!repo) return;

  try {
    const latestTag = execSync(`gh api repos/${repo}/releases/latest --jq .tag_name`, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    }).trim();

    const currentTag = `v${normalizeVersionTag(CURRENT_SETUP_VERSION)}`;
    if (isRemoteVersionNewer(CURRENT_SETUP_VERSION, latestTag)) {
      console.log(`   [New Update: ${latestTag}]`);
      console.log(`   Note: run \`${SETUP_RUNTIME_CONFIG.release.updateCommand}\``);
      return;
    }

    console.log(`   [Latest: ${currentTag}]`);
  } catch {
    console.log(SETUP_FALLBACKS.updateMessages.skippedReleaseCheck);
  }
}

function runCommandCapture(command, options = {}) {
  return execSync(command, {
    encoding: "utf-8",
    stdio: "pipe",
    ...options,
  }).trim();
}

function parseGithubRepoSlug(remoteUrl) {
  const normalized = String(remoteUrl || "")
    .trim()
    .replace(/^https?:\/\/github\.com\//i, "")
    .replace(/^git@github\.com:/i, "")
    .replace(/\.git$/i, "");

  const match = normalized.match(/^([^/]+\/[^/]+)$/);
  return match ? match[1] : null;
}

function syncPrivateBetaBeforeUpdate(forceUpdate) {
  if (!forceUpdate) return;
  if (args.includes("--skip-sync") || process.env.OCS_UPDATE_SKIP_SYNC === "1") {
    console.log("\n🔄 Update sync: skipped (--skip-sync / OCS_UPDATE_SKIP_SYNC=1)");
    return;
  }

  if (!commandExists("git")) {
    console.log("\n⚠️  git not found. Skipping private repo sync before update.");
    return;
  }

  const branch = process.env.OCS_RELEASE_BRANCH || "main";
  const scriptRepoRoot = path.resolve(__dirname, "..");

  try {
    runCommandCapture("git rev-parse --is-inside-work-tree", {
      cwd: scriptRepoRoot,
      timeout: 5000,
    });
  } catch {
    console.log("\n⚠️  Setup source is not a git checkout. Skipping private repo sync.");
    return;
  }

  console.log(`\n🔄 Syncing private source before update (branch: ${branch})...`);

  try {
    const dirty = runCommandCapture("git status --porcelain", {
      cwd: scriptRepoRoot,
      timeout: 5000,
    });

    if (dirty) {
      console.log("⚠️  Working tree has local changes. Skipping auto-pull to avoid conflicts.");
      console.log("   💡 Commit/stash changes first, then rerun `ocs setup:profile:update`.");
      return;
    }

    const remoteUrl = runCommandCapture("git remote get-url origin", {
      cwd: scriptRepoRoot,
      timeout: 5000,
    });
    const repoSlug = parseGithubRepoSlug(remoteUrl);

    if (commandExists("gh") && repoSlug) {
      try {
        runCommandCapture(`gh api repos/${repoSlug}/branches/${branch} --jq .name`, {
          cwd: scriptRepoRoot,
          timeout: 10000,
        });
      } catch {
        console.log(
          `⚠️  Cannot verify access to private repo branch ${repoSlug}@${branch} via gh.`,
        );
        console.log("   💡 Run `gh auth login` and ensure your account has private repo access.");
        return;
      }
    }

    runCommandCapture(`git fetch origin ${branch}`, {
      cwd: scriptRepoRoot,
      timeout: 30000,
    });

    const hasLocalBranch = (() => {
      try {
        runCommandCapture(`git rev-parse --verify ${branch}`, {
          cwd: scriptRepoRoot,
          timeout: 5000,
        });
        return true;
      } catch {
        return false;
      }
    })();

    if (hasLocalBranch) {
      runCommandCapture(`git checkout ${branch}`, {
        cwd: scriptRepoRoot,
        timeout: 10000,
      });
    } else {
      runCommandCapture(`git checkout -B ${branch} origin/${branch}`, {
        cwd: scriptRepoRoot,
        timeout: 10000,
      });
    }

    runCommandCapture(`git pull --rebase origin ${branch}`, {
      cwd: scriptRepoRoot,
      timeout: 45000,
    });

    const head = runCommandCapture("git rev-parse --short HEAD", {
      cwd: scriptRepoRoot,
      timeout: 5000,
    });
    console.log(`✅ Private source synced: ${branch}@${head}`);
  } catch (error) {
    console.log(`⚠️  Auto-sync before update failed: ${error.message}`);
    console.log("   Continuing with local source as fallback.");
  }
}

function commandExists(command) {
  try {
    if (process.platform === "win32") {
      execSync(`where ${command}`, { stdio: "ignore" });
    } else {
      execSync(`which ${command}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

function runCommandLookup(command, env = process.env, platform = process.platform) {
  try {
    const shellCommand = platform === "win32" ? `where ${command}` : `which ${command}`
    const output = execSync(shellCommand, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      env,
    })

    return String(output || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

function isWindowsMountedCommandPath(filePath, platform = process.platform) {
  if (platform === "win32") {
    return false
  }

  const normalized = String(filePath || "").trim()
  return /^\/mnt\/[A-Za-z]\//.test(normalized)
}

function shouldRejectCrossOsNodeTool(command, platform = process.platform) {
  if (platform === "win32") {
    return false
  }

  return ["node", "npm", "npx", "corepack", "pnpm"].includes(String(command || "").trim())
}

function quoteShellPath(filePath) {
  return `"${String(filePath || "").replace(/"/g, '\\"')}"`;
}

function isCrossPlatformAbsolutePath(filePath) {
  const normalized = String(filePath || "").trim();
  if (!normalized) {
    return false;
  }

  if (path.isAbsolute(normalized)) {
    return true;
  }

  return /^[A-Za-z]:[\\/]/.test(normalized) || /^\\\\[^\\]/.test(normalized);
}

function buildCocoIndexCliInvocation(command, args) {
  const executable = String(command || "").trim();
  const suffix = String(args || "").trim();
  if (!executable) return suffix;

  const executablePart = isCrossPlatformAbsolutePath(executable)
    ? quoteShellPath(executable)
    : executable;

  return suffix ? `${executablePart} ${suffix}` : executablePart;
}

function buildCocoIndexShimContents(executablePath, platform = process.platform) {
  const normalizedExecutable = String(executablePath || "").trim();
  if (!normalizedExecutable) {
    return null;
  }

  if (platform === "win32") {
    return {
      cmd: `@echo off\r\n\"${normalizedExecutable}\" %*\r\n`,
      ps1: `& \"${normalizedExecutable}\" @args\r\n`,
    };
  }

  return {
    sh: `#!/bin/sh\nexec \"${normalizedExecutable}\" \"$@\"\n`,
  };
}

function buildCocoIndexPythonModuleShimContents(pythonCommand, platform = process.platform) {
  if (platform === "win32") {
    return null;
  }

  const normalizedPython = String(pythonCommand || "").trim();
  if (!normalizedPython) {
    return null;
  }

  return {
    sh: `#!/bin/sh\nexec \"${normalizedPython}\" -m cocoindex_code.cli \"$@\"\n`,
  };
}

function resolveCommandPath(command, platform = process.platform, commandRunner = runCommandCapture) {
  const normalizedCommand = String(command || "").trim();
  if (!normalizedCommand) {
    return null;
  }

  const lookupCommand = platform === "win32" ? `where ${normalizedCommand}` : `which ${normalizedCommand}`;
  try {
    const resolved = commandRunner(lookupCommand, { timeout: 10000 });
    const candidates = String(resolved || "")
      .split(/\r?\n/)
      .map((entry) => entry.trim())
      .filter(Boolean);
    return candidates[0] || null;
  } catch {
    return null;
  }
}

function isRecursivePosixCocoIndexShim(executablePath, fsApi = fs) {
  const normalizedExecutable = String(executablePath || "").trim();
  if (!normalizedExecutable || !path.isAbsolute(normalizedExecutable)) {
    return false;
  }

  try {
    const contents = String(fsApi.readFileSync(normalizedExecutable, "utf-8") || "");
    const match = contents.match(/exec\s+"([^"]+)"\s+"\$@"/);
    if (!match) {
      return false;
    }

    const target = String(match[1] || "").trim();
    if (!target) {
      return false;
    }

    return path.basename(target) === COCOINDEX_CODE_COMMAND;
  } catch {
    return false;
  }
}

function getCoreProviderAuthStatePath(options = {}) {
  const {
    env = process.env,
    fallbackHome = os.homedir(),
    pathApi = path,
  } = options;
  const homeDir =
    String(env.HOME || env.USERPROFILE || "").trim() || String(fallbackHome || "").trim();
  if (!homeDir) {
    return null;
  }
  return pathApi.join(homeDir, ".local", "share", "opencode", "auth.json");
}

function syncCoreProviderAuthState(config = {}, options = {}) {
  const {
    env = process.env,
    fallbackHome = os.homedir(),
    fsApi = fs,
    pathApi = path,
    logger = console,
  } = options;

  const statePath = getCoreProviderAuthStatePath({ env, fallbackHome, pathApi });
  if (!statePath) {
    return null;
  }

  const pluginEntries = Array.isArray(config.plugin) ? config.plugin : [];
  const hasLocalOpenAiPlugin = pluginEntries.some(
    (entry) => typeof entry === "string" && entry.includes("opencode-openai-auth"),
  );
  const hasLocalGooglePlugin = pluginEntries.some(
    (entry) => typeof entry === "string" && entry.includes("opencode-multi-auth"),
  );

  let existingState = {};
  try {
    if (fsApi.existsSync(statePath)) {
      existingState = loadJsonObjectOrNull(statePath) || {};
    }
  } catch {
    existingState = {};
  }

  const nextState = {};
  const openAiAccountsPath = pathApi.join(targetDir, "openai-accounts.json");
  const antigravityAccountsPath = pathApi.join(targetDir, "antigravity-accounts.json");

  if (hasLocalOpenAiPlugin && fsApi.existsSync(openAiAccountsPath)) {
    nextState.openai = {
      ...(existingState.openai || {}),
      type: "oauth",
    };
  } else if (existingState.openai) {
    nextState.openai = existingState.openai;
  }

  if (hasLocalGooglePlugin && fsApi.existsSync(antigravityAccountsPath)) {
    nextState.google = {
      ...(existingState.google || {}),
      type: "oauth",
    };
  } else if (existingState.google) {
    nextState.google = existingState.google;
  }

  if (Object.keys(nextState).length === 0) {
    return null;
  }

  fsApi.mkdirSync(pathApi.dirname(statePath), { recursive: true });
  fsApi.writeFileSync(statePath, JSON.stringify(nextState, null, 2), "utf-8");
  logger.log(`✅ Synced core provider auth state: ${statePath}`);
  return statePath;
}

function inferOpenAiRuntimeLaneFromVersion(version) {
  const normalized = String(version || "").trim().replace(/^v/i, "");
  if (!normalized) return null;
  if (normalized === "3.0.0" || normalized.startsWith("3.0.")) return "local-plugin";
  if (normalized === "3.1.0" || normalized.startsWith("3.1.")) return "core";
  return null;
}

function resolveOpenAiRuntimeLane(options = {}) {
  const {
    env = process.env,
    fsApi = fs,
    pathApi = path,
    logger = console,
  } = options;

  const explicitLane = String(env.OCS_OPENAI_RUNTIME_LANE || "").trim().toLowerCase();
  if (explicitLane === "local-plugin" || explicitLane === "core") {
    return explicitLane;
  }

  const provenancePath = pathApi.join(targetDir, "BUILD_PROVENANCE.json");
  try {
    if (fsApi.existsSync(provenancePath)) {
      const raw = fsApi.readFileSync(provenancePath, "utf8");
      const provenance = raw ? JSON.parse(String(raw)) : {};
      const provenanceLane = String(provenance?.distribution?.openAiLane || "").trim().toLowerCase();
      if (provenanceLane === "local-plugin" || provenanceLane === "core") {
        return provenanceLane;
      }
    }
  } catch (error) {
    logger.warn?.(`⚠️ Failed to read BUILD_PROVENANCE.json for OpenAI lane resolution: ${error.message}`);
  }

  const versionLane = inferOpenAiRuntimeLaneFromVersion(env.OCS_VERSION || "");
  if (versionLane) {
    return versionLane;
  }

  return "local-plugin";
}

function isRecursiveWindowsCocoIndexShim(executablePath, fsApi = fs) {
  const normalizedExecutable = String(executablePath || "").trim();
  if (!normalizedExecutable || !path.isAbsolute(normalizedExecutable)) {
    return false;
  }

  const extension = path.extname(normalizedExecutable).toLowerCase();

  try {
    const contents = String(fsApi.readFileSync(normalizedExecutable, "utf-8") || "");
    const loweredExecutable = normalizedExecutable.toLowerCase();
    return contents.toLowerCase().includes(loweredExecutable);
  } catch {
    return extension === ".cmd" || extension === ".ps1" || extension === ".bat";
  }
}

function shouldForcePosixCocoIndexShim(platform = process.platform, env = process.env) {
  if (platform === "win32") {
    return false;
  }

  return String(env.OCS_SETUP_FORCE_POSIX_CCC_SHIM || "") === "1";
}

function resolveCocoIndexScriptsDirs(pythonCommand) {
  if (!pythonCommand) return [];

  const probeCommands = [
    `${pythonCommand} -c "import sysconfig; print(sysconfig.get_path('scripts') or '')"`,
    `${pythonCommand} -c "import os,site; print(os.path.join(os.path.dirname(site.getusersitepackages()), 'Scripts' if os.name == 'nt' else 'bin'))"`,
    `${pythonCommand} -c "import os,site; print(os.path.join(site.USER_BASE, 'Scripts' if os.name == 'nt' else 'bin'))"`,
  ];

  const discovered = [];

  for (const probeCommand of probeCommands) {
    try {
      const resolved = runCommandCapture(probeCommand, { timeout: 10000 });
      if (!resolved || !fs.existsSync(resolved)) {
        continue;
      }

      const hasExisting = discovered.some((entry) =>
        process.platform === "win32"
          ? entry.toLowerCase() === resolved.toLowerCase()
          : entry === resolved,
      );
      if (!hasExisting) {
        discovered.push(resolved);
      }
    } catch {
      // continue probing
    }
  }

  return discovered;
}

function isWslEnvironment(platform = process.platform, env = process.env) {
  if (platform !== "linux") {
    return false;
  }

  if (env.WSL_DISTRO_NAME || env.WSLENV || env.WSL_INTEROP) {
    return true;
  }

  try {
    const versionText = fs.readFileSync("/proc/version", "utf-8");
    return versionText.toLowerCase().includes("microsoft");
  } catch {
    return false;
  }
}

function resolveWslHostProfile(env = process.env) {
  const hostUser = env.WSLHOSTUSER || env.LOGNAME || env.USER || env.USERNAME;
  if (!hostUser) {
    return null;
  }

  return path.join("/mnt/c", "Users", hostUser);
}


function syncWslHostOpencodeConfigParity() {
  if (!isWslEnvironment()) {
    return;
  }

  const hostProfile = resolveWslHostProfile();
  if (!hostProfile) {
    console.log("   ℹ️  WSL host profile not detected. Skipping WSL↔Windows config parity sync.");
    return;
  }

  const hostTargetDir = path.join(hostProfile, ".config", "opencode");
  fs.mkdirSync(hostTargetDir, { recursive: true });

  const parityPairs = [
    [targetOhMyOpencode, path.join(hostTargetDir, "oh-my-opencode.json")],
    [targetOhMyOpenagent, path.join(hostTargetDir, "oh-my-openagent.json")],
  ];

  let syncedCount = 0;

  for (const [sourcePath, destinationPath] of parityPairs) {
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    fs.copyFileSync(sourcePath, destinationPath);
    syncedCount += 1;
  }

  if (syncedCount > 0) {
    console.log(`   ✅ WSL↔Windows config parity sync complete (${syncedCount} file(s) mirrored).`);
    console.log("   ℹ️  Skipped opencode.json parity sync because plugin/MCP runtime paths are OS-specific.");
  } else {
    console.log("   ℹ️  No generated config files available for WSL↔Windows parity sync.");
  }
}

function getCocoIndexPlatformDirs(
  platform = process.platform,
  env = process.env,
  homedir = os.homedir(),
) {
  const normalize = (value) => (value ? path.normalize(value) : null);
  const dirs = new Set();

  const addDir = (value) => {
    if (!value) return;
    dirs.add(normalize(value));
  };

  addDir(env.XDG_BIN_HOME);
  addDir(env.UV_TOOL_BIN_DIR);
  addDir(env.PIPX_BIN_DIR);

  const defaultUvToolDir = path.join(homedir, ".local", "share", "uv", "tools");
  addDir(path.join(env.UV_TOOL_DIR || defaultUvToolDir, "bin"));
  const pipxHomes = [
    env.PIPX_HOME,
    path.join(homedir, "pipx"),
    path.join(homedir, ".local", "pipx"),
    path.join(homedir, ".local", "share", "pipx"),
  ].filter(Boolean);
  addDir(path.join(homedir, ".local", "bin"));
  addDir(path.join(homedir, ".local", "pipx", "bin"));
  for (const pipxHome of pipxHomes) {
    addDir(path.join(pipxHome, "bin"));
    const pipxVenvBase = path.join(pipxHome, "venvs", COCOINDEX_CODE_PACKAGE_NAME);
    addDir(path.join(pipxVenvBase, "Scripts"));
    addDir(path.join(pipxVenvBase, "bin"));
  }

  if (platform === "win32") {
    addDir(path.join(homedir, "AppData", "Roaming", "Python", "Scripts"));
    addDir(path.join(homedir, "AppData", "Local", "Programs", "Python"));
  }

  if (isWslEnvironment(platform, env)) {
    const hostProfile = resolveWslHostProfile(env);
    if (hostProfile) {
      addDir(path.join(hostProfile, ".local", "bin"));
      addDir(
        path.join(
          hostProfile,
          ".local",
          "pipx",
          "venvs",
          COCOINDEX_CODE_PACKAGE_NAME,
          "Scripts",
        ),
      );
    }
  }

  return Array.from(dirs).filter(Boolean);
}

function resolveCocoIndexCommand(pythonCommand, options = {}) {
  const {
    platform = process.platform,
    env = process.env,
    homedir = os.homedir(),
    fsApi = fs,
    commandResolver = resolveCommandPath,
  } = options;
  const pathResolvedCommand = commandResolver(COCOINDEX_CODE_COMMAND, platform);
  let fallbackWrapperCommand = null;
  const isRecursivePosixCommand =
    platform !== "win32" && isRecursivePosixCocoIndexShim(pathResolvedCommand, fsApi);
  if (
    pathResolvedCommand &&
    !isRecursiveWindowsCocoIndexShim(pathResolvedCommand, fsApi) &&
    !isRecursivePosixCommand
  ) {
    if (platform !== "win32") {
      return pathResolvedCommand;
    }

    const resolvedExtension = path.extname(String(pathResolvedCommand || "")).toLowerCase();
    if (resolvedExtension === ".exe" || resolvedExtension === "") {
      return pathResolvedCommand;
    }

    fallbackWrapperCommand = pathResolvedCommand;
  }

  const scriptsDirs = resolveCocoIndexScriptsDirs(pythonCommand);
  const platformDirs = getCocoIndexPlatformDirs(platform, env, homedir);
  const candidateDirs = platform === "win32" ? [...platformDirs, ...scriptsDirs] : [...scriptsDirs, ...platformDirs];
  if (candidateDirs.length === 0) {
    return null;
  }

  const scriptCandidates =
    platform === "win32"
      ? ["ccc.exe", "ccc.cmd", "ccc.bat", "ccc"]
      : ["ccc"];

  const seenDirs = new Set();

  for (const scriptsDir of candidateDirs) {
    const normalizedDir = path.normalize(String(scriptsDir || ""));
    if (!normalizedDir) continue;
    if (seenDirs.has(normalizedDir)) continue;
    seenDirs.add(normalizedDir);

    for (const scriptName of scriptCandidates) {
      const absolutePath = path.join(normalizedDir, scriptName);
      if (!fsApi.existsSync(absolutePath)) {
        continue;
      }
      if (platform !== "win32" && isRecursivePosixCocoIndexShim(absolutePath, fsApi)) {
        continue;
      }
      if (platform === "win32" && isRecursiveWindowsCocoIndexShim(absolutePath, fsApi)) {
        continue;
      }
      if (fsApi.existsSync(absolutePath)) {
        return absolutePath;
      }
    }
  }

  if (fallbackWrapperCommand) {
    return fallbackWrapperCommand;
  }

  return null;
}

function ensureCocoIndexCommandShim(resolvedCommand, options = {}) {
  const {
    pythonCommand = "",
    env = process.env,
    fsApi = fs,
    platform = process.platform,
  } = options;
  const homeDir = env.HOME || env.USERPROFILE || os.homedir();
  const normalizedCommand = String(resolvedCommand || "").trim();
  const forcePosixShim = shouldForcePosixCocoIndexShim(platform, env);
  const localShimPath = platform === "win32" ? null : path.join(homeDir, ".local", "bin", COCOINDEX_CODE_COMMAND);
  const shouldRepairMissingPosixCommand =
    platform !== "win32" &&
    !normalizedCommand &&
    localShimPath &&
    fsApi.existsSync(localShimPath) &&
    isRecursivePosixCocoIndexShim(localShimPath, fsApi);

  if (!normalizedCommand && !forcePosixShim && !shouldRepairMissingPosixCommand) return null;

  if (!forcePosixShim && !shouldRepairMissingPosixCommand && !path.isAbsolute(normalizedCommand)) {
    return normalizedCommand;
  }

  if (platform === "win32") {
    const bunBinDir = path.join(homeDir, ".bun", "bin");
    fsApi.mkdirSync(bunBinDir, { recursive: true });

    const shimPaths = {
      cmd: path.join(bunBinDir, "ccc.cmd"),
      ps1: path.join(bunBinDir, "ccc.ps1"),
    };
    const shimContents = buildCocoIndexShimContents(normalizedCommand, "win32");

    try {
      fsApi.writeFileSync(shimPaths.cmd, shimContents.cmd, "utf-8");
      fsApi.writeFileSync(shimPaths.ps1, shimContents.ps1, "utf-8");
    } catch (error) {
      console.log(`   ⚠️ Failed to refresh Windows CocoIndex helper shims: ${error.message}`);
    }

    const pathParts = String(process.env.PATH || "").split(path.delimiter);
    if (!pathParts.some((entry) => entry.toLowerCase() === bunBinDir.toLowerCase())) {
      process.env.PATH = `${bunBinDir}${path.delimiter}${process.env.PATH || ""}`;
    }

    return normalizedCommand;
  }

  const localBinDir = path.join(homeDir, ".local", "bin");
  fsApi.mkdirSync(localBinDir, { recursive: true });

  const shimPath = path.join(localBinDir, "ccc");
  let shimContents = null;

  const shouldRepairRecursiveShim =
    shouldRepairMissingPosixCommand || isRecursivePosixCocoIndexShim(normalizedCommand, fsApi);

  if (forcePosixShim || shouldRepairRecursiveShim) {
    shimContents = buildCocoIndexPythonModuleShimContents(pythonCommand, platform);
    if (!shimContents) {
      if (isInstallerSetupMode()) {
        console.log(
          "   ℹ️ CocoIndex shim repair deferred during installer bootstrap because Python 3.11+ is not currently available in this shell.",
        );
      } else {
        console.log(
          "   ⚠️ CocoIndex shim repair requested, but Python runtime is unavailable for ccc shim.",
        );
      }
    }
  }

  if (!shimContents) {
    if (!normalizedCommand) {
      return null;
    }

    if (!path.isAbsolute(normalizedCommand)) {
      return normalizedCommand;
    }

    shimContents = buildCocoIndexShimContents(normalizedCommand, platform);
  }

  fsApi.writeFileSync(shimPath, shimContents.sh, "utf-8");
  fsApi.chmodSync(shimPath, 0o755);

  const pathParts = String(process.env.PATH || "").split(path.delimiter);
  if (!pathParts.includes(localBinDir)) {
    process.env.PATH = `${localBinDir}${path.delimiter}${process.env.PATH || ""}`;
  }

  if (forcePosixShim || shouldRepairRecursiveShim) {
    return shimPath;
  }

  return normalizedCommand;
}

function getCocoIndexInstallStrategies(pythonCommand, { commandExistsFn = commandExists } = {}) {
  const normalizedPython = String(pythonCommand || "").trim();
  return [
    {
      id: "pipx",
      label: "pipx",
      available: () => commandExistsFn("pipx"),
      run: (runner) =>
        runner(`pipx install --force \"${COCOINDEX_CODE_INSTALL_SPEC}\"`, {
          label: `pipx install ${COCOINDEX_CODE_INSTALL_SPEC}`,
          timeout: 300000,
          cwd: targetCocoIndexDir,
        }),
    },
    {
      id: "uv",
      label: "uv tool",
      available: () => commandExistsFn("uv"),
      run: (runner) =>
        runner(`uv tool install \"${COCOINDEX_CODE_INSTALL_SPEC}\"`, {
          label: `uv tool install ${COCOINDEX_CODE_INSTALL_SPEC}`,
          timeout: 300000,
          cwd: targetCocoIndexDir,
        }),
    },
    {
      id: "pip",
      label: "pip",
      available: () => Boolean(normalizedPython),
      run: (runner) =>
        runner(`${normalizedPython} -m pip install -U \"${COCOINDEX_CODE_INSTALL_SPEC}\"`, {
          label: `python -m pip install ${COCOINDEX_CODE_INSTALL_SPEC}`,
          timeout: 300000,
          cwd: targetCocoIndexDir,
        }),
    },
    {
      id: "official-source",
      label: "official GitHub source",
      available: () => Boolean(normalizedPython),
      run: (runner) =>
        runner(
          `${normalizedPython} -m pip install -U ${COCOINDEX_CODE_OFFICIAL_SOURCE_URL}`,
          {
            label: `pip install ${COCOINDEX_CODE_OFFICIAL_SOURCE_URL}`,
            timeout: 300000,
            cwd: targetCocoIndexDir,
          },
        ),
    },
  ];
}

function installCocoIndexPackage(pythonCommand, options = {}) {
  const { runner = runCommandWithRetry, commandExistsFn = commandExists } = options;
  const strategies = getCocoIndexInstallStrategies(pythonCommand, { commandExistsFn });

  for (const strategy of strategies) {
    if (!strategy.available()) {
      continue;
    }

    console.log(`   ⚠️ CocoIndex not found. Installing via ${strategy.label}...`);
    try {
      strategy.run(runner);
      console.log(`   ✅ CocoIndex package installation completed via ${strategy.label}.`);
      return strategy.id;
    } catch (error) {
      console.log(`   ❌ ${strategy.label} install failed: ${error.message}`);
    }
  }

  console.log(
    "   ⚠️ Unable to automatically install CocoIndex (pipx/uv/pip unavailable).",
  );
  return null;
}

function resolveCocoIndexMcpExecutable(
  resolvedCommand,
  hasPathCommand = commandExists(COCOINDEX_CODE_COMMAND),
) {
  const normalizedCommand = String(resolvedCommand || "").trim();
  if (normalizedCommand && isCrossPlatformAbsolutePath(normalizedCommand)) {
    return normalizedCommand;
  }

  if (hasPathCommand) {
    return COCOINDEX_CODE_COMMAND;
  }

  return COCOINDEX_CODE_COMMAND;
}

function getCocoIndexMcpBridgePath() {
  return path.join(targetDir, "scripts", "cocoindex-mcp-bridge.cjs");
}

function resolveCocoIndexMcpRuntime(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    fallbackHome = os.homedir(),
    fsApi = fs,
  } = options;
  const { homeDir } = resolveInstallerPathContract({ env, platform, fallbackHome });
  const bunExecutable = platform === "win32"
    ? path.join(homeDir, ".bun", "bin", "bun.exe")
    : path.join(homeDir, ".bun", "bin", "bun");

  if (fsApi.existsSync(bunExecutable)) {
    return bunExecutable;
  }

  return process.execPath;
}

function buildCocoIndexMcpCommand(resolvedCommand, options = {}) {
  return [
    resolveCocoIndexMcpRuntime(options),
    getCocoIndexMcpBridgePath(),
    resolveCocoIndexMcpExecutable(resolvedCommand),
  ];
}

function applyCocoIndexMcpEntry(opencodeConfig, resolvedCommand, options = {}) {
  const nextConfig = isPlainObject(opencodeConfig) ? clone(opencodeConfig) : {};
  const nextMcp = isPlainObject(nextConfig.mcp) ? clone(nextConfig.mcp) : {};
  const existingEntry = isPlainObject(nextMcp[COCOINDEX_CODE_MCP_NAME])
    ? clone(nextMcp[COCOINDEX_CODE_MCP_NAME])
    : {};

  nextMcp[COCOINDEX_CODE_MCP_NAME] = {
    ...existingEntry,
    type: "local",
    command: buildCocoIndexMcpCommand(resolvedCommand, options),
  };

  nextConfig.mcp = nextMcp;
  return nextConfig;
}

function syncCocoIndexMcpEntryToTargetConfig(resolvedCommand, options = {}) {
  const { logger = console } = options;
  if (!fs.existsSync(targetOpencodeJson)) {
    return;
  }

  try {
    const currentConfig = loadJsonFile(targetOpencodeJson);
    const nextConfig = applyCocoIndexMcpEntry(currentConfig, resolvedCommand, {
      env: process.env,
      platform: process.platform,
      fallbackHome: os.homedir(),
      fsApi: fs,
    });
    fs.writeFileSync(targetOpencodeJson, JSON.stringify(nextConfig, null, 2));
    const resolvedMcpCommand = nextConfig.mcp?.[COCOINDEX_CODE_MCP_NAME]?.command?.[2];
    logger.log(
      `   ✅ Registered MCP '${COCOINDEX_CODE_MCP_NAME}' -> ${resolvedMcpCommand || "ccc"} mcp`,
    );
  } catch (error) {
    console.log(`   ⚠️ Failed to sync CocoIndex MCP config: ${error.message}`);
  }
}

function runCocoIndexReadinessChecks(cocoindexCommand, options = {}) {
  const resolvedCommand = String(cocoindexCommand || "").trim();
  const execRunner = options.execRunner || execSync;
  if (!resolvedCommand) {
    console.log("   ⚠️ ccc command is unavailable for readiness checks.");
    return;
  }

  try {
    execRunner(buildCocoIndexCliInvocation(resolvedCommand, "--help"), {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    });
    console.log("   ✅ ccc --help readiness OK.");
  } catch (error) {
    console.log(`   ⚠️ ccc --help readiness failed: ${error.message}`);
  }

  console.log("   ℹ️ Skipping ccc init during setup bootstrap; project init is deferred to first project-scoped CocoIndex session.");

  try {
    execRunner(buildCocoIndexCliInvocation(resolvedCommand, "mcp --help"), {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    });
    console.log("   ✅ ccc mcp readiness OK.");
  } catch (error) {
    console.log(`   ⚠️ ccc mcp readiness failed: ${error.message}`);
  }
}

function isCocoIndexCommandReady(cocoindexCommand, options = {}) {
  const { probe = execSync } = options;
  const resolvedCommand = String(cocoindexCommand || "").trim();
  if (!resolvedCommand) {
    return false;
  }

  try {
    probe(buildCocoIndexCliInvocation(resolvedCommand, "--help"), {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    });
    probe(buildCocoIndexCliInvocation(resolvedCommand, "mcp --help"), {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 10000,
    });
    return true;
  } catch {
    return false;
  }
}

function resolveHealthyCocoIndexCommand(pythonCommand, options = {}) {
  const resolvedCommand = resolveCocoIndexCommand(pythonCommand, options);
  if (!resolvedCommand) {
    return null;
  }

  return isCocoIndexCommandReady(resolvedCommand, options) ? resolvedCommand : null;
}

function canUsePasswordlessSudo() {
  if (process.platform === "win32") return false;
  if (!commandExists("sudo")) return false;

  try {
    execSync("sudo -n true", { stdio: "ignore", timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

function canPromptForInteractiveSudo() {
  if (headlessMode) {
    return false;
  }

  const stdin = process.stdin;
  const stdout = process.stdout;
  return Boolean(stdin?.isTTY && stdout?.isTTY);
}

function runLinuxPackageInstallCommand(command, options = {}) {
  const {
    execRunner = execSync,
    commandExistsFn = commandExists,
    canUsePasswordlessSudoFn = canUsePasswordlessSudo,
    canPromptForInteractiveSudoFn = canPromptForInteractiveSudo,
    logger = console,
    timeout = 300000,
    label = command,
  } = options;

  const baseCommand = String(command || "").trim();
  if (!baseCommand) {
    throw new Error("Missing package install command");
  }

  const hasSudo = commandExistsFn("sudo");
  const passwordless = hasSudo && Boolean(canUsePasswordlessSudoFn());
  const initialCommand = hasSudo ? `sudo -n ${baseCommand}` : baseCommand;

  try {
    execRunner(initialCommand, { stdio: "inherit", timeout });
    return true;
  } catch (error) {
    if (!hasSudo) {
      logger.log(`   ⚠️ ${label} failed: ${error?.message || "command failed"}`);
      return false;
    }

    if (!canPromptForInteractiveSudoFn()) {
      logger.log(
        `   ⚠️ ${label} requires elevated privileges but interactive sudo prompts are unavailable.`,
      );
      return false;
    }

    logger.log(
      `   ⚠️ ${label} needs elevated privileges. Retrying with sudo (password prompt may appear)...`,
    );

    try {
      execRunner(`sudo ${baseCommand}`, { stdio: "inherit", timeout });
      return true;
    } catch (fallbackError) {
      logger.log(
        `   ⚠️ ${label} failed even with sudo: ${fallbackError?.message || "command failed"}`,
      );
      return false;
    }
  }
}

function writePluginInstallFingerprintMarker(pluginDir) {
  if (!pluginDir || !fs.existsSync(pluginDir)) {
    return false;
  }

  const markerDir = path.join(pluginDir, ".ocs-install-state");
  const markerPath = path.join(markerDir, "bun-install.fingerprint");
  const packageJsonPath = path.join(pluginDir, "package.json");
  let markerValue = "setup-plugin-install";

  if (fs.existsSync(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      const name = String(packageJson.name || "opencode-multi-auth").trim() || "opencode-multi-auth";
      const version = String(packageJson.version || "unknown").trim() || "unknown";
      markerValue = `${name}@${version}`;
    } catch {
      markerValue = "setup-plugin-install";
    }
  }

  fs.mkdirSync(markerDir, { recursive: true });
  fs.writeFileSync(markerPath, markerValue, "utf8");
  return true;
}

function parsePythonVersionOutput(versionText) {
  const match = String(versionText || "").match(/Python\s+(\d+)\.(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
  };
}

function isSupportedCocoIndexPythonVersion(versionText) {
  const parsed = parsePythonVersionOutput(versionText);
  if (!parsed) {
    return false;
  }

  if (parsed.major > COCOINDEX_MIN_PYTHON_MAJOR) {
    return true;
  }

  return (
    parsed.major === COCOINDEX_MIN_PYTHON_MAJOR &&
    parsed.minor >= COCOINDEX_MIN_PYTHON_MINOR
  );
}

function probeCocoIndexPythonCandidate(candidate) {
  const normalized = String(candidate || "").trim();
  if (!normalized) {
    return null;
  }

  try {
    const rawVersion = execSync(`${normalized} --version`, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 8000,
    });
    const parsed = parsePythonVersionOutput(rawVersion);
    if (!parsed) {
      return null;
    }

    return {
      candidate: normalized,
      major: parsed.major,
      minor: parsed.minor,
      rawVersion: String(rawVersion || "").trim(),
    };
  } catch {
    return null;
  }
}

function getCocoIndexPythonCandidates(
  platform = process.platform,
  env = process.env,
  homedir = os.homedir(),
) {
  const candidates =
    platform === "win32"
      ? ["py -3.13", "py -3.12", "py -3.11", "py -3", "python", "python3"]
      : ["python3.13", "python3.12", "python3.11", "python3", "python"];

  const pipxHomes = [
    env.PIPX_HOME,
    path.join(homedir, ".local", "pipx"),
    path.join(homedir, ".local", "share", "pipx"),
  ].filter(Boolean);
  const venvCandidates = pipxHomes.flatMap((pipxHome) => {
    const pipxVenvBase = path.join(pipxHome, "venvs", COCOINDEX_CODE_PACKAGE_NAME);
    return platform === "win32"
      ? [path.join(pipxVenvBase, "Scripts", "python.exe")]
      : [path.join(pipxVenvBase, "bin", "python")];
  });

  return [...candidates, ...venvCandidates].filter(Boolean);
}

function isPipxCocoIndexPythonCandidate(candidate) {
  const normalized = path.normalize(String(candidate || ""));
  return /[\\/]venvs[\\/]cocoindex-code[\\/]/i.test(normalized);
}

function compareCocoIndexPythonCandidates(left, right) {
  const leftPipx = isPipxCocoIndexPythonCandidate(left.candidate);
  const rightPipx = isPipxCocoIndexPythonCandidate(right.candidate);
  if (leftPipx !== rightPipx) {
    return leftPipx ? -1 : 1;
  }

  if (left.major !== right.major) {
    return right.major - left.major;
  }

  if (left.minor !== right.minor) {
    return right.minor - left.minor;
  }

  return 0;
}

function resolveCocoIndexPythonCommand(
  platform = process.platform,
  env = process.env,
  homedir = os.homedir(),
) {
  const candidates = getCocoIndexPythonCandidates(platform, env, homedir);

  const supported = [];

  for (const candidate of candidates) {
    const probe = probeCocoIndexPythonCandidate(candidate);
    if (!probe) {
      continue;
    }

    if (isSupportedCocoIndexPythonVersion(probe.rawVersion)) {
      supported.push(probe);
    }
  }

  supported.sort(compareCocoIndexPythonCandidates);

  if (supported.length > 0) {
    return supported[0].candidate;
  }

  return null;
}

function autoInstallPythonForCocoIndex() {
  if (process.platform === "win32") {
    if (!commandExists("winget")) {
      console.log("   ⚠️ Python not found and winget is unavailable.");
      console.log("   💡 Install Python 3.11+ manually, then rerun setup.");
      return null;
    }

    console.log("   ⚠️ Python 3.11+ not found. Installing via winget...");
    try {
      execSync(
        "winget install --id Python.Python.3.12 --source winget --accept-package-agreements --accept-source-agreements",
        { stdio: "inherit", timeout: 300000 },
      );
    } catch (error) {
      console.log(`   ❌ Failed to auto-install Python via winget: ${error.message}`);
      return null;
    }

    return resolveCocoIndexPythonCommand();
  }

  if (process.platform === "darwin" && commandExists("brew")) {
    console.log("   ⚠️ Python 3.11+ not found. Installing via brew...");
    try {
      execSync("brew install python", { stdio: "inherit", timeout: 300000 });
      return resolveCocoIndexPythonCommand();
    } catch (error) {
      console.log(`   ❌ Failed to auto-install Python via brew: ${error.message}`);
      return null;
    }
  }

  if (commandExists("apt-get")) {
    console.log("   ⚠️ Python 3.11+ not found. Attempting apt-get install...");
    let installed = runLinuxPackageInstallCommand(
      "apt-get install -y python3.11 python3.11-venv python3-pip",
      {
        label: "apt-get install python3.11",
      },
    );
    if (!installed) {
      installed = runLinuxPackageInstallCommand("apt-get install -y python3 python3-pip", {
        label: "apt-get install python",
      });
    }
    if (!installed) {
      return null;
    }
    return resolveCocoIndexPythonCommand();
  }

  if (commandExists("dnf")) {
    console.log("   ⚠️ Python 3.11+ not found. Attempting dnf install...");
    const installed = runLinuxPackageInstallCommand("dnf install -y python3 python3-pip", {
      label: "dnf install python",
    });
    if (!installed) {
      return null;
    }
    return resolveCocoIndexPythonCommand();
  }

  if (commandExists("pacman")) {
    console.log("   ⚠️ Python 3.11+ not found. Attempting pacman install...");
    const installed = runLinuxPackageInstallCommand(
      "pacman -Sy --noconfirm python python-pip",
      {
        label: "pacman install python",
      },
    );
    if (!installed) {
      return null;
    }
    return resolveCocoIndexPythonCommand();
  }

  if (isInstallerSetupMode()) {
    console.log("   ℹ️ Auto-install for Python is unavailable on this platform during installer bootstrap.");
    console.log("   ℹ️ Continuing with post-install runtime verification and any existing CocoIndex command path.");
  } else {
    console.log("   ⚠️ Auto-install for Python is unavailable on this platform.");
    console.log("   💡 Install Python 3.11+ manually, then rerun setup.");
  }
  return null;
}

function ensurePipForCocoIndex(pythonCommand) {
  try {
    execSync(`${pythonCommand} -m pip --version`, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 8000,
    });
    return true;
  } catch {
    try {
      execSync(`${pythonCommand} -m ensurepip --upgrade`, {
        stdio: "inherit",
        timeout: 120000,
      });
      execSync(`${pythonCommand} -m pip --version`, {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 8000,
      });
      return true;
    } catch {
      return false;
    }
  }
}

function parseSimpleEnv(rawText) {
  const output = {};
  const lines = String(rawText || "").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;

    const key = trimmed.slice(0, eqIndex).trim();
    if (!key) continue;

    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    output[key] = value;
  }

  return output;
}

function quoteEnvValue(value) {
  const text = String(value ?? "");
  if (/^[A-Za-z0-9_./:@-]+$/.test(text)) {
    return text;
  }
  return JSON.stringify(text);
}

function buildCocoIndexEnvValues(existingValues = {}, runtimeEnv = process.env) {
  const next = isPlainObject(existingValues) ? clone(existingValues) : {};

  const runtimeDatabaseUrl = String(runtimeEnv.COCOINDEX_DATABASE_URL || "").trim();
  const existingDatabaseUrl = String(next.COCOINDEX_DATABASE_URL || "").trim();
  const databaseUrlSource = runtimeDatabaseUrl
    ? "runtime-env"
    : existingDatabaseUrl
      ? "existing"
      : "default";

  next.COCOINDEX_DATABASE_URL =
    runtimeDatabaseUrl || existingDatabaseUrl || DEFAULT_COCOINDEX_DATABASE_URL;

  const runtimeNamespace = String(runtimeEnv.COCOINDEX_APP_NAMESPACE || "").trim();
  const existingNamespace = String(next.COCOINDEX_APP_NAMESPACE || "").trim();
  next.COCOINDEX_APP_NAMESPACE =
    runtimeNamespace || existingNamespace || DEFAULT_COCOINDEX_APP_NAMESPACE;

  const runtimeSchema = String(runtimeEnv.COCOINDEX_DATABASE_SCHEMA_NAME || "").trim();
  const existingSchema = String(next.COCOINDEX_DATABASE_SCHEMA_NAME || "").trim();
  next.COCOINDEX_DATABASE_SCHEMA_NAME =
    runtimeSchema || existingSchema || DEFAULT_COCOINDEX_DATABASE_SCHEMA;

  return {
    values: next,
    databaseUrlSource,
  };
}

function buildCocoIndexEnvFileContent(envValues) {
  const lines = [
    "# Managed by OCS setup: CocoIndex runtime configuration",
    "# Safe to edit manually. Existing values are preserved on rerun.",
    "",
  ];

  for (const key of Object.keys(envValues)) {
    lines.push(`${key}=${quoteEnvValue(envValues[key])}`);
  }

  return `${lines.join("\n")}\n`;
}

function writeCocoIndexComposeTemplate() {
  const composeContent = [
    "services:",
    "  cocoindex-postgres:",
    "    image: pgvector/pgvector:pg16",
    "    container_name: ocs-cocoindex-postgres",
    "    restart: unless-stopped",
    "    environment:",
    "      POSTGRES_USER: postgres",
    "      POSTGRES_PASSWORD: postgres",
    "      POSTGRES_DB: cocoindex",
    "    ports:",
    "      - \"5432:5432\"",
    "    volumes:",
    "      - cocoindex_pgdata:/var/lib/postgresql/data",
    "volumes:",
    "  cocoindex_pgdata:",
    "",
  ].join("\n");

  fs.mkdirSync(targetCocoIndexDir, { recursive: true });
  fs.writeFileSync(targetCocoIndexComposePath, composeContent, "utf-8");
}

function ensureCocoIndexPostgresRuntime(databaseUrlSource) {
  if (databaseUrlSource !== "default") {
    console.log("   ℹ️ COCOINDEX_DATABASE_URL already provided. Skipping local Postgres bootstrap.");
    return;
  }

  if (process.env.OCS_SETUP_SKIP_COCOINDEX_POSTGRES === "1") {
    console.log("   ℹ️ Skipping local CocoIndex Postgres bootstrap (OCS_SETUP_SKIP_COCOINDEX_POSTGRES=1).");
    return;
  }

  if (!commandExists("docker")) {
    console.log("   ⚠️ Docker not found. Local CocoIndex Postgres was not auto-started.");
    return;
  }

  const composeFile = quoteShellPath(targetCocoIndexComposePath);
  const composeCommands = [
    `docker compose -f ${composeFile} up -d`,
    `docker-compose -f ${composeFile} up -d`,
  ];

  for (const composeCommand of composeCommands) {
    try {
      runCommandWithRetry(composeCommand, {
        cwd: targetCocoIndexDir,
        timeout: 180000,
        maxAttempts: 2,
        label: "CocoIndex Postgres bootstrap",
      });
      console.log("   ✅ Local CocoIndex Postgres container is running.");
      return;
    } catch {
      // try fallback compose command
    }
  }

  console.log("   ⚠️ Failed to auto-start local CocoIndex Postgres container.");
  console.log(`   💡 Run manually: docker compose -f ${targetCocoIndexComposePath} up -d`);
}

function inspectCocoIndexRetentionState() {
  if (!fs.existsSync(localCocoIndexDataDir)) {
    return {
      dataDir: localCocoIndexDataDir,
      exists: false,
      dbCount: 0,
      sampledAt: new Date().toISOString(),
    };
  }

  let dbCount = 0;
  try {
    const stack = [localCocoIndexDataDir];
    while (stack.length > 0) {
      const currentDir = stack.pop();
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const absolute = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          stack.push(absolute);
          continue;
        }

        if (/\.mdb$/i.test(entry.name)) {
          dbCount += 1;
        }
      }
    }
  } catch {
    // best-effort inspection only
  }

  return {
    dataDir: localCocoIndexDataDir,
    exists: true,
    dbCount,
    sampledAt: new Date().toISOString(),
  };
}

function persistCocoIndexRetentionState(stage, retentionState) {
  try {
    fs.mkdirSync(targetCocoIndexDir, { recursive: true });
    const existing = fs.existsSync(targetCocoIndexRetentionManifestPath)
      ? loadJsonFile(targetCocoIndexRetentionManifestPath)
      : {};

    const next = {
      ...existing,
      policy: "non-destructive-reinstall",
      notes:
        "OCS setup does not reset/delete existing CocoIndex data unless explicit user reset commands are run.",
      lastStage: stage,
      lastUpdatedAt: new Date().toISOString(),
      retention: retentionState,
    };

    fs.writeFileSync(targetCocoIndexRetentionManifestPath, JSON.stringify(next, null, 2));
  } catch {
    // manifest write should never block setup
  }
}

function logCocoIndexRetentionNotice(retentionState) {
  if (!retentionState?.exists) {
    console.log("   ℹ️ Existing CocoIndex index data not detected yet.");
    console.log("   ℹ️ Reinstall-safe mode enabled: future indexes are preserved by default.");
    return;
  }

  console.log(
    `   ✅ Existing CocoIndex data detected at ${retentionState.dataDir} (${retentionState.dbCount} .mdb files).`,
  );
  console.log(
    "   ✅ Reinstall-safe mode: setup will reuse existing index data and avoid destructive resets.",
  );
}

function ensureCocoIndexSupport() {
  const hasExistingCocoIndexRuntime =
    fs.existsSync(targetCocoIndexEnvPath) ||
    fs.existsSync(targetCocoIndexDir) ||
    commandExists(COCOINDEX_CODE_COMMAND);

  const shouldManageCocoIndex =
    isInstallerSetupMode() ||
    process.env.OCS_SETUP_COCOINDEX_AUTO === "1" ||
    (forceUpdate && headlessMode) ||
    hasExistingCocoIndexRuntime;

  if (!shouldManageCocoIndex) {
    return;
  }

  if (process.env.OCS_SETUP_SKIP_COCOINDEX === "1") {
    console.log("\n🧠 Skipping CocoIndex setup (OCS_SETUP_SKIP_COCOINDEX=1).");
    return;
  }

  runWithProgress(
    {
      channel: "install",
      scenario: "cocoindexBootstrap",
    },
    () => {
      console.log("\n🧠 Checking CocoIndex runtime...");

      const retentionState = inspectCocoIndexRetentionState();
      persistCocoIndexRetentionState("before-setup", retentionState);
      logCocoIndexRetentionNotice(retentionState);

      let pythonCommand = resolveCocoIndexPythonCommand();
      if (!pythonCommand) {
        pythonCommand = autoInstallPythonForCocoIndex();
      }

      const existingEnv = fs.existsSync(targetCocoIndexEnvPath)
        ? parseSimpleEnv(fs.readFileSync(targetCocoIndexEnvPath, "utf-8"))
        : {};
      const envState = buildCocoIndexEnvValues(existingEnv, process.env);

      fs.mkdirSync(targetCocoIndexDir, { recursive: true });
      fs.writeFileSync(
        targetCocoIndexEnvPath,
        buildCocoIndexEnvFileContent(envState.values),
        "utf-8",
      );
      writeCocoIndexComposeTemplate();
      console.log(`   ✅ CocoIndex config ready: ${targetCocoIndexEnvPath}`);
      const healthyResolvedCommand = resolveHealthyCocoIndexCommand(pythonCommand, {
        platform: process.platform,
        env: process.env,
        homedir: os.homedir(),
        fsApi: fs,
      });

      let cocoindexCommand = ensureCocoIndexCommandShim(
        healthyResolvedCommand || resolveCocoIndexCommand(pythonCommand),
        { pythonCommand, platform: process.platform },
      );
      syncCocoIndexMcpEntryToTargetConfig(cocoindexCommand);

      if (healthyResolvedCommand || (cocoindexCommand && isCocoIndexCommandReady(cocoindexCommand))) {
        if (forceUpdate) {
          console.log("   ✅ CocoIndex already installed and ready. Skipping reinstall.");
        }
        syncCocoIndexMcpEntryToTargetConfig(cocoindexCommand);
        ensureCocoIndexPostgresRuntime(envState.databaseUrlSource);
        persistCocoIndexRetentionState("ready-existing", inspectCocoIndexRetentionState());
        return;
      }

      if (!pythonCommand) {
        if (isInstallerSetupMode()) {
          console.log("   ℹ️ CocoIndex package bootstrap deferred during installer run because Python 3.11+ is not currently available in this shell.");
          console.log("   ℹ️ If a healthy ccc runtime already exists, post-install verification can still succeed after PATH is sourced.");
        } else {
          console.log("   ⚠️ Python runtime not available. CocoIndex package install skipped.");
          console.log("   💡 Install Python 3.11+, then rerun setup to finish CocoIndex bootstrap.");
        }
        ensureCocoIndexPostgresRuntime(envState.databaseUrlSource);
        return;
      }

      if (!ensurePipForCocoIndex(pythonCommand)) {
        console.log("   ⚠️ pip is unavailable for detected Python runtime.");
        console.log("   💡 Install pip, then rerun setup to finish CocoIndex bootstrap.");
        ensureCocoIndexPostgresRuntime(envState.databaseUrlSource);
        return;
      }

      const installStrategy = installCocoIndexPackage(pythonCommand);
      if (!installStrategy) {
        const fallbackCommand = `${pythonCommand || "python3"} -m pip install -U \"${COCOINDEX_CODE_INSTALL_SPEC}\"`;
        const officialFallbackCommand = `${pythonCommand || "python3"} -m pip install -U ${COCOINDEX_CODE_OFFICIAL_SOURCE_URL}`;
        console.log(
          `   💡 Manual fix: ${fallbackCommand}`,
        );
        console.log(
          `   💡 Official source fallback: ${officialFallbackCommand}`,
        );
        ensureCocoIndexPostgresRuntime(envState.databaseUrlSource);
        return;
      }

      cocoindexCommand = ensureCocoIndexCommandShim(resolveCocoIndexCommand(pythonCommand), {
        pythonCommand,
      });

      try {
        if (!cocoindexCommand) {
          throw new Error("ccc command could not be resolved");
        }

        runCocoIndexReadinessChecks(cocoindexCommand, { projectCwd: process.cwd() });
        syncCocoIndexMcpEntryToTargetConfig(cocoindexCommand);
      } catch {
        console.log("   ⚠️ CocoIndex package installed, but command resolution failed.");
        console.log("   💡 Manual fix: run setup again or ensure Python user Scripts/bin is on PATH.");
      }

      ensureCocoIndexPostgresRuntime(envState.databaseUrlSource);
      persistCocoIndexRetentionState("ready-after-install", inspectCocoIndexRetentionState());
    },
  );
}

function findWingetPackageExecutable(packagePrefix, exeName) {
  if (process.platform !== "win32") return null;

  const packagesDir = path.join(
    os.homedir(),
    "AppData",
    "Local",
    "Microsoft",
    "WinGet",
    "Packages",
  );

  if (!fs.existsSync(packagesDir)) {
    return null;
  }

  const candidates = fs
    .readdirSync(packagesDir)
    .filter((name) => name.startsWith(packagePrefix));

  for (const dirName of candidates) {
    const full = path.join(packagesDir, dirName, exeName);
    if (fs.existsSync(full)) {
      return full;
    }
  }

  return null;
}

function ensureMarksmanLsp() {
  console.log("\n📝 Checking Marksman (Markdown LSP)...");

  const resolvedBeforeInstall = resolveMarksmanCommand();
  if (resolvedBeforeInstall && fs.existsSync(resolvedBeforeInstall)) {
    console.log(`   ✅ Marksman found: ${resolvedBeforeInstall}`);
    return;
  }

  if (commandExists("marksman")) {
    try {
      const version = execSync("marksman --version", {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5000,
      }).trim();
      console.log(`   ✅ Marksman found: ${version}`);
      return;
    } catch {
      console.log("   ✅ Marksman found in PATH.");
      return;
    }
  }

  if (process.platform === "win32") {
    if (!commandExists("winget")) {
      console.log("   ⚠️ winget not found. Please install Marksman manually.");
      return;
    }

    console.log("   ⚠️ Marksman not found. Installing via winget...");
    try {
      execSync(
        "winget install --id Artempyanykh.Marksman --source winget --accept-package-agreements --accept-source-agreements",
        { stdio: "inherit", timeout: 180000 },
      );
      const resolvedAfterInstall = resolveMarksmanCommand();
      if (resolvedAfterInstall && fs.existsSync(resolvedAfterInstall)) {
        console.log(`   ✅ Marksman ready: ${resolvedAfterInstall}`);
      } else {
        console.log("   ✅ Marksman install command completed.");
      }
    } catch (err) {
      const resolvedAfterFailure = resolveMarksmanCommand();
      if (resolvedAfterFailure && fs.existsSync(resolvedAfterFailure)) {
        console.log(
          "   ℹ️ winget returned non-zero, but Marksman is already present.",
        );
        console.log(`   ✅ Marksman ready: ${resolvedAfterFailure}`);
      } else {
        console.log(`   ❌ Failed to auto-install Marksman: ${err.message}`);
        console.log(
          "   💡 Manual install: winget install --id Artempyanykh.Marksman --source winget",
        );
      }
    }
    return;
  }

  if (commandExists("brew")) {
    try {
      console.log("   ⚠️ Marksman not found. Installing via brew...");
      execSync("brew install marksman", { stdio: "inherit", timeout: 180000 });
      console.log("   ✅ Marksman installation completed.");
      return;
    } catch {}
  }

  console.log("   ⚠️ Auto-install for Marksman is unavailable on this platform.");
  console.log("   💡 Install manually from https://github.com/artempyanykh/marksman/releases");
}

function resolveMarksmanCommand() {
  if (commandExists("marksman")) {
    return "marksman";
  }

  const wingetMarksman = findWingetPackageExecutable(
    "Artempyanykh.Marksman_",
    "marksman.exe",
  );
  if (wingetMarksman) {
    return wingetMarksman;
  }

  return "marksman";
}

function resolveTaploCommand() {
  if (commandExists("taplo")) {
    return "taplo";
  }

  // Check cargo bin directory
  const cargoBin = path.join(os.homedir(), ".cargo", "bin", process.platform === "win32" ? "taplo.exe" : "taplo");
  if (fs.existsSync(cargoBin)) {
    return cargoBin;
  }

  return "taplo";
}

function ensureTaploLsp() {
  console.log("\n📄 Checking Taplo (TOML LSP)...");

  if (commandExists("taplo")) {
    try {
      const version = execSync("taplo --version", {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5000,
      }).trim();
      console.log(`   ✅ Taplo found: ${version}`);
      return;
    } catch {
      console.log("   ✅ Taplo found in PATH.");
      return;
    }
  }

  const cargoBin = path.join(os.homedir(), ".cargo", "bin", process.platform === "win32" ? "taplo.exe" : "taplo");
  if (fs.existsSync(cargoBin)) {
    console.log(`   ✅ Taplo found: ${cargoBin}`);
    return;
  }

  if (commandExists("cargo")) {
    console.log("   ⚠️ Taplo not found. Installing via cargo...");
    try {
      execSync("cargo install taplo-cli --locked", { stdio: "inherit", timeout: 300000 });
      console.log("   ✅ Taplo installed.");
      return;
    } catch (err) {
      console.log(`   ❌ cargo install failed: ${err.message}`);
    }
  }

  if (commandExists("brew")) {
    console.log("   ⚠️ Taplo not found. Installing via brew...");
    try {
      execSync("brew install taplo", { stdio: "inherit", timeout: 180000 });
      console.log("   ✅ Taplo installed.");
      return;
    } catch (err) {
      console.log(`   ❌ brew install failed: ${err.message}`);
    }
  }

  console.log("   ⚠️ Could not auto-install Taplo (TOML LSP).");
  console.log("   💡 Install manually: https://taplo.tamasfe.dev/cli/installation/binary.html");
  console.log("      or: cargo install taplo-cli --locked");
}

const LEGACY_TASK_ALIAS_MAP = [
  { legacyAgent: "executor", targetCategory: "implementation" },
  { legacyAgent: "reviewer", targetCategory: "review" },
  { legacyAgent: "tester", targetCategory: "testing" },
  { legacyAgent: "security-auditor", targetCategory: "security" },
  { legacyAgent: "refactorer", targetCategory: "deep" },
  { legacyAgent: "doc-writer", targetCategory: "writing" },
];

function applyTaskCompatAliasLayer(config) {
  const next = JSON.parse(JSON.stringify(config));

  if (!next.categories || typeof next.categories !== "object") {
    next.categories = {};
  }
  if (!next.agents || typeof next.agents !== "object") {
    next.agents = {};
  }

  for (const { legacyAgent, targetCategory } of LEGACY_TASK_ALIAS_MAP) {
    const baseCategory =
      next.categories[targetCategory] && typeof next.categories[targetCategory] === "object"
        ? next.categories[targetCategory]
        : {};
    const legacyAgentConfig =
      next.agents[legacyAgent] && typeof next.agents[legacyAgent] === "object"
        ? next.agents[legacyAgent]
        : {};

    const resolvedModel = legacyAgentConfig.model || baseCategory.model;
    if (!resolvedModel) {
      continue;
    }

    const aliasCategory = {
      ...baseCategory,
      model: resolvedModel,
      comment: `Compat alias - legacy '${legacyAgent}' now maps to '${targetCategory}' category`,
    };

    if (legacyAgentConfig.variant || baseCategory.variant) {
      aliasCategory.variant = legacyAgentConfig.variant || baseCategory.variant;
    }

    next.categories[legacyAgent] = aliasCategory;

    delete next.agents[legacyAgent];
  }

  return next;
}

function applyRuntimeVariantBaselines(config) {
  const next = JSON.parse(JSON.stringify(config));

  const applyBaselines = (section, baselines) => {
    if (!section || typeof section !== "object") {
      return;
    }

    for (const [key, value] of Object.entries(section)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      if (value.variant) {
        continue;
      }

      const baselineVariant = baselines[key];
      if (baselineVariant) {
        value.variant = baselineVariant;
      }
    }
  };

  applyBaselines(next.agents, AGENT_VARIANT_BASELINES);
  applyBaselines(next.categories, CATEGORY_VARIANT_BASELINES);

  return next;
}

function buildFallbackModelChain(primaryModel) {
  if (!primaryModel || typeof primaryModel !== "string") {
    return [];
  }

  const fallbackCandidates = [];

  if (!primaryModel.startsWith("google/antigravity-claude")) {
    fallbackCandidates.push(ANTHROPIC_FALLBACK_MODEL);
  }

  fallbackCandidates.push(OPENAI_FALLBACK_MODEL);

  return fallbackCandidates.filter(
    (model, index) =>
      model !== primaryModel && fallbackCandidates.indexOf(model) === index,
  );
}

function applyRuntimeFallbackModelOverrides(config) {
  const next = JSON.parse(JSON.stringify(config));

  const applyFallbacks = (section) => {
    if (!section || typeof section !== "object") {
      return;
    }

    for (const value of Object.values(section)) {
      if (!value || typeof value !== "object") {
        continue;
      }

      if (Array.isArray(value.fallback_models) && value.fallback_models.length > 0) {
        continue;
      }

      const fallbackModels = buildFallbackModelChain(value.model);
      if (fallbackModels.length > 0) {
        value.fallback_models = fallbackModels;
      }
    }
  };

  applyFallbacks(next.agents);
  applyFallbacks(next.categories);

  return next;
}

function resolveTypeScriptLspCommand() {
  return ["typescript-language-server", "--stdio"];
}

function resolvePythonLspCommand() {
  return ["pyright-langserver", "--stdio"];
}

function resolvePowerShellExecutable(options = {}) {
  const {
    platform = process.platform,
    env = process.env,
    fallbackHome = os.homedir(),
    fsApi = fs,
    commandExistsFn = commandExists,
  } = options;

  if (commandExistsFn("pwsh")) {
    return "pwsh";
  }

  if (platform === "win32") {
    const candidateRoots = [
      env.ProgramFiles,
      env.ProgramW6432,
      env["ProgramFiles(x86)"],
      env.LOCALAPPDATA,
      env.APPDATA,
      env.USERPROFILE,
      env.HOME,
      env.HOMEDRIVE && env.HOMEPATH ? `${env.HOMEDRIVE}${env.HOMEPATH}` : null,
      fallbackHome,
    ].filter((value) => typeof value === "string" && value.trim().length > 0);

    const pwshCandidates = [
      ...candidateRoots.map((root) => path.win32.join(root, "PowerShell", "7", "pwsh.exe")),
      ...candidateRoots.map((root) =>
        path.win32.join(root, "Microsoft", "PowerShell", "7", "pwsh.exe"),
      ),
      ...candidateRoots.map((root) => path.win32.join(root, "scoop", "shims", "pwsh.exe")),
    ];

    for (const candidate of pwshCandidates) {
      if (fsApi.existsSync(candidate)) {
        return candidate;
      }
    }

    if (commandExistsFn("powershell")) {
      return "powershell";
    }

    if (commandExistsFn("powershell.exe")) {
      return "powershell.exe";
    }
  }

  return null;
}

function getPowerShellEditorServicesPaths() {
  return {
    installRoot: PSES_INSTALL_ROOT,
    currentDir: PSES_CURRENT_DIR,
    runtimeDir: PSES_RUNTIME_DIR,
    startScriptPath: path.join(PSES_CURRENT_DIR, PSES_START_SCRIPT_RELATIVE_PATH),
    logPath: path.join(PSES_RUNTIME_DIR, "logs"),
    sessionPath: path.join(PSES_RUNTIME_DIR, "session.json"),
  };
}

function getPowerShellEditorServicesState(options = {}) {
  const fsApi = options.fsApi || fs;
  const paths = getPowerShellEditorServicesPaths();
  const hasStartScript = fsApi.existsSync(paths.startScriptPath);
  const hasCurrentDir = fsApi.existsSync(paths.currentDir);
  const hasInstallRoot = fsApi.existsSync(paths.installRoot);
  const hasRuntimeDir = fsApi.existsSync(paths.runtimeDir);

  if (hasStartScript && hasCurrentDir) {
    return { kind: "healthy", paths };
  }

  if (hasInstallRoot || hasCurrentDir || hasRuntimeDir) {
    return { kind: "broken", paths };
  }

  return { kind: "missing", paths };
}

function escapePowerShellSingleQuotedString(value) {
  return String(value || "").replace(/'/g, "''");
}

function resolvePowerShellLspCommand() {
  const executable = resolvePowerShellExecutable();
  const paths = getPowerShellEditorServicesPaths();

  if (!executable || !fs.existsSync(paths.startScriptPath)) {
    return null;
  }

  return [
    executable,
    "-NoLogo",
    "-NoProfile",
    "-File",
    paths.startScriptPath,
    "-BundledModulesPath",
    paths.currentDir,
    "-LogPath",
    paths.logPath,
    "-SessionDetailsPath",
    paths.sessionPath,
    "-FeatureFlags",
    "@()",
    "-AdditionalModules",
    "@()",
    "-HostName",
    "OpenCode",
    "-HostProfileId",
    "opencode",
    "-HostVersion",
    CURRENT_SETUP_VERSION || "1.0.0",
    "-Stdio",
  ];
}

function ensurePowerShellEditorServices(forceUpdate = false, options = {}) {
  console.log("\n⚡ Checking PowerShell Editor Services...");

  const {
    fsApi = fs,
    execFile = execFileSync,
    resolveExecutable = resolvePowerShellExecutable,
    explicitRefresh = false,
    logger = console,
  } = options;

  const executable = resolveExecutable();
  if (!executable) {
    logger.warn(
      "   ⚠️  PowerShell executable not found. Skipping PowerShell Editor Services bootstrap.",
    );
    return false;
  }

  const psesState = getPowerShellEditorServicesState({ fsApi });
  const paths = psesState.paths;
  if (psesState.kind === "healthy" && !explicitRefresh) {
    if (forceUpdate) {
      logger.log(
        `   ✅ PowerShell Editor Services found and healthy; preserving local runtime during update: ${paths.startScriptPath}`,
      );
    } else {
      logger.log(`   ✅ PowerShell Editor Services found: ${paths.startScriptPath}`);
    }
    return true;
  }

  if (psesState.kind === "broken") {
    logger.warn(
      "   ⚠️  Existing PowerShell Editor Services runtime is incomplete; attempting repair/bootstrap.",
    );
  }

  fsApi.mkdirSync(paths.installRoot, { recursive: true });
  fsApi.mkdirSync(paths.runtimeDir, { recursive: true });

  const archivePath = path.join(paths.installRoot, PSES_ZIP_ASSET_NAME);
  const extractDir = path.join(paths.installRoot, "extract");
  const powershellScript =
    "$ErrorActionPreference = 'Stop'; " +
    `$installRoot = '${escapePowerShellSingleQuotedString(paths.installRoot)}'; ` +
    `$currentDir = '${escapePowerShellSingleQuotedString(paths.currentDir)}'; ` +
    `$runtimeDir = '${escapePowerShellSingleQuotedString(paths.runtimeDir)}'; ` +
    `$archivePath = '${escapePowerShellSingleQuotedString(archivePath)}'; ` +
    `$extractDir = '${escapePowerShellSingleQuotedString(extractDir)}'; ` +
    "New-Item -ItemType Directory -Path $installRoot -Force | Out-Null; " +
    "New-Item -ItemType Directory -Path $runtimeDir -Force | Out-Null; " +
    "if (Test-Path $archivePath) { Remove-Item $archivePath -Force -ErrorAction SilentlyContinue }; " +
    "if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue }; " +
    `$release = Invoke-RestMethod -Uri '${PSES_GITHUB_API_LATEST_RELEASE}' -Headers @{ 'User-Agent' = 'opencode-config-suites' }; ` +
    `$asset = $release.assets | Where-Object { $_.name -eq '${PSES_ZIP_ASSET_NAME}' } | Select-Object -First 1; ` +
    `if (-not $asset) { throw '${PSES_ZIP_ASSET_NAME} asset not found in latest release' }; ` +
    "Invoke-WebRequest -Uri $asset.browser_download_url -OutFile $archivePath -UseBasicParsing; " +
    "Expand-Archive -Path $archivePath -DestinationPath $extractDir -Force; " +
    "$startScript = Get-ChildItem -Path $extractDir -Recurse -Filter 'Start-EditorServices.ps1' | Where-Object { $_.FullName -like '*PowerShellEditorServices*' } | Select-Object -First 1; " +
    "if (-not $startScript) { throw 'Start-EditorServices.ps1 not found in extracted PowerShell Editor Services bundle' }; " +
    "$bundleRoot = Split-Path $startScript.Directory.FullName -Parent; " +
    "if (Test-Path $currentDir) { Remove-Item $currentDir -Recurse -Force }; " +
    "New-Item -ItemType Directory -Path $currentDir -Force | Out-Null; " +
    "Copy-Item -Path (Join-Path $bundleRoot '*') -Destination $currentDir -Recurse -Force; " +
    "Remove-Item $archivePath -Force -ErrorAction SilentlyContinue; " +
    "Remove-Item $extractDir -Recurse -Force -ErrorAction SilentlyContinue";

  const powershellArgs = executable.toLowerCase().includes("powershell")
    ? ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershellScript]
    : ["-NoLogo", "-NoProfile", "-Command", powershellScript];

  try {
    execFile(executable, powershellArgs, {
      stdio: "inherit",
      timeout: 300000,
    });
    logger.log(`   ✅ PowerShell Editor Services bootstrapped: ${paths.startScriptPath}`);
    return true;
  } catch (error) {
    logger.warn(
      `   ⚠️  Failed to bootstrap PowerShell Editor Services: ${error.message}`,
    );
    return false;
  }
}

function applyRuntimeLspOverrides(config, options = {}) {
  const next = JSON.parse(JSON.stringify(config));
  const {
    resolveTypeScriptCommand = resolveTypeScriptLspCommand,
    resolvePythonCommand = resolvePythonLspCommand,
    resolvePowerShellCommand = resolvePowerShellLspCommand,
  } = options;

  if (!next.lsp || typeof next.lsp !== "object") {
    next.lsp = {};
  }

  const marksmanCommand = resolveMarksmanCommand();
  next.lsp.markdown = {
    command: [marksmanCommand, "server"],
    extensions: [".md"],
  };

  next.lsp.toml = {
    command: [resolveTaploCommand(), "lsp", "stdio"],
    extensions: [".toml"],
  };

  next.lsp.typescript = {
    command: resolveTypeScriptCommand(),
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
  };

  next.lsp.python = {
    command: resolvePythonCommand(),
    extensions: [".py", ".pyi"],
  };

  const powershellCommand = resolvePowerShellCommand();
  if (Array.isArray(powershellCommand) && powershellCommand.length > 0) {
    next.lsp.powershell = {
      command: powershellCommand,
      extensions: [".ps1", ".psm1", ".psd1"],
    };
  }

  return next;
}

function enforceAuthProviderGuard(config) {
  const next = JSON.parse(JSON.stringify(config));
  next.google_auth = false;
  return next;
}

function splitPluginSpec(spec) {
  const value = String(spec || "").trim();
  if (!value) {
    return { name: "", version: "" };
  }

  if (value.includes("@file:") || value.includes("file://")) {
    return { name: value, version: "" };
  }

  if (value.startsWith("@")) {
    const secondAt = value.indexOf("@", 1);
    if (secondAt === -1) {
      return { name: value, version: "" };
    }
    return {
      name: value.slice(0, secondAt),
      version: value.slice(secondAt + 1),
    };
  }

  const firstAt = value.indexOf("@");
  if (firstAt === -1) {
    return { name: value, version: "" };
  }

  return {
    name: value.slice(0, firstAt),
    version: value.slice(firstAt + 1),
  };
}

function getNpmExecutableName() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function getNpxExecutableName() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function readPinnedOauthPluginVersions(pluginSpecs) {
  const resolved = {};
  const list = Array.isArray(pluginSpecs) ? pluginSpecs : [];

  for (const pluginSpec of list) {
    const parsed = splitPluginSpec(pluginSpec);
    if (!OAUTH_COMPATIBLE_PLUGIN_NAMES.includes(parsed.name)) {
      continue;
    }

    if (!parsed.version || parsed.version === "latest") {
      continue;
    }

    resolved[parsed.name] = parsed.version;
  }

  return resolved;
}

function resolvePublishedPluginVersion(packageName) {
  if (oauthCompatiblePluginVersionCache.has(packageName)) {
    return oauthCompatiblePluginVersionCache.get(packageName);
  }

  const npmCommands = [];

  const bunExecutable = resolveSetupBunExecutable({
    env: process.env,
    platform: process.platform,
    fallbackHome: os.homedir(),
    fsApi: fs,
  });
  const runtimeEnv = buildSetupRuntimeEnv({
    env: process.env,
    platform: process.platform,
    fallbackHome: os.homedir(),
    fsApi: fs,
  });
  if (bunExecutable) {
    npmCommands.push({
      command: bunExecutable,
      args: ["x", "npm", "view", packageName, "version", "--json"],
      options: {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
        env: runtimeEnv,
      },
    });
  }

  npmCommands.push({
    command: getNpmExecutableName(),
    args: ["view", packageName, "version", "--json"],
    options: {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
      env: runtimeEnv,
    },
  });

  let lastError = null;

  for (const npmCommand of npmCommands) {
    try {
      const raw = execFileSync(npmCommand.command, npmCommand.args, npmCommand.options).trim();
      const parsed = JSON.parse(raw);
      const version = typeof parsed === "string" ? parsed.trim() : "";
      const normalized = version || null;
      oauthCompatiblePluginVersionCache.set(packageName, normalized);
      return normalized;
    } catch (error) {
      lastError = error;
    }
  }

  const message = lastError && lastError.message ? lastError.message : String(lastError || "unknown error");
  console.warn(`⚠️  Failed to resolve plugin version for ${packageName}: ${message}`);
  oauthCompatiblePluginVersionCache.set(packageName, null);
  return null;
}

function resolveOauthCompatiblePluginVersions(previousPlugins = []) {
  const resolved = readPinnedOauthPluginVersions(previousPlugins);

  for (const packageName of OAUTH_COMPATIBLE_PLUGIN_NAMES) {
    if (resolved[packageName]) {
      continue;
    }

    const version = resolvePublishedPluginVersion(packageName);
    if (version) {
      resolved[packageName] = version;
    }
  }

  return resolved;
}

function enforceOauthCompatiblePluginStack(config, options = {}) {
  const next = JSON.parse(JSON.stringify(config));
  const plugins = Array.isArray(next.plugin) ? next.plugin : [];
  const versionMap = isPlainObject(options.versionMap)
    ? options.versionMap
    : resolveOauthCompatiblePluginVersions(options.previousPlugins);

  next.plugin = plugins.map((pluginSpec) => {
    const parsed = splitPluginSpec(pluginSpec);
    const pinnedVersion = versionMap[parsed.name];
    if (!pinnedVersion) {
      return pluginSpec;
    }
    return `${parsed.name}@${pinnedVersion}`;
  });

  return next;
}

const PROVIDER_RUNTIME_KEYS_TO_SKIP = new Set(["models"]);
const PROVIDER_RUNTIME_TOP_LEVEL_KEY_RE =
  /(^|[_-])(api[_-]?key|token|secret|password|authorization|auth|bearer)([_-]|$)|^(apiKey|api_key|authToken|accessToken|refreshToken|clientSecret|baseURL|baseUrl)$/i;
const MCP_CREDENTIAL_KEY_RE =
  /(^|[_-])(api[_-]?key|token|secret|password|authorization|auth|bearer)([_-]|$)|^(apiKey|api_key|authToken|accessToken|refreshToken|clientSecret|baseURL|baseUrl)$/i;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeProviderOptionKey(key) {
  const normalized = String(key || "").trim();
  if (/^api[_-]?key$/i.test(normalized)) return "apiKey";
  if (/^base[_-]?url$/i.test(normalized)) return "baseURL";
  return normalized;
}

function normalizeProviderConfigSchemaShape(providerConfig) {
  if (!isPlainObject(providerConfig)) {
    return clone(providerConfig);
  }

  const next = clone(providerConfig);
  const nextOptions = isPlainObject(next.options) ? clone(next.options) : {};
  let movedRuntimeKey = false;

  for (const [key, value] of Object.entries(providerConfig)) {
    if (!PROVIDER_RUNTIME_TOP_LEVEL_KEY_RE.test(key)) {
      continue;
    }

    const optionKey = normalizeProviderOptionKey(key);
    nextOptions[optionKey] = clone(value);
    delete next[key];
    movedRuntimeKey = true;
  }

  if (movedRuntimeKey) {
    next.options = nextOptions;
  }

  return next;
}

function mergeProviderRuntimeConfig(templateProvider) {
  return isPlainObject(templateProvider) ? clone(templateProvider) : {};
}

function mergeMcpCredentialFields(templateValue) {
  return isPlainObject(templateValue) ? clone(templateValue) : {};
}

function mergeMcpRuntimeConfig(templateMcp) {
  return isPlainObject(templateMcp) ? clone(templateMcp) : {};
}

function mergePluginArray(templatePlugins) {
  return Array.isArray(templatePlugins) ? [...templatePlugins] : [];
}

function applyRuntimeApiCredentialBackup(templateConfig) {
  const next = isPlainObject(templateConfig) ? clone(templateConfig) : {};
  next.provider = mergeProviderRuntimeConfig(next.provider);
  next.mcp = mergeMcpRuntimeConfig(next.mcp);
  next.plugin = mergePluginArray(next.plugin);
  return next;
}

function readExistingTargetOpencodeSnapshot() {
  if (!fs.existsSync(targetOpencodeJson)) {
    return {};
  }

  try {
    return loadJsonFile(targetOpencodeJson);
  } catch (error) {
    console.warn(
      `⚠️  Existing opencode.json is invalid; skipping snapshot read: ${error.message}`,
    );
    return {};
  }
}

function readExistingTargetOhMyOpencodeSnapshot() {
  // Read oh-my-openagent.json first (canonical), fall back to oh-my-opencode.json (legacy)
  // Users or plugins may edit either file, so we merge both to avoid losing customizations
  let canonical = {};
  let legacy = {};

  if (fs.existsSync(targetOhMyOpenagent)) {
    try {
      canonical = loadJsonFile(targetOhMyOpenagent);
    } catch (error) {
      console.warn(
        `⚠️  Existing oh-my-openagent.json is invalid; skipping: ${error.message}`,
      );
    }
  }

  if (fs.existsSync(targetOhMyOpencode)) {
    try {
      legacy = loadJsonFile(targetOhMyOpencode);
    } catch (error) {
      console.warn(
        `⚠️  Existing oh-my-opencode.json is invalid; skipping: ${error.message}`,
      );
    }
  }

  // If both are empty, return empty
  if (Object.keys(canonical).length === 0 && Object.keys(legacy).length === 0) {
    return {};
  }

  // If only one exists, return it
  if (Object.keys(canonical).length === 0) return legacy;
  if (Object.keys(legacy).length === 0) return canonical;

  // Both exist — merge: canonical wins for shared keys, but collect user-only agents/categories/lsp from both
  const merged = JSON.parse(JSON.stringify(canonical));

  // Merge agents from legacy that aren't in canonical
  if (isPlainObject(legacy.agents)) {
    if (!merged.agents) merged.agents = {};
    for (const [name, config] of Object.entries(legacy.agents)) {
      if (!(name in merged.agents)) {
        merged.agents[name] = config;
      }
    }
  }

  // Merge categories from legacy that aren't in canonical
  if (isPlainObject(legacy.categories)) {
    if (!merged.categories) merged.categories = {};
    for (const [name, config] of Object.entries(legacy.categories)) {
      if (!(name in merged.categories)) {
        merged.categories[name] = config;
      }
    }
  }

  // Merge LSP from legacy that aren't in canonical
  if (isPlainObject(legacy.lsp)) {
    if (!merged.lsp) merged.lsp = {};
    for (const [name, config] of Object.entries(legacy.lsp)) {
      if (!(name in merged.lsp)) {
        merged.lsp[name] = config;
      }
    }
  }

  return merged;
}

function mergeOhMyOpencodeWithExisting(builtConfig) {
  return JSON.parse(JSON.stringify(builtConfig));
}

function isManagedBackupNameForTarget(name, targetBaseName) {
  if (!targetBaseName || typeof name !== "string") {
    return name.endsWith(".bak") || /\.bak\d+$/.test(name) || name.includes(".bak.")
  }

  if (!name.startsWith(`${targetBaseName}.`)) {
    return false
  }

  return name.endsWith(".bak") || /\.bak\d+$/.test(name) || name.includes(".bak.")
}

function resolveManagedBackupDir(targetPath) {
  return path.join(path.dirname(targetPath), "backups")
}

function listManagedBackupFiles(dirPath, targetBaseName = null) {
  if (!fs.existsSync(dirPath)) {
    return []
  }

  return fs
    .readdirSync(dirPath)
    .filter((name) => isManagedBackupNameForTarget(name, targetBaseName))
    .map((name) => {
      const absolutePath = path.join(dirPath, name)
      const stats = fs.statSync(absolutePath)
      return {
        absolutePath,
        name,
        mtimeMs: stats.mtimeMs,
      }
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
}

function pruneManagedBackupFiles(dirPath, maxBackups = 2, targetBaseName = null, preservePaths = []) {
  const preserved = new Set(
    Array.isArray(preservePaths)
      ? preservePaths.map((entry) => path.resolve(String(entry || ""))).filter(Boolean)
      : [],
  )
  const backups = listManagedBackupFiles(dirPath, targetBaseName).filter(
    (entry) => !preserved.has(path.resolve(entry.absolutePath)),
  )
  backups.slice(maxBackups).forEach((entry) => {
    fs.rmSync(entry.absolutePath, { force: true })
  })
}

function migrateLegacyManagedBackupFiles(targetPath, backupDir) {
  const targetDir = path.dirname(targetPath)
  const targetBaseName = path.basename(targetPath)

  const legacyDirs = [targetDir, path.join(targetDir, "backup")]

  let movedCount = 0

  legacyDirs.forEach((legacyDir) => {
    if (!fs.existsSync(legacyDir) || path.normalize(legacyDir) === path.normalize(backupDir)) {
      return
    }

    fs.readdirSync(legacyDir).forEach((name) => {
      if (!isManagedBackupNameForTarget(name, targetBaseName)) {
        return
      }

      const legacyPath = path.join(legacyDir, name)
      const migratedPath = path.join(backupDir, name)

      if (legacyPath === migratedPath || !fs.existsSync(legacyPath)) {
        return
      }

      const stats = fs.statSync(legacyPath)
      if (!stats.isFile()) {
        return
      }

      if (fs.existsSync(migratedPath)) {
        fs.rmSync(legacyPath, { force: true })
        movedCount += 1
        return
      }

      fs.renameSync(legacyPath, migratedPath)
      movedCount += 1
    })

    if (legacyDir !== targetDir) {
      try {
        if (fs.readdirSync(legacyDir).length === 0) {
          fs.rmSync(legacyDir, { recursive: true, force: true })
        }
      } catch {}
    }
  })

  return movedCount
}

function normalizeManagedBackupFiles(targetPath, maxBackups = 2) {
  const backupDir = resolveManagedBackupDir(targetPath)
  fs.mkdirSync(backupDir, { recursive: true })
  migrateLegacyManagedBackupFiles(targetPath, backupDir)
  pruneManagedBackupFiles(backupDir, maxBackups, path.basename(targetPath))
  return backupDir
}

function createManagedBackup(targetPath, reason = "managed-replace", maxBackups = 2) {
  if (!fs.existsSync(targetPath)) {
    return null
  }

  const backupDir = normalizeManagedBackupFiles(targetPath, maxBackups)
  const backupSuffix = normalizeManagedBackupTimestamp()
  const backupPath = path.join(
    backupDir,
    `${path.basename(targetPath)}.${reason}.${backupSuffix}.bak`,
  )
  fs.copyFileSync(targetPath, backupPath)
  pruneManagedBackupFiles(backupDir, maxBackups - 1, path.basename(targetPath), [backupPath])
  return backupPath
}

function validateModelReferences(ohMyConfig, opencodeConfig) {
  if (!isPlainObject(ohMyConfig)) return 0;

  const providerConfig =
    isPlainObject(opencodeConfig) && isPlainObject(opencodeConfig.provider)
      ? opencodeConfig.provider
      : null;

  const modelRefs = [];

  if (isPlainObject(ohMyConfig.agents)) {
    for (const agentConfig of Object.values(ohMyConfig.agents)) {
      if (agentConfig && typeof agentConfig === "object" && typeof agentConfig.model === "string") {
        modelRefs.push(agentConfig.model);
      }
    }
  }

  if (isPlainObject(ohMyConfig.categories)) {
    for (const categoryConfig of Object.values(ohMyConfig.categories)) {
      if (
        categoryConfig &&
        typeof categoryConfig === "object" &&
        typeof categoryConfig.model === "string"
      ) {
        modelRefs.push(categoryConfig.model);
      }
    }
  }

  let orphanCount = 0;
  const warnedModelRefs = new Set();

  for (const modelRef of modelRefs) {
    if (typeof modelRef !== "string") continue;
    const slashIndex = modelRef.indexOf("/");
    if (slashIndex === -1) continue;

    const provider = modelRef.slice(0, slashIndex);
    const modelName = modelRef.slice(slashIndex + 1);
    if (!provider || !modelName) continue;

    const providerEntry =
      providerConfig && isPlainObject(providerConfig[provider])
        ? providerConfig[provider]
        : null;
    const modelExists =
      providerEntry &&
      isPlainObject(providerEntry.models) &&
      Object.prototype.hasOwnProperty.call(providerEntry.models, modelName);

    if (!modelExists) {
      orphanCount += 1;
      if (!warnedModelRefs.has(modelRef)) {
        warnedModelRefs.add(modelRef);
        console.warn(
          `⚠️  Agent/category references model ${modelRef} which is not defined in opencode.json providers`,
        );
      }
    }
  }

  return orphanCount;
}

function applyResourceModePolicy(config, resourceModeId) {
  const next = JSON.parse(JSON.stringify(config));
  const modePolicy = RESOURCE_MODE_POLICIES[resourceModeId];

  if (!modePolicy || typeof modePolicy !== "object") {
    return next;
  }

  const globalVariantMap =
    modePolicy.globalVariantMap && typeof modePolicy.globalVariantMap === "object"
      ? modePolicy.globalVariantMap
      : {};
  const roleVariantOverrides =
    modePolicy.roleVariantOverrides &&
    typeof modePolicy.roleVariantOverrides === "object"
      ? modePolicy.roleVariantOverrides
      : {};

  const applySectionPolicy = (section) => {
    if (!section || typeof section !== "object") return;
    for (const [key, value] of Object.entries(section)) {
      if (!value || typeof value !== "object") continue;

      const explicitVariant = roleVariantOverrides[key];
      if (explicitVariant) {
        value.variant = explicitVariant;
        continue;
      }

      if (value.variant && globalVariantMap[value.variant]) {
        value.variant = globalVariantMap[value.variant];
      }
    }
  };

  applySectionPolicy(next.agents);
  applySectionPolicy(next.categories);

  // Inject hardware-aware background task concurrency
  const concurrency = calcHardwareConcurrency(resourceModeId);
  if (!next.background_task || typeof next.background_task !== "object") {
    next.background_task = {};
  }
  next.background_task.defaultConcurrency = concurrency;

  return next;
}

function ensureGitHubCli() {
  console.log("\n🐙 Checking GitHub CLI...");

  if (commandExists("gh")) {
    try {
      const versionLine = execSync("gh --version", {
        encoding: "utf-8",
        stdio: "pipe",
        timeout: 5000,
      })
        .split("\n")[0]
        .trim();
      console.log(`   ✅ ${versionLine}`);
    } catch {
      console.log("   ✅ GitHub CLI found.");
    }

    try {
      execSync("gh auth status", { stdio: "ignore", timeout: 5000 });
      console.log("   ✅ GitHub CLI already authenticated.");
    } catch {
      console.log("   ℹ️ GitHub CLI not authenticated yet.");
      console.log("   💡 Run: gh auth login");
    }
    return;
  }

  if (process.platform === "win32" && commandExists("winget")) {
    console.log("   ⚠️ GitHub CLI not found. Installing via winget...");
    try {
      execSync(
        "winget install --id GitHub.cli --source winget --accept-package-agreements --accept-source-agreements",
        { stdio: "inherit", timeout: 180000 },
      );
      console.log("   ✅ GitHub CLI installation completed.");
      console.log("   💡 Next step: gh auth login");
      return;
    } catch (err) {
      console.log(`   ❌ Failed to auto-install GitHub CLI: ${err.message}`);
    }
  }

  console.log("   ⚠️ Auto-install for GitHub CLI is unavailable on this platform.");
  console.log("   💡 Install manually: https://cli.github.com/");
}

/**
 * Extract a short description from a profile config by analyzing models used.
 */
function getProfileDescription(profileName, filePath) {
  const manualDescription = PROFILE_DESCRIPTION_OVERRIDES[profileName];
  if (typeof manualDescription === "string" && manualDescription.trim()) {
    return manualDescription.trim();
  }

  try {
    const config = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const models = new Set();

    if (config.agents) {
      for (const agent of Object.values(config.agents)) {
        if (agent.model) {
          let name = agent.model.split("/").pop().replace("antigravity-", "");
          for (const item of MODEL_LABEL_REPLACEMENTS) {
            if (!item || typeof item !== "object") continue;
            if (!item.from || !item.to) continue;
            name = name.replace(item.from, item.to);
          }
          models.add(name);
        }
      }
    }

    if (models.size === 0) return "";
    return `[${[...models].join(", ")}]`;
  } catch {
    return "";
  }
}

function getProfileScopeHint(profileName) {
  if (profileName.endsWith("-all")) {
    return (
      PROFILE_SCOPE_HINTS.all ||
      SETUP_FALLBACKS.profileCatalog.profileScopeHints.all
    );
  }
  if (profileName.endsWith("-lead")) {
    return (
      PROFILE_SCOPE_HINTS.lead ||
      SETUP_FALLBACKS.profileCatalog.profileScopeHints.lead
    );
  }
  return (
    PROFILE_SCOPE_HINTS.mixed ||
    SETUP_FALLBACKS.profileCatalog.profileScopeHints.mixed
  );
}

function getStaleCachePaths() {
  const home = os.homedir();
  if (!home) {
    return [];
  }

  const paths = [
    path.join(home, ".cache", "opencode"),
  ];

  if (process.platform === "darwin") {
    paths.push(path.join(home, "Library", "Caches", "opencode"));
  }

  return [...new Set(paths)];
}

/**
 * Clean stale cache directories that might cause version conflicts.
 */
function cleanStaleCache() {
  const stalePaths = getStaleCachePaths();

  stalePaths.forEach((p) => {
    if (fs.existsSync(p)) {
      console.log(`\u{1F9F9} Cleaning stale cache: ${p}`);
      try {
        fs.rmSync(p, { recursive: true, force: true });
        console.log(`   \u2705 Removed ${p}`);
      } catch (e) {
        // Cache folder may be locked by a running opencode process — skip gracefully
        console.warn(`   \u26a0\ufe0f  Could not remove ${p} (in use or permission denied). Close OpenCode and retry if needed.`);
      }
    }
  });
}

/**
 * Ensure OpenCode CLI is installed globally via Bun.
 * Installs `opencode-ai` if `opencode` command is not found.
 */
function ensureOpencodeCli() {
  console.log("\n\u{1F680} Checking OpenCode CLI...");
  const opencodeHealthCommand = "opencode auth login --help";
  const opencodeCommandPresent = commandExists("opencode");

  try {
    execSync(opencodeHealthCommand, {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 8000,
    });
    console.log("   ✅ OpenCode CLI found (auth command reachable).");
  } catch {
    if (isInstallerSetupMode()) {
      console.log("   ℹ️  OpenCode CLI not found. Skipping global install in installer mode.");
      console.log("   ℹ️  Installer will verify/recover the opencode command after setup.");
      console.log(
        "   💡 If needed, run manually later: bun install -g opencode-ai",
      );
      console.log(
        "   💡 Tip: Run 'opencode' for TUI or 'opencode web --port 8080' for browser UI",
      );
      return;
    }
    const probeFailureReason = opencodeCommandPresent
      ? "health probe failed (timeout/context)"
      : "command not found";
    console.log(`   ⚠️  OpenCode CLI ${probeFailureReason}. Attempting recovery install...`);
    try {
      runCommandWithRetry("bun install -g opencode-ai", {
        cwd: targetDir,
        timeout: 120000,
        maxAttempts: 4,
        lockPath: targetDir,
        label: "bun install -g opencode-ai",
      });
      try {
        execSync(opencodeHealthCommand, {
          encoding: "utf-8",
          stdio: "pipe",
          timeout: 20000,
        });
        console.log("   ✅ OpenCode CLI installed (auth command reachable).");
      } catch {
        console.log("   ✅ OpenCode CLI recovery install completed (health probe timed out). Proceeding...");
      }
    } catch (err) {
      console.error(`   \u274C Failed to install OpenCode CLI: ${err.message}`);
      console.log("   \u{1F4A1} Try manually: bun install -g opencode-ai");
    }
  }

  console.log(
    "   \u{1F4A1} Tip: Run 'opencode' for TUI or 'opencode web --port 8080' for browser UI",
  );
}

/**
 * Enforce "Pure Config" state by removing node_modules and package files from target.
 */
function enforcePureConfig() {
  const itemsToRemove = [
    "package.json",
    "bun.lock",
    "bun.lockb",
    "pnpm-lock.yaml",
    "node_modules",
    "yarn.lock",
    "package-lock.json",
    "opencode-mem.jsonc",
  ];

  if (!isInstallerSetupMode()) {
    itemsToRemove.push("plugins");
  }

  console.log("\n\u{1F9F9} Enforcing Pure Config State...");
  itemsToRemove.forEach((item) => {
    const itemPath = path.join(targetDir, item);
    if (fs.existsSync(itemPath)) {
      try {
        fs.rmSync(itemPath, { recursive: true, force: true });
        console.log(`   \u2705 Removed ${item}`);
      } catch (e) {
        console.warn(`   \u26A0\uFE0F Failed to remove ${item}: ${e.message}`);
      }
    }
  });
}

function isLikelyLockError(error) {
  const msg = String(error?.message || error || "");
  return /(EBUSY|EFAULT|EPERM|ENOENT|resource busy|being used by another process|operation not permitted|Access is denied)/i.test(
    msg,
  );
}

function escapePowerShellLiteral(value) {
  return String(value).replace(/'/g, "''");
}

function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function stopWindowsLockingProcesses(lockPath) {
  if (process.platform !== "win32") return;

  const target = escapePowerShellLiteral(lockPath || targetDir);
  const launcherPid = Number(process.pid || 0);
  const script = `
    $target = '${target}'
    $launcherPid = ${launcherPid}
    $names = @('bun.exe','node.exe','opencode.exe','opencode-cli.exe','biome.exe')
    $self = $PID
    function Get-ParentProcessChain($processId) {
      $chain = @()
      $cursor = $processId
      for ($i = 0; $i -lt 8; $i++) {
        $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $cursor" -ErrorAction SilentlyContinue
        if (-not $proc) { break }
        $parent = [int]$proc.ParentProcessId
        if ($parent -le 0 -or $chain -contains $parent) { break }
        $chain += $parent
        $cursor = $parent
      }
      return $chain
    }
    $protected = @($self)
    if ($launcherPid -gt 0) {
      $protected += $launcherPid
      $protected += Get-ParentProcessChain -processId $launcherPid
    }
    $protected = $protected | Where-Object { $_ -gt 0 } | Select-Object -Unique
    $procs = Get-CimInstance Win32_Process | Where-Object {
      ($protected -notcontains $_.ProcessId) -and
      $_.Name -and
      ($names -contains $_.Name.ToLower()) -and
      $_.CommandLine -and
      ($_.CommandLine -like "*$target*" -or $_.CommandLine -like "*\\.config\\opencode*")
    }
    foreach ($p in $procs) {
      try {
        Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop
        Write-Output ("   🔧 Killed lock holder: " + $p.Name + " PID=" + $p.ProcessId)
      } catch {}
    }
  `;

  try {
    const encoded = Buffer.from(script, "utf16le").toString("base64");
    execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encoded}`, {
      stdio: "inherit",
      timeout: 15000,
    });
  } catch {
    // Best-effort lock remediation only
  }
}

function runCommandWithRetry(command, options = {}) {
  const {
    cwd = process.cwd(),
    env = process.env,
    timeout = 120000,
    maxAttempts = 4,
    lockPath = cwd,
    label = command,
  } = options;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      execSync(command, { cwd, env, stdio: "inherit", timeout });
      return;
    } catch (error) {
      const lockError = isLikelyLockError(error);
      const isLast = attempt === maxAttempts;

      if (process.platform === "win32" && lockError && !isLast) {
        if (isInstallerSetupMode()) {
          console.log(
            `   ℹ️  ${label} hit Windows file lock (attempt ${attempt}/${maxAttempts}). Retrying...`,
          );
        } else {
          console.warn(
            `   ⚠️  ${label} hit Windows file lock (attempt ${attempt}/${maxAttempts}). Retrying...`,
          );
        }
        stopWindowsLockingProcesses(lockPath);
        sleepMs(800 * attempt);
        continue;
      }

      if (!isLast) {
        if (isInstallerSetupMode()) {
          console.log(
            `   ℹ️  ${label} failed (attempt ${attempt}/${maxAttempts}). Retrying...`,
          );
        } else {
          console.warn(
            `   ⚠️  ${label} failed (attempt ${attempt}/${maxAttempts}). Retrying...`,
          );
        }
        sleepMs(800 * attempt);
        continue;
      }

      throw error;
    }
  }
}

function normalizeManagedBackupTimestamp(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  const hours = String(date.getHours()).padStart(2, "0")
  const minutes = String(date.getMinutes()).padStart(2, "0")
  const seconds = String(date.getSeconds()).padStart(2, "0")
  const milliseconds = String(date.getMilliseconds()).padStart(3, "0")

  return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}-${milliseconds}`
}

function hasLegacyDcpPruningKeys(rawConfigText) {
  const raw = String(rawConfigText || "");
  return /"pruningStrategies"\s*:/.test(raw);
}

function buildSafeDcpConfig() {
  return `${JSON.stringify({ "$schema": DCP_SCHEMA_URL }, null, 2)}\n`;
}

function commandLookupAvailable(commandLookup, command, env = process.env, platform = process.platform) {
  const result = commandLookup(command, env, platform);
  if (Array.isArray(result)) {
    return resolveCommandLookupResults(commandLookup, command, env, platform).length > 0
  }
  return Boolean(result);
}

function pathEntryMatches(entryValue, dirValue, platform = process.platform) {
  if (!entryValue || !dirValue) {
    return false;
  }

  const normalizedEntry = path.normalize(entryValue);
  const normalizedDir = path.normalize(dirValue);
  if (platform === "win32") {
    return normalizedEntry.toLowerCase() === normalizedDir.toLowerCase();
  }

  return normalizedEntry === normalizedDir;
}

function envPathIncludesDir(env, dirValue, platform = process.platform) {
  return String(env?.PATH || env?.Path || "")
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .some((entry) => pathEntryMatches(entry, dirValue, platform));
}

function resolveCompressionTargetRoots(options = {}) {
  const { homeDir, configHome, targetConfigDir } = resolveInstallerPathContract(options);

  return {
    homeDir,
    configHome,
    targetConfigDir,
  };
}

function resolveCompressionAdjunctPaths(options = {}) {
  const contract = resolveInstallerPathContract(options);

  return {
    nativeBinDir: contract.nativeBinDir,
    localBinDir: contract.localBinDir,
    bunBinDir: contract.bunBinDir,
    rtkExecutablePath: contract.rtkExecutablePath,
    rtkExecutablePaths: contract.rtkExecutablePaths,
    rtkPluginPath: contract.rtkPluginPath,
    cavemanSkillPath: contract.cavemanSkillPath,
  };
}

function resolveCompressionArtifactPaths(options = {}) {
  const contract = resolveInstallerPathContract(options);

  return {
    targetConfigDir: contract.targetConfigDir,
    dcpConfigPath: contract.dcpConfigPath,
    policyFilePath: contract.policyFilePath,
    projectionFilePath: contract.projectionFilePath,
  };
}

function resolvePathEnvKey(env = process.env) {
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path");
  return pathKey || "PATH";
}

function mergeWindowsPathValues(pathValue = "", pathAltValue = "") {
  const seen = new Set();
  const merged = [];

  for (const rawValue of [pathValue, pathAltValue]) {
    for (const entry of String(rawValue || "").split(path.delimiter)) {
      const trimmed = String(entry || "").trim();
      if (!trimmed) {
        continue;
      }
      const normalized = trimmed.replace(/[\\/]+$/, "").toLowerCase();
      if (seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      merged.push(trimmed);
    }
  }

  return merged.join(path.delimiter);
}

function resolveCommandLookupResults(commandLookup, command, env = process.env, platform = process.platform) {
  const result = commandLookup(command, env, platform);
  if (Array.isArray(result)) {
    return result.filter((entry) => {
      if (!shouldRejectCrossOsNodeTool(command, platform)) {
        return true
      }
      return !isWindowsMountedCommandPath(entry, platform)
    });
  }
  return result ? [command] : [];
}

function prependPathEntry(env, entry) {
  if (!entry) {
    return env;
  }

  const pathKey = resolvePathEnvKey(env);
  const currentPath =
    process.platform === "win32"
      ? mergeWindowsPathValues(env[pathKey] || env.PATH || "", env.Path || "")
      : env[pathKey] || env.PATH || env.Path || "";

  const nextPath = `${entry}${path.delimiter}${currentPath}`;
  const nextEnv = {
    ...env,
    [pathKey]: nextPath,
  };

  if (process.platform === "win32") {
    nextEnv.PATH = nextPath;
    nextEnv.Path = nextPath;
  }

  return nextEnv;
}

function buildSetupRuntimeEnv(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    fallbackHome = os.homedir(),
    fsApi = fs,
  } = options;

  const contract = resolveInstallerPathContract({ env, platform, fallbackHome });
  const bunBinDir = path.join(contract.homeDir, ".bun", "bin");

  let nextEnv = buildCompressionAdjunctEnv({ env, platform });
  for (const entry of [bunBinDir, contract.nativeBinDir, contract.localBinDir]) {
    if (entry && fsApi.existsSync(entry)) {
      nextEnv = prependPathEntry(nextEnv, entry);
    }
  }

  return nextEnv;
}

function buildCompressionAdjunctEnv(options = {}) {
  const { env = process.env, platform = process.platform } = options;
  const { homeDir, configHome, targetConfigDir } = resolveCompressionTargetRoots({
    env,
    platform,
  });

  return {
    ...env,
    HOME: homeDir,
    USERPROFILE: homeDir,
    XDG_CONFIG_HOME: configHome,
    OPENCODE_CONFIG_DIR: targetConfigDir,
    ...(platform === "win32"
      ? (() => {
          const mergedPath = mergeWindowsPathValues(env.PATH || "", env.Path || "")
          return {
            PATH: mergedPath,
            Path: mergedPath,
          }
        })()
      : {}),
  };
}

function ensureWindowsUserPathEntry(pathEntry, options = {}) {
  const {
    env = process.env,
    exec = execFileSync,
    fsApi = fs,
    log = console.log,
    platform = process.platform,
  } = options;

  if (platform !== "win32" || !pathEntry || !fsApi.existsSync(pathEntry)) {
    return env;
  }

  const pathKey = resolvePathEnvKey(env);
  const currentPath = mergeWindowsPathValues(env.PATH || "", env.Path || "");
  const normalizedTarget = pathEntry.trim().replace(/[\\/]+$/, "").toLowerCase();
  const hasPathEntry = currentPath
    .split(path.delimiter)
    .map((entry) => String(entry || "").trim().replace(/[\\/]+$/, "").toLowerCase())
    .includes(normalizedTarget);

  if (!hasPathEntry) {
    const nextPath = currentPath ? `${pathEntry}${path.delimiter}${currentPath}` : pathEntry;
    env[pathKey] = nextPath;
    env.PATH = nextPath;
    env.Path = nextPath;
    if (env === process.env) {
      process.env[pathKey] = nextPath;
      process.env.PATH = nextPath;
      process.env.Path = nextPath;
    }
  }

  const escapedPathEntry = pathEntry.replace(/'/g, "''");
  const persistPathCommand =
    "$pathEntry='" +
    escapedPathEntry +
    "'; " +
    "$userPath=[Environment]::GetEnvironmentVariable('Path','User'); " +
    "$entries=@(); if ($userPath) { $entries=$userPath -split ';' }; " +
    "$normalized=$pathEntry.TrimEnd('\\'); " +
    "$filtered=@(); foreach ($entry in $entries) { if ($entry -and ($entry.TrimEnd('\\') -ine $normalized)) { $filtered += $entry } }; " +
    "$nextEntries=@($pathEntry) + $filtered; " +
    "$next=($nextEntries -join ';'); " +
    "[Environment]::SetEnvironmentVariable('Path', $next, 'User')";

  runCompressionBootstrapCommand(
    "powershell.exe",
    ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", persistPathCommand],
    {
      exec,
      env,
      log,
      label: `Ensure Windows user PATH includes ${pathEntry}`,
    },
  );

  return env;
}

function resolveNativeUserHome(env = process.env) {
  if (env.OCS_NATIVE_USER_HOME) {
    return env.OCS_NATIVE_USER_HOME;
  }

  try {
    return os.userInfo().homedir || os.homedir();
  } catch {
    return os.homedir();
  }
}

function resolveSetupBunExecutable(options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    fallbackHome = os.homedir(),
    fsApi = fs,
  } = options;

  const { homeDir } = resolveInstallerPathContract({ env, platform, fallbackHome });
  const stableBunPath =
    platform === "win32"
      ? path.join(homeDir, ".bun", "bin", "bun.exe")
      : path.join(homeDir, ".bun", "bin", "bun");

  if (fsApi.existsSync(stableBunPath)) {
    return stableBunPath;
  }

  return resolveCommandPath("bun", platform) || "bun";
}

function syncRtkPluginIntoTarget(options = {}) {
  const { fsApi = fs, env = process.env, platform = process.platform, log = console.log } = options;
  if (typeof fsApi.copyFileSync !== "function" || typeof fsApi.mkdirSync !== "function") {
    return false;
  }

  const { rtkPluginPath } = resolveCompressionAdjunctPaths({ env, platform });
  if (fsApi.existsSync(rtkPluginPath)) {
    return true;
  }

  const nativeUserHome = resolveNativeUserHome(env);
  let osUserHome = "";
  try {
    osUserHome = os.userInfo().homedir || os.homedir();
  } catch {
    osUserHome = os.homedir();
  }

  const fallbackPluginCandidates = [nativeUserHome, osUserHome]
    .filter((candidate) => typeof candidate === "string" && candidate.trim().length > 0)
    .map((candidate) => path.join(candidate, ".config", "opencode", "plugins", "rtk.ts"));

  const fallbackPluginPath = [...new Set(fallbackPluginCandidates)].find(
    (candidate) => candidate !== rtkPluginPath && fsApi.existsSync(candidate),
  );
  if (!fallbackPluginPath) {
    return false;
  }

  fsApi.mkdirSync(path.dirname(rtkPluginPath), { recursive: true });
  fsApi.copyFileSync(fallbackPluginPath, rtkPluginPath);
  log(`   ✅ Synced RTK OpenCode hook into target config dir: ${rtkPluginPath}`);
  return fsApi.existsSync(rtkPluginPath);
}

function buildRtkShimPaths(options = {}) {
  const { env = process.env, platform = process.platform } = options;
  const { bunBinDir } = resolveCompressionAdjunctPaths({ env, platform });
  if (platform !== "win32") {
    return [];
  }

  return [path.join(bunBinDir, "rtk.cmd"), path.join(bunBinDir, "rtk.ps1")];
}

function syncRtkCommandShims(options = {}) {
  const { fsApi = fs, env = process.env, platform = process.platform, log = console.log } = options;
  const { rtkExecutablePath } = resolveCompressionAdjunctPaths({ env, platform });
  if (
    platform !== "win32"
    || !fsApi.existsSync(rtkExecutablePath)
    || typeof fsApi.writeFileSync !== "function"
    || typeof fsApi.mkdirSync !== "function"
  ) {
    return false;
  }

  const [cmdShimPath, ps1ShimPath] = buildRtkShimPaths({ env, platform });
  fsApi.mkdirSync(path.dirname(cmdShimPath), { recursive: true });
  const cmdShim = `@echo off\r\n\"${rtkExecutablePath}\" %*\r\n`;
  const escapedExecutable = rtkExecutablePath.replace(/"/g, '""');
  const ps1Shim = `& \"${escapedExecutable}\" @args\r\n`;

  fsApi.writeFileSync(cmdShimPath, cmdShim, "utf-8");
  fsApi.writeFileSync(ps1ShimPath, ps1Shim, "utf-8");
  log(`   ✅ Synced RTK command shims into ${path.dirname(cmdShimPath)}`);
  return fsApi.existsSync(cmdShimPath) && fsApi.existsSync(ps1ShimPath);
}

function findCavemanSkillSource(options = {}) {
  const { fsApi = fs, env = process.env, platform = process.platform } = options;
  const { homeDir } = resolveCompressionTargetRoots({ env, platform });
  const homesToSearch = [...new Set([
    homeDir,
    os.homedir(),
  ].filter((candidate) => typeof candidate === "string" && candidate.trim().length > 0))];

  for (const candidateHome of homesToSearch) {
    const agentsRoot = path.join(candidateHome, ".agents", "skills", "caveman");
    if (fsApi.existsSync(path.join(agentsRoot, "SKILL.md"))) {
      return agentsRoot;
    }

    const marketplaceRoots = [
      path.join(candidateHome, ".claude", "plugins", "marketplaces", "caveman", "skills", "caveman"),
      path.join(candidateHome, ".claude", "plugins", "marketplaces", "caveman", "plugins", "caveman", "skills", "caveman"),
    ];

    for (const candidate of marketplaceRoots) {
      if (fsApi.existsSync(path.join(candidate, "SKILL.md"))) {
        return candidate;
      }
    }

    const cacheRoot = path.join(candidateHome, ".claude", "plugins", "cache", "caveman", "caveman");
    if (!fsApi.existsSync(cacheRoot) || typeof fsApi.readdirSync !== "function") {
      continue;
    }

    const entries = fsApi.readdirSync(cacheRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry || !entry.isDirectory()) {
        continue;
      }

      const directCandidate = path.join(cacheRoot, entry.name, "skills", "caveman");
      if (fsApi.existsSync(path.join(directCandidate, "SKILL.md"))) {
        return directCandidate;
      }

      const pluginCandidate = path.join(cacheRoot, entry.name, "plugins", "caveman", "skills", "caveman");
      if (fsApi.existsSync(path.join(pluginCandidate, "SKILL.md"))) {
        return pluginCandidate;
      }
    }
  }

  return null;
}

function syncCavemanSkillIntoTarget(options = {}) {
  const { fsApi = fs, env = process.env, platform = process.platform, log = console.log } = options;
  if (typeof fsApi.cpSync !== "function" || typeof fsApi.mkdirSync !== "function") {
    return false;
  }

  const { cavemanSkillPath } = resolveCompressionAdjunctPaths({ env, platform });
  if (fsApi.existsSync(cavemanSkillPath)) {
    return true;
  }

  const sourceDir = findCavemanSkillSource({ fsApi, env, platform });
  if (!sourceDir) {
    return false;
  }

  const targetDir = path.dirname(cavemanSkillPath);
  fsApi.mkdirSync(path.dirname(targetDir), { recursive: true });
  fsApi.cpSync(sourceDir, targetDir, { recursive: true, force: true });
  log(`   ✅ Synced Caveman skill into target OpenCode skills dir: ${targetDir}`);
  return fsApi.existsSync(cavemanSkillPath);
}

function resolveRtkCommand(options = {}) {
  const {
    commandLookup = runCommandLookup,
    fsApi = fs,
    platform = process.platform,
    env = process.env,
  } = options;
  const { rtkExecutablePaths } = resolveCompressionAdjunctPaths({ env, platform });

  const lookupResults = resolveCommandLookupResults(commandLookup, "rtk", env);
  if (platform === "win32") {
    if (lookupResults.length === 0) {
      return null;
    }

    const managedCandidate = rtkExecutablePaths.find((candidate) => fsApi.existsSync(candidate));
    if (!managedCandidate) {
      return null;
    }

    const shimCandidates = buildRtkShimPaths({ env, platform })
      .filter((candidate) => fsApi.existsSync(candidate))
      .map((candidate) => path.normalize(candidate).toLowerCase());

    const winner = path.normalize(String(lookupResults[0] || ""));
    const managed = path.normalize(managedCandidate);
    const normalizedWinner = winner.toLowerCase();
    if (normalizedWinner !== managed.toLowerCase() && !shimCandidates.includes(normalizedWinner)) {
      return null;
    }

    return managedCandidate;
  }

  const managedCandidate = rtkExecutablePaths.find((candidate) => fsApi.existsSync(candidate));
  if (lookupResults.length > 0) {
    if (managedCandidate) {
      const winner = path.normalize(String(lookupResults[0] || ""));
      const managed = path.normalize(managedCandidate);
      if (winner !== managed) {
        return null;
      }
      return managedCandidate;
    }

    return platform === "win32" ? "rtk.exe" : "rtk";
  }

  if (managedCandidate) {
    if (pathEntryMatches(managedCandidate, rtkExecutablePaths[0], platform)) {
      return managedCandidate;
    }
    return null;
  }

  return null;
}

function verifyRtkRuntime(options = {}) {
  const {
    exec = execFileSync,
    env = process.env,
    fsApi = fs,
    commandLookup = runCommandLookup,
    platform = process.platform,
  } = options;
  const resolvedEnv = buildCompressionAdjunctEnv({ env, platform });
  const { nativeBinDir, bunBinDir, rtkExecutablePath, rtkPluginPath } = resolveCompressionAdjunctPaths({
    env: resolvedEnv,
    platform,
  });
  const hasManagedPath = envPathIncludesDir(resolvedEnv, nativeBinDir, platform)
    || envPathIncludesDir(resolvedEnv, bunBinDir, platform);
  const command = resolveRtkCommand({ commandLookup, fsApi, platform, env: resolvedEnv });
  const canProbeManagedBinary = hasManagedPath && fsApi.existsSync(rtkExecutablePath);
  if (platform === "win32" && !command) {
    return false;
  }
  if ((!command && !canProbeManagedBinary) || !fsApi.existsSync(rtkPluginPath)) {
    return false;
  }
  const probeCommand = command || rtkExecutablePath;

  try {
    exec(probeCommand, ["--version"], {
      env: resolvedEnv,
      stdio: "ignore",
      timeout: 120000,
    });
    exec(probeCommand, ["init", "--show"], {
      env: resolvedEnv,
      stdio: "ignore",
      timeout: 120000,
    });
    exec(probeCommand, ["gain"], {
      env: resolvedEnv,
      stdio: "ignore",
      timeout: 120000,
    });
    return true;
  } catch {
    return false;
  }
}

function verifyCavemanRuntime(options = {}) {
  const { fsApi = fs, env = process.env, platform = process.platform } = options;
  const { cavemanSkillPath } = resolveCompressionAdjunctPaths({ env, platform });
  return fsApi.existsSync(cavemanSkillPath);
}

function installNativeRtk(options = {}) {
  const {
    exec = execFileSync,
    env = process.env,
    commandLookup = runCommandLookup,
    log = console.log,
    platform = process.platform,
    fsApi = fs,
  } = options;
  const resolvedEnv = buildCompressionAdjunctEnv({ env, platform });
  const { nativeBinDir, rtkExecutablePath } = resolveCompressionAdjunctPaths({
    env: resolvedEnv,
    platform,
  });

  if (verifyRtkRuntime({ exec, env: resolvedEnv, fsApi, commandLookup, platform })) {
    return true;
  }

  fsApi.mkdirSync(nativeBinDir, { recursive: true });
  const runtimeEnv = prependPathEntry(resolvedEnv, nativeBinDir);

  if (platform === "win32") {
    const powershellCommand =
      "$ErrorActionPreference='Stop'; " +
      `$targetBinDir='${nativeBinDir.replace(/'/g, "''")}'; ` +
      `$archivePath=Join-Path $targetBinDir 'rtk-x86_64-pc-windows-msvc.zip'; ` +
      `$extractDir=Join-Path $targetBinDir 'rtk-extract'; ` +
      "New-Item -ItemType Directory -Force -Path $targetBinDir | Out-Null; " +
      "if (Test-Path $extractDir) { Remove-Item -Recurse -Force $extractDir }; " +
      `Invoke-WebRequest -Uri '${RTK_WINDOWS_ZIP_URL}' -OutFile $archivePath -UseBasicParsing; ` +
      "Expand-Archive -Path $archivePath -DestinationPath $extractDir -Force; " +
      "$rtkExe=Get-ChildItem -Path $extractDir -Recurse -Filter 'rtk.exe' | Select-Object -First 1; " +
      "if (-not $rtkExe) { throw 'rtk.exe not found in extracted archive' }; " +
      `Copy-Item $rtkExe.FullName '${rtkExecutablePath.replace(/'/g, "''")}' -Force; ` +
      "Remove-Item $archivePath -Force -ErrorAction SilentlyContinue; " +
      "Remove-Item -Recurse -Force $extractDir -ErrorAction SilentlyContinue";

    return runCompressionBootstrapCommand(
      "powershell.exe",
      ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", powershellCommand],
      {
        exec,
        env: runtimeEnv,
        log,
        label: "RTK native Windows install",
      },
    );
  }

  if (platform === "darwin" && commandLookupAvailable(commandLookup, "brew", runtimeEnv, platform)) {
    return runCompressionBootstrapCommand("brew", ["install", "rtk"], {
      exec,
      env: runtimeEnv,
      log,
      label: "RTK brew install",
    });
  }

  if (commandLookupAvailable(commandLookup, "curl", runtimeEnv, platform)) {
    return runCompressionBootstrapCommand(
      "sh",
      ["-c", `curl -fsSL \"${RTK_UNIX_INSTALL_URL}\" | sh`],
      {
        exec,
        env: runtimeEnv,
        log,
        label: "RTK upstream installer",
      },
    );
  }

  if (commandLookupAvailable(commandLookup, "cargo", runtimeEnv, platform)) {
    return runCompressionBootstrapCommand(
      "cargo",
      ["install", "--git", "https://github.com/rtk-ai/rtk"],
      {
        exec,
        env: runtimeEnv,
        log,
        label: "RTK cargo install",
      },
    );
  }

  if (isInstallerSetupMode()) {
    log("   ℹ️ RTK native install is unavailable on this platform during installer bootstrap.");
  } else {
    log("   ⚠️  RTK install skipped: no supported native installer command was found.");
  }
  return false;
}

function installNativeCaveman(options = {}) {
  const {
    exec = execFileSync,
    env = process.env,
    commandLookup = runCommandLookup,
    log = console.log,
    platform = process.platform,
    fsApi = fs,
  } = options;
  const resolvedEnv = buildCompressionAdjunctEnv({ env, platform });

  if (platform === "win32") {
    runCompressionBootstrapCommand(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        `irm ${CAVEMAN_WINDOWS_INSTALL_URL} | iex`,
      ],
      {
        exec,
        env: resolvedEnv,
        log,
        label: "Caveman native Windows install",
      },
    );
  } else if (commandLookupAvailable(commandLookup, "curl", resolvedEnv, platform)) {
    runCompressionBootstrapCommand(
      "sh",
      ["-c", `curl -fsSL \"${CAVEMAN_UNIX_INSTALL_URL}\" | bash`],
      {
        exec,
        env: resolvedEnv,
        log,
        label: "Caveman upstream installer",
      },
    );
  } else {
    log("   ⚠️  Caveman install skipped: curl is not available.");
  }

  if (!commandLookupAvailable(commandLookup, "npx", resolvedEnv, platform)) {
    log("   ⚠️  Caveman attach skipped: npx is not available.");
    return false;
  }

  const attachSucceeded = runCompressionBootstrapCommand(
    getNpxExecutableName(),
    [
      "-y",
      "skills",
      "add",
      "JuliusBrussee/caveman",
      "-a",
      "opencode",
      "-s",
      "*",
      "-g",
      "-y",
    ],
    {
      exec,
      env: resolvedEnv,
      log,
      label: "Caveman skill attach",
    },
  );

  const syncedToTarget = syncCavemanSkillIntoTarget({ fsApi, env: resolvedEnv, platform, log });
  if (!syncedToTarget && attachSucceeded) {
    log("   ⚠️  Caveman attach succeeded, but target marker is still missing after final sync attempt.");
  }
  return syncedToTarget;
}

function extractCompressionControlPlane(source) {
  if (isPlainObject(source?.controlPlane)) {
    return source.controlPlane;
  }

  if (isPlainObject(source?.compression)) {
    return source.compression;
  }

  return null;
}

function resolveCompressionExternalEngineStatus(options = {}) {
  return {
    dcp: COMPRESSION_EXTERNAL_ENGINE_STATUS.managed,
    rtk: options.rtkReady
      ? COMPRESSION_EXTERNAL_ENGINE_STATUS.managed
      : COMPRESSION_EXTERNAL_ENGINE_STATUS.missing,
    caveman: options.cavemanReady
      ? COMPRESSION_EXTERNAL_ENGINE_STATUS.managed
      : COMPRESSION_EXTERNAL_ENGINE_STATUS.missing,
  };
}

function buildCompressionPolicy(config, options = {}) {
  const compression = mergeObjectWithExistingPriority(
    extractCompressionControlPlane(config),
    DEFAULT_SETUP_RUNTIME_CONFIG.compression || {},
  );
  const artifacts = resolveCompressionArtifactPaths({
    env: options.env,
    platform: options.platform,
  });

  return {
    schemaVersion: 1,
    managedBy: "ocs",
    policyFilePath: artifacts.policyFilePath,
    compression,
  };
}

function buildCompressionProjection(config, options = {}) {
  const compression = buildCompressionPolicy(config, options).compression;
  const artifacts = resolveCompressionAdjunctPaths({
    env: options.env,
    platform: options.platform,
  });
  const artifactPaths = resolveCompressionArtifactPaths({
    env: options.env,
    platform: options.platform,
  });
  const externalEngineStatus =
    options.externalEngineStatus ||
    resolveCompressionExternalEngineStatus({
      rtkReady: options.rtkReady,
      cavemanReady: options.cavemanReady,
    });

  return {
    schemaVersion: 1,
    managedBy: "ocs",
    controlPlane: compression,
    runtime: {
      compactEngine: "dcp",
      commandPathPolicy:
        compression.routing?.autoCommandPathEngine || "rtk",
      prosePathPolicy:
        compression.routing?.autoProsePathEngine || "caveman",
      ambiguousIntent: compression.routing?.ambiguousIntent || "reject",
      unavailableEngineBehavior:
        compression.routing?.unavailableEngineBehavior || "error",
      externalEngineConfigStatus: externalEngineStatus,
    },
    artifacts: {
      policyFilePath: artifactPaths.policyFilePath,
      dcpConfigPath: artifactPaths.dcpConfigPath,
      projectionFilePath: artifactPaths.projectionFilePath,
      rtkPluginPath: artifacts.rtkPluginPath,
      cavemanSkillPath: artifacts.cavemanSkillPath,
    },
  };
}

function ensureCompressionPolicyFile(config, options = {}) {
  const artifacts = resolveCompressionArtifactPaths({
    env: options.env,
    platform: options.platform,
  });
  try {
    fs.mkdirSync(path.dirname(artifacts.policyFilePath), { recursive: true });
    fs.writeFileSync(
      artifacts.policyFilePath,
      `${JSON.stringify(buildCompressionPolicy(config, options), null, 2)}\n`,
      "utf-8",
    );
    console.log("✅ Updated ocs-compression.json (OCS compression policy)");
  } catch (error) {
    console.warn(
      `⚠️  Unable to update ocs-compression.json policy: ${error.message}`,
    );
  }
}

function ensureCompressionRoutingProjection(config, options = {}) {
  const artifacts = resolveCompressionArtifactPaths({
    env: options.env,
    platform: options.platform,
  });
  try {
    fs.mkdirSync(path.dirname(artifacts.projectionFilePath), { recursive: true });
    fs.writeFileSync(
      artifacts.projectionFilePath,
      `${JSON.stringify(buildCompressionProjection(config, options), null, 2)}\n`,
      "utf-8",
    );
    console.log("✅ Updated compression-routing.json (OCS compression projection)");
  } catch (error) {
    console.warn(
      `⚠️  Unable to update compression-routing.json projection: ${error.message}`,
    );
  }
}

function runCompressionBootstrapCommand(command, args, options = {}) {
  const {
    exec = execFileSync,
    cwd = targetDir,
    env = process.env,
    input,
    timeout = 120000,
    log = console.log,
    label = `${command} ${args.join(" ")}`,
  } = options;

  try {
    exec(command, args, {
      cwd,
      env,
      ...(input !== undefined ? { input } : {}),
      stdio: "inherit",
      timeout,
    });
    log(`   ✅ ${label}`);
    return true;
  } catch (error) {
    log(`   ⚠️  ${label} failed: ${error.message}`);
    return false;
  }
}

function ensureCompressionAdjunctEngines(options = {}) {
  const {
    installerMode = isInstallerSetupMode(),
    updateMode = false,
    platform = process.platform,
    env = process.env,
    commandLookup = runCommandLookup,
    exec = execFileSync,
    fsApi = fs,
    log = console.log,
  } = options;

  const shouldRepairRuntime = installerMode || updateMode;
  const { nativeBinDir } = resolveCompressionAdjunctPaths({ env, platform });

  if (platform === "win32" && shouldRepairRuntime) {
    ensureWindowsUserPathEntry(nativeBinDir, { env, exec, fsApi, log, platform });
  }

  let runtimeEnv = buildCompressionAdjunctEnv({ env, platform });
  syncRtkCommandShims({ fsApi, env: runtimeEnv, platform, log });

  let rtkReady = verifyRtkRuntime({ exec, env: runtimeEnv, fsApi, commandLookup, platform });
  let cavemanReady = verifyCavemanRuntime({ fsApi, env: runtimeEnv, platform });

  const progressMessenger = createProgressMessenger({
    channel: "install",
    scenario: "runtimeBootstrap",
    enabled: shouldRepairRuntime && (!rtkReady || !cavemanReady),
    log,
  });
  progressMessenger.start();

  try {
    if (shouldRepairRuntime && !rtkReady) {
      installNativeRtk({ exec, env: runtimeEnv, commandLookup, log, platform, fsApi });
      if (platform === "win32") {
        ensureWindowsUserPathEntry(nativeBinDir, { env, exec, fsApi, log, platform });
      }
      const resolvedEnv = buildCompressionAdjunctEnv({ env, platform });
      runtimeEnv = prependPathEntry(
        resolvedEnv,
        resolveCompressionAdjunctPaths({ env: resolvedEnv, platform }).nativeBinDir,
      );
      const rtkCommand = resolveRtkCommand({ commandLookup, fsApi, platform, env: runtimeEnv });
      if (rtkCommand) {
        runCompressionBootstrapCommand(rtkCommand, ["init", "-g", "--opencode"], {
          exec,
          env: runtimeEnv,
          input: "y\n",
          log,
          label: "RTK init -g --opencode",
        });
      }
      syncRtkCommandShims({ fsApi, env: runtimeEnv, platform, log });
      const rtkPluginSynced = syncRtkPluginIntoTarget({ fsApi, env: runtimeEnv, platform, log });
      if (!rtkPluginSynced) {
        log("   ⚠️  RTK init completed, but target rtk.ts hook is still missing.");
      }
      runtimeEnv = buildCompressionAdjunctEnv({ env, platform });
      rtkReady = verifyRtkRuntime({ exec, env: runtimeEnv, fsApi, commandLookup, platform });
    }

    if (shouldRepairRuntime && !cavemanReady) {
      const resolvedEnv = buildCompressionAdjunctEnv({ env, platform });
      const syncedExistingSkill = syncCavemanSkillIntoTarget({
        fsApi,
        env: resolvedEnv,
        platform,
        log,
      });

      if (!syncedExistingSkill) {
        installNativeCaveman({ exec, env: resolvedEnv, commandLookup, log, platform, fsApi });
      }

      if (!syncCavemanSkillIntoTarget({ fsApi, env: resolvedEnv, platform, log })) {
        log("   ⚠️  Caveman target marker is still missing after final reconcile attempt.");
      }

      cavemanReady = verifyCavemanRuntime({ fsApi, env: resolvedEnv, platform });
      if (cavemanReady) {
        log("   ✅ Caveman skill marker present after native attach.");
      } else {
        log("   ⚠️  Caveman attach completed, but no skill marker was found yet.");
      }
    }

    return resolveCompressionExternalEngineStatus({ rtkReady, cavemanReady });
  } finally {
    progressMessenger.stop();
  }
}

function finalizeProfileRuntimeConvergence(existingCompressionState, options = {}) {
  const {
    env = process.env,
    platform = process.platform,
    updateMode = forceUpdate,
    syncSkills = syncProjectSkillsToTarget,
    ensureScaffold = ensureUserExtensionScaffold,
    ensurePolicy = ensureCompressionPolicyFile,
    ensureAdjuncts = ensureCompressionAdjunctEngines,
    ensureProjection = ensureCompressionRoutingProjection,
    ensureDcpCompatibility = ensureDcpConfigCompatibility,
  } = options;

  syncSkills();
  ensureScaffold();
  ensurePolicy(existingCompressionState, { env, platform });
  const compressionExternalEngineStatus = ensureAdjuncts({
    updateMode,
    env,
    platform,
  });
  ensureProjection(existingCompressionState, {
    env,
    platform,
    externalEngineStatus: compressionExternalEngineStatus,
  });
  ensureDcpCompatibility({ env, platform });
  return compressionExternalEngineStatus;
}

function readExistingCompressionState(existingOpencodeSnapshot = {}, options = {}) {
  const artifacts = resolveCompressionArtifactPaths({
    env: options.env,
    platform: options.platform,
  });

  if (fs.existsSync(artifacts.policyFilePath)) {
    try {
      const policy = loadJsonFile(artifacts.policyFilePath);
      if (extractCompressionControlPlane(policy)) {
        return policy;
      }
    } catch (error) {
      console.warn(
        `⚠️  Existing ocs-compression.json is invalid; falling back to projection or legacy runtime state: ${error.message}`,
      );
    }
  }

  if (fs.existsSync(artifacts.projectionFilePath)) {
    try {
      const projection = loadJsonFile(artifacts.projectionFilePath);
      if (extractCompressionControlPlane(projection)) {
        return projection;
      }
    } catch (error) {
      console.warn(
        `⚠️  Existing compression-routing.json is invalid; falling back to legacy runtime state: ${error.message}`,
      );
    }
  }

  return existingOpencodeSnapshot;
}

function ensureDcpConfigCompatibility(options = {}) {
  const artifacts = resolveCompressionArtifactPaths({
    env: options.env,
    platform: options.platform,
  });
  const dcpConfigPath = artifacts.dcpConfigPath;

  if (!fs.existsSync(dcpConfigPath)) {
    try {
      fs.mkdirSync(path.dirname(dcpConfigPath), { recursive: true });
      fs.writeFileSync(dcpConfigPath, buildSafeDcpConfig(), "utf-8");
      console.log("✅ Seeded dcp.jsonc with safe DCP schema defaults.");
    } catch (error) {
      console.warn(`⚠️  Unable to seed dcp.jsonc defaults: ${error.message}`);
    }
    return;
  }

  try {
    const raw = fs.readFileSync(dcpConfigPath, "utf-8");
    if (!hasLegacyDcpPruningKeys(raw)) {
      return;
    }

    const backupPath = createManagedBackup(
      dcpConfigPath,
      "legacy-pruning-strategies",
      2,
    );
    fs.writeFileSync(dcpConfigPath, buildSafeDcpConfig(), "utf-8");
    console.log(
      `✅ Repaired dcp.jsonc legacy pruning keys (backup saved: ${backupPath ? path.basename(backupPath) : "none"})`,
    );
    console.log(
      "   ℹ️  Legacy key 'pruningStrategies' is no longer valid. Use modern DCP keys under 'compress' and 'strategies'.",
    );
  } catch (error) {
    console.warn(`⚠️  Unable to auto-repair dcp.jsonc compatibility: ${error.message}`);
  }
}

function packLocalPlugin(cwd, filename) {
  const dest = cwd.replace(/\\/g, "/");
  const quotedDest = `\"${dest}\"`;
  const quotedName = `\"${filename}\"`;
  const commands = [
    `bun pm pack --destination ${quotedDest} --filename ${quotedName}`,
    `npm pack`,
  ];

  for (const command of commands) {
    try {
      execSync(command, {
        cwd,
        stdio: "pipe",
        timeout: 120000,
      });
      return;
    } catch (error) {
      const isLast = command === commands[commands.length - 1];
      if (isLast) {
        throw error;
      }
    }
  }
}

/**
 * Install plugins declared in opencode.json by running `bun install`
 * in the target config directory. OpenCode resolves plugins from node_modules
 * in ~/.config/opencode, so installation is required after each deploy.
 */
function installPlugins() {
  console.log("\n📦 Installing plugins...");
  try {
    // Read plugin list from deployed opencode.json
    const opencodeConfig = loadJsonFile(targetOpencodeJson);
    const plugins = Array.isArray(opencodeConfig.plugin) ? opencodeConfig.plugin : [];

    if (plugins.length === 0) {
      console.log("   ℹ️  No plugins declared in opencode.json, skipping.");
      return;
    }

    const dependencies = buildPluginInstallDependencies(plugins);

    // Write minimal package.json to target dir
    const pkgJson = { dependencies };
    fs.writeFileSync(
      path.join(targetDir, "package.json"),
      JSON.stringify(pkgJson, null, 2),
    );

    const runtimeEnv = buildSetupRuntimeEnv({
      env: process.env,
      platform: process.platform,
      fallbackHome: os.homedir(),
      fsApi: fs,
    });
    const bunExecutable = resolveSetupBunExecutable({
      env: runtimeEnv,
      platform: process.platform,
      fallbackHome: os.homedir(),
      fsApi: fs,
    });
    const bunInstallCommand = `${quoteShellPath(bunExecutable)} install`;

    // Run bun install with lock-aware retries
    runWithProgress(
      {
        channel: "install",
        scenario: "dependencyInstall",
      },
      () => {
        runCommandWithRetry(bunInstallCommand, {
          cwd: targetDir,
          env: runtimeEnv,
          timeout: 180000,
          maxAttempts: 5,
          lockPath: targetDir,
          label: "bun install (plugins)",
        });
      },
    );
    const pluginRuntimeDir = path.join(targetDir, "plugins", "opencode-multi-auth");
    if (writePluginInstallFingerprintMarker(pluginRuntimeDir)) {
      console.log("   ✅ Wrote plugin dependency fingerprint marker.");
    }
    console.log("   ✅ Plugins installed successfully.");
  } catch (err) {
    console.warn(`   ⚠️  Plugin installation failed: ${err.message}`);
    console.warn("   💡 Try manually: cd ~/.config/opencode && bun install");
  }
}

function loadLocalMultiAuthDependencies() {
  const pluginRoot = resolveMultiAuthPluginRoot();
  if (!pluginRoot) return {};

  const packagePath = path.join(pluginRoot, "package.json");
  if (!fs.existsSync(packagePath)) return {};

  try {
    const pkg = loadJsonFile(packagePath);
    const deps = pkg?.dependencies || {};
    if (!deps || typeof deps !== "object") return {};
    return deps;
  } catch {
    return {};
  }
}

function resolveMultiAuthDistPath() {
  const bundledPluginDist = path.resolve(
    __dirname,
    "..",
    "plugins",
    "opencode-multi-auth",
    "dist",
    "index.js",
  );
  const bundledRootDist = path.resolve(__dirname, "..", "dist", "index.js");
  const targetBundledPluginDist = path.join(
    targetDir,
    "plugins",
    "opencode-multi-auth",
    "dist",
    "index.js",
  );
  const candidates = [
    bundledPluginDist,
    bundledRootDist,
    path.resolve(process.cwd(), "plugins", "opencode-multi-auth", "dist", "index.js"),
    path.resolve(process.cwd(), "dist", "index.js"),
  ];

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;

    let pointsToTargetBundledPlugin = false;
    try {
      const candidateRealPath = fs.realpathSync(candidate);
      const targetRealPath = fs.realpathSync(targetBundledPluginDist);
      pointsToTargetBundledPlugin = candidateRealPath === targetRealPath;
    } catch {
      pointsToTargetBundledPlugin = false;
    }

    if (pointsToTargetBundledPlugin && candidate !== bundledRootDist) {
      if (fs.existsSync(bundledRootDist)) {
        return bundledRootDist;
      }
    }

    return candidate;
  }

  return null;
}

function resolveMultiAuthPluginRoot() {
  const bundledPackageDir = getBundledMultiAuthPackageDir();
  if (
    fs.existsSync(path.join(bundledPackageDir, "package.json")) &&
    fs.existsSync(path.join(bundledPackageDir, "dist", "index.js"))
  ) {
    return bundledPackageDir;
  }

  const distPath = resolveMultiAuthDistPath();
  if (!distPath) return null;
  return path.dirname(path.dirname(distPath));
}

function resolveOpenAiAuthPluginRoot() {
  const candidates = [
    path.resolve(__dirname, "..", "plugins", "opencode-openai-auth"),
    path.resolve(process.cwd(), "plugins", "opencode-openai-auth"),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, "index.js"))) {
      return candidate;
    }
  }

  return null;
}

function getBundledMultiAuthPackageDir() {
  return path.join(targetDir, "plugins", "opencode-multi-auth");
}

function getBundledOpenAiAuthPluginDir() {
  return path.join(targetDir, "plugins", "opencode-openai-auth");
}

function syncOcsRuntimeAssetsToTarget(options = {}) {
  const {
    fsApi = fs,
    sourceRoot = path.join(__dirname, ".."),
    targetRoot = targetDir,
    log = console.log,
  } = options;

  const normalizedSourceRoot = path.resolve(sourceRoot);
  const normalizedTargetRoot = path.resolve(targetRoot);
  if (normalizedSourceRoot === normalizedTargetRoot) {
    log("   ℹ️ OCS runtime assets already aligned at target config directory.");
    return;
  }

  const runtimeCopies = [
    [path.join(sourceRoot, "bin"), path.join(targetRoot, "bin"), "dir"],
    [path.join(sourceRoot, "configs"), path.join(targetRoot, "configs"), "dir"],
    [path.join(sourceRoot, "scripts", "constants"), path.join(targetRoot, "scripts", "constants"), "dir"],
    [path.join(sourceRoot, "scripts", "setup.js"), path.join(targetRoot, "scripts", "setup.js"), "file"],
    [path.join(sourceRoot, "scripts", "progress-messenger.cjs"), path.join(targetRoot, "scripts", "progress-messenger.cjs"), "file"],
    [path.join(sourceRoot, "scripts", "ocs-index.js"), path.join(targetRoot, "scripts", "ocs-index.js"), "file"],
    [path.join(sourceRoot, "scripts", "cocoindex-mcp-bridge.cjs"), path.join(targetRoot, "scripts", "cocoindex-mcp-bridge.cjs"), "file"],
    [path.join(sourceRoot, "scripts", "prefs-wizard.js"), path.join(targetRoot, "scripts", "prefs-wizard.js"), "file"],
    [path.join(sourceRoot, "scripts", "exa-setup.js"), path.join(targetRoot, "scripts", "exa-setup.js"), "file"],
    [path.join(sourceRoot, "BUILD_PROVENANCE.json"), path.join(targetRoot, "BUILD_PROVENANCE.json"), "file"],
    [path.join(sourceRoot, "package.json"), path.join(targetRoot, "package.json"), "file"],
  ];

  for (const [sourcePath, targetPath, entryType] of runtimeCopies) {
    if (!fsApi.existsSync(sourcePath)) {
      continue;
    }

    const normalizedSourcePath = path.resolve(sourcePath);
    const normalizedTargetPath = path.resolve(targetPath);
    if (normalizedSourcePath === normalizedTargetPath) {
      continue;
    }

    fsApi.mkdirSync(path.dirname(targetPath), { recursive: true });
    if (entryType === "dir") {
      fsApi.rmSync(targetPath, { recursive: true, force: true });
      fsApi.cpSync(sourcePath, targetPath, { recursive: true, force: true });
    } else {
      fsApi.copyFileSync(sourcePath, targetPath);
    }
  }

  log("   ✅ Synced OCS runtime assets into target config directory.");
}

function hasPluginEntry(pluginEntries, matcher) {
  return pluginEntries.some(
    (entry) => typeof entry === "string" && matcher(entry),
  );
}

function shouldKeepMultiAuthPluginDir(pluginEntries) {
  return hasPluginEntry(
    pluginEntries,
    (entry) =>
      entry === "opencode-multi-auth" ||
      entry.startsWith("opencode-multi-auth@") ||
      entry.includes("opencode-multi-auth/dist/") ||
      entry.includes("/plugins/opencode-multi-auth/"),
  );
}

function shouldKeepOpenAiAuthPluginDir(pluginEntries) {
  return hasPluginEntry(
    pluginEntries,
    (entry) =>
      entry === "opencode-openai-auth" ||
      entry.startsWith("opencode-openai-auth@") ||
      entry.includes("/plugins/opencode-openai-auth/") ||
      entry.includes("opencode-openai-auth/index.js"),
  );
}

function cleanupStaleAuthPluginDirs(config) {
  const pluginEntries = Array.isArray(config?.plugin) ? config.plugin : [];
  const pluginsRoot = path.join(targetDir, "plugins");

  fs.mkdirSync(pluginsRoot, { recursive: true });

  const stalePluginDirs = [];

  if (!shouldKeepOpenAiAuthPluginDir(pluginEntries)) {
    stalePluginDirs.push(path.join(pluginsRoot, "opencode-openai-auth"));
  }

  if (!shouldKeepMultiAuthPluginDir(pluginEntries)) {
    stalePluginDirs.push(path.join(pluginsRoot, "opencode-multi-auth"));
  }

  for (const staleDir of stalePluginDirs) {
    if (!fs.existsSync(staleDir)) continue;
    fs.rmSync(staleDir, { recursive: true, force: true });
    console.log(`   ✅ Removed stale plugin directory: ${staleDir}`);
  }
}

function readBundledPackageVersion(packageDir) {
  const packagePath = path.join(packageDir, "package.json");
  if (!fs.existsSync(packagePath)) return null;

  try {
    const pkg = loadJsonFile(packagePath);
    if (pkg && typeof pkg.version === "string" && pkg.version.trim()) {
      return pkg.version.trim();
    }
  } catch {
    return null;
  }

  return null;
}

function getBundledOpenAiAuthTarballPath() {
  const version = readBundledPackageVersion(getBundledOpenAiAuthPluginDir());

  const tarballName = version
    ? `opencode-openai-auth-${version}.tgz`
    : "opencode-openai-auth.tgz";

  return path.join(getBundledOpenAiAuthPluginDir(), tarballName);
}

function getBundledMultiAuthTarballPath() {
  const version = readBundledPackageVersion(getBundledMultiAuthPackageDir());

  const tarballName = version
    ? `opencode-multi-auth-${version}.tgz`
    : "opencode-multi-auth.tgz";

  return path.join(getBundledMultiAuthPackageDir(), tarballName);
}

function toDirectoryFileUrl(dirPath) {
  const normalizedPath = dirPath.endsWith(path.sep)
    ? dirPath
    : `${dirPath}${path.sep}`;
  return pathToFileURL(normalizedPath).href;
}

function resolveBundledSkillsDir() {
  const candidates = [
    path.join(process.cwd(), ".opencode", "skills"),
    sourceProjectSkillsDir,
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function getBundledSkillNames(skillsDir = resolveBundledSkillsDir()) {
  if (!skillsDir || !fs.existsSync(skillsDir)) {
    return [];
  }

  return fs
    .readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => SKILL_NAME_PATTERN.test(name))
    .filter((name) => fs.existsSync(path.join(skillsDir, name, "SKILL.md")))
    .sort((a, b) => a.localeCompare(b));
}

function readManagedSkillsManifest() {
  if (!fs.existsSync(targetManagedSkillsManifestPath)) {
    return [];
  }

  try {
    const parsed = loadJsonFile(targetManagedSkillsManifestPath);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => String(value || "").trim())
      .filter((value) => SKILL_NAME_PATTERN.test(value));
  } catch {
    return [];
  }
}

function cleanupDuplicateTargetSkillsShadow(fsApi = fs) {
  const duplicateSkillsDir = path.join(targetDir, ".opencode", "skills");
  const duplicateRootDir = path.dirname(duplicateSkillsDir);

  if (fsApi.existsSync(duplicateSkillsDir)) {
    fsApi.rmSync(duplicateSkillsDir, {
      recursive: true,
      force: true,
    });
  }

  if (!fsApi.existsSync(duplicateRootDir)) {
    return;
  }

  try {
    const entries = fsApi.readdirSync(duplicateRootDir, { withFileTypes: true });
    if (entries.length === 0) {
      fsApi.rmSync(duplicateRootDir, { recursive: true, force: true });
    }
  } catch {
    // best-effort cleanup only
  }
}

function syncProjectSkillsToTarget() {
  const bundledSkillsDir = resolveBundledSkillsDir();
  const nextSkillNames = getBundledSkillNames(bundledSkillsDir);
  const previousSkillNames = readManagedSkillsManifest();
  const duplicateSkillsDir = path.join(targetDir, ".opencode", "skills");
  const shouldCleanupBeforeSync =
    !bundledSkillsDir || path.resolve(bundledSkillsDir) !== path.resolve(duplicateSkillsDir);

  if (shouldCleanupBeforeSync) {
    cleanupDuplicateTargetSkillsShadow();
  }
  fs.mkdirSync(targetSkillsDir, { recursive: true });

  const staleSkillNames = previousSkillNames.filter(
    (skillName) => !nextSkillNames.includes(skillName),
  );

  for (const staleSkillName of staleSkillNames) {
    fs.rmSync(path.join(targetSkillsDir, staleSkillName), {
      recursive: true,
      force: true,
    });
  }

  if (!bundledSkillsDir || nextSkillNames.length === 0) {
    fs.writeFileSync(targetManagedSkillsManifestPath, "[]\n");
    if (!isInstallerSetupMode()) {
      console.log("   ℹ️  No bundled OCS skills found. Cleared managed skill registry.");
    }
    return;
  }

  for (const skillName of nextSkillNames) {
    const sourceSkillPath = path.join(bundledSkillsDir, skillName);
    const targetSkillPath = path.join(targetSkillsDir, skillName);
    fs.rmSync(targetSkillPath, { recursive: true, force: true });
    fs.cpSync(sourceSkillPath, targetSkillPath, { recursive: true, force: true });
  }

  fs.writeFileSync(
    targetManagedSkillsManifestPath,
    `${JSON.stringify(nextSkillNames, null, 2)}\n`,
  );
  if (!shouldCleanupBeforeSync) {
    cleanupDuplicateTargetSkillsShadow();
  }
  console.log(`✅ Synced ${nextSkillNames.length} OCS skill(s) to ${targetSkillsDir}`);
}

function buildUserExtensionScaffoldFiles() {
  return [
    {
      relativePath: "README.md",
      content: `# OCS User Extensions\n\nThis directory is reserved for your custom OCS behavior layers.\n\n## What goes where\n\n- \`rulesets/\` → custom rules and policy constraints\n- \`skills/\` → custom skills you want agents to load\n- \`workflow/\` → task flow templates and execution playbooks\n\n## Adaptive loading strategy\n\nUse **minimum-sufficient loading**:\n\n1. Load only the skills needed for the current task domain.\n2. Add extra skills only when explicit risk/trigger conditions appear.\n3. Re-evaluate skill load when task scope changes.\n\n## Important\n\n- OCS managed skills are synced into \`~/.config/opencode/skills\`.\n- Your extension files here are user-owned and safe to customize.\n- Keep files concise and action-oriented for fast agent parsing.\n`,
    },
    {
      relativePath: path.join("rulesets", "README.md"),
      content: `# Rulesets\n\nUse this folder for custom guardrails and policies.\n\nRecommended style:\n\n- one concern per file\n- clear MUST / MUST NOT sections\n- explicit verification criteria\n\nExample names:\n\n- \`release-policy.md\`\n- \`runtime-validation-policy.md\`\n- \`docs-quality-policy.md\`\n`,
    },
    {
      relativePath: path.join("skills", "README.md"),
      content: `# Skillsets\n\nUse this folder for custom skills.\n\nEach skill should contain:\n\n1. YAML frontmatter (\`name\`, \`description\`)\n2. Trigger conditions\n3. Required sequence\n4. Anti-patterns\n\nMinimal frontmatter example:\n\n\`\`\`md\n---\nname: my-custom-skill\ndescription: Short actionable description.\n---\n\`\`\`\n`,
    },
    {
      relativePath: path.join("workflow", "README.md"),
      content: `# Workflow Templates\n\nUse this folder for repeatable execution flows.\n\nSuggested structure:\n\n- entry criteria\n- execution phases\n- verification gates\n- completion checklist\n\nKeep templates short, deterministic, and evidence-driven.\n`,
    },
  ];
}

function ensureUserExtensionScaffold() {
  const files = buildUserExtensionScaffoldFiles();
  let createdCount = 0;

  for (const file of files) {
    const absolutePath = path.join(targetExtensionsDir, file.relativePath);
    fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
    if (!fs.existsSync(absolutePath)) {
      fs.writeFileSync(absolutePath, file.content);
      createdCount += 1;
    }
  }

  if (createdCount > 0) {
    console.log(
      `✅ Initialized ${createdCount} user extension scaffold file(s) in ${targetExtensionsDir}`,
    );
  }
}

function getBundledMultiAuthPluginSpec() {
  const packageDir = getBundledMultiAuthPackageDir();
  const tarballPath = getBundledMultiAuthTarballPath();
  const packageJsonPath = path.join(packageDir, "package.json");

  if (fs.existsSync(packageJsonPath)) {
    return toDirectoryFileUrl(packageDir);
  }

  if (fs.existsSync(tarballPath)) {
    return `opencode-multi-auth@file:${tarballPath.replace(/\\/g, "/")}`;
  }

  if (fs.existsSync(packageJsonPath)) {
    return `opencode-multi-auth@file:${packageDir.replace(/\\/g, "/")}`;
  }

  return null;
}

function getBundledOpenAiAuthPluginSpec() {
  const packageDir = getBundledOpenAiAuthPluginDir();
  const tarballPath = getBundledOpenAiAuthTarballPath();
  const packageJsonPath = path.join(packageDir, "package.json");
  const bundledEntry = path.join(packageDir, "index.js");

  if (fs.existsSync(packageJsonPath)) {
    return toDirectoryFileUrl(packageDir);
  }

  if (fs.existsSync(bundledEntry)) {
    return pathToFileURL(bundledEntry).href;
  }

  if (fs.existsSync(tarballPath)) {
    return `opencode-openai-auth@file:${tarballPath.replace(/\\/g, "/")}`;
  }

  if (fs.existsSync(packageJsonPath)) {
    return `opencode-openai-auth@file:${packageDir.replace(/\\/g, "/")}`;
  }

  return null;
}

function getBundledMultiAuthInstallDependencySpec() {
  const packageDir = getBundledMultiAuthPackageDir();
  const packageJsonPath = path.join(packageDir, "package.json");
  if (!fs.existsSync(packageJsonPath)) return null;
  return "file:./plugins/opencode-multi-auth";
}

function getBundledOpenAiAuthInstallDependencySpec() {
  const packageDir = getBundledOpenAiAuthPluginDir();
  const packageJsonPath = path.join(packageDir, "package.json");
  const entryPath = path.join(packageDir, "index.js");
  if (!fs.existsSync(packageJsonPath) || !fs.existsSync(entryPath)) return null;
  return "file:./plugins/opencode-openai-auth";
}

function buildPluginInstallDependencies(plugins) {
  const dependencies = {};
  const multiAuthDependencies = loadLocalMultiAuthDependencies();
  const bundledMultiAuthInstallSpec = getBundledMultiAuthInstallDependencySpec();
  const bundledOpenAiAuthInstallSpec = getBundledOpenAiAuthInstallDependencySpec();

  for (const pluginSpec of plugins) {
    if (pluginSpec.startsWith("@opencode-ai/")) continue;

    const isMultiAuthPlugin =
      pluginSpec === "opencode-multi-auth" ||
      pluginSpec.startsWith("opencode-multi-auth@") ||
      pluginSpec.includes("opencode-multi-auth/dist/") ||
      pluginSpec.includes("/plugins/opencode-multi-auth/");

    if (isMultiAuthPlugin) {
      if (bundledMultiAuthInstallSpec) {
        dependencies["opencode-multi-auth"] = bundledMultiAuthInstallSpec;
      }
      for (const [depName, depVersion] of Object.entries(multiAuthDependencies)) {
        dependencies[depName] = depVersion;
      }
      continue;
    }

    const isOpenAiAuthPlugin =
      pluginSpec === "opencode-openai-auth" ||
      pluginSpec.startsWith("opencode-openai-auth@") ||
      pluginSpec.includes("/plugins/opencode-openai-auth/") ||
      pluginSpec.endsWith("plugins/opencode-openai-auth/index.js") ||
      pluginSpec.endsWith("plugins\\opencode-openai-auth\\index.js");

    if (isOpenAiAuthPlugin) {
      if (bundledOpenAiAuthInstallSpec) {
        dependencies["opencode-openai-auth"] = bundledOpenAiAuthInstallSpec;
      }
      continue;
    }

    if (pluginSpec === "opencode-multi-auth") continue;
    if (pluginSpec.startsWith("opencode-multi-auth@file:")) continue;
    if (pluginSpec === "opencode-openai-auth") continue;
    if (pluginSpec.startsWith("opencode-openai-auth@file:")) continue;

    const isLocalPluginSpec =
      path.isAbsolute(pluginSpec) ||
      pluginSpec.startsWith("./") ||
      pluginSpec.startsWith("../") ||
      pluginSpec.startsWith("file:") ||
      pluginSpec.endsWith(".js");

    if (isLocalPluginSpec) continue;

    const atIdx = pluginSpec.lastIndexOf("@");
    if (atIdx > 0) {
      dependencies[pluginSpec.slice(0, atIdx)] = pluginSpec.slice(atIdx + 1);
    } else {
      dependencies[pluginSpec] = "latest";
    }
  }

  return dependencies;
}

function rewriteMultiAuthPluginSpec(config, options = {}) {
  if (!config || !Array.isArray(config.plugin)) return config;

  const openAiRuntimeLane = resolveOpenAiRuntimeLane(options);

  const multiAuthPluginSpec = getBundledMultiAuthPluginSpec();
  const openAiAuthPluginSpec = getBundledOpenAiAuthPluginSpec();

  const filtered = config.plugin.filter((entry) => {
    if (entry === "opencode-multi-auth") return false;
    if (entry === "./plugins/opencode-multi-auth/dist/index.js") return false;
    if (entry.startsWith("opencode-multi-auth@")) return false;
    if (entry.startsWith("file://") && entry.includes("opencode-multi-auth")) {
      return false;
    }
    if (entry === "opencode-openai-auth") return false;
    if (entry === "./plugins/opencode-openai-auth/index.js") return false;
    if (entry.startsWith("opencode-openai-auth@")) return false;
    if (entry.startsWith("file://") && entry.includes("opencode-openai-auth")) {
      return false;
    }
    return true;
  });

  // Keep the local auth path available only for the local-plugin lane.
  if (openAiRuntimeLane === "local-plugin" && multiAuthPluginSpec) {
    const nextPlugins = [...filtered, multiAuthPluginSpec];
    if (openAiAuthPluginSpec) {
      nextPlugins.push(openAiAuthPluginSpec);
    }
    config.plugin = nextPlugins;
    return config;
  }

  // Fallback when bundled multi-auth artifact is unavailable.
  config.plugin = filtered;

  return config;
}

function syncMultiAuthToTargetNodeModules() {
  const pluginRoot = resolveMultiAuthPluginRoot();
  if (!pluginRoot) {
    if (!isInstallerSetupMode()) {
      console.warn("   ⚠️  Multi-auth source not found, skipping local plugin package sync.");
    }
    return;
  }

  const targetPluginDir = getBundledMultiAuthPackageDir();
  if (
    isInstallerSetupMode() &&
    fs.existsSync(path.join(targetPluginDir, "package.json")) &&
    fs.existsSync(path.join(targetPluginDir, "dist", "index.js"))
  ) {
    console.log(
      "   ℹ️  Installer runtime already has a bundled opencode-multi-auth package. Skipping local tarball sync.",
    );
    return;
  }
  let sourceRootPath = pluginRoot;
  let targetRootPath = targetPluginDir;

  try {
    sourceRootPath = fs.realpathSync(pluginRoot);
    targetRootPath = fs.realpathSync(targetPluginDir);
  } catch {
    // Keep non-realpath values when path does not exist yet.
  }

  if (sourceRootPath === targetRootPath) {
    if (isInstallerSetupMode()) {
      console.log(
        "   ℹ️  Bundled opencode-multi-auth source already points to target directory; skipping self-copy.",
      );
    }
    return;
  }

  fs.rmSync(targetPluginDir, { recursive: true, force: true });
  fs.mkdirSync(targetPluginDir, { recursive: true });

  const sourcePackageJson = path.join(pluginRoot, "package.json");
  const sourceReadme = path.join(pluginRoot, "README.md");
  const sourceLicense = path.join(pluginRoot, "LICENSE");
  const sourceDist = path.join(pluginRoot, "dist");

  try {
    if (fs.existsSync(sourcePackageJson)) {
      fs.copyFileSync(sourcePackageJson, path.join(targetPluginDir, "package.json"));
    }
    if (fs.existsSync(sourceReadme)) {
      fs.copyFileSync(sourceReadme, path.join(targetPluginDir, "README.md"));
    }
    if (fs.existsSync(sourceLicense)) {
      fs.copyFileSync(sourceLicense, path.join(targetPluginDir, "LICENSE"));
    }
    if (fs.existsSync(sourceDist)) {
      fs.cpSync(sourceDist, path.join(targetPluginDir, "dist"), {
        recursive: true,
        force: true,
      });
    }

    const existingTarballs = fs
      .readdirSync(targetPluginDir)
      .filter((name) => /^opencode-multi-auth-.*\.tgz$/.test(name));

    for (const tarball of existingTarballs) {
      fs.unlinkSync(path.join(targetPluginDir, tarball));
    }

    packLocalPlugin(targetPluginDir, path.basename(getBundledMultiAuthTarballPath()));
  } catch (error) {
    if (isInstallerSetupMode()) {
      console.log("   ℹ️  Skipped local multi-auth tarball sync (non-fatal in installer mode).");
    } else {
      console.warn(`   ⚠️  Failed to sync local multi-auth package: ${error.message}`);
      console.warn("   ⚠️  Continuing setup without blocking install.");
    }
    return;
  }

  console.log("   ✅ Bundled opencode-multi-auth package into target config directory.");
}

function syncOpenAiAuthPluginToTarget() {
  const pluginRoot = resolveOpenAiAuthPluginRoot();
  if (!pluginRoot) {
    if (!isInstallerSetupMode()) {
      console.warn("   ⚠️  OpenAI auth wrapper source not found, skipping local plugin sync.");
    }
    return;
  }

  const targetPluginDir = getBundledOpenAiAuthPluginDir();
  if (
    isInstallerSetupMode() &&
    fs.existsSync(path.join(targetPluginDir, "package.json")) &&
    fs.existsSync(path.join(targetPluginDir, "index.js"))
  ) {
    console.log(
      "   ℹ️  Installer runtime already has a bundled opencode-openai-auth wrapper. Skipping local tarball sync.",
    );
    return;
  }
  let sourceRootPath = pluginRoot;
  let targetRootPath = targetPluginDir;

  try {
    sourceRootPath = fs.realpathSync(pluginRoot);
    targetRootPath = fs.realpathSync(targetPluginDir);
  } catch {
    // Keep non-realpath values when path does not exist yet.
  }

  if (sourceRootPath === targetRootPath) {
    if (isInstallerSetupMode()) {
      console.log(
        "   ℹ️  Bundled opencode-openai-auth source already points to target directory; skipping self-copy.",
      );
    }
    return;
  }

  fs.rmSync(targetPluginDir, { recursive: true, force: true });
  fs.mkdirSync(targetPluginDir, { recursive: true });

  try {
    const sourcePackageJson = path.join(pluginRoot, "package.json");
    fs.copyFileSync(
      path.join(pluginRoot, "index.js"),
      path.join(targetPluginDir, "index.js"),
    );

    if (fs.existsSync(sourcePackageJson)) {
      fs.copyFileSync(
        sourcePackageJson,
        path.join(targetPluginDir, "package.json"),
      );
    }

    const existingTarballs = fs
      .readdirSync(targetPluginDir)
      .filter((name) => /^opencode-openai-auth-.*\.tgz$/.test(name));

    for (const tarball of existingTarballs) {
      fs.unlinkSync(path.join(targetPluginDir, tarball));
    }

    packLocalPlugin(targetPluginDir, path.basename(getBundledOpenAiAuthTarballPath()));
  } catch (error) {
    if (isInstallerSetupMode()) {
      console.log("   ℹ️  Skipped OpenAI auth wrapper tarball sync (non-fatal in installer mode).");
    } else {
      console.warn(`   ⚠️  Failed to sync OpenAI auth wrapper: ${error.message}`);
      console.warn("   ⚠️  Continuing setup without blocking install.");
    }
    return;
  }

  console.log("   ✅ Bundled opencode-openai-auth wrapper into target config directory.");
}

/**
 * Download comment-checker binary to cache directory.
 * This ensures the binary is available regardless of how oh-my-opencode is installed.
 */
function downloadCommentCheckerBinary(targetBinDir) {
  const version = "0.7.0";
  const platformMap = {
    "win32-x64": { os: "windows", arch: "amd64", ext: "zip" },
    "win32-arm64": { os: "windows", arch: "arm64", ext: "zip" },
    "linux-x64": { os: "linux", arch: "amd64", ext: "tar.gz" },
    "linux-arm64": { os: "linux", arch: "arm64", ext: "tar.gz" },
    "darwin-x64": { os: "darwin", arch: "amd64", ext: "tar.gz" },
    "darwin-arm64": { os: "darwin", arch: "arm64", ext: "tar.gz" },
  };

  const platformKey = `${process.platform}-${process.arch}`;
  const platformInfo = platformMap[platformKey];

  if (!platformInfo) {
    console.log(`\u26A0\uFE0F  Unsupported platform: ${platformKey}`);
    return;
  }

  const assetName = `comment-checker_v${version}_${platformInfo.os}_${platformInfo.arch}.${platformInfo.ext}`;
  const downloadUrl = `https://github.com/code-yeongyu/go-claude-code-comment-checker/releases/download/v${version}/${assetName}`;

  if (!fs.existsSync(targetBinDir)) {
    console.log(`   \u{1F4C1} Creating binary directory: ${targetBinDir}`);
    fs.mkdirSync(targetBinDir, { recursive: true });
  }

  const archivePath = path.join(targetBinDir, assetName);
  const ext = process.platform === "win32" ? ".exe" : "";
  const binaryPath = path.join(targetBinDir, `comment-checker${ext}`);

  if (fs.existsSync(binaryPath)) {
    console.log(
      `   \u2705 comment-checker binary already exists at ${binaryPath}`,
    );
    return;
  }

  console.log(`   \u2B07\uFE0F  Downloading comment-checker binary...`);
  console.log(`      Url: ${downloadUrl}`);
  console.log(`      To:  ${targetBinDir}`);

  try {
    if (process.platform === "win32") {
      execSync(
        `powershell -Command "Invoke-WebRequest -Uri '${downloadUrl}' -OutFile '${archivePath}' -UseBasicParsing"`,
        { stdio: "pipe", timeout: 60000 },
      );
      execSync(
        `powershell -Command "Expand-Archive -Path '${archivePath}' -DestinationPath '${targetBinDir}' -Force"`,
        { stdio: "pipe" },
      );
    } else {
      execSync(`curl -sL "${downloadUrl}" -o "${archivePath}"`, {
        stdio: "pipe",
        timeout: 60000,
      });
      execSync(`tar -xzf "${archivePath}" -C "${targetBinDir}"`, {
        stdio: "pipe",
      });
    }

    if (fs.existsSync(archivePath)) {
      fs.unlinkSync(archivePath);
    }
    console.log(`   \u2705 Successfully installed comment-checker binary.`);
  } catch (err) {
    console.error(`   \u274C Failed to download binary: ${err.message}`);
  }
}

/**
 * Ensure comment-checker binary is available in cache.
 */
function ensureCommentChecker() {
  console.log("\n\u{1F30D} Ensuring comment-checker binary...");

  let cacheBinDir = "";
  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    cacheBinDir = path.join(localAppData, "oh-my-openagent", "bin");
  } else {
    const xdgCache =
      process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
    cacheBinDir = path.join(xdgCache, "oh-my-openagent", "bin");
  }

  console.log(`   \u{1F6E1}\uFE0F  Cache location: ${cacheBinDir}`);
  downloadCommentCheckerBinary(cacheBinDir);
}

function getCommentCheckerBinaryPath() {
  const ext = process.platform === "win32" ? ".exe" : "";

  if (process.platform === "win32") {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    const preferred = path.join(localAppData, "oh-my-openagent", "bin", `comment-checker${ext}`);
    if (fs.existsSync(preferred)) {
      return preferred;
    }
    return path.join(localAppData, "oh-my-opencode", "bin", `comment-checker${ext}`);
  }

  const xdgCache =
    process.env.XDG_CACHE_HOME || path.join(os.homedir(), ".cache");
  const preferred = path.join(xdgCache, "oh-my-openagent", "bin", `comment-checker${ext}`);
  if (fs.existsSync(preferred)) {
    return preferred;
  }
  return path.join(xdgCache, "oh-my-opencode", "bin", `comment-checker${ext}`);
}

function stripAnsi(text) {
  return text.replace(new RegExp("\\u001b\\[[0-9;]*m", "g"), "");
}

function isOnlyKnownDoctorFalsePositive(output) {
  const clean = stripAnsi(output || "");
  if (!clean.includes("Comment checker unavailable")) {
    return false;
  }

  const issueTitles = [...clean.matchAll(/^\s*\d+\.\s*(.+)$/gm)].map((m) =>
    m[1].trim().toLowerCase(),
  );

  if (issueTitles.length === 0) {
    return true;
  }

  return issueTitles.every((title) => title.includes("comment checker unavailable"));
}

function parseSemverTuple(version) {
  if (typeof version !== "string") return null;
  const match = version.trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemverTuple(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return 0;
  for (let i = 0; i < 3; i += 1) {
    if (left[i] > right[i]) return 1;
    if (left[i] < right[i]) return -1;
  }
  return 0;
}

function resolveInstalledOpenCodeVersion() {
  try {
    const output = execSync("opencode --version", {
      encoding: "utf-8",
      stdio: "pipe",
      timeout: 5000,
    }).trim();
    const match = output.match(/\d+\.\d+\.\d+/);
    return match ? match[0] : null;
  } catch {
    return null;
  }
}

function isKnownOpenCodeMinimumVersionNoise(output) {
  const clean = stripAnsi(output || "");
  if (!clean.includes("OpenCode version below minimum")) {
    return false;
  }

  const warningMatch = clean.match(/Detected\s+(\d+\.\d+\.\d+);\s*required\s*>=\s*(\d+\.\d+\.\d+)/i);
  if (!warningMatch) {
    return false;
  }

  const detected = parseSemverTuple(warningMatch[1]);
  const required = parseSemverTuple(warningMatch[2]);
  const installed = parseSemverTuple(resolveInstalledOpenCodeVersion());

  if (!detected || !required || !installed) {
    return false;
  }

  return compareSemverTuple(detected, required) < 0 && compareSemverTuple(installed, required) >= 0;
}

/**
 * Verify system health by running doctor command via bunx.
 */
function verifySystemHealth() {
  console.log("\n\u{1F3E5} Verifying System Health...");

  try {
    console.log("   \u{1F504} Refreshing model cache...");
    try {
      execSync("opencode models --refresh", {
        stdio: "ignore",
        timeout: 10000,
      });
      console.log("   \u2705 Models refreshed.");
    } catch {
      console.log(
        "   \u26A0\uFE0F  Model refresh skipped (OpenCode CLI not available or timed out).",
      );
    }
  } catch (e) {}

  // Run Doctor using bunx with OpenAgent-first compatibility fallback.
  try {
    console.log("   \u{1FA7A} Running doctor check (via bunx)...\n");
    let doctorOutput = "";
    let doctorExitCode = 0;

    const doctorCommands = [
      "bunx oh-my-openagent doctor",
      "bunx oh-my-opencode doctor",
    ];

    let lastDoctorError = null;
    for (const doctorCommand of doctorCommands) {
      try {
        doctorOutput = execSync(doctorCommand, {
          encoding: "utf-8",
          stdio: "pipe",
          timeout: 30000,
        });
        lastDoctorError = null;
        break;
      } catch (error) {
        lastDoctorError = error;
        doctorOutput = `${error.stdout || ""}${error.stderr || ""}`;
      }
    }

    if (lastDoctorError) {
      doctorExitCode = lastDoctorError.status || 1;
      doctorOutput = `${lastDoctorError.stdout || ""}${lastDoctorError.stderr || ""}`;
    }

    const onlyKnownFalsePositive = isOnlyKnownDoctorFalsePositive(doctorOutput);
    const onlyKnownVersionNoise = isKnownOpenCodeMinimumVersionNoise(doctorOutput);

    if (onlyKnownFalsePositive) {
      console.log(
        "   \u2139\uFE0F  Doctor warning hidden: known false-positive 'Comment checker unavailable'.",
      );
      return;
    }

    if (onlyKnownVersionNoise) {
      console.log(
        "   \u2139\uFE0F  Doctor warning hidden: stale OpenCode minimum-version report (installed binary already satisfies requirement).",
      );
      return;
    }

    if (doctorOutput.trim()) {
      process.stdout.write(doctorOutput.endsWith("\n") ? doctorOutput : `${doctorOutput}\n`);
    }

    if (doctorExitCode !== 0) {
      console.warn("   \u26A0\uFE0F  Doctor check failed or found issues.");
    }
  } catch (e) {
    console.warn("   \u26A0\uFE0F  Doctor check failed or found issues.");
  }
}

/**
 * Ensure global tool dependencies are installed via Bun.
 * Covers LSP servers and required hook binaries used by this setup.
 * @param {boolean} forceUpdate - If true, performs a repair-oriented health check for managed dependencies.
 */
function getManagedGlobalToolDependencies() {
  return [
    { pkg: "typescript", bin: "tsc" },
    { pkg: "typescript-language-server", bin: "typescript-language-server" },
    { pkg: "bash-language-server", bin: "bash-language-server" },
    { pkg: "vscode-langservers-extracted", bin: "vscode-html-language-server" },
    { pkg: "yaml-language-server", bin: "yaml-language-server" },
    { pkg: "dockerfile-language-server-nodejs", bin: "docker-langserver" },
    { pkg: "pyright", bin: "pyright-langserver" },
    { pkg: "sql-language-server", bin: "sql-language-server" },
    { pkg: "@biomejs/biome", bin: "biome" },
    { pkg: "@code-yeongyu/comment-checker", bin: "comment-checker" },
  ];
}

function listMissingManagedGlobalDependencies(options = {}) {
  const {
    platform = process.platform,
    commandProbe = execSync,
    commentCheckerBinaryPath = getCommentCheckerBinaryPath(),
    managedDependencies = getManagedGlobalToolDependencies(),
  } = options;

  const missing = [];

  managedDependencies.forEach(({ pkg, bin }) => {
    try {
      if (platform === "win32") {
        commandProbe(`where ${bin}`, { stdio: "ignore" });
      } else {
        commandProbe(`which ${bin}`, { stdio: "ignore" });
      }
    } catch {
      if (pkg === "@code-yeongyu/comment-checker" && fs.existsSync(commentCheckerBinaryPath)) {
        return;
      }
      missing.push(pkg);
    }
  });

  return missing;
}

function ensureGlobalToolDependencies(forceUpdate = false, options = {}) {
  const {
    logger = console,
    runner = runCommandWithRetry,
    ensurePses = ensurePowerShellEditorServices,
    homeDir = os.homedir(),
    managedDependencies = getManagedGlobalToolDependencies(),
    commandProbe = execSync,
  } = options;

  console.log(
    "\n\u{1F6E0}\uFE0F Checking Global Tool Dependencies (via Bun)...",
  );

  if (forceUpdate) {
    logger.log(
      "   \u{1F504} Force Update detected: repairing missing managed tools only (skip healthy installs).",
    );
  }

  const bunGlobalDir = path.join(homeDir, ".bun", "install", "global");
  const bunGlobalPackageJson = path.join(bunGlobalDir, "package.json");
  const bunGlobalLockfile = path.join(bunGlobalDir, "bun.lock");

  const sanitizeBunGlobalManifest = () => {
    try {
      if (!fs.existsSync(bunGlobalPackageJson)) return;

      const raw = fs.readFileSync(bunGlobalPackageJson, "utf-8");
      const parsed = JSON.parse(raw);
      let manifestChanged = false;

      if (parsed && parsed.dependencies && typeof parsed.dependencies === "object") {
        if (Object.prototype.hasOwnProperty.call(parsed.dependencies, "opencode-config-suites")) {
          delete parsed.dependencies["opencode-config-suites"];
          manifestChanged = true;
        }
      }

      if (manifestChanged) {
        fs.writeFileSync(bunGlobalPackageJson, JSON.stringify(parsed, null, 2));
        logger.log("   🧹 Removed stale opencode-config-suites from Bun global dependencies.");
      }

      const duplicateCount = (raw.match(/"opencode-config-suites"\s*:/g) || []).length;
      if (duplicateCount > 1 && fs.existsSync(bunGlobalLockfile)) {
        fs.unlinkSync(bunGlobalLockfile);
        logger.log("   🧹 Removed corrupted Bun global lockfile with duplicate package keys.");
      }
    } catch (error) {
      logger.warn(`   ⚠️  Unable to sanitize Bun global manifest: ${error.message}`);
    }
  };

  sanitizeBunGlobalManifest();

  const missing = listMissingManagedGlobalDependencies({
    platform: process.platform,
    commandProbe,
    managedDependencies,
  });

  if (missing.length > 0) {
    console.log(
      `   \u26A0\uFE0F  Missing global dependencies: ${missing.join(", ")}`,
    );
    logger.log("   \u2B07\uFE0F  Installing via Bun...");
    try {
      runner(`bun add -g ${missing.join(" ")}`, {
        cwd: homeDir,
        timeout: 300000, // 5 mins
        maxAttempts: 4,
        lockPath: bunGlobalDir,
        label: "bun add -g <tool-deps>",
      });
      logger.log("   \u2705 Installed missing tool dependencies via Bun.");
    } catch (err) {
      logger.error(
        `   \u274C Failed to install tool dependencies via Bun: ${err.message}`,
      );
    }
  } else {
    logger.log(forceUpdate ? "   ✅ All Bun-managed global tools already healthy. Skipping Bun reinstall." : "   \u2705 All Bun-managed global tools found.");
  }

  ensurePses(false);

  // Check Rust Analyzer (usually managed via rustup)
  if (isInstallerSetupMode()) {
    return;
  }

  try {
    logger.log("   \u{1F980} Checking rust-analyzer...");
    execSync("rust-analyzer --version", { stdio: "ignore" });
    logger.log("      \u2705 rust-analyzer found.");
  } catch {
    logger.warn("      \u26A0\uFE0F  rust-analyzer not found in PATH.");
    logger.log(
      "      \u{1F4A1} Recommendation: 'rustup component add rust-analyzer'",
    );
  }
}

function deployConfig(profileName, selectedResourceMode, options = {}) {
  const {
    finalizeRuntimeConvergence = finalizeProfileRuntimeConvergence,
  } = options;
  const selectedFile = `${profileName}.json`;
  const sourceProfilePath = path.join(configsDir, selectedFile);

  if (!fs.existsSync(sourceProfilePath)) {
    throw new Error(`Profile file not found: ${sourceProfilePath}`);
  }

  console.log(
    `\n\u{1F4E6} Deploying profile: ${profileName} (resource mode: ${selectedResourceMode})...`,
  );

  const lightweightProfileSwitch =
    !forceUpdate &&
    !isInstallerSetupMode() &&
    fs.existsSync(targetOpencodeJson) &&
    fs.existsSync(targetOhMyOpencode) &&
    fs.existsSync(targetOhMyOpenagent);

  // 1. Enforce Pure Config only for installer/update/first-install flows.
  if (!lightweightProfileSwitch) {
    enforcePureConfig();
  }

  // 2.1 Load and Apply Runtime Overrides
  const profileConfig = JSON.parse(
    fs.readFileSync(sourceProfilePath, "utf-8"),
  );
  const finalConfig = buildFinalOhMyOpencodeConfig(profileConfig, selectedResourceMode);

  const canonicalOhMyBackupPath = createManagedBackup(
    fs.existsSync(targetOhMyOpenagent) ? targetOhMyOpenagent : targetOhMyOpencode,
    "managed-replace",
    2,
  );

  // 3. Write final config to both runtime config filenames
  fs.writeFileSync(targetOhMyOpencode, JSON.stringify(finalConfig, null, 2));
  fs.writeFileSync(targetOhMyOpenagent, JSON.stringify(finalConfig, null, 2));
  console.log(
    `✅ Applied profile (${lightweightProfileSwitch ? "lightweight switch" : "full replace"}): ${profileName} -> oh-my-opencode.json + oh-my-openagent.json${canonicalOhMyBackupPath ? ` (backup: ${path.basename(canonicalOhMyBackupPath)})` : ""}`,
  );

  // 4. Persist resource mode selection metadata
  const resourceModeStatePath = path.join(targetDir, "resource-mode.json");
  const resourceModeState = {
    profile: profileName,
    mode: selectedResourceMode,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    resourceModeStatePath,
    JSON.stringify(resourceModeState, null, 2),
  );
  console.log(`✅ Saved resource mode state: ${resourceModeStatePath}`);
  console.log(`✅ Concurrent agents limit set to: ${finalConfig.background_task?.defaultConcurrency ?? "default"} (resource mode: ${selectedResourceMode})`);

  if (lightweightProfileSwitch) {
    const existingOpencodeConfig = loadJsonFile(targetOpencodeJson);
    const orphanCount = validateModelReferences(finalConfig, existingOpencodeConfig);
    const existingCompressionState = readExistingCompressionState(existingOpencodeConfig, {
      env: process.env,
      platform: process.platform,
    });
    if (orphanCount > 0) {
      console.warn(
        `⚠️  ${orphanCount} model reference(s) in oh-my-opencode.json do not resolve in existing opencode.json providers`,
      );
    }

    finalizeRuntimeConvergence(existingCompressionState, {
      env: process.env,
      platform: process.platform,
      updateMode: true,
    });
    syncOcsRuntimeAssetsToTarget();
    syncWslHostOpencodeConfigParity();
    console.log("✅ Lightweight profile switch complete. Existing plugins, indexes, and runtime assets were preserved.");
    return;
  }

  const existingCompressionState = readExistingCompressionState({}, {
    env: process.env,
    platform: process.platform,
  });

  const opencodeBackupPath = createManagedBackup(
    targetOpencodeJson,
    "managed-replace",
    2,
  );

  // 5. Copy opencode.json base
  fs.copyFileSync(sourceOpencodeJson, targetOpencodeJson);

  // 6. Sync bundled multi-auth payload before plugin rewrite so Antigravity OAuth
  // remains available from local/tarball assets in deployed runtime config.
  const openAiRuntimeLane = resolveOpenAiRuntimeLane({
    env: process.env,
    fsApi: fs,
    pathApi: path,
    logger: console,
  });

  if (openAiRuntimeLane === "local-plugin") {
    syncMultiAuthToTargetNodeModules();
    syncOpenAiAuthPluginToTarget();
  }
  syncOcsRuntimeAssetsToTarget();

  // 6.1 Keep setup on single-auth baseline by stripping legacy wrappers and
  // appending bundled multi-auth only when available.
  const compatPluginConfig = enforceOauthCompatiblePluginStack(
    loadJsonFile(targetOpencodeJson),
    {},
  );
  const pluginAdjustedOpencodeConfig = rewriteMultiAuthPluginSpec(compatPluginConfig, {
    env: process.env,
    fsApi: fs,
    pathApi: path,
    logger: console,
  });
  const targetOpencodeConfig = pluginAdjustedOpencodeConfig;
  delete targetOpencodeConfig.ocs;
  fs.writeFileSync(targetOpencodeJson, JSON.stringify(targetOpencodeConfig, null, 2));
  console.log(`✅ Updated opencode.json (full replace baseline)${opencodeBackupPath ? ` (backup: ${path.basename(opencodeBackupPath)})` : ""}`);

  // 6.2 Cross-validate model references between oh-my-opencode.json and opencode.json
  const orphanCount = validateModelReferences(finalConfig, loadJsonFile(targetOpencodeJson));
  if (orphanCount > 0) {
    console.warn(
      `⚠️  ${orphanCount} model reference(s) in oh-my-opencode.json do not resolve in opencode.json providers`,
    );
  }

  // 7.1 Prune stale local auth plugin folders so runtime mirrors single-auth baseline.
  cleanupStaleAuthPluginDirs(targetOpencodeConfig);

  // 7.2 Keep the core provider auth map aligned with the local auth plugin stack
  // so native runtimes that consult auth.json recognize OAuth-backed providers.
  syncCoreProviderAuthState(targetOpencodeConfig, {
    env: process.env,
    fallbackHome: os.homedir(),
    fsApi: fs,
    pathApi: path,
    logger: console,
  });

  // 9. Install plugins declared in opencode.json
  installPlugins();

  finalizeRuntimeConvergence(existingCompressionState, {
    env: process.env,
    platform: process.platform,
    updateMode: forceUpdate,
  });

  // 9.2 Auto-install + configure CocoIndex runtime for installer users.
  ensureCocoIndexSupport();

  // 10. Merge antigravity baseline while preserving runtime accounts/state
  const antigravityBaselinePath = fs.existsSync(sourceAntigravityJson)
    ? sourceAntigravityJson
    : fs.existsSync(sourceAntigravityTemplate)
      ? sourceAntigravityTemplate
      : null;

  if (antigravityBaselinePath) {
    const baselineAntigravity = loadJsonObjectOrNull(antigravityBaselinePath);
    const existingAntigravity = loadJsonObjectOrNull(targetAntigravityJson) || {};

    if (baselineAntigravity) {
      const mergedAntigravity = mergeObjectWithExistingPriority(
        existingAntigravity,
        baselineAntigravity,
      );
      fs.writeFileSync(
        targetAntigravityJson,
        JSON.stringify(mergedAntigravity, null, 2),
      );

      if (Object.keys(existingAntigravity).length > 0) {
        console.log(
          `✅ Merged antigravity.json baseline while preserving existing accounts/state`,
        );
      } else {
        console.log(
          `✅ Seeded antigravity.json baseline from ${path.basename(antigravityBaselinePath)}`,
        );
      }
    } else if (!fs.existsSync(targetAntigravityJson)) {
      fs.copyFileSync(antigravityBaselinePath, targetAntigravityJson);
      console.log(
        `✅ Seeded antigravity.json baseline from ${path.basename(antigravityBaselinePath)}`,
      );
    } else {
      console.log(
        `⚠️  antigravity baseline exists but failed to parse; keeping existing target config`,
      );
    }
  } else {
    console.log(
      `⚠️  antigravity.json and backups template not found, skipping...`,
    );
  }

  normalizeManagedBackupFiles(path.join(targetDir, "antigravity-accounts.json"), 2)

  // 10.5 Keep WSL and Windows host config structures aligned when setup runs in WSL
  syncWslHostOpencodeConfigParity();

  console.log(
    "\n✨ Setup complete! Configuration deployed with Bun runtime.",
  );

  // Keep setup/profile flow generation-focused and fast (no checker-heavy tail phase)
  if (!isInstallerSetupMode()) {
    console.log("   ⚡ Skipping setup doctor/checker phase to keep setup:profile fast and deterministic.");
  }
}

function buildFinalOhMyOpencodeConfig(profileConfig, selectedResourceMode) {
  const baselineAdjustedConfig = applyRuntimeVariantBaselines(profileConfig);
  const resourceAdjustedConfig = applyResourceModePolicy(
    baselineAdjustedConfig,
    selectedResourceMode,
  );
  const compatConfig = applyTaskCompatAliasLayer(resourceAdjustedConfig);
  const fallbackAdjustedConfig = applyRuntimeFallbackModelOverrides(compatConfig);
  const lspAdjustedConfig = applyRuntimeLspOverrides(fallbackAdjustedConfig);
  return enforceAuthProviderGuard(lspAdjustedConfig);
}

// ============================================================
// Main Setup Flow
// ============================================================

const args = process.argv.slice(2);
const forceUpdate = args.includes("--update");
const headlessMode =
  args.includes("--headless") ||
  args.includes("--non-interactive") ||
  args.includes("--yes");

function getArgValue(flag) {
  const index = args.indexOf(flag);
  if (index === -1 || index + 1 >= args.length) {
    return null;
  }

  return String(args[index + 1] || "").trim() || null;
}

const profileArg = getArgValue("--profile");
const modeArg = getArgValue("--mode");

let rl;

if (require.main === module) {
rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log(
  `\u2728 ${SETUP_RUNTIME_CONFIG.setupTitle} v${CURRENT_SETUP_VERSION} (${SETUP_RUNTIME_CONFIG.runtimeLabel}) \u2728`,
);
console.log("---------------------------------------------------");

cleanStaleCache();
ensureOpencodeCli();

if (isInstallerSetupMode()) {
  console.log(
    "   📦 Installer mode detected — ensuring managed runtime tool dependencies for shipped LSPs.",
  );
  ensureGlobalToolDependencies(false);
} else if (forceUpdate) {
  console.log("   🔄 setup:profile:update mode detected — checking managed global tool dependencies for repair-only updates...");
  ensureGlobalToolDependencies(true);
} else {
  console.log("   ⚡ setup:profile mode detected — skipping checker-heavy preflight for faster config generation.");
}

console.log(`Target Directory: ${targetDir}`);

if (!fs.existsSync(configsDir)) {
  console.error("\u274C Error: configs directory not found!");
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  console.log(
    `\u26A0\uFE0F  Target directory not found. Creating: ${targetDir}`,
  );
  fs.mkdirSync(targetDir, { recursive: true });
}

const allProfileFiles = fs
  .readdirSync(configsDir)
  .filter((file) => file.endsWith(".json"));

const allProfileNames = new Set(
  allProfileFiles.map((file) => file.replace(".json", "")),
);

const files = allProfileFiles
  .filter((file) => {
    const profile = file.replace(".json", "");
    const aliasTarget = LEGACY_PROFILE_ALIAS_MAP[profile];
    if (!aliasTarget) return true;
    return !allProfileNames.has(aliasTarget);
  })
  .sort((a, b) => {
    const profileA = a.replace(".json", "");
    const profileB = b.replace(".json", "");
    const idxA = PROFILE_DISPLAY_ORDER.indexOf(profileA);
    const idxB = PROFILE_DISPLAY_ORDER.indexOf(profileB);

    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return profileA.localeCompare(profileB);
  });

function resolveResourceModeSelection(rawInput) {
  const input = String(rawInput || "").trim();
  if (!input) return DEFAULT_RESOURCE_MODE;

  const asNumber = Number.parseInt(input, 10);
  if (Number.isInteger(asNumber)) {
    const option = RESOURCE_MODE_OPTIONS[asNumber - 1];
    return option ? option.id : null;
  }

  const normalized = input.toLowerCase();
  const directMatch = RESOURCE_MODE_OPTIONS.find(
    (option) => option.id.toLowerCase() === normalized,
  );

  return directMatch ? directMatch.id : null;
}

/**
 * Resolves the profile name, taking into account aliases and saved state.
 */
function resolveProfile(arg, savedProfile) {
  let name = arg || savedProfile;
  if (!name) return null;

  // Handle legacy aliases
  if (LEGACY_PROFILE_ALIAS_MAP[name]) {
    name = LEGACY_PROFILE_ALIAS_MAP[name];
  }

  return allProfileNames.has(name) ? name : null;
}

/**
 * Resolves the resource mode, taking into account saved state and defaults.
 */
function resolveMode(arg, savedMode) {
  const resolved = resolveResourceModeSelection(arg || savedMode);
  return resolved || DEFAULT_RESOURCE_MODE;
}

// Load saved state if it exists
let savedState = null;
const statePath = path.join(targetDir, "resource-mode.json");
if (fs.existsSync(statePath)) {
  try {
    savedState = loadJsonFile(statePath);
  } catch (e) {
    // ignore
  }
}

const shouldRunNonInteractive =
  headlessMode ||
  Boolean(profileArg) ||
  Boolean(modeArg);

if (shouldRunNonInteractive) {
  const profile = resolveProfile(profileArg, savedState?.profile);
  const mode = resolveMode(modeArg, savedState?.mode);

  if (!profile) {
    if (forceUpdate) {
      console.error("\u274C Error: No saved profile found to update. Run interactive setup first.");
    } else {
      console.error("\u274C Error: Profile not specified or invalid. Use --profile <name>");
    }
    rl.close();
    process.exit(1);
  }

  try {
    deployConfig(profile, mode);
    rl.close();
  } catch (err) {
    console.error(`\n\u274C Error deploying files: ${err.message}`);
    rl.close();
    process.exit(1);
  }
} else {
  // Interactive Flow
  if (files.length === 0) {
    console.error("\u274C Error: No configuration files found in configs/");
    process.exit(1);
  }

  console.log("\nAvailable Profiles:");
  files.forEach((file, index) => {
    const profileName = file.replace(".json", "");
    const desc = getProfileDescription(profileName, path.join(configsDir, file));
    const scopeHint = getProfileScopeHint(profileName);
    console.log(`  ${index + 1}. ${profileName}  ${scopeHint} ${desc}`);
  });

  rl.question("\nSelect a profile by number: ", (answer) => {
    const choice = parseInt(answer);

    if (isNaN(choice) || choice < 1 || choice > files.length) {
      console.error("\u274C Invalid selection.");
      rl.close();
      process.exit(1);
    }

    const selectedFile = files[choice - 1];
    const profileName = selectedFile.replace(".json", "");

    console.log("\nResource Modes:");
    RESOURCE_MODE_OPTIONS.forEach((option, index) => {
      const isDefault = option.id === DEFAULT_RESOURCE_MODE ? " (default)" : "";
      console.log(
        `  ${index + 1}. ${option.id}${isDefault} - ${option.label}: ${option.description}`,
      );
    });

    rl.question(
      `\nSelect resource mode [1-${RESOURCE_MODE_OPTIONS.length}] (Enter for ${DEFAULT_RESOURCE_MODE}): `,
      (modeAnswer) => {
        let selectedResourceMode = resolveResourceModeSelection(modeAnswer);

        if (!selectedResourceMode) {
          console.warn(
            `⚠️ Invalid resource mode selection. Falling back to default: ${DEFAULT_RESOURCE_MODE}.`,
          );
          selectedResourceMode = DEFAULT_RESOURCE_MODE;
        }

        try {
          deployConfig(profileName, selectedResourceMode);
          rl.close();
        } catch (err) {
          console.error(`\n\u274C Error deploying files: ${err.message}`);
          rl.close();
          process.exit(1);
        }
      },
    );
  });
}

}

module.exports = {
  applyCocoIndexMcpEntry,
  applyRuntimeApiCredentialBackup,
  buildCocoIndexMcpCommand,
  buildCocoIndexCliInvocation,
  buildCocoIndexEnvFileContent,
  buildCocoIndexEnvValues,
  buildCocoIndexShimContents,
  buildCompressionPolicy,
  buildCompressionProjection,
  buildCompressionAdjunctEnv,
  buildFinalOhMyOpencodeConfig,
  buildUserExtensionScaffoldFiles,
  buildSafeDcpConfig,
  commandLookupAvailable,
  enforcePureConfig,
  enforceAuthProviderGuard,
  getCocoIndexInstallStrategies,
  getCocoIndexPlatformDirs,
  getBundledSkillNames,
  cleanupDuplicateTargetSkillsShadow,
  deployConfig,
  syncOcsRuntimeAssetsToTarget,
  syncProjectSkillsToTarget,
  getBundledOpenAiAuthPluginSpec,
  getBundledMultiAuthPluginSpec,
  hasLegacyDcpPruningKeys,
  runCompressionBootstrapCommand,
  compareCocoIndexPythonCandidates,
  getCocoIndexPythonCandidates,
  isSupportedCocoIndexPythonVersion,
  parsePythonVersionOutput,
  parseSimpleEnv,
  ensureDcpConfigCompatibility,
  ensureCompressionPolicyFile,
  ensureCompressionRoutingProjection,
  ensureCompressionAdjunctEngines,
  finalizeProfileRuntimeConvergence,
  verifyRtkRuntime,
  verifyCavemanRuntime,
  resolveCocoIndexMcpExecutable,
  resolveCocoIndexCommand,
  resolveCommandPath,
  resolveBundledSkillsDir,
  resolveCocoIndexPythonCommand,
  runCocoIndexReadinessChecks,
  resolveWslHostProfile,
  inspectCocoIndexRetentionState,
  persistCocoIndexRetentionState,
  ensureCocoIndexCommandShim,
  installCocoIndexPackage,
  isCocoIndexCommandReady,
  resolveHealthyCocoIndexCommand,
  resolveInstallerPathContract,
  resolvePowerShellExecutable,
  getPowerShellEditorServicesState,
  inferOpenAiRuntimeLaneFromVersion,
  isPlainObject,
  loadJsonObjectOrNull,
  mergeObjectWithExistingPriority,
  ensureWindowsUserPathEntry,
  isWslEnvironment,
  resolveOpenAiRuntimeLane,
  resolveCompressionExternalEngineStatus,
  resolveRtkCommand,
  resolveMultiAuthDistPath,
  resolveMultiAuthPluginRoot,
  runLinuxPackageInstallCommand,
  writePluginInstallFingerprintMarker,
  resolveCommandLookupResults,
  resolveSetupBunExecutable,
  applyRuntimeVariantBaselines,
  applyResourceModePolicy,
  applyRuntimeFallbackModelOverrides,
  applyTaskCompatAliasLayer,
  applyRuntimeLspOverrides,
  enforceOauthCompatiblePluginStack,
  rewriteMultiAuthPluginSpec,
  buildPluginInstallDependencies,
  syncMultiAuthToTargetNodeModules,
  syncOpenAiAuthPluginToTarget,
  syncCoreProviderAuthState,
  getCoreProviderAuthStatePath,
  readExistingTargetOpencodeSnapshot,
  readExistingCompressionState,
  mergeOhMyOpencodeWithExisting,
  readExistingTargetOhMyOpencodeSnapshot,
  mergePluginArray,
  readBundledVersion,
  createManagedBackup,
  normalizeManagedBackupFiles,
  pruneManagedBackupFiles,
  listManagedBackupFiles,
  getManagedGlobalToolDependencies,
  listMissingManagedGlobalDependencies,
  getStaleCachePaths,
  ensurePowerShellEditorServices,
  ensureGlobalToolDependencies,
  resolveManagedBackupDir,
  validateModelReferences,
  splitPluginSpec,
  resolveOauthCompatiblePluginVersions,
  calcHardwareConcurrency,
  LEGACY_TASK_ALIAS_MAP,
};
