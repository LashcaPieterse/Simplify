interface BarValue {
  label: string;
  value: number;
}

export function SimpleBarChart({ bars, height = 200 }: { bars: BarValue[]; height?: number }) {
  if (bars.length === 0) {
    return <p className="text-sm text-slate-500">No data available</p>;
  }

  const max = Math.max(...bars.map((bar) => bar.value), 1);
  const width = Math.max(bars.length * 52, 260);
  const barWidth = 36;
  const gap = (width - bars.length * barWidth) / Math.max(bars.length + 1, 1);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      {bars.map((bar, index) => {
        const x = gap + index * (barWidth + gap);
        const barHeight = (bar.value / max) * (height - 20);
        const y = height - barHeight;
        return (
          <g key={bar.label}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={barHeight}
              rx={6}
              className="fill-teal-500"
              opacity={0.9}
            />
            <text x={x + barWidth / 2} y={height - 4} textAnchor="middle" className="fill-slate-600 text-[10px]">
              {bar.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
