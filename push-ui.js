import {PUSH_SERVER,VAPID_PUBLIC} from './push-config.js';
const $=id=>document.getElementById(id);
const supported='serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),x=>x.charCodeAt(0));
const encode=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
let registration=null,busy=false;
function message(s){$('pushStatus').textContent=s;}
function connection(){try{return JSON.parse(localStorage.getItem('news-connection'));}catch{return null;}}
async function api(path,subscription){
 const key=connection();if(!/^[A-Za-z0-9_-]{43}$/.test(key||''))throw Error('请先在下方连接私人新闻库。');
 const token=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode('private-news/push/v1:'+key)));
 let r;try{r=await fetch(PUSH_SERVER+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({subscription}),signal:AbortSignal.timeout(20000)});}catch{throw Error('暂时连不上通知设置服务，尚未完成云端连接。请换网络后重试；Bark 仍然保留。');}
 const data=await r.json();if(!r.ok)throw Error(data.error||'通知设置未保存');return data;
}
async function run(action){if(busy)return;busy=true;try{await action();}catch(e){message(e.message||'操作未完成，请重试。');}finally{busy=false;}}
$('enablePush').onclick=()=>{
 if(!supported||!standalone){message('请从 iPhone 主屏幕打开“私享新闻”后开启通知，需要 iOS 16.4 或更新版本。');return;}
 if(!connection()){message('请先在下方连接私人新闻库。');return;}
 if(!registration){message('App 正在准备，请稍等几秒再点。');return;}
 if(Notification.permission==='denied'){message('通知被关闭了。请到 iPhone 设置 → 通知 → 私享新闻，开启允许通知后再试。');return;}
 // Request synchronously in the tap handler: iOS requires a user gesture.
 const permission=Notification.requestPermission();
 void run(async()=>{if(await permission!=='granted')throw Error('没有开启通知；你可以稍后再试。');
  message('正在连接 App 通知…');let subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decode(VAPID_PUBLIC)});
  await api('/push/subscribe',subscription.toJSON());
  message('App 通知已连接。请点“发送锁屏测试”，随后锁屏等待。Bark 暂时同时保留。');
 });
};
$('testPush').onclick=()=>void run(async()=>{const s=await registration?.pushManager.getSubscription();if(!s)throw Error('请先开启 App 通知。');const data=await api('/push/test',s.toJSON());message(data.note+' 收到后点通知，应直接进入私享新闻。');});
$('disablePush').onclick=()=>void run(async()=>{const s=await registration?.pushManager.getSubscription();if(s){await api('/push/unsubscribe',s.toJSON());await s.unsubscribe();}message('此设备的 App 通知已关闭，Bark 提醒不受影响。');});
$('updateApp').onclick=()=>void run(async()=>{message('正在检查更新…');const r=await navigator.serviceWorker.getRegistration();if(r)await r.update();location.reload();});
if(!supported||!standalone){message('从主屏幕“私享新闻”图标打开，才能在 iPhone 上开启 App 自己的通知。');}
else{navigator.serviceWorker.ready.then(async r=>{registration=r;const s=await r.pushManager.getSubscription();if(!s){message('尚未开启 App 通知。开启后，点击通知即可进入此 App。');return;}try{const status=await api('/push/status',s.toJSON());message(status.last_error?'最近一次通知发送未完成：'+status.last_error:'App 通知已连接；Bark 暂时同时保留。');}catch(e){message(e.message);}}).catch(()=>message('通知功能暂未就绪，请点检查更新后重试。'));}
