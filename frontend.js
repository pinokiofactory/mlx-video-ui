module.exports = {
  daemon: true,
  run: [
    {
      method: "local.set",
      params: {
        frontend_port: "{{args.frontend_port || 3000}}",
        backend_url: "{{args.backend_url || envs.NEXT_PUBLIC_API_BASE || 'http://127.0.0.1:8000'}}",
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
        on: [
          {
            event: "/(http:\\/\\/(?:127\\.0\\.0\\.1|localhost):\\d+)\\b/",
            done: true,
          },
        ],
      },
    },
    {
      method: "local.set",
      params: {
        url: "{{'http://127.0.0.1:' + local.frontend_port}}",
        ui_url: "{{'http://127.0.0.1:' + local.frontend_port}}",
      },
    },
    {
      method: "log",
      params: {
        raw: "Frontend running at {{local.url}} (API: {{local.backend_url}})",
      },
    },
  ],
};

