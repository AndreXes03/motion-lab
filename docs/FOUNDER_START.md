# Make your first product commercial

Start with your product and the result you want. You do not need to know animation curves, cameras or render settings.

Framevolve includes a [commercial-making skill](../.agents/skills/motion-lab-product-film/SKILL.md) for the coding agent working in this repository. It guides the brief, visual direction, production and review. This is a conversation with your agent; the Studio is where you preview and refine the scene. There is no built-in conversational wizard that automatically turns a prompt or a photo into a finished film.

## Start the conversation

Open this repository in Codex or Claude Code and send:

> Help me make a commercial for my product in Framevolve. Use the included `motion-lab-product-film` skill. I am a founder, not a motion designer: ask only the essential questions, recommend a suitable direction and make a first preview I can judge. Start from what I already have, keep the result editable, and tell me which choices are assumptions.

Then add whatever you know:

> My product is … It helps … do … I want viewers to … I have … The video will first appear on … It should feel …

You can write in your own language and leave unknowns blank. Existing answers and supplied files should be reused. For a direct starting point, ask your agent to read `.agents/skills/motion-lab-product-film/SKILL.md`.

## The questions that matter

| Your choice | Examples |
| --- | --- |
| Who is this for? | New customers, potential users, people joining a waitlist. |
| What should they remember? | A useful result, a distinctive feature, the feel of the product. |
| What can we actually show? | A real app task, a product detail, a documented mechanism, a before/after. |
| What should happen next? | Try it, sign up, buy, book a demo, remember the brand. |
| What do you have? | Logo/colors, photos, model, screenshots, recordings, music or an existing film. |
| Where and how should it feel? | Phone feed or website; energetic, precise, playful or calm. |

These are prompts for a short conversation, not a questionnaire you must complete. The agent should recommend the visual and technical choices. Tell it any fixed wording, brand rules, deadline or approved music.

## What a useful first version contains

- A clear opening and an early visual payoff.
- One product promise shown through a visible detail, action or result.
- A deliberate variety of compositions and a rhythm with time to understand.
- A simple ending that fits your goal.
- Controls for the adjustments that matter to your scene.

A physical product may benefit from macro details, materials and 3D lighting. An app often benefits more from a clear real interaction and its result. A service can use a simple visual transformation. The strongest route depends on your assets and message.

An early preview should establish that direction before a long final render. If references or engineering details are missing, the agent should call a concept illustrative rather than present it as an accurate product model. Supplied photos do not automatically become 3D geometry.

## Give feedback without technical vocabulary

You can say:

- “I don't understand the benefit yet.”
- “These shots look too similar.”
- “This part needs more impact, but let me read the result.”
- “The product looks too plastic.”
- “The interface action should be clearer.”
- “Keep the music and the ending; only improve the middle.”

Name a scene or time when useful. The agent should translate that into a concrete change, retain accepted decisions and show the affected preview.

## Refine and export

Open the local Studio, play the scene and use its selected tools. Advanced controls let you refine curves, lens, light and materials where supported. Saved versions keep your alternatives.

Interactive preview and final rendering can use different engines. Cycles is local and scene-specific; the agent must check support and inspect actual output before promising it. You can request a quick draft or a more polished launch master without selecting sample counts yourself.

For final delivery, ask for the formats and destination you need. The agent should inspect the encoded film, check sound and seeking, and verify the actual delivered files. Publishing, buying music or starting paid generation remains a separate action requiring your authorization.

[Setup](../README.md#run-motion-lab-locally) · [Studio usage](USAGE.md) · [Agent workflow](AGENT_WORKFLOW.md)
