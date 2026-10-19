# Founder commercial workflow

LAUNCH is an editable 24-second commercial template for introducing a SaaS product. Start local Studio with `npm run studio`, then open **New commercial**. The workflow collects the brand, three short product messages, a call to action, a logo and screenshots, and opens the resulting video in Studio.

The five shots are fixed: hook (0–4 s), product overview (4–9 s), second feature (9–14 s), third feature (14–19 s), and call to action (19–24 s). The first feature message accompanies the overview. Version 1 does not offer variable duration. It is composed for 16:9; other aspect ratios letterbox the same composition rather than rearranging it for vertical viewing. Orbit is a fictional starter example; replace its copy with accurate descriptions of your product.

## Brand and assets

- Brand name: 32 characters; tagline and headline: 80 each.
- Three feature messages: 60 characters each; call to action: 32; website: 120.
- Colors: six-digit hex background, foreground and accent values.
- Optional logo and up to three screenshots: PNG, JPEG or WebP. The editor prepares portable embedded image data; external image URLs and SVG are not accepted by this brief format.
- Combined embedded image data is limited to 1.2 MB, leaving space inside the existing 2 MB recipe limit. Use smaller images if the editor reports that the asset budget is exceeded.

All copy is single-line. The website may be blank or an HTTP(S) address/domain; it is displayed as text in the film. The scene does not fetch the website. Missing screenshots produce generic example artwork, so add actual product captures before using the film as a product demonstration. A missing logo uses the typed brand name.

## Edit, save and export

Adjust typography, screenshot size and position, reveal speed, motion, 2D framing, backdrop and finishing through the scene's selected controls. Use the animation editor for supported numeric controls. The 2D framing controls change composition without exposing a fictitious perspective camera.

Save a named version to keep a checkpoint. Download a project recipe for a portable copy containing the brief, embedded images, controls and animation; importing that recipe restores those values. Local Studio versions are stored with the project. The lightweight public browser demo does not expose this new creation flow. Keep a downloaded recipe when transferring work to another machine.

Preview representative moments, including transitions and the closing message, before exporting. Choose output settings through Studio's existing export panel. LAUNCH uses the browser/Canvas scene path; its renderer choice must remain within implemented adapter support. A successful schema test is not visual or video-export verification.

## Coding-agent handoff

Copy the prepared brief for a coding agent and attach the downloaded project recipe. The handoff includes copy, colors, shot windows and asset names; the recipe carries the actual image data. Ask the agent to refine the visual direction while preserving your supplied assets and approved claims, following `AGENTS.md` for editable controls and visual review.

This workflow uses the existing coding-agent authoring process. It does not call an AI model at runtime, generate product claims, or require an AI API key.

## Contract checks

Run `node scripts/test-commercial-brief.mjs` for the portable brief contract and `node scripts/test-commercial-integration.mjs` for server validation and saved-version round-trip checks. The integration test uses a local ephemeral HTTP server, writes one UUID-named version, and removes that version afterward; it does not invoke a renderer.
