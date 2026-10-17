# Motion Lab MCP · local beta

Install and use this package from a reviewed copy. The [local setup and tool guide](../../docs/MCP_PLUGIN.md) covers Codex, Claude Desktop/Code, version IDs, update checks and renderer limits.

```sh
npm ci --prefix plugins/motion-lab
node plugins/motion-lab/server.mjs --repo /absolute/path/to/motion-lab --port 4198
```

The second command speaks MCP stdio, not a terminal UI or an HTTP endpoint. Configure a client to run it; do not paste text into its stdin. All diagnostics go to stderr.

`plugin.json` + `mcp.json` are the portable template. `.codex-plugin/plugin.json` supplies Codex metadata; `.claude-plugin/plugin.json` + `.mcp.json` provide Claude plugin metadata. `mcp.json` uses `${PLUGIN_ROOT}`; Claude's `.mcp.json` uses `${CLAUDE_PLUGIN_ROOT}`. Replace the absolute repo placeholder in a reviewed local copy, or generate absolute configuration with `node scripts/configure.mjs --repo /repo --destination /new/snippets`. Host/marketplace schemas can vary; the generated stdio client configuration is the provider-independent fallback. Do not enable both registrations in one client.

No config is written to Codex, Claude or Linux Home by these scripts. No marketplace or install command is executed automatically. Credentials are neither required nor packaged. Offline Git checks do not prevent local tools.

The runtime helper is a copy of `scripts/launch-studio.mjs` from `codex/mac-launcher` commit `72ed7c8cd9554481b4f90954c6dc5353783566ae`. It lets a reviewed external plugin run against a checkout that does not yet contain the launcher commit. It imports Vite from the selected repo and checks exact repo/instance health before reuse. No Linux Chromium adapter is bundled.
