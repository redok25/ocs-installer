#!/usr/bin/env bun

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const readline = require("node:readline/promises")
const { stdin, stdout } = require("node:process")
const { pathToFileURL } = require("node:url")

const DEFAULT_ANTIGRAVITY = {
  quiet_mode: false,
  toast_scope: "root_only",
  debug: false,
  debug_tui: false,
  log_dir: "",
  keep_thinking: false,
  session_recovery: true,
  auto_resume: true,
  resume_text: "continue",
  signature_cache: {
    enabled: true,
    memory_ttl_seconds: 3600,
    disk_ttl_seconds: 172800,
    write_interval_seconds: 60,
  },
  empty_response_max_attempts: 4,
  empty_response_retry_delay_ms: 2000,
  tool_id_recovery: true,
  claude_tool_hardening: true,
  proactive_token_refresh: true,
  proactive_refresh_buffer_seconds: 1800,
  proactive_refresh_check_interval_seconds: 300,
  max_rate_limit_wait_seconds: 300,
  quota_fallback: false,
  cli_first: true,
  account_selection_strategy: "hybrid",
  pid_offset_enabled: false,
  switch_on_first_rate_limit: true,
  policy_mode: "shadow",
  policy_kill_switch: false,
  emit_circuit_breaker_payload: true,
  scheduling_mode: "cache_first",
  max_cache_first_wait_seconds: 60,
  failure_ttl_seconds: 3600,
  default_retry_after_seconds: 60,
  max_backoff_seconds: 60,
  request_jitter_max_ms: 0,
  soft_quota_threshold_percent: 70,
  cli_quota_buffer_percent: 30,
  openai_quota_buffer_percent: 30,
  quota_refresh_interval_minutes: 15,
  soft_quota_cache_ttl_minutes: "auto",
  health_score: {
    initial: 70,
    success_reward: 1,
    rate_limit_penalty: -10,
    failure_penalty: -20,
    recovery_rate_per_hour: 2,
    min_usable: 50,
    max_score: 100,
  },
  token_bucket: {
    max_tokens: 50,
    regeneration_rate_per_minute: 6,
    initial_tokens: 50,
  },
  auto_update: true,
}

const CURRENT_ANTIGRAVITY_SCHEMA_URL =
  "https://raw.githubusercontent.com/andyvandaric/opencode-config-suites/main/plugins/opencode-multi-auth/assets/antigravity.schema.json"

const LEGACY_ANTIGRAVITY_SCHEMA_URLS = new Set([
  "https://raw.githubusercontent.com/andyvandaric/opencode-ag-auth/main/assets/antigravity.schema.json",
])

function getAssetRoot() {
  return process.env.OCS_ASSET_ROOT || path.resolve(__dirname, "..")
}

function getConfigDir() {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return process.env.OPENCODE_CONFIG_DIR
  }
  return path.join(os.homedir(), ".config", "opencode")
}

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return {
      exists: false,
      data: {},
      raw: "",
    }
  }

  const raw = fs.readFileSync(filePath, "utf8")
  try {
    const parsed = JSON.parse(raw)
    return {
      exists: true,
      data: parsed,
      raw,
    }
  } catch (error) {
    console.warn(`[prefs] Warning: invalid JSON in ${filePath}. Treating as empty object.`)
    return {
      exists: true,
      data: {},
      raw,
    }
  }
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function deepMerge(base, extra) {
  const output = { ...base }
  for (const [key, value] of Object.entries(extra || {})) {
    if (isObject(value) && isObject(output[key])) {
      output[key] = deepMerge(output[key], value)
      continue
    }
    output[key] = value
  }
  return output
}

function normalizeLegacyAntigravityConfig(input) {
  const source = isObject(input) ? input : {}
  const normalized = structuredClone(source)
  if (typeof normalized.$schema === "string" && LEGACY_ANTIGRAVITY_SCHEMA_URLS.has(normalized.$schema)) {
    normalized.$schema = CURRENT_ANTIGRAVITY_SCHEMA_URL
  }
  return normalized
}

function toPrettyJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function parseArgs(argv) {
  const args = [...argv]
  const parsed = {
    help: false,
    dryRun: false,
    rollback: "",
  }

  while (args.length > 0) {
    const token = args.shift()
    if (!token) {
      continue
    }
    if (token === "--help" || token === "-h") {
      parsed.help = true
      continue
    }
    if (token === "--dry-run") {
      parsed.dryRun = true
      continue
    }
    if (token === "--rollback") {
      parsed.rollback = args.shift() || ""
      continue
    }
  }

  return parsed
}

function printHelp() {
  console.log("OpenCode Preferences Wizard")
  console.log("")
  console.log("Usage:")
  console.log("  bun run scripts/prefs-wizard.js")
  console.log("  bun run scripts/prefs-wizard.js --dry-run")
  console.log("  bun run scripts/prefs-wizard.js --rollback <stamp>")
}

function getRuntimeState() {
  const configDir = getConfigDir()
  const projectDir = path.join(process.cwd(), ".opencode")

  const filePaths = {
    userAntigravity: path.join(configDir, "antigravity.json"),
    projectAntigravity: path.join(projectDir, "antigravity.json"),
    userOpencode: path.join(configDir, "opencode.json"),
    userOhMy: path.join(configDir, "oh-my-opencode.json"),
  }

  const snapshots = {
    userAntigravity: safeReadJson(filePaths.userAntigravity),
    projectAntigravity: safeReadJson(filePaths.projectAntigravity),
    userOpencode: safeReadJson(filePaths.userOpencode),
    userOhMy: safeReadJson(filePaths.userOhMy),
  }

  return {
    configDir,
    filePaths,
    snapshots,
  }
}

function runDrySummary() {
  const state = getRuntimeState()
  console.log("[prefs] Dry-run summary")
  console.log(`[prefs] config directory: ${state.configDir}`)
  for (const [key, filePath] of Object.entries(state.filePaths)) {
    const exists = state.snapshots[key].exists ? "yes" : "no"
    console.log(`- ${key}: ${filePath} (exists: ${exists})`)
  }
}

function parsePrimitiveByType(input, parseReferenceValue, currentValue = parseReferenceValue) {
  const normalized = input.trim()

  if (normalized.length === 0) {
    return {
      changed: false,
      value: currentValue,
      empty: true,
      invalid: false,
    }
  }

  if (normalized === "null") {
    return {
      changed: true,
      value: null,
      empty: false,
      invalid: false,
    }
  }

  if (typeof parseReferenceValue === "boolean") {
    if (normalized === "true" || normalized === "false") {
      const parsedValue = normalized === "true"
      return {
        changed: parsedValue !== currentValue,
        value: parsedValue,
        empty: false,
        invalid: false,
      }
    }
    return {
      changed: false,
      value: currentValue,
      empty: false,
      invalid: true,
      error: "expected boolean true/false",
    }
  }

  if (typeof parseReferenceValue === "number") {
    const numericValue = Number(normalized)
    if (!Number.isNaN(numericValue)) {
      return {
        changed: numericValue !== currentValue,
        value: numericValue,
        empty: false,
        invalid: false,
      }
    }
    return {
      changed: false,
      value: currentValue,
      empty: false,
      invalid: true,
      error: "expected number",
    }
  }

  if (Array.isArray(parseReferenceValue)) {
    try {
      const parsed = JSON.parse(normalized)
      if (Array.isArray(parsed)) {
        return {
          changed: JSON.stringify(parsed) !== JSON.stringify(currentValue),
          value: parsed,
          empty: false,
          invalid: false,
        }
      }
      return {
        changed: false,
        value: currentValue,
        empty: false,
        invalid: true,
        error: "expected JSON array",
      }
    } catch {
      return {
        changed: false,
        value: currentValue,
        empty: false,
        invalid: true,
        error: "expected JSON array",
      }
    }
  }

  if (isObject(parseReferenceValue)) {
    try {
      const parsed = JSON.parse(normalized)
      if (isObject(parsed)) {
        return {
          changed: JSON.stringify(parsed) !== JSON.stringify(currentValue),
          value: parsed,
          empty: false,
          invalid: false,
        }
      }
      return {
        changed: false,
        value: currentValue,
        empty: false,
        invalid: true,
        error: "expected JSON object",
      }
    } catch {
      return {
        changed: false,
        value: currentValue,
        empty: false,
        invalid: true,
        error: "expected JSON object",
      }
    }
  }

  return {
    changed: normalized !== String(currentValue ?? ""),
    value: normalized,
    empty: false,
    invalid: false,
  }
}

let antigravitySchemaCache = null
let antigravityFullSchemaCache = null
let antigravityDefaultsCache = null

function buildSchemaModuleCandidates(assetRoot = getAssetRoot(), scriptDir = __dirname) {
  const normalizedAssetRoot = path.resolve(assetRoot)
  const normalizedScriptDir = path.resolve(scriptDir)
  const rawCandidates = [
    path.join(normalizedAssetRoot, "plugins", "opencode-multi-auth", "dist", "src", "plugin", "config", "schema.js"),
    path.join(normalizedAssetRoot, "plugins", "opencode-multi-auth", "src", "plugin", "config", "schema.ts"),
    path.join(normalizedAssetRoot, "dist", "src", "plugin", "config", "schema.js"),
    path.join(normalizedAssetRoot, "src", "plugin", "config", "schema.ts"),
    path.join(normalizedScriptDir, "../plugins/opencode-multi-auth/dist/src/plugin/config/schema.js"),
    path.join(normalizedScriptDir, "../plugins/opencode-multi-auth/src/plugin/config/schema.ts"),
    path.join(normalizedScriptDir, "../dist/src/plugin/config/schema.js"),
    path.join(normalizedScriptDir, "../src/plugin/config/schema.ts"),
  ]

  return Array.from(new Set(rawCandidates.map((candidate) => path.resolve(candidate))))
}

async function importSchemaModule() {
  const candidates = buildSchemaModuleCandidates()
  const existingCandidates = candidates.filter((candidate) => fs.existsSync(candidate))
  const attempted = []

  for (const candidate of existingCandidates) {
    attempted.push(candidate)
    try {
      return await import(pathToFileURL(candidate).href)
    } catch {
      continue
    }
  }

  const searchList = existingCandidates.length > 0 ? existingCandidates : candidates
  throw new Error(`schema module not found or failed to import. attempted: ${searchList.join(" | ")}`)
}

async function getAntigravitySchema() {
  if (antigravityFullSchemaCache) {
    return antigravityFullSchemaCache
  }

  const schemaModule = await importSchemaModule()
  antigravityFullSchemaCache = schemaModule.AntigravityConfigSchema
  return antigravityFullSchemaCache
}

async function getAntigravityDefaults() {
  if (antigravityDefaultsCache) {
    return antigravityDefaultsCache
  }

  try {
    const schemaModule = await importSchemaModule()
    const moduleDefaults = schemaModule.DEFAULT_CONFIG
    if (moduleDefaults && typeof moduleDefaults === "object") {
      antigravityDefaultsCache = deepMerge(DEFAULT_ANTIGRAVITY, moduleDefaults)
      return antigravityDefaultsCache
    }
  } catch {
    // Fall back to static defaults below.
  }

  antigravityDefaultsCache = structuredClone(DEFAULT_ANTIGRAVITY)
  return antigravityDefaultsCache
}

async function getAntigravityPartialSchema() {
  if (antigravitySchemaCache) {
    return antigravitySchemaCache
  }

  const partialSchema = (await getAntigravitySchema()).partial()
  antigravitySchemaCache = partialSchema
  return partialSchema
}

async function validateAntigravityCandidate(candidate, options = {}) {
  const usePartial = options.partial !== false
  try {
    const schema = usePartial
      ? await getAntigravityPartialSchema()
      : await getAntigravitySchema()
    const result = schema.safeParse(candidate)
    if (result.success) {
      return {
        ok: true,
        errors: [],
      }
    }

    const errors = result.error.issues.map((issue) => {
      const issuePath = issue.path.length > 0 ? issue.path.join(".") : "root"
      return `${issuePath}: ${issue.message}`
    })
    return {
      ok: false,
      errors,
    }
  } catch (error) {
    return {
      ok: false,
      errors: [
        `schema-load-failed: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

function hasValidationErrorForPath(errors, displayPath) {
  const displayPrefix = `${displayPath}.`
  return errors.some((message) => {
    const separatorIndex = message.indexOf(":")
    if (separatorIndex <= 0) {
      return false
    }
    const errorPath = message.slice(0, separatorIndex).trim()
    if (errorPath === displayPath) {
      return true
    }
    if (errorPath.startsWith(displayPrefix)) {
      return true
    }
    return displayPath.startsWith(`${errorPath}.`)
  })
}

async function validateFinalAntigravityTargets(editedTargets, validator = validateAntigravityCandidate) {
  const errors = []
  const targets = [
    ["userAntigravity", editedTargets.userAntigravity],
    ["projectAntigravity", editedTargets.projectAntigravity],
  ]

  for (const [targetName, targetValue] of targets) {
    const validation = await validator(targetValue, { partial: false })
    if (!validation.ok) {
      for (const message of validation.errors) {
        errors.push(`${targetName}.${message}`)
      }
    }
  }

  if (errors.length === 0) {
    return {
      ok: true,
      errors: [],
    }
  }

  return {
    ok: false,
    errors,
  }
}

function getAtPath(source, pathParts) {
  let current = source
  for (const key of pathParts) {
    if (!isObject(current) || !(key in current)) {
      return undefined
    }
    current = current[key]
  }
  return current
}

function createPatchFromPath(pathParts, value) {
  if (pathParts.length === 0) {
    return {}
  }

  const patch = {}
  let nested = patch
  for (let index = 0; index < pathParts.length - 1; index += 1) {
    const pathKey = pathParts[index]
    nested[pathKey] = {}
    nested = nested[pathKey]
  }
  nested[pathParts[pathParts.length - 1]] = value
  return patch
}

async function promptEditObject({
  rl,
  template,
  currentTarget,
  prefix = [],
  typeSourceTarget,
  validateCandidate,
}) {
  const patch = {}
  const keys = Object.keys(template).sort()

  for (const key of keys) {
    const nextPrefix = [...prefix, key]
    const templateValue = template[key]
    const currentValue = getAtPath(currentTarget, nextPrefix)
    const effectiveValue = currentValue === undefined ? templateValue : currentValue

    if (isObject(templateValue) || isObject(effectiveValue)) {
      const childTemplate = isObject(templateValue)
        ? templateValue
        : isObject(effectiveValue)
          ? effectiveValue
          : {}
      const nestedPatch = await promptEditObject({
        rl,
        template: childTemplate,
        currentTarget,
        prefix: nextPrefix,
        typeSourceTarget,
        validateCandidate,
      })
      if (Object.keys(nestedPatch).length > 0) {
        patch[key] = nestedPatch
      }
      continue
    }

    const displayPath = nextPrefix.join(".")
    const rawValue = effectiveValue
    const parseReferenceValue = typeSourceTarget
      ? getAtPath(typeSourceTarget, nextPrefix) ?? rawValue
      : rawValue
    while (true) {
      const answer = await rl.question(
        `[prefs] ${displayPath} (current: ${JSON.stringify(rawValue)}) -> `,
      )

      const currentDraft = applyPatch(currentTarget, patch)
      const parsed = parsePrimitiveByType(answer, parseReferenceValue, rawValue)
      if (parsed.invalid) {
        console.log(`[prefs] invalid value for ${displayPath}: ${parsed.error || "invalid input"}`)
        console.log("[prefs] press Enter to keep current value, or input a valid replacement")
        continue
      }
      if (!parsed.changed) {
        if (validateCandidate && parsed.empty) {
          const validation = await validateCandidate(currentDraft)
          if (!validation.ok && hasValidationErrorForPath(validation.errors, displayPath)) {
            console.log(`[prefs] current value for ${displayPath} is invalid and cannot be kept`)
            for (const message of validation.errors.slice(0, 3)) {
              console.log(`[prefs]   - ${message}`)
            }
            console.log("[prefs] please input a valid replacement")
            continue
          }
        }
        break
      }

      const candidatePatch = createPatchFromPath(nextPrefix, parsed.value)
      const candidateObject = applyPatch(currentDraft, candidatePatch)

      if (validateCandidate) {
        const validation = await validateCandidate(candidateObject)
        if (!validation.ok) {
          const schemaLoadOnly = validation.errors.length > 0
            && validation.errors.every((message) => message.startsWith("schema-load-failed:"))
          if (schemaLoadOnly) {
            console.log(`[prefs] schema validation backend unavailable for ${displayPath}; applying typed value with fallback checks`)
            let nested = patch
            for (let index = 0; index < nextPrefix.length - 1; index += 1) {
              const pathKey = nextPrefix[index]
              if (!isObject(nested[pathKey])) {
                nested[pathKey] = {}
              }
              nested = nested[pathKey]
            }
            nested[nextPrefix[nextPrefix.length - 1]] = parsed.value
            break
          }
          console.log(`[prefs] invalid value rejected for ${displayPath}`)
          for (const message of validation.errors.slice(0, 3)) {
            console.log(`[prefs]   - ${message}`)
          }
          console.log("[prefs] press Enter to keep current value, or input a valid replacement")
          continue
        }
      }

      let nested = patch
      for (let index = 0; index < nextPrefix.length - 1; index += 1) {
        const pathKey = nextPrefix[index]
        if (!isObject(nested[pathKey])) {
          nested[pathKey] = {}
        }
        nested = nested[pathKey]
      }
      nested[nextPrefix[nextPrefix.length - 1]] = parsed.value
      break
    }
  }

  return patch
}

function applyPatch(baseObject, patchObject) {
  const result = structuredClone(baseObject)
  const walk = (target, patchNode) => {
    for (const [key, value] of Object.entries(patchNode)) {
      if (isObject(value)) {
        if (!isObject(target[key])) {
          target[key] = {}
        }
        walk(target[key], value)
        continue
      }
      target[key] = value
    }
  }

  walk(result, patchObject)
  return result
}

function ensureDirectory(directoryPath) {
  fs.mkdirSync(directoryPath, { recursive: true })
}

function atomicWriteJson(filePath, payload) {
  ensureDirectory(path.dirname(filePath))
  const tempPath = `${filePath}.tmp`
  fs.writeFileSync(tempPath, toPrettyJson(payload), "utf8")
  fs.renameSync(tempPath, filePath)
}

function createBackupStamp() {
  const now = new Date()
  const to2 = (value) => String(value).padStart(2, "0")
  return [
    now.getFullYear(),
    to2(now.getMonth() + 1),
    to2(now.getDate()),
    "-",
    to2(now.getHours()),
    to2(now.getMinutes()),
    to2(now.getSeconds()),
  ].join("")
}

function writeBackups(changesByFile, fileSnapshots) {
  const configDir = getConfigDir()
  const backupDir = path.join(configDir, "backups", "prefs")
  ensureDirectory(backupDir)

  const stamp = createBackupStamp()
  const manifest = {
    stamp,
    createdAt: new Date().toISOString(),
    entries: [],
  }

  for (const [fileKey, filePath] of Object.entries(changesByFile)) {
    const snapshot = fileSnapshots[fileKey]
    const backupName = `${stamp}--${fileKey}.json`
    const backupPath = path.join(backupDir, backupName)
    const backupPayload = snapshot.exists ? snapshot.raw : "{}\n"
    fs.writeFileSync(backupPath, backupPayload, "utf8")

    manifest.entries.push({
      fileKey,
      targetPath: filePath,
      backupPath,
      existed: snapshot.exists,
    })
  }

  const manifestPath = path.join(backupDir, `${stamp}--manifest.json`)
  fs.writeFileSync(manifestPath, toPrettyJson(manifest), "utf8")

  return stamp
}

function rollbackByStamp(stamp) {
  const configDir = getConfigDir()
  const backupDir = path.join(configDir, "backups", "prefs")
  const manifestPath = path.join(backupDir, `${stamp}--manifest.json`)

  if (!fs.existsSync(manifestPath)) {
    console.error(`[prefs] rollback manifest not found: ${manifestPath}`)
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  for (const entry of manifest.entries) {
    if (!fs.existsSync(entry.backupPath)) {
      console.error(`[prefs] missing backup file: ${entry.backupPath}`)
      process.exit(1)
    }
    const backupRaw = fs.readFileSync(entry.backupPath, "utf8")
    ensureDirectory(path.dirname(entry.targetPath))
    fs.writeFileSync(entry.targetPath, backupRaw, "utf8")
    console.log(`[prefs] restored ${entry.targetPath}`)
  }
}

function applyEnvOverrides(baseConfig) {
  const output = structuredClone(baseConfig)

  const boolMap = {
    OPENCODE_ANTIGRAVITY_QUIET_MODE: "quiet_mode",
    OPENCODE_ANTIGRAVITY_DEBUG: "debug",
    OPENCODE_ANTIGRAVITY_SESSION_RECOVERY: "session_recovery",
    OPENCODE_ANTIGRAVITY_AUTO_RESUME: "auto_resume",
    OPENCODE_ANTIGRAVITY_AUTO_UPDATE: "auto_update",
    OPENCODE_ANTIGRAVITY_PID_OFFSET_ENABLED: "pid_offset_enabled",
  }
  for (const [envKey, configKey] of Object.entries(boolMap)) {
    const value = process.env[envKey]
    if (value === "true" || value === "false") {
      output[configKey] = value === "true"
    }
  }

  if (process.env.OPENCODE_ANTIGRAVITY_LOG_DIR) {
    output.log_dir = process.env.OPENCODE_ANTIGRAVITY_LOG_DIR
  }
  if (process.env.OPENCODE_ANTIGRAVITY_RESUME_TEXT) {
    output.resume_text = process.env.OPENCODE_ANTIGRAVITY_RESUME_TEXT
  }
  if (process.env.OPENCODE_ANTIGRAVITY_ACCOUNT_SELECTION_STRATEGY) {
    output.account_selection_strategy = process.env.OPENCODE_ANTIGRAVITY_ACCOUNT_SELECTION_STRATEGY
  }

  const numMap = {
    OPENCODE_ANTIGRAVITY_SOFT_QUOTA_THRESHOLD_PERCENT: "soft_quota_threshold_percent",
    OPENCODE_ANTIGRAVITY_CLI_QUOTA_BUFFER_PERCENT: "cli_quota_buffer_percent",
    OPENCODE_ANTIGRAVITY_OPENAI_QUOTA_BUFFER_PERCENT: "openai_quota_buffer_percent",
  }
  for (const [envKey, configKey] of Object.entries(numMap)) {
    const raw = process.env[envKey]
    if (!raw) {
      continue
    }
    const parsed = Number(raw)
    if (!Number.isNaN(parsed)) {
      output[configKey] = parsed
    }
  }

  return output
}

function computeChanges(previousSnapshot, nextObject) {
  const previousData = previousSnapshot.exists ? previousSnapshot.data : {}
  return JSON.stringify(previousData) !== JSON.stringify(nextObject)
}

async function runInteractive() {
  const state = getRuntimeState()
  const { filePaths, snapshots } = state
  const antigravityDefaults = await getAntigravityDefaults()

  const effectiveAntigravity = applyEnvOverrides(
    deepMerge(
      deepMerge(antigravityDefaults, snapshots.userAntigravity.data),
      snapshots.projectAntigravity.data,
    ),
  )

  const edited = {
    userAntigravity: normalizeLegacyAntigravityConfig(snapshots.userAntigravity.data),
    projectAntigravity: normalizeLegacyAntigravityConfig(snapshots.projectAntigravity.data),
    userOpencode: snapshots.userOpencode.data,
    userOhMy: snapshots.userOhMy.data,
  }

  const rl = readline.createInterface({ input: stdin, output: stdout })
  try {
    while (true) {
      console.log("\nOpenCode Preferences Wizard")
      console.log("1) Edit user antigravity.json")
      console.log("2) Edit project .opencode/antigravity.json")
      console.log("3) Edit user opencode.json")
      console.log("4) Edit user oh-my-opencode.json")
      console.log("5) Apply")
      console.log("6) Cancel")

      const choice = (await rl.question("Select option: ")).trim()
      if (choice === "6") {
        console.log("[prefs] Cancelled. No changes applied.")
        return {
          applied: false,
          changedKeys: [],
        }
      }

      if (choice === "5") {
        edited.userAntigravity = normalizeLegacyAntigravityConfig(edited.userAntigravity)
        edited.projectAntigravity = normalizeLegacyAntigravityConfig(edited.projectAntigravity)
        const finalValidation = await validateFinalAntigravityTargets(edited)
        if (!finalValidation.ok) {
          console.log("[prefs] apply blocked by strict schema validation")
          for (const message of finalValidation.errors.slice(0, 5)) {
            console.log(`[prefs]   - ${message}`)
          }
          console.log("[prefs] fix invalid fields first, then apply again")
          continue
        }
        break
      }

      if (choice === "1") {
        const template = deepMerge(effectiveAntigravity, edited.userAntigravity)
        const patch = await promptEditObject({
          rl,
          template,
          currentTarget: edited.userAntigravity,
          typeSourceTarget: effectiveAntigravity,
          validateCandidate: validateAntigravityCandidate,
        })
        edited.userAntigravity = applyPatch(edited.userAntigravity, patch)
        continue
      }

      if (choice === "2") {
        const template = deepMerge(antigravityDefaults, edited.projectAntigravity)
        const patch = await promptEditObject({
          rl,
          template,
          currentTarget: edited.projectAntigravity,
          typeSourceTarget: antigravityDefaults,
          validateCandidate: validateAntigravityCandidate,
        })
        edited.projectAntigravity = applyPatch(edited.projectAntigravity, patch)
        continue
      }

      if (choice === "3") {
        const template = edited.userOpencode
        const patch = await promptEditObject({
          rl,
          template,
          currentTarget: edited.userOpencode,
        })
        edited.userOpencode = applyPatch(edited.userOpencode, patch)
        continue
      }

      if (choice === "4") {
        const template = edited.userOhMy
        const patch = await promptEditObject({
          rl,
          template,
          currentTarget: edited.userOhMy,
        })
        edited.userOhMy = applyPatch(edited.userOhMy, patch)
        continue
      }
    }
  } finally {
    rl.close()
  }

  const changedByKey = {
    userAntigravity: computeChanges(snapshots.userAntigravity, edited.userAntigravity),
    projectAntigravity: computeChanges(snapshots.projectAntigravity, edited.projectAntigravity),
    userOpencode: computeChanges(snapshots.userOpencode, edited.userOpencode),
    userOhMy: computeChanges(snapshots.userOhMy, edited.userOhMy),
  }

  const changedKeys = Object.entries(changedByKey)
    .filter(([, changed]) => changed)
    .map(([key]) => key)

  const output = {
    applied: true,
    changedKeys,
    snapshots,
    edited,
    filePaths,
  }

  return output
}

function applyChanges(interactiveResult, dryRun) {
  if (!interactiveResult.applied) {
    return
  }

  if (interactiveResult.changedKeys.length === 0) {
    console.log("[prefs] No changes detected.")
    return
  }

  const changesByFile = {}
  for (const key of interactiveResult.changedKeys) {
    changesByFile[key] = interactiveResult.filePaths[key]
  }

  if (dryRun) {
    console.log("[prefs] Dry run only. Files that would be updated:")
    for (const [key, filePath] of Object.entries(changesByFile)) {
      console.log(`- ${key}: ${filePath}`)
    }
    return
  }

  const stamp = writeBackups(changesByFile, interactiveResult.snapshots)

  try {
    for (const key of interactiveResult.changedKeys) {
      atomicWriteJson(interactiveResult.filePaths[key], interactiveResult.edited[key])
      console.log(`[prefs] updated ${interactiveResult.filePaths[key]}`)
    }
    console.log(`[prefs] backup stamp: ${stamp}`)
  } catch (error) {
    console.error("[prefs] failed to apply one or more writes, attempting rollback")
    rollbackByStamp(stamp)
    throw error
  }
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2))

  if (parsed.help) {
    printHelp()
    return
  }

  if (parsed.rollback) {
    rollbackByStamp(parsed.rollback)
    return
  }

  if (parsed.dryRun && !stdin.isTTY) {
    runDrySummary()
    return
  }

  const interactiveResult = await runInteractive()
  applyChanges(interactiveResult, parsed.dryRun)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[prefs] ${error instanceof Error ? error.message : String(error)}`)
    process.exit(1)
  })
}

module.exports = {
  DEFAULT_ANTIGRAVITY,
  CURRENT_ANTIGRAVITY_SCHEMA_URL,
  LEGACY_ANTIGRAVITY_SCHEMA_URLS,
  buildSchemaModuleCandidates,
  applyEnvOverrides,
  applyPatch,
  hasValidationErrorForPath,
  computeChanges,
  deepMerge,
  getAssetRoot,
  parsePrimitiveByType,
  promptEditObject,
  getConfigDir,
  getRuntimeState,
  parseArgs,
  runDrySummary,
  normalizeLegacyAntigravityConfig,
  validateFinalAntigravityTargets,
}
