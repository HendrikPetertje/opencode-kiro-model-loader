import { Rpc } from "@opencode/plugin/rpc";

export const KiroStatus = Rpc.define({
  id: "kiro-models",
  methods: {
    status: {
      input: { type: "object", additionalProperties: false },
      output: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          message: { type: "string" },
        },
        required: ["ok"],
        additionalProperties: false,
      },
    },
  },
  events: {},
});

export type KiroStatusResult = { ok: boolean; message?: string };
