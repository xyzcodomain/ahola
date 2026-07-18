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
    return renderRateLimitPage(req, res);
  }

  next();
}

function renderRateLimitPage(req, res) {
  res.status(429).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>429 - Too Many Requests</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container {
      max-width: 820px;
      width: 100%;
    }
    .header {
      margin-bottom: 2.5rem;
    }
    .title {
      font-size: 3rem;
      font-weight: 700;
      color: #333;
    }
    .error-badge {
      display: inline-block;
      margin-left: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      border: 1px solid #dcdcdc;
      color: #777;
      font-size: 0.8rem;
      vertical-align: middle;
    }
    .subtitle {
      margin-top: 0.5rem;
      font-size: 1rem;
      color: #555;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .status-item {
      flex: 1;
      text-align: center;
    }
    .status-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 0.75rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
    }
    .status-icon.warn {
      background: #fff3cd;
      color: #856404;
    }
    .status-icon.error {
      background: #f8d7da;
      color: #dc3545;
    }
    .status-label {
      font-size: 0.85rem;
      color: #888;
      margin-top: 0.25rem;
    }
    .status-value {
      font-size: 0.95rem;
      color: #333;
      font-weight: 600;
      margin-top: 0.15rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #222;
      margin-bottom: 0.5rem;
    }
    .section-text {
      font-size: 0.95rem;
      color: #555;
      line-height: 1.5;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 1.5rem;
    }
    .footer {
      margin-top: 2.5rem;
      text-align: center;
      font-size: 0.8rem;
      color: #999;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="title">429</span>
        <span class="error-badge">Error code 429</span>
      </div>
      <div class="subtitle">Too many requests have been sent from this address.</div>
    </div>

    <div class="status-row">
      <div class="status-item">
        <div class="status-icon warn">!</div>
        <div class="status-label">Requests</div>
        <div class="status-value">Rate Limited</div>
      </div>
      <div class="status-item">
        <div class="status-icon error">&#10007;</div>
        <div class="status-label">Ahola Gateway</div>
        <div class="status-value">Blocked</div>
      </div>
    </div>

    <div class="columns">
      <div>
        <div class="section-title">What happened?</div>
        <div class="section-text">This IP address has exceeded the allowed request limit. This protection helps prevent abuse and keeps the node stable for everyone.</div>
      </div>
      <div>
        <div class="section-title">What can I do?</div>
        <div class="section-text">Wait a few minutes and try again. If you are the node operator and this was triggered unexpectedly, you can adjust the rate limit settings in the gateway.</div>
      </div>
    </div>

    <div class="footer">
      Ahola Node
    </div>
  </div>
</body>
</html>`);
}

function renderUnknownRoute(req, res) {
  res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Not Found</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #fff;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .container {
      max-width: 820px;
      width: 100%;
    }
    .header {
      margin-bottom: 2.5rem;
    }
    .title {
      font-size: 3rem;
      font-weight: 700;
      color: #333;
    }
    .error-badge {
      display: inline-block;
      margin-left: 0.75rem;
      padding: 0.25rem 0.6rem;
      border-radius: 4px;
      border: 1px solid #dcdcdc;
      color: #777;
      font-size: 0.8rem;
      vertical-align: middle;
    }
    .subtitle {
      margin-top: 0.5rem;
      font-size: 1rem;
      color: #555;
    }
    .divider {
      border: none;
      border-top: 1px solid #e5e5e5;
      margin: 1.5rem 0;
    }
    .status-row {
      display: flex;
      justify-content: space-between;
      gap: 1.5rem;
      margin: 2rem 0;
    }
    .status-item {
      flex: 1;
      text-align: center;
    }
    .status-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 0.75rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.75rem;
    }
    .status-icon.ok {
      background: #d4edda;
      color: #28a745;
    }
    .status-icon.error {
      background: #f8d7da;
      color: #dc3545;
    }
    .status-label {
      font-size: 0.85rem;
      color: #888;
      margin-top: 0.25rem;
    }
    .status-value {
      font-size: 0.95rem;
      color: #333;
      font-weight: 600;
      margin-top: 0.15rem;
    }
    .section-title {
      font-size: 1.1rem;
      font-weight: 600;
      color: #222;
      margin-bottom: 0.5rem;
    }
    .section-text {
      font-size: 0.95rem;
      color: #555;
      line-height: 1.5;
    }
    .columns {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 1.5rem;
    }
    .footer {
      margin-top: 2.5rem;
      text-align: center;
      font-size: 0.8rem;
      color: #999;
    }
    .footer a {
      color: #007bff;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div>
        <span class="title">404</span>
        <span class="error-badge">Error code 404</span>
      </div>
      <div class="subtitle">This address is not connected to a deployed app on this node.</div>
    </div>

    <div class="status-row">
      <div class="status-item">
        <div class="status-icon ok">&#10003;</div>
        <div class="status-label">Browser</div>
        <div class="status-value">Working</div>
      </div>
      <div class="status-item">
        <div class="status-icon error">&#10007;</div>
        <div class="status-label">Ahola Gateway</div>
        <div class="status-value">Error</div>
      </div>
    </div>

    <div class="columns">
      <div>
        <div class="section-title">What happened?</div>
        <div class="section-text">The requested hostname does not have a route configured on this Ahola node.</div>
      </div>
      <div>
        <div class="section-title">What can I do?</div>
        <div class="section-text">Check that the app is deployed and DNS is pointed to this node. If the problem continues, contact the node operator.</div>
      </div>
    </div>

    <div class="footer">
      Ahola Node
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

