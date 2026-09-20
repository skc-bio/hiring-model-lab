import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreMarks,parseIssueSubmission,buildCommunitySnapshot,validateCommunitySnapshot} from './community.mjs';
const fenced=r=>`text\n\n\`\`\`hiring-model-lab\n${JSON.stringify(r,null,2)}\n\`\`\`\n`;
const packet={version:1,runId:'123e4567-e89b-42d3-a456-426614174000',completedAt:'2026-09-20T00:00:00.000Z',marks:'ffrfrffff'};
const record={app:'hiring-model-lab',version:1,kind:'score',nickname:'玩家A',comment:'很有帮助',rating:5,packet};
test('score marks',()=>assert.deepEqual(scoreMarks('fffffffff'),{score:100,firstCorrectCount:9,correctedCount:0,totalQuestions:9}));
test('parse record',()=>assert.equal(parseIssueSubmission(fenced(record)).nickname,'玩家A'));
test('snapshot keeps best score and latest comment',()=>{const issues=[
 {state:'open',number:1,created_at:'2026-09-20T00:00:00.000Z',labels:[],user:{type:'User',id:1,login:'player-one'},body:fenced(record)},
 {state:'open',number:2,created_at:'2026-09-20T00:02:00.000Z',labels:[],user:{type:'User',id:1,login:'player-one'},body:fenced({...record,comment:'new',packet:{...packet,runId:'223e4567-e89b-42d3-a456-426614174000',marks:'fffffffff'}})}
];const s=buildCommunitySnapshot(issues,'2026-09-20T00:03:00.000Z','owner/repo');assert.equal(s.entries[0].score,100);assert.equal(s.comments[0].body,'new');assert.ok(validateCommunitySnapshot(s));});
