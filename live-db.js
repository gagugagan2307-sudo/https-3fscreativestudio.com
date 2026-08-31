// 3FS Live Database Sync V4
// Low-latency Supabase sync: one authenticated client, atomic JSONB section patches,
// Realtime-first updates, and a very light health check.
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  let client=null, channel=null, ready=false, authReady=false;
  let writeChain=Promise.resolve();
  let serverSnapshot=null;

  function configured(){return !!(cfg.url&&cfg.publishableKey&&window.supabase)}
  function status(state,text){window.dispatchEvent(new CustomEvent('3fs:syncstatus',{detail:{state,text}}))}
  function clone(v){try{return structuredClone(v)}catch(e){return JSON.parse(JSON.stringify(v))}}

  async function ensureAuth(){
    if(!client)return false;
    try{
      const current=await client.auth.getSession();
      if(current?.data?.session){authReady=true;window._3fsSupabaseSession=current.data.session;return true}
      const sign=await client.auth.signInAnonymously();
      if(sign.error)throw sign.error;
      authReady=!!sign.data?.session;
      window._3fsSupabaseSession=sign.data?.session||null;
      return authReady;
    }catch(e){
      authReady=false;
      console.warn('3FS Supabase anonymous auth failed:',e);
      status('offline','Shared database authentication unavailable — retrying');
      return false;
    }
  }

  async function readServer(){
    if(!client||!authReady)return null;
    const r=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle();
    if(r.error)throw r.error;
    return r.data||null;
  }

  async function pull(){
    if(!client||!authReady)return false;
    try{
      const row=await readServer();
      if(!row?.data)return true;
      serverSnapshot=clone(row.data);
      const serverAt=new Date(row.updated_at||0).getTime();
      const localAt=Number(localStorage.getItem('3fsLastSyncedAt')||0);
      if(serverAt>=localAt && localStorage.getItem('3fsPendingWrite')!=='1'){
        localStorage.setItem('3fsData',JSON.stringify(row.data));
        localStorage.setItem('3fsLastSyncedAt',String(serverAt));
        window.dispatchEvent(new Event('3fs:live-refresh'));
      }
      return true;
    }catch(e){console.warn('3FS live pull failed',e);return false}
  }

  window.init3FSLiveSync=async function(){
    if(!configured()){status('offline','Supabase configuration missing');return false}
    if(ready&&client)return true;
    try{
      status('connecting','Connecting to shared database…');
      client=window._3fsSupabaseClient||window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
      window._3fsSupabaseClient=client;
      if(!(await ensureAuth()))return false;
      const first=await readServer();
      if(first?.data){
        serverSnapshot=clone(first.data);
        localStorage.setItem('3fsData',JSON.stringify(first.data));
        localStorage.setItem('3fsLastSyncedAt',String(new Date(first.updated_at||0).getTime()));
        window.dispatchEvent(new Event('3fs:live-refresh'));
      }
      ready=true;
      if(channel)try{await client.removeChannel(channel)}catch(e){}
      channel=client.channel('3fs-live-shared-v7')
        .on('postgres_changes',{event:'*',schema:'public',table:'threefs_state',filter:'id=eq.1'},payload=>{
          if(!payload.new?.data)return;
          serverSnapshot=clone(payload.new.data);
          const at=new Date(payload.new.updated_at||0).getTime();
          const localAt=Number(localStorage.getItem('3fsLastSyncedAt')||0);
          if(localStorage.getItem('3fsPendingWrite')!=='1' && at>=localAt){
            localStorage.setItem('3fsData',JSON.stringify(payload.new.data));
            localStorage.setItem('3fsLastSyncedAt',String(at));
            window.dispatchEvent(new Event('3fs:live-refresh'));
          }
          status('online','Live update received');
        })
        .subscribe(state=>{
          if(state==='SUBSCRIBED')status('online','Live database connected · realtime ON');
          else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')status('error','Realtime reconnecting…');
        });
      return true;
    }catch(e){
      console.warn('3FS Supabase connection failed:',e);ready=false;
      status('offline','Shared database unavailable — retrying automatically');
      return false;
    }
  };

  // Fast path: send only changed top-level sections. The SQL function merges the patch
  // atomically in Postgres, so we avoid the old read-then-write round trip.
  window._3fsPushLive=function(obj,changedKeys){
    if(!client||!authReady||!obj)return Promise.resolve(false);
    const keys=changedKeys&&changedKeys.length?changedKeys:Object.keys(obj);
    const patch={};
    for(const k of keys)patch[k]=clone(obj[k]);
    writeChain=writeChain.then(async()=>{
      localStorage.setItem('3fsPendingWrite','1');
      status('saving','Saving globally…');
      try{
        const r=await client.rpc('threefs_merge_state',{p_patch:patch});
        if(r.error)throw r.error;
        const merged=r.data?.[0]||r.data||null;
        if(merged?.data){
          serverSnapshot=clone(merged.data);
          localStorage.setItem('3fsData',JSON.stringify(merged.data));
          localStorage.setItem('3fsLastSyncedAt',String(new Date(merged.updated_at||Date.now()).getTime()));
        }else{
          const local=clone(obj); if(serverSnapshot){for(const k of keys)serverSnapshot[k]=clone(local[k]);}
          localStorage.setItem('3fsData',JSON.stringify(local));
        }
        localStorage.removeItem('3fsPendingWrite');
        status('online','Saved globally · realtime ON');
        return true;
      }catch(e){
        console.warn('3FS live save failed',e);
        localStorage.removeItem('3fsPendingWrite');
        status('error','Global save failed — retry automatically');
        // One retry, without adding a long delay to the first save.
        setTimeout(()=>{if(window._3fsPushLive)window._3fsPushLive(obj,keys)},400);
        return false;
      }
    });
    return writeChain;
  };

  window._3fsRefreshLive=async function(){
    if(!client&&configured())return window.init3FSLiveSync();
    if(client&&!authReady){if(!(await ensureAuth()))return false;ready=true}
    return pull();
  };

  window.addEventListener('3fs:datachanged',e=>{
    if(window._3fsPushLive&&e.detail?.store)window._3fsPushLive(e.detail.store,e.detail.changedKeys||[]);
  });

  // Realtime carries changes; this is only a fallback health check every 60s.
  setInterval(async()=>{
    if(!client&&configured())await window.init3FSLiveSync();
    else if(client&&!authReady)await ensureAuth();
    else if(ready)await pull();
  },60000);
})();
