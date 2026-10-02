/**
 * Kiro model discovery for OpenCode V2.
 *
 * Runs `kiro-cli chat --list-models` at startup and registers the result as
 * the model list of the "kiro" provider, replacing a stale models.dev snapshot
 * or hand-written config. If the CLI fails, the existing definitions are kept.
 */
import { Model, Plugin, Provider } from "@opencode/plugin";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { KiroStatus, type KiroStatusResult } from "./rpc.ts";

const execFileAsync = promisify(execFile);

const PROVIDER_ID = Provider.ID.make("kiro");
const KIRO_PACKAGE = "aisdk:kiro-acp-ai-provider";
const DEFAULT_CONTEXT = 200_000;
const LARGE_CONTEXT = 1_000_000;

type KiroModel = { id: string; description: string };

// Lines look like: "* auto   1.00x credits   Models chosen by task..."
const LINE = /^\s*\*?\s*([A-Za-z0-9][\w.\-]*)\s+[\d.]+x credits\s+(.*)$/;

function parseModels(output: string): KiroModel[] {
  // eslint-disable-next-line no-control-regex
  const clean = output.replace(/\x1b\[[0-9;]*m/g, "");
  return clean.split("\n").flatMap((line) => {
    const match = LINE.exec(line);
    return match ? [{ id: match[1], description: match[2].trim() }] : [];
  });
}

function displayName(id: string): string {
  const base = id
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
  return `${base} (Kiro)`;
}

function toModel(entry: KiroModel): Model.Info {
  const isClaude = entry.id.startsWith("claude-");
  const context = /1M context/i.test(entry.description) ? LARGE_CONTEXT : DEFAULT_CONTEXT;
  const output = entry.id.startsWith("claude-opus") ? 128_000 : 64_000;
  const base = Model.Info.default(PROVIDER_ID, Model.ID.make(entry.id));
  return {
    ...base,
    name: displayName(entry.id),
    capabilities: {
      ...base.capabilities,
      tools: true,
      input: isClaude ? ["text", "image"] : ["text"],
      output: ["text"],
    },
    limit: { context, output },
  };
}

type ExecError = Error & { code?: string | number; stderr?: string; killed?: boolean };

function describeFailure(error: ExecError): string {
  if (error.code === "ENOENT") return "kiro-cli was not found on the PATH of the OpenCode service.";
  if (error.killed) return "kiro-cli timed out while listing models.";
  const detail = `${error.stderr ?? ""} ${error.message}`;
  if (/log ?in|sign ?in|auth|unauthori[sz]ed|expired|credential/i.test(detail)) {
    return "kiro-cli is not logged in. Run `kiro-cli login`, then `opencode service restart`.";
  }
  return `kiro-cli failed: ${error.message.split("\n")[0]}`;
}

async function listModels(): Promise<{ models: Model.Info[]; status: KiroStatusResult }> {
  try {
    const { stdout } = await execFileAsync("kiro-cli", ["chat", "--list-models"], {
      timeout: 30_000,
      env: { ...process.env, NO_COLOR: "1" },
    });
    const models = parseModels(stdout).map(toModel);
    if (models.length === 0) {
      return { models, status: { ok: false, message: "kiro-cli returned no models. Is it logged in?" } };
    }
    return { models, status: { ok: true } };
  } catch (error) {
    const message = describeFailure(error as ExecError);
    console.error("[opencode-kiro-models]", message);
    return { models: [], status: { ok: false, message } };
  }
}

export default Plugin.define({
  id: "opencode-kiro-models",
  async setup(ctx) {
    const result = listModels();
    await ctx.rpc.register(KiroStatus, {
      status: async () => (await result).status,
    });

    const { models } = await result;
    if (models.length === 0) return;

    await ctx.provider.transform((editor) => {
      if (editor.get(PROVIDER_ID)) {
        editor.models.set(PROVIDER_ID, models);
        return;
      }
      editor.add({
        info: {
          ...Provider.Info.empty(PROVIDER_ID),
          name: "Kiro",
          package: KIRO_PACKAGE,
        },
        models,
      });
    });
  },
});
