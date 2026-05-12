#!/usr/bin/env node

const { spawnSync } = require("node:child_process")
const crypto = require("node:crypto")
const fs = require("node:fs")
const path = require("node:path")
const { runWithProgress } = require("../scripts/progress-messenger.cjs")
const { readBundledVersion, resolveInstallerPathContract } = require("../scripts/setup.js")

function resolveAssetRoot() {
  if (process.env.OCS_ASSET_ROOT) {
    return process.env.OCS_ASSET_ROOT
  }

  const packageRoot = path.resolve(__dirname, "..")
  if (fs.existsSync(path.join(packageRoot, "scripts", "setup.js"))) {
    return packageRoot
  }

  return process.cwd()
}

function readVersion(assetRoot) {
  return readBundledVersion(assetRoot, { fsApi: fs, pathApi: path, fallbackVersion: "unknown" })
}

const DEFAULT_COMPRESSION_CONFIG = {
  schemaVersion: 1,
  engine: "dcp",
  intentMode: "balanced",
  routing: {
    autoCommandPathEngine: "rtk",
    autoProsePathEngine: "caveman",
    defaultEngine: "dcp",
    ambiguousIntent: "reject",
    unavailableEngineBehavior: "error",
  },
  engines: {
    dcp: { enabled: true },
    caveman: { enabled: true, mode: "ultra" },
    rtk: { enabled: true },
  },
}

const COMPRESSION_EXTERNAL_ENGINE_STATUS = {
  managed: "managed",
  missing: "missing",
}

const VALID_COMPRESSION_ENGINES = ["dcp", "caveman", "rtk", "auto"]
const VALID_CAVEMAN_MODES = ["lite", "full", "ultra"]
const VALID_INTENT_MODES = ["balanced", "aggressive", "command-heavy"]
const KNOWN_COMMAND_PREFIXES = new Set([
  "git",
  "npm",
  "npx",
  "pnpm",
  "bun",
  "node",
  "python",
  "python3",
  "pip",
  "pipx",
  "docker",
  "docker-compose",
  "kubectl",
  "k",
  "cargo",
  "go",
  "make",
  "cmake",
  "java",
  "mvn",
  "gradle",
  "pytest",
  "jest",
  "playwright",
  "bash",
  "sh",
  "pwsh",
  "powershell",
  "ls",
  "cat",
  "grep",
  "rg",
  "find",
  "sed",
  "awk",
  "curl",
  "wget",
  "ocs",
  "opencode",
  "ccc",
  "rtk",
])
const PROSE_ROUTE_HINT = /\b(readme|documentation|docs|release notes?|faq|headline|subheadline|landing page|meta description|seo|copywriting|copywriter|hero section|onboarding copy|rewrite this copy|draft this copy|write docs|write documentation)\b/i
const IMPLEMENTATION_ROUTE_HINT = /\b(implement|fix|refactor|debug|stabilize|harden|repair|optimize|migrate|integrate|wire|add support|add handling|remove support|align|update)\b/i
const TECHNICAL_OBJECT_HINT = /\b(retry|timeout|provider|runtime|plugin|route|routing|schema|state|persistence|auth|quota|handler|guard|migration|database|mcp|lsp|model|config|build|deploy|release pipeline|api)\b/i
const COMMAND_ROUTE_PROMPT = /^(\$|>|PS>|C:\\>|\/usr\/bin\/|\/bin\/)/
const COMMAND_ROUTE_OPERATORS = /(&&|\|\||\s\|\s|\s>\s|\s2>\s|;)/

function clone(value) {
  return JSON.parse(JSON.stringify(value))
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function mergeObjectWithExistingPriority(template, existing) {
  if (!isPlainObject(template)) {
    return isPlainObject(existing) ? clone(existing) : template
  }

  const merged = clone(template)
  if (!isPlainObject(existing)) {
    return merged
  }

  for (const [key, value] of Object.entries(existing)) {
    if (isPlainObject(value) && isPlainObject(merged[key])) {
      merged[key] = mergeObjectWithExistingPriority(merged[key], value)
    } else {
      merged[key] = clone(value)
    }
  }

  return merged
}

function resolveRuntimePathContract(options = {}) {
  return resolveInstallerPathContract({
    env: options.env || process.env,
    platform: options.platform || process.platform,
  })
}

function resolveConfigDir(env = process.env, options = {}) {
  return resolveRuntimePathContract({
    env,
    platform: options.platform,
  }).targetConfigDir
}

function resolveRuntimeOpencodePath(options = {}) {
  return resolveRuntimePathContract(options).targetOpencodeJsonPath
}

function resolveCompressionProjectionPath(options = {}) {
  return resolveRuntimePathContract(options).projectionFilePath
}

function resolveCompressionPolicyPath(options = {}) {
  return resolveRuntimePathContract(options).policyFilePath
}

function extractCompressionControlPlane(source) {
  if (isPlainObject(source?.controlPlane)) {
    return source.controlPlane
  }

   if (isPlainObject(source?.compression)) {
    return source.compression
  }

  return null
}

function loadBundledCompressionDefaults(assetRoot) {
  try {
    const setupRuntimePath = path.join(assetRoot, "scripts", "constants", "setup-runtime.json")
    const setupRuntime = JSON.parse(fs.readFileSync(setupRuntimePath, "utf8"))
    if (isPlainObject(setupRuntime.compression)) {
      return mergeObjectWithExistingPriority(DEFAULT_COMPRESSION_CONFIG, setupRuntime.compression)
    }
  } catch {}

  try {
    const bundledConfigPath = path.join(assetRoot, "opencode.json")
    const bundledConfig = JSON.parse(fs.readFileSync(bundledConfigPath, "utf8"))
    const bundledCompression = extractCompressionControlPlane(bundledConfig)
    if (isPlainObject(bundledCompression)) {
      return mergeObjectWithExistingPriority(DEFAULT_COMPRESSION_CONFIG, bundledCompression)
    }
  } catch {}

  return clone(DEFAULT_COMPRESSION_CONFIG)
}

function ensureCompressionConfig(config, assetRoot) {
  const next = isPlainObject(config) ? clone(config) : {}
  const bundledDefaults = loadBundledCompressionDefaults(assetRoot)
  const policyPath = resolveCompressionPolicyPath()
  const projectionPath = resolveCompressionProjectionPath()
  const projectionSource = (() => {
    try {
      if (fs.existsSync(policyPath)) {
        return JSON.parse(fs.readFileSync(policyPath, "utf8"))
      }

      if (fs.existsSync(projectionPath)) {
        return JSON.parse(fs.readFileSync(projectionPath, "utf8"))
      }
    } catch {}

    return null
  })()
  const previousOcs = isPlainObject(next.ocs) ? next.ocs : {}
  const previousCompression = extractCompressionControlPlane(projectionSource) || {}

  next.ocs = {
    ...previousOcs,
    compression: mergeObjectWithExistingPriority(
      bundledDefaults,
      previousCompression,
    ),
  }

  return next
}

function buildCompressionPolicy(config, policyPath = resolveCompressionPolicyPath()) {
  const compression = mergeObjectWithExistingPriority(
    DEFAULT_COMPRESSION_CONFIG,
    config?.ocs?.compression || extractCompressionControlPlane(config) || {},
  )

  return {
    schemaVersion: 1,
    managedBy: "ocs",
    policyFilePath: policyPath,
    compression,
  }
}

function sanitizeRuntimeOpencodeConfig(config) {
  if (!isPlainObject(config)) {
    return {}
  }

  const next = clone(config)
  delete next.ocs
  return next
}

function buildCompressionProjection(config, projectionPath = resolveCompressionProjectionPath(), options = {}) {
  const compression = config?.ocs?.compression || DEFAULT_COMPRESSION_CONFIG
  const externalEngineStatus = options.externalEngineStatus || resolveCompressionExternalEngineStatus({
    platform: options.platform,
    commandLookup: options.commandLookup,
    fsApi: options.fsApi,
  })

  return {
    schemaVersion: 1,
    managedBy: "ocs",
    controlPlane: clone(compression),
    runtime: {
      compactEngine: "dcp",
      commandPathPolicy: compression.routing?.autoCommandPathEngine || "rtk",
      prosePathPolicy: compression.routing?.autoProsePathEngine || "caveman",
      ambiguousIntent: compression.routing?.ambiguousIntent || "reject",
      unavailableEngineBehavior: compression.routing?.unavailableEngineBehavior || "error",
      externalEngineConfigStatus: externalEngineStatus,
    },
    artifacts: {
      policyFilePath: resolveCompressionPolicyPath(),
      dcpConfigPath: path.join(resolveConfigDir(), "dcp.jsonc"),
      projectionFilePath: projectionPath,
      rtkPluginPath: path.join(resolveConfigDir(), "plugins", "rtk.ts"),
      cavemanSkillPath: path.join(resolveConfigDir(), "skills", "caveman", "SKILL.md"),
    },
  }
}

function resolveCompressionAdjunctPaths(options = {}) {
  const contract = resolveRuntimePathContract(options)

  return {
    nativeBinDir: contract.nativeBinDir,
    localBinDir: contract.localBinDir,
    rtkExecutablePath: contract.rtkExecutablePath,
    rtkExecutablePaths: contract.rtkExecutablePaths,
    rtkPluginPath: contract.rtkPluginPath,
    cavemanSkillPath: contract.cavemanSkillPath,
  }
}

function buildRtkShimPaths(options = {}) {
  const { env = process.env, platform = process.platform } = options
  const { localBinDir } = resolveRuntimePathContract(options)
  const bunBinDir = path.join(resolveRuntimePathContract(options).homeDir, ".bun", "bin")
  if (platform !== "win32") {
    return []
  }

  return [path.join(bunBinDir, "rtk.cmd"), path.join(bunBinDir, "rtk.ps1"), path.join(localBinDir, "rtk.cmd")]
}

function resolveRtkCommand(options = {}) {
  const platform = options.platform || process.platform
  const commandLookup = options.commandLookup || runCommandLookup
  const env = options.env || process.env
  const fsApi = options.fsApi || fs
  const { rtkExecutablePath, rtkExecutablePaths } = resolveCompressionAdjunctPaths({ env, platform })
  const lookupResults = commandLookup("rtk", env)

  if (platform === "win32") {
    if (lookupResults.length === 0) {
      return null
    }

    const shimCandidates = buildRtkShimPaths({ env, platform })
      .filter((candidate) => fsApi.existsSync(candidate))
      .map((candidate) => path.normalize(candidate).toLowerCase())
    const winner = path.normalize(String(lookupResults[0] || ""))
    const managed = path.normalize(rtkExecutablePath)
    const normalizedWinner = winner.toLowerCase()
    if ((normalizedWinner !== managed.toLowerCase() && !shimCandidates.includes(normalizedWinner)) || !fsApi.existsSync(rtkExecutablePath)) {
      return null
    }

    return rtkExecutablePath
  }

  const managedCandidate = rtkExecutablePaths.find((candidate) => fsApi.existsSync(candidate))
  if (lookupResults.length > 0) {
    if (managedCandidate) {
      const winner = path.normalize(String(lookupResults[0] || ""))
      const managed = path.normalize(managedCandidate)
      if (winner !== managed) {
        return null
      }
      return managedCandidate
    }

    return "rtk"
  }

  if (managedCandidate) {
    if (pathEntryMatches(managedCandidate, rtkExecutablePaths[0], platform)) {
      return managedCandidate
    }
    return null
  }

  return null
}

function verifyRtkRuntime(options = {}) {
  const env = options.env || process.env
  const platform = options.platform || process.platform
  const commandLookup = options.commandLookup || runCommandLookup
  const fsApi = options.fsApi || fs
  const spawn = options.spawn || spawnSync
  const { rtkExecutablePath, rtkExecutablePaths, rtkPluginPath } = resolveCompressionAdjunctPaths({ env, platform })
  const managedExecutablePath = rtkExecutablePaths.find((candidate) => fsApi.existsSync(candidate)) || rtkExecutablePath
  const managedBinDirs = Array.from(new Set(rtkExecutablePaths.map((candidate) => path.dirname(candidate))))
  const hasManagedPath = envPathEntries(env, platform).some((entry) => managedBinDirs.some((dir) => pathEntryMatches(entry, dir, platform)))
  const command = resolveRtkCommand({ commandLookup, fsApi, platform, env })
  const managedBinaryExists = fsApi.existsSync(managedExecutablePath)
  const canProbeManagedBinary = managedBinaryExists && (hasManagedPath || platform === "win32")
  if ((!command && !canProbeManagedBinary) || !fsApi.existsSync(rtkPluginPath)) {
    return false
  }
  const probeCommand = command || managedExecutablePath

  const probe = (args) => {
    const result = spawn(probeCommand, args, {
      env: withNormalizedWindowsPathEnv(env),
      stdio: "ignore",
    })
    return result && result.status === 0
  }

  return probe(["--version"]) && probe(["init", "--show"]) && probe(["gain"])
}

function resolveCompressionExternalEngineStatus(options = {}) {
  const env = options.env || process.env
  const platform = options.platform || process.platform
  const commandLookup = options.commandLookup || runCommandLookup
  const fsApi = options.fsApi || fs
  const spawn = options.spawn || spawnSync
  const { cavemanSkillPath } = resolveCompressionAdjunctPaths({ env, platform })
  const rtkReady = verifyRtkRuntime({ env, platform, commandLookup, fsApi, spawn })
  const cavemanReady = fsApi.existsSync(cavemanSkillPath)

  return {
    dcp: COMPRESSION_EXTERNAL_ENGINE_STATUS.managed,
    rtk: rtkReady ? COMPRESSION_EXTERNAL_ENGINE_STATUS.managed : COMPRESSION_EXTERNAL_ENGINE_STATUS.missing,
    caveman: cavemanReady ? COMPRESSION_EXTERNAL_ENGINE_STATUS.managed : COMPRESSION_EXTERNAL_ENGINE_STATUS.missing,
  }
}

function writeCompressionPolicy(config) {
  const policyPath = resolveCompressionPolicyPath()
  const policy = buildCompressionPolicy(config, policyPath)
  fs.writeFileSync(policyPath, `${JSON.stringify(policy, null, 2)}\n`, "utf8")
  return policyPath
}

function writeCompressionProjection(config) {
  const projectionPath = resolveCompressionProjectionPath()
  const projection = buildCompressionProjection(config, projectionPath)
  fs.writeFileSync(projectionPath, `${JSON.stringify(projection, null, 2)}\n`, "utf8")
  return projectionPath
}

function parseCompressArgs(rawArgs) {
  if (rawArgs.length === 0) {
    return { help: false, action: "show", unknown: [] }
  }

  if (hasHelpFlag(rawArgs)) {
    return { help: true, action: null, unknown: [] }
  }

  const [action, ...rest] = rawArgs
  if (action === "show") {
    return { help: false, action: "show", unknown: rest }
  }

  if (action === "engine") {
    const engine = rest[0]
    let cavemanMode = null
    const unknown = []

    for (let i = 1; i < rest.length; i += 1) {
      const token = rest[i]
      if (token === "--mode") {
        cavemanMode = rest[i + 1] || null
        i += 1
        continue
      }
      unknown.push(token)
    }

    return { help: false, action: "engine", engine, cavemanMode, unknown }
  }

  if (action === "intent") {
    return {
      help: false,
      action: "intent",
      intentMode: rest[0] || null,
      unknown: rest.slice(1),
    }
  }

  if (action === "explain") {
    let useStdin = false
    const parts = []

    for (let i = 0; i < rest.length; i += 1) {
      const token = rest[i]
      if (token === "--stdin") {
        useStdin = true
        continue
      }
      parts.push(token)
    }

    return {
      help: false,
      action: "explain",
      useStdin,
      inputText: parts.join(" ").trim(),
      unknown: [],
    }
  }

  return { help: false, action: null, unknown: rawArgs }
}

function readStdinText() {
  try {
    if (process.stdin.isTTY) {
      return ""
    }
    return fs.readFileSync(0, "utf8").trim()
  } catch {
    return ""
  }
}

function looksLikeCommandPath(text, intentMode = "balanced") {
  const trimmed = String(text || "").trim()
  if (!trimmed) {
    return false
  }

  if (COMMAND_ROUTE_PROMPT.test(trimmed) || COMMAND_ROUTE_OPERATORS.test(trimmed)) {
    return true
  }

  const firstLine = trimmed.split(/\r?\n/, 1)[0].trim()
  const firstToken = firstLine.split(/\s+/, 1)[0].toLowerCase()
  if (KNOWN_COMMAND_PREFIXES.has(firstToken)) {
    return true
  }

  if (intentMode === "command-heavy") {
    return /\b(run|execute|rerun|invoke)\b.+\b(test|build|deploy|doctor|install|command|script)\b/i.test(trimmed)
  }

  return false
}

function looksLikeProsePath(text, intentMode = "balanced") {
  const trimmed = String(text || "").trim()
  if (!trimmed) {
    return false
  }

  if (PROSE_ROUTE_HINT.test(trimmed)) {
    return true
  }

  const lineCount = trimmed.split(/\r?\n/).length
  const longForm = trimmed.length >= (intentMode === "aggressive" ? 180 : 260)
  const markdownLike = /(^#\s)|(^-\s)|(^\d+\.\s)/m.test(trimmed)
  if (markdownLike && longForm) {
    return true
  }

  return lineCount >= 4 && longForm
}

function looksLikeImplementationPath(text) {
  const trimmed = String(text || "").trim()
  if (!trimmed) {
    return false
  }

  return IMPLEMENTATION_ROUTE_HINT.test(trimmed) && TECHNICAL_OBJECT_HINT.test(trimmed)
}

function resolveCompressionRoute(config, inputText) {
  const compression = config?.ocs?.compression || DEFAULT_COMPRESSION_CONFIG
  const engine = compression.engine || "dcp"
  const intentMode = compression.intentMode || "balanced"
  const cavemanMode = compression.engines?.caveman?.mode || "ultra"
  const routing = compression.routing || DEFAULT_COMPRESSION_CONFIG.routing

  if (engine !== "auto") {
    return {
      status: "ok",
      engine,
      reason: "explicit_engine_setting",
      cavemanMode: engine === "caveman" ? cavemanMode : null,
      intentMode,
    }
  }

  const commandPath = looksLikeCommandPath(inputText, intentMode)
  const prosePath = looksLikeProsePath(inputText, intentMode)
  const implementationPath = looksLikeImplementationPath(inputText)

  if ((commandPath && prosePath) || (prosePath && implementationPath)) {
    return {
      status: routing.ambiguousIntent === "reject" ? "ambiguous" : "ok",
      engine: routing.defaultEngine || "dcp",
      reason: "ambiguous_intent",
      cavemanMode,
      intentMode,
    }
  }

  if (commandPath) {
    return {
      status: "ok",
      engine: routing.autoCommandPathEngine || "rtk",
      reason: "auto_command_path",
      cavemanMode: null,
      intentMode,
    }
  }

  if (prosePath) {
    return {
      status: "ok",
      engine: routing.autoProsePathEngine || "caveman",
      reason: "auto_prose_path",
      cavemanMode,
      intentMode,
    }
  }

  return {
    status: "ok",
    engine: routing.defaultEngine || "dcp",
    reason: "auto_default",
    cavemanMode: null,
    intentMode,
  }
}

function formatCompressionRoute(route) {
  return [
    `status=${route.status}`,
    `engine=${route.engine}`,
    `reason=${route.reason}`,
    `intentMode=${route.intentMode}`,
    `caveman.mode=${route.cavemanMode || "n/a"}`,
  ].join("\n")
}

function setCompressionEngine(config, engine, cavemanMode = null) {
  if (!VALID_COMPRESSION_ENGINES.includes(engine)) {
    throw new Error(`Unsupported compression engine: ${engine}`)
  }

  if (cavemanMode && !VALID_CAVEMAN_MODES.includes(cavemanMode)) {
    throw new Error(`Unsupported Caveman mode: ${cavemanMode}`)
  }

  if (cavemanMode && engine !== "caveman" && engine !== "auto") {
    throw new Error("--mode is only valid with engine 'caveman' or 'auto'")
  }

  const next = clone(config)
  next.ocs.compression.engine = engine
  if (cavemanMode) {
    next.ocs.compression.engines.caveman.mode = cavemanMode
  }
  return next
}

function setCompressionIntentMode(config, intentMode) {
  if (!VALID_INTENT_MODES.includes(intentMode)) {
    throw new Error(`Unsupported compression intent mode: ${intentMode}`)
  }

  const next = clone(config)
  next.ocs.compression.intentMode = intentMode
  return next
}

function formatCompressionState(config) {
  const compression = config?.ocs?.compression || DEFAULT_COMPRESSION_CONFIG
  return [
    `engine=${compression.engine}`,
    `intentMode=${compression.intentMode}`,
    `caveman.mode=${compression.engines?.caveman?.mode || "ultra"}`,
    `routing.default=${compression.routing?.defaultEngine || "dcp"}`,
    `routing.command=${compression.routing?.autoCommandPathEngine || "rtk"}`,
    `routing.prose=${compression.routing?.autoProsePathEngine || "caveman"}`,
  ].join("\n")
}

function printCompressionHelp() {
  console.log("Usage:")
  console.log("  ocs compress")
  console.log("  ocs compress show")
  console.log("  ocs compress explain <text...>")
  console.log("  ocs compress explain --stdin")
  console.log("  ocs compress engine <dcp|caveman|rtk|auto> [--mode <lite|full|ultra>]")
  console.log("  ocs compress intent <balanced|aggressive|command-heavy>")
  console.log("")
  console.log("Default routing:")
  console.log("  engine=dcp")
  console.log("  intentMode=balanced")
  console.log("  routing.default=dcp")
  console.log("  routing.command=rtk")
  console.log("  routing.prose=caveman")
}

function handleCompressionCommand(assetRoot, rawArgs) {
  const parsed = parseCompressArgs(rawArgs)
  if (parsed.help) {
    printCompressionHelp()
    return 0
  }

  if (parsed.unknown.length > 0 || !parsed.action) {
    console.error(`Unknown compress option(s): ${parsed.unknown.join(" ") || rawArgs.join(" ")}`)
    console.error("")
    printCompressionHelp()
    return 1
  }

  const runtimeConfigPath = resolveRuntimeOpencodePath()
  const hasRuntimeConfig = fs.existsSync(runtimeConfigPath)
  const runtimeConfig = hasRuntimeConfig ? JSON.parse(fs.readFileSync(runtimeConfigPath, "utf8")) : {}
  let nextConfig = ensureCompressionConfig(runtimeConfig, assetRoot)
  const hasLegacyOcsBlock = hasRuntimeConfig && isPlainObject(runtimeConfig.ocs)

  try {
    if (parsed.action === "show") {
      if (hasLegacyOcsBlock) {
        fs.writeFileSync(runtimeConfigPath, `${JSON.stringify(sanitizeRuntimeOpencodeConfig(runtimeConfig), null, 2)}\n`, "utf8")
        writeCompressionPolicy(nextConfig)
        writeCompressionProjection(nextConfig)
      }
      console.log(formatCompressionState(nextConfig))
      return 0
    }

    if (parsed.action === "explain") {
      const inputText = parsed.useStdin ? readStdinText() : parsed.inputText
      const route = resolveCompressionRoute(nextConfig, inputText)
      if (hasLegacyOcsBlock) {
        fs.writeFileSync(runtimeConfigPath, `${JSON.stringify(sanitizeRuntimeOpencodeConfig(runtimeConfig), null, 2)}\n`, "utf8")
        writeCompressionPolicy(nextConfig)
        writeCompressionProjection(nextConfig)
      }
      console.log(formatCompressionRoute(route))
      return 0
    }

    if (!hasRuntimeConfig) {
      console.error(`Runtime config not found: ${runtimeConfigPath}`)
      console.error("Run 'ocs setup profile' first so compression settings can be persisted.")
      return 1
    }

    if (parsed.action === "engine") {
      nextConfig = setCompressionEngine(nextConfig, parsed.engine, parsed.cavemanMode)
      fs.writeFileSync(runtimeConfigPath, `${JSON.stringify(sanitizeRuntimeOpencodeConfig(runtimeConfig), null, 2)}\n`, "utf8")
      writeCompressionPolicy(nextConfig)
      writeCompressionProjection(nextConfig)
    } else if (parsed.action === "intent") {
      nextConfig = setCompressionIntentMode(nextConfig, parsed.intentMode)
      fs.writeFileSync(runtimeConfigPath, `${JSON.stringify(sanitizeRuntimeOpencodeConfig(runtimeConfig), null, 2)}\n`, "utf8")
      writeCompressionPolicy(nextConfig)
      writeCompressionProjection(nextConfig)
    }
  } catch (error) {
    console.error(String(error.message || error))
    console.error("")
    printCompressionHelp()
    return 1
  }

  console.log(formatCompressionState(nextConfig))
  return 0
}

function getHelpLines() {
  return [
    "OpenCode Config Suites CLI",
    "",
    "Usage:",
    "  ocs --help",
    "  ocs --version",
    "  ocs setup profile [--update] [--profile <name>] [--mode <id>] [--headless]",
    "  ocs setup update [--profile <name>] [--mode <id>] [--headless]",
    "  ocs setup:update [--profile <name>] [--mode <id>] [--headless]",
    "  ocs prefs [--dry-run] [--rollback <stamp>]",
    "  ocs exa setup --api-key <YOUR_EXA_API_KEY>",
    "  ocs exa check",
    "  ocs doctor [--fix]",
    "  ocs index [status|logs|doctor|stop|rebuild|start] [advanced project recovery]",
    "  ocs compress [show|explain|engine|intent] [options]",
    "",
    "Compatibility aliases:",
    "  ocs setup:profile",
    "  ocs setup:profile:update",
    "  ocs exa:setup --api-key <YOUR_EXA_API_KEY>",
    "  ocs exa:check",
  ]
}

function printHelp() {
  for (const line of getHelpLines()) {
    console.log(line)
  }
}

function getIndexHelpLines() {
  return [
    "CocoIndex project scope is auto-initialized when a root runtime session starts.",
    "Manual `ocs index` commands are advanced recovery tools for the current project root only.",
    "Do not use this surface to index your global home or config directory.",
    "",
    "Usage:",
    "  ocs index status",
    "  ocs index logs [--tail <lines>] [--follow]",
    "  ocs index doctor",
    "  ocs index stop [--timeout <seconds>] [--force]",
    "  ocs index rebuild [--force] [--hard-reset]",
    "  ocs index start [--force] [--wait] [--timeout <seconds>]",
  ]
}

function printIndexHelp() {
  for (const line of getIndexHelpLines()) {
    console.log(line)
  }
}

function printDoctorHelp() {
  console.log("Usage:")
  console.log("  ocs doctor [--fix]")
  console.log("")
  console.log("Options:")
  console.log("  --fix    Attempt safe remediation (pnpm/corepack, PATH bins, ccc/plugin markers)")
  console.log("  -f       Alias for --fix")
  console.log("  --help, -h   Show this help")
}

function mergeWindowsPathValues(pathValue = "", pathAltValue = "") {
  const merged = []
  const seen = new Set()
  const pushEntries = (rawValue) => {
    for (const rawEntry of String(rawValue || "").split(path.delimiter)) {
      const entry = rawEntry.trim()
      if (!entry) {
        continue
      }
      const normalized = path.normalize(entry).replace(/[\\/]+$/, "").toLowerCase()
      if (seen.has(normalized)) {
        continue
      }
      seen.add(normalized)
      merged.push(entry)
    }
  }

  pushEntries(pathValue)
  pushEntries(pathAltValue)
  return merged.join(path.delimiter)
}

function resolveEnvPathValue(env = process.env) {
  if (process.platform === "win32") {
    return mergeWindowsPathValues(env.PATH || "", env.Path || "")
  }

  return String(env.PATH || env.Path || "")
}

function withNormalizedWindowsPathEnv(env = process.env) {
  if (process.platform !== "win32") {
    return env
  }

  const pathValue = resolveEnvPathValue(env)
  return {
    ...env,
    PATH: pathValue,
    Path: pathValue,
  }
}

function runCommandLookup(command, env = process.env) {
  const lookupBinary = process.platform === "win32" ? "where" : "which"
  const result = spawnSync(lookupBinary, [command], {
    encoding: "utf8",
    env: withNormalizedWindowsPathEnv(env),
  })
  if (result.status !== 0) {
    return []
  }

  return String(result.stdout || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function isWindowsMountedCommandPath(filePath, platform = process.platform) {
  if (platform === "win32") {
    return false
  }

  return /^\/mnt\/[a-z]\//i.test(String(filePath || ""))
}

function shouldRejectCrossOsNodeTool(command, platform = process.platform) {
  if (platform === "win32") {
    return false
  }

  return ["node", "npm", "npx", "corepack", "pnpm"].includes(String(command || "").trim())
}

function filterCommandLookupResults(command, results, platform = process.platform) {
  if (!Array.isArray(results)) {
    return []
  }

  if (!shouldRejectCrossOsNodeTool(command, platform)) {
    return results
  }

  return results.filter((candidate) => !isWindowsMountedCommandPath(candidate, platform))
}

function pathEntries() {
  return resolveEnvPathValue(process.env)
    .split(path.delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function envPathEntries(env = process.env, platform = process.platform) {
  const delimiter = platform === "win32" ? ";" : ":"
  return resolveEnvPathValue(env)
    .split(delimiter)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function expectedBinDirs() {
  const home = process.env.HOME || process.env.USERPROFILE || ""
  if (!home) {
    return []
  }

  if (process.platform === "win32") {
    return [
      path.join(home, ".opencode", "bin"),
      path.join(home, ".bun", "bin"),
      path.join(home, ".local", "bin"),
    ]
  }

  return [
    path.join(home, ".opencode", "bin"),
    path.join(home, ".local", "bin"),
    path.join(home, ".bun", "bin"),
    "/usr/local/bin",
  ]
}

function commandCandidates(command, dir) {
  if (process.platform === "win32") {
    return [
      path.join(dir, `${command}.cmd`),
      path.join(dir, `${command}.exe`),
      path.join(dir, `${command}.ps1`),
      path.join(dir, command),
    ]
  }

  return [path.join(dir, command)]
}

function inspectExpectedBins() {
  return expectedBinDirs().map((dir) => {
    const hasOcs = commandCandidates("ocs", dir).some((candidate) => fs.existsSync(candidate))
    const hasOpencode = commandCandidates("opencode", dir).some((candidate) => fs.existsSync(candidate))
    const inPath = pathEntries().includes(dir)
    return { dir, hasOcs, hasOpencode, inPath }
  })
}

const TOOL_STATUS = {
  PASS: "PASS",
  WARN: "WARN",
  FAIL: "FAIL",
}

const TOOL_SPECS = [
  { key: "bun", label: "bun", commands: ["bun"], optional: false },
  { key: "ocs", label: "ocs", commands: ["ocs"], optional: false },
  { key: "opencode", label: "opencode", commands: ["opencode"], optional: false },
  { key: "node", label: "node", commands: ["node"], optional: false },
  { key: "npm", label: "npm", commands: ["npm"], optional: false },
  { key: "pnpm", label: "pnpm", commands: ["pnpm"], optional: false },
  { key: "corepack", label: "corepack", commands: ["corepack"], optional: false },
  { key: "python", label: "python", commands: ["python", "python3"], optional: false },
  { key: "pipx", label: "pipx", commands: ["pipx"], optional: false },
  { key: "ccc", label: "ccc (CocoIndex)", commands: ["ccc"], optional: true },
]

const PLUGIN_RELATIVE_ROOT = path.join("plugins", "opencode-multi-auth")
const PLUGIN_RUNTIME_MARKERS = [
  path.join(".ocs-install-state", "bun-install.fingerprint"),
  path.join("dist", "index.js"),
]

function resolvePluginRuntimeRoot(assetRoot, fsApi = fs) {
  const nestedRoot = path.join(assetRoot, PLUGIN_RELATIVE_ROOT)
  const nestedPackageJson = path.join(nestedRoot, "package.json")
  if (fsApi.existsSync(nestedPackageJson)) {
    return nestedRoot
  }

  const directPackageJson = path.join(assetRoot, "package.json")
  if (fsApi.existsSync(directPackageJson)) {
    try {
      const parsed = JSON.parse(fsApi.readFileSync(directPackageJson, "utf8"))
      if (String(parsed.name || "") === "opencode-multi-auth") {
        return assetRoot
      }
    } catch {
      // ignore json parsing failures; caller will surface marker warnings
    }
  }

  return nestedRoot
}

function determineCommandStatus(spec, options = {}) {
  const lookup = options.lookup || runCommandLookup
  const spawn = options.spawn || spawnSync
  const platform = options.platform || process.platform
  const hits = []

  for (const command of spec.commands) {
    const paths = filterCommandLookupResults(command, lookup(command), platform)
    for (const resolvedPath of paths) {
      hits.push({ command, path: resolvedPath })
    }
  }

  if (hits.length > 0) {
    const first = hits[0]
    const details = first.command === first.path ? first.path : `${first.command} -> ${first.path}`
    return {
      key: spec.key,
      label: spec.label,
      status: TOOL_STATUS.PASS,
      detail: details,
      commands: spec.commands,
    }
  }

  if (spec.key === "pipx") {
    const pythonCommands = ["python3", "python"]
    for (const pythonCommand of pythonCommands) {
      const result = spawn(pythonCommand, ["-m", "pipx", "--version"], {
        stdio: "ignore",
      })
      if (result && result.status === 0) {
        return {
          key: spec.key,
          label: spec.label,
          status: TOOL_STATUS.PASS,
          detail: `${pythonCommand} -m pipx`,
          commands: spec.commands,
        }
      }
    }
  }

  const status = spec.optional ? TOOL_STATUS.WARN : TOOL_STATUS.FAIL
  const message = spec.optional
    ? "Not found (optional tooling)"
    : `${spec.commands.join("/")}: not found in PATH`

  return {
    key: spec.key,
    label: spec.label,
    status,
    detail: message,
    commands: spec.commands,
  }
}

function buildPluginHealthRow(assetRoot) {
  const pluginRoot = resolvePluginRuntimeRoot(assetRoot)
  const markerPaths = PLUGIN_RUNTIME_MARKERS.map((marker) => path.join(pluginRoot, marker))
  const missing = markerPaths.filter((marker) => !fs.existsSync(marker))

  if (missing.length === 0) {
    return {
      key: "plugin",
      label: "opencode-multi-auth plugin",
      status: TOOL_STATUS.PASS,
      detail: "dist build and bun fingerprint present",
    }
  }

  const relativeMissing = missing
    .map((markerPath) => path.relative(assetRoot, markerPath) || markerPath)
    .join(", ")

  return {
    key: "plugin",
    label: "opencode-multi-auth plugin",
    status: TOOL_STATUS.WARN,
    detail: `Missing runtime markers: ${relativeMissing}`,
  }
}

function getWslExecutableName() {
  return process.platform === "win32" ? "wsl" : "wsl"
}

function getNpxExecutableName() {
  return process.platform === "win32" ? "npx.cmd" : "npx"
}

function getNpmExecutableName() {
  return process.platform === "win32" ? "npm.cmd" : "npm"
}

function getCorepackExecutableName() {
  return process.platform === "win32" ? "corepack.cmd" : "corepack"
}

function getWindowsUserPathValue(spawn = spawnSync) {
  if (process.platform !== "win32") {
    return ""
  }

  const result = spawn("powershell.exe", [
    "-NoProfile",
    "-Command",
    "[Environment]::GetEnvironmentVariable('Path','User')",
  ], {
    encoding: "utf8",
    stdio: "pipe",
  })

  if (!result || result.error || result.status !== 0) {
    return ""
  }

  return String(result.stdout || "").trim()
}

function buildRtkHealthRow(options = {}) {
  const {
    commandLookup = runCommandLookup,
    spawn = spawnSync,
    platform = process.platform,
    env = process.env,
    fsApi = fs,
    getWindowsUserPath = getWindowsUserPathValue,
  } = options

  const command = resolveRtkCommand({ commandLookup, fsApi, platform, env })
  const { rtkExecutablePath, rtkExecutablePaths, rtkPluginPath } = resolveCompressionAdjunctPaths({ env, platform })
  const managedExecutablePath = rtkExecutablePaths.find((candidate) => fsApi.existsSync(candidate)) || rtkExecutablePath
  const managedBinDirs = Array.from(new Set(rtkExecutablePaths.map((candidate) => path.dirname(candidate))))
  const hasManagedPath = envPathEntries(env, platform).some((entry) => managedBinDirs.some((dir) => pathEntryMatches(entry, dir, platform)))
  const managedBinaryExists = fsApi.existsSync(managedExecutablePath)
  const localManagedFallback = platform !== "win32"
    && !command
    && managedBinaryExists
    && Boolean(rtkExecutablePaths[1])
    && pathEntryMatches(managedExecutablePath, rtkExecutablePaths[1], platform)
  const persistedUserPath = platform === "win32" ? getWindowsUserPath(spawn) : ""
  const userPathHasManagedDir = platform === "win32"
    ? envPathEntries({ PATH: persistedUserPath }, platform).some((entry) => managedBinDirs.some((dir) => pathEntryMatches(entry, dir, platform)))
    : false

  const windowsManagedDirectProbe = platform === "win32" && !command && managedBinaryExists

  if (!command && !localManagedFallback && !windowsManagedDirectProbe) {
    return {
      key: "rtk",
      label: "rtk runtime",
      status: TOOL_STATUS.WARN,
      detail: platform === "win32"
        ? hasManagedPath && managedBinaryExists
          ? "Native RTK binary exists in the managed bin path, but the current shell still cannot resolve the managed RTK from PATH."
          : userPathHasManagedDir && managedBinaryExists
            ? "RTK is installed and persisted to User PATH, but this shell has not refreshed yet. Open a new shell or reload PATH."
          : "Native RTK binary not found in PATH. Re-run installer/setup so RTK can be installed natively."
        : hasManagedPath && managedBinaryExists
          ? "Managed RTK exists, but a foreign RTK wins PATH precedence."
          : "Native RTK binary not found in PATH.",
    }
  }

  if (!fsApi.existsSync(rtkPluginPath)) {
    return {
      key: "rtk",
      label: "rtk runtime",
      status: TOOL_STATUS.WARN,
      detail: "RTK OpenCode hook marker missing: plugins/rtk.ts",
    }
  }

  const probeCommand = command || managedExecutablePath

  const probe = (args) => {
    const result = spawn(probeCommand, args, {
      env: withNormalizedWindowsPathEnv(env),
      stdio: "ignore",
    })
    return result && result.status === 0
  }

  const versionOk = probe(["--version"])
  const showOk = probe(["init", "--show"])
  const gainOk = probe(["gain"])
  const ready = versionOk && showOk && gainOk

  return {
    key: "rtk",
    label: "rtk runtime",
    status: ready ? TOOL_STATUS.PASS : TOOL_STATUS.WARN,
    detail: ready
      ? "Native RTK verified with --version, init --show, and gain"
      : hasManagedPath && managedBinaryExists
        ? "Managed RTK wins PATH, but readiness probes still failed"
        : "Native RTK readiness checks failed",
  }
}

function buildCavemanHealthRow(options = {}) {
  const {
    commandLookup = runCommandLookup,
    fsApi = fs,
    platform = process.platform,
    env = process.env,
  } = options

   const { cavemanSkillPath } = resolveCompressionAdjunctPaths({ env, platform })
   const cavemanReady = fsApi.existsSync(cavemanSkillPath)

  if (cavemanReady) {
    return {
      key: "caveman",
      label: "caveman skill",
      status: TOOL_STATUS.PASS,
      detail: `skill marker present: ${path.relative(resolveConfigDir(), cavemanSkillPath)}`,
    }
  }

   const commandHint = commandLookup("npx").length > 0
     ? 'npx -y skills add JuliusBrussee/caveman -a opencode -s "*" -g -y'
     : "npx is not available"

  return {
    key: "caveman",
    label: "caveman skill",
    status: TOOL_STATUS.WARN,
    detail: platform === "win32"
      ? `Caveman skill marker missing; run ${commandHint}`
      : `Caveman skill marker missing; run ${commandHint}`,
  }
}

function runDoctorChecks(assetRoot, options = {}) {
  const commandLookup = options.commandLookup || runCommandLookup
  const platform = options.platform || process.platform
  const env = options.env || process.env
  const spawn = options.spawn || spawnSync
  const fsApi = options.fsApi || fs
  const getWindowsUserPath = options.getWindowsUserPath || getWindowsUserPathValue
  const toolRows = TOOL_SPECS.map((spec) =>
    determineCommandStatus(spec, { lookup: commandLookup, platform, spawn }),
  )
  const expectedBinsList = inspectExpectedBins()
  const hasHealthyBinDir = expectedBinsList.some(
    (entry) => entry.inPath && (entry.hasOcs || entry.hasOpencode),
  )

  return {
    rows: [
      ...toolRows,
      buildRtkHealthRow({ commandLookup, spawn, platform, env, fsApi, getWindowsUserPath }),
      buildCavemanHealthRow({ commandLookup, fsApi, platform, env }),
      buildPluginHealthRow(assetRoot),
    ],
    expectedBins: expectedBinsList,
    hasHealthyBinDir,
  }
}

function pad(value, width) {
  return String(value).padEnd(width, " ")
}

function formatStatusTable(rows) {
  const statusHeader = "STATUS"
  const checkHeader = "CHECK"
  const statusWidth = Math.max(
    statusHeader.length,
    ...rows.map((row) => row.status.length),
  )
  const checkWidth = Math.max(
    checkHeader.length,
    ...rows.map((row) => row.label.length),
  )

  console.log("Status table:")
  console.log(
    `| ${pad(statusHeader, statusWidth)} | ${pad(checkHeader, checkWidth)} | DETAILS`,
  )

  for (const row of rows) {
    console.log(
      `| ${pad(row.status, statusWidth)} | ${pad(row.label, checkWidth)} | ${row.detail}`,
    )
  }
}

function pathEntryMatches(entryValue, dirValue, platform = process.platform) {
  if (!entryValue || !dirValue) {
    return false
  }

  const normalizedEntry = path.normalize(entryValue)
  const normalizedDir = path.normalize(dirValue)
  if (platform === "win32") {
    return normalizedEntry.toLowerCase() === normalizedDir.toLowerCase()
  }

  return normalizedEntry === normalizedDir
}

function ensureExpectedBinDirsOnPath() {
  const currentBins = inspectExpectedBins()
  let changed = false

  for (const entry of currentBins) {
    try {
      fs.mkdirSync(entry.dir, { recursive: true })
    } catch (error) {
      console.log(`   ⚠️ Unable to ensure bin dir ${entry.dir}: ${error.message}`)
      continue
    }

    const currentPathEntries = pathEntries()
    const alreadyPresent = currentPathEntries.some((pathEntry) =>
      pathEntryMatches(pathEntry, entry.dir),
    )

    if (alreadyPresent) {
      continue
    }

    const currentPath = resolveEnvPathValue(process.env)
    const nextPath = `${entry.dir}${path.delimiter}${currentPath}`
    process.env.PATH = nextPath
    if (process.platform === "win32") {
      process.env.Path = nextPath
    }
    console.log(
      `   ✅ Added ${entry.dir} to PATH for this session (update your shell config to persist).`,
    )
    changed = true
  }

  return changed
}

function runRemediationCommand(command, args, options = {}) {
  const {
    spawn = spawnSync,
    log = console.log,
    cwd,
    env = process.env,
  } = options

  const result = spawn(command, args, {
    stdio: "inherit",
    env,
    cwd,
  })

  if (result.error) {
    log(`   ⚠️ ${command} remediation error: ${result.error.message}`)
    return false
  }

  if (result.status !== 0) {
    log(`   ⚠️ ${command} remediation exited with a non-zero status.`)
    return false
  }

  return true
}

function fixMissingPnpm(rows, options = {}) {
  const {
    spawn = spawnSync,
    log = console.log,
  } = options
  const pnpmRow = rows.find((row) => row.key === "pnpm")
  if (!pnpmRow || pnpmRow.status === TOOL_STATUS.PASS) {
    return false
  }

  const corepackRow = rows.find((row) => row.key === "corepack")
  const npmRow = rows.find((row) => row.key === "npm")

  log("Attempting safe pnpm remediation via corepack/npm fallback...")
  if (corepackRow && corepackRow.status === TOOL_STATUS.PASS) {
    runRemediationCommand(getCorepackExecutableName(), ["prepare", "pnpm@latest", "--activate"], {
      spawn,
      log,
    })
    return true
  }

  if (npmRow && npmRow.status === TOOL_STATUS.PASS) {
    runRemediationCommand(getNpmExecutableName(), ["install", "-g", "pnpm"], {
      spawn,
      log,
    })
    return true
  }

  log("   ⚠️ Unable to auto-fix pnpm: corepack and npm are unavailable.")
  return false
}

function fixMissingCorepack(rows, options = {}) {
  const {
    spawn = spawnSync,
    log = console.log,
  } = options
  const corepackRow = rows.find((row) => row.key === "corepack")
  if (!corepackRow || corepackRow.status === TOOL_STATUS.PASS) {
    return false
  }

  const npmRow = rows.find((row) => row.key === "npm")
  if (!npmRow || npmRow.status !== TOOL_STATUS.PASS) {
    log("   ⚠️ Unable to auto-fix corepack: npm is not available.")
    return false
  }

  log("Attempting safe corepack remediation via npm...")
  runRemediationCommand(getNpmExecutableName(), ["install", "-g", "corepack", "--force"], {
    spawn,
    log,
  })
  return true
}

function fixMissingPipx(rows, options = {}) {
  const {
    spawn = spawnSync,
    log = console.log,
    commandLookup = runCommandLookup,
  } = options

  const pipxRow = rows.find((row) => row.key === "pipx")
  if (!pipxRow || pipxRow.status === TOOL_STATUS.PASS) {
    return false
  }

  const pythonRow = rows.find((row) => row.key === "python")
  if (!pythonRow || pythonRow.status !== TOOL_STATUS.PASS) {
    log("   ⚠️ Unable to auto-fix pipx: python runtime is not available.")
    return false
  }

  const pythonCommand = (commandLookup("python3") || []).length > 0 ? "python3" : "python"

  log("Attempting safe pipx remediation via user-level pip install...")
  runRemediationCommand(pythonCommand, ["-m", "pip", "install", "--user", "pipx"], {
    spawn,
    log,
  })
  runRemediationCommand(pythonCommand, ["-m", "pipx", "ensurepath"], {
    spawn,
    log,
  })

  return true
}

function shouldFixRtk(rows) {
  const rtkRow = rows.find((row) => row.key === "rtk")
  return Boolean(rtkRow && rtkRow.status !== TOOL_STATUS.PASS)
}

function shouldFixCompressionAdjunctEngines(rows) {
  return shouldFixRtk(rows) || shouldFixCaveman(rows)
}

function fixCompressionAdjunctEngines(rows, options = {}) {
  const {
    assetRoot = resolveAssetRoot(),
    fsApi = fs,
    spawn = spawnSync,
    commandLookup = runCommandLookup,
    log = console.log,
  } = options

  if (!shouldFixCompressionAdjunctEngines(rows)) {
    return false
  }

  const setupScriptPath = path.join(assetRoot, "scripts", "setup.js")
  if (!fsApi.existsSync(setupScriptPath)) {
    log("   ⚠️ Unable to auto-fix RTK/Caveman: setup script is unavailable in this bundle.")
    return false
  }

  if ((commandLookup("bun") || []).length === 0) {
    log("   ⚠️ Unable to auto-fix RTK/Caveman: bun is not available in PATH.")
    return false
  }

  log("Attempting native RTK/Caveman remediation via setup bootstrap...")
  return runRemediationCommand("bun", [setupScriptPath, "--update", "--headless"], {
    spawn,
    log,
    env: {
      ...process.env,
      OCS_SETUP_INSTALLER_MODE: "1",
    },
  })
}

function fixMissingRtk(rows, options = {}) {
  return fixCompressionAdjunctEngines(rows, options)
}

function shouldFixCaveman(rows) {
  const cavemanRow = rows.find((row) => row.key === "caveman")
  return Boolean(cavemanRow && cavemanRow.status !== TOOL_STATUS.PASS)
}

function fixMissingCaveman(rows, options = {}) {
  return fixCompressionAdjunctEngines(rows, options)
}

function shouldFixCocoIndexCommand(rows) {
  const cccRow = rows.find((row) => row.key === "ccc")
  return Boolean(cccRow && cccRow.status !== TOOL_STATUS.PASS)
}

function fixMissingCocoIndexCommand(rows, options = {}) {
  const {
    assetRoot = resolveAssetRoot(),
    fsApi = fs,
    spawn = spawnSync,
    commandLookup = runCommandLookup,
    log = console.log,
  } = options

  if (!shouldFixCocoIndexCommand(rows)) {
    return false
  }

  const setupScriptPath = path.join(assetRoot, "scripts", "setup.js")
  if (!fsApi.existsSync(setupScriptPath)) {
    log("   ⚠️ Unable to auto-fix ccc: setup script is unavailable in this bundle.")
    return false
  }

  if ((commandLookup("bun") || []).length === 0) {
    log("   ⚠️ Unable to auto-fix ccc: bun is not available in PATH.")
    return false
  }

  log("Attempting safe CocoIndex remediation via setup bootstrap...")
  const env = {
    ...process.env,
    OCS_SETUP_INSTALLER_MODE: "1",
    OCS_SETUP_COCOINDEX_AUTO: "1",
    OCS_SETUP_SKIP_COCOINDEX_POSTGRES:
      process.env.OCS_SETUP_SKIP_COCOINDEX_POSTGRES || "1",
    OCS_SETUP_FORCE_POSIX_CCC_SHIM:
      process.env.OCS_SETUP_FORCE_POSIX_CCC_SHIM || "1",
  }

  runRemediationCommand("bun", [setupScriptPath, "--update", "--headless"], {
    spawn,
    log,
    env,
  })
  return true
}

const PLUGIN_FINGERPRINT_INPUTS = [
  "package.json",
  "bun.lock",
  "bun.lockb",
  "bunfig.toml",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]

function computeDependencyFingerprint(installDir, options = {}) {
  const { fsApi = fs } = options
  const parts = []

  for (const relativeFile of PLUGIN_FINGERPRINT_INPUTS) {
    const fullPath = path.join(installDir, relativeFile)
    if (!fsApi.existsSync(fullPath)) {
      continue
    }

    const content = fsApi.readFileSync(fullPath)
    const hash = crypto.createHash("sha256").update(content).digest("hex")
    parts.push(`${relativeFile}:${hash}`)
  }

  return parts.length > 0 ? parts.join("\n") : ""
}

function shouldFixPluginRuntimeMarkers(rows) {
  const pluginRow = rows.find((row) => row.key === "plugin")
  if (!pluginRow || pluginRow.status === TOOL_STATUS.PASS) {
    return false
  }

  return String(pluginRow.detail || "").includes("Missing runtime markers")
}

function fixPluginRuntimeMarkers(rows, options = {}) {
  const {
    assetRoot = resolveAssetRoot(),
    fsApi = fs,
    spawn = spawnSync,
    commandLookup = runCommandLookup,
    log = console.log,
  } = options

  if (!shouldFixPluginRuntimeMarkers(rows)) {
    return false
  }

  const pluginRoot = resolvePluginRuntimeRoot(assetRoot, fsApi)
  const packageJsonPath = path.join(pluginRoot, "package.json")
  if (!fsApi.existsSync(packageJsonPath)) {
    log("   ⚠️ Unable to auto-fix plugin runtime markers: plugin bundle is missing.")
    return false
  }

  const markerPaths = PLUGIN_RUNTIME_MARKERS.map((marker) => path.join(pluginRoot, marker))
  const missingMarkers = markerPaths.filter((markerPath) => !fsApi.existsSync(markerPath))
  if (missingMarkers.length === 0) {
    return false
  }

  log("Attempting localized plugin runtime remediation...")
  let attempted = false

  const missingDistMarker = missingMarkers.includes(path.join(pluginRoot, "dist", "index.js"))
  if (missingDistMarker) {
    if ((commandLookup("bun") || []).length === 0) {
      log("   ⚠️ Unable to rebuild plugin dist marker: bun is not available in PATH.")
    } else {
      attempted = true
      const installOk = runRemediationCommand("bun", ["install", "--frozen-lockfile"], {
        spawn,
        log,
        cwd: pluginRoot,
      })

      if (!installOk) {
        runRemediationCommand("bun", ["install"], {
          spawn,
          log,
          cwd: pluginRoot,
        })
      }

      runRemediationCommand("bun", ["run", "build"], {
        spawn,
        log,
        cwd: pluginRoot,
      })
    }
  }

  const fingerprintPath = path.join(
    pluginRoot,
    ".ocs-install-state",
    "bun-install.fingerprint",
  )
  if (missingMarkers.includes(fingerprintPath)) {
    const nextFingerprint = computeDependencyFingerprint(pluginRoot, { fsApi })
    if (nextFingerprint) {
      const markerDir = path.dirname(fingerprintPath)
      fsApi.mkdirSync(markerDir, { recursive: true })
      fsApi.writeFileSync(fingerprintPath, nextFingerprint, "utf8")
      log(`   ✅ Wrote plugin dependency fingerprint marker: ${fingerprintPath}`)
      attempted = true
    } else {
      log("   ⚠️ Unable to compute plugin dependency fingerprint from available lockfiles.")
    }
  }

  return attempted
}

function attemptAutoFix(state, options = {}) {
  const {
    assetRoot = resolveAssetRoot(),
    ensureBinDirs = ensureExpectedBinDirsOnPath,
    spawn = spawnSync,
    fsApi = fs,
    commandLookup = runCommandLookup,
    log = console.log,
  } = options
  const actions = []

  if (fixMissingCorepack(state.rows, { spawn, log })) {
    actions.push("corepack")
  }

  if (fixMissingPnpm(state.rows, { spawn, log })) {
    actions.push("pnpm")
  }

  if (fixMissingPipx(state.rows, { spawn, log, commandLookup })) {
    actions.push("pipx")
  }

  if (ensureBinDirs()) {
    actions.push("bin directories")
  }

  if (fixMissingCocoIndexCommand(state.rows, { assetRoot, fsApi, spawn, commandLookup, log })) {
    actions.push("ccc")
  }

  if (fixCompressionAdjunctEngines(state.rows, { assetRoot, fsApi, spawn, commandLookup, log })) {
    actions.push("rtk/caveman")
  }

  if (fixPluginRuntimeMarkers(state.rows, { assetRoot, fsApi, spawn, commandLookup, log })) {
    actions.push("plugin runtime markers")
  }

  if (actions.length === 0) {
    log("No auto-fix actions were necessary or available in this session.")
    return false
  }

  log(`Auto-fix actions attempted: ${actions.join(", ")}`)
  return true
}

function printDoctor(assetRoot, options = {}) {
  const {
    fix = false,
    runChecks = runDoctorChecks,
    autoFix = attemptAutoFix,
  } = options
  const version = readVersion(assetRoot)
  let state = runChecks(assetRoot)

  console.log("OCS Doctor")
  console.log("")
  console.log(`Version: ${version}`)
  console.log(`Platform: ${process.platform}`)
  console.log(`Mode: ${fix ? "Auto-fix (safe remediation enabled)" : "Diagnostic"}`)
  console.log("")

  if (fix) {
    const attempted = runWithProgress(
      {
        channel: "doctor",
        scenario: "remediation",
      },
      () => autoFix(state, { assetRoot }),
    )
    if (attempted) {
      console.log("")
      console.log("Re-running doctor checks after remediation...")
      state = runChecks(assetRoot)
    }
  }

  formatStatusTable(state.rows)

  console.log("")
  console.log("Expected bin directories:")
  for (const entry of state.expectedBins) {
    const parts = []
    parts.push(entry.inPath ? "PATH" : "not-in-PATH")
    if (entry.hasOcs) parts.push("ocs")
    if (entry.hasOpencode) parts.push("opencode")
    if (!entry.hasOcs && !entry.hasOpencode) parts.push("no-shims")
    console.log(`- ${entry.dir} [${parts.join(", ")}]`)
  }

  const failureRows = state.rows.filter((row) => row.status === TOOL_STATUS.FAIL)
  const warningRows = state.rows.filter((row) => row.status === TOOL_STATUS.WARN)
  const missingBinDir = !state.hasHealthyBinDir
  const actionableWarningKeys = new Set(["ccc", "rtk", "caveman", "plugin"])
  const actionableWarnings = warningRows.filter((row) => actionableWarningKeys.has(row.key))

  if (failureRows.length === 0 && warningRows.length === 0 && !missingBinDir) {
    console.log("")
    console.log("✅ OCS doctor found no PATH/shim issues.")
    return 0
  }

  console.log("")
  if (failureRows.length > 0) {
    console.log("Failures:")
    for (const row of failureRows) {
      console.log(`- ${row.label}: ${row.detail}`)
    }
  }

  if (warningRows.length > 0) {
    console.log("Warnings:")
    for (const row of warningRows) {
      console.log(`- ${row.label}: ${row.detail}`)
    }
  }

  if (missingBinDir) {
    console.log("- No expected bin directory contains working shims on PATH.")
  }

  const hasActionableIssue = failureRows.length > 0 || missingBinDir || actionableWarnings.length > 0
  if (hasActionableIssue) {
    console.log("")
    console.log("Recommendations:")

    if (missingBinDir) {
      if (process.platform === "win32") {
        console.log("- Open a new PowerShell session after install.")
      } else {
        console.log("- Open a new shell session after install.")
        console.log("- If commands are still missing after a fresh shell, run `ocs doctor` first. Use manual PATH export only as an emergency fallback while investigating why the persisted shell snippet did not load.")
      }
    }

    if (failureRows.length > 0 || actionableWarnings.length > 0 || missingBinDir) {
      console.log("- Run `ocs doctor --fix` to attempt safe remediation (pnpm/corepack fallbacks, PATH bins, CocoIndex/RTK/Caveman/plugin marker recovery).")
    }

    if (warningRows.some((row) => row.key === "rtk")) {
      console.log("- Run `ocs doctor --fix` to install/repair native RTK, initialize it with `rtk init -g --opencode`, and verify `rtk --version`, `rtk init --show`, and `rtk gain`.")
    }

    if (warningRows.some((row) => row.key === "caveman")) {
      console.log('- Run `ocs doctor --fix` to attach Caveman with `npx -y skills add JuliusBrussee/caveman -a opencode -s "*" -g -y`.')
    }

    const needsInstallerRepair = failureRows.some((row) => {
      return ["bun", "ocs", "opencode", "node", "npm", "corepack", "pnpm", "python", "pipx"].includes(row.key)
    })

    if (needsInstallerRepair) {
      if (process.platform === "win32") {
        console.log("- Re-run installer if needed: `irm https://raw.githubusercontent.com/andyvandaric/opencode-suites-installer/main/install.ps1 | iex`")
      } else {
        console.log("- Re-run installer if needed: `curl -fsSL https://raw.githubusercontent.com/andyvandaric/opencode-suites-installer/main/install.sh | bash`")
      }

    }
  }

  return failureRows.length > 0 || missingBinDir ? 1 : 0
}

function parseDoctorArgs(rawArgs) {
  if (!Array.isArray(rawArgs) || rawArgs.length === 0) {
    return {
      fix: false,
      help: false,
      unknown: [],
    }
  }

  const parsed = {
    fix: false,
    help: false,
    unknown: [],
  }

  for (const arg of rawArgs) {
    if (arg === "--fix" || arg === "-f") {
      parsed.fix = true
      continue
    }

    if (arg === "--help" || arg === "-h") {
      parsed.help = true
      continue
    }

    parsed.unknown.push(arg)
  }

  return parsed
}

function printSetupProfileHelp() {
  console.log("Usage:")
  console.log("  ocs setup profile [--update] [--profile <name>] [--mode <id>] [--headless]")
  console.log("  ocs setup update [--profile <name>] [--mode <id>] [--headless]")
  console.log("  ocs setup:update [--profile <name>] [--mode <id>] [--headless]")
  console.log("  ocs setup:profile [--update] [--profile <name>] [--mode <id>] [--headless]")
  console.log("  ocs setup:profile:update [--profile <name>] [--mode <id>] [--headless]")
}

function printExaHelp() {
  console.log("Usage:")
  console.log("  ocs exa setup --api-key <YOUR_EXA_API_KEY>")
  console.log("  ocs exa check")
  console.log("  ocs exa:setup --api-key <YOUR_EXA_API_KEY>")
  console.log("  ocs exa:check")
}

function runBunScript(assetRoot, scriptRelativePath, scriptArgs) {
  const resolved = resolveScriptPath(assetRoot, scriptRelativePath)
  if (!resolved) {
    console.error(`Missing script: ${path.join(assetRoot, scriptRelativePath)}`)
    process.exit(1)
  }

  const result = spawnSync("bun", [resolved.scriptPath, ...scriptArgs], {
    stdio: "inherit",
    env: {
      ...process.env,
      OCS_ASSET_ROOT: resolved.assetRoot,
    },
  })

  if (typeof result.status === "number") {
    process.exit(result.status)
  }

  console.error("Failed to execute bun. Ensure Bun is installed and available in PATH.")
  process.exit(1)
}

function resolveScriptPath(assetRoot, scriptRelativePath) {
  const primary = path.join(assetRoot, scriptRelativePath)
  if (fs.existsSync(primary)) {
    return {
      scriptPath: primary,
      assetRoot,
    }
  }

  if (scriptRelativePath !== "scripts/ocs-index.js") {
    return null
  }

  const candidates = []
  const cwdRoot = process.cwd()
  candidates.push({
    assetRoot: cwdRoot,
    scriptPath: path.join(cwdRoot, scriptRelativePath),
  })

  const home = process.env.HOME || process.env.USERPROFILE
  if (home) {
    const configRoot = path.join(home, ".config", "opencode")
    candidates.push({
      assetRoot: configRoot,
      scriptPath: path.join(configRoot, scriptRelativePath),
    })
  }

  const inferredRoot = path.resolve(assetRoot, "..", "..", "..")
  candidates.push({
    assetRoot: inferredRoot,
    scriptPath: path.join(inferredRoot, scriptRelativePath),
  })

  const packageRoot = path.resolve(__dirname, "..")
  candidates.push({
    assetRoot: packageRoot,
    scriptPath: path.join(packageRoot, scriptRelativePath),
  })

  for (const candidate of candidates) {
    if (fs.existsSync(candidate.scriptPath)) {
      return candidate
    }
  }

  return null
}

function parseSetupArgs(rawArgs) {
  if (rawArgs.length === 0) {
    return []
  }

  return rawArgs
}

function hasHelpFlag(rawArgs) {
  return rawArgs.includes("--help") || rawArgs.includes("-h")
}

function main() {
  const assetRoot = resolveAssetRoot()
  const args = process.argv.slice(2)

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp()
    return
  }

  if (args[0] === "--version" || args[0] === "-v") {
    console.log(readVersion(assetRoot))
    return
  }

  if (args[0] === "setup:profile") {
    if (hasHelpFlag(args.slice(1))) {
      printSetupProfileHelp()
      return
    }
    runBunScript(assetRoot, "scripts/setup.js", parseSetupArgs(args.slice(1)))
    return
  }

  if (args[0] === "setup:profile:update") {
    if (hasHelpFlag(args.slice(1))) {
      printSetupProfileHelp()
      return
    }
    runBunScript(assetRoot, "scripts/setup.js", parseSetupArgs(["--update", ...args.slice(1)]))
    return
  }

  if (args[0] === "setup:update") {
    if (hasHelpFlag(args.slice(1))) {
      printSetupProfileHelp()
      return
    }
    runBunScript(assetRoot, "scripts/setup.js", parseSetupArgs(["--update", ...args.slice(1)]))
    return
  }

  if (args[0] === "setup" && args[1] === "profile") {
    if (hasHelpFlag(args.slice(2))) {
      printSetupProfileHelp()
      return
    }
    runBunScript(assetRoot, "scripts/setup.js", parseSetupArgs(args.slice(2)))
    return
  }

  if (args[0] === "setup" && args[1] === "update") {
    if (hasHelpFlag(args.slice(2))) {
      printSetupProfileHelp()
      return
    }
    runBunScript(assetRoot, "scripts/setup.js", parseSetupArgs(["--update", ...args.slice(2)]))
    return
  }

  if (args[0] === "prefs") {
    runBunScript(assetRoot, "scripts/prefs-wizard.js", args.slice(1))
    return
  }

  if (args[0] === "exa:setup") {
    if (hasHelpFlag(args.slice(1))) {
      printExaHelp()
      return
    }

    runBunScript(assetRoot, "scripts/exa-setup.js", ["setup", ...args.slice(1)])
    return
  }

  if (args[0] === "exa:check") {
    if (hasHelpFlag(args.slice(1))) {
      printExaHelp()
      return
    }

    runBunScript(assetRoot, "scripts/exa-setup.js", ["check", ...args.slice(1)])
    return
  }

  if (args[0] === "exa") {
    if (args.length === 1 || hasHelpFlag(args.slice(1))) {
      printExaHelp()
      return
    }

    if (args[1] === "setup") {
      runBunScript(assetRoot, "scripts/exa-setup.js", ["setup", ...args.slice(2)])
      return
    }

    if (args[1] === "check") {
      runBunScript(assetRoot, "scripts/exa-setup.js", ["check", ...args.slice(2)])
      return
    }

    console.error(`Unknown exa command: ${args.slice(1).join(" ")}`)
    console.error("")
    printExaHelp()
    process.exit(1)
  }

  if (args[0] === "doctor") {
    const doctorArgs = parseDoctorArgs(args.slice(1))
    if (doctorArgs.help) {
      printDoctorHelp()
      return
    }

    if (doctorArgs.unknown.length > 0) {
      console.error(`Unknown doctor option(s): ${doctorArgs.unknown.join(" ")}`)
      console.error("")
      printDoctorHelp()
      process.exit(1)
    }

    process.exitCode = printDoctor(assetRoot, { fix: doctorArgs.fix })
    return
  }

  if (args[0] === "index") {
    if (args.length === 1 || hasHelpFlag(args.slice(1))) {
      printIndexHelp()
      return
    }

    runBunScript(assetRoot, "scripts/ocs-index.js", args.slice(1))
    return
  }

  if (args[0] === "compress") {
    process.exitCode = handleCompressionCommand(assetRoot, args.slice(1))
    return
  }

  console.error(`Unknown command: ${args.join(" ")}`)
  console.error("")
  printHelp()
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  attemptAutoFix,
  TOOL_STATUS,
  getHelpLines,
  getIndexHelpLines,
  hasHelpFlag,
  parseDoctorArgs,
  parseCompressArgs,
  parseSetupArgs,
  ensureCompressionConfig,
  buildCompressionPolicy,
  buildCompressionProjection,
  writeCompressionPolicy,
  writeCompressionProjection,
  resolveCompressionRoute,
  formatCompressionRoute,
  setCompressionEngine,
  setCompressionIntentMode,
  formatCompressionState,
  handleCompressionCommand,
  printDoctor,
  printCompressionHelp,
  runDoctorChecks,
  resolveCompressionExternalEngineStatus,
  resolveCompressionAdjunctPaths,
  resolveConfigDir,
  resolveCompressionPolicyPath,
  resolveCompressionProjectionPath,
  resolveAssetRoot,
  readVersion,
}
