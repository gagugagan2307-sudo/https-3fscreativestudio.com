// 3FS Admin Login
// Simple front-end gate for the requested shared credentials.
(function(){
  const ADMIN='3FS', PASS='3FS@media', KEY='3fsAdminSession';
  let loggedIn = localStorage.getItem(KEY)==='1';
  const profile={id:'3fs-admin',email:'',full_name:'3FS Admin',role:'admin',is_active:true};
  const ready=Promise.resolve(loggedIn);
  function emit(){ window.dispatchEvent(new CustomEvent('3fs:authchange',{detail:{user:loggedIn?profile:null,profile:loggedIn?profile:null}})); }
  function mount(){
    if(document.getElementById('threefs-login')) return;
    const s=document.createElement('style');
    s.id='threefs-login-css';
    s.textContent=`#threefs-login{position:fixed;inset:0;z-index:100000;display:grid;place-items:center;background:radial-gradient(circle at 50% 20%,rgba(245,181,27,.16),transparent 35%),#03070e;padding:20px}#threefs-login .loginbox{width:min(420px,94vw);background:linear-gradient(145deg,#0d1b2e,#081323);border:1px solid #3b4a63;border-radius:20px;padding:30px;box-shadow:0 25px 90px #000}#threefs-login img{width:88px;height:88px;object-fit:cover;border-radius:50%;display:block;margin:0 auto 15px;background:#fff}#threefs-login h1{font-size:30px;text-align:center;margin:0 0 5px}#threefs-login p{text-align:center;color:#aebbd0;margin:0 0 22px}#threefs-login label{display:block;color:#c9d7eb;font-weight:700;margin:12px 0 6px}#threefs-login input{width:100%;padding:12px;border-radius:10px;border:1px solid #34455f;background:#07101d;color:#fff;outline:none}#threefs-login button{width:100%;margin-top:18px;padding:12px;border:0;border-radius:10px;background:linear-gradient(135deg,#ffd13b,#e9a90e);font-weight:800;color:#111;cursor:pointer}#threefs-login .err{min-height:20px;text-align:center;color:#ff9b9b;margin-top:10px;font-size:13px}body.threefs-locked .layout,body.threefs-locked .foot{visibility:hidden}`;
    document.head.appendChild(s);
    const wrap=document.createElement('div');wrap.id='threefs-login';wrap.innerHTML=`<div class="loginbox"><img src="3fs-logo.jpg" alt="3FS"><h1>3FS Admin Login</h1><p>Creative Studio Management Dashboard</p><form id="threefs-login-form"><label>Admin</label><input id="threefs-admin" autocomplete="username" placeholder="Enter admin" required><label>Password</label><input id="threefs-pass" type="password" autocomplete="current-password" placeholder="Enter password" required><button type="submit">Login to 3FS</button><div class="err" id="threefs-login-error"></div></form></div>`;
    document.body.appendChild(wrap);
    document.body.classList.add('threefs-locked');
    document.getElementById('threefs-login-form').addEventListener('submit',async function(e){e.preventDefault();const a=document.getElementById('threefs-admin').value.trim(),p=document.getElementById('threefs-pass').value;if(a===ADMIN&&p===PASS){loggedIn=true;localStorage.setItem(KEY,'1');wrap.remove();document.body.classList.remove('threefs-locked');emit();try{const sc=window._3fsSupabaseClient;if(sc) await sc.auth.signInAnonymously();}catch(err){console.warn('3FS Supabase anonymous session unavailable:',err)};}else document.getElementById('threefs-login-error').textContent='Incorrect admin or password.';});
  }
  function show(){mount();const x=document.getElementById('threefs-login');if(x)x.style.display='grid';document.body.classList.add('threefs-locked');}
  function hide(){const x=document.getElementById('threefs-login');if(x)x.remove();document.body.classList.remove('threefs-locked');}
  window.threefsAuth={
    client:()=>window._3fsSupabaseClient||null,
    profile:()=>loggedIn?profile:null,
    role:()=>loggedIn?'admin':'',
    roleLabel:()=>loggedIn?'Team Member • Admin':'',
    is:(r)=>loggedIn&&r==='admin',
    can:(action)=>loggedIn,
    signIn:async({email,password}={})=>{const ok=(email===ADMIN&&password===PASS);if(ok){loggedIn=true;localStorage.setItem(KEY,'1');hide();emit();}return {data:{session:ok?{user:profile}:null},error:ok?null:new Error('Invalid credentials')};},
    signUp:async()=>({data:null,error:new Error('Sign up disabled')}),
    signOut:async()=>{loggedIn=false;localStorage.removeItem(KEY);show();emit();return {error:null};},
    resetPassword:async()=>({error:new Error('Password reset disabled')}),
    ready:()=>ready
  };
  window._3fsAuthReady=ready;
  if(!loggedIn) mount(); else emit();
})();
