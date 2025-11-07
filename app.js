import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom/client";

// Map & UI constants
const MAP_WIDTH = 1200;
const MAP_HEIGHT = 600;
const TOWER_WIDTH = 80;
const TOWER_HEIGHT = 120;
const CARD_SIZE = 60;
const ELIXIR_MAX = 10;
const ELIXIR_REGEN = 1;
const ATTACK_COOLDOWN = 1000; // ms

// Card data
const CARD_DATA = [
  { id: "archer", name: "Archer", hp: 50, dmg: 10, speed: 1.5, range: 100, cost: 3, img: "https://via.placeholder.com/60x60?text=A" },
  { id: "giant", name: "Giant", hp: 200, dmg: 20, speed: 0.7, range: 30, cost: 5, img: "https://via.placeholder.com/60x60?text=G" },
  { id: "knight", name: "Knight", hp: 100, dmg: 15, speed: 1, range: 30, cost: 4, img: "https://via.placeholder.com/60x60?text=K" },
  { id: "minion", name: "Minion", hp: 30, dmg: 8, speed: 2, range: 50, cost: 2, img: "https://via.placeholder.com/60x60?text=M" },
];

function clamp(value, min, max) { return Math.min(Math.max(value, min), max); }
function distance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
function useInterval(callback, delay) {
  const saved = useRef();
  useEffect(() => { saved.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => saved.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

// Components
function Card({ card, onDragStart }) {
  return <img src={card.img} alt={card.name} draggable onDragStart={e => onDragStart(e, card)}
              style={{width:CARD_SIZE, height:CARD_SIZE, margin:5, cursor:"grab"}} 
              title={`${card.name} (Cost:${card.cost})`} />;
}

function Unit({ unit }) {
  return <>
    <img src={unit.card.img} alt={unit.card.name} style={{
      position:"absolute", width:CARD_SIZE, height:CARD_SIZE, left:unit.pos.x, top:unit.pos.y, pointerEvents:"none"
    }}/>
    <div style={{
      position:"absolute", left:unit.pos.x, top:unit.pos.y-8, width:CARD_SIZE, height:5, background:"#f00"
    }}>
      <div style={{width:`${unit.hp/unit.card.hp*100}%`, height:"100%", background:"#0f0"}}></div>
    </div>
  </>
}

function Tower({ x, y, hp, side }) {
  return <div style={{
    position:"absolute", left:x, top:y, width:TOWER_WIDTH, height:TOWER_HEIGHT,
    backgroundColor: side==="player"?"#4a90e2":"#e24a4a", borderRadius:10,
    display:"flex", justifyContent:"center", alignItems:"center",
    color:"#fff", fontWeight:"bold", fontSize:18
  }}>{hp}</div>
}

function App() {
  const [playerElixir, setPlayerElixir] = useState(ELIXIR_MAX);
  const [playerUnits, setPlayerUnits] = useState([]);
  const [aiUnits, setAiUnits] = useState([]);
  const [draggingCard, setDraggingCard] = useState(null);
  const fieldRef = useRef();
  const opponentElixirRef = useRef(ELIXIR_MAX);

  const [towers, setTowers] = useState({
    player: { x: 50, y: MAP_HEIGHT/2-TOWER_HEIGHT/2, hp: 500 },
    ai: { x: MAP_WIDTH-50-TOWER_WIDTH, y: MAP_HEIGHT/2-TOWER_HEIGHT/2, hp: 500 }
  });

  // Elixir regen
  useInterval(()=>setPlayerElixir(e=>clamp(e+ELIXIR_REGEN,0,ELIXIR_MAX)),1000);
  useInterval(()=>{
    opponentElixirRef.current = clamp(opponentElixirRef.current + ELIXIR_REGEN, 0, ELIXIR_MAX);
    if(opponentElixirRef.current >= 2){
      const affordable = CARD_DATA.filter(c => c.cost <= opponentElixirRef.current);
      if(affordable.length>0){
        const card = affordable[Math.floor(Math.random()*affordable.length)];
        spawnUnit("ai", card);
        opponentElixirRef.current -= card.cost;
      }
    }
  },1500);

  function spawnUnit(side, card, pos=null){
    const yBase = pos ? pos.y : side==="player" ? MAP_HEIGHT-150 : 50;
    const xBase = pos ? pos.x : side==="player" ? 150 : MAP_WIDTH-150;
    const newUnit = { id:Math.random().toString(36).substr(2,9), card, hp:card.hp, pos:{x:xBase,y:yBase}, side, lastAttack:0 };
    if(side==="player") setPlayerUnits(u=>[...u,newUnit]);
    else setAiUnits(u=>[...u,newUnit]);
  }

  function onDragStart(e, card){
    if(playerElixir < card.cost) { e.preventDefault(); return; }
    setDraggingCard(card);
  }

  function onDrop(e){
    e.preventDefault();
    if(!draggingCard) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left - CARD_SIZE/2;
    const y = e.clientY - rect.top - CARD_SIZE/2;
    if(y < MAP_HEIGHT/2) { setDraggingCard(null); return; }
    if(playerElixir >= draggingCard.cost){
      spawnUnit("player", draggingCard, {x,y});
      setPlayerElixir(e=>e - draggingCard.cost);
    }
    setDraggingCard(null);
  }

  function onDragOver(e){ e.preventDefault(); }

  // Game loop: movement + attacks
  useInterval(()=>{
    const now = Date.now();

    // Player units attack AI units/tower
    setPlayerUnits(units=>{
      return units.map(u=>{
        if(u.hp<=0) return null;
        let target=null;
        let closestDist = Infinity;
        for(const enemy of aiUnits){
          const dist = distance(u.pos, enemy.pos);
          if(dist<closestDist){ closestDist=dist; target=enemy; }
        }
        const towerDist = distance(u.pos, {x:towers.ai.x+TOWER_WIDTH/2, y:towers.ai.y+TOWER_HEIGHT/2});
        if(towerDist<closestDist){ closestDist=towerDist; target={...towers.ai, isTower:true}; }
        if(target && closestDist <= u.card.range){
          if(now - u.lastAttack > ATTACK_COOLDOWN){
            u.lastAttack = now;
            if(target.isTower) setTowers(t=>({...t, ai:{...t.ai, hp:Math.max(t.ai.hp - u.card.dmg,0)}}));
            else target.hp = Math.max(target.hp - u.card.dmg,0);
          }
          return u;
        } else {
          const dx = towers.ai.x - u.pos.x;
          const dy = towers.ai.y - u.pos.y;
          const dist = Math.hypot(dx,dy);
          if(dist>0) return {...u, pos:{x:u.pos.x + dx/dist*u.card.speed*3, y:u.pos.y + dy/dist*u.card.speed*3}};
          return u;
        }
      }).filter(Boolean);
    });

    // AI units attack player units/tower
    setAiUnits(units=>{
      return units.map(u=>{
        if(u.hp<=0) return null;
        let target=null;
        let closestDist = Infinity;
        for(const enemy of playerUnits){
          const dist = distance(u.pos, enemy.pos);
          if(dist<closestDist){ closestDist=dist; target=enemy; }
        }
        const towerDist = distance(u.pos, {x:towers.player.x+TOWER_WIDTH/2, y:towers.player.y+TOWER_HEIGHT/2});
        if(towerDist<closestDist){ closestDist=towerDist; target={...towers.player, isTower:true}; }
        if(target && closestDist <= u.card.range){
          if(now - u.lastAttack > ATTACK_COOLDOWN){
            u.lastAttack = now;
            if(target.isTower) setTowers(t=>({...t, player:{...t.player, hp:Math.max(t.player.hp - u.card.dmg,0)}}));
            else target.hp = Math.max(target.hp - u.card.dmg,0);
          }
          return u;
        } else {
          const dx = towers.player.x - u.pos.x;
          const dy = towers.player.y - u.pos.y;
          const dist = Math.hypot(dx,dy);
          if(dist>0) return {...u, pos:{x:u.pos.x + dx/dist*u.card.speed*3, y:u.pos.y + dy/dist*u.card.speed*3}};
          return u;
        }
      }).filter(Boolean);
    });

  }, 100);

  return (
    <div ref={fieldRef} style={{position:"relative", width:MAP_WIDTH, height:MAP_HEIGHT, margin:"auto", background:"#87ceeb"}}
         onDrop={onDrop} onDragOver={onDragOver}>
      <div style={{position:"absolute", top:MAP_HEIGHT/2-25, left:0, width:MAP_WIDTH, height:50, background:"#00bfff"}}></div>
      <Tower {...towers.player} side="player"/>
      <Tower {...towers.ai} side="ai"/>
      {playerUnits.map(u=><Unit key={u.id} unit={u}/>)}
      {aiUnits.map(u=><Unit key={u.id} unit={u}/>)}
      <div style={{position:"absolute", bottom:10, left:10, display:"flex", zIndex:10}}>
        {CARD_DATA.map(c=><Card key={c.id} card={c} onDragStart={onDragStart}/>)}
      </div>
      <div style={{position:"absolute", top:10, left:10, fontWeight:"bold"}}>Elixir: {playerElixir}</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
