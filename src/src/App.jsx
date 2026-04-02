import { useState, useEffect, useRef } from "react";

const MODULES = ["planner", "budget", "health", "reminders"];

const colors = {
  bg: "#0A0A0F",
  surface: "#111118",
  card: "#16161F",
  border: "#1E1E2E",
  accent: "#7B5EA7",
  accentBright: "#A87FDB",
  accentGlow: "#7B5EA720",
  gold: "#D4AF37",
  goldDim: "#D4AF3740",
  text: "#E8E4F0",
  muted: "#6B6880",
  success: "#4CAF82",
  danger: "#E05C5C",
};

const glassStyle = {
  background: `linear-gradient(135deg, ${colors.card}CC, ${colors.surface}99)`,
  border: `1px solid ${colors.border}`,
  backdropFilter: "blur(12px)",
  borderRadius: "16px",
};

function callClaude(systemPrompt, userMessage, onChunk, onDone) {
  fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      stream: true,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  })
    .then(async (res) => {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop();
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6).trim();
            if (json === "[DONE]") continue;
            try {
              const evt = JSON.parse(json);
              if (evt.type === "content_block_delta" && evt.delta?.text) {
                onChunk(evt.delta.text);
              }
            } catch {}
          }
        }
      }
      onDone();
    })
    .catch(() => {
      onChunk("\n\n[Error reaching JEGRAM AI. Please try again.]");
      onDone();
    });
}

// ─── HEADER ───────────────────────────────────────────────────────────────────
function Header({ active, setActive }) {
  const tabs = [
    { id: "planner", icon: "◈", label: "Planner" },
    { id: "budget", icon: "◎", label: "Budget" },
    { id: "health", icon: "◉", label: "Health" },
    { id: "reminders", icon: "◆", label: "Reminders" },
  ];

  return (
    <header style={{
      background: `linear-gradient(180deg, ${colors.bg} 0%, transparent 100%)`,
      borderBottom: `1px solid ${colors.border}`,
      padding: "0 24px",
      position: "sticky",
      top: 0,
      zIndex: 100,
      backdropFilter: "blur(20px)",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 32, height: 64 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `linear-gradient(135deg, ${colors.accent}, ${colors.gold})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#fff",
            boxShadow: `0 0 20px ${colors.accentGlow}`,
          }}>J</div>
          <div>
            <div style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 16, fontWeight: 700, color: colors.text, letterSpacing: 2 }}>JEGRAM AI</div>
            <div style={{ fontSize: 9, color: colors.gold, letterSpacing: 3, textTransform: "uppercase" }}>Your Life. Automated.</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ display: "flex", gap: 4, flex: 1, justifyContent: "center" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActive(t.id)} style={{
              background: active === t.id ? `linear-gradient(135deg, ${colors.accent}30, ${colors.gold}15)` : "transparent",
              border: active === t.id ? `1px solid ${colors.accent}60` : "1px solid transparent",
              borderRadius: 10, padding: "6px 16px", cursor: "pointer",
              color: active === t.id ? colors.accentBright : colors.muted,
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active === t.id ? 600 : 400,
              display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 11 }}>{t.icon}</span> {t.label}
            </button>
          ))}
        </nav>

        <div style={{ fontSize: 11, color: colors.muted, letterSpacing: 1, flexShrink: 0 }}>
          {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </div>
      </div>
    </header>
  );
}

// ─── AI CHAT BUBBLE ────────────────────────────────────────────────────────────
function AIResponse({ text, loading }) {
  if (!text && !loading) return null;
  return (
    <div style={{
      ...glassStyle,
      padding: "16px 20px",
      marginTop: 16,
      borderLeft: `3px solid ${colors.accent}`,
      position: "relative",
    }}>
      <div style={{ fontSize: 10, color: colors.gold, letterSpacing: 2, marginBottom: 8, textTransform: "uppercase" }}>◈ JEGRAM AI</div>
      <div style={{ color: colors.text, fontSize: 14, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
        {text || ""}
        {loading && <span style={{ display: "inline-block", animation: "blink 1s infinite", color: colors.accent }}>▋</span>}
      </div>
    </div>
  );
}

// ─── DAILY PLANNER ────────────────────────────────────────────────────────────
function DailyPlanner() {
  const [tasks, setTasks] = useState([
    { id: 1, text: "Review JEGRAM pitch deck", done: false, priority: "high" },
    { id: 2, text: "Physics assignment - calorimetry", done: false, priority: "medium" },
    { id: 3, text: "Youth club meeting prep", done: true, priority: "low" },
  ]);
  const [newTask, setNewTask] = useState("");
  const [priority, setPriority] = useState("medium");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks(prev => [...prev, { id: Date.now(), text: newTask, done: false, priority }]);
    setNewTask("");
  };

  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const removeTask = (id) => setTasks(prev => prev.filter(t => t.id !== id));

  const getPlanAdvice = () => {
    setAiText(""); setAiLoading(true);
    const pending = tasks.filter(t => !t.done).map(t => `[${t.priority}] ${t.text}`).join(", ");
    callClaude(
      "You are JEGRAM AI's daily planning assistant. You help users prioritize and structure their day. Be concise, motivating, and practical. Max 3 sentences.",
      `My pending tasks for today: ${pending || "none yet"}. How should I tackle these?`,
      chunk => setAiText(p => p + chunk),
      () => setAiLoading(false)
    );
  };

  const prioColor = { high: colors.danger, medium: colors.gold, low: colors.success };
  const done = tasks.filter(t => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: colors.text, margin: 0 }}>Daily Planner</h2>
          <p style={{ color: colors.muted, fontSize: 13, margin: "4px 0 0" }}>{done} of {tasks.length} tasks complete</p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 32, fontWeight: 700, color: colors.accentBright }}>{pct}%</div>
          <div style={{ fontSize: 11, color: colors.muted }}>today's progress</div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: colors.border, borderRadius: 4, marginBottom: 24, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: `linear-gradient(90deg, ${colors.accent}, ${colors.gold})`, borderRadius: 4, transition: "width 0.4s ease" }} />
      </div>

      {/* Add task */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={newTask} onChange={e => setNewTask(e.target.value)}
          onKeyDown={e => e.key === "Enter" && addTask()}
          placeholder="Add a task..."
          style={{ flex: 1, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", color: colors.text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }}
        />
        <select value={priority} onChange={e => setPriority(e.target.value)}
          style={{ background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 12px", color: prioColor[priority], fontSize: 13, cursor: "pointer", fontFamily: "'DM Sans', sans-serif" }}>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <button onClick={addTask} style={{ background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`, border: "none", borderRadius: 10, padding: "10px 20px", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 14 }}>Add</button>
      </div>

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
        {tasks.map(t => (
          <div key={t.id} style={{ ...glassStyle, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, opacity: t.done ? 0.5 : 1, transition: "opacity 0.2s" }}>
            <div onClick={() => toggleTask(t.id)} style={{
              width: 20, height: 20, borderRadius: 6, border: `2px solid ${t.done ? colors.accent : colors.border}`,
              background: t.done ? colors.accent : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              {t.done && <span style={{ color: "#fff", fontSize: 12 }}>✓</span>}
            </div>
            <div style={{ flex: 1, color: colors.text, fontSize: 14, textDecoration: t.done ? "line-through" : "none" }}>{t.text}</div>
            <div style={{ fontSize: 11, color: prioColor[t.priority], background: `${prioColor[t.priority]}20`, padding: "2px 8px", borderRadius: 20, textTransform: "capitalize" }}>{t.priority}</div>
            <button onClick={() => removeTask(t.id)} style={{ background: "none", border: "none", color: colors.muted, cursor: "pointer", fontSize: 16, padding: 0 }}>×</button>
          </div>
        ))}
      </div>

      <button onClick={getPlanAdvice} disabled={aiLoading} style={{
        background: aiLoading ? colors.border : `linear-gradient(135deg, ${colors.accent}30, ${colors.gold}20)`,
        border: `1px solid ${aiLoading ? colors.border : colors.accent}60`,
        borderRadius: 10, padding: "10px 20px", color: colors.accentBright, cursor: aiLoading ? "default" : "pointer", fontSize: 13, fontWeight: 600,
      }}>
        {aiLoading ? "Thinking..." : "◈ Get AI Planning Advice"}
      </button>
      <AIResponse text={aiText} loading={aiLoading} />
    </div>
  );
}

// ─── BUDGET COACH ─────────────────────────────────────────────────────────────
function BudgetCoach() {
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState([
    { id: 1, label: "Transport", amount: 50 },
    { id: 2, label: "Food", amount: 120 },
  ]);
  const [newLabel, setNewLabel] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const total = expenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const remaining = (parseFloat(income) || 0) - total;

  const addExpense = () => {
    if (!newLabel || !newAmount) return;
    setExpenses(p => [...p, { id: Date.now(), label: newLabel, amount: parseFloat(newAmount) }]);
    setNewLabel(""); setNewAmount("");
  };

  const getAdvice = () => {
    setAiText(""); setAiLoading(true);
    const expList = expenses.map(e => `${e.label}: $${e.amount}`).join(", ");
    callClaude(
      "You are JEGRAM AI's budget coach. Give smart, actionable budgeting advice for young entrepreneurs and students. Be direct and practical. Max 4 sentences.",
      `Monthly income: $${income || 0}. Expenses: ${expList}. Remaining: $${remaining}. What's your advice?`,
      chunk => setAiText(p => p + chunk),
      () => setAiLoading(false)
    );
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: colors.text, margin: "0 0 8px" }}>Budget Coach</h2>
      <p style={{ color: colors.muted, fontSize: 13, margin: "0 0 24px" }}>Track income & expenses. Get AI-powered financial guidance.</p>

      {/* Income */}
      <div style={{ ...glassStyle, padding: 20, marginBottom: 16 }}>
        <label style={{ color: colors.muted, fontSize: 12, letterSpacing: 1, textTransform: "uppercase" }}>Monthly Income (USD)</label>
        <input value={income} onChange={e => setIncome(e.target.value)} type="number" placeholder="0.00"
          style={{ display: "block", width: "100%", marginTop: 8, background: "transparent", border: "none", color: colors.success, fontSize: 32, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
      </div>

      {/* Summary bar */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Income", val: `$${parseFloat(income) || 0}`, color: colors.success },
          { label: "Spent", val: `$${total.toFixed(2)}`, color: colors.danger },
          { label: "Remaining", val: `$${remaining.toFixed(2)}`, color: remaining >= 0 ? colors.gold : colors.danger },
        ].map(s => (
          <div key={s.label} style={{ ...glassStyle, padding: "14px 16px", textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Expenses */}
      <div style={{ marginBottom: 16 }}>
        {expenses.map(e => (
          <div key={e.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${colors.border}` }}>
            <span style={{ color: colors.text, fontSize: 14 }}>{e.label}</span>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: colors.danger, fontWeight: 600 }}>-${e.amount}</span>
              <button onClick={() => setExpenses(p => p.filter(x => x.id !== e.id))} style={{ background: "none", border: "none", color: colors.muted, cursor: "pointer" }}>×</button>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="Expense name"
          style={{ flex: 2, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", color: colors.text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
        <input value={newAmount} onChange={e => setNewAmount(e.target.value)} type="number" placeholder="Amount"
          style={{ flex: 1, background: colors.card, border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", color: colors.text, fontSize: 14, fontFamily: "'DM Sans', sans-serif", outline: "none" }} />
        <button onClick={addExpense} style={{ background: `linear-gradient(135deg, ${colors.accent}, ${colors.accentBright})`, border: "none", borderRadius: 10, padding: "10px 18px", color: "#fff", fontWeight: 600, cursor: "pointer" }}>Add</button>
      </div>

      <button onClick={getAdvice} disabled={aiLoading} style={{
        background: aiLoading ? colors.border : `linear-gradient(135deg, ${colors.accent}30, ${colors.gold}20)`,
        border: `1px solid ${aiLoading ? colors.border : colors.accent}60`,
        borderRadius: 10, padding: "10px 20px", color: colors.accentBright, cursor: aiLoading ? "default" : "pointer", fontSize: 13, fontWeight: 600,
      }}>
        {aiLoading ? "Analyzing..." : "◎ Get Budget Advice"}
      </button>
      <AIResponse text={aiText} loading={aiLoading} />
    </div>
  );
}

// ─── HEALTH & WELLNESS ────────────────────────────────────────────────────────
function HealthWellness() {
  const [water, setWater] = useState(0);
  const [sleep, setSleep] = useState("");
  const [mood, setMood] = useState(null);
  const [exercise, setExercise] = useState("");
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const moods = ["😔", "😐", "🙂", "😊", "🤩"];
  const waterGoal = 8;

  const getAdvice = () => {
    setAiText(""); setAiLoading(true);
    callClaude(
      "You are JEGRAM AI's health and wellness coach. Give personalized, encouraging wellness advice for a busy student and entrepreneur. Focus on sustainable habits. Max 4 sentences.",
      `Today's stats: Water glasses: ${water}/${waterGoal}, Sleep: ${sleep || "not logged"} hours, Mood: ${mood !== null ? moods[mood] : "not set"}, Exercise: ${exercise || "none"}. Give me wellness advice.`,
      chunk => setAiText(p => p + chunk),
      () => setAiLoading(false)
    );
  };

  return (
    <div>
      <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, color: colors.text, margin: "0 0 8px" }}>Health & Wellness</h2>
      <p style={{ color: colors.muted, fontSize: 13, margin: "0 0 24px" }}>Track your daily wellness. Let AI guide your habits.</p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
        {/* Water */}
        <div style={{ ...glassStyle, padding: 20 }}>
          <div style={{ fontSize: 12, color: colors.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>💧 Water Intake</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
            {Array.from({ length: waterGoal }).map((_, i) => (
              <div key={i} onClick={() => setWater(i < water ? i : i + 1)}
                style={{ width: 28, height: 28, borderRadius: 8, background: i < water ? `linear-gradient(135deg, #4A90D9, #7BC8F6)` : colors.border, cursor: "pointer", transition: "all 0.2s" }} />
            ))}
          </div>
          <div style={{ color: colors.text, fontSize: 13 }}>{water} / {waterGoal} glasses</div>
        </div>

        {/* Sleep */}
        <div style={{ ...glassStyle, padding: 20 }}>
          <div style={{ fontSize: 12, color: colors.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 12 }}>🌙 Sleep Hours</div>
          <input value={sleep} onChange={e => setSleep(e.target.value)} type="number" min="0" max="24" placeholder="e.g. 7"
            style={{ width: "100%", background: "transparent", border: `1px solid ${colors.border}`, borderRadius: 10, padding: "10px 14px", color: colors.text, fontSize: 22, fontWeight: 700, fontFamily: "'DM Sans', sans-serif", outline: "none", boxSizing: "border-box" }} />
          <div style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}>Recommended: 8–9 hrs</div>
        </div>
      </div>

      {/* Mood */}
      <div style={{ ...glassStyle, padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 12, color: colors.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 14 }}>😊 Today's Mood</div>
        <div style={{ display: "flex", gap: 16, justifyContent: "center" }}>
          {moods.map((m, i) => (
            <button key={i} onClick={() => setMood(i)} style={{
              fontSize: 28, background: "none", border: `2px solid ${m
