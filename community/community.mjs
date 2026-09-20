const APP='hiring-model-lab';
const VERSION=1;
const RECORD_FENCE='hiring-model-lab';
const MAX_BODY=20000;
const SCORE_COUNT=9;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOGIN=/^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i;
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const exact=(v,ks)=>plain(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const dateString=v=>typeof v==='string'&&v.length<=30&&Number.isFinite(Date.parse(v))&&/^\d{4}-\d\d-\d\dT/.test(v);
const compareText=(a,b)=>a<b?-1:a>b?1:0;
function textField(value,max,allowEmpty=true){
  if(typeof value!=='string')return null;
  const s=value.normalize('NFC').trim();
  if((!allowEmpty&&!s)||Array.from(s).length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u.test(s))return null;
  return s;
}
export function scoreMarks(marks){
  if(typeof marks!=='string'||marks.length!==SCORE_COUNT||!/^[fr]+$/.test(marks))return null;
  const firstCorrectCount=[...marks].filter(x=>x==='f').length;
  const correctedCount=SCORE_COUNT-firstCorrectCount;
  return {score:Math.round((100*firstCorrectCount+60*correctedCount)/SCORE_COUNT),firstCorrectCount,correctedCount,totalQuestions:SCORE_COUNT};
}
export function parsePacket(input){
  let v=input;
  if(typeof input==='string'){try{v=JSON.parse(input)}catch{return null}}
  if(!exact(v,['version','runId','completedAt','marks'])||v.version!==VERSION||typeof v.runId!=='string'||!UUID.test(v.runId)||!dateString(v.completedAt)||!scoreMarks(v.marks))return null;
  return {version:VERSION,runId:v.runId.toLowerCase(),completedAt:new Date(v.completedAt).toISOString(),marks:v.marks};
}
function submission(input){
  if(!plain(input)||input.app!==APP||input.version!==VERSION||input.kind!=='score'||!exact(input,['app','version','kind','nickname','comment','rating','packet']))return null;
  const nickname=textField(input.nickname,24),comment=textField(input.comment,500);
  if(nickname===null||/[\r\n\t]/.test(nickname)||comment===null||!(input.rating===null||(Number.isInteger(input.rating)&&input.rating>=1&&input.rating<=5)))return null;
  const packet=parsePacket(input.packet);if(!packet)return null;
  return {app:APP,version:VERSION,kind:'score',nickname,comment,rating:input.rating,packet};
}
export function parseIssueSubmission(body){
  if(typeof body!=='string'||body.length>MAX_BODY)return null;
  const blocks=[...body.matchAll(/^```hiring-model-lab\s*\r?\n([\s\S]*?)\r?\n```\s*$/gm)];
  if(blocks.length!==1)return null;
  try{return submission(JSON.parse(blocks[0][1]))}catch{return null}
}
export function emptyCommunitySnapshot(updatedAt=new Date().toISOString(),repository=''){
  return {version:1,updatedAt,repository,source:'github-issues',selfReported:true,entries:[],totalPlayers:0,comments:[]};
}
const compareScores=(a,b)=>b.score-a.score||compareText(a.submittedAt,b.submittedAt)||a.issueNumber-b.issueNumber;
export function buildCommunitySnapshot(issues,updatedAt=new Date().toISOString(),repository=''){
  if(!Array.isArray(issues)||!dateString(updatedAt))throw new TypeError('Invalid snapshot inputs');
  const snapshot=emptyCommunitySnapshot(new Date(updatedAt).toISOString(),repository),scores=new Map(),comments=new Map();
  for(const issue of issues){
    if(!plain(issue)||issue.state!=='open'||issue.pull_request||issue.user?.type!=='User'||!Number.isSafeInteger(issue.user.id)||issue.user.id<=0||typeof issue.user.login!=='string'||!LOGIN.test(issue.user.login)||!Number.isSafeInteger(issue.number)||issue.number<=0||!dateString(issue.created_at))continue;
    if(Array.isArray(issue.labels)&&issue.labels.some(l=>(typeof l==='string'?l:l?.name)==='community-hidden'))continue;
    const record=parseIssueSubmission(issue.body);if(!record)continue;
    const author={login:issue.user.login,nickname:record.nickname||issue.user.login.slice(0,24),submittedAt:new Date(issue.created_at).toISOString(),issueNumber:issue.number,issueUrl:`https://github.com/${repository}/issues/${issue.number}`};
    const entry={...author,...scoreMarks(record.packet.marks),completedAt:record.packet.completedAt};
    const prev=scores.get(issue.user.id);if(!prev||compareScores(entry,prev)<0)scores.set(issue.user.id,entry);
    if(record.comment||record.rating!==null){const item={...author,body:record.comment,rating:record.rating};const old=comments.get(issue.user.id);if(!old||item.submittedAt>old.submittedAt||(item.submittedAt===old.submittedAt&&item.issueNumber>old.issueNumber))comments.set(issue.user.id,item)}
  }
  const entries=[...scores.values()].sort(compareScores).slice(0,100);let rank=0,prevScore=null;
  entries.forEach((e,i)=>{if(e.score!==prevScore)rank=i+1;e.rank=rank;prevScore=e.score});
  snapshot.totalPlayers=scores.size;snapshot.entries=entries;
  snapshot.comments=[...comments.values()].sort((a,b)=>compareText(b.submittedAt,a.submittedAt)).slice(0,30);
  return snapshot;
}
export function validateCommunitySnapshot(raw){
  if(!plain(raw)||raw.version!==1||!dateString(raw.updatedAt)||typeof raw.repository!=='string'||raw.source!=='github-issues'||raw.selfReported!==true||!Array.isArray(raw.entries)||!Array.isArray(raw.comments)||!Number.isSafeInteger(raw.totalPlayers)||raw.totalPlayers<0)return null;
  const out=emptyCommunitySnapshot(new Date(raw.updatedAt).toISOString(),raw.repository);out.totalPlayers=raw.totalPlayers;
  const seen=new Set();let lastScore=101,lastRank=0;
  for(const e of raw.entries){
    if(!plain(e)||!LOGIN.test(e.login)||typeof e.nickname!=='string'||Array.from(e.nickname).length>24||!Number.isInteger(e.rank)||e.rank<1||!Number.isInteger(e.score)||e.score<60||e.score>100||!Number.isInteger(e.firstCorrectCount)||!Number.isInteger(e.correctedCount)||e.firstCorrectCount+e.correctedCount!==SCORE_COUNT||!dateString(e.submittedAt)||!dateString(e.completedAt)||!Number.isInteger(e.issueNumber)||typeof e.issueUrl!=='string'||seen.has(e.login.toLowerCase())||e.score>lastScore||e.rank<lastRank)return null;
    seen.add(e.login.toLowerCase());lastScore=e.score;lastRank=e.rank;out.entries.push({...e});
  }
  const commenters=new Set();
  for(const c of raw.comments){
    if(!plain(c)||!LOGIN.test(c.login)||typeof c.nickname!=='string'||typeof c.body!=='string'||Array.from(c.body).length>500||!(c.rating===null||(Number.isInteger(c.rating)&&c.rating>=1&&c.rating<=5))||!dateString(c.submittedAt)||!Number.isInteger(c.issueNumber)||typeof c.issueUrl!=='string'||commenters.has(c.login.toLowerCase()))return null;
    commenters.add(c.login.toLowerCase());out.comments.push({...c});
  }
  return out;
}
export function sameCommunityData(a,b){const x=validateCommunitySnapshot(a),y=validateCommunitySnapshot(b);if(!x||!y)return false;delete x.updatedAt;delete y.updatedAt;return JSON.stringify(x)===JSON.stringify(y)}
