import {useEffect,useRef,useState} from "react";
import type {CSSProperties,ReactNode} from "react";
import {bootSteps,loadRegistry,saveRegistry,loadSession,saveSession} from "./core/runtime";
import type {DesktopSettings,Registry} from "./core/runtime";

type AppId="explorer"|"notepad"|"calculator"|"paint"|"minesweeper"|"system";
type Win={id:number;app:AppId;title:string;x:number;y:number;w:number;h:number;minimized:boolean;maximized:boolean;top:boolean};
type Node={name:string;type:"folder"|"file";size?:string;ext?:string;children?:Node[]};

const apps:{app:AppId;title:string;icon:string}[]=[
 {app:"explorer",title:"Tento počítač",icon:"🖥️"},{app:"notepad",title:"Poznámkový blok",icon:"📝"},
 {app:"calculator",title:"Kalkulačka",icon:"🧮"},{app:"paint",title:"Malování",icon:"🎨"},
 {app:"minesweeper",title:"Hledání min",icon:"💣"},{app:"system",title:"Ovládací panely",icon:"⚙️"}
];
const initialFs:Node={name:"C:\\",type:"folder",children:[
 {name:"Windows",type:"folder",children:[{name:"Media",type:"folder",children:[{name:"startup.wav",type:"file",size:"12 KB",ext:".wav"},{name:"chord.wav",type:"file",size:"8 KB",ext:".wav"}]}]},
 {name:"Program Files",type:"folder",children:[]},
 {name:"My Documents",type:"folder",children:[{name:"WELCOME.TXT",type:"file",size:"2 KB",ext:".txt"},{name:"NOTES.TXT",type:"file",size:"1 KB",ext:".txt"}]},
 {name:"Temp",type:"folder",children:[]},{name:"Recycled",type:"folder",children:[]}
]};

function Btn(p:{children:ReactNode;onClick?:()=>void;className?:string}){return <button className={"win-btn "+(p.className||"")} onClick={p.onClick}>{p.children}</button>}
function Menu({items}:{items:string[]}){return <div className="menu">{items.map(x=><span key={x}>{x}</span>)}</div>}

function WindowFrame({w,active,onFocus,onMove,onMin,onMax,onClose,children,z}:{w:Win;active:boolean;onFocus:()=>void;onMove:(x:number,y:number)=>void;onMin:()=>void;onMax:()=>void;onClose:()=>void;children:ReactNode;z:number}){
 const drag=useRef<{dx:number;dy:number}|null>(null);
 const style:CSSProperties=w.maximized?{inset:"0 0 28px 0",width:"auto",height:"auto",zIndex:z}:{left:w.x,top:w.y,width:w.w,height:w.h,zIndex:z};
 return <section className={"window "+(active?"active":"")} style={style} onMouseDown={onFocus}>
  <div className="titlebar" onDoubleClick={onMax} onMouseDown={e=>{
   if(w.maximized)return;
   drag.current={dx:e.clientX-w.x,dy:e.clientY-w.y};
   const move=(ev:MouseEvent)=>drag.current&&onMove(Math.max(0,ev.clientX-drag.current.dx),Math.max(0,ev.clientY-drag.current.dy));
   const up=()=>{drag.current=null;window.removeEventListener("mousemove",move);window.removeEventListener("mouseup",up)};
   window.addEventListener("mousemove",move);window.addEventListener("mouseup",up);
  }}>
   <b className="sys">▣</b><strong>{w.title}</strong>
   <div className="controls"><button onClick={e=>{e.stopPropagation();onMin()}}>_</button><button onClick={e=>{e.stopPropagation();onMax()}}>□</button><button onClick={e=>{e.stopPropagation();onClose()}}>×</button></div>
  </div>
  <div className="window-body">{children}</div>
 </section>
}


function BootScreen({onDone}:{onDone:()=>void}){
 const [step,setStep]=useState(0);
 useEffect(()=>{const t=setInterval(()=>setStep(v=>Math.min(v+1,bootSteps.length)),240);return()=>clearInterval(t)},[]);
 useEffect(()=>{if(step>=bootSteps.length){const t=setTimeout(onDone,350);return()=>clearTimeout(t)}},[step,onDone]);
 const pct=Math.round(step/bootSteps.length*100);
 return <div className="boot-screen"><div className="boot-logo">Microsoft <b>Windows 98</b></div><div className="boot-panel"><b>LUXFERY 26 BIOS</b>{bootSteps.slice(0,step).map(([name,msg])=><div key={name} className="boot-ok">[OK] {name} — {msg}</div>)}{step<bootSteps.length&&<div>[....] {bootSteps[step][0]} — {bootSteps[step][1]}</div>}<div className="boot-progress"><i style={{width:pct+"%"}} /></div><div className="boot-pct">{pct}%</div></div></div>
}

function Explorer(){
 const [path,setPath]=useState("C:\\"); const [query,setQuery]=useState(""); const [details,setDetails]=useState(false);
 const [fs]=useState(initialFs);
 const find=(p:string):Node=>{let n=fs;const parts=p.replace("C:\\","").split("\\").filter(Boolean);for(const part of parts)n=(n.children||[]).find(c=>c.name===part)||n;return n};
 const dir=find(path); const items=(dir.children||[]).filter(x=>x.name.toLowerCase().includes(query.toLowerCase()));
 const open=(x:Node)=>{if(x.type==="folder")setPath(path==="C:\\"?"C:\\"+x.name:path+"\\"+x.name)};
 return <div className="app-fill"><Menu items={["Soubor","Úpravy","Zobrazit","Nástroje","Nápověda"]}/>
  <div className="toolbar"><Btn onClick={()=>setPath("C:\\")}>←</Btn><Btn onClick={()=>setPath(path.includes("\\")?path.split("\\").slice(0,-1).join("\\")||"C:\\":"C:\\")}>↑</Btn><input className="sunken path" value={path} onChange={e=>setPath(e.target.value)}/><input className="sunken search" placeholder="Hledat" value={query} onChange={e=>setQuery(e.target.value)}/></div>
  <div className="explorer"><div className="tree sunken"><button onClick={()=>setPath("C:\\")}>▣ C:\</button>{fs.children?.map(x=><button key={x.name} onClick={()=>x.type==="folder"&&setPath("C:\\"+x.name)}>📁 {x.name}</button>)}</div>
  <div className="files sunken">{details?<table><thead><tr><th>Název</th><th>Velikost</th><th>Typ</th></tr></thead><tbody>{items.map(x=><tr key={x.name} onDoubleClick={()=>open(x)}><td>{x.type==="folder"?"📁":"📄"} {x.name}</td><td>{x.size||""}</td><td>{x.ext||"Složka"}</td></tr>)}</tbody></table>:<div className="icons">{items.map(x=><button className="file-icon" key={x.name} onDoubleClick={()=>open(x)}><span>{x.type==="folder"?"📁":"📄"}</span><b>{x.name}</b></button>)}</div>}</div></div>
  <div className="status">Počet položek: {items.length}<span/> <Btn onClick={()=>setDetails(!details)}>{details?"Ikony":"Podrobnosti"}</Btn></div></div>
}

function Notepad(){const [text,setText]=useState("Vítejte v LUXFERY 26.\\n\\nWindows 98, ale běží v roce 2026.");const [wrap,setWrap]=useState(true);return <div className="app-fill"><Menu items={["Soubor","Úpravy","Hledat","Formát","Nápověda"]}/><div className="toolbar"><Btn onClick={()=>setText("")}>Nový</Btn><Btn onClick={()=>navigator.clipboard?.writeText(text)}>Kopírovat</Btn><Btn onClick={()=>setWrap(!wrap)}>Zalamování: {wrap?"Ano":"Ne"}</Btn></div><textarea className="editor sunken" value={text} onChange={e=>setText(e.target.value)} style={{whiteSpace:wrap?"pre-wrap":"pre"}}/><div className="status">Řádky: {text.split("\\n").length}<span/>Znaky: {text.length}<span/>UTF-8</div></div>}

function Calculator(){
 const [v,setV]=useState("0"),[a,setA]=useState<number|null>(null),[op,setOp]=useState<string|null>(null),[sci,setSci]=useState(false);
 const digit=(x:string)=>setV(v==="0"&&x!=="."?x:v+x); const oper=(o:string)=>{setA(Number(v));setOp(o);setV("0")};
 const eq=()=>{if(a===null||!op)return;const b=Number(v);const r=op==="+"?a+b:op==="-"?a-b:op==="*"?(a*b):(b===0?NaN:a/b);setV(Number.isFinite(r)?String(r):"Error");setA(null);setOp(null)};
 const keys=["7","8","9","/","4","5","6","*","1","2","3","-","0",".","=","+"];
 return <div className="calc"><div className="lcd">{v}</div><div className="calc-top"><Btn onClick={()=>setSci(!sci)}>{sci?"Standardní":"Vědecká"}</Btn><Btn onClick={()=>{setV("0");setA(null);setOp(null)}}>C</Btn></div><div className="calc-grid">{keys.map(k=>k==="="?<Btn key={k} onClick={eq}>=</Btn>:<Btn key={k} onClick={()=>"+-*/".includes(k)?oper(k):digit(k)}>{k}</Btn>)}{sci&&<><Btn onClick={()=>setV(String(Math.sqrt(Number(v))))}>√</Btn><Btn onClick={()=>setV(String(Math.log10(Number(v))))}>log</Btn><Btn onClick={()=>setV(String(Math.sin(Number(v))))}>sin</Btn><Btn onClick={()=>setV(String(Number(v)*Number(v)))}>x²</Btn></>}</div></div>
}

function Paint(){const ref=useRef<HTMLCanvasElement>(null);const [down,setDown]=useState(false);useEffect(()=>{const c=ref.current;if(!c)return;const x=c.getContext("2d")!;x.fillStyle="#fff";x.fillRect(0,0,c.width,c.height)},[]);const draw=(e:React.PointerEvent)=>{if(!down)return;const c=ref.current!;const r=c.getBoundingClientRect();const x=c.getContext("2d")!;x.fillStyle="#000";x.fillRect(Math.floor(e.clientX-r.left),Math.floor(e.clientY-r.top),3,3)};return <div className="app-fill"><Menu items={["Soubor","Úpravy","Zobrazit","Obraz","Barvy","Nápověda"]}/><div className="paint"><aside>{["✎","🖌","▣","◩","⌕","T","／","▭","○"].map((x,i)=><button key={i} className="tool">{x}</button>)}</aside><div className="canvas sunken"><canvas ref={ref} width="640" height="360" onPointerDown={()=>setDown(true)} onPointerUp={()=>setDown(false)} onPointerLeave={()=>setDown(false)} onPointerMove={draw}/></div></div></div>}

function Minesweeper(){const make=()=>Array.from({length:81},(_,i)=>({i,mine:[3,8,11,22,35,46,57,61,70,76].includes(i),open:false,flag:false}));const [c,setC]=useState(make),[state,setState]=useState("HRA"),[time,setTime]=useState(0);useEffect(()=>{if(state!=="HRA")return;const i=setInterval(()=>setTime(t=>t+1),1000);return()=>clearInterval(i)},[state]);const click=(i:number)=>{if(c[i].flag||c[i].open||state!=="HRA")return;const n=[...c];n[i]={...n[i],open:true};setC(n);if(n[i].mine){setC(n.map(x=>({...x,open:x.open||x.mine})));setState("PROHRA")}else if(n.filter(x=>!x.mine&&!x.open).length===0)setState("VÝHRA")};const flag=(e:React.MouseEvent,i:number)=>{e.preventDefault();const n=[...c];n[i]={...n[i],flag:!n[i].flag};setC(n)};return <div className="mine"><div className="mine-head">💣 10 <button onClick={()=>{setC(make());setState("HRA");setTime(0)}}>🙂</button> ⏱ {time}</div><div className="mine-grid">{c.map(x=><button key={x.i} className={"mine-cell "+(x.open?"open":"")} onClick={()=>click(x.i)} onContextMenu={e=>flag(e,x.i)}>{x.open?(x.mine?"💣":""):(x.flag?"🚩":"")}</button>)}</div><div className="status">{state}</div></div>}

function System({open,settings,onChange}:{open:(a:AppId)=>void;settings:DesktopSettings;onChange:(p:Partial<DesktopSettings>)=>void}){return <div className="app-fill control"><Menu items={["Soubor","Úpravy","Zobrazit","Nápověda"]}/><h3>Ovládací panely</h3><div className="cp">{["Zobrazení","Myš","Klávesnice","Datum a čas","Zvuky","Síť","Uživatelé","Systém","Napájení","Programy"].map(x=><button key={x}>{x}</button>)}</div><div className="settings-panel sunken"><label>Motiv <select value={settings.theme} onChange={e=>onChange({theme:e.target.value as DesktopSettings["theme"]})}><option value="classic">Windows Standard</option><option value="high-contrast">Vysoký kontrast</option><option value="dark">Dark</option></select></label><label><input type="checkbox" checked={settings.showDesktopIcons} onChange={e=>onChange({showDesktopIcons:e.target.checked})}/> Ikony plochy</label><label><input type="checkbox" checked={settings.reduceMotion} onChange={e=>onChange({reduceMotion:e.target.checked})}/> Omezit animace</label></div><div className="sysinfo sunken"><b>LUXFERY 26</b><br/>Windows 98 style desktop runtime<br/>React + TypeScript + Vite<br/>Build 26.09.04</div><Btn onClick={()=>open("notepad")}>Otevřít Poznámkový blok</Btn></div>}

export function App(){
 const [registry,setRegistry]=useState<Registry>(()=>loadRegistry());
 const settings=registry.HKCU.Desktop.settings;
 const [boot,setBoot]=useState(true);
 const restored=loadSession<Win[]>();
 const [wins,setWins]=useState<Win[]>(restored||[]),[active,setActive]=useState<number|null>(()=>restored?.find(w=>!w.minimized)?.id??null),[start,setStart]=useState(false),[id,setId]=useState(()=>Math.max(0,...(restored||[]).map(w=>w.id))+1),[fs]=useState(initialFs);
 useEffect(()=>saveSession(wins),[wins]);
 const updateSettings=(patch:Partial<DesktopSettings>)=>{const next={...registry,HKCU:{...registry.HKCU,Desktop:{...registry.HKCU.Desktop,settings:{...settings,...patch}}}};setRegistry(next);saveRegistry(next)};
 useEffect(()=>{saveSession(wins)},[wins]);
 const updateSettings=(patch:Partial<DesktopSettings>)=>{const next={...registry,HKCU:{...registry.HKCU,Desktop:{...registry.HKCU.Desktop,settings:{...settings,...patch}}}};setRegistry(next);saveRegistry(next)};
 const clock=new Date(); const open=(app:AppId)=>{const found=wins.find(x=>x.app===app);if(found){setActive(found.id);setWins(wins.map(x=>x.id===found.id?{...x,minimized:false}:x));setStart(false);return}const meta=apps.find(x=>x.app===app)!;const w:Win={id,app,title:meta.title,x:80+wins.length*24,y:60+wins.length*24,w:app==="calculator"?300:650,h:app==="minesweeper"?430:430,minimized:false,maximized:false,top:false};setWins([...wins,w]);setId(id+1);setActive(id);setStart(false)};
 const update=(i:number,p:Partial<Win>)=>setWins(wins.map(w=>w.id===i?{...w,...p}:w));const close=(i:number)=>{setWins(wins.filter(w=>w.id!==i));if(active===i)setActive(null)};
 useEffect(()=>{const k=(e:KeyboardEvent)=>{if(e.altKey&&e.key==="F4"&&active)close(active);if(e.ctrlKey&&e.key==="Escape"){e.preventDefault();setStart(true)}};addEventListener("keydown",k);return()=>removeEventListener("keydown",k)},[active,wins]);
 if(boot)return <BootScreen onDone={()=>setBoot(false)}/>;
 return <main className={"desktop "+(settings.theme==="dark"?"theme-dark ":"")+(settings.theme==="high-contrast"?"theme-contrast ":"")+(settings.reduceMotion?"reduce-motion":"")}><div className="wallpaper" style={{background:settings.wallpaper}} onMouseDown={()=>setStart(false)}>
  <div className={"desktop-icons "+(settings.showSmallIcons?"small-icons":"")} style={{display:settings.showDesktopIcons?"grid":"none"}}>{apps.map(a=><button className="desktop-icon" key={a.app} onDoubleClick={()=>open(a.app)}><span>{a.icon}</span><b>{a.title}</b></button>)}</div>
  {wins.filter(w=>!w.minimized).map(w=><WindowFrame key={w.id} w={w} active={w.id===active} z={100+w.id} onFocus={()=>setActive(w.id)} onMove={(x,y)=>update(w.id,{x,y})} onMin={()=>update(w.id,{minimized:true})} onMax={()=>update(w.id,{maximized:!w.maximized})} onClose={()=>close(w.id)}>{w.app==="explorer"&&<Explorer/>}{w.app==="notepad"&&<Notepad/>}{w.app==="calculator"&&<Calculator/>}{w.app==="paint"&&<Paint/>}{w.app==="minesweeper"&&<Minesweeper/>}{w.app==="system"&&<System open={open} settings={settings} onChange={updateSettings}/>}</WindowFrame>)}
  {start&&<div className="start" onMouseDown={e=>e.stopPropagation()}><div className="start-head"><b>Windows 98</b><span>LUXFERY 26</span></div><div className="start-body"><div>{apps.slice(0,5).map(a=><button key={a.app} onClick={()=>open(a.app)}><span>{a.icon}</span>{a.title}</button>)}</div><div>{["Programy","Dokumenty","Nastavení","Hledat","Nápověda","Spustit…","Vypnout…"].map((x,i)=><button key={x}>{["▸","📄","⚙️","🔎","❓","▶","⏻"][i]} {x}</button>)}</div></div></div>}
 </div><div className="taskbar" onContextMenu={e=>{e.preventDefault();setStart(false)}}><button className="start-button" onClick={e=>{e.stopPropagation();setStart(!start)}}>▰ <b>Start</b></button><div className="tasks">{wins.map(w=><button key={w.id} className={active===w.id&&!w.minimized?"task-active":""} onClick={()=>{update(w.id,{minimized:!w.minimized});setActive(w.id)}}>{apps.find(a=>a.app===w.app)?.icon} {w.title}</button>)}</div><div className="tray"><span title="Hlasitost">🔊</span><span title="Síť">▧</span><span title={clock.toLocaleDateString("cs-CZ",{weekday:"long",day:"2-digit",month:"2-digit",year:"numeric"})}>{clock.toLocaleTimeString("cs-CZ",{hour:"2-digit",minute:"2-digit"})}</span></div></div></main>
}