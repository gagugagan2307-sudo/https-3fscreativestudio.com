// 3FS Live Database Sync — Supabase Realtime
// Uses a Supabase browser publishable/anon key only. Never expose a service-role key.
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  let client=null;
  let channel=null;
  let syncing=false;
  function configured(){
    return !!(cfg.url && cfg.publishableKey && !cfg.url.includes('YOUR_') && !cfg.publishableKey.includes('YOUR_') && window.supabase);
  }
  function status(state,text){
    window.dispatchEvent(new CustomEvent('3fs:syncstatus',{detail:{state,text}}));
  }
  window.init3FSLiveSync=async function(onChange){
    if(!configured()){ status('offline','Local mode — connect Supabase to enable live sync'); return; }
    try{
      status('connecting','Connecting to live database…');
      client=window.supabase.createClient(cfg.url,cfg.publishableKey);
      const result=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle();
      if(result.error) throw result.error;

      if(result.data && result.data.data){
        localStorage.setItem('3fsData',JSON.stringify(result.data.data));
        status('online','Live database connected');
        onChange&&onChange();
      } else if(window.store){
        // First connected device seeds the shared row with its current local data.
        if(window.threefsAuth?.can('write')) await client.from('threefs_state').upsert({id:1,data:window.store,updated_at:new Date().toISOString(),updated_by:null});
        status('online','Live database connected · initial data synced');
      }

      channel=client.channel('3fs-live')
        .on('postgres_changes',{event:'*',schema:'public',table:'threefs_state',filter:'id=eq.1'},payload=>{
          if(payload.new && payload.new.data && !syncing){
            localStorage.setItem('3fsData',JSON.stringify(payload.new.data));
            status('online','Live update received');
            onChange&&onChange();
          }
        })
        .subscribe((s)=>{
          if(s==='SUBSCRIBED') status('online','Live database connected · realtime ON');
          if(s==='CHANNEL_ERROR'||s==='TIMED_OUT') status('error','Realtime connection lost — retrying…');
        });

      window._3fsPushLive=async function(obj){
        if(!client) return;
        syncing=true;
        try{
          const {error}=await client.from('threefs_state').upsert({id:1,data:obj,updated_at:new Date().toISOString(),updated_by:window.threefsAuth?.profile()?.id});
          if(error) throw error;
          status('online','Saved to live database');
        }catch(e){
          console.warn('3FS live sync failed',e);
          status('error','Save failed — local copy kept');
        }finally{ syncing=false; }
      };
      if(window.store) await window._3fsPushLive(window.store);
    }catch(e){
      console.warn('3FS Supabase connection failed:',e);
      status('error','Live database unavailable — local mode');
    }
  };
  window._3fsRefreshLive=async function(){
    if(!client) return false;
    try{const r=await client.from('threefs_state').select('data,updated_at').eq('id',1).maybeSingle(); if(r.data&&r.data.data){localStorage.setItem('3fsData',JSON.stringify(r.data.data)); window.dispatchEvent(new Event('3fs:live-refresh')); return true;} }catch(e){console.warn('Live refresh failed',e);} return false;
  };
  window.addEventListener('3fs:datachanged',()=>{
    if(window._3fsPushLive && window.store) window._3fsPushLive(window.store);
  });
})();
