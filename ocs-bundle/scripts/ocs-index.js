#!/usr/bin/env bun

const fs = require("node:fs")
const os = require("node:os")
const path = require("node:path")
const crypto = require("node:crypto")
const { spawn, spawnSync } = require("node:child_process")

const {
  buildCocoIndexCliInvocation,
  ensureCocoIndexCommandShim,
  resolveCocoIndexCommand,
  resolveCocoIndexPythonCommand,
} = require("./setup.js")
const { runWithProgress } = require("./progress-messenger.cjs")

const DEFAULT_COCOINDEX_SETTINGS_CONTENTS = `exclude_patterns:
- '**/.*'
- '**/__pycache__'
- '**/node_modules'
- '**/target'
- '**/build/assets'
- '**/dist'
- '**/vendor/*.*/*'
- '**/vendor/*'
- '**/.cocoindex_code'
include_patterns:
- '**/*.py'
- '**/*.pyi'
- '**/*.js'
- '**/*.jsx'
- '**/*.ts'
- '**/*.tsx'
- '**/*.mjs'
- '**/*.cjs'
- '**/*.rs'
- '**/*.go'
- '**/*.java'
- '**/*.c'
- '**/*.h'
- '**/*.cpp'
- '**/*.hpp'
- '**/*.cc'
- '**/*.cxx'
- '**/*.hxx'
- '**/*.hh'
- '**/*.cs'
- '**/*.sql'
- '**/*.sh'
- '**/*.bash'
- '**/*.zsh'
- '**/*.md'
- '**/*.mdx'
- '**/*.txt'
- '**/*.rst'
- '**/*.php'
- '**/*.lua'
- '**/*.rb'
- '**/*.swift'
- '**/*.kt'
- '**/*.kts'
- '**/*.scala'
- '**/*.r'
- '**/*.html'
- '**/*.htm'
- '**/*.css'
- '**/*.scss'
- '**/*.json'
- '**/*.xml'
- '**/*.yaml'
- '**/*.yml'
- '**/*.toml'
- '**/*.sol'
- '**/*.pas'
- '**/*.dpr'
- '**/*.dtd'
- '**/*.f'
- '**/*.f90'
- '**/*.f95'
- '**/*.f03'
`

function printHelp() {
  console.log("Usage:")
  console.log("  ocs index start [--force] [--wait] [--timeout <seconds>]")
  console.log("  ocs index status")
  console.log("  ocs index logs [--tail <lines>] [--follow]")
  console.log("  ocs index stop [--timeout <seconds>] [--force]")
  console.log("  ocs index doctor")
  console.log("  ocs index rebuild [--force] [--hard-reset]")
}

function parseArgs(argv) {
  const tokens = [...argv]
  const parsed = {
    command: "",
    help: false,
    force: false,
    wait: false,
    follow: false,
    hardReset: false,
    timeoutSeconds: 30,
    tail: 100,
    unknown: [],
  }

  if (tokens.length > 0 && !tokens[0].startsWith("-")) {
    parsed.command = tokens.shift() || ""
  }

  while (tokens.length > 0) {
    const token = tokens.shift()
    if (!token) continue

    if (token === "--help" || token === "-h") {
      parsed.help = true
      continue
    }

    if (token === "--force") {
      parsed.force = true
      continue
    }

    if (token === "--wait") {
      parsed.wait = true
      continue
    }

    if (token === "--follow") {
      parsed.follow = true
      continue
    }

    if (token === "--hard-reset") {
      parsed.hardReset = true
      continue
    }

    if (token === "--timeout") {
      const raw = tokens.shift() || ""
      const value = Number.parseInt(raw, 10)
      if (Number.isFinite(value) && value > 0) {
        parsed.timeoutSeconds = value
      } else {
        parsed.unknown.push(`--timeout ${raw}`.trim())
      }
      continue
    }

    if (token === "--tail") {
      const raw = tokens.shift() || ""
      const value = Number.parseInt(raw, 10)
      if (Number.isFinite(value) && value > 0) {
        parsed.tail = value
      } else {
        parsed.unknown.push(`--tail ${raw}`.trim())
      }
      continue
    }

    parsed.unknown.push(token)
  }

  return parsed
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true })
}

function getStateRoot() {
  const configRoot = path.join(os.homedir(), ".config", "opencode", "cocoindex")
  const runtimeRoot = path.join(configRoot, "index-runtime")
  ensureDir(runtimeRoot)
  ensureDir(path.join(runtimeRoot, "state"))
  ensureDir(path.join(runtimeRoot, "pids"))
  ensureDir(path.join(runtimeRoot, "logs"))
  ensureDir(path.join(runtimeRoot, "locks"))
  return runtimeRoot
}

function findProjectRoot(startDir, fsApi = fs) {
  let current = path.resolve(String(startDir || process.cwd()))

  while (true) {
    if (fsApi.existsSync(path.join(current, ".git"))) {
      return current
    }

    const parent = path.dirname(current)
    if (parent === current) {
      return null
    }
    current = parent
  }
}

function getProjectRootErrorMessage(startDir) {
  const targetDir = path.resolve(String(startDir || process.cwd()))
  return `CocoIndex project scope requires a Git-tracked project root. No .git directory was found for ${targetDir}.`
}

function deriveProjectKey(cwdValue) {
  const cwd = String(cwdValue || process.cwd())
  const base = path.basename(cwd).replace(/[^a-zA-Z0-9-_]/g, "_") || "project"
  const hash = crypto.createHash("sha1").update(cwd).digest("hex").slice(0, 10)
  return `${base}-${hash}`
}

function getProjectFiles(cwdValue) {
  const key = deriveProjectKey(cwdValue)
  const root = getStateRoot()
  return {
    key,
    root,
    stateFile: path.join(root, "state", `${key}.json`),
    pidFile: path.join(root, "pids", `${key}.pid`),
    lockFile: path.join(root, "locks", `${key}.lock`),
    logFile: path.join(root, "logs", `${key}.log`),
  }
}

function getProjectSettingsPath(cwdValue) {
  return path.join(String(cwdValue || process.cwd()), ".cocoindex_code", "settings.yml")
}

function isProjectSettingsValid(settingsPath, fsApi = fs) {
  if (!fsApi.existsSync(settingsPath)) {
    return false
  }

  try {
    const raw = String(fsApi.readFileSync(settingsPath, "utf8") || "")
    return raw.includes("exclude_patterns:") && raw.includes("include_patterns:")
  } catch {
    return false
  }
}

function ensureProjectSettingsScaffold(settingsPath, fsApi = fs) {
  fsApi.mkdirSync(path.dirname(settingsPath), { recursive: true })
  fsApi.writeFileSync(settingsPath, DEFAULT_COCOINDEX_SETTINGS_CONTENTS, "utf8")
}

function readState(stateFile) {
  if (!fs.existsSync(stateFile)) {
    return null
  }

  try {
    return JSON.parse(fs.readFileSync(stateFile, "utf8"))
  } catch {
    return null
  }
}

function writeState(stateFile, value) {
  fs.writeFileSync(stateFile, `${JSON.stringify(value, null, 2)}\n`, "utf8")
}

function readPid(pidFile) {
  if (!fs.existsSync(pidFile)) {
    return null
  }

  const raw = String(fs.readFileSync(pidFile, "utf8") || "").trim()
  const pid = Number.parseInt(raw, 10)
  if (!Number.isFinite(pid) || pid <= 0) {
    return null
  }
  return pid
}

function processIsRunning(pid) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function resolveCccCommand(options = {}) {
  const {
    pythonCommand = resolveCocoIndexPythonCommand(),
    resolveCommand = resolveCocoIndexCommand,
    ensureShim = ensureCocoIndexCommandShim,
    platform = process.platform,
  } = options
  const resolved = resolveCommand(pythonCommand)
  return (
    ensureShim(resolved, {
      pythonCommand,
      platform,
    }) || "ccc"
  )
}

function writeLock(lockFile) {
  fs.writeFileSync(lockFile, `${Date.now()}`, "utf8")
}

function clearLock(lockFile) {
  if (fs.existsSync(lockFile)) {
    fs.rmSync(lockFile, { force: true })
  }
}

function isLocked(lockFile) {
  return fs.existsSync(lockFile)
}

function runSync(cwdValue, command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: cwdValue,
    stdio: options.stdio || "inherit",
    timeout: options.timeoutMs,
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
      ...options.env,
    },
    windowsHide: true,
  })

  if (child.error) {
    throw child.error
  }

  if (typeof child.status === "number" && child.status !== 0) {
    throw new Error(`Command failed (${command} ${args.join(" ")}) with code ${child.status}`)
  }

  return child
}

function runSyncCapture(cwdValue, command, args, options = {}) {
  const child = spawnSync(command, args, {
    cwd: cwdValue,
    stdio: "pipe",
    encoding: "utf8",
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
      ...options.env,
    },
    windowsHide: true,
  })

  return {
    status: typeof child.status === "number" ? child.status : 1,
    stdout: String(child.stdout || ""),
    stderr: String(child.stderr || ""),
    error: child.error || null,
  }
}

function parseCocoIndexProjectFromStatus(output) {
  const match = String(output || "").match(/^Project:\s+(.+)$/m)
  return match ? match[1].trim() : ""
}

function isDaemonVersionMismatch(output) {
  return /DaemonVersionError|daemon version mismatch/i.test(String(output || ""))
}

function isDaemonConnectionIssue(output) {
  return /not[- ]connected|connection refused|econnrefused|failed to connect|unable to connect|daemon unavailable|service inactive/i.test(String(output || ""))
}

function classifyRuntimeRecoveryReason(output) {
  if (isDaemonVersionMismatch(output)) {
    return "daemon_version_mismatch"
  }

  if (isDaemonConnectionIssue(output)) {
    return "daemon_not_connected"
  }

  return null
}

function cleanupWindowsStaleCocoIndexProcesses(cwdValue, runSyncCaptureImpl = runSyncCapture) {
  const script = [
    "$procs = Get-CimInstance Win32_Process | Where-Object {",
    "  ($_.Name -match 'python|ccc') -and ($_.CommandLine -match 'cocoindex|ccc')",
    "}",
    "foreach ($proc in $procs) {",
    "  try { Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop } catch {}",
    "}",
  ].join("; ")
  return runSyncCaptureImpl(cwdValue, "powershell.exe", ["-NoProfile", "-Command", script])
}

function restartDaemonForVersionMismatch(cwdValue, command, runSyncCaptureImpl = runSyncCapture, options = {}) {
  const platform = options.platform || process.platform
  if (platform === "win32") {
    cleanupWindowsStaleCocoIndexProcesses(cwdValue, runSyncCaptureImpl)
  }

  const result = runSyncCaptureImpl(cwdValue, command, ["daemon", "restart"])
  if (result.error) {
    throw result.error
  }
  if (result.status !== 0) {
    const detail = `${result.stdout}${result.stderr}`.trim()
    throw new Error(detail || `Command failed (${command} daemon restart) with code ${result.status}`)
  }
}

function ensureProjectInitialized(cwdValue, command = resolveCccCommand(), options = {}) {
  const runSyncImpl = options.runSyncImpl || runSync
  const fsApi = options.fsApi || fs
  const log = options.log || console.warn
  const settingsPath = getProjectSettingsPath(cwdValue)
  if (isProjectSettingsValid(settingsPath, fsApi)) {
    return false
  }

  try {
    runSyncImpl(cwdValue, command, ["init", "-f"], { timeoutMs: 15000 })
  } catch (error) {
    log(`CocoIndex project init did not complete cleanly: ${error.message}`)
  }

  if (!isProjectSettingsValid(settingsPath, fsApi)) {
    ensureProjectSettingsScaffold(settingsPath, fsApi)
  }

  return true
}

function ensureProjectRuntimeReady(cwdValue, options = {}) {
  const fsApi = options.fsApi || fs
  const projectRoot = (options.findProjectRootImpl || findProjectRoot)(cwdValue, fsApi)
  if (!projectRoot) {
    throw new Error(getProjectRootErrorMessage(cwdValue))
  }
  const cccCommand = options.cccCommand || resolveCccCommand()
  const ensureProjectInitializedImpl = options.ensureProjectInitializedImpl || ensureProjectInitialized
  const runSyncCaptureImpl = options.runSyncCaptureImpl || runSyncCapture
  const restartDaemonImpl = options.restartDaemonImpl || restartDaemonForVersionMismatch
  const pythonCommand = options.pythonCommand || resolveCocoIndexPythonCommand()
  const platform = options.platform || process.platform
  const log = options.log || (() => {})
  const initialized = ensureProjectInitializedImpl(projectRoot, cccCommand)

  const executeStatus = () => {
    const result = runSyncCaptureImpl(projectRoot, cccCommand, ["status"])
    if (result.error) {
      throw result.error
    }
    return result
  }

  const result = executeStatus()
  if (result.status === 0) {
    return {
      cccCommand,
      initialized,
      projectRoot,
      recovered: false,
      recoveryReason: null,
      result,
    }
  }

  const detail = `${result.stdout}${result.stderr}`.trim()
  const recoveryReason = classifyRuntimeRecoveryReason(detail)
  if (!recoveryReason) {
    throw new Error(detail || `Command failed (${cccCommand} status) with code ${result.status}`)
  }

  if (recoveryReason === "daemon_version_mismatch") {
    log("CocoIndex daemon version mismatch detected. Restarting daemon and retrying status...")
  } else {
    log("CocoIndex runtime is not connected. Restarting daemon and retrying status...")
  }

  restartDaemonImpl(projectRoot, cccCommand, runSyncCaptureImpl, { platform, pythonCommand })
  const retry = executeStatus()
  if (retry.status !== 0) {
    const retryDetail = `${retry.stdout}${retry.stderr}`.trim()
    throw new Error(retryDetail || `Command failed (${cccCommand} status) with code ${retry.status}`)
  }

  return {
    cccCommand,
    initialized,
    projectRoot,
    recovered: true,
    recoveryReason,
    result: retry,
  }
}

function reportProjectMismatch(cwdValue, reportedProject, log = console.log) {
  if (!reportedProject || path.resolve(reportedProject) === path.resolve(cwdValue)) {
    return
  }

  log(`ccc status project mismatch: ${reportedProject}`)
  log("Per-project wrapper scope remains anchored to the current working directory.")
  log(`Project settings: ${getProjectSettingsPath(cwdValue)}`)
}

function waitUntilStopped(pid, timeoutSeconds) {
  const started = Date.now()
  while (Date.now() - started < timeoutSeconds * 1000) {
    if (!processIsRunning(pid)) {
      return true
    }
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250)
  }
  return !processIsRunning(pid)
}

function startIndex(parsed, files, cwdValue) {
  const existingPid = readPid(files.pidFile)
  if (existingPid && processIsRunning(existingPid) && !parsed.force) {
    console.log(`Indexer already running (pid ${existingPid}). Use --force to restart.`)
    return
  }

  if (isLocked(files.lockFile)) {
    if (!parsed.force) {
      console.log("Index lock is active. Wait or use --force.")
      return
    }
    clearLock(files.lockFile)
  }

  const cccCommand = resolveCccCommand()
  ensureProjectInitialized(cwdValue, cccCommand)
  if (parsed.wait) {
    writeLock(files.lockFile)
    try {
      runWithProgress(
        {
          channel: "index",
          scenario: "indexing",
        },
        () => runSync(cwdValue, cccCommand, ["index"]),
      )
      writeState(files.stateFile, {
        project: cwdValue,
        status: "completed",
        finishedAt: new Date().toISOString(),
        logFile: files.logFile,
      })
      console.log("Indexing completed.")
    } finally {
      clearLock(files.lockFile)
    }
    return
  }

  ensureDir(path.dirname(files.logFile))
  const outFd = fs.openSync(files.logFile, "a")

  writeLock(files.lockFile)
  const child = spawn(cccCommand, ["index"], {
    cwd: cwdValue,
    detached: true,
    stdio: ["ignore", outFd, outFd],
    env: {
      ...process.env,
      PYTHONUTF8: "1",
      PYTHONIOENCODING: "utf-8",
    },
    windowsHide: true,
  })

  child.unref()
  fs.writeFileSync(files.pidFile, `${child.pid}\n`, "utf8")
  writeState(files.stateFile, {
    project: cwdValue,
    pid: child.pid,
    status: "running",
    startedAt: new Date().toISOString(),
    logFile: files.logFile,
  })

  clearLock(files.lockFile)
  console.log(`Indexing started in background (pid ${child.pid}).`)
  console.log(`Logs: ${files.logFile}`)
}

function printStatus(files, cwdValue, options = {}) {
  const state = readState(files.stateFile)
  const pid = readPid(files.pidFile)
  const running = processIsRunning(pid)

  console.log(`Project: ${cwdValue}`)
  console.log(`Key: ${files.key}`)
  console.log(`Running: ${running ? "yes" : "no"}`)
  console.log(`PID: ${pid || "-"}`)
  console.log(`Log: ${files.logFile}`)

  if (state) {
    console.log(`State: ${state.status || "unknown"}`)
    if (state.startedAt) {
      console.log(`Started: ${state.startedAt}`)
    }
    if (state.finishedAt) {
      console.log(`Finished: ${state.finishedAt}`)
    }
  }

  try {
    const runtime = ensureProjectRuntimeReady(cwdValue, {
      ...options,
      log: console.log,
    })
    const reportedProject = parseCocoIndexProjectFromStatus(runtime.result.stdout)
    reportProjectMismatch(runtime.projectRoot, reportedProject)
    const combined = `${runtime.result.stdout}${runtime.result.stderr}`.trim()
    if (combined) {
      console.log(combined)
    }
  } catch (error) {
    console.log(`ccc status failed: ${error.message}`)
    return false
  }

  return true
}

function readTail(filePath, lineCount) {
  if (!fs.existsSync(filePath)) {
    return []
  }
  const raw = fs.readFileSync(filePath, "utf8")
  const lines = raw.split(/\r?\n/)
  return lines.slice(Math.max(0, lines.length - lineCount))
}

function streamLogs(filePath, lineCount) {
  const initial = readTail(filePath, lineCount)
  if (initial.length > 0) {
    for (const line of initial) {
      if (line) console.log(line)
    }
  }

  let position = fs.existsSync(filePath) ? fs.statSync(filePath).size : 0
  console.log("-- following logs (Ctrl+C to exit) --")
  setInterval(() => {
    if (!fs.existsSync(filePath)) {
      return
    }

    const stat = fs.statSync(filePath)
    if (stat.size <= position) {
      return
    }

    const fd = fs.openSync(filePath, "r")
    try {
      const nextSize = stat.size - position
      const buffer = Buffer.alloc(nextSize)
      fs.readSync(fd, buffer, 0, nextSize, position)
      position = stat.size
      const chunk = buffer.toString("utf8")
      if (chunk) process.stdout.write(chunk)
    } finally {
      fs.closeSync(fd)
    }
  }, 1000)
}

function showLogs(parsed, files) {
  if (!fs.existsSync(files.logFile)) {
    console.log("No log file yet. Start indexing first.")
    return
  }

  if (parsed.follow) {
    streamLogs(files.logFile, parsed.tail)
    return
  }

  const lines = readTail(files.logFile, parsed.tail)
  for (const line of lines) {
    if (line) console.log(line)
  }
}

function stopIndex(parsed, files) {
  const pid = readPid(files.pidFile)
  if (!pid || !processIsRunning(pid)) {
    console.log("No running index process found.")
    return
  }

  try {
    process.kill(pid, "SIGTERM")
  } catch (error) {
    if (!parsed.force) {
      throw error
    }
  }

  const stopped = waitUntilStopped(pid, parsed.timeoutSeconds)
  if (!stopped) {
    if (!parsed.force) {
      console.log("Process did not stop within timeout. Re-run with --force.")
      return
    }
    process.kill(pid, "SIGKILL")
  }

  if (fs.existsSync(files.pidFile)) {
    fs.rmSync(files.pidFile, { force: true })
  }
  writeState(files.stateFile, {
    project: process.cwd(),
    status: "stopped",
    finishedAt: new Date().toISOString(),
    logFile: files.logFile,
  })
  console.log("Index process stopped.")
}

function runDoctor(cwdValue) {
  const cccCommand = resolveCccCommand()
  ensureProjectInitialized(cwdValue, cccCommand)
  runWithProgress(
    {
      channel: "index",
      scenario: "doctor",
    },
    () => runSync(cwdValue, cccCommand, ["doctor"]),
  )
}

function runRebuild(parsed, files, cwdValue) {
  if (!parsed.force) {
    console.log("Rebuild is guarded. Re-run with --force to proceed.")
    return
  }

  if (isLocked(files.lockFile)) {
    console.log("Index lock is active. Wait until it clears.")
    return
  }

  writeLock(files.lockFile)
  try {
    const cccCommand = resolveCccCommand()
    ensureProjectInitialized(cwdValue, cccCommand)

    runWithProgress(
      {
        channel: "index",
        scenario: "rebuild",
      },
      () => {
        if (parsed.hardReset) {
          runSync(cwdValue, cccCommand, ["reset", "-f"])
        }

        runSync(cwdValue, cccCommand, ["init", "-f"])
        runSync(cwdValue, cccCommand, ["index"])
      },
    )

    writeState(files.stateFile, {
      project: cwdValue,
      status: "rebuilt",
      finishedAt: new Date().toISOString(),
      hardReset: parsed.hardReset,
      logFile: files.logFile,
    })
    console.log("Rebuild completed.")
  } finally {
    clearLock(files.lockFile)
  }
}

function printRetentionPolicy(cwdValue) {
  const indexDir = path.join(cwdValue, ".cocoindex_code")
  if (fs.existsSync(indexDir)) {
    console.log(`Retention: existing index kept at ${indexDir}`)
    console.log("Setup/reinstall will reuse existing index state unless explicit hard reset is requested.")
    return
  }

  console.log("Retention: no existing project index folder detected yet.")
  console.log("Future reinstall/setup keeps existing index state by default (non-destructive).")
}

function main() {
  const parsed = parseArgs(process.argv.slice(2))

  if (parsed.help || !parsed.command) {
    printHelp()
    return
  }

  if (parsed.unknown.length > 0) {
    console.error(`Unknown option(s): ${parsed.unknown.join(" ")}`)
    console.error("")
    printHelp()
    process.exit(1)
  }

  const cwdValue = findProjectRoot(process.cwd())
  if (!cwdValue) {
    console.error(getProjectRootErrorMessage(process.cwd()))
    process.exit(1)
  }
  const files = getProjectFiles(cwdValue)

  printRetentionPolicy(cwdValue)

  if (parsed.command === "start") {
    startIndex(parsed, files, cwdValue)
    return
  }

  if (parsed.command === "status") {
    const ok = printStatus(files, cwdValue)
    if (!ok) {
      process.exitCode = 1
    }
    return
  }

  if (parsed.command === "logs") {
    showLogs(parsed, files)
    return
  }

  if (parsed.command === "stop") {
    stopIndex(parsed, files)
    return
  }

  if (parsed.command === "doctor") {
    runDoctor(cwdValue)
    return
  }

  if (parsed.command === "rebuild") {
    runRebuild(parsed, files, cwdValue)
    return
  }

  console.error(`Unknown index command: ${parsed.command}`)
  console.error("")
  printHelp()
  process.exit(1)
}

if (require.main === module) {
  main()
}

module.exports = {
  deriveProjectKey,
  ensureProjectSettingsScaffold,
  ensureProjectRuntimeReady,
  findProjectRoot,
  getProjectSettingsPath,
  isDaemonConnectionIssue,
  isProjectSettingsValid,
  isDaemonVersionMismatch,
  parseArgs,
  parseCocoIndexProjectFromStatus,
  printStatus,
  readTail,
  ensureProjectInitialized,
  restartDaemonForVersionMismatch,
  resolveCccCommand,
  getProjectRootErrorMessage,
}
