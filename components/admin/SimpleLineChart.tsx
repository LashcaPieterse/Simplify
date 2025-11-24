interface LinePoint {
  label: string;
  value: number;
}

export function SimpleLineChart({ points, height = 160 }: { points: LinePoint[]; height?: number }) {
  if (points.length === 0) {
    return <p className="text-sm text-slate-500">No data yet</p>;
  }

  const max = Math.max(...points.map((p) => p.value), 1);
  const width = Math.max(points.length * 40, 240);
  const step = width / Math.max(points.length - 1, 1);

  const coordinates = points.map((point, index) => {
    const x = index * step;
    const y = height - (point.value / max) * height;
    return { x, y };
  });

  const path = coordinates
    .map((coord, index) => `${index === 0 ? "M" : "L"}${coord.x},${coord.y}`)
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="lineGradient" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.24" />
          <stop offset="100%" stopColor="#14b8a6" stopOpacity="0.05" />
        </linearGradient>
      </defs>
      <path d={`${path} L ${width} ${height} L 0 ${height} Z`} fill="url(#lineGradient)" />
      <path d={path} stroke="#0f766e" strokeWidth={2.5} fill="none" strokeLinecap="round" />
      {coordinates.map((coord, index) => (
        <circle key={points[index].label} cx={coord.x} cy={coord.y} r={3} fill="#0f766e" />
      ))}
    </svg>
  );
}
