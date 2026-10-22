# Storyboard, frame feedback and creative review

Choose **Storyboard** above the preview to browse named static compositions. Each card is rendered from the actual scene code and current settings. It does not generate images. The timeline is hidden, playback stops, and previous/next buttons let you inspect the sequence. **Open scene in editor** returns to that pose in Video mode.

For a new video, your agent builds the static layouts using real scene elements, registers their names and poses, then animates those same elements. Ask it to use the product-film skill's native-storyboard reference. Existing scenes can also register representative frames; the POP demo includes four. Scenes with no storyboard show instructions rather than fabricated cards.

**Comment on this frame** pauses the video and saves your comment with its scene, frame, settings and source revision. In Storyboard mode the comment refers to the selected named pose. Comments stay on this Mac, are removable and do not automatically call an AI or send research data. Ask your agent to read them; it can mark them in progress, done or blocked, with evidence. Done means the agent verified its change, not that you approved it. “Go to frame” seeks the current video without silently loading older settings.

**Creative review** shows the agent's evidence for benefit, readability, reading time, brand, rhythm, ending and continuity/sound. No automatic aesthetic score is calculated. Unchecked criteria remain unverified; changed source or settings mark old reports out of date. Layouts alone cannot prove good animation or audio.

Agent commands:
- `node scripts/creative.mjs storyboard FILE`: register native poses.
- `node scripts/creative.mjs comments SCENE`: read saved frame feedback.
- `node scripts/creative.mjs feedback ID doing|done|blocked "evidence"`: record work status.
- `node scripts/creative.mjs status SCENE`: current board, feedback, review and source revision.
- `node scripts/creative.mjs review FILE`: record an evidence-based review against current source.

Storyboards live in `project/storyboards/`; operational comments and reviews live in `.motion-cache/creative/`. They are separate from optional feedback research memory and are never automatically included in support emails. Keep these directories with the project. Native previews use the interactive scene engine; final-render lighting, motion blur and sound require separate video review.
