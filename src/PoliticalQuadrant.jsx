import React, { useState, useEffect, useRef } from "react";
import lexicon from "./lexicon_calibrated.json";

// Core constants
const SIZE = 800;
const GRID = 10;
const CHART_MARGIN = 70; // px (margin for axes/labels)
const CHART_SIZE = SIZE - 2 * CHART_MARGIN; // size of inner grid
const CELL = CHART_SIZE / GRID;
const CONFIDENCE_THRESHOLD = 0.6;

// Quadrant and label logic as before
const quadrantColors = [
  "rgba(255,0,0,0.23)",
  "rgba(0,128,255,0.23)",
  "rgba(0,255,0,0.18)",
  "rgba(255,255,0,0.21)",
];
const axisLabelStyle = {
  fontSize: 48,
  fontWeight: "bold",
  fill: "#666",
  fontFamily: "Arial, sans-serif",
  paintOrder: "stroke fill",
  stroke: "#fff",
  strokeWidth: 4,
};
// Mapping data point to SVG position (x: 0-10 → px, y: 0-10 → px)
function dataToSvg(x, y) {
  return {
    sx: CHART_MARGIN + (x / 10) * CHART_SIZE,
    sy: CHART_MARGIN + ((10 - y) / 10) * CHART_SIZE,
  };
}

function getAutocompleteWords(partial) {
  if (!partial) return [];
  const lower = partial.toLowerCase();
  return Object.keys(lexicon)
    .filter((word) => word.startsWith(lower))
    .slice(0, 8);
}
function getNearestWords(baseWord, k = 3) {
  const base = lexicon[baseWord];
  if (!base) return [];
  const baseVec = [base.x, base.y];
  return Object.entries(lexicon)
    .filter(
      ([word, entry]) =>
        word !== baseWord && entry.confidence >= CONFIDENCE_THRESHOLD
    )
    .map(([word, entry]) => ({
      word,
      confidence: entry.confidence,
      dist:
        Math.pow(baseVec[0] - entry.x, 2) + Math.pow(baseVec[1] - entry.y, 2),
    }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, k);
}
// Words at a chart point
function getWordsAtPoint(x, y, confidence = CONFIDENCE_THRESHOLD) {
  const tolerance = 1.0;
  return Object.entries(lexicon)
    .filter(
      ([, entry]) =>
        Math.abs(entry.x - x) < tolerance &&
        Math.abs(entry.y - y) < tolerance &&
        entry.confidence >= confidence
    )
    .map(([word, entry]) => ({
      word,
      confidence: entry.confidence,
      x: entry.x,
      y: entry.y,
    }));
}

export default function PoliticalQuadrant() {
  // --- state setup ---
  const [input, setInput] = useState("");
  const [wordPoints, setWordPoints] = useState([]);
  const [sentencePoints, setSentencePoints] = useState([]);
  const [textPoints, setTextPoints] = useState([]);
  const [autoWords, setAutoWords] = useState([]);
  const [nearestWords, setNearestWords] = useState([]);
  const [activeBracketWord, setActiveBracketWord] = useState("");
  const [clickedPoint, setClickedPoint] = useState(null);
  const textareaRef = useRef();

  // --- utility to analyze text, unchanged ---
  const minConfidence = 0.1;
  const stretchFactor = 1.4;
  const centerX = 5.0;
  const centerY = 5.0;
  const analyzeText = (text) => {
    const words = text.toLowerCase().match(/\b\w+\b/g);
    const wordCounts = {};
    for (const word of words || []) {
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    }
    let xSum = 0, ySum = 0, totalWeight = 0;
    for (const [word, count] of Object.entries(wordCounts)) {
      if (lexicon[word] && lexicon[word].confidence >= minConfidence) {
        const { x, y, confidence } = lexicon[word];
        const weight = count * confidence;
        xSum += x * weight;
        ySum += y * weight;
        totalWeight += weight;
      }
    }
    if (totalWeight === 0) return null;
    const avgX = xSum / totalWeight;
    const avgY = ySum / totalWeight;
    let dx = avgX - centerX;
    let dy = avgY - centerY;
    let stretchedX = Math.max(0, Math.min(10, centerX + dx * stretchFactor));
    let stretchedY = Math.max(0, Math.min(10, centerY + dy * stretchFactor));
    return { x: stretchedX, y: stretchedY };
  };

  // --- party fetch, unchanged ---
  useEffect(() => {
    const fetchFiles = async () => {
      const filenames = [
        "AFD.txt",
        "BSW.txt",
        "CDU-CSU.txt",
        "FDP.txt",
        "GRUENE.txt",
        "LINKE.txt",
        "MLPD.txt",
        "SPD.txt",
      ];
      const results = [];
      for (const file of filenames) {
        try {
          const res = await fetch(`/party_texts/${file}`);
          if (!res.ok) continue;
          const text = await res.text();
          const result = analyzeText(text);
          if (result) {
            results.push({ ...result, label: file.replace(".txt", "") });
          } else {
            results.push({ x: 5, y: 5, label: file.replace(".txt", "") });
          }
        } catch (err) {
          results.push({ x: 5, y: 5, label: file.replace(".txt", "") });
        }
      }
      setTextPoints(results);
    };
    fetchFiles();
    // eslint-disable-next-line
  }, []);

  // --- Input/parse logic, unchanged ---
  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);
    const match = value.match(/<([^<>]*)>?$/);
    const lastWord = match ? match[1] : "";
    setActiveBracketWord(lastWord);

    if (lastWord) {
      setAutoWords(getAutocompleteWords(lastWord));
      if (lexicon[lastWord.toLowerCase()]) {
        setNearestWords(getNearestWords(lastWord.toLowerCase()));
      } else {
        setNearestWords([]);
      }
    } else {
      setAutoWords([]);
      setNearestWords([]);
    }

    const wordsInBrackets = value.split(/<([^<>]+)>/g).filter((_, i) => i % 2 === 1);

    // Single-word points
    const wordPoints = wordsInBrackets
      .filter((word) => word.trim().split(/\s+/).length === 1)
      .map((word) => {
        const key = word.trim().toLowerCase();
        const entry = lexicon[key];
        if (!entry) return null;
        const x = Math.max(0, Math.min(10, entry.x));
        const y = Math.max(0, Math.min(10, entry.y));
        const confidence = entry.confidence;
        return { word: key, x, y, confidence, size: 18 };
      })
      .filter(Boolean);

    // Sentences/paragraphs as points
    const sentencePoints = wordsInBrackets
      .map((text, idx) => {
        if (text.trim().split(/\s+/).length > 1) {
          const analysis = analyzeText(text);
          if (analysis) {
            return {
              ...analysis,
              label:
                text
                  .trim()
                  .replace(/\s+/g, " ")
                  .slice(0, 22) + (text.trim().length > 22 ? "..." : ""),
              fullText: text.trim(),
              size: 24,
              idx,
            };
          }
        }
        return null;
      })
      .filter(Boolean);

    setWordPoints(wordPoints);
    setSentencePoints(sentencePoints);
  };

  // --- Suggestion/nearest word logic, unchanged ---
  const insertSuggestion = (suggestion) => {
    if (!activeBracketWord) return;
    const value = input.replace(/<([^<>]*)>?$/, `<${suggestion}>`);
    setInput(value);
    setActiveBracketWord("");
    setAutoWords([]);
    setNearestWords([]);
    handleInputChange({ target: { value } });
    setTimeout(() => textareaRef.current?.focus(), 0);
  };
  const addNearestWord = (word) => {
    let value = input;
    if (textareaRef.current) {
      const { selectionStart, selectionEnd } = textareaRef.current;
      value =
        value.slice(0, selectionStart) +
        `<${word}>` +
        value.slice(selectionEnd);
    } else {
      value += `<${word}>`;
    }
    setInput(value);
    setActiveBracketWord("");
    setAutoWords([]);
    setNearestWords([]);
    handleInputChange({ target: { value } });
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  // --- Accurate click-to-data mapping for inner grid only ---
  const handleGridClick = (e) => {
    const svg = e.target.ownerSVGElement || e.target;
    const rect = svg.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Only respond to clicks inside the grid (chart box)
    if (
      mouseX >= CHART_MARGIN &&
      mouseX <= CHART_MARGIN + CHART_SIZE &&
      mouseY >= CHART_MARGIN &&
      mouseY <= CHART_MARGIN + CHART_SIZE
    ) {
      // x: 0 on left, 10 on right; y: 0 on bottom, 10 on top
      const x = ((mouseX - CHART_MARGIN) / CHART_SIZE) * 10;
      const y = 10 - ((mouseY - CHART_MARGIN) / CHART_SIZE) * 10;
      setClickedPoint({
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
      });
    }
  };

  // Ensure chart updates on mount
  useEffect(() => {
    handleInputChange({ target: { value: input } });
    // eslint-disable-next-line
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        flexDirection: "row",
        fontFamily: "Arial, sans-serif",
        background: "#fff",
      }}
    >
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, position: "relative" }}>
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          width="100%"
          height="100%"
          style={{ display: "block", background: "#fff" }}
        >
          {/* Quadrants */}
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={CHART_MARGIN + (i % 2) * CHART_SIZE / 2}
              y={CHART_MARGIN + (i < 2 ? 0 : CHART_SIZE / 2)}
              width={CHART_SIZE / 2}
              height={CHART_SIZE / 2}
              fill={quadrantColors[i]}
            />
          ))}
          {/* Grid lines */}
          {Array.from({ length: GRID + 1 }).map((_, i) => (
            <g key={`grid-${i}`}>
              {/* Vertical */}
              <line
                x1={CHART_MARGIN + i * (CHART_SIZE / GRID)}
                y1={CHART_MARGIN}
                x2={CHART_MARGIN + i * (CHART_SIZE / GRID)}
                y2={CHART_MARGIN + CHART_SIZE}
                stroke="#bbb"
                strokeWidth={1}
              />
              {/* Horizontal */}
              <line
                x1={CHART_MARGIN}
                y1={CHART_MARGIN + i * (CHART_SIZE / GRID)}
                x2={CHART_MARGIN + CHART_SIZE}
                y2={CHART_MARGIN + i * (CHART_SIZE / GRID)}
                stroke="#bbb"
                strokeWidth={1}
              />
            </g>
          ))}
          {/* Bold axes */}
          <line
            x1={CHART_MARGIN + CHART_SIZE / 2}
            y1={CHART_MARGIN}
            x2={CHART_MARGIN + CHART_SIZE / 2}
            y2={CHART_MARGIN + CHART_SIZE}
            stroke="#222"
            strokeWidth={6}
          />
          <line
            x1={CHART_MARGIN}
            y1={CHART_MARGIN + CHART_SIZE / 2}
            x2={CHART_MARGIN + CHART_SIZE}
            y2={CHART_MARGIN + CHART_SIZE / 2}
            stroke="#222"
            strokeWidth={6}
          />
          {/* Axis Labels */}
          <text
            x={SIZE / 2}
            y={CHART_MARGIN - 25}
            textAnchor="middle"
            style={axisLabelStyle}
          >
            Authoritarian
          </text>
          <text
            x={CHART_MARGIN - 35}
            y={SIZE / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(-90, ${CHART_MARGIN - 35}, ${SIZE / 2})`}
            style={axisLabelStyle}
          >
            Left
          </text>
          <text
            x={SIZE - (CHART_MARGIN - 35)}
            y={SIZE / 2}
            textAnchor="middle"
            dominantBaseline="middle"
            transform={`rotate(90, ${SIZE - (CHART_MARGIN - 35)}, ${SIZE / 2})`}
            style={axisLabelStyle}
          >
            Right
          </text>
          <text
            x={SIZE / 2}
            y={SIZE - (CHART_MARGIN - 22)}
            textAnchor="middle"
            style={axisLabelStyle}
          >
            Libertarian
          </text>
          {/* Highlight clicked point */}
          {clickedPoint && (
            <circle
              {...dataToSvg(clickedPoint.x, clickedPoint.y)}
              r={15}
              fill="#23f"
              opacity={0.18}
              stroke="#23f"
              strokeWidth={4}
            />
          )}
          {/* Word, sentence, and party points */}
          {wordPoints.map((pt, idx) => {
            const { sx, sy } = dataToSvg(pt.x, pt.y);
            return (
              <g key={`word-${idx}`}>
                <circle
                  cx={sx}
                  cy={sy}
                  r={pt.size}
                  fill="#ff4d4d"
                  stroke="#911"
                  strokeWidth={2}
                  opacity={0.9}
                />
                <text
                  x={sx}
                  y={sy - pt.size - 6}
                  fontSize={20}
                  fontWeight={600}
                  fill="#222"
                  textAnchor="middle"
                  stroke="#fff"
                  strokeWidth={3}
                  paintOrder="stroke fill"
                  style={{ pointerEvents: "none" }}
                >
                  {pt.word}
                </text>
              </g>
            );
          })}
          {sentencePoints.map((pt, idx) => {
            const { sx, sy } = dataToSvg(pt.x, pt.y);
            return (
              <g key={`sentence-${idx}`}>
                <circle
                  cx={sx}
                  cy={sy}
                  r={pt.size}
                  fill="#18b962"
                  stroke="#146132"
                  strokeWidth={3}
                  opacity={0.85}
                />
                <text
                  x={sx + pt.size + 10}
                  y={sy + 3}
                  fontSize={19}
                  fontWeight="bold"
                  fill="#146132"
                  textAnchor="start"
                  stroke="#fff"
                  strokeWidth={4}
                  paintOrder="stroke fill"
                  style={{ pointerEvents: "none" }}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
          {textPoints.map((pt, idx) => {
            const { sx, sy } = dataToSvg(pt.x, pt.y);
            const size = 32;
            return (
              <g key={`party-${idx}`}>
                <rect
                  x={sx - size / 2}
                  y={sy - size / 2}
                  width={size}
                  height={size}
                  fill="#3366ff"
                  stroke="#111"
                  strokeWidth={3}
                  opacity={0.97}
                  rx={8}
                />
                <text
                  x={sx + size / 2 + 10}
                  y={sy + 3}
                  fontSize={24}
                  fontWeight="bold"
                  fill="#222"
                  textAnchor="start"
                  stroke="#fff"
                  strokeWidth={4}
                  paintOrder="stroke fill"
                  style={{ pointerEvents: "none" }}
                >
                  {pt.label}
                </text>
              </g>
            );
          })}
          {/* Only the grid area is clickable */}
          <rect
            x={CHART_MARGIN}
            y={CHART_MARGIN}
            width={CHART_SIZE}
            height={CHART_SIZE}
            fill="transparent"
            style={{ cursor: "crosshair" }}
            onClick={handleGridClick}
          />
        </svg>
      </div>
      {/* Right panel unchanged */}
      <div
        style={{
          width: "420px",
          minWidth: "320px",
          maxWidth: "45vw",
          background: "#f9f9f9",
          borderLeft: "1px solid #ddd",
          padding: "24px 18px",
          display: "flex",
          flexDirection: "column",
          gap: 16,
          position: "relative",
        }}
      >
        <h2>Type Words or Sentences</h2>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleInputChange}
          placeholder="Type <freiheit> or <Das ist ein Satz>..."
          style={{
            width: "100%",
            minHeight: "140px",
            fontSize: "17px",
            padding: "12px",
            border: "1px solid #bbb",
            borderRadius: "8px",
            resize: "vertical",
            background: "#fff",
          }}
          autoComplete="off"
          spellCheck={false}
        />

        {/* --- Words at Clicked Point --- */}
        {clickedPoint && (
          <div
            style={{
              background: "#fff",
              border: "1px solid #e0e0e0",
              borderRadius: 6,
              margin: "6px 0 8px 0",
              padding: "10px 12px 7px 12px",
              fontSize: 16,
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: 5 }}>
              Words at ({clickedPoint.x.toFixed(2)}, {clickedPoint.y.toFixed(2)}):
            </div>
            <ul style={{ margin: 0, paddingLeft: 20, minHeight: 16 }}>
              {getWordsAtPoint(clickedPoint.x, clickedPoint.y).length > 0
                ? getWordsAtPoint(clickedPoint.x, clickedPoint.y).map(w => (
                  <li key={w.word} style={{ cursor: "pointer", marginBottom: 2 }}>
                    <span onClick={() => addNearestWord(w.word)}>
                      {w.word}
                      <span style={{ color: "#888", fontSize: 14 }}>
                        {" "}({w.confidence.toFixed(2)})
                      </span>
                    </span>
                  </li>
                ))
                : <span style={{ color: "#aaa" }}>(none)</span>
              }
            </ul>
            <div style={{textAlign: "right", fontSize:13, marginTop:3}}>
              <button onClick={() => setClickedPoint(null)} style={{
                background: "none", border: "none", color: "#2196f3", cursor: "pointer", padding: 0
              }}>Clear</button>
            </div>
          </div>
        )}

        {/* Recommendation (autocomplete) box */}
        <div style={{ minHeight: 8 }}>
          {autoWords.length > 0 && activeBracketWord && (
            <div
              style={{
                background: "#fff",
                border: "1px solid #aaa",
                borderRadius: 6,
                boxShadow: "0 2px 12px #0002",
                fontSize: 17,
                color: "#333",
                maxHeight: 220,
                overflowY: "auto",
                margin: "4px 0 0 0",
                padding: 0,
              }}
            >
              {autoWords.map((word, idx) => (
                <div
                  key={word}
                  style={{
                    padding: "10px 18px",
                    cursor: "pointer",
                    background: idx === 0 ? "#f3faff" : undefined,
                    borderBottom: idx !== autoWords.length - 1 ? "1px solid #f1f1f1" : undefined,
                  }}
                  onClick={() => insertSuggestion(word)}
                >
                  {word}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Nearest high-confidence words box */}
        <div style={{ minHeight: 8 }}>
          {nearestWords.length > 0 && (
            <div
              style={{
                background: "#fafaff",
                border: "1px solid #b2cbff",
                borderRadius: 6,
                boxShadow: "0 1px 8px #b2cbff33",
                margin: "8px 0 0 0",
                padding: "10px 12px 8px 12px",
                fontSize: 16,
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 5 }}>
                Nearest high-confidence words:
              </div>
              <ul style={{ margin: 0, paddingLeft: 20 }}>
                {nearestWords.map((n) => (
                  <li key={n.word} style={{ cursor: "pointer", marginBottom: 3 }}>
                    <span onClick={() => addNearestWord(n.word)}>
                      {n.word}{" "}
                      <span style={{ color: "#888", fontSize: 14 }}>
                        ({n.confidence.toFixed(2)})
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p style={{ margin: 0, fontSize: 15, color: "#555" }}>
          Use &lt;word&gt; for single words, or &lt;sentence&gt; to analyze a whole sentence/paragraph as one point!
        </p>
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 13, color: "#aaa", textAlign: "right" }}>
          Political Quadrant Visualization
        </div>
      </div>
    </div>
  );
}
