// 3FS Live Database Sync — Supabase Realtime with safe serialized writes
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  let client=null, channel=null, writeChain=Promise.resolve(), ready=false;
  function configured(){return !!(cfg.url&&cfg.publishableKey&&!String(cfg.url).includes('YOUR_')&&!String(cfg.publishableKey).includes('YOUR_')&&window.supabase)}
  function status(state,text){window.dispatchEvent(new CustomEvent('3fs:syncstatus',{detail:{state,text}}));}
  async function pull(){
    if(!client)return false;
    try{
      const r=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle();
      if(r.error)throw r.error;
      if(r.data&&r.data.data){
        localStorage.setItem('3fsData',JSON.stringify(r.data.data));
        window.dispatchEvent(new Event('3fs:live-refresh'));
        return true;
      }
    }catch(e){console.warn('3FS live pull failed',e);status('error','Database read failed — local data kept');}
    return false;
  }
  window.init3FSLiveSync=async function(){
    if(!configured()){status('offline','Local mode — add Supabase URL + publishable key for shared live data');return;}
    try{
      status('connecting','Connecting to shared database…');
      client=window.supabase.createClient(cfg.url,cfg.publishableKey);
      window._3fsSupabaseClient=client;
      const first=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle();
      if(first.error)throw first.error;
      if(first.data&&first.data.data){
        localStorage.setItem('3fsData',JSON.stringify(first.data.data));
        window.dispatchEvent(new Event('3fs:live-refresh'));
      }
      ready=true; status('online','Live database connected');
      channel=client.channel('3fs-live-v3')
        .on('postgres_changes',{event:'*',schema:'public',table:'threefs_state',filter:'id=eq.1'},payload=>{
          if(payload.new&&payload.new.data){
            localStorage.setItem('3fsData',JSON.stringify(payload.new.data));
            window.dispatchEvent(new Event('3fs:live-refresh'));
            status('online','Live update received');
          }
        })
        .subscribe(state=>{
          if(state==='SUBSCRIBED')status('online','Live database connected · realtime ON');
          else if(state==='CHANNEL_ERROR'||state==='TIMED_OUT')status('error','Realtime unavailable — automatic refresh fallback active');
        });
      // If the database row does not exist, publish the current local state once.
      if(!first.data && window.store) await window._3fsPushLive(window.store);
    }catch(e){
      console.warn('3FS Supabase connection failed:',e);
      ready=false; status('error','Database connection failed — check Supabase configuration/RLS');
    }
  };
  window._3fsPushLive=function(obj){
    if(!client||!obj)return Promise.resolve(false);
    writeChain=writeChain.then(async()=>{
      try{
        status('saving','Saving to shared database…');
        const r=await client.from('threefs_state').upsert({id:1,data:obj,updated_at:new Date().toISOString()},{onConflict:'id'});
        if(r.error)throw r.error;
        status('online','Saved to shared database');
        return true;
      }catch(e){console.warn('3FS live save failed',e);status('error','Database save failed — check Supabase RLS/auth');return false;}
    });
    return writeChain;
  };
  window._3fsRefreshLive=async function(){return pull();};
  window.addEventListener('3fs:datachanged',e=>{if(window._3fsPushLive&&e.detail?.store)window._3fsPushLive(e.detail.store);});
  setInterval(()=>{if(ready)pull();},15000);
})();
