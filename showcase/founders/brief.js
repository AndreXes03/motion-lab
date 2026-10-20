/** Local text only: user answers remain data, never HTML or executable code. */
export function buildFounderBrief(answers) {
  const value = name => String(answers[name] ?? '').trim();
  return [
    'Help me create a launch video in Framevolve.',
    'Use the included skill at .agents/skills/motion-lab-product-film/SKILL.md and its founder discovery guidance.',
    '',
    `Product: ${value('product')}`,
    `Audience: ${value('audience') || 'Not specified yet; help me identify who should care.'}`,
    `Main message: ${value('message')}`,
    `Visible proof: ${value('proof') || 'Recommend one truthful product action, detail or result using the available assets.'}`,
    `Look and feel: ${value('vibe')}`,
    `Closing call to action: ${value('cta')}`,
    `Available assets: ${value('assets') || 'Not inventoried yet; use anything I already supplied before asking for more.'}`,
    `First placement: ${value('placement') || 'Recommend a suitable format and explain the assumption.'}`,
    `Reference: ${value('reference') || 'No reference yet. Suggest a direction based on the product and message.'}`,
    '',
    'I am a founder, not a motion designer. Reuse these answers and ask only the missing consequential questions, a few at a time. Recommend technical choices yourself.',
    'Start with a short direction card and an editable first preview. Show one product benefit clearly, vary shots and pace, and make every UI gesture produce a visible result. Choose 2D, UI or 3D from the product and actual assets; do not invent features or claims.',
    'Keep accepted brand choices and music, give me focused refinement controls, and distinguish assumptions, previews and verified exports. Do not publish or start paid generation without my authorization.'
  ].join('\n');
}
