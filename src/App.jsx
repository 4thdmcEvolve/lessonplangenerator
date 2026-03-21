import { useState, useEffect } from "react";

const NAVY = "#1B3A6B";
const GOLD = "#C9A84C";
const DARK = "#0d1b2a";

function useMediaQuery(query) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = (e) => setMatches(e.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);
  return matches;
}

export default function App() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [topic, setTopic] = useState("");
  const [duration, setDuration] = useState("60");
  const [learningStyle, setLearningStyle] = useState("mixed");
  const [standard, setStandard] = useState("");
  const [extras, setExtras] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    if (!subject || !grade || !topic) {
      setError("Please fill in Subject, Grade Level, and Topic.");
      return;
    }
    setError("");
    setResult("");
    setLoading(true);

    const prompt = `You are an expert curriculum designer. Create a detailed, engaging lesson plan:

Subject: ${subject}
Grade Level: ${grade}
Topic: ${topic}
Duration: ${duration} minutes
Learning Style Focus: ${learningStyle}
${standard ? `Standards/Objectives: ${standard}` : ""}
${extras ? `Special Notes: ${extras}` : ""}

Include these clearly labeled sections:
1. Learning Objectives
2. Materials Needed
3. Warm-Up / Hook (first 5-10 minutes)
4. Direct Instruction
5. Guided Practice
6. Independent Practice
7. Assessment / Exit Ticket
8. Differentiation Strategies
9. Extension Activities

Be specific, creative, practical, and immediately usable by a teacher.`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }]
        })
      });
      const json = await res.json();
      if (json.error) { setError("Error: " + json.error.message); return; }
      const text = (json.content || []).filter(b => b.type === "text").map(b => b.text).join("");
      if (!text) { setError("Nothing returned. Please try again."); return; }
      setResult(text);
    } catch (e) {
      setError("Request failed: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setResult("");
    setError("");
  };

  const renderResult = (text) =>
    text.split("\n").map((line, i) => {
      const t = line.trim();
      if (!t) return <div key={i} style={{ height: 8 }} />;
      if (/^\d+\.\s/.test(t) || /^#{1,3}\s/.test(t)) {
        return (
          <div key={i} style={{ fontWeight: 800, fontSize: 15, color: NAVY, borderLeft: `4px solid ${GOLD}`, paddingLeft: 12, margin: "18px 0 8px" }}>
            {t.replace(/^#+\s*/, "").replace(/\*\*/g, "")}
          </div>
        );
      }
      if (t.startsWith("-") || t.startsWith("•")) {
        return (
          <div key={i} style={{ display: "flex", gap: 10, margin: "5px 0 5px 12px", fontSize: 14, color: "#333", lineHeight: 1.6 }}>
            <span style={{ color: GOLD, fontWeight: 900, flexShrink: 0 }}>•</span>
            <span>{t.replace(/^[-•]\s*/, "").replace(/\*\*/g, "")}</span>
          </div>
        );
      }
      return <div key={i} style={{ fontSize: 14, color: "#444", lineHeight: 1.7, margin: "3px 0" }}>{t.replace(/\*\*/g, "")}</div>;
    });

  const Label = ({ text, required }) => (
    <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 7 }}>
      {text} {required && <span style={{ color: GOLD }}>*</span>}
    </div>
  );

  const inp = (extra = {}) => ({
    width: "100%",
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: isDesktop ? 8 : 10,
    color: "#fff",
    padding: isDesktop ? "11px 14px" : "14px 16px",
    fontSize: isDesktop ? 14 : 16,
    outline: "none",
    fontFamily: "inherit",
    boxSizing: "border-box",
    WebkitAppearance: "none",
    ...extra,
  });

  if (!isDesktop) {
    return (
      <div style={{ minHeight: "100vh", background: `linear-gradient(160deg, ${DARK}, ${NAVY})`, fontFamily: "'Segoe UI', system-ui, sans-serif", padding: "0 0 80px" }}>
        
        <div style={{ textAlign: "center", padding: "40px 20px 28px" }}>
          <div style={{ display: "inline-block", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, letterSpacing: 4, padding: "5px 14px", marginBottom: 14, fontWeight: 700, borderRadius: 2 }}>
            4THDMC | EVOLVE
          </div>
          <div style={{ fontSize: "clamp(32px, 9vw, 52px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, letterSpacing: 1 }}>
            LESSON PLAN<br /><span style={{ color: GOLD }}>GENERATOR</span>
          </div>
          <div style={{ width: 40, height: 3, background: GOLD, margin: "14px auto 10px" }} />
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, fontStyle: "italic" }}>
            "Begin Anyway. Evolve Always. Repeat Forever."
          </div>
        </div>

        {!result && (
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
            <div style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16, padding: "24px 18px" }}>
              <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 3, textTransform: "uppercase", marginBottom: 22 }}>✦ Build Your Lesson Plan</div>

              <div style={{ marginBottom: 16 }}>
                <Label text="Subject" required />
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Business Management" style={inp()} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <Label text="Grade Level" required />
                <select value={grade} onChange={e => setGrade(e.target.value)} style={inp({ background: "#162d52", color: grade ? "#fff" : "rgba(255,255,255,0.35)" })}>
                  <option value="">Select grade...</option>
                  {["K","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th","College"].map(g => <option key={g} value={g}>{g} Grade</option>)}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <Label text="Topic / Lesson Title" required />
                <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Introduction to Accounting" style={inp()} />
              </div>

              <div style={{ marginBottom: 20 }}>
                <Label text="Class Duration" />
                <div style={{ display: "flex", gap: 8 }}>
                  {["30","45","60","75","90"].map(d => (
                    <button key={d} onClick={() => setDuration(d)} style={{
                      flex: 1, padding: "13px 4px", borderRadius: 8,
                      border: `1px solid ${duration === d ? GOLD : "rgba(255,255,255,0.2)"}`,
                      background: duration === d ? "rgba(201,168,76,0.18)" : "transparent",
                      color: duration === d ? GOLD : "rgba(255,255,255,0.55)",
                      fontWeight: 700, fontSize: 14, cursor: "pointer"
                    }}>{d}m</button>
                  ))}
                </div>
              </div>

              <button onClick={() => setShowAdvanced(!showAdvanced)} style={{
                width: "100%", padding: "12px 16px", marginBottom: 20,
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between"
              }}>
                <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13, fontWeight: 600 }}>
                  ⚙️ Advanced Options
                </span>
                <span style={{ color: GOLD, fontSize: 14 }}>{showAdvanced ? "▲" : "▼"}</span>
              </button>

              {showAdvanced && (
                <div style={{ marginBottom: 20, padding: "16px", background: "rgba(255,255,255,0.02)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ marginBottom: 14 }}>
                    <Label text="Learning Style" />
                    <select value={learningStyle} onChange={e => setLearningStyle(e.target.value)} style={inp({ background: "#162d52" })}>
                      <option value="mixed">Mixed / Balanced</option>
                      <option value="visual">Visual Learners</option>
                      <option value="auditory">Auditory Learners</option>
                      <option value="kinesthetic">Kinesthetic / Hands-On</option>
                      <option value="reading">Reading / Writing</option>
                    </select>
                  </div>
                  <div style={{ marginBottom: 14 }}>
                    <Label text="Standards (optional)" />
                    <input value={standard} onChange={e => setStandard(e.target.value)} placeholder="e.g. CCSS.ELA-LITERACY.RL.6.4" style={inp()} />
                  </div>
                  <div>
                    <Label text="Special Notes (optional)" />
                    <textarea value={extras} onChange={e => setExtras(e.target.value)} placeholder="IEP accommodations, class size, technology..." rows={3} style={{ ...inp(), resize: "vertical" }} />
                  </div>
                </div>
              )}

              {error && <div style={{ background: "rgba(255,80,80,0.12)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff9090", padding: "12px 14px", borderRadius: 8, fontSize: 14, marginBottom: 16 }}>{error}</div>}

              <button onClick={generate} disabled={loading} style={{
                width: "100%", padding: 18, background: loading ? "rgba(201,168,76,0.4)" : GOLD,
                color: DARK, border: "none", borderRadius: 10, fontWeight: 900,
                fontSize: 17, letterSpacing: 2, cursor: loading ? "not-allowed" : "pointer", textTransform: "uppercase"
              }}>
                {loading ? "⏳ Generating..." : "GENERATE LESSON PLAN"}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px" }}>
            <div style={{ background: "#fff", borderRadius: 16, padding: "24px 18px", boxShadow: "0 20px 50px rgba(0,0,0,0.5)" }}>
              <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `2px solid ${GOLD}` }}>
                <div style={{ display: "inline-block", background: "rgba(201,168,76,0.12)", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "4px 10px", borderRadius: 20, marginBottom: 8, textTransform: "uppercase" }}>✓ Ready to Use</div>
                <div style={{ fontWeight: 900, fontSize: 19, color: NAVY, lineHeight: 1.2 }}>{topic}</div>
                <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>{grade} Grade · {subject} · {duration} min</div>
              </div>
              <div>{renderResult(result)}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22 }}>
                <button onClick={copy} style={{ padding: 15, background: NAVY, color: "#fff", border: "none", borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  {copied ? "✓ Copied!" : "📋 Copy to Clipboard"}
                </button>
                <button onClick={reset} style={{ padding: 15, background: "transparent", color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                  ← New Lesson Plan
                </button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 48, color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase", padding: "0 16px" }}>
          Powered by <span style={{ color: "rgba(201,168,76,0.35)" }}>4THDMC | EVOLVE</span> · Brandon Russell
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: `linear-gradient(135deg, ${DARK} 0%, ${NAVY} 60%, ${DARK} 100%)`, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      <div style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", padding: "16px 48px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 900, fontSize: 18, color: "#fff", letterSpacing: 1 }}>
          4THDMC <span style={{ color: GOLD }}>|</span> EVOLVE
        </div>
        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12, fontStyle: "italic" }}>
          Lesson Plan Generator
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 40px 80px", display: "grid", gridTemplateColumns: result ? "1fr 1fr" : "1fr", gap: 32, alignItems: "start" }}>

        <div>
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 42, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: 1 }}>
              LESSON PLAN<br /><span style={{ color: GOLD }}>GENERATOR</span>
            </div>
            <div style={{ width: 40, height: 3, background: GOLD, margin: "14px 0 12px" }} />
            <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 14, fontStyle: "italic" }}>
              "Begin Anyway. Evolve Always. Repeat Forever."
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, padding: 28 }}>
            <div style={{ color: GOLD, fontWeight: 700, fontSize: 12, letterSpacing: 3, textTransform: "uppercase", marginBottom: 24 }}>✦ Lesson Details</div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <Label text="Subject" required />
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Business Management" style={inp()} />
              </div>
              <div>
                <Label text="Grade Level" required />
                <select value={grade} onChange={e => setGrade(e.target.value)} style={inp({ background: "#162d52", color: grade ? "#fff" : "rgba(255,255,255,0.35)" })}>
                  <option value="">Select grade...</option>
                  {["K","1st","2nd","3rd","4th","5th","6th","7th","8th","9th","10th","11th","12th","College"].map(g => <option key={g} value={g}>{g} Grade</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Label text="Topic / Lesson Title" required />
              <input value={topic} onChange={e => setTopic(e.target.value)} placeholder="e.g. Introduction to Accounting Principles" style={inp()} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div>
                <Label text="Duration" />
                <select value={duration} onChange={e => setDuration(e.target.value)} style={inp({ background: "#162d52" })}>
                  {["30","45","60","75","90"].map(d => <option key={d} value={d}>{d} minutes</option>)}
                </select>
              </div>
              <div>
                <Label text="Learning Style" />
                <select value={learningStyle} onChange={e => setLearningStyle(e.target.value)} style={inp({ background: "#162d52" })}>
                  <option value="mixed">Mixed / Balanced</option>
                  <option value="visual">Visual Learners</option>
                  <option value="auditory">Auditory Learners</option>
                  <option value="kinesthetic">Kinesthetic / Hands-On</option>
                  <option value="reading">Reading / Writing</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Label text="Standards or Objectives (optional)" />
              <input value={standard} onChange={e => setStandard(e.target.value)} placeholder="e.g. CCSS.ELA-LITERACY.RL.6.4 or custom objective" style={inp()} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <Label text="Special Notes (optional)" />
              <textarea value={extras} onChange={e => setExtras(e.target.value)} placeholder="e.g. IEP accommodations, class size, available technology..." rows={3} style={{ ...inp(), resize: "vertical" }} />
            </div>

            {error && (
              <div style={{ background: "rgba(255,80,80,0.1)", border: "1px solid rgba(255,80,80,0.3)", color: "#ff9090", padding: "12px 16px", borderRadius: 8, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
                {error}
              </div>
            )}

            <button onClick={generate} disabled={loading} style={{
              width: "100%", padding: "16px", background: loading ? "rgba(201,168,76,0.4)" : GOLD,
              color: DARK, border: "none", borderRadius: 8, fontWeight: 900,
              fontSize: 16, letterSpacing: 3, cursor: loading ? "not-allowed" : "pointer", textTransform: "uppercase",
              transition: "all 0.2s", boxShadow: loading ? "none" : "0 4px 20px rgba(201,168,76,0.25)"
            }}>
              {loading ? "⏳  Generating Your Lesson Plan..." : "GENERATE LESSON PLAN"}
            </button>
          </div>
        </div>

        {result && (
          <div style={{ background: "#fff", borderRadius: 14, padding: "32px 28px", boxShadow: "0 24px 60px rgba(0,0,0,0.4)", position: "sticky", top: 24, maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: `2px solid ${GOLD}`, flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ background: "rgba(201,168,76,0.12)", border: `1px solid ${GOLD}`, color: GOLD, fontSize: 10, fontWeight: 700, letterSpacing: 2, padding: "4px 10px", borderRadius: 20, marginBottom: 8, display: "inline-block", textTransform: "uppercase" }}>✓ Ready to Use</div>
                <div style={{ fontWeight: 900, fontSize: 20, color: NAVY, lineHeight: 1.2 }}>{topic}</div>
                <div style={{ color: "#999", fontSize: 12, marginTop: 4 }}>{grade} Grade · {subject} · {duration} min</div>
              </div>
            </div>

            <div>{renderResult(result)}</div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, flexWrap: "wrap" }}>
              <button onClick={copy} style={{ flex: 1, padding: "12px 16px", background: NAVY, color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", letterSpacing: 1, textTransform: "uppercase" }}>
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
              <button onClick={reset} style={{ flex: 1, padding: "12px 16px", background: "transparent", color: NAVY, border: `1px solid ${NAVY}`, borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer", textTransform: "uppercase" }}>
                ← Reset
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", paddingBottom: 32, color: "rgba(255,255,255,0.18)", fontSize: 10, letterSpacing: 3, textTransform: "uppercase" }}>
        Powered by <span style={{ color: "rgba(201,168,76,0.35)" }}>4THDMC | EVOLVE</span> · Brandon Russell
      </div>
    </div>
  );
}
    ├── main.jsx
    └── App.jsx
