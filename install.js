module.exports = {
  run: [
    {
      when: "{{!exists('app')}}",
      method: "shell.run",
      params: {
        message: "git clone https://github.com/CharafChnioune/mlx-video-UI.git app"
      }
    },
    {
      when: "{{!exists('mlx-video')}}",
      method: "shell.run",
      params: {
        message: "git clone https://github.com/CharafChnioune/mlx-video.git mlx-video"
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
      // mlx-video requires Python >= 3.11. Create a dedicated conda env under mlx-video/.venv
      // and install the package editable so the backend can run `python -m mlx_video.generate`.
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
