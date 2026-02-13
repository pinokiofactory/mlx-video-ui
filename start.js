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
      // Resolve HF/Civitai tokens from ENVIRONMENT first, then local token files as fallback.
      method: async (req, ondata, kernel) => {
        const fs = require("fs");
        const path = require("path");

        const envs = (kernel && kernel.envs) ? kernel.envs : process.env;

        const pick = (...vals) => {
          for (const v of vals) {
            if (typeof v === "string" && v.trim()) return v.trim();
          }
          return "";
        };

        const parseEnvLike = (content) => {
          const out = {};
          for (const rawLine of String(content || "").split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith("#")) continue;
            const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
            if (!m) continue;
            let value = m[2].trim();
            if (
              (value.startsWith('"') && value.endsWith('"')) ||
              (value.startsWith("'") && value.endsWith("'"))
            ) {
              value = value.slice(1, -1);
            }
            out[m[1]] = value.trim();
          }
          return out;
        };

        let hfToken = pick(envs.HF_TOKEN, envs.HUGGINGFACE_HUB_TOKEN);
        let civitaiApiKey = pick(envs.CIVITAI_API_KEY);
        let tokenSource = hfToken ? "ENVIRONMENT" : "";

        const candidateFiles = [
          envs.HF_TOKEN_FILE || "",
          path.resolve(req.cwd, ".envhftoken"),
          path.resolve(req.cwd, ".hftoken"),
          "/Users/charafchnioune/Desktop/ltx-2-mlx/.envhftoken",
          path.resolve(req.cwd, "ENVIRONMENT.local"),
        ].filter(Boolean);

        for (const candidate of candidateFiles) {
          if (hfToken && civitaiApiKey) break;
          try {
            if (!fs.existsSync(candidate)) continue;
            const raw = fs.readFileSync(candidate, "utf8");
            const parsed = parseEnvLike(raw);
            if (!hfToken) {
              hfToken = pick(
                parsed.HF_TOKEN,
                parsed.HUGGINGFACE_HUB_TOKEN,
                parsed.HUGGINGFACE_TOKEN
              );
              if (!hfToken && !raw.includes("=") && raw.trim()) {
                hfToken = raw.trim();
              }
              if (hfToken) tokenSource = candidate;
            }
            if (!civitaiApiKey) {
              civitaiApiKey = pick(parsed.CIVITAI_API_KEY);
            }
          } catch {
            // ignore unreadable token files
          }
        }

        if (hfToken) {
          ondata({ raw: `\nHF token loaded from ${tokenSource || "fallback source"}.\n` });
        } else {
          ondata({
            raw: "\nHF token not found (downloads may be slow/rate-limited). Set HF_TOKEN in ENVIRONMENT.\n",
          });
        }

        return {
          hfToken,
          civitaiApiKey,
        };
      },
    },
    {
      method: "local.set",
      params: {
        hf_token: "{{input.hfToken || ''}}",
        civitai_api_key: "{{input.civitaiApiKey || ''}}",
      },
    },
    {
      // Keep the embedded repos up to date unless explicitly disabled.
      // Pinokio users often click "Start" without running "Update" first, which can leave
      // them on a generator build that produces "snow/static" outputs.
      when: "{{envs.PINOKIO_AUTO_UPDATE != '0'}}",
      method: "shell.run",
      params: {
        message: "echo \"PINOKIO_AUTO_UPDATE enabled\"",
      },
    },
    {
      when: "{{envs.PINOKIO_AUTO_UPDATE != '0' && exists('mlx-video')}}",
      method: "shell.run",
      params: {
        path: "mlx-video",
        message: [
          "git fetch origin",
          "git checkout main",
          "git pull --ff-only || git pull",
          "echo \"mlx-video @ $(git rev-parse --short HEAD)\"",
        ],
      },
    },
    {
      when: "{{envs.PINOKIO_AUTO_UPDATE != '0' && exists('app')}}",
      method: "shell.run",
      params: {
        path: "app",
        message: [
          "git fetch origin",
          "git checkout main",
          "git pull --ff-only || git pull",
          "echo \"app @ $(git rev-parse --short HEAD)\"",
        ],
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
      method: "shell.run",
      params: {
        path: "app/backend",
        venv: ".venv",
        env: {
          PYTHONUNBUFFERED: "1",
          // Ensure ffmpeg/ffprobe are available for muxing audio and higher-quality encoding.
          // (Pinokio conda + venv activation may drop Homebrew from PATH.)
          PATH: "{{(envs.PATH || '') + (platform === 'win32' ? ';' : ':') + '/opt/homebrew/bin' + (platform === 'win32' ? ';' : ':') + '/usr/local/bin'}}",
          // Force all HF downloads/caches into this Pinokio project folder so installs are
          // deterministic and we don't accidentally pick up incomplete global caches.
          HF_HOME: "{{path.resolve(cwd, 'cache', 'HF_HOME')}}",
          HF_HUB_CACHE: "{{path.resolve(cwd, 'cache', 'HF_HOME', 'hub')}}",
          // Pass tokens through to the backend + generator subprocesses.
          HF_TOKEN: "{{local.hf_token || envs.HF_TOKEN || envs.HUGGINGFACE_HUB_TOKEN || ''}}",
          HUGGINGFACE_HUB_TOKEN: "{{local.hf_token || envs.HUGGINGFACE_HUB_TOKEN || envs.HF_TOKEN || ''}}",
          CIVITAI_API_KEY: "{{local.civitai_api_key || envs.CIVITAI_API_KEY || ''}}",
          // Hugging Face Hub download tuning (optional).
          HF_XET_HIGH_PERFORMANCE: "{{envs.HF_XET_HIGH_PERFORMANCE || '1'}}",
          HF_HUB_MAX_WORKERS: "{{envs.HF_HUB_MAX_WORKERS || '8'}}",
          LTX_NO_DOWNLOAD_PROGRESS: "{{envs.LTX_NO_DOWNLOAD_PROGRESS || '0'}}",
          // Default to runtime quantization for stability (avoids broken pre-quant snapshots).
          // To force pre-quant snapshots, set BOTH:
          //   LTX_USE_PREQUANT=1
          //   LTX_ALLOW_UNSAFE_PREQUANT=1
          LTX_USE_PREQUANT: "{{envs.LTX_USE_PREQUANT || '0'}}",
          LTX_ALLOW_UNSAFE_PREQUANT: "{{envs.LTX_ALLOW_UNSAFE_PREQUANT || '0'}}",
          LTX_FORCE_RUNTIME_QUANT: "{{envs.LTX_FORCE_RUNTIME_QUANT || '1'}}",
          // The "streaming mp4" path uses OpenCV VideoWriter which is flaky on macOS
          // (can produce corrupted/static frames). We keep stream mode for preview/progress,
          // but default to final ffmpeg encoding for correctness.
          MLX_VIDEO_STREAM_MP4: "{{envs.MLX_VIDEO_STREAM_MP4 || '0'}}",
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
        // Build UI URL directly from the selected port (avoid fragile parsing/regex).
        ui_url: "{{'http://127.0.0.1:' + local.frontend_port}}",
        url: "{{'http://127.0.0.1:' + local.frontend_port}}",
      }
    },
  ]
}
