# Help and export summary components

`mountHelpMenu({container, onboarding, onStartVideo})` mounts a persistent Help trigger in the supplied header container. “Getting started” calls the existing onboarding guide's `open()` method. “Start your own video” calls `onStartVideo()` when supplied, otherwise it opens that guide. The AI copy describes provider-owned accounts and charges; Framevolve does not claim to include a subscription or connect an account.

`mountExportSummary({container, getSummary, onTestFrame})` appends the delivery summary to a dedicated container inside the export dialog. It returns `refresh()` and `destroy()`. Call `refresh()` after the active recipe, output settings, renderer selection, or capability state changes.

`getSummary()` returns the current, already-resolved display data:

```js
{
  durationSeconds: 12,
  frameCount: 360,
  audioIncluded: 'Prepared soundtrack', // boolean or a truthful status string
  rendererLabel: 'Three.js',
  rendererAvailable: true,              // from the latest capability resolution
  deviceLabel: 'Browser / Canvas',
  deviceVerified: true,
  testFrameAvailable: true,
  testDisabled: false,                  // e.g. while rendering or in browser demo
  testFrameReason: ''
}
```

Derive duration/frame count from the active recipe and export frame rate. Use selected renderer/device values as planned values unless capabilities verify availability; do not add render-time estimates. `onTestFrame()` should call the existing one-frame render flow with the active recipe and settings. The component does not choose a renderer, start a render automatically, or fall back between explicit render choices.
