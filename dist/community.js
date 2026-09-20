(function(){
  const APP='hiring-model-lab', FENCE='hiring-model-lab';
  function repo(){
    try{
      const configured=document.querySelector('meta[name=\"github-repository\"]')?.content?.trim();
      if(configured&&/^[^/]+\/[^/]+$/.test(configured))return configured;
      const host=location.hostname.toLowerCase();
      if(host.endsWith('.github.io')){
        const owner=host.slice(0,-'.github.io'.length);
        const seg=location.pathname.split('/').filter(Boolean)[0];
        return seg ? `${owner}/${seg}` : `${owner}/${owner}.github.io`;
      }
    }catch{}
    return null;
  }
  function scoreMarks(marks){
    if(typeof marks!=='string'||marks.length!==9||!/^[fr]+$/.test(marks))return null;
    const firstCorrectCount=[...marks].filter(x=>x==='f').length;
    const correctedCount=9-firstCorrectCount;
    return {score:Math.round((100*firstCorrectCount+60*correctedCount)/9),firstCorrectCount,correctedCount,totalQuestions:9};
  }
  function clean(value,max){
    const s=String(value??'').normalize('NFC').trim();
    return Array.from(s).length<=max ? s : null;
  }
  function buildScoreDraft(packet,{nickname='',comment='',rating=null}={}){
    const repository=repo();
    if(!repository)throw new Error('请先部署到 GitHub Pages；部署后游戏会自动识别仓库。');
    const n=clean(nickname,24), c=clean(comment,500);
    if(n===null||c===null||!(rating===null||(Number.isInteger(rating)&&rating>=1&&rating<=5)))throw new Error('显示名最多24字，留言最多500字，星级为1–5。');
    const stats=packet&&packet.version===1?scoreMarks(packet.marks):null;
    if(!stats)throw new Error('成绩记录还没有准备好。');
    const record={app:APP,version:1,kind:'score',nickname:n,comment:c,rating,packet};
    const body=[
      `我完成了《招聘实验室》，本次互动成绩为 **${stats.score} / 100**。`,
      '',
      '本帖公开发布后，GitHub账号、显示名、成绩、星级与留言会进入游戏社区。关闭本帖可从下次更新的榜单中撤回。成绩用于课程互动，不作为正式考核凭证。',
      '',
      '下面是游戏生成的提交记录；请保留记录格式。',
      '',
      `\`\`\`${FENCE}`,
      JSON.stringify(record,null,2),
      '```',
      ''
    ].join('\n');
    const url=new URL(`https://github.com/${repository}/issues/new`);
    url.searchParams.set('template','score.md');
    url.searchParams.set('title','成绩与留言 · 招聘实验室');
    url.searchParams.set('body',body);
    const copyRequired=url.href.length>7000;
    if(copyRequired)url.searchParams.delete('body');
    return {url:url.href,body,copyRequired,stats,repository};
  }
  function snapshotUrl(){
    const repository=repo();
    return repository ? `https://raw.githubusercontent.com/${repository}/main/community.json?ts=${Date.now()}` : null;
  }
  window.HiringCommunity={repo,scoreMarks,buildScoreDraft,snapshotUrl};
})();
