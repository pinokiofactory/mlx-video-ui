module.exports = {
  // This script exists only to let users set optional tokens in Pinokio's ENVIRONMENT
  // via a form (instead of manually editing the file).
  env: [
    {
      key: "HF_TOKEN",
      host: "huggingface.co",
      title: "Hugging Face Token",
      description: "Optional. Needed for private model downloads or to avoid rate limits.",
      default: "",
    },
    {
      key: "CIVITAI_API_KEY",
      host: "civitai.com",
      title: "Civitai API Key",
      description: "Optional. Used for downloading LoRAs/models from Civitai.",
      default: "",
    },
  ],
  run: [
    {
      // The `env` form already writes into Pinokio's `ENVIRONMENT` (and the shared key store).
      // Keep it simple: do not move/scrub values into other files.
      method: "log",
      params: {
        raw: "Saved keys to ENVIRONMENT (and Pinokio key store).",
      },
    },
  ],
};
