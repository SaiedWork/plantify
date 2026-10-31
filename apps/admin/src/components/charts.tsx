"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// ---- helpers -----------------------------------------------------------------------------------

const compactMoney = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 });
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** Whole dollars below $1K ($157), compact above it ($1.2K). */
export const moneyCompact = (cents: number) => (Math.abs(cents) < 100_000 ? `$${Math.round(cents / 100)}` : compactMoney.format(cents / 100));
export const moneyFull = (cents: number) => money.format(cents / 100);

/** "2026-10-05" -> "Oct 5". Parsed as UTC so the label never shifts a day with the viewer's time zone. */
export const shortDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
export const longDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** Round the axis maximum up to a clean number (1, 2, 2.5, 5 × 10ⁿ) and return evenly spaced ticks. */
function niceScale(max: number, tickCount = 4, integer = false) {
  if (max <= 0) return { top: 1, ticks: [0, 1] };
  const rough = max / tickCount;
  const pow = 10 ** Math.floor(Math.log10(rough));
  // Counts never get fractional ticks: skip 2.5 and never step by less than 1.
  const steps = (integer ? [1, 2, 5, 10] : [1, 2, 2.5, 5, 10]).map((m) => Math.max(integer ? 1 : 0, m * pow));
  const step = steps.find((s) => s >= rough) ?? 10 * pow;
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step) };
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => entry && setWidth(Math.floor(entry.contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Wrap every chart so the colour tokens apply. */
export function Viz({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("viz-root", className)}>{children}</div>;
}

// ---- stat tile ---------------------------------------------------------------------------------

/**
 * Headline number with a signed change against the previous period. The arrow and the words carry the
 * meaning; colour only reinforces it (and flips for metrics where up is bad, like refunds).
 */
export function StatTile({
  label,
  value,
  current,
  previous,
  upIsGood = true,
  hero = false,
  periodLabel,
}: {
  label: string;
  value: string;
  current: number;
  previous: number;
  upIsGood?: boolean;
  hero?: boolean;
  periodLabel: string;
}) {
  let delta: ReactNode;
  if (previous === 0 && current === 0) {
    delta = <span className="text-[var(--viz-text-muted)]">No change · {periodLabel}</span>;
  } else if (previous === 0) {
    delta = <span className="text-[var(--viz-text-muted)]">New · {periodLabel}</span>;
  } else {
    const pct = ((current - previous) / previous) * 100;
    if (Math.abs(pct) < 0.5) {
      delta = <span className="text-[var(--viz-text-muted)]">▬ Flat · {periodLabel}</span>;
    } else {
      const up = pct > 0;
      const good = up === upIsGood;
      delta = (
        <>
          <span className={good ? "text-[var(--viz-good)]" : "text-[var(--viz-bad)]"}>
            {up ? "▲" : "▼"} {Math.abs(pct).toFixed(Math.abs(pct) < 10 ? 1 : 0)}%
          </span>
          <span className="text-[var(--viz-text-muted)]"> {periodLabel}</span>
        </>
      );
    }
  }

  return (
    <div className="flex h-full flex-col justify-center rounded-xl border bg-[var(--viz-surface)] p-4">
      <p className="text-sm text-[var(--viz-text-secondary)]">{label}</p>
      <p className={cn("mt-1 font-semibold tracking-tight text-[var(--viz-text-primary)]", hero ? "text-5xl" : "text-2xl")}>{value}</p>
      <p className="mt-1 text-xs">{delta}</p>
    </div>
  );
}

// ---- area chart (one series over time) ---------------------------------------------------------

export type AreaPoint = { date: string; value: number; secondary?: number };

// The wide right margin leaves room for the end-of-line value label beside the final dot.
const AREA = { top: 14, right: 58, bottom: 26, left: 46, height: 260 };

export function AreaChart({
  points,
  valueLabel,
  secondaryLabel,
  formatValue = moneyFull,
  formatTick = moneyCompact,
  integerAxis = false,
  summary,
}: {
  points: AreaPoint[];
  valueLabel: string;
  secondaryLabel?: string;
  formatValue?: (n: number) => string;
  formatTick?: (n: number) => string;
  /** Use whole-number ticks (for counts). */
  integerAxis?: boolean;
  summary: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<"chart" | "table">("chart");
  const titleId = useId();
  const descId = useId();

  const innerW = Math.max(0, width - AREA.left - AREA.right);
  const innerH = AREA.height - AREA.top - AREA.bottom;
  const max = Math.max(0, ...points.map((p) => p.value));
  const { top, ticks } = niceScale(max, 4, integerAxis);

  const x = (i: number) => AREA.left + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (v: number) => AREA.top + innerH - (v / top) * innerH;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = points.length ? `${line} L${x(points.length - 1).toFixed(1)},${AREA.top + innerH} L${x(0).toFixed(1)},${AREA.top + innerH} Z` : "";

  // One x label per ~80px so narrow screens get fewer labels instead of overlapping ones; first and last always show.
  const maxLabels = Math.max(2, Math.floor(innerW / 80));
  const labelEvery = Math.max(1, Math.ceil(points.length / maxLabels));
  const xLabels = points.map((p, i) => ({ p, i })).filter(({ i }) => i === points.length - 1 || (i % labelEvery === 0 && points.length - 1 - i >= labelEvery * 0.6));

  function indexAt(clientX: number, rect: DOMRect) {
    if (points.length === 0) return null;
    const rel = (clientX - rect.left - AREA.left) / Math.max(1, innerW);
    return Math.min(points.length - 1, Math.max(0, Math.round(rel * (points.length - 1))));
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "ArrowRight") setActive((a) => Math.min(points.length - 1, (a ?? -1) + 1));
    else if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? points.length) - 1));
    else if (e.key === "Escape") setActive(null);
    else return;
    e.preventDefault();
  }

  const hovered = active !== null ? points[active] : undefined;
  const last = points.at(-1);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 id={titleId} className="text-sm font-medium text-[var(--viz-text-primary)]">
          {valueLabel}
        </h3>
        <button
          type="button"
          onClick={() => setView(view === "chart" ? "table" : "chart")}
          className="rounded-md border px-2 py-1 text-xs text-[var(--viz-text-secondary)] hover:bg-muted"
        >
          {view === "chart" ? "Table view" : "Chart view"}
        </button>
      </div>

      {view === "table" ? (
        <div className="max-h-[260px] overflow-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[var(--viz-surface)] text-left text-xs text-[var(--viz-text-muted)]">
              <tr>
                <th className="px-3 py-1.5 font-medium">Date</th>
                <th className="px-3 py-1.5 text-right font-medium">{valueLabel}</th>
                {secondaryLabel && <th className="px-3 py-1.5 text-right font-medium">{secondaryLabel}</th>}
              </tr>
            </thead>
            <tbody className="divide-y text-[var(--viz-text-primary)]">
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="px-3 py-1">{longDate(p.date)}</td>
                  <td className="px-3 py-1 text-right tabular-nums">{formatValue(p.value)}</td>
                  {secondaryLabel && <td className="px-3 py-1 text-right tabular-nums">{p.secondary}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div ref={ref} className="relative" style={{ height: AREA.height }}>
          {width > 0 && (
            <svg
              width={width}
              height={AREA.height}
              role="img"
              aria-labelledby={titleId}
              aria-describedby={descId}
              tabIndex={0}
              onKeyDown={onKey}
              onBlur={() => setActive(null)}
              onPointerMove={(e: PointerEvent<SVGSVGElement>) => setActive(indexAt(e.clientX, e.currentTarget.getBoundingClientRect()))}
              onPointerLeave={() => setActive(null)}
              className="block touch-pan-y rounded-md outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--viz-series-1)]"
            >
              <desc id={descId}>{summary}</desc>
              {ticks.map((t) => (
                <g key={t}>
                  <line x1={AREA.left} x2={width - AREA.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--viz-baseline)" : "var(--viz-grid)"} strokeWidth={1} />
                  <text x={AREA.left - 8} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill="var(--viz-text-muted)">
                    {formatTick(t)}
                  </text>
                </g>
              ))}
              {xLabels.map(({ p, i }) => (
                <text key={p.date} x={x(i)} y={AREA.height - 6} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} fontSize={11} fill="var(--viz-text-muted)">
                  {shortDate(p.date)}
                </text>
              ))}

              {points.length > 1 && <path d={area} fill="var(--viz-series-1)" fillOpacity={0.1} />}
              {points.length > 1 && <path d={line} fill="none" stroke="var(--viz-series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}

              {/* end dot + label: the one value labelled directly */}
              {last && active === null && (
                <>
                  <circle cx={x(points.length - 1)} cy={y(last.value)} r={5} fill="var(--viz-series-1)" stroke="var(--viz-surface)" strokeWidth={2} />
                  <text x={x(points.length - 1) + 10} y={y(last.value)} textAnchor="start" dominantBaseline="middle" fontSize={12} fontWeight={600} fill="var(--viz-text-primary)">
                    {formatTick(last.value)}
                  </text>
                </>
              )}

              {hovered && active !== null && (
                <>
                  <line x1={x(active)} x2={x(active)} y1={AREA.top} y2={AREA.top + innerH} stroke="var(--viz-baseline)" strokeWidth={1} />
                  <circle cx={x(active)} cy={y(hovered.value)} r={5} fill="var(--viz-series-1)" stroke="var(--viz-surface)" strokeWidth={2} />
                </>
              )}
            </svg>
          )}

          {hovered && active !== null && width > 0 && (
            <div
              className="pointer-events-none absolute top-2 z-10 min-w-36 rounded-lg border bg-[var(--viz-surface)] px-3 py-2 text-xs shadow-sm"
              style={{ left: x(active) > width / 2 ? undefined : x(active) + 12, right: x(active) > width / 2 ? width - x(active) + 12 : undefined }}
              role="status"
            >
              <p className="text-[var(--viz-text-muted)]">{longDate(hovered.date)}</p>
              <p className="mt-1 flex items-center gap-2 text-[var(--viz-text-primary)]">
                <span className="inline-block size-2 rounded-full" style={{ background: "var(--viz-series-1)" }} />
                <span className="text-[var(--viz-text-secondary)]">{valueLabel}</span>
                <span className="ml-auto font-semibold tabular-nums">{formatValue(hovered.value)}</span>
              </p>
              {secondaryLabel && hovered.secondary !== undefined && (
                <p className="mt-0.5 flex gap-2 pl-4 text-[var(--viz-text-secondary)]">
                  {secondaryLabel}
                  <span className="ml-auto tabular-nums text-[var(--viz-text-primary)]">{hovered.secondary}</span>
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- horizontal bar list (compare magnitude) ---------------------------------------------------

export type BarItem = { label: string; value: number; valueLabel: string; detail?: string };

/**
 * Ranked horizontal bars: thin marks that start at a square baseline and end in a 4px round cap, with the
 * value at the tip. Label text uses text tokens; only the bar carries the series colour.
 */
export function BarList({ items, ariaLabel }: { items: BarItem[]; ariaLabel: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <ul aria-label={ariaLabel} className="space-y-2.5">
      {items.map((item, i) => (
        <li
          key={item.label}
          className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm"
          onPointerEnter={() => setHover(i)}
          onPointerLeave={() => setHover(null)}
          onFocus={() => setHover(i)}
          onBlur={() => setHover(null)}
          tabIndex={0}
        >
          <span className="truncate text-[var(--viz-text-secondary)]" title={item.label}>
            {item.label}
          </span>
          <span className="flex items-center gap-2">
            <span
              className="h-4 rounded-r-[4px] transition-opacity"
              // Length is proportional to value within the track, which excludes the space reserved for the tip label.
              style={{ width: `max(4px, calc((100% - 4.5rem) * ${item.value / max}))`, background: "var(--viz-series-1)", opacity: hover === null || hover === i ? 1 : 0.55 }}
            />
            <span className="shrink-0 text-xs font-medium tabular-nums text-[var(--viz-text-primary)]">{item.valueLabel}</span>
          </span>
          {hover === i && item.detail && (
            <span role="status" className="pointer-events-none absolute -top-7 right-0 z-10 rounded-md border bg-[var(--viz-surface)] px-2 py-1 text-xs text-[var(--viz-text-primary)] shadow-sm">
              {item.detail}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
