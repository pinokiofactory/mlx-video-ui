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
      // Safety net: if mlx-video env isn't present yet, bootstrap it so the backend
      // can call `mlx_video.generate` successfully.
      when: "{{!exists('mlx-video/.venv/bin/python') && !exists('mlx-video/.venv/bin/python3')}}",
      method: "shell.run",
      params: {
        path: "mlx-video",
        conda: {
          path: ".venv",
          python: "python=3.11",
        },
        message: "python -m pip install -e .",
      },
    },
    {
      method: "shell.run",
      params: {
        path: "app/backend",
        venv: ".venv",
        env: { PYTHONUNBUFFERED: "1" },
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
