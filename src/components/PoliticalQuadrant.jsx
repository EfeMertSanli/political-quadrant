import React, { useState, useEffect, useRef } from "react";
import lexicon from "./lexicon_calibrated.json";

// ...[Same SVG quadrant code as before, not included here for brevity]...

const CONFIDENCE_THRESHOLD = 0.6; // For high-confidence suggestions

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

function getAutocompleteWords(partial) {
  if (!partial) return [];
  const starts = partial.toLowerCase();
  return Object.keys(lexicon)
    .filter((word) => word.startsWith(starts))
    .slice(0, 6); // Show top 6 matches
}

export default function PoliticalQuadrant() {
  // ...[All previous state]...
  const [input, setInput] = useState("");
  const [wordPoints, setWordPoints] = useState([]);
  const [sentencePoints, setSentencePoints] = useState([]);
  const [textPoints, setTextPoints] = useState([]);
  const [autoWords, setAutoWords] = useState([]);
  const [nearestWords, setNearestWords] = useState([]);
  const [activeBracketWord, setActiveBracketWord] = useState("");
  const textareaRef = useRef();

  // ...[Party fetch & analyzeText code remains the same]...

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInput(value);

    // Find the current <...> fragment being typed (the last open bracket)
    const match = value.match(/<([^<>]*)>?$/);
    const lastWord = match ? match[1] : "";

    setActiveBracketWord(lastWord);

    // --- Autocomplete suggestions
    if (lastWord) {
      setAutoWords(getAutocompleteWords(lastWord));
      // Nearest word suggestions (if exact lexicon word)
      if (lexicon[lastWord.toLowerCase()]) {
        setNearestWords(getNearestWords(lastWord.toLowerCase()));
      } else {
        setNearestWords([]);
      }
    } else {
      setAutoWords([]);
      setNearestWords([]);
    }

    // ...[Rest of your word/sentence parsing and point code remains unchanged]...
    // Reset both sets of points
    const wordsInBrackets = value.split(/<([^<>]+)>/g).filter((_, i) => i % 2 === 1);

    // Points for single words (no spaces)
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

    // Points for sentences/paragraphs (at least one space)
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

  // Insert suggestion into the nearest bracket position on click
  const insertSuggestion = (suggestion) => {
    if (!activeBracketWord) return;
    const value = input.replace(/<([^<>]*)>?$/, `<${suggestion}>`);
    setInput(value);
    setActiveBracketWord("");
    setAutoWords([]);
    setNearestWords([]);
    // Refocus textarea
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);
    // Update points too:
    handleInputChange({ target: { value } });
  };

  // ...[SVG and party code remains unchanged]...

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
        {/* ...[SVG rendering code unchanged from previous version]... */}
        {/* (use previous SVG and points code here) */}
      </div>
      {/* Controls */}
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
          gap: 12,
          position: "relative",
        }}
      >
        <h2>Type Words or Sentences</h2>
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInputChange}
            placeholder="Type words like <freiheit> or sentences like <Das ist ein Satz>"
            style={{
              width: "100%",
              minHeight: "180px",
              fontSize: "17px",
              padding: "12px",
              border: "1px solid #bbb",
              borderRadius: "8px",
              resize: "vertical",
            }}
            autoComplete="off"
            spellCheck={false}
          />
          {/* Autocomplete Suggestions */}
          {autoWords.length > 0 && (
            <div
              style={{
                position: "absolute",
                top: 10,
                left: 10,
                width: "90%",
                background: "#fff",
                border: "1px solid #aaa",
                zIndex: 10,
                borderRadius: 6,
                boxShadow: "0 2px 12px #0002",
                fontSize: 17,
                color: "#333",
                maxHeight: 160,
                overflowY: "auto",
              }}
            >
              {autoWords.map((word, idx) => (
                <div
                  key={word}
                  style={{
                    padding: "6px 14px",
                    cursor: "pointer",
                    background: idx === 0 ? "#f3faff" : undefined,
                  }}
                  onMouseDown={() => insertSuggestion(word)}
                >
                  {word}
                </div>
              ))}
            </div>
          )}
        </div>
        {/* Nearest high-confidence words */}
        {nearestWords.length > 0 && (
          <div style={{ margin: "10px 0 0 0", fontSize: 16 }}>
            <b>Nearest high-confidence words:</b>
            <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
              {nearestWords.map((n) => (
                <li key={n.word} style={{ cursor: "pointer" }}>
                  <span onClick={() => insertSuggestion(n.word)}>
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
