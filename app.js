import {decryptFeed,decodeArticle,articleId} from './app-data.mjs';
const $=id=>document.getElementById(id);const doc=document.documentElement;
const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
function save(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{message('手机存储空间不足，本次内容可能无法离线保存。');return false;}}
let library=read('news-library',[]);if(!Array.isArray(library))library=[];
let favorites=new Set(read('news-favorites',[]));let current=null;let page='home';let syncing=false;
let connection=read('news-connection','');let lastSync=read('news-updated','');
function message(text){$('notice').textContent=text;}
doc.dataset.theme=read('news-theme','')||(matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light');
doc.dataset.size=read('news-size','normal');
function date(value){const d=new Date(value);return Number.isNaN(+d)?'':d.toLocaleString('zh-CN',{month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});}
function status(){
 $('connectionStatus').textContent=connection?'已连接私人新闻库':'尚未连接新闻库';
 $('syncStatus').textContent=lastSync?'上次同步 '+date(lastSync):'连接后，最新新闻会出现在这里';
 $('installHelp').hidden=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
 $('offline').hidden=navigator.onLine;
}
function renderList(){
 const q=$('search').value.trim().toLowerCase();const items=library.filter(a=>(page!=='favorites'||favorites.has(a.id))&&(!q||(a.t+a.s+a.c).toLowerCase().includes(q)));
 $('listTitle').textContent=page==='favorites'?'留给下次的好内容':'今天，读点值得的。';
 $('listCount').textContent=`${items.length} 篇${page==='favorites'?'收藏':'新闻'}`;
 $('newsList').replaceChildren();
 for(const a of items){const button=document.createElement('button');button.className='news-card';
  const meta=document.createElement('small');meta.textContent=a.c+' · '+date(a.d)+(favorites.has(a.id)?' · 已收藏':'');
  const title=document.createElement('h2');title.textContent=a.t;
  const preview=document.createElement('p');preview.textContent=a.s.slice(0,100)+(a.s.length>100?'…':'');
  const foot=document.createElement('span');foot.textContent='阅读全文 ↗';button.append(meta,title,preview,foot);button.onclick=()=>{location.hash='article/'+a.id;};$('newsList').append(button);
 }
 $('emptyList').hidden=items.length>0;
 $('emptyList').textContent=q?'没有匹配的新闻。':page==='favorites'?'读到想保留的内容，点“收藏”就会出现在这里。':connection?'暂时没有新闻。点“同步”；云端生成新闻后，发布可能需要几分钟。':'先到“设置”粘贴私人连接码，或导入 Bark 的完整阅读链接。';
}
function showPage(name){page=name;current=null;$('article').hidden=true;$('library').hidden=name==='settings';$('settings').hidden=name!=='settings';$('bottomNav').hidden=false;
 for(const b of document.querySelectorAll('[data-page]')){b.setAttribute('aria-current',b.dataset.page===name?'page':'false');}
 document.title='私享新闻';status();if(name!=='settings')renderList();window.scrollTo(0,0);
}
function showArticle(a){current=a;$('library').hidden=true;$('settings').hidden=true;$('article').hidden=false;$('bottomNav').hidden=false;
 $('title').textContent=a.t;document.title=a.t+' · 私享新闻';$('category').textContent=a.c;$('date').textContent=date(a.d)+' 整理';$('duration').textContent='约 '+Math.max(1,Math.ceil((a.s.length+a.w.length)/400))+' 分钟阅读';
 $('body').replaceChildren();for(const text of a.s.split(/\n\s*\n/)){const p=document.createElement('p');p.textContent=text;$('body').append(p);}
 $('why').textContent=a.w;$('whySection').hidden=!a.w;$('sources').replaceChildren();
 for(const ref of a.r){let url;try{url=new URL(ref[1]);if(!['http:','https:'].includes(url.protocol)||url.username||url.password)continue;}catch{continue;}
 const li=document.createElement('li'),link=document.createElement('a'),small=document.createElement('small');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';link.textContent=ref[0]||url.hostname;small.textContent=url.hostname+(ref[2]?' · '+ref[2]:'');li.append(link,small);$('sources').append(li);}
 $('favorite').textContent=favorites.has(a.id)?'已收藏 ♥':'收藏 ♡';$('favorite').setAttribute('aria-pressed',String(favorites.has(a.id)));window.scrollTo(0,0);progress();
}
async function merge(items){
 const map=new Map(library.map(a=>[a.id,a]));for(const a of items){a.id=await articleId(a);map.set(a.id,a);}
 library=[...map.values()].sort((a,b)=>(Date.parse(b.d)||0)-(Date.parse(a.d)||0));
 const kept=library.filter(a=>favorites.has(a.id));const ordinary=library.filter(a=>!favorites.has(a.id)).slice(0,100);library=[...kept,...ordinary].sort((a,b)=>(Date.parse(b.d)||0)-(Date.parse(a.d)||0));save('news-library',library);
}
async function sync(){
 if(syncing)return;if(!connection){message('请先在设置中粘贴私人连接码。');return;}
 syncing=true;$('sync').disabled=true;message('正在同步新闻…');
 try{const r=await fetch('./feed.json',{cache:'no-store',signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('暂时无法读取新闻库');const payload=await r.text();if(payload.length>8000000)throw Error('新闻库过大');const feed=await decryptFeed(JSON.parse(payload),connection);await merge(feed.items);lastSync=feed.updatedAt;save('news-updated',lastSync);message(`同步完成，共 ${feed.items.length} 篇新闻。新闻库通常每 15 分钟检查发布，繁忙时可能延迟。`);if(!current&&page!=='settings')renderList();}
 catch(e){message(navigator.onLine?'同步未完成，请检查连接码或稍后重试。已保存的新闻仍可阅读。':'当前离线，可以继续阅读已保存的新闻。');}
 finally{syncing=false;$('sync').disabled=false;status();}
}
async function route(){try{
 const hash=location.hash.slice(1);
 if(hash.startsWith('connect=')){
  const key=hash.slice(8);if(!/^[A-Za-z0-9_-]{43}$/.test(key))throw Error('连接码格式不正确');
  // The secret stays in the fragment, never in HTTP requests or the manifest.
  connection=key;save('news-connection',key);history.replaceState(null,'',location.pathname+'#settings');showPage('settings');$('pairCode').value=key;message('已连接。添加到主屏幕后若提示未连接，复制此连接码，在桌面 App 设置中粘贴一次。');await sync();return;
 }
 if(hash.startsWith('v1.')){const a=await decodeArticle(hash);await merge([a]);history.replaceState(null,'',location.pathname+'#article/'+a.id);showArticle(a);return;}
 if(hash.startsWith('article/')){const a=library.find(x=>x.id===hash.slice(8));if(a){showArticle(a);return;}message('这篇新闻尚未保存在此窗口，请同步新闻库或导入阅读链接。');}
 showPage(hash==='favorites'?'favorites':hash==='settings'?'settings':'home');
 }catch(e){message(e.message);showPage('home');}}
$('sync').onclick=sync;
$('size').onclick=()=>{const sizes=['normal','large','small'];doc.dataset.size=sizes[(sizes.indexOf(doc.dataset.size)+1)%3];save('news-size',doc.dataset.size);};
$('theme').onclick=()=>{doc.dataset.theme=doc.dataset.theme==='dark'?'light':'dark';save('news-theme',doc.dataset.theme);};
$('search').oninput=renderList;
$('favorite').onclick=()=>{if(!current)return;if(favorites.has(current.id))favorites.delete(current.id);else favorites.add(current.id);save('news-favorites',[...favorites]);$('favorite').textContent=favorites.has(current.id)?'已收藏 ♥':'收藏 ♡';$('favorite').setAttribute('aria-pressed',String(favorites.has(current.id)));};
$('connectForm').onsubmit=async e=>{e.preventDefault();const value=$('pairCode').value.trim();const key=value.includes('#connect=')?value.split('#connect=')[1]:value;if(!/^[A-Za-z0-9_-]{43}$/.test(key)){message('请粘贴完整的私人连接码，或首次连接链接。');return;}connection=key;save('news-connection',key);$('pairCode').value='';await sync();};
$('copyCode').onclick=async()=>{if(!connection){message('请先连接新闻库。');return;}try{await navigator.clipboard.writeText(connection);message('连接码已复制，请勿转发。');}catch{$('pairCode').value=connection;$('pairCode').type='text';$('pairCode').select();message('请长按输入框复制连接码。');}};
$('importForm').onsubmit=async e=>{e.preventDefault();try{const url=new URL($('importLink').value.trim());const a=await decodeArticle(url.hash.slice(1));await merge([a]);$('importLink').value='';location.hash='article/'+a.id;}catch(e){message('无法导入：'+e.message);}};
function progress(){const height=doc.scrollHeight-innerHeight;$('progress').value=current&&height>0?Math.min(100,100*scrollY/height):0;}
$('top').onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});
addEventListener('scroll',progress,{passive:true});addEventListener('resize',progress);addEventListener('hashchange',()=>void route());addEventListener('offline',status);addEventListener('online',()=>{status();void sync();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&connection)void sync();});
if('serviceWorker' in navigator){navigator.serviceWorker.register('./sw.js').then(()=>{$('offlineStatus').textContent='离线阅读已启用；已保存的新闻可离线打开。';}).catch(()=>{$('offlineStatus').textContent='离线功能暂未就绪，请联网打开一次后重试。';});}
await route();status();if(connection)void sync();
