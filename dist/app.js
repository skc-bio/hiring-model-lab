const SKILLS = ['言语理解', '逻辑判断', '数量关系'];
const SKILL_SHORT = ['言语', '逻辑', '数量'];

const ITEM_DEFAULTS = [
  {id:'Q1',label:'主旨概括',stem:'一项公共服务如果只追求“办得快”，却让不会使用智能设备的人难以办理，就可能在提升效率的同时制造新的不便。因此，服务改进既要考虑速度，也要保留可选择的办理方式。这段话主要强调：',options:['智能设备会降低服务效率','公共服务应兼顾效率与可及性','线下办理一定优于线上办理','所有人都应学习使用智能设备'],answer:1,refReq:[1,0,0],reason:'需要抓住转折后的核心观点，排除过度绝对或偏离主旨的选项。',trueGuess:.38},
  {id:'Q2',label:'语句排序',stem:'将下列句子排序：①于是城市开始保留部分夜间照明 ②过去许多候鸟迁徙会经过这里 ③研究发现强光会干扰它们辨认方向 ④为了减少影响，管理部门调整了照明方案。最合理的顺序是：',options:['②③④①','③②①④','②④③①','④①②③'],answer:0,refReq:[1,1,0],reason:'要识别“候鸟—研究发现—采取措施—结果”的语义与因果衔接。',trueGuess:.46},
  {id:'Q3',label:'词义判断',stem:'“这项方案看似周全，但对执行成本的估计仍显得过于乐观。”其中“乐观”最接近：',options:['态度积极且值得赞扬','估计偏低，可能忽视困难','执行人员心情愉快','方案已经确定成功'],answer:1,refReq:[1,0,0],reason:'需要结合转折和“执行成本”判断语境义，而非选择词语的日常褒义。',trueGuess:.55},
  {id:'Q4',label:'条件推理',stem:'规定：只有通过笔试，才能参加面试；参加面试的人都完成了资格审查。小周没有完成资格审查。由此一定可以推出：',options:['小周没有通过笔试','小周没有参加面试','小周参加了笔试','小周放弃了报名'],answer:1,refReq:[0,1,0],reason:'“面试→完成审查”，其逆否命题是“未完成审查→未参加面试”。',trueGuess:.24},
  {id:'Q5',label:'真假判断',stem:'甲、乙、丙中只有一人拿走了文件。甲说“不是我”；乙说“是丙”；丙说“乙在说谎”。已知三句话中只有一句为真。拿走文件的是：',options:['甲','乙','丙','无法确定'],answer:0,refReq:[0,1,0],reason:'分别代入三种情况，只有甲拿走时恰好一句为真。',trueGuess:.17},
  {id:'Q6',label:'类比关系',stem:'“医生：诊断”与下列哪组关系最接近？',options:['教师：学校','法官：裁判','作家：书店','司机：道路'],answer:1,refReq:[1,1,0],reason:'前后是职业主体与其核心专业行为的关系。',trueGuess:.49},
  {id:'Q7',label:'工程问题',stem:'甲单独完成一项工作需6天，乙单独完成需3天。两人效率不变，一起完成需要：',options:['1天','2天','3天','4天'],answer:1,refReq:[0,0,1],reason:'总效率为1/6+1/3=1/2项/天，因此需要2天。',trueGuess:.31},
  {id:'Q8',label:'增长计算',stem:'某地去年处理申请800件，今年比去年增加15%。今年处理多少件？',options:['880件','900件','920件','950件'],answer:2,refReq:[0,0,1],reason:'增加量为800×15%=120，今年为920件。',trueGuess:.44},
  {id:'Q9',label:'数列规律',stem:'观察数列：2，6，12，20，30，下一项是：',options:['36','40','42','44'],answer:2,refReq:[0,1,1],reason:'相邻差为4、6、8、10，下一差为12，因此下一项为42。',trueGuess:.26}
];

const ALPHA_PRIOR={a:2.5,b:7.5};
const NO_MISTAKE=.9;
const DATA_N=240, DEV_N=160, HOLDOUT_N=80;
const KEY='hiring-model-workbench-book-ch2-v4-community';
const SCORE_ITEMS=[
  ['labelUse','eval'],['guess','25'],['toy','v'],['raw','structure'],['first','mismatch'],
  ['debug','synthetic'],['diagnosePattern','vary'],['diagnoseCause','guess'],['flex','item']
];
function newRunId(){
  if(globalThis.crypto?.randomUUID)return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16)});
}
function recordAttempt(key,value){
  if(!state.attempts)state.attempts={};
  if(!Object.hasOwn(state.attempts,key))state.attempts[key]=value;
}
function scoreSummary(){
  const marks=SCORE_ITEMS.map(([key,correct])=>state.attempts?.[key]===correct?'f':'r').join('');
  const stats=HiringCommunity?.scoreMarks?.(marks)||{score:0,firstCorrectCount:0,correctedCount:0,totalQuestions:SCORE_ITEMS.length};
  return {...stats,marks};
}
function scorePacket(){
  if(!state.completedAt)state.completedAt=new Date().toISOString();
  if(!state.runId)state.runId=newRunId();
  save();
  return {version:1,runId:state.runId,completedAt:state.completedAt,marks:scoreSummary().marks};
}

function seeded(seed){return()=>((seed=Math.imul(1664525,seed)+1013904223>>>0)/4294967296)}
function makeDataset(){
  const rnd=seeded(1061),patterns=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[1,1,0],[1,0,1],[0,1,1],[1,1,1]];
  const noisy=new Set();
  while(noisy.size<Math.round(DATA_N*.10)) noisy.add(Math.floor(rnd()*DATA_N));
  return Array.from({length:DATA_N},(_,i)=>{
    const truth=[...patterns[i%patterns.length]],self=[...truth];
    if(noisy.has(i)){const k=Math.floor(rnd()*3);self[k]=1-self[k]}
    const answers=ITEM_DEFAULTS.map(it=>{
      const has=it.refReq.every((v,k)=>!v||truth[k]);
      return rnd() < (has ? NO_MISTAKE : it.trueGuess) ? 1 : 0;
    });
    return {id:'P'+String(i+1).padStart(3,'0'),answers,self,truth};
  });
}
function makeSplit(){
  const rnd=seeded(38),arr=Array.from({length:DATA_N},(_,i)=>i);
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]]}
  return {dev:arr.slice(0,DEV_N),holdout:arr.slice(DEV_N)};
}

const DEFAULT_STATE={
  screen:'intro',stage:0,maxStage:0,data:makeDataset(),split:makeSplit(),selected:null,runId:newRunId(),completedAt:null,attempts:{},
  checks:{labelUse:null,guess:null,toy:null,raw:null,first:null,debug:null,diagnosePattern:null,diagnoseCause:null,flex:null}
};
let state=load();
let cache={};
const app=document.querySelector('#app'),modal=document.querySelector('#modal'),modalBody=document.querySelector('#modalBody');
function cloneDefault(){return JSON.parse(JSON.stringify(DEFAULT_STATE))}
function load(){try{const x=JSON.parse(localStorage.getItem(KEY));if(!x||x.data?.length!==DATA_N||x.split?.dev?.length!==DEV_N)return cloneDefault();return {...cloneDefault(),...x,checks:{...cloneDefault().checks,...(x.checks||{})}}}catch{return cloneDefault()}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state))}catch{}}
const clamp=(x,a=.000001,b=.999999)=>Math.min(b,Math.max(a,Number(x)||0));
const pct=x=>Math.round(x*100)+'%';
const pct1=x=>(x*100).toFixed(1)+'%';
const pp=x=>(x>=0?'+':'')+(x*100).toFixed(1)+' 个百分点';
const devIndices=()=>state.split.dev;
const holdoutIndices=()=>state.split.holdout;

const STATES=Array.from({length:8},(_,n)=>SKILLS.map((_,k)=>(n>>k)&1));
function hasRequired(sk,j){return ITEM_DEFAULTS[j].refReq.every((v,k)=>!v||sk[k])}
function correctProb(sk,j,alphas){return hasRequired(sk,j)?NO_MISTAKE:clamp(alphas[j],.001,.999)}
function posterior(person,alphas,questionIndices=null){
  const qs=questionIndices||ITEM_DEFAULTS.map((_,j)=>j);
  let rows=STATES.map(sk=>{
    let likelihood=1;
    qs.forEach(j=>{const p=correctProb(sk,j,alphas),a=person.answers[j];likelihood*=a?p:1-p});
    return {sk,w:likelihood/8};
  });
  let z=rows.reduce((s,r)=>s+r.w,0);if(!Number.isFinite(z)||z<=0)z=1;
  rows.forEach(r=>r.post=r.w/z);
  return {rows,marg:SKILLS.map((_,k)=>rows.filter(r=>r.sk[k]).reduce((s,r)=>s+r.post,0))};
}
function expectedGuessCounts(indices,alphas){
  const y=Array(9).fill(0),n=Array(9).fill(0);
  indices.forEach(i=>{
    const person=state.data[i],post=posterior(person,alphas);
    post.rows.forEach(r=>ITEM_DEFAULTS.forEach((_,j)=>{
      if(!hasRequired(r.sk,j)){n[j]+=r.post;if(person.answers[j])y[j]+=r.post}
    }));
  });
  return {y,n};
}
function learnItems(){
  if(cache.items)return cache.items;
  let means=Array(9).fill(.25),iterations=0,counts;
  for(iterations=0;iterations<80;iterations++){
    counts=expectedGuessCounts(devIndices(),means);
    const next=means.map((_,j)=>(ALPHA_PRIOR.a+counts.y[j])/(ALPHA_PRIOR.a+ALPHA_PRIOR.b+counts.n[j]));
    const d=Math.max(...next.map((x,j)=>Math.abs(x-means[j])));means=next;if(d<1e-9)break;
  }
  counts=expectedGuessCounts(devIndices(),means);
  const stats=means.map((mean,j)=>({mean,a:ALPHA_PRIOR.a+counts.y[j],b:ALPHA_PRIOR.b+counts.n[j]-counts.y[j],n:counts.n[j],y:counts.y[j]}));
  return cache.items={means,stats,iterations};
}
function betaMidInterval(a,b){
  const m=a/(a+b),v=(a*b)/(((a+b)**2)*(a+b+1)),sd=Math.sqrt(v),z=.67449;
  return [Math.max(0,m-z*sd),Math.min(1,m+z*sd)];
}
function metrics(indices,alphas){
  let nll=0,brier=0,agree=0,n=0;const probs=[],ys=[];
  indices.forEach(i=>{const r=posterior(state.data[i],alphas);r.marg.forEach((p,k)=>{p=clamp(p);const y=state.data[i].self[k];nll+=-(y*Math.log(p)+(1-y)*Math.log(1-p));brier+=(p-y)**2;agree+=Number((p>=.5)===Boolean(y));n++;probs.push(p);ys.push(y)})});
  const pos=probs.filter((_,i)=>ys[i]),neg=probs.filter((_,i)=>!ys[i]);let wins=0;
  pos.forEach(p=>neg.forEach(q=>{wins+=p>q?1:p===q?.5:0}));
  return {nll:nll/n,brier:brier/n,agreement:agree/n,auc:pos.length&&neg.length?wins/(pos.length*neg.length):NaN};
}
function questionPredictionDiagnostics(alphas){
  return ITEM_DEFAULTS.map((it,j)=>{
    let predicted=0,actual=0;
    devIndices().forEach(i=>{
      const p=state.data[i],has=it.refReq.every((v,k)=>!v||p.self[k]);
      predicted+=has?NO_MISTAKE:alphas[j];actual+=p.answers[j];
    });
    predicted/=devIndices().length;actual/=devIndices().length;
    return {j,predicted,actual,diff:actual-predicted};
  });
}
function syntheticSet(){
  if(cache.synthetic)return cache.synthetic;
  const rnd=seeded(5),alphas=Array(9).fill(.25);
  const people=Array.from({length:24},(_,i)=>{const truth=SKILLS.map(()=>rnd()<.5?1:0);const answers=ITEM_DEFAULTS.map((_,j)=>rnd()<correctProb(truth,j,alphas)?1:0);return {id:'S'+String(i+1).padStart(2,'0'),truth,answers}});
  let agree=0,n=0,nll=0;
  people.forEach(p=>{const r=posterior(p,alphas);r.marg.forEach((x,k)=>{const y=p.truth[k];agree+=Number((x>=.5)===Boolean(y));n++;x=clamp(x);nll+=-(y*Math.log(x)+(1-y)*Math.log(1-x))})});
  return cache.synthetic={people,agreement:agree/n,nll:nll/n};
}
function holdoutComparison(){
  const item=learnItems().means,baseA=Array(9).fill(.25);
  let best=null,fallback=null;
  holdoutIndices().forEach(i=>{
    const person=state.data[i],b=posterior(person,baseA).marg,f=posterior(person,item).marg;
    b.forEach((x,k)=>{
      const y=person.self[k],direction=(f[k]-x)*(y?1:-1),improve=Math.abs(x-y)-Math.abs(f[k]-y),cross=((x>=.5)!==Boolean(y))&&((f[k]>=.5)===Boolean(y));
      if(direction>0){
        const c={value:Math.abs(f[k]-x),improve,cross,index:i,skill:k,base:b,flex:f};
        if(!fallback||c.improve>fallback.improve)fallback=c;
        if(c.cross&&(!best||c.improve>best.improve))best=c;
      }
    });
  });
  return best||fallback;
}

function shell(content,aside=''){app.innerHTML=`<div class="lab-shell"><section class="lab-main">${content}</section>${aside}</div>`;app.focus()}
function intro(){
  state.screen='intro';save();
  app.innerHTML=`<section class="landing"><div class="landing-copy"><div class="eyebrow">HIRING LAB · 模型诊断实验</div><h1>用问卷，推断候选人的能力</h1><p class="lead">你要做出一套招聘测评模型。以后面对一位新候选人，模型只能看到他的 9 道选择题答案，然后给出言语理解、逻辑判断和数量关系三项能力的概率判断。</p><div class="goal-card"><span class="goal-icon">01</span><div><b>你的目标一直不变</b><p>让“问卷答案 → 能力概率”这条推断尽可能可靠。你会从一个简单模型开始，用数据检查它哪里不对，再决定要不要修改假设。</p></div></div><div class="home-actions"><button class="primary large" id="begin">${state.maxStage?'继续实验':'开始构建模型'}</button><span>约 15 分钟 · 先建模，再诊断，再独立检验</span></div></div><div class="landing-visual" aria-hidden="true"><div class="candidate-card"><small>NEW CANDIDATE</small><b>9 题作答</b><div class="answer-dots">${[1,0,1,1,0,1,1,0,1].map(x=>`<i class="${x?'on':''}"></i>`).join('')}</div></div><div class="arrow-label">这些答案能说明什么？</div><div class="ability-card"><small>ABILITY ESTIMATE</small>${SKILLS.map((s,i)=>`<div><span>${s}</span><b>${[68,54,77][i]}%</b><i style="--w:${[68,54,77][i]}%"></i></div>`).join('')}</div></div></section>`;
  document.querySelector('#begin').onclick=()=>{state.screen='lab';save();renderStage()};
}
function progress(){
  const names=['数据与参考','基础模型','先试模型','看真实数据','第一次结果','排查原因','诊断假设','学习题目差异','独立检验','个体复盘'];
  return `<nav class="stage-nav"><button class="back" id="homeBack">← 首页</button><div class="stage-track ten">${names.map((x,i)=>`<button data-stage="${i}" class="${i===state.stage?'active':i<state.maxStage?'done':''}" ${i>state.maxStage?'disabled':''}><i>${i<state.maxStage?'✓':i+1}</i><span>${i<=state.maxStage?x:'待解锁'}</span></button>`).join('')}</div><b>${state.stage+1}/10</b></nav>`;
}
function notebook(){
  const guessKnown=state.checks.guess==='25',items=state.maxStage>=7?learnItems().means:null;
  const rules=state.maxStage>=1?`<section><b>当前规则</b><p>具备题目所需全部能力时，答对概率 90%。</p>${guessKnown?'<p>完全不会、四选一随机选择时，答对概率 25%。</p>':'<p>缺少题目所需能力时，也可能碰巧答对。</p>'}</section>`:'';
  return `<aside class="lab-note"><header><span>MODEL NOTEBOOK</span><b>当前模型记录</b></header><section><b>最终任务</b><p>只根据 9 道题答案，推断候选人的三项能力。</p></section><section><b>开发期参考</b><p>匿名试测者的自评能力，只用于检查模型，不作为模型输入。</p></section>${rules}${items?`<section><b>诊断后新增</b><p>每道题学习自己的猜对概率。</p><small>${items.map((x,j)=>`${ITEM_DEFAULTS[j].id} ${x.toFixed(2)}`).join(' · ')}</small></section>`:''}</aside>`;
}

function bindNav(){
  const h=document.querySelector('#homeBack');if(h)h.onclick=intro;
  document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{const s=+b.dataset.stage;if(s<=state.maxStage){state.stage=s;save();renderStage()}});
}
function advance(n){state.stage=n;state.maxStage=Math.max(state.maxStage,n);save();renderStage()}
function idsChips(indices,locked=false){
  const shown=indices.slice(0,18),rest=Math.max(0,indices.length-shown.length);
  return `<div class="id-chips ${locked?'locked':''}">${shown.map(i=>`<span>${state.data[i].id}</span>`).join('')}${rest?`<span class="more-chip">${locked?'•••':'+'+rest+' 条'}</span>`:''}</div>`;
}
function questionBank(){return `<div class="question-bank">${ITEM_DEFAULTS.map(it=>`<article><header><b>${it.id} · ${it.label}</b></header><p>${it.stem}</p><details><summary>查看答案和题目解释</summary><ol type="A">${it.options.map((o,k)=>`<li class="${k===it.answer?'answer':''}">${o}</li>`).join('')}</ol><p>${it.reason}</p></details></article>`).join('')}</div>`}
function skillRequirementGrid(){
  return `<div class="req-grid-wrap"><div class="req-grid"><div></div>${ITEM_DEFAULTS.map(it=>`<b>${it.id}</b>`).join('')}${SKILLS.map((s,k)=>`<strong>${s}</strong>${ITEM_DEFAULTS.map(it=>`<span class="${it.refReq[k]?'on':''}" title="${it.id} ${it.refReq[k]?'需要':'不需要'}${s}">${it.refReq[k]?'●':'·'}</span>`).join('')}`).join('')}</div></div>`;
}
function responseMatrix(indices){
  return `<div class="matrix-scroll"><div class="response-matrix" style="--rows:${indices.length}">${indices.map(i=>state.data[i].answers.map((a,j)=>{const ks=ITEM_DEFAULTS[j].refReq.map((v,k)=>v?k:-1).filter(k=>k>=0).join('-');return `<span class="${a?'correct':'wrong'} skill-${ks}" title="${state.data[i].id} · ${ITEM_DEFAULTS[j].id} · ${a?'答对':'答错'}"></span>`}).join('')).join('')}</div><div class="matrix-axis"><span>每一行 = 1 位试测者</span><span>每一列 = 1 道题（Q1 → Q9）</span></div></div>`;
}
function skillMatrix(indices,alphas,mode='inferred'){
  const cells=[];
  indices.forEach(i=>SKILLS.forEach((s,k)=>{
    if(mode==='reference'){const y=state.data[i].self[k];cells.push(`<span class="skill-cell ref ${y?'on':''}" title="${state.data[i].id} · ${s} · 自评${y?'具备':'不具备'}"></span>`)}
    else{const p=posterior(state.data[i],alphas).marg[k],op=(.08+.84*p).toFixed(3);cells.push(`<span class="skill-cell" style="background:rgba(49,94,232,${op})" title="${state.data[i].id} · ${s} · ${pct1(p)}"></span>`)}
  }));
  return `<div class="skill-matrix-wrap"><div class="skill-matrix-head">${SKILL_SHORT.map(x=>`<b>${x}</b>`).join('')}</div><div class="skill-matrix">${cells.join('')}</div><small>${indices.length} 人 × 3 项能力</small></div>`;
}
function syntheticSkillMatrix(people,mode='truth'){
  const shared=Array(9).fill(.25),cells=[];
  people.forEach(p=>SKILLS.forEach((s,k)=>{
    if(mode==='truth'){cells.push(`<span class="skill-cell ref ${p.truth[k]?'on':''}" title="${p.id} · ${s} · 已知${p.truth[k]?'具备':'不具备'}"></span>`)}
    else{const pr=posterior(p,shared).marg[k],op=(.08+.84*pr).toFixed(3);cells.push(`<span class="skill-cell" style="background:rgba(49,94,232,${op})" title="${p.id} · ${s} · ${pct1(pr)}"></span>`)}
  }));
  return `<div class="skill-matrix-wrap"><div class="skill-matrix-head">${SKILL_SHORT.map(x=>`<b>${x}</b>`).join('')}</div><div class="skill-matrix">${cells.join('')}</div><small>${people.length} 个模拟样本</small></div>`;
}
function abilityBars(r){return `<div class="ability-bars">${SKILLS.map((s,k)=>`<div><header><span>${s}</span><b>${pct(r.marg[k])}</b></header><i style="--w:${Math.round(r.marg[k]*100)}%"></i></div>`).join('')}</div>`}

function stage0(){
  const labelUse=state.checks.labelUse,ok=labelUse==='eval';
  const feedback=labelUse===null?'':ok?`<div class="quiz-feedback correct"><b>对。模型推断时不能偷看参考标签。</b><p>它以后面对新候选人时只有问卷答案，所以开发阶段也要保持同样的输入条件。自评能力只用来检查模型推断得准不准。</p></div>`:`<div class="quiz-feedback"><b>这样会把答案直接泄露给模型。</b><p>我们要检验的是“只看问卷能不能推断能力”。如果模型把自评能力也当输入，就无法回答这个问题。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 01 · 先把“模型能看什么”说清楚</div><h1>真实能力看不见，所以我们需要一份近似参考</h1><p class="stage-lead">这 240 条历史记录来自匿名试测。每个人做了同一份 9 题问卷，也单独报告了自己认为掌握哪些能力。自评可能有误，所以它不是绝对真值；开发阶段我们把它当作<strong>近似 ground truth</strong>，用来检查模型推断是否靠谱。</p><div class="data-contract"><section><small>模型真正能使用</small><b>9 道题的答对 / 答错</b><p>这才是以后面对新候选人时能够拿到的信息。</p></section><section><small>开发期参考</small><b>三项能力的匿名自评</b><p>只用于评价和诊断。模型在做能力判断时不能读取它。</p></section></div><section class="quiz-block"><div class="quiz-number">先确认规则</div><h2>如果我们的目标是“只根据问卷答案推断能力”，这份自评能力应该怎么用？</h2><div class="choice-grid">${[['input','和问卷答案一起输入模型，让模型更容易判断。'],['eval','不作为模型输入，只在开发时拿来检查模型判断是否接近参考。'],['discard','完全丢掉，因为它可能有误。']].map(([v,t])=>`<button class="choice-card ${labelUse===v?(v==='eval'?'selected correct':'selected wrong'):''}" data-labeluse="${v}"><span>${t}</span></button>`).join('')}</div>${feedback}</section>${ok?`<div class="split-board"><section class="split-panel dev"><header><span>用于构建与调试</span><b>160 条</b></header>${idsChips(devIndices())}<p>可以反复查看答案、参考标签、诊断结果，并据此修改模型。</p></section><div class="split-arrow">随机划分</div><section class="split-panel hold"><header><span>最后才使用</span><b>80 条</b></header>${idsChips(holdoutIndices(),true)}<p>前面不看答案，也不看参考标签。两个模型定型后才解锁。</p></section></div><div class="plain-explain"><b>为什么还要再留 80 条？</b><p>前 160 条会被你反复用于发现问题和改模型。最后换一批完全没有参与修改的数据，才能检查这种调整面对新样本是否仍然有效。</p></div><div class="next-card"><div><small>NEXT</small><b>先从几条容易解释的假设开始，搭出第一版模型。</b></div><button class="primary" id="advance">构建基础模型</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-labeluse]').forEach(b=>b.onclick=()=>{recordAttempt('labelUse',b.dataset.labeluse);state.checks.labelUse=b.dataset.labeluse;save();stage0()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(1);
}

function stage1(){
  const choice=state.checks.guess,ok=choice==='25';
  const feedback=choice===null?'':ok?`<div class="quiz-feedback correct"><b>对，25%。</b><p>四个选项只有一个正确答案。完全不会、等概率随机选一个时，答对概率就是 1/4。</p></div>`:`<div class="quiz-feedback"><b>再看一下“四选一”。</b><p>这里只有一个正确选项，而且我们先假定完全不会时四个选项被等概率选择。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 02 · 第一版模型 = 一组清楚的假设</div><h1>先描述：一个人有这些能力时，通常会怎样答题？</h1><p class="stage-lead">题目需要哪些能力，由问卷设计者已经标注好。你的模型要连接两件事：候选人看不见的能力，以及我们真正观察到的答对 / 答错。</p>${skillRequirementGrid()}<div class="assumption-stack"><div><span>1</span><p><b>能力先简化成“掌握 / 未掌握”。</b>看答案之前，每项能力先从 50% 开始。</p></div><div><span>2</span><p><b>如果具备一道题所需的全部能力，通常应该答对。</b>我们先留 10% 给粗心、误读等失误，所以答对概率设为 90%。</p></div><div><span>3</span><p><b>如果缺少题目需要的能力，也可能碰巧答对。</b>先从选择题本身能给出的最朴素信息出发。</p></div></div><section class="quiz-block"><div class="quiz-number">你来定这个起点</div><h2>每道题有 4 个选项。如果一个人完全不会，只能随机选一个，他碰巧答对的概率是多少？</h2><div class="choice-grid four">${[['10','10%'],['25','25%'],['50','50%'],['75','75%']].map(([v,t])=>`<button class="choice-card ${choice===v?(v==='25'?'selected correct':'selected wrong'):''}" data-guess="${v}"><b>${t}</b></button>`).join('')}</div>${feedback}</section>${ok?`<div class="model-flow"><div><small>看不见</small><b>候选人的能力</b></div><i>→</i><div><small>根据题目标签判断</small><b>是否具备这题需要的全部能力</b></div><i>→</i><div><small>90% / 25%</small><b>答对或答错</b></div></div><div class="plain-explain strong"><b>先用这套简单规则试起来。</b><p>会做的人也可能粗心，不会的人也可能碰巧选中。先看看这几条直观规则能不能把答案和能力联系起来。</p></div><details class="question-drawer"><summary>查看 9 道题内容</summary>${questionBank()}</details><div class="next-card"><div><small>NEXT</small><b>先不用真实数据。拿一个很小的例子，看模型的推断方向合不合理。</b></div><button class="primary" id="advance">先试一下模型</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-guess]').forEach(b=>b.onclick=()=>{recordAttempt('guess',b.dataset.guess);state.checks.guess=b.dataset.guess;save();stage1()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(2);
}

function stage2(){
  const choice=state.checks.toy,ok=choice==='v';
  const toy={answers:[1,0,0,0,0,0,0,0,0]};
  const r=posterior(toy,Array(9).fill(.25),[0,3,6]);
  const feedback=choice===null?'':ok?`<div class="quiz-feedback correct"><b>对。这个答案模式最支持“言语有、逻辑和数量没有”。</b><p>Q1 答对支持言语；Q4、Q7 答错分别削弱逻辑和数量。模型会把这些证据合在一起，而不会把一次答对当成绝对证明。</p></div>`:`<div class="quiz-feedback"><b>再看一次三道题分别测什么。</b><p>这里特意选了 Q1（言语）、Q4（逻辑）、Q7（数量）三道单能力题，方便先检查推断方向。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 03 · 先用一个小例子测试行为</div><h1>如果模型连简单例子都解释不通，就不该直接上真实数据</h1><p class="stage-lead">先只看三道分别测单一能力的题。假设某人 Q1 答对、Q4 答错、Q7 答错。</p><div class="toy-answers"><div><b>Q1 · 言语</b><span class="right">✓ 答对</span></div><div><b>Q4 · 逻辑</b><span class="wrong">× 答错</span></div><div><b>Q7 · 数量</b><span class="wrong">× 答错</span></div></div><section class="quiz-block"><div class="quiz-number">先凭直觉判断</div><h2>在这三个简单证据下，哪种能力组合最合理？</h2><div class="choice-grid">${[['v','言语较可能具备；逻辑、数量较可能不具备。'],['all','三项能力都较可能具备。'],['none','三项能力都较可能不具备。']].map(([v,t])=>`<button class="choice-card ${choice===v?(v==='v'?'selected correct':'selected wrong'):''}" data-toy="${v}"><span>${t}</span></button>`).join('')}</div>${feedback}</section>${ok?`<div class="candidate-inference"><div class="candidate-head standalone"><div><small>基础模型只看这三道答案</small><h2>推断结果</h2></div></div>${abilityBars(r)}</div><div class="plain-explain"><b>这些数不是“分数”，而是模型当前的不确定性。</b><p>比如言语理解约 ${pct(r.marg[0])}，意思是：在我们刚才那组假设下，这三个答案更像是由“具备言语能力”的人产生，但仍保留不确定性。</p></div><div class="next-card"><div><small>NEXT</small><b>简单例子的行为合理。现在再看真实的 160 条建模数据本身长什么样。</b></div><button class="primary" id="advance">查看真实数据</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-toy]').forEach(b=>b.onclick=()=>{recordAttempt('toy',b.dataset.toy);state.checks.toy=b.dataset.toy;save();stage2()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(3);
}

function stage3(){
  const choice=state.checks.raw,ok=choice==='structure';
  const feedback=choice===null?'':ok?`<div class="quiz-feedback correct"><b>对。数据里有结构，不像纯随机噪声。</b><p>不同人的答题水平不同，不同题也有明显难易差别；一些错误还会在需要相似能力的题目上成组出现。</p></div>`:`<div class="quiz-feedback"><b>再横着、竖着看一遍。</b><p>如果完全随机，每一行和每一列应该都差不多。这里能看到明显的人与题之间的差异。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 04 · 上模型以前先看数据</div><h1>别急着算概率，先看看 160 个人到底怎么答的</h1><p class="stage-lead">下面每一行是一位试测者，每一列是一道题。浅色格表示答对，深色格表示答错。先从数据本身找规律。</p>${responseMatrix(devIndices())}<div class="legend-row"><span><i class="legend-box light"></i>答对</span><span><i class="legend-box dark"></i>答错</span></div><div class="side-by-side-note"><div><b>按人看</b><p>有些人几乎全对，有些人会成组地错掉几道题。</p></div><div><b>按题看</b><p>有些列明显更容易，有些列明显更难。</p></div></div><section class="quiz-block"><div class="quiz-number">先读图</div><h2>这张原始答题图更像哪一种情况？</h2><div class="choice-grid">${[['random','所有人、所有题看起来都差不多，几乎没有结构。'],['structure','不同人和不同题都有明显差异，答案里有可以被模型利用的结构。'],['perfect','只要答错一道题，就能确定缺少对应能力。']].map(([v,t])=>`<button class="choice-card ${choice===v?(v==='structure'?'selected correct':'selected wrong'):''}" data-raw="${v}"><span>${t}</span></button>`).join('')}</div>${feedback}</section>${ok?`<div class="next-card"><div><small>NEXT</small><b>现在让基础模型真正处理这 160 条数据，再用自评能力检查结果。</b></div><button class="primary" id="advance">运行第一次真实推断</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-raw]').forEach(b=>b.onclick=()=>{recordAttempt('raw',b.dataset.raw);state.checks.raw=b.dataset.raw;save();stage3()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(4);
}

function stage4(){
  const alphas=Array(9).fill(.25),choice=state.checks.first,ok=choice==='mismatch',m=metrics(devIndices(),alphas);
  const feedback=choice===null?'':ok?`<div class="quiz-feedback correct"><b>对。模型能抓到一部分结构，但参考矩阵里仍然有不少地方对不上。</b><p>这已经足够提醒我们：先别急着相信最终能力概率，应该检查模型哪里没有解释好数据。</p></div>`:`<div class="quiz-feedback"><b>再比较两张矩阵，而不是只看个别格子。</b><p>如果模型已经很好，左边高概率的位置应该大体对应右边的白格；现在还有一批系统性的差异。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 05 · 第一次真实结果</div><h1>基础模型已经能做判断，但和参考结果还对不上不少地方</h1><p class="stage-lead">现在让刚才那套规则处理 160 个人的问卷答案。模型仍然只看答对 / 答错，不读取右边的自评能力；自评只在这里帮你检查推断结果是否靠谱。</p><div class="matrix-compare"><section><header><b>模型推断的能力概率</b><span>颜色越深，概率越高</span></header>${skillMatrix(devIndices(),alphas,'inferred')}</section><section><header><b>匿名自评能力</b><span>开发期近似参考</span></header>${skillMatrix(devIndices(),alphas,'reference')}</section></div><div class="metric-strip"><div><small>平均负对数概率</small><b>${m.nll.toFixed(3)}</b><span>越低越好</span></div><div><small>50% 阈值下与参考一致</small><b>${pct(m.agreement)}</b><span>只作为直观辅助</span></div></div><section class="quiz-block"><div class="quiz-number">你来判断是否值得继续检查</div><h2>把两张矩阵放在一起，你会怎么描述现在的结果？</h2><div class="choice-grid">${[['perfect','已经几乎完全一致，可以直接部署。'],['mismatch','能看到一些对应关系，但还有不少明显不一致，应该继续检查模型。'],['useless','完全没有任何规律，问卷本身毫无信息。']].map(([v,t])=>`<button class="choice-card ${choice===v?(v==='mismatch'?'selected correct':'selected wrong'):''}" data-first="${v}"><span>${t}</span></button>`).join('')}</div>${feedback}</section>${ok?`<div class="next-card"><div><small>NEXT</small><b>结果不理想时，先别急着改规则。先分清是数据、模型，还是推断过程出了问题。</b></div><button class="primary" id="advance">开始排查</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-first]').forEach(b=>b.onclick=()=>{recordAttempt('first',b.dataset.first);state.checks.first=b.dataset.first;save();stage4()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(5);
}

function stage5(){
  const choice=state.checks.debug,ok=choice==='synthetic',syn=syntheticSet();
  const feedback=choice===null?'':ok?`<div class="quiz-feedback correct"><b>对。这能把“推断程序的问题”和“模型假设的问题”分开。</b><p>如果数据就是按我们的模型规则生成的，而且真实能力是已知的，模型应该能把这些能力大致推回来。</p></div>`:`<div class="quiz-feedback"><b>这样还不能把模型和推断分开。</b><p>我们需要一份“明确遵守模型假设”的数据，这样如果仍然推断失败，才有理由怀疑推断过程本身。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 06 · 坏数据、坏模型，还是坏推断？</div><h1>先检查推断过程本身有没有出错</h1><p class="stage-lead">真实数据和参考标签对不上，可能有三类原因：数据有问题、模型假设不对、或者推断算法/代码出了问题。我们已经看过原始数据，没有发现明显录入异常。接下来先把“推断有没有坏”单独拿出来测。</p><section class="quiz-block"><div class="quiz-number">怎么做这个检查？</div><h2>哪种办法最能单独检验推断过程？</h2><div class="choice-grid">${[['synthetic','让模型自己生成一批“能力已知”的模拟答题，再看推断能不能把这些能力找回来。'],['more','直接再收集更多真实问卷，如果结果更稳定就算通过。'],['ground','把真实自评能力直接输入模型，让模型照着答案输出。']].map(([v,t])=>`<button class="choice-card ${choice===v?(v==='synthetic'?'selected correct':'selected wrong'):''}" data-debug="${v}"><span>${t}</span></button>`).join('')}</div>${feedback}</section>${ok?`<div class="plain-explain strong"><b>现在生成 24 个模拟人。</b><p>这次我们先随机决定他们真正具备哪些能力，再完全按照当前基础模型的规则生成答题：有全部所需能力时 90% 答对；缺少能力时按四选一随机选择，25% 答对。这里的“真实能力”是我们亲手生成的，所以确实知道答案。</p></div><div class="matrix-compare"><section><header><b>推断出来的能力</b><span>模型只看模拟答题</span></header>${syntheticSkillMatrix(syn.people,'inferred')}</section><section><header><b>生成数据时的真实能力</b><span>这次是真正已知</span></header>${syntheticSkillMatrix(syn.people,'truth')}</section></div><div class="metric-strip"><div><small>50% 阈值下一致率</small><b>${pct(syn.agreement)}</b><span>模拟数据严格遵守模型</span></div><div><small>平均负对数概率</small><b>${syn.nll.toFixed(3)}</b><span>仍会有统计不确定性</span></div></div><div class="plain-explain"><b>这个检查说明什么？</b><p>当数据真的符合模型假设时，推断能把能力大体找回来。它不会 100% 一致，因为 9 道题本身仍然包含随机性和信息不足；但这说明真实数据上的问题更值得从<strong>模型假设</strong>里找。</p></div><div class="next-card"><div><small>NEXT</small><b>既然推断能工作，接下来直接问：模型到底在哪些题上和现实不一致？</b></div><button class="primary" id="advance">诊断模型假设</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-debug]').forEach(b=>b.onclick=()=>{recordAttempt('debug',b.dataset.debug);state.checks.debug=b.dataset.debug;save();stage5()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(6);
}

function diagnosticRows(){
  const d=questionPredictionDiagnostics(Array(9).fill(.25));
  return d.map(x=>`<div class="pred-row"><div><b>${ITEM_DEFAULTS[x.j].id}</b><span>${ITEM_DEFAULTS[x.j].label}</span></div><div class="paired-bars"><span><i style="--w:${Math.round(x.predicted*100)}%"></i><small>模型预计 ${pct(x.predicted)}</small></span><span class="actual"><i style="--w:${Math.round(x.actual*100)}%"></i><small>实际 ${pct(x.actual)}</small></span></div><strong class="${x.diff>=0?'up':'down'}">${pp(x.diff)}</strong></div>`).join('');
}
function stage6(){
  const pattern=state.checks.diagnosePattern,cause=state.checks.diagnoseCause,patternOK=pattern==='vary',causeOK=cause==='guess';
  const pf=pattern===null?'':patternOK?`<div class="quiz-feedback correct"><b>对。偏差和“具体是哪道题”有关。</b><p>例如有些题实际答对比例明显高于模型预计，有些又低于模型预计。这种逐题差异不会被一个总体平均值解释掉。</p></div>`:`<div class="quiz-feedback"><b>再看每一行最后的差值。</b><p>如果只是所有人整体更强或更弱，各题应该大致同方向偏移；现在不同题的方向和幅度都不一样。</p></div>`;
  const cf=cause===null?'':causeOK?`<div class="quiz-feedback correct"><b>对。现在最值得回头检查的，是“不会时每道题都按 25% 处理”这条规则。</b><p>25% 是随机乱猜的合理起点，但真实的人会排除选项、利用经验或题干线索，因此不同题可能有不同的实际猜对概率。</p></div>`:`<div class="quiz-feedback"><b>这也可能影响结果，但和刚才的“逐题差异”没有最直接的对应。</b><p>先找一条会强迫不同题共享同一种行为的假设。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 07 · 用参考能力反推模型哪里不对</div><h1>暂时把自评能力当作已知，问模型：这些人应该怎样答每一道题？</h1><p class="stage-lead">这里自评能力只用于<strong>诊断</strong>。对每个人，我们暂时告诉模型“参考标签说他有哪些能力”，然后计算基础模型预计这道题会有多少人答对，再和真实答题比例比较。</p><div class="plain-explain"><b>这一步为什么有用？</b><p>如果我们先固定“这个人有哪些能力”，就能把问题缩小成：模型关于<strong>能力如何产生答题结果</strong>的那部分假设，和真实数据到底差在哪里。</p></div><div class="pred-card"><header><b>每道题：模型预计答对比例 vs 实际答对比例</b><span>蓝色 = 模型预计 · 绿色 = 真实数据</span></header>${diagnosticRows()}</div><section class="quiz-block"><div class="quiz-number">先观察，再解释</div><h2>这张逐题对比里，最明显的模式是什么？</h2><div class="choice-grid">${[['same','9 道题都差不多，误差只是随机波动。'],['vary','不同题的偏差差很多：有些实际更容易答对，有些实际更难。'],['labels','所有参考能力标签显然都错了。']].map(([v,t])=>`<button class="choice-card ${pattern===v?(v==='vary'?'selected correct':'selected wrong'):''}" data-pattern="${v}"><span>${t}</span></button>`).join('')}</div>${pf}</section>${patternOK?`<section class="quiz-block"><div class="quiz-number">回头检查最初的假设</div><h2>回头看第一版模型，哪条规则最值得重新检查？</h2><div class="choice-grid">${[['prior','每项能力在看答案前先从 50% 开始。'],['guess','缺少题目所需能力时，每道题都按 25% 的答对概率处理。'],['binary','能力被简化成“掌握 / 未掌握”。']].map(([v,t])=>`<button class="choice-card ${cause===v?(v==='guess'?'selected correct':'selected wrong'):''}" data-cause="${v}"><span>${t}</span></button>`).join('')}</div>${cf}</section>`:''}${causeOK?`<div class="discovery-card"><small>你刚才自己定位到的问题</small><h2>四选一随机选中确实是 25%；但真实的人未必是在“完全随机”地选。</h2><p>有人会凭经验判断，有人能排除一两个明显错误的选项，有些题本身还会提供更多线索。这样一来，即使缺少对应能力，不同题被答对的概率也可能不一样。</p></div><div class="next-card"><div><small>NEXT</small><b>只放松这一条假设：让每道题学习自己的猜对概率。</b></div><button class="primary" id="advance">调整模型</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-pattern]').forEach(b=>b.onclick=()=>{recordAttempt('diagnosePattern',b.dataset.pattern);state.checks.diagnosePattern=b.dataset.pattern;if(b.dataset.pattern!=='vary')state.checks.diagnoseCause=null;save();stage6()});document.querySelectorAll('[data-cause]').forEach(b=>b.onclick=()=>{recordAttempt('diagnoseCause',b.dataset.cause);state.checks.diagnoseCause=b.dataset.cause;save();stage6()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(7);
}

function alphaCards(){
  const flex=learnItems();
  return `<div class="alpha-grid learned">${flex.stats.map((s,j)=>{const [lo,hi]=betaMidInterval(s.a,s.b);return `<div><header><b>${ITEM_DEFAULTS[j].id}</b><span>${ITEM_DEFAULTS[j].label}</span></header><strong>${s.mean.toFixed(3)}</strong><small>约 50% 不确定区间 ${lo.toFixed(2)}–${hi.toFixed(2)}</small><div class="interval-track"><i style="--l:${lo*100}%;--r:${hi*100}%;--m:${s.mean*100}%"></i></div></div>`}).join('')}</div>`;
}
function stage7(){
  const choice=state.checks.flex,ok=choice==='item',flex=learnItems(),baseA=Array(9).fill(.25),devBase=metrics(devIndices(),baseA),devFlex=metrics(devIndices(),flex.means);
  const feedback=choice===null?'':ok?`<div class="quiz-feedback correct"><b>对。只放松刚才有证据支持的那一条规则。</b><p>每道题有自己的 αⱼ，但在看数据以前，我们对每一道题都仍然以 25% 为合理起点。</p></div>`:`<div class="quiz-feedback"><b>这个改法没有直接对应刚才看到的逐题差异。</b><p>先只改已经有证据支持的那一处，其他规则保持不变。</p></div>`;
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 08 · 让数据学习题目之间的差异</div><h1>把“不会时仍然答对”从一个规则，变成可以从数据学习的量</h1><p class="stage-lead">现在把第 j 道题在“缺少所需能力时仍然答对”的概率记作 α<sub>j</sub>。不同题可以有不同的 α<sub>j</sub>，但在看数据之前，每一道题都从四选一的 25% 附近开始。</p><section class="quiz-block"><div class="quiz-number">只改一条假设</div><h2>基于刚才的诊断，哪种修改最直接？</h2><div class="choice-grid">${[['allhigh','把所有题都改成 50% 的猜对概率。'],['item','让每道题都有自己的猜对概率，并都从 25% 这个合理起点开始。'],['labels','把自评能力作为模型输入，直接帮助推断。']].map(([v,t])=>`<button class="choice-card ${choice===v?(v==='item'?'selected correct':'selected wrong'):''}" data-flex="${v}"><span>${t}</span></button>`).join('')}</div>${feedback}</section>${ok?`<div class="plain-explain strong"><b>学习这些 αⱼ 时，仍然不能使用自评能力。</b><p>模型只看 160 个人的问卷答案和题目需要哪些能力，然后同时推断“人可能有哪些能力”以及“每道题在缺少相关能力时有多容易被答对”。自评标签继续只负责检查结果。</p></div><div class="prior-banner"><div><small>每道题的初始判断</small><b>Beta(2.5, 7.5)</b><span>先验平均值 = 0.25</span></div><p>25% 仍然来自四选一随机猜。区别在于，现在它只是开始看数据前的合理判断；如果某道题的数据持续显示更容易或更难被猜对，α<sub>j</sub> 就可以随数据改变。</p></div>${alphaCards()}<div class="matrix-compare triple"><section><header><b>原始基础模型</b><span>不会时每题按 25% 处理</span></header>${skillMatrix(devIndices(),baseA,'inferred')}</section><section><header><b>调整后的模型</b><span>每题学习自己的 αⱼ</span></header>${skillMatrix(devIndices(),flex.means,'inferred')}</section><section><header><b>自评参考</b><span>没有参与 αⱼ 学习</span></header>${skillMatrix(devIndices(),flex.means,'reference')}</section></div><div class="metric-compare"><section><small>建模数据 · 平均负对数概率</small><div><span>基础模型</span><b>${devBase.nll.toFixed(3)}</b></div><div class="better"><span>逐题 αⱼ</span><b>${devFlex.nll.toFixed(3)}</b></div></section><section><small>建模数据 · AUC</small><div><span>基础模型</span><b>${devBase.auc.toFixed(3)}</b></div><div class="better"><span>逐题 αⱼ</span><b>${devFlex.auc.toFixed(3)}</b></div></section></div><div class="plain-explain alert"><b>这里还不能下最终结论。</b><p>你就是看着这 160 条数据发现问题、又根据它们修改模型的。更灵活的模型在这批数据上表现更好并不令人意外。两个模型现在冻结，不再调整；下一步才第一次使用那 80 条独立数据。</p></div><div class="next-card"><div><small>NEXT</small><b>解锁独立数据，比较两个已经定型的模型。</b></div><button class="primary" id="advance">开始独立检验</button></div>`:''}</article>`,notebook());
  bindNav();document.querySelectorAll('[data-flex]').forEach(b=>b.onclick=()=>{recordAttempt('flex',b.dataset.flex);state.checks.flex=b.dataset.flex;save();stage7()});const n=document.querySelector('#advance');if(n)n.onclick=()=>advance(8);
}

function stage8(){
  const flex=learnItems().means,base=metrics(holdoutIndices(),Array(9).fill(.25)),newm=metrics(holdoutIndices(),flex),cmp=holdoutComparison();
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 09 · 第一次打开独立数据</div><h1>两个模型都不再修改，现在看它们面对新样本怎么样</h1><p class="stage-lead">这 80 个人的问卷答案和自评参考，在前面的参数学习、模型诊断和结构调整中都没有被使用。现在把完全相同的答案分别输入两个模型。</p><div class="holdout-reveal">${idsChips(holdoutIndices())}<span>80 条独立记录已解锁</span></div><div class="model-results book-metrics"><section><header><span>基础模型</span><small>不会时每题按 25% 处理</small></header><div class="big-metric"><small>平均负对数概率</small><b>${base.nll.toFixed(3)}</b><span>越低越好：给参考能力更高概率会得更低分</span></div><div class="small-metric">AUC <b>${base.auc.toFixed(3)}</b> · 50% 阈值一致率 <b>${pct(base.agreement)}</b></div></section><section class="focus"><header><span>调整后的模型</span><small>每道题学习自己的 αⱼ</small></header><div class="big-metric"><small>平均负对数概率</small><b>${newm.nll.toFixed(3)}</b><span>越低越好</span></div><div class="small-metric">AUC <b>${newm.auc.toFixed(3)}</b> · 50% 阈值一致率 <b>${pct(newm.agreement)}</b></div></section></div><div class="metric-explain-grid"><div><b>负对数概率看什么？</b><p>它关心概率本身准不准。模型如果非常自信却和参考标签相反，会被罚得很重，所以它能反映“概率有没有校准好”。</p></div><div><b>AUC 看什么？</b><p>它更关心排序：真正具备某项能力的人，是否通常被排在更高的能力概率位置。它对概率绝对值是否准确没那么敏感。</p></div></div><div class="result-callout"><small>独立数据上的结果</small><b>三个指标都朝同一个方向改善</b><p>负对数概率从 ${base.nll.toFixed(3)} 降到 ${newm.nll.toFixed(3)}，AUC 从 ${base.auc.toFixed(3)} 升到 ${newm.auc.toFixed(3)}；按 50% 做判断时，与参考结果的一致率也从 ${pct1(base.agreement)} 升到 ${pct1(newm.agreement)}，相当于 240 个“人 × 能力”判断里多对了 ${Math.round((newm.agreement-base.agreement)*holdoutIndices().length*3)} 个。</p></div><div class="plain-explain"><b>为什么要同时看两个指标？</b><p>一个模型可能把人排序排得还不错，但给出的 80%、90% 这些概率本身并不可信。把概率准确性和排序表现分开看，能避免只凭一个数字判断模型。</p></div><div class="next-card"><div><small>NEXT</small><b>最后回到一个具体的人：同一份答案为什么能让${SKILLS[cmp.skill]}从 ${pct(cmp.base[cmp.skill])} 变成 ${pct(cmp.flex[cmp.skill])}？</b></div><button class="primary" id="advance">复盘一个候选人</button></div></article>`,notebook());
  bindNav();document.querySelector('#advance').onclick=()=>{state.selected=cmp.index;save();advance(9)};
}

function influenceRows(person){
  const item=learnItems().means;
  return ITEM_DEFAULTS.map((it,j)=>({j,d:item[j]-.25,answer:person.answers[j],alpha:item[j]})).sort((a,b)=>Math.abs(b.d)-Math.abs(a.d)).slice(0,5);
}
function communityPanel(){
  const s=scoreSummary();
  const hosted=Boolean(HiringCommunity?.repo?.());
  return `<section class="community-card" id="communityCard">
    <div class="community-score">
      <div><small>你的互动成绩</small><b>${s.score}</b><span>/ 100</span></div>
      <div class="score-detail"><p><strong>${s.firstCorrectCount}</strong> / ${s.totalQuestions} 个判断第一次就选对</p><p><strong>${s.correctedCount}</strong> 个判断在反馈后修正</p><small>计分方式：首次正确 100 分；根据反馈修正后 60 分；取 9 个关键判断的平均分。</small></div>
    </div>
    <div class="community-form">
      <div class="community-heading"><div><small>GAME COMMUNITY</small><h2>留下成绩和一句话</h2></div><span class="public-badge">公开 GitHub Issue</span></div>
      <p>显示名、星级和留言都可以留空。提交时会打开 GitHub 的新 Issue 页面，你可以先检查内容，再由你自己点击发布。</p>
      <div class="community-fields"><label>显示名<input id="communityNickname" maxlength="24" placeholder="例如：模型侦探"></label><label>星级<select id="communityRating"><option value="">不评分</option><option value="5">★★★★★</option><option value="4">★★★★☆</option><option value="3">★★★☆☆</option><option value="2">★★☆☆☆</option><option value="1">★☆☆☆☆</option></select></label></div>
      <label class="comment-field">留言<textarea id="communityComment" maxlength="500" rows="4" placeholder="哪一步最让你意识到模型假设需要被检查？还有哪里不够清楚？"></textarea><small><span id="commentCount">0</span>/500</small></label>
      <div class="privacy-note"><b>提交前请注意</b><p>Issue 是公开的，会显示你的 GitHub 账号。不要填写姓名、学号、联系方式等私人信息。关闭自己的 Issue 后，成绩和留言会从下一次更新的榜单中撤回。</p></div>
      <div class="community-submit"><button class="primary" id="communitySubmit" ${hosted?'':'disabled'}>${hosted?'打开 GitHub 提交页':'部署到 GitHub Pages 后可提交'}</button><span id="communitySubmitNote">${hosted?'发布后等排行榜更新，再点下面的“刷新”。':'本地打开文件时无法知道要提交到哪个仓库；部署后会自动识别。'}</span></div>
    </div>
    <div class="community-live">
      <header><div><small>PUBLIC BOARD</small><h2>玩家成绩与留言</h2></div><button class="ghost" id="communityRefresh" ${hosted?'':'disabled'}>刷新</button></header>
      <div id="communityContent" class="community-loading">${hosted?'正在读取公开记录…':'部署到 GitHub Pages 后，这里会显示本仓库的公开成绩和留言。'}</div>
    </div>
  </section>`;
}
function stars(n){return n?`<span class="stars" aria-label="${n} 星">${'★'.repeat(n)}${'☆'.repeat(5-n)}</span>`:''}
async function loadCommunity(){
  const box=document.querySelector('#communityContent');if(!box)return;
  const url=HiringCommunity?.snapshotUrl?.();if(!url){box.innerHTML='<p class="empty-community">部署到 GitHub Pages 后才能读取共享榜单。</p>';return}
  box.innerHTML='<div class="community-loading">正在读取公开记录…</div>';
  try{
    const res=await fetch(url,{cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);
    const data=await res.json(),entries=Array.isArray(data.entries)?data.entries:[],comments=Array.isArray(data.comments)?data.comments:[];
    const board=entries.length?`<div class="leaderboard"><div class="leader-row leader-head"><span>名次</span><span>玩家</span><span>成绩</span></div>${entries.slice(0,12).map(e=>`<a class="leader-row" href="${e.issueUrl}" target="_blank" rel="noopener"><b>#${e.rank}</b><span><strong>${escapeHTML(e.nickname)}</strong><small>@${escapeHTML(e.login)}</small></span><em>${e.score}</em></a>`).join('')}<p>共 ${Number(data.totalPlayers)||entries.length} 位玩家留下公开成绩。</p></div>`:`<div class="empty-community"><b>还没有公开成绩。</b><p>你可以成为第一位提交的人。</p></div>`;
    const wall=comments.length?`<div class="comment-wall"><h3>最近留言</h3>${comments.slice(0,10).map(c=>`<article><header><b>${escapeHTML(c.nickname)}</b>${stars(c.rating)}</header>${c.body?`<p>${escapeHTML(c.body)}</p>`:''}<a href="${c.issueUrl}" target="_blank" rel="noopener">查看来源 Issue</a></article>`).join('')}</div>`:`<div class="empty-community"><b>还没有留言。</b></div>`;
    const updated=data.updatedAt?new Date(data.updatedAt).toLocaleString('zh-CN'):'未知';
    box.innerHTML=`<div class="community-grid">${board}${wall}</div><div class="snapshot-time">公开记录更新时间：${updated}</div>`;
  }catch(err){box.innerHTML=`<div class="empty-community error"><b>暂时没读到排行榜。</b><p>GitHub Actions 可能还在更新，稍后再刷新即可。</p></div>`}
}
function escapeHTML(value){return String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]))}
function bindCommunity(){
  const ta=document.querySelector('#communityComment'),count=document.querySelector('#commentCount');if(ta&&count)ta.oninput=()=>count.textContent=Array.from(ta.value).length;
  const refresh=document.querySelector('#communityRefresh');if(refresh)refresh.onclick=loadCommunity;
  const submit=document.querySelector('#communitySubmit');if(submit&&!submit.disabled)submit.onclick=async()=>{
    const note=document.querySelector('#communitySubmitNote');
    try{
      const nickname=document.querySelector('#communityNickname').value,comment=document.querySelector('#communityComment').value,raw=document.querySelector('#communityRating').value,rating=raw?Number(raw):null;
      const draft=HiringCommunity.buildScoreDraft(scorePacket(),{nickname,comment,rating});
      if(draft.copyRequired){await navigator.clipboard.writeText(draft.body);note.textContent='完整记录已经复制。GitHub 页面打开后，把它粘贴到正文，再发布 Issue。'}else note.textContent='GitHub 页面已打开。检查内容后，请你自己点击 “Submit new issue”。';
      window.open(draft.url,'_blank','noopener');
    }catch(err){note.textContent=err?.message||'暂时无法生成提交记录。'}
  };
  loadCommunity();
}

function stage9(){
  const flex=learnItems().means,baseA=Array(9).fill(.25),cmp=holdoutComparison();
  if(state.selected===null||!holdoutIndices().includes(state.selected))state.selected=cmp.index;
  const p=state.data[state.selected],b=posterior(p,baseA),f=posterior(p,flex),inf=influenceRows(p);
  const rows=SKILLS.map((s,k)=>{const d=f.marg[k]-b.marg[k];return `<tr><th>${s}</th><td>${pct(b.marg[k])}</td><td>${pct(f.marg[k])}</td><td class="${d>=0?'up':'down'}">${pp(d)}</td><td>${p.self[k]?'自评具备':'自评不具备'}</td></tr>`}).join('');
  shell(progress()+`<article class="lab-card"><div class="stage-kicker">STEP 10 · 回到招聘判断本身</div><h1>答案没有变，模型对这些答案的“证据强度”变了</h1><div class="candidate-head standalone"><div><small>独立样本</small><h2>${p.id}</h2></div><select id="holdPerson">${holdoutIndices().map(i=>`<option value="${i}" ${i===state.selected?'selected':''}>${state.data[i].id}</option>`).join('')}</select></div>${state.selected===cmp.index?`<div class="example-callout"><small>先看这条变化最清楚的独立样本</small><b>参考结果：${SKILLS[cmp.skill]}${p.self[cmp.skill]?'具备':'不具备'}</b><p>基础模型给出 ${pct(cmp.base[cmp.skill])}；调整后的模型变成 ${pct(cmp.flex[cmp.skill])}，而且跨过了 50% 判断线。下面看这次变化是怎么由具体题目产生的。</p></div>`:''}<div class="answer-strip big">${p.answers.map((a,j)=>`<span class="${a?'right':'wrong'}"><small>${ITEM_DEFAULTS[j].id}</small>${a?'✓':'×'}</span>`).join('')}</div><div class="comparison-table-wrap"><table class="comparison-table"><thead><tr><th>能力</th><th>基础模型</th><th>逐题 αⱼ 模型</th><th>变化</th><th>开发期参考</th></tr></thead><tbody>${rows}</tbody></table></div><div class="plain-explain strong"><b>为什么一个“答对”在两个模型里分量不一样？</b><p>如果某道题的 αⱼ 很高，说明缺少相关能力的人也经常能答对，所以一次答对就没那么能证明能力；如果 αⱼ 很低，缺少能力的人很少答对，那么答对就会成为更强的能力证据。答错同样会因为 αⱼ 不同而改变分量。</p></div><h2 class="subhead">这位样本里，和原来 25% 规则差得最大的几道题</h2><div class="influence-list">${inf.map(x=>{let why;if(x.answer){why=x.d>0?'这题在缺少能力时也更容易答对，所以这次答对的支持力度会减弱。':'这题在缺少能力时更难答对，所以这次答对会成为更强的能力证据。'}else{why=x.d>0?'缺少能力的人也常能答对，因此一次答错没有那么强的负面含义。':'缺少能力的人通常更难答对，因此这次答错更符合“缺少能力”的模式。'}return `<div><header><b>${ITEM_DEFAULTS[x.j].id} · ${ITEM_DEFAULTS[x.j].label}</b><span class="${x.answer?'right':'wrong'}">${x.answer?'答对':'答错'}</span></header><p>原来按 0.250；这道题学到的 α<sub>${x.j+1}</sub> = ${x.alpha.toFixed(3)}。${why}</p></div>`}).join('')}</div><div class="final-insight"><small>这次实验的完整逻辑</small><h2>从一个能解释的简单模型开始 → 用小例子确认推断方向 → 看真实数据 → 用参考能力发现结果有偏差 → 用模拟数据排除推断故障 → 逐题比较“模型预计”和“实际答题”定位假设 → 让每道题学习自己的猜对概率 → 最后用独立数据检验修改是否真的帮助能力推断。</h2></div>${communityPanel()}<div class="report-actions"><button class="primary" id="backEval">回到独立检验</button><button class="secondary" id="sources">查看实验说明</button></div></article>`,notebook());
  bindNav();document.querySelector('#holdPerson').onchange=e=>{state.selected=+e.target.value;save();stage9()};document.querySelector('#backEval').onclick=()=>advance(8);document.querySelector('#sources').onclick=notes;bindCommunity();
}

function notes(){
  modalBody.innerHTML=`<div class="eyebrow">实验说明</div><h2>这版模型实验在做什么？</h2><p><b>目标：</b>只根据 9 道四选一问卷的答题结果，推断言语理解、逻辑判断和数量关系三项潜在能力。</p><p><b>参考标签：</b>历史试测者另行报告自己认为掌握哪些能力。它只是近似 ground truth，可能存在高估或低估；模型推断和 α 学习都不会读取这些标签，它们只用于开发期诊断与评价。</p><p><b>基础模型：</b>每项能力是二元变量，先验为 50%；具备一道题所需全部能力时，答对概率为 90%；缺少能力时，先按四选一随机选择来处理，因此答对概率为 25%。这两条规则先直接用于推断。</p><p><b>诊断：</b>先用模型自己生成的模拟数据检查推断过程；再把开发期参考能力暂时当作已知，比较每道题“模型预计答对比例”和“实际答对比例”，定位模型假设与真实数据的差异。</p><p><b>调整：</b>让每道题拥有自己的 α<sub>j</sub>。所有 α<sub>j</sub> 使用相同的 Beta(2.5,7.5) 先验，平均值为 0.25；它们仅从 160 条建模问卷答案中学习。</p><p><b>最终检验：</b>80 条独立记录在模型构建与修改期间完全锁住。两个模型冻结后，才用这些数据比较平均负对数概率、AUC 和具体候选人的能力后验差异。</p><p><b>教学边界：</b>这里的问卷、答题和参考标签均为模拟数据。真实招聘场景还需要效标效度、公平性、测量误差、隐私和合规评估，不能把这个简化实验直接用于真实录用决策。</p>`;
  modal.showModal();
}
function renderStage(){state.screen='lab';save();[stage0,stage1,stage2,stage3,stage4,stage5,stage6,stage7,stage8,stage9][state.stage]()}
function reset(){localStorage.removeItem(KEY);state=cloneDefault();cache={};intro()}
document.querySelector('#homeBtn').onclick=intro;
document.querySelector('#scienceBtn').onclick=notes;
document.querySelector('#resetBtn').onclick=()=>{if(confirm('清除当前实验进度，重新开始？'))reset()};
document.querySelector('.modal-close').onclick=()=>modal.close();modal.onclick=e=>{if(e.target===modal)modal.close()};
if(state.screen==='lab')renderStage();else intro();
