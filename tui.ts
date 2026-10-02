/**
 * Shows a toast once per TUI launch when the server plugin cannot reach Kiro.
 * Set KIRO_NOTIFY=0 in the shell that starts OpenCode to silence it.
 */
import { Plugin } from "@opencode/plugin/tui";
import { KiroStatus, type KiroStatusResult } from "./rpc.ts";

export default Plugin.define({
  id: "opencode-kiro-models.tui",
  async setup(context) {
    if (process.env.KIRO_NOTIFY === "0") return;

    const location = context.location ?? context.data.location.default();
    try {
      const status = (await context.client.rpc(KiroStatus).status({}, { location })) as KiroStatusResult;
      if (status.ok) return;
      context.ui.toast.show({
        title: "Kiro unavailable",
        message: `${status.message ?? "Kiro models could not be loaded."} Set KIRO_NOTIFY=0 to hide this.`,
        variant: "warning",
        duration: 10_000,
      });
    } catch (error) {
      console.error("[opencode-kiro-models] status check failed:", (error as Error).message);
    }
  },
});
