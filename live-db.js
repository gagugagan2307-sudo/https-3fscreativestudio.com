// 3FS Live Database Sync — Supabase Realtime
// Shared state is stored in public.threefs_state and delivered to every signed-in device.
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  let client=null, channel=null, writeChain=Promise.resolve(), ready=false;
  let authReady=false;
  function configured(){return !!(cfg.url&&cfg.publishableKey&&window.supabase)}
  function status(state,text){window.dispatchEvent(new CustomEvent('3fs:syncstatus',{detail:{state,text}}));}
  async function ensureAuth(){
    if(!client) return false;
    try{
      const current=await client.auth.getSession();
      if(current?.data?.session){authReady=true;return true;}
      const sign=await client.auth.signInAnonymously();
      if(sign.error) throw sign.error;
      authReady=true;
      return true;
    }catch(e){
      authReady=false;
      console.warn('3FS Supabase anonymous auth failed:',e);
      status('error','Supabase authentication failed — enable Anonymous Sign-Ins');
      return false;
    }
  }
  async function pull(){
    if(!client||!authReady)return false;
    if(localStorage.getItem('3fsPendingWrite')==='1')return false;
    try{
      const r=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle();
      if(r.error)throw r.error;
      if(r.data?.data){
        const serverAt=new Date(r.data.updated_at||0).getTime();
        const localAt=Number(localStorage.getItem('3fsLastSyncedAt')||0);
        if(serverAt>=localAt){
          localStorage.setItem('3fsData',JSON.stringify(r.data.data));
          localStorage.setItem('3fsLastSyncedAt',String(serverAt));
          window.dispatchEvent(new Event('3fs:live-refresh'));
        }
        return true;
      }
    }catch(e){console.warn('3FS live pull failed',e);status('error','Database read failed — local data kept');}
    return false;
  }
  window.init3FSLiveSync=async function(){
    if(!configured()){status('offline','Supabase configuration missing');return;}
    try{
      status('connecting','Connecting to shared database…');
      client=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      window._3fsSupabaseClient=client;
      const ok=await ensureAuth();
      if(!ok)return;
      const first=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle();
      if(first.error)throw first.error;
      if(first.data?.data){
        localStorage.setItem('3fsData',JSON.stringify(first.data.data));
        localStorage.setItem('3fsLastSyncedAt',String(new Date(first.data.updated_at||0).getTime()));
        window.dispatchEvent(new Event('3fs:live-refresh'));
      }
      ready=true;
      status('online','Live database connected');
      channel=client.channel('3fs-live-v4')
        .on('postgres_changes',{event:'*',schema:'public',table:'threefs_state',filter:'id=eq.1'},payload=>{
          if(payload.new?.data && localStorage.getItem('3fsPendingWrite')!=='1'){
            const at=new Date(payload.new.updated_at||0).getTime();
            const localAt=Number(localStorage.getItem('3fsLastSyncedAt')||0);
            if(at>=localAt){
              localStorage.setItem('3fsData',JSON.stringify(payload.new.data));
              localStorage.setItem('3fsLastSyncedAt',String(at));
              window.dispatchEvent(new Event('3fs:live-refresh'));
              status('online','Live update received');
            }
          }
        })
        .subscribe(state=>{
          if(state==='SUBSCRIBED')status('online','Live database connected · realtime ON');
          else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')status('error','Realtime unavailable — automatic refresh fallback active');
        });
      if(!first.data && window.store)await window._3fsPushLive(window.store);
    }catch(e){
      console.warn('3FS Supabase connection failed:',e);
      ready=false;
      status('error','Database connection failed — check Supabase/RLS settings');
    }
  };
  window._3fsPushLive=function(obj){
    if(!client||!authReady||!obj)return Promise.resolve(false);
    writeChain=writeChain.then(async()=>{
      localStorage.setItem('3fsPendingWrite','1');
      try{
        status('saving','Saving to shared database…');
        const stamp=new Date().toISOString();
        const r=await client.from('threefs_state').upsert({id:1,data:obj,updated_at:stamp},{onConflict:'id'});
        if(r.error)throw r.error;
        localStorage.setItem('3fsLastSyncedAt',String(new Date(stamp).getTime()));
        localStorage.removeItem('3fsPendingWrite');
        status('online','Saved to shared database');
        return true;
      }catch(e){
        localStorage.removeItem('3fsPendingWrite');
        console.warn('3FS live save failed',e);
        status('error','Database save failed — check RLS/Anonymous Sign-Ins');
        return false;
      }
    });
    return writeChain;
  };
  window._3fsRefreshLive=async function(){return pull();};
  window.addEventListener('3fs:datachanged',e=>{if(window._3fsPushLive&&e.detail?.store)window._3fsPushLive(e.detail.store);});
  setInterval(()=>{if(ready)pull();},15000);
})();
