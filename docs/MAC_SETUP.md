# Set up Framevolve on Mac

1. Download and unzip [Framevolve](https://github.com/AndreXes03/motion-lab/archive/refs/heads/main.zip), or use your existing Git clone. Put the folder somewhere you want to keep it.
2. Double-click **Setup Framevolve.command**. If Node.js is missing or too old, accept the private runtime download. No Homebrew, Git or administrator password is needed for a ZIP installation.
3. Optionally choose **Codex**, **Claude Code**, or leave **Decide later** selected. Click **Set up & open Framevolve**. Setup detects Chrome; if it is unavailable, it installs Chromium automatically. Dependencies, rendering checks, the app shortcut and opening the PLAY.EXE demo are handled together.

Everything is on one screen. **Advanced options** lets you explicitly choose Chrome or Chromium, or locate Chrome elsewhere. After Studio opens, **Create with AI** optionally installs/opens the selected official agent in Terminal. Complete sign-in there if requested and send the provided starter prompt. If you already use a desktop/editor agent, open this project folder there instead. You can also choose the agent after installation.

For best results, we recommend capable coding models such as **Sol, Astra, Opus, Fable or equivalents**, where available. Framevolve does not require a particular model or subscription plan. Provider access and any usage costs are managed by your chosen provider. Previewing, editing and exporting existing scenes does not require an agent. Provider selection is a setup preference; it does not add an embedded chat to Studio.

Keep the setup Terminal window open until Studio opens. Afterward, use **Close setup** or close its Terminal window. The setup session expires 30 minutes after launch, once no setup task is running; Studio keeps running separately. First installation needs internet access and several hundred MB for dependencies and Chromium. The installer uses a private Node.js 24 runtime only if a compatible Node/npm installation is unavailable; existing Node.js 22.12+ installations are reused. The runtime checksum is checked against the official Node.js release manifest. The folder must be writable.

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
