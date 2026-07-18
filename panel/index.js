const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3333;
const APPS_DIR = "/apps";
const PANEL_DIR = __dirname;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(PANEL_DIR, "public")));

function ensureAppsDir() {
  if (!fs.existsSync(APPS_DIR)) {
    fs.mkdirSync(APPS_DIR, { recursive: true });
  }
}

function getApps() {
  ensureAppsDir();
  if (!fs.existsSync(APPS_DIR)) return [];

  const files = fs.readdirSync(APPS_DIR).filter((f) => f.endsWith(".json"));
  const apps = [];

  for (const file of files) {
    const filePath = path.join(APPS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      apps.push({
        name: file.replace(/\.json$/, ""),
        target: data.target || "",
        updatedAt: fs.statSync(filePath).mtime.toISOString(),
      });
    } catch (e) {
      console.error("Failed to parse app config", filePath, e.message);
    }
  }

  return apps.sort((a, b) => a.name.localeCompare(b.name));
}

app.get("/api/apps", (req, res) => {
  try {
    res.json({ apps: getApps() });
  } catch (e) {
    res.status(500).json({ error: "Failed to load apps" });
  }
});

app.post("/api/deploy", (req, res) => {
  try {
    const { subdomain, target } = req.body;

    if (!subdomain || !target) {
      return res.status(400).json({ error: "subdomain and target are required" });
    }

    const sanitized = subdomain.replace(/[^a-z0-9-]/gi, "-").replace(/--+/g, "-").toLowerCase();
    if (!sanitized || sanitized.length < 1) {
      return res.status(400).json({ error: "Invalid subdomain" });
    }

    ensureAppsDir();
    const filePath = path.join(APPS_DIR, `${sanitized}.json`);
    const payload = JSON.stringify({ target }, null, 2);

    fs.writeFileSync(filePath, payload, "utf8");

    return res.status(201).json({
      message: "App deployed",
      app: {
        name: sanitized,
        target,
        file: filePath,
      },
    });
  } catch (e) {
    console.error("Deploy failed", e);
    return res.status(500).json({ error: "Deployment failed" });
  }
});

app.delete("/api/apps/:name", (req, res) => {
  try {
    const { name } = req.params;
    const safeName = name.replace(/[^a-z0-9-]/gi, "");
    const filePath = path.join(APPS_DIR, `${safeName}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "App not found" });
    }

    fs.unlinkSync(filePath);
    return res.status(200).json({ message: "App removed", name: safeName });
  } catch (e) {
    console.error("Delete failed", e);
    return res.status(500).json({ error: "Delete failed" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Ahola Panel running on :${PORT}`);
});
