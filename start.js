module.exports = {
  daemon: true,
  run: [
    {
      // Prefer the usual dev ports, but fall back to a truly free port if they're taken.
      method: async (req, ondata, kernel) => {
        const net = require("net");

        const isFree = (port, host = "127.0.0.1") =>
          new Promise((resolve) => {
            const s = net
              .createServer()
              .once("error", () => resolve(false))
              .once("listening", () => s.close(() => resolve(true)))
              .listen(port, host);
          });

        const pick = async (preferredPorts) => {
          for (const p of preferredPorts) {
            if (await isFree(p)) return p;
          }
          return new Promise((resolve, reject) => {
            const s = net.createServer();
            s.once("error", reject);
            s.listen(0, "127.0.0.1", () => {
              const addr = s.address();
              const port = typeof addr === "object" && addr ? addr.port : null;
              s.close(() => resolve(port));
            });
          });
        };

        const backendPort = await pick([8000, 8001, 8002, 8003]);
        const frontendPort = await pick([3000, 3001, 3002, 3003]);

        ondata({ raw: `\nSelected ports: backend=${backendPort}, frontend=${frontendPort}\n` });
        return { backendPort, frontendPort };
      },
    },
    {
      method: "local.set",
      params: {
        backend_port: "{{input.backendPort}}",
        frontend_port: "{{input.frontendPort}}",
        backend_url: "{{'http://127.0.0.1:' + input.backendPort}}",
      },
    },
    {
      // Ensure `mlx_video` is importable from `mlx-video/.venv` before we start the API.
      // This avoids the backend falling back to its own venv (and then failing with
      // ModuleNotFoundError: No module named 'mlx_video').
      method: async (req, ondata, kernel) => {
        const fs = require("fs");
        const path = require("path");
        const { spawnSync } = require("child_process");

        const pyCandidates = [
          path.join(req.cwd, "mlx-video", ".venv", "bin", "python"),
          path.join(req.cwd, "mlx-video", ".venv", "bin", "python3"),
        ];
        const py = pyCandidates.find((p) => fs.existsSync(p));
        if (!py) {
          ondata({ raw: "\nmlx-video/.venv python missing; will bootstrap env.\n" });
          return { needsInstall: true, reason: "missing-python" };
        }

        const res = spawnSync(py, ["-c", "import mlx_video"], { stdio: "ignore" });
        if (!res || res.status !== 0) {
          ondata({ raw: "\nmlx_video import failed; will (re)install in mlx-video/.venv.\n" });
          return { needsInstall: true, reason: "import-failed" };
        }

        ondata({ raw: "\nmlx_video import OK.\n" });
        return { needsInstall: false };
      },
    },
    {
      when: "{{input.needsInstall}}",
      method: "shell.run",
      params: {
        path: "mlx-video",
        conda: {
          path: ".venv",
          python: "python=3.11",
        },
        message: "python -m pip install -e . && python -c \"import mlx_video; print('mlx_video ok')\"",
      },
    },
    {
      // Load secrets from ENVIRONMENT.local (untracked) if present.
      method: async (req, ondata, kernel) => {
        const fs = require("fs");
        const path = require("path");

        const p = path.resolve(req.cwd, "ENVIRONMENT.local");
        if (!fs.existsSync(p)) return {};

        const text = fs.readFileSync(p, "utf8");
        const out = {};
        for (const line of text.split(/\r?\n/)) {
          const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
          if (!m) continue;
          out[m[1]] = m[2] ?? "";
        }
        return out;
      },
    },
    {
      method: "local.set",
      params: {
        hf_token: "{{input.HF_TOKEN || ''}}",
        civitai_api_key: "{{input.CIVITAI_API_KEY || ''}}",
      },
    },
    {
      method: "shell.run",
      params: {
        path: "app/backend",
        venv: ".venv",
        env: {
          PYTHONUNBUFFERED: "1",
          // Pass tokens through to the backend + generator subprocesses.
          HF_TOKEN: "{{local.hf_token || envs.HF_TOKEN || ''}}",
          CIVITAI_API_KEY: "{{local.civitai_api_key || envs.CIVITAI_API_KEY || ''}}",
          // Hugging Face Hub download tuning (optional).
          HF_XET_HIGH_PERFORMANCE: "{{envs.HF_XET_HIGH_PERFORMANCE || '1'}}",
          HF_HUB_MAX_WORKERS: "{{envs.HF_HUB_MAX_WORKERS || '8'}}",
          LTX_NO_DOWNLOAD_PROGRESS: "{{envs.LTX_NO_DOWNLOAD_PROGRESS || '0'}}",
        },
        message: "uvicorn main:app --host 127.0.0.1 --port {{local.backend_port}}",
        on: [{
          // Wait until the server is bound and serving.
          event: "/Uvicorn running on (http:\\/\\/\\S+)/",
          done: true
        }]
      }
    },
    {
      method: "local.set",
      params: {
        // Prefer the actual URL printed by uvicorn (capture group), but keep the computed fallback.
        backend_url: "{{(input.event && input.event[1]) ? input.event[1] : local.backend_url}}",
      },
    },
    {
      method: "shell.run",
      params: {
        path: "app/frontend",
        env: {
          NEXT_PUBLIC_API_BASE: "{{local.backend_url}}",
        },
        message: "npm run dev -- -p {{local.frontend_port}} -H 127.0.0.1",
        on: [{
          // Next prints a URL we can open; capture only the clean URL (no trailing punctuation).
          event: "/(http:\\/\\/(?:127\\.0\\.0\\.1|localhost):\\d+)\\b/",
          done: true
        }]
      }
    },
    {
      method: "local.set",
      params: {
        // Do not rely on parsing Next output (it can include formatting characters).
        ui_url: "{{'http://127.0.0.1:' + local.frontend_port}}",
        url: "{{'http://127.0.0.1:' + local.frontend_port}}",
      }
    },
  ]
}
