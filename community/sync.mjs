import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildCommunitySnapshot, validateCommunitySnapshot, sameCommunityData } from './community.mjs';
const project=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const publish=process.argv.includes('--publish');
const repository=process.env.GITHUB_REPOSITORY||'';
const token=process.env.GITHUB_TOKEN;
if(publish&&(!repository||!token))throw new Error('Publishing requires GITHUB_REPOSITORY and repository-scoped GITHUB_TOKEN.');
const headers={Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'hiring-model-lab-community',...(token?{Authorization:`Bearer ${token}`}:{})};
async function request(path,options={}){const res=await fetch(`https://api.github.com/repos/${repository}/${path}`,{...options,headers:{...headers,...options.headers},signal:AbortSignal.timeout(25000)});if(!res.ok){const e=new Error(`GitHub request failed (${res.status}); previous snapshot unchanged.`);e.status=res.status;throw e}return res.json()}
async function openIssues(){const all=[];for(let page=1;page<=100;page++){const xs=await request(`issues?state=open&sort=created&direction=asc&per_page=100&page=${page}`);if(!Array.isArray(xs))throw new Error('Unexpected issue list');all.push(...xs);if(xs.length<100)return all}throw new Error('Too many open issues')}
if(!publish&&!repository){console.log(JSON.stringify({status:'skipped',reason:'GITHUB_REPOSITORY not set'}));process.exit(0)}
for(let attempt=0;attempt<3;attempt++){
  const issues=await openIssues(),snapshot=buildCommunitySnapshot(issues,new Date().toISOString(),repository);if(!validateCommunitySnapshot(snapshot))throw new Error('Invalid generated snapshot');
  let existing=null,sha;
  if(publish){try{const f=await request('contents/community.json?ref=main');sha=f.sha;existing=validateCommunitySnapshot(JSON.parse(Buffer.from(f.content,'base64').toString('utf8')))}catch(e){if(e.status!==404)throw e}}
  else{try{existing=validateCommunitySnapshot(JSON.parse(await readFile(resolve(project,'community.json'),'utf8')))}catch{}}
  if(existing&&sameCommunityData(existing,snapshot)){console.log(JSON.stringify({status:'unchanged',openIssues:issues.length,updatedAt:existing.updatedAt}));break}
  const text=JSON.stringify(snapshot,null,2)+'\n';
  if(!publish){await writeFile(resolve(project,'community.json'),text);console.log(JSON.stringify({status:'written',openIssues:issues.length,players:snapshot.totalPlayers}));break}
  try{await request('contents/community.json',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Update game leaderboard and comments',content:Buffer.from(text).toString('base64'),branch:'main',...(sha?{sha}:{})})});console.log(JSON.stringify({status:'published',openIssues:issues.length,players:snapshot.totalPlayers}));break}catch(e){if(![409,422].includes(e.status)||attempt===2)throw e}
}
