const $=id=>document.getElementById(id);const doc=document.documentElement;
function remember(k,v){try{localStorage.setItem(k,v);}catch{}}
try{doc.dataset.size=localStorage.getItem('reader-size')||'normal';doc.dataset.theme=localStorage.getItem('reader-theme')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');}catch{}
$('size').onclick=()=>{const sizes=['normal','large','small'];doc.dataset.size=sizes[(sizes.indexOf(doc.dataset.size)+1)%3];remember('reader-size',doc.dataset.size);};
$('theme').onclick=()=>{doc.dataset.theme=doc.dataset.theme==='dark'?'light':'dark';remember('reader-theme',doc.dataset.theme);};
$('top').onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
function progress(){const height=doc.scrollHeight-innerHeight;$('progress').value=height>0?Math.min(100,100*scrollY/height):100;}addEventListener('scroll',progress,{passive:true});addEventListener('resize',progress);
async function decode(){
 if(!location.hash)return;
 try{
  const encoded=location.hash.slice(1);if(!encoded.startsWith('v1.')||encoded.length>16000)throw Error('链接格式不正确');
  const compressed=Uint8Array.from(atob(encoded.slice(3).replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  if(typeof DecompressionStream==='undefined')throw Error('浏览器版本过旧，请用更新后的 Safari 打开');
  const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));const reader=stream.getReader();const chunks=[];let total=0;
  while(true){const r=await reader.read();if(r.done)break;total+=r.value.byteLength;if(total>60000){await reader.cancel();throw Error('内容超过阅读页限制');}chunks.push(r.value);}
  const article=JSON.parse(await new Blob(chunks).text());
  if(typeof article.t!=='string'||typeof article.s!=='string'||!Array.isArray(article.r))throw Error('正文不完整');
  $('title').textContent=article.t;document.title=article.t+' · 私享新闻';$('category').textContent=article.c||'私人新闻简报';
  const date=new Date(article.d);$('date').textContent=Number.isNaN(+date)?'':date.toLocaleString('zh-CN',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'})+' 整理';
  $('duration').textContent='约 '+Math.max(1,Math.ceil((article.s.length+(article.w||'').length)/400))+' 分钟阅读';
  const paragraphs=article.s.split(/\n\s*\n/);for(const text of paragraphs){const p=document.createElement('p');p.textContent=text;$('body').append(p);}
  $('why').textContent=article.w||'';$('whySection').hidden=!article.w;
  for(const ref of article.r.slice(0,15)){
   let url;try{url=new URL(ref[1]);if(!['http:','https:'].includes(url.protocol))continue;}catch{continue;}
   const li=document.createElement('li');const a=document.createElement('a');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=ref[0]||url.hostname;const small=document.createElement('small');small.textContent=url.hostname+(ref[2]?' · '+ref[2]:'');li.append(a,small);$('sources').append(li);
  }
  $('empty').hidden=true;$('article').hidden=false;progress();
 }catch(e){$('emptyText').textContent='暂时无法打开这篇新闻：'+e.message+'。请重新点击 Bark 中的完整阅读链接。';}
}decode();
