// 3FS Multi-user authentication + role/permission guard (Supabase Auth)
(function(){
  const cfg=window.SUPABASE_CONFIG||{};
  let client=null, profile=null;
  const ROLE_LABELS={admin:'Team Member • Admin'};
  function configured(){return !!(cfg.url&&cfg.publishableKey&&!cfg.url.includes('YOUR_')&&!cfg.publishableKey.includes('YOUR_')&&window.supabase)}
  function emit(){window.dispatchEvent(new CustomEvent('3fs:authchange',{detail:{user:client?.auth?.user?.(),profile}}))}
  async function init(){
    if(!configured()){window._3fsAuthReady=Promise.resolve(false);return false}
    client=window.supabase.createClient(cfg.url,cfg.publishableKey);
    const {data,error}=await client.auth.getSession();
    if(error||!data.session){window._3fsAuthReady=Promise.resolve(false);return false}
    const ok=await loadProfile(data.session.user.id);
    client.auth.onAuthStateChange(async (_event,session)=>{
      if(session) await loadProfile(session.user.id); else {profile=null;emit();}
    });
    window._3fsAuthReady=Promise.resolve(ok); return ok;
  }
  async function loadProfile(uid){
    const {data,error}=await client.from('profiles').select('id,email,full_name,role,is_active,created_at').eq('id',uid).maybeSingle();
    if(error||!data||!data.is_active){profile=null;return false}
    profile=data; emit(); return true;
  }
  window.threefsAuth={
    client:()=>client,
    profile:()=>profile,
    role:()=>profile?.role||null,
    roleLabel:()=>ROLE_LABELS[profile?.role]||'Unknown',
    is:(r)=>profile?.role===r,
    can:(action,section)=>{
      const r=profile?.role;
      if(!r)return false;
      if(action==='view')return r==='admin';
      if(action==='manage_users')return r==='admin';
      if(action==='write')return r==='admin';
      return false;
    },
    signIn:async(email,password)=>client.auth.signInWithPassword({email,password}),
    signUp:async(email,password,fullName)=>client.auth.signUp({email,password,options:{data:{full_name:fullName}}}),
    signOut:async()=>client.auth.signOut(),
    resetPassword:async(email)=>client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}),
    ready:()=>window._3fsAuthReady||Promise.resolve(false)
  };
  window.addEventListener('3fs:logout',()=>window.threefsAuth?.signOut());
  init();
})();
