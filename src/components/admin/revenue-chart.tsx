"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { formatPaise } from "@/lib/utils";

export type RevenuePoint = { date: string; revenuePaise: number; orders: number };

/**
 * Hand-drawn SVG area chart. A charting library would be ~40kB for one sparkline,
 * and this needs exactly one shape, one axis and a hover readout.
 */
export function RevenueChart({ data }: { data: RevenuePoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const { path, area, max, width, height, points } = useMemo(() => {
    const width = 640;
    const height = 180;
    const max = Math.max(...data.map((d) => d.revenuePaise), 1);
    const step = data.length > 1 ? width / (data.length - 1) : width;

    const points = data.map((point, index) => ({
      x: index * step,
      y: height - (point.revenuePaise / max) * (height - 16) - 8,
      ...point,
    }));

    const path = points
      .map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`)
      .join(" ");

    return {
      path,
      area: `${path} L${width},${height} L0,${height} Z`,
      max,
      width,
      height,
      points,
    };
  }, [data]);

  const active = hover !== null ? points[hover] : null;
  const total = data.reduce((sum, point) => sum + point.revenuePaise, 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="font-display text-2xl leading-none tabular-nums text-ink">
          {active ? formatPaise(active.revenuePaise) : formatPaise(total)}
        </p>
        <p className="text-xs tabular-nums text-muted">
          {active
            ? `${new Date(active.date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${active.orders} ${active.orders === 1 ? "order" : "orders"}`
            : `Peak day ${formatPaise(max)}`}
        </p>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="mt-4 h-44 w-full overflow-visible"
        role="img"
        aria-label={`Revenue over the last ${data.length} days, totalling ${formatPaise(total)}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id="revenue-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8b6914" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#8b6914" stopOpacity="0" />
          </linearGradient>
        </defs>

        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={0}
            x2={width}
            y1={height * fraction}
            y2={height * fraction}
            stroke="#e8e4df"
            strokeDasharray="2 4"
          />
        ))}

        <motion.path
          d={area}
          fill="url(#revenue-fill)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
        />
        <motion.path
          d={path}
          fill="none"
          stroke="#8b6914"
          strokeWidth={1.5}
          strokeLinejoin="round"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
        />

        {active ? (
          <>
            <line
              x1={active.x}
              x2={active.x}
              y1={0}
              y2={height}
              stroke="#8b6914"
              strokeOpacity={0.3}
            />
            <circle cx={active.x} cy={active.y} r={3.5} fill="#8b6914" />
          </>
        ) : null}

        {/* Invisible hit areas: one per day, so hovering is forgiving. */}
        {points.map((point, index) => (
          <rect
            key={point.date}
            x={point.x - width / data.length / 2}
            y={0}
            width={width / data.length}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(index)}
          />
        ))}
      </svg>

      <div className="mt-1 flex justify-between text-[0.625rem] tabular-nums text-muted-light">
        <span>
          {data[0]
            ? new Date(data[0].date).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            : ""}
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}
