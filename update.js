module.exports = {
  run: [
    {
      when: "{{exists('app')}}",
      method: "shell.run",
      params: {
        path: "app",
        message: "git pull"
      }
    },
    {
      when: "{{exists('mlx-video')}}",
      method: "shell.run",
      params: {
        path: "mlx-video",
        message: "git pull"
      }
    },
    {
      method: "shell.run",
      params: {
        path: "app/backend",
        venv: ".venv",
        message: "uv pip install -r requirements.txt"
      }
    },
    {
      when: "{{exists('mlx-video')}}",
      method: "shell.run",
      params: {
        path: "mlx-video",
        conda: {
          path: ".venv",
          python: "python=3.11"
        },
        message: "python -m pip install -e ."
      }
    },
    {
      method: "shell.run",
      params: {
        path: "app/frontend",
        message: "npm install"
      }
    }
  ]
}
