import { useState, useEffect, useRef } from "react";

// ── Constants ────────────────────────────────────────────────────────
const API_URL = "https://api.anthropic.com/v1/messages";
const getApiKey = () => {
  if (typeof import.meta !== "undefined" && import.meta.env?.VITE_ANTHROPIC_API_KEY) {
    return import.meta.env.VITE_ANTHROPIC_API_KEY;
  }
  return localStorage.getItem("keiba_api_key") || "";
};

const RACECOURSES_JRA = [
  "東京", "中山", "阪神", "京都", "中京", "小倉", "新潟", "福島", "札幌", "函館"
];
const RACECOURSES_NAR = [
  "大井", "川崎", "船橋", "浦和", "門別", "園田", "姫路", "名古屋", "笠松",
  "金沢", "高知", "佐賀", "盛岡", "水沢"
];

const TICKET_TYPES = [
  { id: "tansho", label: "単勝", desc: "1着を当てる" },
  { id: "fukusho", label: "複勝", desc: "3着以内を当てる" },
  { id: "umaren", label: "馬連", desc: "1-2着を当てる(順不同)" },
  { id: "umatan", label: "馬単", desc: "1-2着を当てる(順番通り)" },
  { id: "wide", label: "ワイド", desc: "3着以内の2頭(順不同)" },
  { id: "sanrenpuku", label: "三連複", desc: "1-2-3着を当てる(順不同)" },
  { id: "sanrentan", label: "三連単", desc: "1-2-3着を当てる(順番通り)" },
];

// ── Styles ───────────────────────────────────────────────────────────
const C = {
  bg: "#1a0a2e",
  card: "#241545",
  border: "#3d2a6e",
  accent: "#f0c040",
  accent2: "#e8a020",
  text: "#e8e0f0",
  dim: "#8a7aaa",
  green: "#40d080",
  red: "#f05050",
  blue: "#50a0f0",
};

const S = {
  app: {
    height: "100dvh", display: "flex", flexDirection: "column",
    background: C.bg, fontFamily: "'Pretendard', -apple-system, sans-serif",
    color: C.text, overflow: "hidden",
  },
  header: {
    padding: "12px 16px", display: "flex", alignItems: "center",
    justifyContent: "space-between", borderBottom: `1px solid ${C.border}`,
    background: "linear-gradient(135deg, #1a0a2e 0%, #2d1560 100%)", flexShrink: 0,
  },
  logo: {
    fontSize: "17px", fontWeight: 800, color: C.accent, letterSpacing: "-0.5px",
  },
  tabBar: {
    display: "flex", borderBottom: `1px solid ${C.border}`,
    background: C.bg, flexShrink: 0, overflow: "auto",
  },
  tab: (active) => ({
    flex: 1, padding: "11px 0", textAlign: "center", fontSize: "12px",
    fontWeight: active ? 700 : 400, color: active ? C.accent : C.dim,
    borderBottom: active ? `2px solid ${C.accent}` : "2px solid transparent",
    background: "transparent", border: "none", cursor: "pointer",
    transition: "all 0.2s", whiteSpace: "nowrap", minWidth: "70px",
  }),
  content: { flex: 1, overflow: "auto", padding: "12px" },
  card: {
    background: C.card, borderRadius: "12px", padding: "14px",
    marginBottom: "10px", border: `1px solid ${C.border}`,
  },
  input: {
    width: "100%", padding: "10px 12px", background: "#2d1560",
    border: `1px solid ${C.border}`, borderRadius: "8px",
    color: C.text, fontSize: "14px", outline: "none", fontFamily: "inherit",
  },
  select: {
    width: "100%", padding: "10px 12px", background: "#2d1560",
    border: `1px solid ${C.border}`, borderRadius: "8px",
    color: C.text, fontSize: "14px", outline: "none", fontFamily: "inherit",
    appearance: "none", cursor: "pointer",
  },
  label: { fontSize: "12px", color: C.dim, marginBottom: "5px", display: "block", fontWeight: 500 },
  btn: (primary) => ({
    width: "100%", padding: "13px", borderRadius: "10px", border: "none",
    fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s",
    background: primary ? `linear-gradient(135deg, ${C.accent}, ${C.accent2})` : "#2d1560",
    color: primary ? "#1a0a2e" : C.text,
  }),
  chip: (selected) => ({
    display: "inline-block", padding: "6px 12px", borderRadius: "16px",
    fontSize: "12px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
    border: selected ? `2px solid ${C.accent}` : `2px solid ${C.border}`,
    background: selected ? `${C.accent}18` : "transparent",
    color: selected ? C.accent : C.dim, margin: "3px",
  }),
  badge: (color) => ({
    display: "inline-block", padding: "2px 8px", borderRadius: "10px",
    fontSize: "11px", fontWeight: 700, background: `${color}22`, color: color,
  }),
  empty: { textAlign: "center", padding: "50px 20px", color: C.dim },
  copyBtn: {
    padding: "5px 10px", borderRadius: "6px", border: `1px solid ${C.border}`,
    background: "transparent", color: C.dim, fontSize: "11px", cursor: "pointer",
  },
};

// ── API Calls ────────────────────────────────────────────────────────
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function callKeibaAI(prompt, systemPrompt, retryCount = 0) {
  const key = getApiKey();
  if (!key) throw new Error("APIキーを設定してください。");

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json", "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4000,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
    }),
  });

  if (res.status === 429 && retryCount < 2) {
    const waitSec = 30 + retryCount * 15;
    console.log(`Rate limited. Waiting ${waitSec}s before retry...`);
    await delay(waitSec * 1000);
    return callKeibaAI(prompt, systemPrompt, retryCount + 1);
  }

  if (!res.ok) throw new Error(`API エラー (${res.status}): ${await res.text()}`);

  const data = await res.json();
  const textBlocks = data.content.filter((b) => b.type === "text").map((b) => b.text);
  return textBlocks.join("\n").trim();
}

async function fetchRacePrediction(org, course, raceDate, raceNum) {
  const orgLabel = org === "jra" ? "JRA（中央競馬）" : "NAR（地方競馬）";
  const systemPrompt = `あなたは日本競馬予想の専門家AIです。
データ分析と統計に基づいた合理的な予想を行います。

分析観点：
- 出走馬の近走成績・クラス実績
- 騎手・調教師のコース適性
- 距離適性・馬場状態への対応
- 枠順の有利不利
- ローテーション・間隔
- 展開予想（ペース・隊列）

出力形式（必ず以下のJSON形式で）：
{
  "race_info": {
    "date": "開催日",
    "course": "競馬場",
    "race_number": レース番号,
    "race_name": "レース名",
    "distance": "距離",
    "surface": "芝/ダート",
    "grade": "クラス/グレード",
    "horse_count": 出走頭数
  },
  "predictions": [
    {
      "rank": 1,
      "horse_number": 馬番,
      "horse_name": "馬名",
      "jockey": "騎手",
      "reason": "推奨理由（2-3文）",
      "confidence": "S/A/B/C"
    }
  ],
  "pace_analysis": "展開予想の説明",
  "track_condition_note": "馬場状態に関する注意点",
  "dark_horse": {
    "horse_number": 馬番,
    "horse_name": "穴馬名",
    "reason": "穴馬推奨理由"
  },
  "risk_factors": ["リスク要因1", "リスク要因2"]
}

規則：
- 上位5頭まで予想（confidence: S=本命, A=対抗, B=単穴, C=連下）
- Webで最新の出馬表・オッズを検索して分析
- 必ずJSON形式のみ出力（マークダウンコードブロック不要）`;

  const prompt = `${orgLabel}の${course}競馬場、${raceDate}の第${raceNum}レースを予想してください。

Webで「${course} ${raceDate} ${raceNum}レース 出馬表」を検索し、最新の出走馬情報を元に予想してください。
netkeiba.comやJRA公式サイトの情報を参照してください。`;

  const raw = await callKeibaAI(prompt, systemPrompt);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*"predictions"[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { raw_response: raw, error: "JSON解析失敗" };
}

async function fetchTicketCombo(prediction, ticketTypes, budget) {
  const systemPrompt = `あなたは日本競馬の馬券戦略の専門家です。
AI予想結果に基づいて最適な馬券の買い目を提案します。

出力形式（JSON）：
{
  "strategy_summary": "買い目戦略の概要",
  "tickets": [
    {
      "type": "馬券種類",
      "combinations": ["買い目（例: 3-5-8）"],
      "amount_each": 1枚あたり金額,
      "total_amount": 合計金額,
      "expected_odds_range": "予想配当レンジ",
      "hit_probability": "的中確率評価（高/中/低）",
      "reasoning": "この買い目の根拠"
    }
  ],
  "total_investment": 総投資額,
  "budget_remaining": 残り予算,
  "risk_reward_note": "リスク・リターン分析"
}

規則：
- 予算内で収まるように配分
- 的中確率と配当のバランスを考慮
- 本命サイド・穴サイドの両方を含む戦略
- 必ずJSON形式のみ出力`;

  const typesStr = ticketTypes.map((t) => TICKET_TYPES.find((tt) => tt.id === t)?.label).join("、");
  const prompt = `以下のAI予想結果に基づいて馬券の買い目を提案してください。

予算: ${budget}円
希望馬券種類: ${typesStr}

AI予想結果:
${JSON.stringify(prediction, null, 2)}`;

  const raw = await callKeibaAI(prompt, systemPrompt);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*"tickets"[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { raw_response: raw, error: "JSON解析失敗" };
}

async function fetchTodayRaces(org) {
  const systemPrompt = `あなたは日本競馬の情報アシスタントです。
今日の開催レース一覧を提供します。

出力形式（JSON）：
{
  "date": "本日の日付",
  "meetings": [
    {
      "course": "競馬場名",
      "org": "JRA/NAR",
      "race_count": レース数,
      "featured_race": "メインレース名（あれば）",
      "surface": "芝/ダート/両方"
    }
  ],
  "note": "開催に関する補足"
}

必ずJSON形式のみ出力。`;

  const orgLabel = org === "jra" ? "JRA（中央競馬）" : org === "nar" ? "NAR（地方競馬）" : "JRAとNAR";
  const prompt = `今日の${orgLabel}の開催情報をWebで検索して教えてください。どの競馬場で何レース開催されているか確認してください。`;

  const raw = await callKeibaAI(prompt, systemPrompt);
  try {
    const jsonMatch = raw.match(/\{[\s\S]*"meetings"[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {}
  return { raw_response: raw, error: "JSON解析失敗" };
}

// ── Components ───────────────────────────────────────────────────────

function ConfidenceBadge({ level }) {
  const colors = { S: "#f0c040", A: "#f05050", B: "#50a0f0", C: "#40d080" };
  const labels = { S: "◎本命", A: "○対抗", B: "▲単穴", C: "△連下" };
  return <span style={S.badge(colors[level] || C.dim)}>{labels[level] || level}</span>;
}

function PredictionResult({ pred }) {
  if (pred.error && !pred.predictions) {
    return (
      <div style={S.card}>
        <div style={{ color: C.red, fontSize: 13 }}>⚠️ {pred.error}</div>
        {pred.raw_response && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.dim, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
            {pred.raw_response}
          </div>
        )}
      </div>
    );
  }

  const info = pred.race_info || {};
  return (
    <div>
      {/* Race Info */}
      <div style={{ ...S.card, background: "linear-gradient(135deg, #2d1560, #1a0a2e)" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: C.accent, marginBottom: 6 }}>
          🏇 {info.race_name || "レース情報"}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, fontSize: 12, color: C.dim }}>
          {info.course && <span>📍{info.course}</span>}
          {info.distance && <span>📏{info.distance}</span>}
          {info.surface && <span>🏟️{info.surface}</span>}
          {info.grade && <span>🏆{info.grade}</span>}
          {info.horse_count && <span>🐴{info.horse_count}頭</span>}
        </div>
      </div>

      {/* Predictions */}
      {(pred.predictions || []).map((p, i) => (
        <div key={i} style={{ ...S.card, borderLeft: `3px solid ${i === 0 ? C.accent : i === 1 ? C.red : C.blue}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 800, color: i === 0 ? C.accent : C.text }}>
                {p.horse_number}
              </span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{p.horse_name}</div>
                <div style={{ fontSize: 11, color: C.dim }}>{p.jockey}</div>
              </div>
            </div>
            <ConfidenceBadge level={p.confidence} />
          </div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>{p.reason}</div>
        </div>
      ))}

      {/* Pace Analysis */}
      {pred.pace_analysis && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 4 }}>📊 展開予想</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: C.dim }}>{pred.pace_analysis}</div>
        </div>
      )}

      {/* Dark Horse */}
      {pred.dark_horse && (
        <div style={{ ...S.card, borderLeft: `3px solid ${C.green}` }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.green, marginBottom: 4 }}>🌟 穴馬注目</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
            {pred.dark_horse.horse_number}番 {pred.dark_horse.horse_name}
          </div>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{pred.dark_horse.reason}</div>
        </div>
      )}

      {/* Risk */}
      {pred.risk_factors && pred.risk_factors.length > 0 && (
        <div style={S.card}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.red, marginBottom: 4 }}>⚠️ リスク要因</div>
          {pred.risk_factors.map((r, i) => (
            <div key={i} style={{ fontSize: 12, color: C.dim, padding: "2px 0 2px 10px", borderLeft: `2px solid ${C.red}33` }}>{r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function TicketResult({ combo }) {
  if (combo.error && !combo.tickets) {
    return (
      <div style={S.card}>
        <div style={{ color: C.red, fontSize: 13 }}>⚠️ {combo.error}</div>
        {combo.raw_response && (
          <div style={{ marginTop: 8, fontSize: 12, color: C.dim, whiteSpace: "pre-wrap", maxHeight: 200, overflow: "auto" }}>
            {combo.raw_response}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      {combo.strategy_summary && (
        <div style={{ ...S.card, background: "linear-gradient(135deg, #2d1560, #1a0a2e)" }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: C.accent, marginBottom: 4 }}>🎯 買い目戦略</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{combo.strategy_summary}</div>
        </div>
      )}

      {(combo.tickets || []).map((t, i) => (
        <div key={i} style={{ ...S.card, borderLeft: `3px solid ${C.accent}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.accent }}>{t.type}</span>
            <span style={S.badge(t.hit_probability === "高" ? C.green : t.hit_probability === "中" ? C.accent : C.red)}>
              的中率: {t.hit_probability}
            </span>
          </div>
          <div style={{ marginBottom: 6 }}>
            {(t.combinations || []).map((c, j) => (
              <span key={j} style={{
                display: "inline-block", padding: "4px 10px", margin: "2px",
                background: "#2d1560", borderRadius: "6px", fontSize: 13, fontWeight: 600,
                fontFamily: "monospace", color: C.text, border: `1px solid ${C.border}`,
              }}>
                {c}
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, fontSize: 12, color: C.dim, marginBottom: 4 }}>
            <span>各{t.amount_each?.toLocaleString()}円</span>
            <span>計{t.total_amount?.toLocaleString()}円</span>
            <span>配当: {t.expected_odds_range}</span>
          </div>
          <div style={{ fontSize: 11, color: C.dim, lineHeight: 1.5 }}>{t.reasoning}</div>
        </div>
      ))}

      <div style={{ ...S.card, display: "flex", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 12, color: C.dim }}>総投資額</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.accent }}>{combo.total_investment?.toLocaleString()}円</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 12, color: C.dim }}>残り予算</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: C.green }}>{combo.budget_remaining?.toLocaleString()}円</div>
        </div>
      </div>

      {combo.risk_reward_note && (
        <div style={S.card}>
          <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.6 }}>💡 {combo.risk_reward_note}</div>
        </div>
      )}
    </div>
  );
}

// ── Tab: Predict ─────────────────────────────────────────────────────
function PredictTab({ onPredicted }) {
  const [org, setOrg] = useState("jra");
  const [course, setCourse] = useState("");
  const [raceDate, setRaceDate] = useState(new Date().toISOString().slice(0, 10));
  const [raceNum, setRaceNum] = useState("11");
  const [loading, setLoading] = useState(false);
  const [prediction, setPrediction] = useState(null);
  const [error, setError] = useState("");
  const [todayInfo, setTodayInfo] = useState(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const resultRef = useRef(null);

  const courses = org === "jra" ? RACECOURSES_JRA : RACECOURSES_NAR;

  const loadToday = async () => {
    setTodayLoading(true);
    setTodayInfo(null);
    try {
      const info = await fetchTodayRaces(org);
      setTodayInfo(info);
    } catch (e) {
      setError(e.message);
    }
    setTodayLoading(false);
  };

  const predict = async () => {
    if (!course) { setError("競馬場を選択してください。"); return; }
    setLoading(true);
    setError("");
    setPrediction(null);

    try {
      const pred = await fetchRacePrediction(org, course, raceDate, raceNum);
      setPrediction(pred);

      const historyItem = {
        id: Date.now().toString(),
        date: new Date().toISOString(),
        org, course, raceDate, raceNum,
        prediction: pred,
      };
      onPredicted(historyItem);

      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth" }), 200);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={S.content}>
      {/* Org Select */}
      <div style={S.card}>
        <div style={S.label}>開催区分</div>
        <div style={{ display: "flex", gap: 6 }}>
          {[["jra", "🏆 JRA（中央）"], ["nar", "🐴 NAR（地方）"]].map(([id, label]) => (
            <div key={id} style={S.chip(org === id)} onClick={() => { setOrg(id); setCourse(""); }}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Today's Races */}
      <div style={S.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div style={S.label}>📅 本日の開催</div>
          <button style={S.copyBtn} onClick={loadToday} disabled={todayLoading}>
            {todayLoading ? "検索中..." : "🔍 確認"}
          </button>
        </div>
        {todayInfo && todayInfo.meetings && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {todayInfo.meetings.map((m, i) => (
              <div key={i}
                onClick={() => { setCourse(m.course); setOrg(m.org === "NAR" ? "nar" : "jra"); }}
                style={{
                  padding: "8px 10px", background: "#2d1560", borderRadius: "6px",
                  fontSize: 13, cursor: "pointer", display: "flex", justifyContent: "space-between",
                  border: course === m.course ? `1px solid ${C.accent}` : `1px solid transparent`,
                }}>
                <span style={{ fontWeight: 600 }}>{m.course}</span>
                <span style={{ color: C.dim, fontSize: 12 }}>
                  {m.race_count}R {m.featured_race && `| ${m.featured_race}`}
                </span>
              </div>
            ))}
          </div>
        )}
        {todayInfo && todayInfo.note && (
          <div style={{ fontSize: 11, color: C.dim, marginTop: 6 }}>{todayInfo.note}</div>
        )}
      </div>

      {/* Race Selection */}
      <div style={S.card}>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={S.label}>競馬場</div>
            <select style={S.select} value={course} onChange={(e) => setCourse(e.target.value)}>
              <option value="">選択...</option>
              {courses.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ width: 80 }}>
            <div style={S.label}>レース</div>
            <select style={S.select} value={raceNum} onChange={(e) => setRaceNum(e.target.value)}>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}R</option>
              ))}
            </select>
          </div>
        </div>
        <div style={S.label}>開催日</div>
        <input type="date" style={S.input} value={raceDate}
          onChange={(e) => setRaceDate(e.target.value)} />
      </div>

      {error && (
        <div style={{ ...S.card, borderColor: C.red, color: C.red, fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      <button style={{ ...S.btn(true), opacity: loading ? 0.7 : 1, marginBottom: 14 }}
        onClick={predict} disabled={loading}>
        {loading ? "🔍 AI分析中... (出馬表検索→予想生成、最大1分かかります)" : "🏇 AI予想を生成"}
      </button>

      {prediction && (
        <div ref={resultRef}>
          <PredictionResult pred={prediction} />
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Tab: Tickets ─────────────────────────────────────────────────────
function TicketsTab({ latestPrediction }) {
  const [selectedTypes, setSelectedTypes] = useState(["sanrenpuku", "umaren"]);
  const [budget, setBudget] = useState("3000");
  const [loading, setLoading] = useState(false);
  const [combo, setCombo] = useState(null);
  const [error, setError] = useState("");

  const toggleType = (id) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const generate = async () => {
    if (!latestPrediction || !latestPrediction.predictions) {
      setError("先に「レース予想」タブでAI予想を生成してください。");
      return;
    }
    if (selectedTypes.length === 0) { setError("馬券種類を選択してください。"); return; }

    setLoading(true);
    setError("");
    setCombo(null);

    try {
      const result = await fetchTicketCombo(latestPrediction, selectedTypes, parseInt(budget));
      setCombo(result);
    } catch (e) {
      setError(e.message);
    }
    setLoading(false);
  };

  return (
    <div style={S.content}>
      {!latestPrediction?.predictions ? (
        <div style={S.empty}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🎫</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>予想データなし</div>
          <div style={{ fontSize: 12 }}>先に「レース予想」タブでAI予想を生成してください</div>
        </div>
      ) : (
        <>
          <div style={{ ...S.card, background: "linear-gradient(135deg, #2d1560, #1a0a2e)" }}>
            <div style={{ fontSize: 13, color: C.accent, fontWeight: 700, marginBottom: 4 }}>
              🏇 予想済みレース
            </div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>
              {latestPrediction.race_info?.race_name || "レース"} - {latestPrediction.race_info?.course}
            </div>
            <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>
              予想: {(latestPrediction.predictions || []).map((p) => `${p.horse_number}${p.horse_name}`).join(" → ")}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.label}>馬券種類（複数選択可）</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
              {TICKET_TYPES.map((t) => (
                <div key={t.id} style={S.chip(selectedTypes.includes(t.id))}
                  onClick={() => toggleType(t.id)}>
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          <div style={S.card}>
            <div style={S.label}>予算（円）</div>
            <input type="number" style={S.input} value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="3000" step="500" min="500" />
          </div>

          {error && (
            <div style={{ ...S.card, borderColor: C.red, color: C.red, fontSize: 13 }}>⚠️ {error}</div>
          )}

          <button style={{ ...S.btn(true), opacity: loading ? 0.7 : 1, marginBottom: 14 }}
            onClick={generate} disabled={loading}>
            {loading ? "🎰 買い目生成中..." : "🎰 AI買い目を生成"}
          </button>

          {combo && <TicketResult combo={combo} />}
        </>
      )}
    </div>
  );
}

// ── Tab: History ─────────────────────────────────────────────────────
function HistoryTab({ history, onDelete }) {
  const [selected, setSelected] = useState(null);

  if (selected) {
    return (
      <div style={S.content}>
        <button style={{ ...S.copyBtn, marginBottom: 10 }} onClick={() => setSelected(null)}>
          ← 一覧へ
        </button>
        <div style={{ fontSize: 13, color: C.dim, marginBottom: 4 }}>
          {new Date(selected.date).toLocaleString("ja-JP")}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
          {selected.org?.toUpperCase()} {selected.course} {selected.raceNum}R
        </div>
        <PredictionResult pred={selected.prediction} />
      </div>
    );
  }

  return (
    <div style={S.content}>
      {history.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📋</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>履歴なし</div>
          <div style={{ fontSize: 12 }}>予想を生成すると自動で保存されます</div>
        </div>
      ) : (
        history.map((item) => (
          <div key={item.id} style={{ ...S.card, cursor: "pointer" }} onClick={() => setSelected(item)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 3 }}>
                  {item.org?.toUpperCase()} {item.course} {item.raceNum}R
                </div>
                <div style={{ fontSize: 11, color: C.dim }}>
                  {new Date(item.date).toLocaleString("ja-JP")} | {item.raceDate}
                </div>
                {item.prediction?.predictions && (
                  <div style={{ fontSize: 11, color: C.accent, marginTop: 3 }}>
                    予想: {item.prediction.predictions.slice(0, 3).map((p) => p.horse_name).join(" → ")}
                  </div>
                )}
              </div>
              <button style={{ ...S.copyBtn, color: C.red, fontSize: 10 }}
                onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}>
                削除
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Tab: Settings ────────────────────────────────────────────────────
function SettingsTab() {
  const [key, setKey] = useState(localStorage.getItem("keiba_api_key") || "");
  const [saved, setSaved] = useState(false);

  const save = () => {
    localStorage.setItem("keiba_api_key", key);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={S.content}>
      <div style={S.card}>
        <div style={S.label}>Anthropic API キー</div>
        <input type="password" style={{ ...S.input, marginBottom: 6 }}
          placeholder="sk-ant-..." value={key}
          onChange={(e) => setKey(e.target.value)} />
        <div style={{ fontSize: 11, color: C.dim, marginBottom: 10, lineHeight: 1.5 }}>
          Vercel環境変数(VITE_ANTHROPIC_API_KEY)設定時は不要です。
        </div>
        <button style={S.btn(true)} onClick={save}>
          {saved ? "✅ 保存完了" : "保存"}
        </button>
      </div>

      <div style={S.card}>
        <div style={S.label}>アプリ情報</div>
        <div style={{ fontSize: 13, lineHeight: 1.8 }}>
          <div><span style={{ color: C.dim }}>アプリ:</span> 競馬AI予想エージェント v1.0</div>
          <div><span style={{ color: C.dim }}>ブランド:</span> DoubleY Space</div>
          <div><span style={{ color: C.dim }}>モデル:</span> Claude Sonnet 4.5</div>
          <div><span style={{ color: C.dim }}>対応:</span> JRA（中央）・NAR（地方）</div>
          <div><span style={{ color: C.dim }}>データ:</span> Web検索による最新出馬表</div>
        </div>
      </div>

      <div style={S.card}>
        <div style={S.label}>⚠️ 注意事項</div>
        <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.7 }}>
          本アプリはAIによる予想であり、的中を保証するものではありません。
          馬券購入は自己責任でお願いします。
          競馬は20歳以上の方のみ購入できます。
        </div>
      </div>

      <div style={S.card}>
        <div style={S.label}>データ管理</div>
        <button style={{ ...S.btn(false), color: C.red, marginTop: 6 }}
          onClick={() => {
            if (confirm("全ての履歴を削除しますか？")) {
              localStorage.removeItem("keiba_history");
              location.reload();
            }
          }}>
          🗑 全履歴削除
        </button>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("predict");
  const [history, setHistory] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("keiba_history") || "[]");
      setHistory(saved);
    } catch { setHistory([]); }
  }, []);

  const saveHistory = (newHist) => {
    setHistory(newHist);
    localStorage.setItem("keiba_history", JSON.stringify(newHist));
  };

  const onPredicted = (item) => {
    setLatestPrediction(item.prediction);
    const updated = [item, ...history].slice(0, 50);
    saveHistory(updated);
  };

  const onDelete = (id) => saveHistory(history.filter((h) => h.id !== id));

  const tabs = [
    { id: "predict", label: "🏇 予想" },
    { id: "tickets", label: "🎰 馬券" },
    { id: "history", label: "📋 履歴" },
    { id: "settings", label: "⚙️ 設定" },
  ];

  return (
    <div style={S.app}>
      <div style={S.header}>
        <div style={S.logo}>🏇 競馬AI予想</div>
        <div style={{ fontSize: 10, color: C.dim }}>DoubleY Space</div>
      </div>
      <div style={S.tabBar}>
        {tabs.map((t) => (
          <button key={t.id} style={S.tab(tab === t.id)} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === "predict" && <PredictTab onPredicted={onPredicted} />}
      {tab === "tickets" && <TicketsTab latestPrediction={latestPrediction} />}
      {tab === "history" && <HistoryTab history={history} onDelete={onDelete} />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
