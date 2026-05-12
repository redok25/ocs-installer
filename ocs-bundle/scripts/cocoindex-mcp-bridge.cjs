#!/usr/bin/env node

const { spawn } = require("node:child_process")

function forwardFramedToLine(child) {
  let buffer = Buffer.alloc(0)

  process.stdin.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk])

    while (buffer.length > 0) {
      const headerEnd = buffer.indexOf("\r\n\r\n")
      if (headerEnd === -1) {
        const newline = buffer.indexOf(0x0a)
        if (newline === -1) {
          return
        }

        const line = buffer.subarray(0, newline + 1)
        buffer = buffer.subarray(newline + 1)
        if (line.toString("utf8").trim()) {
          child.stdin.write(line)
        }
        continue
      }

      const header = buffer.subarray(0, headerEnd).toString("utf8")
      const match = header.match(/Content-Length:\s*(\d+)/i)
      if (!match) {
        buffer = buffer.subarray(headerEnd + 4)
        continue
      }

      const contentLength = Number.parseInt(match[1], 10)
      const frameEnd = headerEnd + 4 + contentLength
      if (buffer.length < frameEnd) {
        return
      }

      const payload = buffer.subarray(headerEnd + 4, frameEnd)
      buffer = buffer.subarray(frameEnd)
      child.stdin.write(payload)
      child.stdin.write("\n")
    }
  })

  process.stdin.on("end", () => {
    child.stdin.end()
  })
}

function forwardLineToFramed(child) {
  let stdoutBuffer = ""

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += chunk.toString("utf8")

    while (true) {
      const newline = stdoutBuffer.indexOf("\n")
      if (newline === -1) {
        break
      }

      const line = stdoutBuffer.slice(0, newline).trim()
      stdoutBuffer = stdoutBuffer.slice(newline + 1)
      if (!line) {
        continue
      }

      const payload = Buffer.from(line, "utf8")
      process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`)
      process.stdout.write(payload)
    }
  })
}

function main() {
  const command = process.argv[2] || "ccc"
  const child = spawn(command, ["mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
  })

  child.stderr.on("data", (chunk) => {
    process.stderr.write(chunk)
  })

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal)
      return
    }
    process.exit(code ?? 0)
  })

  forwardFramedToLine(child)
  forwardLineToFramed(child)
}

main()
