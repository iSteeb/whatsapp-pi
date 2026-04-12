import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function(pi: ExtensionAPI) {
    pi.registerCommand("test-new", {
        description: "Test",
        handler: async (args, ctx) => {
            pi.sendUserMessage("/new", { deliverAs: "followUp" });
        }
    });
}
