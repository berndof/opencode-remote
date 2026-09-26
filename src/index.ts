import { Plugin } from "@opencode/plugin"

export default Plugin.define({
  id: "opencode.remote",
  setup() {
    // OpenCode Remote Server hooks (reserved for server-side telemetry or multi-host routing)
    return () => {}
  },
})
