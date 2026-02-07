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
      // Pinokio's `env` form writes secrets into `ENVIRONMENT` (and the shared key store).
      // We immediately move them into an untracked file to avoid accidentally committing keys.
      method: async (req, ondata, kernel) => {
        const fs = require("fs");
        const path = require("path");

        const envPath = path.resolve(req.cwd, "ENVIRONMENT");
        const localPath = path.resolve(req.cwd, "ENVIRONMENT.local");

        const readText = async (p) => {
          try {
            return await fs.promises.readFile(p, "utf8");
          } catch {
            return "";
          }
        };

        const parse = (text) => {
          const map = {};
          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
            if (!m) continue;
            map[m[1]] = m[2] ?? "";
          }
          return { map, lines };
        };

        const wanted = ["HF_TOKEN", "CIVITAI_API_KEY"];

        const envText = await readText(envPath);
        const { map: envMap, lines: envLines } = parse(envText);

        // Extract secrets and scrub them from ENVIRONMENT (keep the keys present with empty values).
        const secrets = {};
        const scrubbedEnvLines = envLines.map((line) => {
          for (const k of wanted) {
            if (line.startsWith(`${k}=`)) {
              secrets[k] = envMap[k] ?? "";
              return `${k}=`;
            }
          }
          return line;
        });

        // Update ENVIRONMENT.local (untracked) with the extracted values.
        const localText = await readText(localPath);
        const { map: localMap } = parse(localText);
        for (const k of wanted) {
          const v = (secrets[k] ?? "").trim();
          if (v) localMap[k] = secrets[k];
        }
        const localOut = wanted
          .filter((k) => (localMap[k] ?? "").trim())
          .map((k) => `${k}=${localMap[k]}`)
          .join("\n");

        // Write back files.
        await fs.promises.writeFile(envPath, scrubbedEnvLines.join("\n"));
        if (localOut) {
          await fs.promises.writeFile(localPath, `${localOut}\n`);
        }

        return { wrote_local: Boolean(localOut) };
      },
    },
    {
      method: "log",
      params: {
        raw: "Saved keys to ENVIRONMENT.local (and Pinokio key store). ENVIRONMENT was scrubbed.",
      },
    },
  ],
};
