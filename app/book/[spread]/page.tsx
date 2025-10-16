"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

const TOTAL_SPREADS = 4; // change later as needed

export default function Spread() {
  const params = useParams<{ spread: string }>();
  const router = useRouter();
  const idx = Math.max(
    0,
    Math.min(TOTAL_SPREADS - 1, parseInt(params.spread ?? "0", 10) || 0)
  );

  const [anim, setAnim] = useState<"none" | "next" | "prev">("none");
  const lastIdx = useRef(idx);
  const animTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const dir =
      idx > lastIdx.current ? "next" : idx < lastIdx.current ? "prev" : "none";

    console.log(
      `useEffect: idx=${idx}, lastIdx=${lastIdx.current}, dir=${dir}`
    );

    if (dir !== "none") {
      console.log(
        `Animation triggered: ${dir}, from ${lastIdx.current} to ${idx}`
      );
      // Clear any existing timeout
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }

      setAnim(dir as any);
      animTimeoutRef.current = setTimeout(() => {
        console.log("Animation completed, setting to none");
        setAnim("none");
        animTimeoutRef.current = null;
      }, 1200);

      lastIdx.current = idx;
    }

    return () => {
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
        animTimeoutRef.current = null;
      }
    };
  }, [idx]);

  function go(delta: number) {
    const target = Math.min(TOTAL_SPREADS - 1, Math.max(0, idx + delta));
    if (target !== idx) {
      console.log(`Navigating from ${idx} to ${target}, delta: ${delta}`);

      // Trigger animation immediately
      const dir = delta > 0 ? "next" : "prev";
      console.log(`Triggering animation: ${dir}`);
      setAnim(dir as any);

      // Clear any existing timeout
      if (animTimeoutRef.current) {
        clearTimeout(animTimeoutRef.current);
      }

      animTimeoutRef.current = setTimeout(() => {
        console.log("Animation completed, setting to none");
        setAnim("none");
        animTimeoutRef.current = null;
      }, 1200);

      router.push(`/book/${target}`);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx]);

  let touchX = useRef<number | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    touchX.current = e.touches[0].clientX;
  }
  function onTouchEnd(e: React.TouchEvent) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    if (dx < -40) go(1);
    if (dx > 40) go(-1);
    touchX.current = null;
  }

  const onClick = (e: React.MouseEvent) => {
    console.log("Click detected!", e.clientX, e.clientY);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = e.clientX - rect.left;
    console.log("Click position:", x, "Book width:", rect.width);
    if (x > rect.width * 0.66) {
      console.log("Going forward");
      go(1);
    } else if (x < rect.width * 0.33) {
      console.log("Going backward");
      go(-1);
    } else {
      console.log("Click in middle area, no action");
    }
  };

  const bgSheets = useMemo(() => Array.from({ length: 16 }), []);

  const pageContent = [
    {
      left: "Chapter One",
      right:
        "The beginning of our story unfolds with gentle curiosity and wonder.",
    },
    {
      left: "Chapter Two",
      right:
        "As we journey deeper, patterns emerge from the chaos of discovery.",
    },
    {
      left: "Chapter Three",
      right: "The middle path reveals its secrets slowly, like dawn breaking.",
    },
    {
      left: "Chapter Four",
      right: "The final pages hold the culmination of our shared experience.",
    },
  ];

  const currentContent = pageContent[idx] || { left: "", right: "" };

  console.log(`Rendering: idx=${idx}, anim=${anim}`);

  return (
    <main
      className="stage"
      onClick={onClick}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ cursor: "pointer" }}
    >
      <div className="book">
        <div className="spine" />
        {bgSheets.map((_, i) => (
          <div
            key={i}
            className="bg-sheet"
            style={{ transform: `translateZ(${-i * 0.8}px)` }}
          />
        ))}
        <section className="spread">
          <div className="page left blank" aria-label={`Spread ${idx} left`}>
            <div className="page-text">{currentContent.left}</div>
          </div>
          <div className="page right blank" aria-label={`Spread ${idx} right`}>
            <div className="page-text">{currentContent.right}</div>
          </div>
          {anim !== "none" && (
            <div className={`turn ${anim}`}>
              <div className="turn-face front" />
              <div className="turn-face back" />
              <div className="fold-shadow" />
              <div className="edge-highlight" />
              <div className="page-curl" />
            </div>
          )}
        </section>
      </div>
      <div className="hint">
        Tap right to go forward. Tap left to go back. Arrow keys work.
      </div>
      <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
        <button onClick={() => go(-1)} style={{ padding: "10px" }}>
          ← Previous
        </button>
        <span style={{ padding: "10px" }}>Page {idx + 1}</span>
        <button onClick={() => go(1)} style={{ padding: "10px" }}>
          Next →
        </button>
      </div>
    </main>
  );
}
