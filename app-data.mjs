export function bytes(text){return Uint8Array.from(atob(text.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));}
export function validateArticle(a){
 if(!a||typeof a.t!=='string'||typeof a.s!=='string'||a.t.length>500||a.s.length>20000||!Array.isArray(a.r)||a.r.length>30)throw Error('新闻格式不正确');
 return {id:typeof a.id==='string'?a.id:null,t:a.t,s:a.s,w:typeof a.w==='string'?a.w:'',c:typeof a.c==='string'?a.c:'私人新闻',d:typeof a.d==='string'?a.d:'',r:a.r.filter(r=>Array.isArray(r)&&typeof r[1]==='string').map(r=>[String(r[0]||''),r[1],String(r[2]||'')])};
}
export async function decryptFeed(envelope,key){
 if(envelope.version!==1||typeof envelope.data!=='string'||envelope.data.length>8000000)throw Error('同步文件格式不正确');
 const secret=await crypto.subtle.importKey('raw',bytes(key),'AES-GCM',false,['decrypt']);
 const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(envelope.iv)},secret,bytes(envelope.data));
 const feed=JSON.parse(new TextDecoder().decode(plain));if(!Array.isArray(feed.items)||feed.items.length>100)throw Error('新闻数量无效');
 return {updatedAt:feed.updatedAt,items:feed.items.map(validateArticle)};
}
export async function decodeArticle(hash){
 if(!hash.startsWith('v1.')||hash.length>16000)throw Error('阅读链接不正确');
 if(typeof DecompressionStream==='undefined')throw Error('请更新 iPhone 系统后重试');
 const reader=new Blob([bytes(hash.slice(3))]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
 const parts=[];let total=0;while(true){const r=await reader.read();if(r.done)break;total+=r.value.length;if(total>60000){await reader.cancel();throw Error('文章过长');}parts.push(r.value);}
 return validateArticle(JSON.parse(await new Blob(parts).text()));
}
export async function articleId(a){
 // Same article received through Bark and through the feed must not duplicate.
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([a.t,a.d,a.s])));
 return Array.from(new Uint8Array(digest)).slice(0,12).map(x=>x.toString(16).padStart(2,'0')).join('');
}
