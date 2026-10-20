import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildFounderBrief} from '../showcase/founders/brief.js';

const examples = [
  {product:'A budgeting app',audience:'Freelancers',message:'Know what is left to spend',proof:'An expense updates the available balance',vibe:'Clean and confident',cta:'Try the demo',assets:'App screenshots or a recording',placement:'Phone feed',reference:'Keep our exact UI'},
  {product:'A compact speaker',audience:'Small-space music fans',message:'A tactile control',proof:'The crown changes volume',vibe:'Fast and energetic',cta:'Join the waitlist',assets:'Product photos',placement:'Website',reference:'Orange and black'},
  {product:'A scheduling service',audience:'Patients',message:'Choose an appointment clearly',proof:'Available time becomes a booking',vibe:'Calm and considered',cta:'Explore the service',assets:'An existing video to improve',placement:'Presentation',reference:'No flashing'},
  {product:'An early idea',message:'A simpler everyday task',vibe:'Playful and bold',cta:'Learn more'},
  {product:'<script>alert("example")</script>',message:'Literal <b>user text</b>',vibe:'Calm',cta:'Read more'}
];
for (const input of examples) {
  const copy=structuredClone(input),result=buildFounderBrief(input);
  assert.deepEqual(input,copy,'Building a brief must not mutate founder answers');
  for(const answer of Object.values(input))assert.ok(result.includes(answer),'Explicit answers must survive unchanged');
  assert.ok(!result.includes('undefined')&&!result.includes('[object Object]'));
  assert.equal(result,buildFounderBrief(input),'Brief construction must be deterministic');
}
assert.ok(!buildFounderBrief(examples[3]).includes('I will provide my logo and product screenshots'),'Do not invent promised assets');
const html=await readFile(new URL('../showcase/founders/index.html',import.meta.url),'utf8');
for(const field of ['audience','proof','assets','placement']) {
  assert.match(html,new RegExp(`<(input|select)[^>]*name="${field}"`));
  assert.doesNotMatch(html,new RegExp(`<(input|select)[^>]*name="${field}"[^>]*required`),'Additional context stays optional');
}
const script=await readFile(new URL('../showcase/founders/founders.js',import.meta.url),'utf8');
assert.ok(script.includes('briefOutput.value = buildFounderBrief(Object.fromEntries(data))'),'Render user content as textarea text');
console.log('Founder brief: complete, sparse and literal-markup inputs preserved; optional context, immutability and deterministic output passed.');
