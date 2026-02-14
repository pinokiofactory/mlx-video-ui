module.exports = {
  daemon: true,
  run: [
    {
      method: "local.set",
      params: {
        backend_port: "{{args.backend_port || 8000}}",
        backend_url: "{{'http://127.0.0.1:' + (args.backend_port || 8000)}}",
        hf_token: "{{args.hf_token || envs.HF_TOKEN || envs.HUGGINGFACE_HUB_TOKEN || ''}}",
        civitai_api_key: "{{args.civitai_api_key || envs.CIVITAI_API_KEY || ''}}",
      },
    },
    {
      method: "shell.run",
      params: {
        path: "app/backend",
        venv: ".venv",
        env: {
          // Pinokio treats PATH specially and expects an array of path entries when
          // provided via params.env.PATH. Passing a string can crash with:
          //   TypeError: params.env.PATH.join is not a function
          PATH: "{{(envs.PATH || '').split(path.delimiter).filter(Boolean)}}",
          PYTHONUNBUFFERED: "1",

          // Keep caches within the Pinokio project folder for determinism.
          HF_HOME: "{{path.resolve(cwd, 'cache', 'HF_HOME')}}",
          HF_HUB_CACHE: "{{path.resolve(cwd, 'cache', 'HF_HOME', 'hub')}}",

          // Pass tokens through to the backend + generator subprocesses.
          HF_TOKEN: "{{local.hf_token}}",
          HUGGINGFACE_HUB_TOKEN: "{{local.hf_token}}",
          CIVITAI_API_KEY: "{{local.civitai_api_key}}",

          // Hugging Face Hub download tuning (optional).
          HF_XET_HIGH_PERFORMANCE: "{{envs.HF_XET_HIGH_PERFORMANCE || '1'}}",
          HF_HUB_MAX_WORKERS: "{{envs.HF_HUB_MAX_WORKERS || '8'}}",
          LTX_NO_DOWNLOAD_PROGRESS: "{{envs.LTX_NO_DOWNLOAD_PROGRESS || '0'}}",

          // Default to runtime quantization for stability (avoid broken pre-quant snapshots).
          // To force pre-quant snapshots, set BOTH:
          //   LTX_USE_PREQUANT=1
          //   LTX_ALLOW_UNSAFE_PREQUANT=1
          LTX_USE_PREQUANT: "{{envs.LTX_USE_PREQUANT || '0'}}",
          LTX_ALLOW_UNSAFE_PREQUANT: "{{envs.LTX_ALLOW_UNSAFE_PREQUANT || '0'}}",
          LTX_FORCE_RUNTIME_QUANT: "{{envs.LTX_FORCE_RUNTIME_QUANT || '1'}}",

          // Streaming MP4 via OpenCV is flaky on macOS; keep it off by default.
          MLX_VIDEO_STREAM_MP4: "{{envs.MLX_VIDEO_STREAM_MP4 || '0'}}",
        },
        message: "uvicorn main:app --host 127.0.0.1 --port {{local.backend_port}}",
        on: [
          {
            event: "/Uvicorn running on (http:\\/\\/\\S+)/",
            done: true,
          },
        ],
      },
    },
    {
      method: "local.set",
      params: {
        // Prefer the actual URL printed by uvicorn (capture group), but keep the computed fallback.
        backend_url: "{{(input.event && input.event[1]) ? input.event[1] : local.backend_url}}",
      },
    },
    {
      method: "log",
      params: {
        raw: "Backend running at {{local.backend_url}}",
      },
    },
  ],
};
