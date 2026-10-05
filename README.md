# opencode-kiro-models

OpenCode V2 plugin that keeps the model list of the `kiro` provider current. At startup it runs `kiro-cli chat --list-models` and registers every model it finds, so you no longer maintain a models.dev snapshot or a hand-written list.

It works together with the [`opencode-kiro`](https://github.com/NachoFLizaur/opencode-kiro) plugin ([npm](https://www.npmjs.com/package/opencode-kiro)), which supplies the Kiro provider and sign-in. This plugin only supplies the models.

## Requirements

- OpenCode 2.0.21 or newer
- `kiro-cli` on your `PATH`, signed in (`kiro-cli chat --list-models` must print a list)

## Install

1. Add the Kiro plugin to `plugins` in `~/.config/opencode/opencode.jsonc`:

   ```jsonc
   {
     "plugins": ["opencode-kiro@0.5.0-beta.5"]
   }
   ```

   `0.5.0-beta.5` is the newest release. The `latest` tag on npm is still `0.4.0`, so pin the beta explicitly.

2. Clone this repository into your global OpenCode plugins directory:

   ```sh
   git clone https://github.com/HendrikPetertje/opencode-kiro-model-loader.git ~/.config/opencode/plugins/opencode-kiro-model-loader
   ```

   OpenCode loads every plugin directory under `~/.config/opencode/plugins/` automatically, so you don't need a config entry. To keep the plugin elsewhere, add its directory to `plugins` instead:

   ```jsonc
   {
     "plugins": ["opencode-kiro@0.5.0-beta.7", "/path/to/opencode-kiro-models"]
   }
   ```

3. Install the plugin's dependencies. `@opencode/plugin` is declared as a peer dependency, so `npm install` fetches it:

   ```sh
   cd ~/.config/opencode/plugins/opencode-kiro-model-loader   # or wherever you cloned it
   npm install
   ```

   Inside `~/.config/opencode` the package also resolves from the parent `node_modules`, but this step is required if you keep the plugin elsewhere.

4. Remove any `kiro` entry under `providers` in `opencode.jsonc`. Hand-written models can conflict with the discovered ones.

5. If you set `OPENCODE_MODELS_PATH` to a custom models.dev JSON file for Kiro, you can drop it. This plugin replaces that list.

6. Restart the background service:

   ```sh
   opencode service restart
   ```

Run `/models` to see the Kiro models.

## How it works

- Parses lines such as `claude-opus-5   2.20x credits   Claude Opus 5 model with 1M context window`.
- **Name:** built from the model ID, for example `Claude Opus 4.8 (Kiro)`.
- **Context window:** 1M tokens if the description mentions "1M context", otherwise 200k.
- **Output limit:** 128k for Opus models, 64k for the rest. The CLI doesn't report this, so these are estimates. Adjust `toModel` in `index.ts` if you know better values.
- **Input:** text and images for Claude models, text only for others.
- If the `kiro` provider already exists, the plugin replaces its models. Otherwise it adds the provider using the `aisdk:kiro-acp-ai-provider` package.
- If the CLI fails or times out (30 seconds), the plugin logs an error and leaves the existing models unchanged.

The list is read once when the service starts. After Kiro adds or removes models, run `opencode service restart`.

## Notifications

When `kiro-cli` is missing, not logged in, or returns no models, the TUI shows a warning toast once per launch. To silence it on a machine without Kiro, set `KIRO_NOTIFY=0` in the environment OpenCode starts with (for example, in your shell profile).

## Troubleshooting

- Run `kiro-cli chat --list-models` in a terminal. If that fails, sign in with `kiro-cli` first.
- The background service may not inherit your shell `PATH`. If the plugin logs `ENOENT`, make sure `kiro-cli` is on the `PATH` the service starts with.
- Check that the plugin is active with `opencode plugin list`.
- Server logs are in `~/.local/share/opencode/log/opencode.log`. Look for lines starting with `[opencode-kiro-models]`.
