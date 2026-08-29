// 3FS No-Login Mode
// Authentication has been disabled. Existing permission checks remain compatible
// and all dashboard actions are available without signing in.
(function(){
  const profile={id:null,email:'',full_name:'3FS Team',role:'admin',is_active:true};
  const ready=Promise.resolve(true);
  window.threefsAuth={
    client:()=>window._3fsSupabaseClient||null,
    profile:()=>profile,
    role:()=>'admin',
    roleLabel:()=>'Team Member • Admin',
    is:(r)=>r==='admin',
    can:()=>true,
    signIn:async()=>({data:{session:null},error:null}),
    signUp:async()=>({data:{session:null},error:null}),
    signOut:async()=>({error:null}),
    resetPassword:async()=>({error:null}),
    ready:()=>ready
  };
  window._3fsAuthReady=ready;
  window.dispatchEvent(new CustomEvent('3fs:authchange',{detail:{user:null,profile}}));
})();
