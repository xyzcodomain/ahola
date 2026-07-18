const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  createProxyMiddleware
} = require("http-proxy-middleware");

const routes = require("./routes.json");

const app = express();
const APPS_DIR = path.join(process.env.HOME || "", "ahola", "apps");

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function renderUnknownRoute(req, res) {
  const host = req.hostname;
  const ip = getClientIp(req);
  const now = new Date().toISOString();
  const userAgent = req.headers["user-agent"] || "unknown";
  const method = req.method;
  const url = req.url;

  const env = {
    node: process.version,
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cwd: process.cwd(),
    memory: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
    uptime: `${process.uptime().toFixed(2)}s`,
    gateway: "Ahola Gateway v1.0.0"
  };

  res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Unknown Route</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f5f5;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container {
      max-width: 720px;
      width: 100%;
    }
    .header {
      margin-bottom: 2rem;
    }
    .error-code {
      font-size: 5rem;
      font-weight: 700;
      color: #f6821f;
      line-height: 1;
    }
    .error-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #333;
      margin-top: 0.5rem;
    }
    .error-subtitle {
      font-size: 0.95rem;
      color: #666;
      margin-top: 0.25rem;
    }
    .card {
      background: #fff;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 1.5rem;
      margin-bottom: 1rem;
    }
    .section-title {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #f6821f;
      margin-bottom: 1rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 1rem;
    }
    .info-item {
      padding: 0.5rem 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-item:last-child {
      border-bottom: none;
    }
    .label {
      font-size: 0.75rem;
      color: #888;
      text-transform: uppercase;
      letter-spacing: 0.03em;
      margin-bottom: 0.25rem;
    }
    .value {
      font-size: 0.95rem;
      color: #333;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      word-break: break-all;
    }
    .hostname {
      color: #f6821f;
      font-weight: 600;
    }
    .code-block {
      background: #f9f9f9;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      padding: 1rem;
      overflow-x: auto;
    }
    .code-block pre {
      color: #333;
      font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
      font-size: 0.85rem;
      line-height: 1.7;
    }
    .footer {
      margin-top: 2rem;
      text-align: center;
      color: #999;
      font-size: 0.8rem;
    }
    .divider {
      border: none;
      border-top: 1px solid #e0e0e0;
      margin: 1.25rem 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="error-code">404</div>
      <div class="error-title">Unknown Route</div>
      <div class="error-subtitle">The requested hostname does not have a configured route on this node.</div>
    </div>

    <div class="card">
      <div class="section-title">Request Details</div>
      <div class="info-grid">
        <div class="info-item">
          <div class="label">Hostname</div>
          <div class="value hostname">${host}</div>
        </div>
        <div class="info-item">
          <div class="label">Client IP</div>
          <div class="value">${ip}</div>
        </div>
        <div class="info-item">
          <div class="label">Method</div>
          <div class="value">${method}</div>
        </div>
        <div class="info-item">
          <div class="label">Path</div>
          <div class="value">${url}</div>
        </div>
        <div class="info-item">
          <div class="label">Time</div>
          <div class="value">${now}</div>
        </div>
        <div class="info-item">
          <div class="label">User Agent</div>
          <div class="value">${userAgent}</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="section-title">Environment</div>
      <div class="code-block">
        <pre>Gateway:    ${env.gateway}
Node:       ${env.node}
Platform:   ${env.platform} (${env.arch})
Hostname:   ${env.hostname}
Working Dir: ${env.cwd}
Memory:     ${env.memory}
Uptime:     ${env.uptime}</pre>
      </div>
    </div>

    <hr class="divider">

    <div class="footer">
      Ahola Node • ${env.hostname}
    </div>
  </div>
</body>
</html>`);
}

function resolveTarget(host) {
  if (routes[host]) {
    return routes[host].target;
  }

  const match = host.match(/^(.+)\.ahola\.im$/);
  if (match) {
    const appName = match[1];
    const appConfigPath = path.join(APPS_DIR, `${appName}.json`);
    if (fs.existsSync(appConfigPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(appConfigPath, "utf8"));
        if (config.target) {
          return config.target;
        }
      } catch (e) {
        console.error("Failed to parse app config", appConfigPath, e.message);
      }
    }
  }

  return null;
}

app.use((req, res, next) => {
  let host = req.hostname;
  let target = resolveTarget(host);

  console.log(
    new Date(),
    host,
    req.method,
    req.url,
    target ? `-> ${target}` : ""
  );

  if (!target) {
    return renderUnknownRoute(req, res);
  }

  return createProxyMiddleware({
    target,
    changeOrigin: true
  })(req, res, next);
});

app.listen(
  8080,
  () => {
    console.log(
      "Ahola Gateway running :8080"
    );
  }
);

