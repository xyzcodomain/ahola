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
  <title>404 - Ahola Gateway</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container {
      max-width: 800px;
      width: 100%;
    }
    .card {
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 1rem;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
    }
    .header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    h1 {
      font-size: 4rem;
      font-weight: 700;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .subtitle {
      color: #94a3b8;
      font-size: 1.1rem;
      margin-top: 0.5rem;
    }
    .section-title {
      color: #667eea;
      font-size: 0.875rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .info-item {
      background: #0f172a;
      padding: 0.75rem;
      border-radius: 6px;
      border-left: 3px solid #667eea;
    }
    .label {
      color: #94a3b8;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 0.25rem;
    }
    .value {
      color: #e2e8f0;
      font-size: 0.95rem;
      font-family: 'Courier New', monospace;
      word-break: break-all;
    }
    .hostname {
      color: #f59e0b;
      font-weight: 600;
    }
    .code-block {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 1rem;
      overflow-x: auto;
    }
    .code-block pre {
      color: #e2e8f0;
      font-family: 'Courier New', monospace;
      font-size: 0.85rem;
      line-height: 1.6;
    }
    .footer {
      text-align: center;
      margin-top: 2rem;
      color: #64748b;
      font-size: 0.875rem;
    }
    .badge {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🔮</div>
      <h1>404</h1>
      <div class="subtitle">Unknown Route</div>
      <div class="badge">Ahola Gateway</div>
    </div>

    <div class="card">
      <div class="section-title">📡 Request Info</div>
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
      </div>
    </div>

    <div class="card">
      <div class="section-title">🖥️ Environment</div>
      <div class="code-block">
        <pre>Node:       ${env.node}
Platform:   ${env.platform} (${env.arch})
Hostname:   ${env.hostname}
Gateway:    ${env.gateway}
Memory:     ${env.memory}
Uptime:     ${env.uptime}
Time:       ${now}
User Agent: ${userAgent}</pre>
      </div>
    </div>

    <div class="card">
      <div class="section-title">💡 What happened?</div>
      <p style="color: #cbd5e1; line-height: 1.6;">
        The Ahola Gateway received a request for <strong style="color: #f59e0b;">${host}</strong> but couldn't find a matching route.
        This usually means:
      </p>
      <ul style="color: #cbd5e1; line-height: 1.8; margin-top: 1rem; margin-left: 1.5rem;">
        <li>The subdomain doesn't have an app config in <code style="background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 3px;">~/ahola/apps/</code></li>
        <li>DNS hasn't been pointed to this node yet</li>
        <li>The app isn't running</li>
      </ul>
    </div>

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

