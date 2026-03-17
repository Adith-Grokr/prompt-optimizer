import { useState, useEffect, useRef } from "react";

const HARD_KEYWORDS = ["must", "important", "compulsory", "required", "mandatory", "always", "never", "critical", "essential", "necessary", "shall", "need to", "have to"];
const SOFT_KEYWORDS = ["should", "preferably", "ideally", "try to", "consider", "recommend", "suggest", "optional", "if possible", "nice to have", "may", "could"];
// Regex patterns for implicit hard constraints — phrases that signal binding intent
const HARD_PATTERNS = [
  /this\s+[\w\s]*constraint/i,        // "this word count constraint", "this constraint"
  /\bconstraint\s*:/i,                 // "constraint: ..."
  /\bdoes\s+not\s+apply\b/i,          // exclusion rules are binding
  /\bwithin\s+\d+/i,                   // "within 10 words" = tolerance = hard
  /\bdefined\s+as\b/i,                 // definitions are binding
  /\bdo\s+not\b/i,                     // "do not" = prohibition
  /\bexactly\b/i,                      // exact = hard
  /\bat\s+(most|least)\b/i,            // bounds = hard
  /\bno\s+more\s+than\b/i,
  /\bno\s+fewer\s+than\b/i,
];
// Word count specific patterns
const WORD_COUNT_PATTERN = /(?:around|approximately|exactly|about)?\s*(\d+)\s*words?/i;
const TOLERANCE_PATTERN = /within\s+(\d+)\s*words?\s*(difference)?/i;

function extractWordCountConstraint(text) {
  const wcMatch = text.match(WORD_COUNT_PATTERN);
  const tolMatch = text.match(TOLERANCE_PATTERN);
  if (wcMatch) {
    return {
      target: parseInt(wcMatch[1]),
      tolerance: tolMatch ? parseInt(tolMatch[1]) : 0,
      excludeTitles: /title|#|heading|subsection/i.test(text),
    };
  }
  return null;
}

function countWords(text, excludeTitles) {
  const lines = text.split("\n");
  let count = 0;
  lines.forEach(line => {
    if (excludeTitles && /^\s*#+/.test(line)) return; // skip # title lines
    count += line.trim().split(/\s+/).filter(w => w.length > 0).length;
  });
  return count;
}

function classifyConstraints(text) {
  const sentences = text.split(/(?<=[.!?\n])\s+/).filter(s => s.trim());
  const hard = [];
  const soft = [];
  const neutral = [];

  sentences.forEach((s, i) => {
    const lower = s.toLowerCase();
    const isHardKeyword = HARD_KEYWORDS.some(k => lower.includes(k));
    const isHardPattern = HARD_PATTERNS.some(p => p.test(s));
    const isHard = isHardKeyword || isHardPattern;
    const isSoft = !isHard && SOFT_KEYWORDS.some(k => lower.includes(k));

    let matchedKeyword = HARD_KEYWORDS.find(k => lower.includes(k));
    if (!matchedKeyword && isHardPattern) {
      const matched = HARD_PATTERNS.find(p => p.test(s));
      const m = s.match(matched);
      matchedKeyword = m ? m[0].trim().substring(0, 30) : "pattern";
    }
    if (!matchedKeyword) matchedKeyword = SOFT_KEYWORDS.find(k => lower.includes(k));

    if (isHard) hard.push({ text: s.trim(), id: i, keyword: matchedKeyword, satisfied: Math.random() > 0.3 });
    else if (isSoft) soft.push({ text: s.trim(), id: i, keyword: matchedKeyword, satisfied: Math.random() > 0.15 });
    else neutral.push({ text: s.trim(), id: i });
  });
  return { hard, soft, neutral };
}

function computeAttentionWeights(constraints) {
  const { hard, soft, neutral } = constraints;
  const total = hard.length + soft.length + neutral.length || 1;
  const hardW = hard.length > 0 ? 0.6 / hard.length : 0;
  const softW = soft.length > 0 ? 0.3 / soft.length : 0;
  const neutralW = neutral.length > 0 ? 0.1 / neutral.length : 0;
  return {
    hard: hard.map(c => ({ ...c, weight: hardW, attention: (hardW * total * 100).toFixed(0) })),
    soft: soft.map(c => ({ ...c, weight: softW, attention: (softW * total * 100).toFixed(0) })),
    neutral: neutral.map(c => ({ ...c, weight: neutralW, attention: (neutralW * total * 100).toFixed(0) })),
  };
}

function optimizePrompt(text, weighted) {
  let lines = [];
  if (weighted.hard.length > 0) {
    lines.push("## HARD CONSTRAINTS (Must Satisfy)");
    weighted.hard.forEach((c, i) => lines.push(`${i + 1}. [CRITICAL | Attention: ${c.attention}%] ${c.text}`));
    lines.push("");
  }
  if (weighted.soft.length > 0) {
    lines.push("## SOFT CONSTRAINTS (Best Effort)");
    weighted.soft.forEach((c, i) => lines.push(`${i + 1}. [PREFERRED | Attention: ${c.attention}%] ${c.text}`));
    lines.push("");
  }
  if (weighted.neutral.length > 0) {
    lines.push("## CONTEXT");
    weighted.neutral.forEach((c, i) => lines.push(`${i + 1}. ${c.text}`));
  }
  return lines.join("\n");
}

const EXAMPLE_PROMPT = `Please consider this word count constraint: around 540 words (within 10 words difference is ok), this does not apply to title and subsection title lines, which are defined as: lines that start with at least one #.
You must respond in JSON format.
The output should preferably be under 200 words.
Include a summary section at the top.
It is critical to validate all user inputs before processing.
Try to use simple language for readability.
The API must return a 200 status code on success.
Consider adding examples where helpful.
Never expose internal error messages to users.
The response should ideally include pagination metadata.
Always sanitize HTML content in user submissions.`;

const AnimatedBar = ({ width, color, delay }) => {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(width), delay);
    return () => clearTimeout(t);
  }, [width, delay]);
  return (
    <div style={{
      height: 8, borderRadius: 4, background: color,
      width: `${w}%`, transition: "width 0.8s cubic-bezier(0.22, 1, 0.36, 1)",
      boxShadow: `0 0 12px ${color}44`
    }} />
  );
};

const ConstraintTag = ({ type, keyword }) => {
  const colors = {
    hard: { bg: "#ff2d5520", border: "#ff2d55", text: "#ff2d55" },
    soft: { bg: "#ffb82e20", border: "#ffb82e", text: "#ffb82e" },
    neutral: { bg: "#8e8e9320", border: "#8e8e93", text: "#8e8e93" },
  };
  const c = colors[type];
  return (
    <span style={{
      display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 10,
      fontWeight: 700, letterSpacing: 0.8, textTransform: "uppercase",
      background: c.bg, border: `1px solid ${c.border}`, color: c.text, marginRight: 6,
    }}>
      {type === "hard" ? "HARD" : type === "soft" ? "SOFT" : "CTX"}
      {keyword && <span style={{ marginLeft: 4, opacity: 0.7 }}>→ "{keyword}"</span>}
    </span>
  );
};

export default function PromptOptimizer() {
  const [input, setInput] = useState(EXAMPLE_PROMPT);
  const [result, setResult] = useState(null);
  const [view, setView] = useState("split");
  const [animStep, setAnimStep] = useState(0);
  const [sampleOutput, setSampleOutput] = useState(`# Summary\nThis API response provides validated user data in JSON format.\n\n## Details\nThe user inputs were sanitized and validated before processing. All HTML content has been stripped of potentially dangerous tags. The API returned a 200 status code confirming successful processing.\n\nInternal error details have been abstracted into user-friendly messages. Pagination metadata is included below for client-side navigation. The language used throughout aims for clarity and simplicity.`);
  const textRef = useRef(null);

  const runOptimizer = () => {
    setAnimStep(0);
    const constraints = classifyConstraints(input);
    const weighted = computeAttentionWeights(constraints);
    const optimized = optimizePrompt(input, weighted);
    const allHardSatisfied = weighted.hard.every(c => c.satisfied);
    const softSatisfiedCount = weighted.soft.filter(c => c.satisfied).length;
    const wordCountConstraint = extractWordCountConstraint(input);
    const outputWordCount = countWords(sampleOutput, wordCountConstraint?.excludeTitles ?? false);
    setResult({ constraints, weighted, optimized, allHardSatisfied, softSatisfiedCount, wordCountConstraint, outputWordCount });
    setTimeout(() => setAnimStep(1), 100);
    setTimeout(() => setAnimStep(2), 500);
    setTimeout(() => setAnimStep(3), 900);
  };

  useEffect(() => { runOptimizer(); }, []);

  const totalConstraints = result ? result.weighted.hard.length + result.weighted.soft.length + result.weighted.neutral.length : 0;

  return (
    <div style={{
      minHeight: "100vh", background: "#0a0a0f",
      fontFamily: "'DM Sans', 'SF Pro Display', -apple-system, sans-serif",
      color: "#e4e4e7",
    }}>
      {/* Header */}
      <div style={{
        padding: "32px 32px 24px", borderBottom: "1px solid #1a1a2e",
        background: "linear-gradient(180deg, #0f0f1a 0%, #0a0a0f 100%)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: "linear-gradient(135deg, #ff2d55, #ffb82e)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 800, color: "#fff",
          }}>⚡</div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.5,
              background: "linear-gradient(135deg, #ff2d55, #ffb82e)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Universal Prompt Optimizer</h1>
            <p style={{ margin: 0, fontSize: 11, color: "#71717a", letterSpacing: 1, textTransform: "uppercase", fontWeight: 600 }}>
              CSP → COP Constraint Classification Engine
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Input */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#71717a", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8, display: "block" }}>
            Raw Instruction Input
          </label>
          <textarea
            ref={textRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            rows={7}
            style={{
              width: "100%", boxSizing: "border-box", padding: 16, borderRadius: 12,
              background: "#111118", border: "1px solid #222238", color: "#d4d4d8",
              fontSize: 13, lineHeight: 1.7, fontFamily: "'JetBrains Mono', monospace",
              resize: "vertical", outline: "none",
            }}
            placeholder="Paste your instructions here..."
          />
          <button onClick={runOptimizer} style={{
            marginTop: 12, padding: "10px 28px", borderRadius: 8, border: "none",
            background: "linear-gradient(135deg, #ff2d55, #ff6b35)", color: "#fff",
            fontSize: 13, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5,
            boxShadow: "0 4px 20px #ff2d5540",
            transition: "transform 0.15s, box-shadow 0.15s",
          }}
            onMouseEnter={e => { e.target.style.transform = "translateY(-1px)"; e.target.style.boxShadow = "0 6px 28px #ff2d5560"; }}
            onMouseLeave={e => { e.target.style.transform = "translateY(0)"; e.target.style.boxShadow = "0 4px 20px #ff2d5540"; }}
          >
            ▶ Run Optimizer
          </button>
        </div>

        {result && (
          <>
            {/* Algorithm Visualization */}
            <div style={{
              marginBottom: 28, padding: 24, borderRadius: 14,
              background: "#111118", border: "1px solid #1a1a2e",
            }}>
              <h2 style={{ margin: "0 0 20px", fontSize: 14, fontWeight: 700, color: "#a1a1aa", letterSpacing: 1, textTransform: "uppercase" }}>
                🧠 Attention Weight Distribution Algorithm
              </h2>

              {/* Pipeline diagram */}
              <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28, flexWrap: "wrap", justifyContent: "center" }}>
                {[
                  { label: "Parse", icon: "📝", desc: `${totalConstraints} sentences` },
                  { label: "Classify", icon: "🏷️", desc: "keyword match" },
                  { label: "Weight", icon: "⚖️", desc: "attention alloc" },
                  { label: "Optimize", icon: "🎯", desc: "reorder + tag" },
                  { label: "Verify", icon: "✓", desc: "satisfaction" },
                ].map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{
                      padding: "12px 16px", borderRadius: 10, textAlign: "center",
                      background: animStep >= i ? "#1a1a2e" : "#0f0f18",
                      border: `1px solid ${animStep >= i ? "#333355" : "#1a1a2e"}`,
                      transition: "all 0.4s ease", minWidth: 80,
                      opacity: animStep >= i ? 1 : 0.35,
                      transform: animStep >= i ? "scale(1)" : "scale(0.95)",
                    }}>
                      <div style={{ fontSize: 20, marginBottom: 4 }}>{step.icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#e4e4e7" }}>{step.label}</div>
                      <div style={{ fontSize: 9, color: "#71717a", marginTop: 2 }}>{step.desc}</div>
                    </div>
                    {i < 4 && <div style={{ width: 24, height: 2, background: animStep > i ? "#ff2d5566" : "#1a1a2e", margin: "0 2px", transition: "background 0.4s" }} />}
                  </div>
                ))}
              </div>

              {/* Weight bars */}
              <div style={{ display: "grid", gap: 14 }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#ff2d55" }}>■ Hard Constraints ({result.weighted.hard.length})</span>
                    <span style={{ fontSize: 12, color: "#71717a" }}>60% attention budget</span>
                  </div>
                  <div style={{ background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
                    <AnimatedBar width={60} color="#ff2d55" delay={200} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#ffb82e" }}>■ Soft Constraints ({result.weighted.soft.length})</span>
                    <span style={{ fontSize: 12, color: "#71717a" }}>30% attention budget</span>
                  </div>
                  <div style={{ background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
                    <AnimatedBar width={30} color="#ffb82e" delay={400} />
                  </div>
                </div>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#8e8e93" }}>■ Neutral Context ({result.weighted.neutral.length})</span>
                    <span style={{ fontSize: 12, color: "#71717a" }}>10% attention budget</span>
                  </div>
                  <div style={{ background: "#1a1a2e", borderRadius: 4, overflow: "hidden" }}>
                    <AnimatedBar width={10} color="#8e8e93" delay={600} />
                  </div>
                </div>
              </div>
            </div>

            {/* View Toggle */}
            <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#111118", borderRadius: 8, padding: 4, width: "fit-content" }}>
              {["split", "before", "after", "output"].map(v => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "6px 16px", borderRadius: 6, border: "none",
                  background: view === v ? "#222238" : "transparent",
                  color: view === v ? "#e4e4e7" : "#71717a",
                  fontSize: 12, fontWeight: 600, cursor: "pointer", textTransform: "capitalize",
                  transition: "all 0.2s",
                }}>{v}</button>
              ))}
            </div>

            {/* Split / Before / After views */}
            <div style={{ display: "grid", gridTemplateColumns: view === "split" ? "1fr 1fr" : "1fr", gap: 20, marginBottom: 28 }}>
              {(view === "split" || view === "before") && (
                <div style={{
                  padding: 20, borderRadius: 14, background: "#111118",
                  border: "1px solid #1a1a2e",
                }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#ff2d55" }}>
                    ✗ BEFORE — Raw Prompt (CSP)
                  </h3>
                  <p style={{ margin: "0 0 16px", fontSize: 10, color: "#71717a" }}>
                    All constraints treated equally — no priority differentiation
                  </p>
                  <div style={{
                    fontFamily: "'JetBrains Mono', monospace", fontSize: 11,
                    lineHeight: 2, color: "#a1a1aa", whiteSpace: "pre-wrap",
                  }}>
                    {input.split(/(?<=[.!?\n])\s+/).filter(s => s.trim()).map((s, i) => (
                      <div key={i} style={{
                        padding: "4px 10px", margin: "4px 0", borderRadius: 6,
                        background: "#0f0f18", borderLeft: "3px solid #333355",
                      }}>
                        <span style={{ color: "#52525b", marginRight: 8 }}>{String(i + 1).padStart(2, "0")}</span>
                        {s.trim()}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(view === "split" || view === "after") && (
                <div style={{
                  padding: 20, borderRadius: 14, background: "#111118",
                  border: "1px solid #1a1a2e",
                }}>
                  <h3 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 700, color: "#34d399" }}>
                    ✓ AFTER — Optimized Prompt (COP)
                  </h3>
                  <p style={{ margin: "0 0 16px", fontSize: 10, color: "#71717a" }}>
                    Constraints classified, weighted, and priority-ordered
                  </p>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, lineHeight: 1.8 }}>
                    {result.weighted.hard.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#ff2d55", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
                          ■ Hard Constraints — Must Satisfy
                        </div>
                        {result.weighted.hard.map((c, i) => (
                          <div key={i} style={{
                            padding: "6px 10px", margin: "4px 0", borderRadius: 6,
                            background: "#ff2d5510", borderLeft: "3px solid #ff2d55",
                            color: "#f0f0f0",
                          }}>
                            <ConstraintTag type="hard" keyword={c.keyword} />
                            <span style={{ fontSize: 9, color: "#ff2d55", fontWeight: 700, marginRight: 6 }}>
                              W:{c.attention}%
                            </span>
                            {c.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.weighted.soft.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#ffb82e", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
                          ■ Soft Constraints — Best Effort
                        </div>
                        {result.weighted.soft.map((c, i) => (
                          <div key={i} style={{
                            padding: "6px 10px", margin: "4px 0", borderRadius: 6,
                            background: "#ffb82e10", borderLeft: "3px solid #ffb82e",
                            color: "#f0f0f0",
                          }}>
                            <ConstraintTag type="soft" keyword={c.keyword} />
                            <span style={{ fontSize: 9, color: "#ffb82e", fontWeight: 700, marginRight: 6 }}>
                              W:{c.attention}%
                            </span>
                            {c.text}
                          </div>
                        ))}
                      </div>
                    )}
                    {result.weighted.neutral.length > 0 && (
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 800, color: "#8e8e93", letterSpacing: 1, marginBottom: 6, textTransform: "uppercase" }}>
                          ■ Context
                        </div>
                        {result.weighted.neutral.map((c, i) => (
                          <div key={i} style={{
                            padding: "6px 10px", margin: "4px 0", borderRadius: 6,
                            background: "#8e8e9310", borderLeft: "3px solid #8e8e93",
                            color: "#a1a1aa",
                          }}>
                            <ConstraintTag type="neutral" />
                            {c.text}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Simulated Output with Highlights */}
            {(view === "split" || view === "output") && (
              <div style={{
                padding: 24, borderRadius: 14, background: "#111118",
                border: "1px solid #1a1a2e", marginBottom: 28,
              }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>
                  📋 Simulated Agent Output — Constraint Satisfaction Report
                </h3>
                <p style={{ margin: "0 0 20px", fontSize: 10, color: "#71717a" }}>
                  Hard constraint violations → RED | Soft constraint misses → YELLOW | Satisfied → GREEN
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
                  <div style={{
                    padding: 16, borderRadius: 10,
                    background: result.weighted.hard.every(c => c.satisfied) ? "#34d39910" : "#ff2d5510",
                    border: `1px solid ${result.weighted.hard.every(c => c.satisfied) ? "#34d39933" : "#ff2d5533"}`,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", marginBottom: 4 }}>Hard Satisfaction</div>
                    <div style={{
                      fontSize: 28, fontWeight: 800,
                      color: result.weighted.hard.every(c => c.satisfied) ? "#34d399" : "#ff2d55",
                    }}>
                      {result.weighted.hard.filter(c => c.satisfied).length}/{result.weighted.hard.length}
                    </div>
                    <div style={{ fontSize: 10, color: "#71717a" }}>
                      {result.weighted.hard.every(c => c.satisfied) ? "✓ All critical constraints met" : "✗ VIOLATION — requires retry"}
                    </div>
                  </div>
                  <div style={{
                    padding: 16, borderRadius: 10,
                    background: "#ffb82e10", border: "1px solid #ffb82e33",
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", marginBottom: 4 }}>Soft Satisfaction</div>
                    <div style={{ fontSize: 28, fontWeight: 800, color: "#ffb82e" }}>
                      {result.softSatisfiedCount}/{result.weighted.soft.length}
                    </div>
                    <div style={{ fontSize: 10, color: "#71717a" }}>
                      Best effort — {result.softSatisfiedCount === result.weighted.soft.length ? "all met" : "partial"}
                    </div>
                  </div>
                </div>

                {/* Individual constraint status */}
                <div style={{ display: "grid", gap: 6 }}>
                  {result.weighted.hard.map((c, i) => (
                    <div key={`h${i}`} style={{
                      padding: "8px 12px", borderRadius: 8, fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: c.satisfied ? "#34d39908" : "#ff2d5515",
                      borderLeft: `4px solid ${c.satisfied ? "#34d399" : "#ff2d55"}`,
                      color: c.satisfied ? "#a1a1aa" : "#ff8a8a",
                      fontWeight: c.satisfied ? 400 : 600,
                    }}>
                      <span style={{ marginRight: 8 }}>{c.satisfied ? "✓" : "✗"}</span>
                      <ConstraintTag type="hard" />
                      {c.text}
                      {!c.satisfied && (
                        <span style={{
                          display: "inline-block", marginLeft: 8, padding: "1px 8px",
                          borderRadius: 4, background: "#ff2d55", color: "#fff",
                          fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                        }}>VIOLATION — RETRY REQUIRED</span>
                      )}
                    </div>
                  ))}
                  {result.weighted.soft.map((c, i) => (
                    <div key={`s${i}`} style={{
                      padding: "8px 12px", borderRadius: 8, fontSize: 12,
                      fontFamily: "'JetBrains Mono', monospace",
                      background: c.satisfied ? "#34d39908" : "#ffb82e12",
                      borderLeft: `4px solid ${c.satisfied ? "#34d399" : "#ffb82e"}`,
                      color: c.satisfied ? "#a1a1aa" : "#ffd166",
                    }}>
                      <span style={{ marginRight: 8 }}>{c.satisfied ? "✓" : "△"}</span>
                      <ConstraintTag type="soft" />
                      {c.text}
                      {!c.satisfied && (
                        <span style={{
                          display: "inline-block", marginLeft: 8, padding: "1px 8px",
                          borderRadius: 4, background: "#ffb82e", color: "#000",
                          fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
                        }}>DEGRADED — BEST EFFORT</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Word Count Validation Panel */}
            {(view === "split" || view === "output") && result.wordCountConstraint && (
              <div style={{
                padding: 24, borderRadius: 14, background: "#111118",
                border: "1px solid #1a1a2e", marginBottom: 28,
              }}>
                <h3 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>
                  📏 Word Count Constraint — Live Validation
                </h3>
                <p style={{ margin: "0 0 16px", fontSize: 10, color: "#71717a" }}>
                  Target: {result.wordCountConstraint.target} words ± {result.wordCountConstraint.tolerance} | Lines starting with # excluded from count
                </p>

                {/* Word count gauge */}
                {(() => {
                  const wc = countWords(sampleOutput, result.wordCountConstraint.excludeTitles);
                  const target = result.wordCountConstraint.target;
                  const tol = result.wordCountConstraint.tolerance;
                  const min = target - tol;
                  const max = target + tol;
                  const inRange = wc >= min && wc <= max;
                  const pct = Math.min((wc / (target * 1.4)) * 100, 100);
                  const minPct = (min / (target * 1.4)) * 100;
                  const maxPct = (max / (target * 1.4)) * 100;

                  return (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
                        <span style={{
                          fontSize: 36, fontWeight: 800,
                          color: inRange ? "#34d399" : "#ff2d55",
                        }}>{wc}</span>
                        <span style={{ fontSize: 13, color: "#71717a" }}>
                          / {target} target ({min}–{max} acceptable)
                        </span>
                      </div>
                      {/* Gauge bar */}
                      <div style={{ position: "relative", height: 12, background: "#1a1a2e", borderRadius: 6, overflow: "visible", marginBottom: 6 }}>
                        {/* Acceptable zone */}
                        <div style={{
                          position: "absolute", left: `${minPct}%`, width: `${maxPct - minPct}%`,
                          height: "100%", background: "#34d39920", borderRadius: 6,
                          border: "1px dashed #34d39944",
                        }} />
                        {/* Current count bar */}
                        <div style={{
                          height: "100%", borderRadius: 6,
                          width: `${pct}%`, background: inRange
                            ? "linear-gradient(90deg, #34d399, #34d399)"
                            : wc < min
                              ? "linear-gradient(90deg, #ffb82e, #ff6b35)"
                              : "linear-gradient(90deg, #ff6b35, #ff2d55)",
                          transition: "width 0.5s ease",
                          boxShadow: inRange ? "0 0 12px #34d39944" : "0 0 12px #ff2d5544",
                        }} />
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#52525b" }}>
                        <span>0</span>
                        <span style={{ color: "#34d39988" }}>▲ {min}</span>
                        <span style={{ color: "#34d399" }}>▲ {target}</span>
                        <span style={{ color: "#34d39988" }}>▲ {max}</span>
                        <span>{Math.round(target * 1.4)}</span>
                      </div>

                      {/* Status badge */}
                      <div style={{
                        marginTop: 12, display: "inline-block", padding: "4px 14px", borderRadius: 6,
                        fontSize: 11, fontWeight: 800, letterSpacing: 0.8,
                        background: inRange ? "#34d39920" : "#ff2d5520",
                        color: inRange ? "#34d399" : "#ff2d55",
                        border: `1px solid ${inRange ? "#34d39944" : "#ff2d5544"}`,
                      }}>
                        {inRange
                          ? "✓ HARD CONSTRAINT SATISFIED — word count within tolerance"
                          : wc < min
                            ? `✗ VIOLATION — ${min - wc} words SHORT of minimum → RETRY REQUIRED`
                            : `✗ VIOLATION — ${wc - max} words OVER maximum → RETRY REQUIRED`}
                      </div>
                    </div>
                  );
                })()}

                {/* Editable sample output */}
                <label style={{ fontSize: 10, fontWeight: 700, color: "#52525b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6, display: "block" }}>
                  Sample Agent Output (edit to test validation)
                </label>
                <div style={{ position: "relative" }}>
                  <textarea
                    value={sampleOutput}
                    onChange={e => {
                      setSampleOutput(e.target.value);
                      if (result) {
                        const wc = countWords(e.target.value, result.wordCountConstraint?.excludeTitles ?? false);
                        setResult(prev => ({ ...prev, outputWordCount: wc }));
                      }
                    }}
                    rows={6}
                    style={{
                      width: "100%", boxSizing: "border-box", padding: 14, borderRadius: 10,
                      background: "#0a0a0f", border: "1px solid #222238", color: "#d4d4d8",
                      fontSize: 12, lineHeight: 1.8, fontFamily: "'JetBrains Mono', monospace",
                      resize: "vertical", outline: "none",
                    }}
                  />
                </div>

                {/* Show line-by-line breakdown */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#52525b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>
                    Line-by-Line Word Count (# lines excluded)
                  </div>
                  {sampleOutput.split("\n").map((line, i) => {
                    const isTitle = /^\s*#+/.test(line);
                    const words = line.trim().split(/\s+/).filter(w => w.length > 0).length;
                    return (
                      <div key={i} style={{
                        padding: "3px 10px", margin: "2px 0", borderRadius: 4, fontSize: 11,
                        fontFamily: "'JetBrains Mono', monospace",
                        background: isTitle ? "#8e8e9308" : "#0f0f18",
                        borderLeft: isTitle ? "3px solid #8e8e93" : "3px solid #222238",
                        color: isTitle ? "#8e8e93" : "#a1a1aa",
                        textDecoration: isTitle ? "line-through" : "none",
                        opacity: isTitle ? 0.5 : 1,
                      }}>
                        <span style={{ color: "#52525b", marginRight: 6, minWidth: 40, display: "inline-block" }}>
                          {isTitle ? "SKIP" : `+${words}`}
                        </span>
                        {line || "(empty line)"}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* COP Formulation */}
            <div style={{
              padding: 24, borderRadius: 14, background: "#111118",
              border: "1px solid #1a1a2e",
            }}>
              <h3 style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: "#e4e4e7" }}>
                📐 COP Formulation
              </h3>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: 12,
                lineHeight: 2.2, color: "#a1a1aa", padding: 16, borderRadius: 10,
                background: "#0a0a0f",
              }}>
                <div><span style={{ color: "#ff2d55" }}>minimize</span> Σ w_i · violation(c_i)</div>
                <div><span style={{ color: "#ffb82e" }}>subject to</span></div>
                <div style={{ paddingLeft: 20 }}>
                  <div><span style={{ color: "#ff2d55" }}>∀ c ∈ Hard:</span> satisfaction(c) = 1 <span style={{ color: "#52525b" }}>// must satisfy</span></div>
                  <div><span style={{ color: "#ffb82e" }}>∀ c ∈ Soft:</span> maximize Σ satisfaction(c) <span style={{ color: "#52525b" }}>// best effort</span></div>
                </div>
                <div style={{ marginTop: 8 }}>
                  <span style={{ color: "#71717a" }}>where</span> w_hard = 0.6/{result.weighted.hard.length || 1}, w_soft = 0.3/{result.weighted.soft.length || 1}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
