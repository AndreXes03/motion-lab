// This report deliberately excludes ids, dates, local scene/task names, files and media.
const fields=['feedback','context','intent','diagnosis','change','preserve','before','after','verification','lesson','visualStatus','clientOutcome','clientResponse'];
export function redactFeedback(value){return String(value??'')
  .replace(/https?:\/\/[^\s<>]+/gi,'[link removed]')
  .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[email removed]')
  .replace(/(?:\/(?:Users|home|tmp|private|var)\/|[A-Z]:\\)[^\s"<>]+/gi,'[local path removed]')
  .replace(/\b(?:sk-|ghp_|github_pat_)[a-zA-Z0-9_-]{12,}/g,'[credential removed]');}
export function createFeedbackReport(records){
  return JSON.stringify({format:'framevolve-feedback-report',version:1,notice:'Voluntarily shared revision examples. Text is user-reviewed; automatic filtering does not guarantee anonymity.',records:records.map((record,index)=>({example:index+1,...Object.fromEntries(fields.map(key=>[key,redactFeedback(record[key])]))}))},null,2);
}
export function feedbackMailto(recipient){
  const email=recipient.trim();
  if(!/^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email)||email.length>254)throw Error('Enter Andrea’s confirmed feedback email address.');
  return 'mailto:'+encodeURIComponent(email)+'?subject='+encodeURIComponent('Framevolve — voluntary feedback report')+'&body='+encodeURIComponent('Hi Andrea,\n\nI would like to share these revision examples to help improve Framevolve’s workflows.\n\n[Attach the reviewed framevolve-feedback-report.txt file before sending.]\n');
}
