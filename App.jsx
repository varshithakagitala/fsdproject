import { useEffect, useState } from "react";
const API = import.meta.env.VITE_API_URL || "http://localhost:3001";
async function api(path, token, options={}) {
  const r = await fetch(`${API}${path}`, { ...options, headers: {
    "Content-Type":"application/json", ...(token?{Authorization:`Bearer ${token}`}:{})
  }});
  const data = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(data.message || "Something went wrong");
  return data;
}
export default function App(){
  const [session,setSession]=useState(()=>{try{return JSON.parse(localStorage.getItem("medishare-session"))||null}catch{return null}});
  const [message,setMessage]=useState("");
  function signIn(data){localStorage.setItem("medishare-session",JSON.stringify(data));setSession(data);setMessage(`Welcome, ${data.user.name}`)}
  function logout(){localStorage.removeItem("medishare-session");setSession(null);setMessage("You have logged out.")}
  return <div className="shell"><header><a className="logo" href="#">✿ MediShare</a><span>Connecting communities through information</span>{session&&<button className="outline" onClick={logout}>Log out</button>}</header>
    {message&&<div className="toast">{message}<button onClick={()=>setMessage("")}>×</button></div>}
    {!session?<Auth onSuccess={signIn} flash={setMessage}/>:<Dashboard session={session} flash={setMessage}/>}
    <footer>Academic prototype · Not a medicine safety or redistribution approval system</footer></div>
}
function Auth({onSuccess,flash}){
 const [mode,setMode]=useState("login"),[form,setForm]=useState({name:"",email:"",password:"",role:"donor"}),[busy,setBusy]=useState(false);
 const change=(k,v)=>setForm(f=>({...f,[k]:v}));
 async function submit(e){e.preventDefault();setBusy(true);try{const data=await api(mode==="login"?"/api/auth/login":"/api/auth/signup",null,{method:"POST",body:JSON.stringify(form)});onSuccess(data)}catch(e){flash(e.message)}finally{setBusy(false)}}
 return <main className="auth"><section className="intro"><p className="eyebrow">A COMMUNITY INFORMATION PLATFORM</p><h1>Share information.<br/><em>Reduce waste.</em></h1><p>MediShare provides a simple place to organize unused medicine listings and make information easier for donors and receivers to find.</p><div className="steps"><span>01 · Create an account</span><span>02 · Add or explore listings</span><span>03 · Connect responsibly</span></div></section>
 <section className="auth-card"><div className="switch"><button className={mode==="login"?"active":""} onClick={()=>setMode("login")}>Log in</button><button className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>Sign up</button></div><h2>{mode==="login"?"Welcome back":"Create your account"}</h2><p className="muted">Use your account to continue to MediShare.</p>
 <form onSubmit={submit}>{mode==="signup"&&<><label>Full name<input required value={form.name} onChange={e=>change("name",e.target.value)} placeholder="Your name"/></label><label>Account type<select value={form.role} onChange={e=>change("role",e.target.value)}><option value="donor">Medicine donor</option><option value="receiver">Receiver / NGO</option></select></label></>}
 <label>Email<input type="email" required value={form.email} onChange={e=>change("email",e.target.value)} placeholder="you@example.com"/></label><label>Password<input type="password" required minLength="8" value={form.password} onChange={e=>change("password",e.target.value)} placeholder="At least 8 characters"/></label><button className="primary" disabled={busy}>{busy?"Please wait…":mode==="login"?"Log in →":"Create account →"}</button></form></section></main>
}
function Dashboard({session,flash}){
 return <main className="dashboard"><div className="welcome"><div><p className="eyebrow">MEDISHARE DASHBOARD</p><h1>Hello, {session.user.name}</h1><p className="muted">Account type: {session.user.role}</p></div><span className="role">{session.user.role}</span></div>
 {session.user.role==="donor"?<Donor token={session.token} flash={flash}/>:<Receiver token={session.token} flash={flash}/>}
 <div className="safety"><b>Important safety notice</b><p>Listings are user-submitted and unverified. This application does not confirm medicine quality, storage, authenticity, prescription status or legal eligibility. Do not consume or distribute any medicine based on this website. Any real-world donation requires qualified professional review and compliance with applicable laws.</p></div>
 </main>
}
function Donor({token,flash}){
 const [form,setForm]=useState({medicineName:"",quantity:"1",expiryDate:"",notes:""}),[mine,setMine]=useState([]);
 async function load(){try{setMine(await api("/api/medicines/mine",token))}catch(e){flash(e.message)}}
 useEffect(()=>{load()},[]);
 const change=(k,v)=>setForm(f=>({...f,[k]:v}));
 async function submit(e){e.preventDefault();try{await api("/api/medicines",token,{method:"POST",body:JSON.stringify(form)});flash("Listing information saved.");setForm({medicineName:"",quantity:"1",expiryDate:"",notes:""});load()}catch(e){flash(e.message)}}
 return <div className="grid"><section className="panel"><h2>Add medicine listing</h2><p className="muted">Enter details for an information-only listing.</p><form onSubmit={submit}><label>Medicine name<input required maxLength="100" value={form.medicineName} onChange={e=>change("medicineName",e.target.value)}/></label><label>Quantity<input type="number" min="1" max="10000" required value={form.quantity} onChange={e=>change("quantity",e.target.value)}/></label><label>Expiry date<input type="date" required value={form.expiryDate} onChange={e=>change("expiryDate",e.target.value)}/></label><label>Additional notes<textarea rows="3" maxLength="300" value={form.notes} onChange={e=>change("notes",e.target.value)} placeholder="Optional details"/></label><button className="primary">Save listing information</button></form></section>
 <section className="panel"><h2>My listings</h2><p className="muted">Recently submitted information.</p>{mine.length?mine.map(m=><Medicine key={m.id} item={m}/>):<p className="empty">No listings added yet.</p>}</section></div>
}
function Receiver({token,flash}){
 const [items,setItems]=useState([]),[search,setSearch]=useState("");
 async function load(){try{setItems(await api(`/api/medicines${search?`?search=${encodeURIComponent(search)}`:""}`,token))}catch(e){flash(e.message)}}
 useEffect(()=>{load()},[search]);
 async function express(id){try{const r=await api("/api/medicine-requests",token,{method:"POST",body:JSON.stringify({medicineId:id})});flash(r.message)}catch(e){flash(e.message)}}
 return <section className="panel"><div className="panel-title"><div><h2>Available medicine listings</h2><p className="muted">Search information submitted by donors.</p></div><input className="search" placeholder="Search medicine…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
 <div className="medicine-grid">{items.map(m=><article className="medicine" key={m.id}><span className="unverified">UNVERIFIED LISTING</span><h3>{m.medicineName}</h3><p>Quantity: {m.quantity}</p><p>Expiry date: {m.expiryDate}</p><p>Submitted by: {m.donorName}</p>{m.notes&&<p>{m.notes}</p>}<button className="primary" onClick={()=>express(m.id)}>Express interest</button><small>Interest is not approval to receive or use medicine.</small></article>)}</div>{!items.length&&<p className="empty">No matching active listings found.</p>}</section>
}
function Medicine({item}){return <article className="medicine"><span className="unverified">UNVERIFIED LISTING</span><h3>{item.medicineName}</h3><p>Quantity: {item.quantity}</p><p>Expiry date: {item.expiryDate}</p><p>Status: {item.status}</p>{item.notes&&<p>{item.notes}</p>}</article>}
