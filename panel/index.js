const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execSync } = require("child_process");

const app = express();
const PORT = 3333;
const APPS_DIR = "/apps";
const NODES_DIR = "/nodes";
const STORAGE_DIR = "/storage";
const JOBS_DIR = "/jobs";
const PANEL_DIR = __dirname;
const PUBLIC_DIR = path.join(PANEL_DIR, "public");

app.use(express.json({ limit: "1mb" }));

function serveIndex(req, res) {
  const filePath = path.join(PUBLIC_DIR, "index.html");
  if (!fs.existsSync(filePath)) {
    console.error("Panel index missing at", filePath);
    return res.status(500).send("Panel assets not found");
  }
  res.sendFile(filePath);
}

app.get("/", serveIndex);
app.get("/index.html", serveIndex);

app.use(express.static(PUBLIC_DIR));

function getLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "unknown";
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureAppsDir() {
  ensureDir(APPS_DIR);
}

function ensureNodesDir() {
  ensureDir(NODES_DIR);
}

function ensureStorageDir() {
  ensureDir(STORAGE_DIR);
}

function ensureJobsDir() {
  ensureDir(JOBS_DIR);
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

function getNodes() {
  ensureNodesDir();
  if (!fs.existsSync(NODES_DIR)) return [];

  const files = fs.readdirSync(NODES_DIR).filter((f) => f.endsWith(".json"));
  const nodes = [];

  for (const file of files) {
    const filePath = path.join(NODES_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
      nodes.push({
        id: file.replace(/\.json$/, ""),
        ...data,
      });
    } catch (e) {
      console.error("Failed to parse node config", filePath, e.message);
    }
  }

  return nodes.sort((a, b) => a.id.localeCompare(b.id));
}

function getNodeInfo() {
  const hostname = os.hostname();
  const localIp = getLocalIp();
  const nodeId = hostname.replace(/[^a-z0-9-]/gi, "-").toLowerCase();

  return {
    id: nodeId,
    hostname,
    localIp,
    publicIp: localIp,
    role: "gateway",
    status: "active",
  };
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

app.get("/api/nodes", (req, res) => {
  try {
    const nodes = getNodes();
    const local = getNodeInfo();
    res.json({ nodes, local });
  } catch (e) {
    res.status(500).json({ error: "Failed to load nodes" });
  }
});

app.post("/api/nodes", (req, res) => {
  try {
    const { id, publicIp, localIp, role } = req.body;

    if (!id || (!publicIp && !localIp)) {
      return res.status(400).json({ error: "id and at least one of publicIp or localIp are required" });
    }

    ensureNodesDir();
    const safeId = id.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    const resolvedLocalIp = localIp || publicIp || "unknown";
    const resolvedPublicIp = publicIp || localIp || "unknown";
    const filePath = path.join(NODES_DIR, `${safeId}.json`);
    const payload = JSON.stringify({
      id: safeId,
      publicIp: resolvedPublicIp,
      localIp: resolvedLocalIp,
      role: role || "worker",
      status: "active",
    }, null, 2);

    fs.writeFileSync(filePath, payload, "utf8");

    return res.status(201).json({
      message: "Node added",
      node: JSON.parse(payload),
    });
  } catch (e) {
    console.error("Add node failed", e);
    return res.status(500).json({ error: "Failed to add node" });
  }
});

app.delete("/api/nodes/:id", (req, res) => {
  try {
    const { id } = req.params;
    const safeId = id.replace(/[^a-z0-9-]/gi, "");
    const filePath = path.join(NODES_DIR, `${safeId}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Node not found" });
    }

    fs.unlinkSync(filePath);
    return res.status(200).json({ message: "Node removed", id: safeId });
  } catch (e) {
    console.error("Delete node failed", e);
    return res.status(500).json({ error: "Failed to remove node" });
  }
});

app.get("/api/storage", (req, res) => {
  try {
    ensureStorageDir();
    const filePath = path.join(STORAGE_DIR, "minio.json");
    if (!fs.existsSync(filePath)) {
      return res.json({ config: { mode: "standalone", nodes: [] } });
    }
    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    res.json({ config: data });
  } catch (e) {
    res.status(500).json({ error: "Failed to load storage config" });
  }
});

app.post("/api/storage", (req, res) => {
  try {
    const { mode, nodes } = req.body;

    if (!mode || !["standalone", "distributed", "replicated"].includes(mode)) {
      return res.status(400).json({ error: "Invalid mode. Use: standalone, distributed, or replicated" });
    }

    ensureStorageDir();
    const filePath = path.join(STORAGE_DIR, "minio.json");
    const payload = JSON.stringify({
      mode,
      nodes: nodes || [],
      updatedAt: new Date().toISOString(),
    }, null, 2);

    fs.writeFileSync(filePath, payload, "utf8");

    return res.status(200).json({
      message: "Storage config saved",
      config: JSON.parse(payload),
    });
  } catch (e) {
    console.error("Save storage config failed", e);
    return res.status(500).json({ error: "Failed to save storage config" });
  }
});

app.get("/api/system", (req, res) => {
  try {
    res.json({
      hostname: os.hostname(),
      localIp: getLocalIp(),
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: process.uptime(),
    });
  } catch (e) {
    res.status(500).json({ error: "Failed to load system info" });
  }
});

app.post("/api/join-requests", (req, res) => {
  try {
    const { hostname, localIp } = req.body;

    if (!hostname || !localIp) {
      return res.status(400).json({ error: "hostname and localIp are required" });
    }

    ensureJobsDir();
    const requestId = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const filePath = path.join(JOBS_DIR, `join-${requestId}.json`);
    const payload = JSON.stringify({
      id: requestId,
      hostname,
      localIp,
      status: "pending",
      createdAt: new Date().toISOString(),
    }, null, 2);

    fs.writeFileSync(filePath, payload, "utf8");

    return res.status(201).json({
      message: "Join request submitted",
      request: JSON.parse(payload),
    });
  } catch (e) {
    console.error("Join request failed", e);
    return res.status(500).json({ error: "Failed to submit join request" });
  }
});

app.get("/api/join-requests", (req, res) => {
  try {
    ensureJobsDir();
    if (!fs.existsSync(JOBS_DIR)) return res.json({ requests: [] });

    const files = fs.readdirSync(JOBS_DIR).filter((f) => f.startsWith("join-") && f.endsWith(".json"));
    const requests = [];

    for (const file of files) {
      const filePath = path.join(JOBS_DIR, file);
      try {
        const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
        requests.push(data);
      } catch (e) {
        console.error("Failed to parse join request", filePath, e.message);
      }
    }

    return res.json({ requests: requests.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  } catch (e) {
    res.status(500).json({ error: "Failed to load join requests" });
  }
});

app.post("/api/join-requests/:id/accept", (req, res) => {
  try {
    const { id } = req.params;
    ensureJobsDir();
    const filePath = path.join(JOBS_DIR, `join-${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Join request not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    if (data.status !== "pending") {
      return res.status(400).json({ error: "Join request already processed" });
    }

    let token = "";
    let managerIp = getLocalIp();

    try {
      token = execSync("docker swarm join-token -q worker", { encoding: "utf8" }).trim();
    } catch (e) {
      console.error("Failed to get swarm join token", e);
      return res.status(500).json({ error: "Failed to get swarm join token" });
    }

    data.status = "accepted";
    data.acceptedAt = new Date().toISOString();
    data.token = token;
    data.managerIp = managerIp;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return res.status(200).json({
      message: "Join request accepted",
      request: data,
      token,
      managerIp,
    });
  } catch (e) {
    console.error("Accept join request failed", e);
    return res.status(500).json({ error: "Failed to accept join request" });
  }
});

app.post("/api/join-requests/:id/deny", (req, res) => {
  try {
    const { id } = req.params;
    ensureJobsDir();
    const filePath = path.join(JOBS_DIR, `join-${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Join request not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    data.status = "denied";
    data.deniedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));

    return res.status(200).json({ message: "Join request denied", request: data });
  } catch (e) {
    console.error("Deny join request failed", e);
    return res.status(500).json({ error: "Failed to deny join request" });
  }
});

app.get("/api/join-requests/:id/status", (req, res) => {
  try {
    const { id } = req.params;
    ensureJobsDir();
    const filePath = path.join(JOBS_DIR, `join-${id}.json`);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Join request not found" });
    }

    const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return res.json({ request: data });
  } catch (e) {
    res.status(500).json({ error: "Failed to load join request status" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Ahola Panel running on :${PORT}`);
  console.log("Panel dir:", PANEL_DIR);
  console.log("Public dir:", PUBLIC_DIR);
  try {
    const files = fs.readdirSync(PUBLIC_DIR);
    console.log("Public files:", files);
  } catch (e) {
    console.error("Public dir read failed:", e.message);
  }
});
