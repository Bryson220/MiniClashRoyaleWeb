```javascript
import React, { useState, useEffect, useRef } from "react";
import ReactDOM from "react-dom";

const CARD_DATA = [
  { id: "archer", name: "Archer", cost: 3, hp: 50, dmg: 10, speed: 1.5, range: 100, img: "https://i.imgur.com/3X9QZ9Q.png" },
  { id: "giant", name: "Giant", cost: 5, hp: 200, dmg: 20, speed: 0.7, range: 30, img: "https://i.imgur.com/7Q9XQ9Q.png" },
  { id: "minion", name: "Minion", cost: 2, hp: 30, dmg: 8, speed: 2, range: 50, img: "https://i.imgur.com/6X9X9X9.png" },
  { id: "knight", name: "Knight", cost: 3, hp: 100, dmg: 15, speed: 1, range: 30, img: "https://i.imgur.com/5X9X9X9.png" },
];

const TOWER_HP = 500;
const MAX_ELIXIR = 10;
const ELIXIR_REGEN_RATE = 1; // per second

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function useInterval(callback, delay) {
  const savedCallback = useRef();
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function Card({ card, onDragStart, draggable, style }) {
  return (
    <img
      src={card.img}
      alt={card.name}
      draggable={draggable}
      onDragStart={(e) => onDragStart(e, card)}
      style={{
        width: 60,
        height: 60,
        margin: 5,
        cursor: draggable ? "grab" : "default",
        ...style,
      }}
      title={`${card.name} (Cost: ${card.cost})`}
    />
  );
}

function Unit({ unit, onUpdate }) {
  const ref = useRef();

  useEffect(() => {
    if (!ref.current) return;
    ref.current.style.left = `${unit.pos.x}px`;
    ref.current.style.top = `${unit.pos.y}px`;
  }, [unit.pos]);

  return (
    <img
      ref={ref}
      src={unit.card.img}
      alt={unit.card.name}
      style={{
        position: "absolute",
        width: 40,
        height: 40,
        userSelect: "none",
        pointerEvents: "none",
      }}
      title={`${unit.card.name} HP: ${unit.hp}`}
    />
  );
}

function Tower({ side, hp }) {
  const style = {
    position: "absolute",
    width: 80,
    height: 120,
    backgroundColor: side === "player" ? "#4a90e2" : "#e24a4a",
    bottom: 0,
    [side === "player" ? "left" : "right"]: 20,
    borderRadius: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "white",
    fontWeight: "bold",
    fontSize: 18,
    userSelect: "none",
  };
  return (
    <div style={style} title={`${side} tower HP: ${hp}`}>
      {hp}
    </div>
  );
}

function App() {
  const [playerElixir, setPlayerElixir] = useState(MAX_ELIXIR);
  const [playerUnits, setPlayerUnits] = useState([]);
  const [opponentUnits, setOpponentUnits] = useState([]);
  const [playerTowerHp, setPlayerTowerHp] = useState(TOWER_HP);
  const [opponentTowerHp, setOpponentTowerHp] = useState(TOWER_HP);
  const [draggingCard, setDraggingCard] = useState(null);
  const [fieldSize, setFieldSize] = useState({ width: 800, height: 400 });
  const fieldRef = useRef();

  // Elixir regen
  useInterval(() => {
    setPlayerElixir((e) => clamp(e + ELIXIR_REGEN_RATE, 0, MAX_ELIXIR));
  }, 1000);

  // Opponent AI: play cards randomly if enough elixir
  useInterval(() => {
    if (opponentElixirRef.current >= 2) {
      const affordable = CARD_DATA.filter((c) => c.cost <= opponentElixirRef.current);
      if (affordable.length > 0) {
        const card = affordable[Math.floor(Math.random() * affordable.length)];
        spawnUnit("opponent", card);
        opponentElixirRef.current -= card.cost;
      }
    }
    opponentElixirRef.current = clamp(opponentElixirRef.current + ELIXIR_REGEN_RATE, 0, MAX_ELIXIR);
  }, 1500);

  // Opponent elixir state managed with ref to avoid re-renders
  const opponentElixirRef = useRef(MAX_ELIXIR);

  // Spawn unit helper
  function spawnUnit(side, card, pos = null) {
    const yBase = side === "player" ? fieldSize.height - 150 : 50;
    const xBase = pos ? pos.x : side === "player" ? 100 : fieldSize.width - 100;
    const newUnit = {
      id: Math.random().toString(36).substr(2, 9),
      card,
      hp: card.hp,
      pos: { x: xBase, y: yBase },
      side,
      target: null,
      lastAttackTime: 0,
    };
    if (side === "player") setPlayerUnits((units) => [...units, newUnit]);
    else setOpponentUnits((units) => [...units, newUnit]);
  }

  // Drag handlers
  function onDragStart(e, card) {
    if (playerElixir < card.cost) {
      e.preventDefault();
      return;
    }
    setDraggingCard(card);
  }

  function onDrop(e) {
    e.preventDefault();
    if (!draggingCard) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (y < fieldSize.height / 2) {
      setDraggingCard(null);
      return; // can't drop on opponent side
    }
    if (playerElixir >= draggingCard.cost) {
      spawnUnit("player", draggingCard, { x, y });
      setPlayerElixir((e) => e - draggingCard.cost);
    }
    setDraggingCard(null);
  }

  function onDragOver(e) {
    e.preventDefault();
  }

  // Game loop: units move and attack
  useInterval(() => {
    setPlayerUnits((units) => {
      let newUnits = units.map((unit) => {
        if (unit.hp <= 0) return null;
        let target = findTarget(unit, opponentUnits, opponentTowerHp, "opponent");
        if (!target) target = { pos: { x: fieldSize.width - 60, y: fieldSize.height - 60 }, isTower: true };
        const dist = distance(unit.pos, target.pos);
        if (dist > unit.card.range) {
          // move closer
          const dx = target.pos.x - unit.pos.x;
          const dy = target.pos.y - unit.pos.y;
          const distNorm = Math.sqrt(dx * dx + dy * dy);
          const moveDist = unit.card.speed * 5;
          const nx = unit.pos.x + (dx / distNorm) * Math.min(moveDist, dist - unit.card.range);
          const ny = unit.pos.y + (dy / distNorm) * Math.min(moveDist, dist - unit.card.range);
          return { ...unit, pos: { x: nx, y: ny }, target };
        } else {
          // attack if cooldown passed
          const now = Date.now();
          if (now - unit.lastAttackTime > 1000) {
            if (target.isTower) {
              setOpponentTowerHp((hp) => Math.max(hp - unit.card.dmg, 0));
            } else {
              target.hp -= unit.card.dmg;
              if (target.hp <= 0) {
                // remove target from opponentUnits
                setOpponentUnits((units) => units.filter((u) => u.id !== target.id));
              }
            }
            return { ...unit, lastAttackTime: now };
          }
          return { ...unit, target };
        }
      });
      return newUnits.filter(Boolean);
    });

    setOpponentUnits((units) => {
      let newUnits = units.map((unit) => {
        if (unit.hp <= 0) return null;
