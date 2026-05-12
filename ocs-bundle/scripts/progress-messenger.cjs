const DEFAULT_PROGRESS_THRESHOLD_MS = {
  install: 3000,
  doctor: 5000,
  index: 5000,
  release: 8000,
};

const DEFAULT_PROGRESS_INTERVAL_MS = 4000;

const PROGRESS_MESSAGE_CATALOG = {
  install: {
    default: [
      "Still working: preparing your OCS runtime and profile wiring.",
      "This can take a bit on first install because package tools are being checked.",
      "OCS is validating command paths so new shells work without manual fixes.",
    ],
    dependencyInstall: [
      "Installing runtime dependencies so OCS commands behave consistently in new shells.",
      "Package manager work can stay quiet for a moment while downloads and lock checks finish.",
      "Once this step completes, plugin commands and shims should be ready to use.",
    ],
    runtimeBootstrap: [
      "Checking native support tools that OCS uses for command routing and recovery.",
      "If a healthy runtime already exists, OCS will reuse it instead of rebuilding from scratch.",
      "First-time native tool setup can pause briefly while installers and shell hooks are verified.",
    ],
    cocoindexBootstrap: [
      "Checking CocoIndex support for this project session.",
      "If CocoIndex is already healthy, OCS will reuse it instead of rebuilding from scratch.",
      "Python and MCP checks can take a little longer on fresh environments.",
    ],
    setupProfile: [
      "Applying your selected OCS profile and runtime defaults.",
      "OCS is keeping account state while refreshing the managed config surface.",
      "You will be able to use the updated profile as soon as this setup step completes.",
    ],
  },
  doctor: {
    default: [
      "OCS is checking the runtime health surface and safe repair paths.",
      "Some remediation steps may wait on package tools or native command verification.",
      "When this finishes, OCS will rerun diagnostics so the final result reflects the repaired state.",
    ],
    remediation: [
      "Applying safe remediation for missing shims, package tools, or runtime markers.",
      "Network and package-manager checks can stay visually quiet for a few seconds here.",
      "OCS will rerun doctor checks immediately after remediation completes.",
    ],
  },
  index: {
    default: [
      "Preparing CocoIndex for this project workspace.",
      "Index health checks can pause while the local daemon or Python runtime responds.",
      "OCS keeps this project-scoped so unrelated workspaces are not touched.",
    ],
    indexing: [
      "CocoIndex is scanning this workspace and reusing existing state where possible.",
      "Large projects can take longer while code metadata is collected and stored.",
      "You can inspect the project log if you want lower-level indexing detail.",
    ],
    doctor: [
      "Running CocoIndex doctor checks for this workspace.",
      "If the runtime is already healthy, OCS will finish without rebuilding anything.",
      "Runtime probes may pause briefly while daemon and Python checks settle.",
    ],
    rebuild: [
      "Rebuilding the project index with the current workspace settings.",
      "Hard resets can take longer because OCS must recreate the local index state.",
      "When this completes, the project index should reflect the latest source tree.",
    ],
  },
  release: {
    default: [
      "Preparing buyer-safe release assets for this OCS build.",
      "Release packaging can pause while large files are copied and checksummed.",
      "OCS will only report success after the bundle artifacts are ready.",
    ],
    bundle: [
      "Syncing release assets across source, buyer, and installer lanes.",
      "Verifying checksums so buyers receive the exact artifact you built.",
      "Large bundle copies and archive creation can stay quiet for a few seconds.",
    ],
  },
};

function resolveProgressMessages(channel, scenario = "default", messagesOverride) {
  if (Array.isArray(messagesOverride) && messagesOverride.length > 0) {
    return messagesOverride.map((message) => String(message));
  }

  const channelCatalog = PROGRESS_MESSAGE_CATALOG[channel] || {};
  const scenarioMessages = channelCatalog[scenario];
  if (Array.isArray(scenarioMessages) && scenarioMessages.length > 0) {
    return scenarioMessages;
  }

  if (Array.isArray(channelCatalog.default) && channelCatalog.default.length > 0) {
    return channelCatalog.default;
  }

  return [];
}

function shouldEnableProgressMessages(options = {}) {
  const env = options.env || process.env;

  if (options.enabled === false) {
    return false;
  }

  if (env.OCS_PROGRESS_TEXT === "0" || env.OCS_QUIET === "1") {
    return false;
  }

  if (String(env.CI || "").toLowerCase() === "true") {
    return false;
  }

  if (typeof options.isInteractive === "boolean") {
    return options.isInteractive;
  }

  const stdout = options.stdout || process.stdout;
  if (stdout && typeof stdout.isTTY === "boolean") {
    return stdout.isTTY;
  }

  return true;
}

function createProgressMessenger(options = {}) {
  const channel = options.channel || "install";
  const scenario = options.scenario || "default";
  const log = options.log || console.log;
  const prefix = options.prefix || "   ⏳";
  const intervalMs = options.intervalMs || DEFAULT_PROGRESS_INTERVAL_MS;
  const thresholdMs =
    options.thresholdMs || DEFAULT_PROGRESS_THRESHOLD_MS[channel] || DEFAULT_PROGRESS_INTERVAL_MS;
  const messages = resolveProgressMessages(channel, scenario, options.messages);
  const enabled = shouldEnableProgressMessages(options) && messages.length > 0;

  let started = false;
  let timeoutHandle = null;
  let intervalHandle = null;
  let messageIndex = 0;

  const emit = () => {
    const message = messages[messageIndex % messages.length];
    messageIndex += 1;
    log(`${prefix} ${message}`);
  };

  const clear = () => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }
    if (intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
    }
  };

  return {
    start() {
      if (!enabled || started) {
        return this;
      }

      started = true;
      timeoutHandle = setTimeout(() => {
        emit();
        intervalHandle = setInterval(emit, intervalMs);
        if (intervalHandle && typeof intervalHandle.unref === "function") {
          intervalHandle.unref();
        }
      }, thresholdMs);
      if (timeoutHandle && typeof timeoutHandle.unref === "function") {
        timeoutHandle.unref();
      }
      return this;
    },
    stop() {
      clear();
      started = false;
      return this;
    },
    isEnabled() {
      return enabled;
    },
  };
}

function runWithProgress(options, work) {
  const messenger = createProgressMessenger(options);
  messenger.start();

  try {
    const result = work();
    if (result && typeof result.then === "function") {
      return result.finally(() => {
        messenger.stop();
      });
    }

    messenger.stop();
    return result;
  } catch (error) {
    messenger.stop();
    throw error;
  }
}

module.exports = {
  DEFAULT_PROGRESS_INTERVAL_MS,
  DEFAULT_PROGRESS_THRESHOLD_MS,
  PROGRESS_MESSAGE_CATALOG,
  createProgressMessenger,
  resolveProgressMessages,
  runWithProgress,
  shouldEnableProgressMessages,
};
