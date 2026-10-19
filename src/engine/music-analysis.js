/** Local statistical audio analysis. No model inference, semantic labels or PCM retention. */
const MAX_BINS=24000,MAX_READS=1536000,MAX_EVENTS=4096;
const finite=(value,fallback)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

/** Analyze decoded PCM; budgets can be lowered, never raised above the hard caps. */
export function analyzeMusicPcm({channels,sampleRate}={},options={}){
  if(!Array.isArray(channels)||channels.length<1||channels.length>8)throw Error('Music analysis needs 1–8 PCM channels');
  if(!Number.isFinite(sampleRate)||sampleRate<=0)throw Error('Music sample rate must be positive');
  const frames=channels[0]?.length;
  if(!Number.isSafeInteger(frames)||frames<1||channels.some(channel=>!channel||channel.length!==frames))throw Error('Music PCM channels must have equal nonzero lengths');
  const duration=frames/sampleRate;
  if(!Number.isFinite(duration)||duration<=0)throw Error('Music PCM duration must be finite and positive');
  const maxBins=clamp(Math.floor(finite(options.maxBins,MAX_BINS)),1,MAX_BINS);
  const maxSampleReads=clamp(Math.floor(finite(options.maxSampleReads,MAX_READS)),8,MAX_READS);
  const binCount=Math.min(frames,maxBins,Math.ceil(duration*100),Math.floor(maxSampleReads/channels.length));
  const binDuration=duration/binCount,envelope=new Float32Array(binCount),peaks=new Float32Array(binCount),flux=new Float32Array(binCount);
  const samplesPerBin=Math.max(1,Math.min(32,Math.floor(maxSampleReads/(binCount*channels.length))));
  let sampleReads=0,energy=0,peak=0,baseline=0,fluxSum=0;
  for(let bin=0;bin<binCount;bin++){
    const from=Math.floor(bin*frames/binCount),to=Math.floor((bin+1)*frames/binCount),count=Math.min(to-from,samplesPerBin);
    let power=0,localPeak=0;
    for(let point=0;point<count;point++){
      // Deterministic stratified sampling avoids a regular stride becoming
      // blind to a tone whose period happens to match the sampling interval.
      const jitter=((Math.imul(bin+1,0x9e3779b1)^Math.imul(point+1,0x85ebca6b))>>>16)/65536;
      const index=from+Math.floor((point+jitter)*(to-from)/count);
      for(const channel of channels){const sample=clamp(finite(channel[index],0),-1,1);power+=sample*sample;localPeak=Math.max(localPeak,Math.abs(sample));sampleReads++;}
    }
    const rms=Math.sqrt(power/(count*channels.length));
    envelope[bin]=rms;peaks[bin]=localPeak;energy+=rms*rms;peak=Math.max(peak,localPeak);
    flux[bin]=Math.max(0,rms-baseline);fluxSum+=flux[bin];baseline=baseline*.8+rms*.2;
  }
  const waveformCount=Math.min(1200,binCount),waveform=Array(waveformCount).fill(0);
  for(let bin=0;bin<binCount;bin++){const i=Math.min(waveformCount-1,Math.floor(bin*waveformCount/binCount));waveform[i]=Math.max(waveform[i],peaks[bin]);}
  const rms=Math.sqrt(energy/binCount),meanFlux=fluxSum/binCount;
  let maxFlux=0;for(const value of flux)maxFlux=Math.max(maxFlux,value);
  const threshold=Math.max(meanFlux*1.8,maxFlux*.12),detected=[];
  for(let i=0;i<binCount;i++){
    if(flux[i]<=threshold||flux[i]<(flux[i-1]??-1)||flux[i]<=(flux[i+1]??-1))continue;
    const onset={time:(i+.5)*binDuration,strength:flux[i]/(maxFlux||1)};
    const previous=detected.at(-1);
    if(previous&&onset.time-previous.time<.12){if(onset.strength>previous.strength)detected[detected.length-1]=onset;}
    else detected.push(onset);
  }
  const onsets=detected.length>MAX_EVENTS?detected.toSorted((a,b)=>b.strength-a.strength||a.time-b.time).slice(0,MAX_EVENTS).sort((a,b)=>a.time-b.time):detected;
  const silent=rms<1e-5||peak<1e-4,short=duration<3;
  let bpm=null,confidence=0,beats=[],beatInterval=null,beatPhase=null;
  if(!silent&&!short&&onsets.length>=6&&binDuration<=.1){
    let variance=0;for(const value of flux)variance+=(value-meanFlux)**2;
    const minLag=Math.max(1,Math.ceil(.3/binDuration)),maxLag=Math.min(binCount-1,Math.floor(1.2/binDuration));
    let bestScore=0,bestLag=0;
    const scores=new Float64Array(maxLag+2);
    for(let lag=Math.max(1,minLag-1);lag<=Math.min(binCount-1,maxLag+1);lag++){
      let correlation=0;for(let i=lag;i<binCount;i++)correlation+=(flux[i]-meanFlux)*(flux[i-lag]-meanFlux);
      const score=variance>0?correlation/variance:0;
      scores[lag]=score;
      if(lag>=minLag&&lag<=maxLag&&score>bestScore){bestScore=score;bestLag=lag;}
    }
    // Prefer the first strong periodic peak to a numerically cleaner multiple
    // (e.g. 160 BPM clicks can otherwise be reported as 80 BPM at 100 Hz).
    for(let lag=minLag;lag<=maxLag;lag++)if(scores[lag]>=bestScore*.7&&scores[lag]>=scores[lag-1]&&scores[lag]>scores[lag+1]){bestLag=lag;bestScore=scores[lag];break;}
    confidence=clamp(bestScore*Math.min(1,onsets.length/8),0,1);
    if(confidence>=.35&&bestLag){
      const left=scores[bestLag-1],right=scores[bestLag+1],curvature=left-2*bestScore+right;
      const fractional=curvature<0?clamp(.5*(left-right)/curvature,-.5,.5):0;
      const interval=(bestLag+fractional)*binDuration;
      bpm=60/interval;
      let phaseX=0,phaseY=0;
      for(const onset of onsets){const angle=2*Math.PI*onset.time/interval;phaseX+=Math.cos(angle)*onset.strength;phaseY+=Math.sin(angle)*onset.strength;}
      const phase=((Math.atan2(phaseY,phaseX)/(2*Math.PI)+1)%1)*interval;
      beatInterval=interval;beatPhase=phase;
      for(let time=phase;time<duration&&beats.length<MAX_EVENTS;time+=interval)beats.push(time);
    }
  }
  return {version:1,duration,bpm,confidence,status:silent?'silence':short?'too-short':bpm?'ready':'uncertain',waveform,envelope,binDuration,onsets,beats,beatInterval,beatPhase,
    limits:{sampleReads,maxSampleReads,binCount,maxBins,eventsCapped:detected.length>MAX_EVENTS||Boolean(bpm&&duration/(60/bpm)>MAX_EVENTS)}};
}

/** Propose an energetic, sustained excerpt. It does not assess genre, lyrics or story relevance. */
export function proposeMusicExcerpt(analysis,requestedDuration){
  if(!analysis||!Number.isFinite(analysis.duration)||analysis.duration<=0||!Number.isFinite(requestedDuration)||requestedDuration<=0)throw Error('Excerpt needs positive track and film durations');
  const duration=Math.min(requestedDuration,analysis.duration),maxStart=analysis.duration-duration,shortTrack=analysis.duration<requestedDuration;
  const base={kind:'automatic-proposal',method:'energy-onset',duration,requestedDuration,shortTrack};
  if(!maxStart||analysis.status==='silence')return {...base,start:0,end:duration,reason:shortTrack?'Track is shorter than the film; the proposal uses all available audio.':analysis.status==='silence'?'No audible energy detected; no preferred excerpt.':'The complete track fits the requested excerpt.',candidates:[{start:0,end:duration,score:0}]};
  const envelope=analysis.envelope,step=analysis.binDuration;
  if(!envelope?.length||!Number.isFinite(step)||step<=0)throw Error('Excerpt needs the analyzed energy envelope');
  const count=envelope.length,power=new Float64Array(count+1),active=new Uint32Array(count+1),onsetPower=new Float64Array(count+1);
  let meanPower=0;for(const value of envelope)meanPower+=value*value;meanPower/=count;
  for(let i=0;i<count;i++){power[i+1]=power[i]+envelope[i]**2;active[i+1]=active[i]+(envelope[i]**2>meanPower*.5?1:0);}
  for(const onset of analysis.onsets??[]){const i=clamp(Math.floor(onset.time/step),0,count-1);onsetPower[i+1]+=onset.strength;}
  for(let i=0;i<count;i++)onsetPower[i+1]+=onsetPower[i];
  const starts=new Set([0,maxStart]),stride=Math.max(.25,maxStart/1600);
  for(let time=0;time<=maxStart;time+=stride)starts.add(time);
  // Bound candidate additions even for very long or unusually dense recordings.
  const anchors=analysis.beats?.length?analysis.beats:analysis.onsets?.map(onset=>onset.time)??[];
  const anchorStride=Math.max(1,Math.ceil(anchors.length/400));
  for(let i=0;i<anchors.length;i+=anchorStride)starts.add(clamp(anchors[i]-step*.5,0,maxStart));
  const candidates=[];
  for(const start of starts){
    const first=clamp(Math.floor(start/step),0,count-1),last=clamp(Math.ceil((start+duration)/step),first+1,count),n=last-first;
    const mean=(power[last]-power[first])/n,coverage=(active[last]-active[first])/n;
    const attacks=(onsetPower[last]-onsetPower[first])/Math.max(1,duration*2);
    const score=mean*(.5+.5*coverage)+meanPower*.1*Math.min(1,attacks);
    candidates.push({start,end:start+duration,score});
  }
  candidates.sort((a,b)=>b.score-a.score||a.start-b.start);
  const best=candidates[0];
  return {...base,start:best.start,end:best.end,reason:shortTrack?'Track is shorter than the film; the proposal uses all available audio.':'Automatic proposal based on sustained sampled energy and attacks; review its musical fit.',candidates:candidates.slice(0,5)};
}

/** Move output cuts toward estimated beats; source windows and total film duration stay intact. */
export function proposeBeatAlignedEdits(analysis,editorial,{musicStart=0,maxShift=.25,minClipDuration=.1}={}){
  if(!editorial||editorial.version!==1||!Array.isArray(editorial.clips)||!editorial.clips.length||editorial.clips.length>64)throw Error('Beat alignment needs a version 1 editorial edit');
  const edit={...editorial,clips:editorial.clips.map(clip=>({...clip}))};
  for(const clip of edit.clips)if(!Number.isFinite(clip.duration)||clip.duration<=0||!Number.isFinite(clip.sourceStart)||!Number.isFinite(clip.sourceEnd)||clip.sourceStart<0||clip.sourceEnd<=clip.sourceStart)throw Error('Beat alignment needs valid clip durations and source windows');
  musicStart=finite(musicStart,0);maxShift=clamp(finite(maxShift,.25),0,2);minClipDuration=Math.max(.001,finite(minClipDuration,.1));
  const total=edit.clips.reduce((sum,clip)=>sum+clip.duration,0),totalCuts=edit.clips.length-1;
  if(!Number.isFinite(total)||total>300)throw Error('Beat alignment supports films up to 300 seconds');
  const result={kind:'automatic-proposal',edit,snappedCuts:0,totalCuts};
  const hasGrid=Number.isFinite(analysis?.beatInterval)&&analysis.beatInterval>=.25&&Number.isFinite(analysis?.beatPhase);
  if(!analysis?.bpm||analysis.confidence<.35||(!analysis.beats?.length&&!hasGrid))return {...result,reason:'No reliable beat estimate; the edit is unchanged.'};
  if(edit.clips.some(clip=>clip.duration<minClipDuration))return {...result,reason:'Clips are shorter than the minimum alignment duration; the edit is unchanged.'};
  const beats=hasGrid?[]:analysis.beats.map(beat=>beat-musicStart).filter(beat=>Number.isFinite(beat)&&beat>0&&beat<total).sort((a,b)=>a-b);
  if(hasGrid){
    // A compact grid also covers trims beyond the capped display-beat array.
    const first=Math.ceil((musicStart-analysis.beatPhase)/analysis.beatInterval);
    for(let index=first;index<first+1202;index++){
      const time=analysis.beatPhase+index*analysis.beatInterval-musicStart;
      if(time>=total)break;if(time>0)beats.push(time);
    }
  }
  let authoredCut=0,previous=0;
  for(let i=0;i<totalCuts;i++){
    authoredCut+=editorial.clips[i].duration;
    // Leave the next authored cut feasible, so one snap cannot force an
    // unrelated later cut to move or masquerade as a beat-aligned boundary.
    const max=Math.min(total-(edit.clips.length-i-1)*minClipDuration,authoredCut+editorial.clips[i+1].duration-minClipDuration),min=previous+minClipDuration;
    let boundary=authoredCut,distance=maxShift;
    for(const beat of beats){const delta=Math.abs(beat-authoredCut);if(beat>=min&&beat<=max&&delta<distance){boundary=beat;distance=delta;}}
    // A prior snapped cut must not create an invalid next clip, even if no beat fits.
    boundary=clamp(boundary,min,max);
    edit.clips[i].duration=boundary-previous;previous=boundary;
    if(Math.abs(boundary-authoredCut)>1e-9)result.snappedCuts++;
  }
  if(!result.snappedCuts)edit.clips=editorial.clips.map(clip=>({...clip}));
  else edit.clips.at(-1).duration=total-edit.clips.slice(0,-1).reduce((sum,clip)=>sum+clip.duration,0);
  return {...result,reason:result.snappedCuts?'Automatic beat-alignment proposal; clip source windows and total film duration are preserved.':'Cuts already align or no estimated beats fall within the allowed shift.'};
}
