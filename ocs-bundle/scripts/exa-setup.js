#!/usr/bin/env bun

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")

const DEFAULT_EXA_MCP = {
  type: "remote",
  url: "https://mcp.exa.ai/mcp",
  headers: {
    "x-api-key": "{env:EXA_API_KEY}",
  },
}

const DEFAULT_CONTEXT7_MCP = {
  type: "remote",
  url: "https://mcp.context7.com/mcp",
}

const DEFAULT_GREP_APP_MCP = {
  type: "remote",
  url: "https://mcp.grep.app",
}

const DEFAULT_GITHUB_MCP = {
  type: "local",
  command: ["npx", "-y", "@modelcontextprotocol/server-github"],
}

const DEFAULT_TIME_MCP = {
  type: "local",
  command: ["npx", "-y", "time-mcp"],
}

function getAssetRoot() {
  return process.env.OCS_ASSET_ROOT || path.resolve(__dirname, "..")
}

function getConfigDir() {
  if (process.env.OPENCODE_CONFIG_DIR) {
    return process.env.OPENCODE_CONFIG_DIR
  }

  return path.join(os.homedir(), ".config", "opencode")
}

function getUserOpencodePath() {
  return path.join(getConfigDir(), "opencode.json")
}

function getBundledOpencodePath() {
  return path.join(getAssetRoot(), "opencode.json")
}

function parseArgs(argv) {
  const tokens = [...argv]
  const parsed = {
    command: "",
    help: false,
    apiKey: "",
  }

  if (tokens.length > 0 && !tokens[0].startsWith("-")) {
    parsed.command = tokens.shift() || ""
  }

  while (tokens.length > 0) {
    const token = tokens.shift()
    if (!token) {
      continue
    }

    if (token === "--help" || token === "-h") {
      parsed.help = true
      continue
    }

    if (token === "--api-key") {
      parsed.apiKey = (tokens.shift() || "").trim()
      continue
    }
  }

  return parsed
}

function printHelp() {
  console.log("OpenCode EXA MCP Setup")
  console.log("")
  console.log("Usage:")
  console.log("  ocs exa setup --api-key <YOUR_EXA_API_KEY>")
  console.log("  ocs exa check")
  console.log("  ocs exa:setup --api-key <YOUR_EXA_API_KEY>")
  console.log("  ocs exa:check")
}

function isObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function ensureDirForFile(filePath) {
  const parentDir = path.dirname(filePath)
  fs.mkdirSync(parentDir, { recursive: true })
}

function readJsonSafe(filePath) {
  if (!fs.existsSync(filePath)) {
    return { exists: false, data: {} }
  }

  try {
    return { exists: true, data: JSON.parse(fs.readFileSync(filePath, "utf8")) }
  } catch {
    throw new Error(`Invalid JSON: ${filePath}`)
  }
}

function writeJsonPretty(filePath, value) {
  ensureDirForFile(filePath)
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function resolveCheckConfigPath() {
  const userPath = getUserOpencodePath()
  if (fs.existsSync(userPath)) {
    return userPath
  }

  return getBundledOpencodePath()
}

function resolveSetupConfigPath() {
  return getUserOpencodePath()
}

function ensureMcpShape(config) {
  if (!isObject(config)) {
    return {}
  }

  const next = cloneJson(config)
  if (!isObject(next.mcp)) {
    next.mcp = {}
  }

  return next
}

function ensureMcpParity(config) {
  const next = ensureMcpShape(config)

  if (!isObject(next.mcp.github)) {
    next.mcp.github = cloneJson(DEFAULT_GITHUB_MCP)
  }

  if (!isObject(next.mcp.time)) {
    next.mcp.time = cloneJson(DEFAULT_TIME_MCP)
  }

  if (!isObject(next.mcp.context7)) {
    next.mcp.context7 = cloneJson(DEFAULT_CONTEXT7_MCP)
  }

  if (!isObject(next.mcp.grep_app)) {
    next.mcp.grep_app = cloneJson(DEFAULT_GREP_APP_MCP)
  }

  if (!isObject(next.mcp.exa)) {
    next.mcp.exa = cloneJson(DEFAULT_EXA_MCP)
  }

  return next
}

function hasCommandToken(value, token) {
  if (!Array.isArray(value)) {
    return false
  }

  return value.some((entry) => String(entry || "").trim() === token)
}

function applyGithubDefaults(github) {
  if (!isObject(github)) {
    return cloneJson(DEFAULT_GITHUB_MCP)
  }

  if (github.type === "remote" && github.url === "https://api.githubcopilot.com/mcp/") {
    return cloneJson(DEFAULT_GITHUB_MCP)
  }

  if (github.type === "local" && hasCommandToken(github.command, "@modelcontextprotocol/server-github")) {
    return cloneJson(DEFAULT_GITHUB_MCP)
  }

  return cloneJson(github)
}

function applyTimeDefaults(time) {
  if (!isObject(time)) {
    return cloneJson(DEFAULT_TIME_MCP)
  }

  if (time.type !== "local") {
    return cloneJson(DEFAULT_TIME_MCP)
  }

  if (hasCommandToken(time.command, "@modelcontextprotocol/server-time")) {
    return cloneJson(DEFAULT_TIME_MCP)
  }

  if (hasCommandToken(time.command, "time-mcp")) {
    return cloneJson(DEFAULT_TIME_MCP)
  }

  return cloneJson(time)
}

function applyExaDefaults(exa) {
  const next = isObject(exa) ? cloneJson(exa) : cloneJson(DEFAULT_EXA_MCP)
  next.type = "remote"
  next.url = "https://mcp.exa.ai/mcp"
  delete next.oauth

  if (!isObject(next.headers)) {
    next.headers = {}
  }

  const rawKey = next.headers["x-api-key"]
  if (isObject(rawKey) && typeof rawKey.env === "string" && rawKey.env.trim().length > 0) {
    next.headers["x-api-key"] = `{env:${rawKey.env.trim()}}`
  }

  return next
}

function resolveConfiguredApiKey(exa) {
  if (!isObject(exa) || !isObject(exa.headers)) {
    return { source: "missing", value: "" }
  }

  const raw = exa.headers["x-api-key"]

  if (isObject(raw) && typeof raw.env === "string" && raw.env.trim().length > 0) {
    const envName = raw.env.trim()
    const envValue = String(process.env[envName] || "").trim()
    return {
      source: envValue ? "env" : "env-missing",
      value: envValue,
      envName,
    }
  }

  if (typeof raw === "string" && raw.trim().length > 0) {
    const envRef = raw.trim().match(/^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/)
    if (envRef) {
      const envName = envRef[1]
      const envValue = String(process.env[envName] || "").trim()
      return {
        source: envValue ? "env" : "env-missing",
        value: envValue,
        envName,
      }
    }

    return {
      source: "inline",
      value: raw.trim(),
    }
  }

  return { source: "missing", value: "" }
}

function maskApiKey(input) {
  if (!input || input.length < 8) {
    return "********"
  }

  return `${input.slice(0, 4)}…${input.slice(-4)}`
}

function setupCommand(parsed) {
  const configPath = resolveSetupConfigPath()
  const snapshot = readJsonSafe(configPath)
  const nextConfig = ensureMcpParity(snapshot.data)

  nextConfig.mcp.github = applyGithubDefaults(nextConfig.mcp.github)
  nextConfig.mcp.time = applyTimeDefaults(nextConfig.mcp.time)

  const nextExa = applyExaDefaults(nextConfig.mcp.exa)

  const apiKey = parsed.apiKey || String(process.env.EXA_API_KEY || "").trim()
  if (apiKey) {
    nextExa.headers["x-api-key"] = apiKey
  } else {
    nextExa.headers["x-api-key"] = "{env:EXA_API_KEY}"
  }

  nextConfig.mcp.exa = nextExa
  writeJsonPretty(configPath, nextConfig)

  console.log("✅ EXA MCP configured")
  console.log(`- config: ${configPath}`)
  console.log("- mcp.exa.url: https://mcp.exa.ai/mcp")

  if (apiKey) {
    console.log(`- api key: ${maskApiKey(apiKey)} (saved to opencode.json)`)
  } else {
    console.log("- api key: not provided (using env reference EXA_API_KEY)")
    console.log("  set env before use: export EXA_API_KEY=<YOUR_EXA_API_KEY>")
  }
}

function checkCommand() {
  const configPath = resolveCheckConfigPath()
  const snapshot = readJsonSafe(configPath)
  const config = ensureMcpShape(snapshot.data)

  if (!isObject(config.mcp.exa)) {
    console.log("❌ EXA MCP not configured")
    console.log("Run: ocs exa setup --api-key <YOUR_EXA_API_KEY>")
    process.exit(1)
  }

  const exa = applyExaDefaults(config.mcp.exa)
  const keyState = resolveConfiguredApiKey(exa)
  const hasValidExa = exa.type === "remote" && exa.url === "https://mcp.exa.ai/mcp"

  if (!hasValidExa) {
    console.log("❌ EXA MCP is misconfigured")
    console.log(`- detected url: ${String(exa.url || "<missing>")}`)
    console.log("Run: ocs exa setup --api-key <YOUR_EXA_API_KEY>")
    process.exit(1)
  }

  if (keyState.source === "missing") {
    console.log("❌ EXA MCP key missing")
    console.log("Provide key with: ocs exa setup --api-key <YOUR_EXA_API_KEY>")
    process.exit(1)
  }

  if (keyState.source === "env-missing") {
    console.log(`❌ EXA MCP key env missing: ${keyState.envName}`)
    console.log(`Set env then retry: export ${keyState.envName}=<YOUR_EXA_API_KEY>`)
    process.exit(1)
  }

  console.log("✅ EXA MCP is healthy")
  console.log(`- config: ${configPath}`)
  console.log(`- url: ${exa.url}`)

  if (keyState.source === "inline") {
    console.log(`- key source: inline (${maskApiKey(keyState.value)})`)
  } else {
    console.log(`- key source: env ${keyState.envName} (${maskApiKey(keyState.value)})`)
  }
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))
  const command = parsed.command

  if (parsed.help || !command) {
    printHelp()
    return
  }

  if (command === "setup") {
    setupCommand(parsed)
    return
  }

  if (command === "check") {
    checkCommand()
    return
  }

  console.error(`Unknown exa command: ${command}`)
  printHelp()
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  parseArgs,
  resolveConfiguredApiKey,
}
