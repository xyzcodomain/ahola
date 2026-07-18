const express = require("express");
const fs = require("fs");
const path = require("path");
const {
  createProxyMiddleware
} = require("http-proxy-middleware");

const routes = require("./routes.json");

const app = express();
const APPS_DIR = path.join(process.env.HOME || "", "ahola", "apps");

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
      background: #f5f5f5;
      color: #333;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
      text-align: center;
    }
    .error-code {
      font-size: 6rem;
      font-weight: 700;
      color: #f6821f;
      line-height: 1;
    }
    .error-title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #333;
      margin-top: 1rem;
    }
    .error-subtitle {
      font-size: 1rem;
      color: #666;
      margin-top: 0.5rem;
    }
  </style>
</head>
<body>
  <div>
    <div class="error-code">404</div>
    <div class="error-title">Unknown Route</div>
    <div class="error-subtitle">This hostname is not configured on this node.</div>
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

