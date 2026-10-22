#!/usr/bin/env node
// Fixed, bounded routing: no recursive source scan and no model call.
const routes={
 founder:{files:["docs/FOUNDER_START.md",".agents/skills/motion-lab-product-film/references/founder-discovery.md","src/viewer/session-tools.js","scripts/session-support-server.mjs"],tests:["npm run test:session"]},
 setup:{files:['scripts/mac-start.mjs','scripts/setup-mac.mjs','scripts/browser-runtime.mjs','docs/MAC_SETUP.md'],tests:['npm run test:setup']},
 updates:{files:['scripts/studio-update.mjs','scripts/zip-update.mjs','scripts/update-dialog.mjs','docs/UPDATES.md'],tests:['npm run test:updates','node scripts/test-studio-update.mjs']},
 feedback:{files:['.agents/skills/motion-lab-product-film/references/client-feedback.md','scripts/feedback-memory.mjs','docs/FEEDBACK_MEMORY.md'],tests:['npm run test:feedback']},
 live:{files:['.agents/skills/framevolve-live-review/SKILL.md','scripts/live-studio.mjs','docs/LIVE_STUDIO.md'],tests:['npm run test:live']},
 controls:{files:['scripts/controls.mjs','src/engine/scene-capabilities.js','project/control-selections.json'],tests:['node scripts/test-scene-control-contract.mjs','node scripts/controls.mjs check']},
 video:{files:['.agents/skills/motion-lab-product-film/SKILL.md','project/look.json','project/motion.json'],tests:['Render and inspect the changed shot, then contact sheet/preview before delivery.']}
};
const requested=process.argv[2];
if(!requested)console.log(JSON.stringify({topics:Object.keys(routes),usage:'npm run agent:context -- TOPIC',guidance:'docs/AGENT_EFFICIENCY.md'},null,2));
else if(routes[requested])console.log(JSON.stringify({topic:requested,...routes[requested]},null,2));
else{console.error('Unknown topic. Choose: '+Object.keys(routes).join(', '));process.exitCode=1;}
