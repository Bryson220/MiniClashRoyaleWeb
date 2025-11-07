const CARD_DATA = [
  { id: "archer", name: "Archer", cost: 3, hp: 50, dmg: 10, speed: 1.5, range: 100, img: "https://i.imgur.com/3X9QZ9Q.png" },
  { id: "giant", name: "Giant", cost: 5, hp: 200, dmg: 20, speed: 0.7, range: 30, img: "https://i.imgur.com/7Q9XQ9Q.png" },
  { id: "minion", name: "Minion", cost: 2, hp: 30, dmg: 8, speed: 2, range: 50, img: "https://i.imgur.com/6X9X9X9.png" },
  { id: "knight", name: "Knight", cost: 3, hp: 100, dmg: 15, speed: 1, range: 30, img: "https://i.imgur.com/5X9X9X9.png" },
];

const TOWER_HP = 500;
const MAX_ELIXIR = 10;
const ELIXIR_REGEN_RATE = 1; // per second

const { useState, useEffect, useRef } = React;

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function useInterval(callback, delay) {
  const savedCallback = useRef();
  useEffect(() => { savedCallback.current = callback; }, [callback]);
  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}

function Card({ card, onDragStart }) {
  return (
    <img
      src={card.img}
      alt={card.name}
      draggable
      onDragStart={(e) => onDragStart(e, card)}
      title={`${card.name} (Cost: ${card.cost})`}
    />
  );
}

function Unit({ unit }) {
  return (
    <img
      src={unit.card.img}
      alt={unit.card.name}
      style={{
        position: "absolute",
        width: 40,
        height: 40,
        left: unit.pos.x,
        top: unit.pos.y,
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
  return <div style={style} title={`${side} tower HP: ${hp}`}>{hp}</div>;
}

function App() {
  const [playerElixir, setPlayerElixir] = useState(MAX_ELIXIR);
  const [playerUnits, setPlayerUnits] = useState([]);
  const [opponentUnits, setOpponentUnits] = useState([]);
  const [playerTowerHp, setPlayerTowerHp] = useState(TOWER_HP);
  const [opponentTowerHp, setOpponentTowerHp] = useState(TOWER_HP);
  const [draggingCard, setDraggingCard] = useState(null);
  const fieldRef = useRef();

  // Elixir regen
  useInterval(() => {
    setPlayerElixir((e) => clamp(e + ELIXIR_REGEN_RATE, 0, MAX_ELIXIR));
  }, 1000);

  // Opponent AI elixir
  const opponentElixirRef = useRef(MAX_ELIXIR);

  // AI plays cards randomly
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

  function spawnUnit(side, card, pos = null) {
    const yBase = side === "player" ? 300 : 50;
    const xBase = pos ? pos.x : side === "player" ? 100 : 700;
    const newUnit = {
      id: Math.random().toString(36).substr(2, 9),
      card,
      hp: card.hp,
      pos: { x: xBase, y: yBase },
      side,
      lastAttackTime: 0,
    };
    if (side === "player") setPlayerUnits((units) => [...units, newUnit]);
    else setOpponentUnits((units) => [...units, newUnit]);
  }

  function onDragStart(e, card) {
    if (playerElixir < card.cost) e.preventDefault();
    else setDraggingCard(card);
  }

  function onDrop(e) {
    e.preventDefault();
    if (!draggingCard) return;
    const rect = fieldRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (y < 150) { setDraggingCard(null); return; }
    if (playerElixir >= draggingCard.cost) {
      spawnUnit("player", draggingCard, { x, y });
      setPlayerElixir((e) => e - draggingCard.cost);
    }
    setDraggingCard(null);
  }

  function onDragOver(e) { e.preventDefault(); }

  // Game loop: move units and attack towers
  useInterval(() => {
    // Move player units
    setPlayerUnits((units) =>
      units.map((u) => {
        const newX = u.pos.x + u.card.speed * 5;
        // attack tower if close
        if (newX >= 720) {
          setOpponentTowerHp((hp) => Math.max(hp - u.card.dmg, 0));
          return u;
        }
        return { ...u, pos: { x: newX, y: u.pos.y } };
      })
    );
    // Move opponent units
    setOpponentUnits((units) =>
      units.map((u) => {
        const newX = u.pos.x - u.card.speed * 5;
        if (newX <= 80) {
          setPlayerTowerHp((hp) => Math.max(hp - u.card.dmg, 0));
          return u;
        }
        return { ...u, pos: { x: newX, y: u.pos.y } };
      })
    );
  }, 100);

  return (
    <div
      ref={fieldRef}
      style={{ position: "relative", width: 800, height: 400, margin: "auto", background: "#87ceeb" }}
      onDrop={onDrop}
      onDragOver={onDragOver}
    >
      <Tower side="player" hp={playerTowerHp} />
      <Tower side="opponent" hp={opponentTowerHp} />
      {playerUnits.map((u) => <Unit key={u.id} unit={u} />)}
      {opponentUnits.map((u) => <Unit key={u.id} unit={u} />)}

      <div className="card-container">
        {CARD_DATA.map((card) => (
          <Card key={card.id} card={card} onDragStart={onDragStart} />
        ))}
      </div>

      <div style={{ position: "absolute", top: 10, left: 10, fontWeight: "bold" }}>
        Elixir: {playerElixir}
      </div>
    </div>
  );
}

// Render the game
const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
