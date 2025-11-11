"use client";

import { useMemo, useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";

const WORLD_TOPOJSON = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

type DataPackage = {
  id: string;
  title: string;
  dataGB: number;
  price: number;
  validity: string;
};

type CountryPackages = {
  id: string;
  name: string;
  coords: [number, number];
  currency: string;
  packages: DataPackage[];
};

const COUNTRIES: CountryPackages[] = [
  {
    id: "NA",
    name: "Namibia",
    coords: [17.083, -22.559],
    currency: "NAD",
    packages: [
      { id: "na-1", title: "1 GB Explorer", dataGB: 1, price: 60, validity: "7 days" },
      { id: "na-2", title: "5 GB Nomad", dataGB: 5, price: 250, validity: "30 days" },
      { id: "na-3", title: "10 GB Voyager", dataGB: 10, price: 420, validity: "30 days" }
    ]
  },
  {
    id: "BW",
    name: "Botswana",
    coords: [24.6849, -22.3285],
    currency: "BWP",
    packages: [
      { id: "bw-1", title: "1 GB Explorer", dataGB: 1, price: 55, validity: "7 days" },
      { id: "bw-2", title: "3 GB Nomad", dataGB: 3, price: 130, validity: "14 days" },
      { id: "bw-3", title: "10 GB Voyager", dataGB: 10, price: 380, validity: "30 days" }
    ]
  },
  {
    id: "ZA",
    name: "South Africa",
    coords: [24, -29],
    currency: "ZAR",
    packages: [
      { id: "za-1", title: "2 GB Explorer", dataGB: 2, price: 79, validity: "7 days" },
      { id: "za-2", title: "5 GB Nomad", dataGB: 5, price: 149, validity: "30 days" },
      { id: "za-3", title: "20 GB Voyager", dataGB: 20, price: 449, validity: "60 days" }
    ]
  },
  {
    id: "TZ",
    name: "Tanzania",
    coords: [35, -6],
    currency: "TZS",
    packages: [
      { id: "tz-1", title: "1 GB Explorer", dataGB: 1, price: 3000, validity: "7 days" },
      { id: "tz-2", title: "7 GB Nomad", dataGB: 7, price: 12000, validity: "30 days" },
      { id: "tz-3", title: "15 GB Voyager", dataGB: 15, price: 22000, validity: "30 days" }
    ]
  },
  {
    id: "AO",
    name: "Angola",
    coords: [17.8739, -11.2027],
    currency: "AOA",
    packages: [
      { id: "ao-1", title: "1.5 GB Explorer", dataGB: 1.5, price: 1500, validity: "7 days" },
      { id: "ao-2", title: "6 GB Nomad", dataGB: 6, price: 5000, validity: "30 days" },
      { id: "ao-3", title: "12 GB Voyager", dataGB: 12, price: 9000, validity: "30 days" }
    ]
  }
];

export function AfricaCoverageMap() {
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CountryPackages | null>(null);

  const projectionConfig = useMemo(() => ({ center: [20, 0], scale: 350 }), []);

  return (
    <section className="mx-auto mb-24 mt-16 max-w-6xl px-6 lg:mt-24 lg:px-10">
      <div className="mb-10 max-w-2xl">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-500">Interactive coverage</p>
        <h2 className="mt-3 font-display text-3xl text-brand-900 sm:text-4xl">Discover regional eSIM bundles</h2>
        <p className="mt-4 text-base text-brand-600">
          Explore the map to see curated Simplify data bundles for popular African destinations. Click on a country to
          reveal pricing, validity, and quick actions.
        </p>
      </div>
      <div className="relative overflow-hidden rounded-3xl border border-brand-100/70 bg-white shadow-card">
        <div className="relative h-[420px] w-full sm:h-[520px]">
          <ComposableMap
            projection="geoMercator"
            projectionConfig={projectionConfig}
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={WORLD_TOPOJSON}>
              {({ geographies }) =>
                geographies
                  .filter((geo) => {
                    const bbox = (geo as { bbox?: [number, number, number, number] }).bbox;
                    if (!bbox) return true;
                    const [x0, y0, x1, y1] = bbox;
                    return x0 < 60 && x1 > -25 && y0 < 40 && y1 > -40;
                  })
                  .map((geo) => (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill="#e5f7f6"
                      stroke="#c2ebeb"
                      style={{
                        default: { outline: "none" },
                        hover: { fill: "#c2ebeb", outline: "none" },
                        pressed: { fill: "#c2ebeb", outline: "none" }
                      }}
                    />
                  ))
              }
            </Geographies>

            {COUNTRIES.map((country) => (
              <Marker
                key={country.id}
                coordinates={country.coords}
                onMouseEnter={() => setHoverId(country.id)}
                onMouseLeave={() => setHoverId((id) => (id === country.id ? null : id))}
                onClick={() => setSelected(country)}
              >
                <circle
                  r={selected?.id === country.id ? 6.5 : 5}
                  fill={selected?.id === country.id ? "#1f8789" : "#2dabac"}
                  stroke="#153f41"
                  strokeWidth={1}
                />
                {hoverId === country.id && (
                  <g transform="translate(0,-18)">
                    <rect x={-48} y={-24} rx={8} ry={8} width={96} height={28} fill="#153f41" opacity={0.95} />
                    <text
                      x={0}
                      y={-6}
                      textAnchor="middle"
                      fontSize={11}
                      fill="#f3fbfb"
                      style={{ pointerEvents: "none" }}
                    >
                      {country.name}
                    </text>
                  </g>
                )}
              </Marker>
            ))}
          </ComposableMap>
        </div>

        <div className="pointer-events-none absolute right-6 top-6 max-w-sm">
          {selected ? (
            <div className="pointer-events-auto w-full rounded-2xl border border-brand-100 bg-white/95 shadow-subtle backdrop-blur">
              <div className="border-b border-brand-100/80 p-5">
                <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand-500">Data bundles</p>
                <h3 className="mt-2 font-display text-xl text-brand-900">
                  {selected.name} <span className="text-brand-500">• {selected.currency}</span>
                </h3>
              </div>
              <ul className="divide-y divide-brand-100/80">
                {selected.packages.map((pkg) => (
                  <li key={pkg.id} className="flex items-center justify-between gap-4 p-5">
                    <div>
                      <p className="font-display text-base text-brand-900">{pkg.title}</p>
                      <p className="text-sm text-brand-600">{pkg.validity}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-semibold text-brand-900">
                        {pkg.price.toLocaleString()} {selected.currency}
                      </p>
                      <button
                        type="button"
                        className="mt-2 inline-flex items-center rounded-full bg-brand-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        onClick={() => {
                          alert(`Start checkout for ${pkg.title} in ${selected.name}`);
                        }}
                      >
                        Buy now
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex justify-end border-t border-brand-100/70 bg-brand-50/80 px-5 py-3">
                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 transition hover:text-brand-800"
                  onClick={() => setSelected(null)}
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto rounded-2xl border border-dashed border-brand-200 bg-white/90 p-5 text-sm text-brand-600">
              Click a marker to see available bundles and pricing.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
