# Set up Framevolve on Mac

1. Download and unzip [Framevolve](https://github.com/AndreXes03/motion-lab/archive/refs/heads/main.zip), or use your existing Git clone. Put the folder somewhere you want to keep it.
2. Double-click **Setup Framevolve.command**. If Node.js is missing or too old, accept the private runtime download. No Homebrew, Git or administrator password is needed for a ZIP installation.
3. The welcome screen shows how your assistant and Studio work side by side. Choose **Continue to setup** (or **Skip introduction**). Optionally choose **Codex**, **Claude Code**, or leave **Decide later** selected. On an Apple Silicon Mac, **Native production** is selected by default: setup checks a real local Canvas raster and video encoder without downloading Chromium. Check **Download Rendering Cycles during setup** if you want the optional PULSE and LOOP renderer. Click **Set up & open Framevolve**. Dependencies, rendering checks, the app shortcut and opening the native Procedural demo (PLAY.EXE in legacy browser mode) are handled together.

The welcome and setup screens are separate, with **How it works** to return without losing your choices. **Advanced options** lets you choose the legacy browser production path for 3D scenes that have not migrated: setup detects Chrome or downloads Chromium. Studio itself opens in your default browser, including Safari; choosing Native production does not install a rendering browser. After Studio opens, **Create with AI** optionally installs/opens the selected official agent in Terminal. Complete sign-in there if requested and send the provided starter prompt. If you already use a desktop/editor agent, open this project folder there instead. You can also choose the agent after installation.

For best results, we recommend capable coding models such as **Sol, Astra, Opus, Fable or equivalents**, where available. Framevolve does not require a particular model or subscription plan. Provider access and any usage costs are managed by your chosen provider. Previewing, editing and exporting existing scenes does not require an agent. Provider selection is a setup preference; it does not add an embedded chat to Studio.

Keep the setup Terminal window open until Studio opens. Afterward, use **Close setup** or close its Terminal window. The setup session expires 30 minutes after launch, once no setup task is running; Studio keeps running separately. First installation needs internet access and several hundred MB for dependencies; Chromium is downloaded only when you choose that legacy production path. The installer uses a private Node.js 24 runtime only if a compatible Node/npm installation is unavailable; existing Node.js 22.12+ installations are reused. The runtime checksum is checked against the official Node.js release manifest. The folder must be writable.

## Your first moves in Studio

After setup, a short **Getting started** guide invites you to play or seek, change a scene control, and render a small PNG. The render uses your selected engine and reports errors normally; completion is counted only after a successful output. You can skip or reopen the guide at any time from the Studio sidebar. Progress stays in this local installation, including across browser/port changes. Existing sessions are not interrupted by a welcome popup.

**Bring your own AI** explains your own account/subscription/API access, shows the side-by-side layout and provides your actual Studio link and a starter prompt. Use the integrated browser only if your assistant supports localhost; otherwise keep Safari or Firefox beside the chat. **Start my own video** opens the existing guided brief. [Screenshots and implementation notes](ONBOARDING.md).

## If a step does not finish

- **Download interrupted:** reopen setup, or click Retry setup & open Framevolve. Completed downloads and existing tools can be reused. Expand Installation details for the error.
- **Chrome moved or removed:** rerun setup and locate it, or choose Chromium. The selected browser is checked before the app launches.
- **macOS blocks the downloaded command:** follow the normal macOS Open / Privacy & Security flow if you trust this download. This source distribution is not a signed or notarized installer; setup does not disable Gatekeeper. Alternatively, open Terminal in the extracted folder and run `bash "Setup Framevolve.command"`.
- **App shortcut already exists:** setup preserves it. If it points to a different copy or an older runtime, move that shortcut aside in Finder and retry setup. You can still open Studio directly from setup.
- **Port 4173 is busy:** close the other Studio when its work is finished, or use `node scripts/launch-studio.mjs --port 4194`. Setup does not stop another installation.
- **Agent sign-in:** finish it in the provider's window. Installing/opening the agent is not a claim that authentication succeeded. [Codex guide](https://developers.openai.com/codex/cli/) · [Claude Code guide](https://code.claude.com/docs/en/setup).

Change your choices by reopening **Setup Framevolve.command** or running `npm run setup`.

## A working example

The bundled recipe is [`demo/pop-motion.project.json`](../demo/pop-motion.project.json):

```sh
node scripts/cli.mjs preview --snapshot demo/pop-motion.project.json --start 0 --end 1 --width 640 --height 360 --temporal-samples 1 --out renders/first-preview.mp4
```

The export creates `renders/` and nested output folders before writing progress images or video. The Studio's export panel continues to use Downloads.

## Advanced configuration

Rendering tools share `scripts/browser-runtime.mjs`. `FRAMEVOLVE_BROWSER_PATH` (or legacy `CHROME_PATH`) overrides saved preferences and must point to an executable or a Chrome `.app`. Without an explicit selection, Framevolve detects system/user Chrome, then Playwright-managed Chromium. To download Chromium manually, run `npx playwright install chromium`.

Preferences and optional agent binaries live under `.motion-cache/`; no provider credentials are collected there by Framevolve. Chromium uses Playwright's standard browser cache. Providers manage their own credentials. App shortcuts point to this project folder, so rerun setup after moving it. Remove the shortcut and project folder to remove Framevolve; provider account data and shared Playwright caches are not deleted automatically.

Technical references: [Playwright browsers](https://playwright.dev/docs/browsers), [Node.js downloads](https://nodejs.org/en/download), [Codex CLI](https://developers.openai.com/codex/cli/), [Claude Code setup](https://code.claude.com/docs/en/setup). Installation methods checked on 2026-10-21.

The setup and installed app now offer **Update / Later** when a compatible update is available, including ZIP copies. See [updates and local-work protection](UPDATES.md).

## Optional Rendering Cycles component

Check **Download Rendering Cycles during setup** to add the optional native 3D renderer. To add it later, reopen setup and expand **Rendering Cycles**, or use **Studio → Export → Rendering Cycles**. The base setup remains usable without this component. There is one Framevolve app and one Desktop shortcut; the component has no separate launcher on the Desktop.

The macOS Apple Silicon preview is precompiled and checksummed. It requires no Blender, terminal commands or compilation. Because it has no Apple Developer ID signature or notarization yet, choose **Authorize in macOS** after download. If macOS blocks the component, use **System Settings → Privacy & Security → Open Anyway**, then return to Framevolve and choose **Check authorization**. Gatekeeper stays enabled. Managed Macs may prohibit this exception.

Apple Developer ID signing and notarization are coming soon. Once available, this manual authorization step will no longer be needed. The current preview still requires it; there is no announced release date.

Choose PULSE or LOOP, set **Renderer → Cycles**, then use **Render View** or **Export MP4**. Other scenes/platforms remain unavailable for Cycles; Three.js remains available. The renderer uses ACES SDR and may differ from the interactive preview and the old Blender Filmic output. See [verification and limits](CYCLES_STANDALONE_VALIDATION.md).
