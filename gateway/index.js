const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  createProxyMiddleware
} = require("http-proxy-middleware");

const routes = require("./routes.json");

const app = express();
const APPS_DIR = path.join(process.env.HOME || "", "ahola", "apps");

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX = 120;
const rateLimits = new Map();

function getClientIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}

function rateLimit(req, res, next) {
  const ip = getClientIp(req);
  const now = Date.now();
  const window = rateLimits.get(ip);

  if (!window || now - window.start > RATE_LIMIT_WINDOW_MS) {
    rateLimits.set(ip, { start: now, count: 1 });
    return next();
  }

  window.count += 1;
  rateLimits.set(ip, window);

  if (window.count > RATE_LIMIT_MAX) {
    return res.status(429).send("Too Many Requests");
  }

  next();
}

function renderUnknownRoute(req, res) {
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
      background: #0b0c0f;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }
    .brand {
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 2rem;
    }
    .brand-mark {
      width: 32px;
      height: 32px;
      background: #f6821f;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      color: #fff;
      font-size: 0.9rem;
    }
    .brand-name {
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #f1f5f9;
    }
    .error-code {
      font-size: 6rem;
      font-weight: 800;
      color: #f6821f;
      line-height: 1;
    }
    .error-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #e2e8f0;
      margin-top: 1rem;
    }
    .error-subtitle {
      font-size: 1rem;
      color: #94a3b8;
      margin-top: 0.5rem;
      max-width: 520px;
      margin-left: auto;
      margin-right: auto;
      line-height: 1.5;
    }
    .badge {
      display: inline-block;
      margin-top: 1.5rem;
      padding: 0.35rem 0.9rem;
      border-radius: 999px;
      border: 1px solid #334155;
      color: #cbd5e1;
      font-size: 0.8rem;
      letter-spacing: 0.04em;
    }
  </style>
</head>
<body>
  <div>
    <div class="brand">
      <div class="brand-mark">A</div>
      <div class="brand-name">AHOLA</div>
    </div>
    <div class="error-code">404</div>
    <div class="error-title">Unknown Route</div>
    <div class="error-subtitle">This hostname is not configured on this node.</div>
    <div class="badge">Ahola Gateway</div>
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

app.use(rateLimit);

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

