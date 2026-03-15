import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, ReferenceLine, ReferenceArea, Tooltip,
} from "recharts";
import { useSensorHistory, type Period, type SensorRange } from "@/hooks/useSensorData";

const mono = "ui-monospace, monospace";

const metricConfig: Record<string, { label: string; unit: string; color: string; key: string; idealMinKey: string; idealMaxKey: string; minKey: string; maxKey: string }> = {
  soil_moisture: { label: "SOIL MOISTURE", unit: "%", color: "#4ade80", key: "soil_moisture", idealMinKey: "soil_moisture_ideal_min", idealMaxKey: "soil_moisture_ideal_max", minKey: "soil_moisture_min", maxKey: "soil_moisture_max" },
  temperature: { label: "TEMPERATURE", unit: "°C", color: "#fb923c", key: "temperature", idealMinKey: "temperature_ideal_min", idealMaxKey: "temperature_ideal_max", minKey: "temperature_min", maxKey: "temperature_max" },
  humidity: { label: "HUMIDITY", unit: "%", color: "#60a5fa", key: "humidity", idealMinKey: "humidity_ideal_min", idealMaxKey: "humidity_ideal_max", minKey: "humidity_min", maxKey: "humidity_max" },
  light_lux: { label: "LIGHT", unit: " lux", color: "#fbbf24", key: "light_lux", idealMinKey: "light_lux_ideal_min", idealMaxKey: "light_lux_ideal_max", minKey: "light_lux_min", maxKey: "light_lux_max" },
};

const periods: Period[] = ["24h", "7d", "30d"];

function formatTime(ts: string, period: Period): string {
  const d = new Date(ts);
  if (period === "24h") return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (period === "7d") return d.toLocaleDateString("en-US", { weekday: "short", hour: "numeric" });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function CustomTooltip({ active, payload, period, unit }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.7)",
      padding: "6px 10px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <div>{formatTime(d.created_at, period)}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{payload[0].value}{unit}</div>
    </div>
  );
}

interface Props {
  plantId: string;
  metric: string;
  onClose: () => void;
}

export default function SensorHistoryChart({ plantId, metric, onClose }: Props) {
  const [period, setPeriod] = useState<Period>("24h");
  const { data, isLoading } = useSensorHistory(plantId, period);

  const cfg = metricConfig[metric];
  if (!cfg) return null;

  const readings = data?.readings || [];
  const ranges = data?.ranges || null;
  const wateringEvents = data?.wateringEvents || [];

  // Filter to readings that have this metric
  const chartData = readings
    .filter((r: any) => r[cfg.key] != null)
    .map((r: any) => ({ ...r, value: r[cfg.key] }));

  // Range values
  const idealMin = ranges?.[cfg.idealMinKey as keyof SensorRange] as number | undefined;
  const idealMax = ranges?.[cfg.idealMaxKey as keyof SensorRange] as number | undefined;
  const dangerMin = ranges?.[cfg.minKey as keyof SensorRange] as number | undefined;
  const dangerMax = ranges?.[cfg.maxKey as keyof SensorRange] as number | undefined;

  // Compute Y domain with padding
  const values = chartData.map((d: any) => d.value);
  const allBounds = [...values];
  if (idealMin != null) allBounds.push(idealMin);
  if (idealMax != null) allBounds.push(idealMax);
  if (dangerMin != null) allBounds.push(dangerMin);
  if (dangerMax != null) allBounds.push(dangerMax);
  const yMin = allBounds.length > 0 ? Math.floor(Math.min(...allBounds) * 0.9) : 0;
  const yMax = allBounds.length > 0 ? Math.ceil(Math.max(...allBounds) * 1.1) : 100;

  // Summary stats
  const avg = values.length > 0 ? (values.reduce((a: number, b: number) => a + b, 0) / values.length).toFixed(1) : "—";
  const min = values.length > 0 ? Math.min(...values).toFixed(1) : "—";
  const max = values.length > 0 ? Math.max(...values).toFixed(1) : "—";

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.08)",
      padding: "16px",
      marginTop: "8px",
      background: "rgba(255,255,255,0.02)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontFamily: mono, fontSize: "10px", color: cfg.color, letterSpacing: "0.08em" }}>
          {cfg.label}
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer"
          style={{ fontFamily: mono, fontSize: "9px", color: "rgba(255,255,255,0.3)", background: "none", border: "none", padding: "2px 6px" }}
        >
          CLOSE
        </button>
      </div>

      {/* Period tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "12px" }}>
        {periods.map(p => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: "9px", letterSpacing: "0.05em",
              padding: "3px 10px",
              color: p === period ? cfg.color : "rgba(255,255,255,0.3)",
              border: `1px solid ${p === period ? cfg.color + "40" : "rgba(255,255,255,0.06)"}`,
              background: p === period ? cfg.color + "10" : "transparent",
            }}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Chart */}
      {isLoading ? (
        <div style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.2)", padding: "32px 0", textAlign: "center" }}>
          loading...
        </div>
      ) : chartData.length < 2 ? (
        <div style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.2)", padding: "32px 0", textAlign: "center" }}>
          not enough data for {period}
        </div>
      ) : (
        <div style={{ width: "100%", height: 160 }}>
          <ResponsiveContainer>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              {/* Range bands */}
              {dangerMin != null && idealMin != null && (
                <ReferenceArea y1={dangerMin} y2={idealMin} fill="rgba(250,204,21,0.06)" />
              )}
              {idealMin != null && idealMax != null && (
                <ReferenceArea y1={idealMin} y2={idealMax} fill="rgba(74,222,128,0.06)" />
              )}
              {idealMax != null && dangerMax != null && (
                <ReferenceArea y1={idealMax} y2={dangerMax} fill="rgba(250,204,21,0.06)" />
              )}

              {/* Ideal range reference lines */}
              {idealMin != null && (
                <ReferenceLine y={idealMin} stroke="rgba(74,222,128,0.2)" strokeDasharray="3 3" />
              )}
              {idealMax != null && (
                <ReferenceLine y={idealMax} stroke="rgba(74,222,128,0.2)" strokeDasharray="3 3" />
              )}

              {/* Watering event markers */}
              {wateringEvents.map(evt => (
                <ReferenceLine
                  key={evt.id}
                  x={evt.created_at}
                  stroke="rgba(96,165,250,0.3)"
                  strokeDasharray="4 4"
                  label={{ value: "💧", position: "top", fontSize: 10 }}
                />
              ))}

              <XAxis
                dataKey="created_at"
                tickFormatter={(ts) => formatTime(ts, period)}
                tick={{ fontFamily: mono, fontSize: 8, fill: "rgba(255,255,255,0.2)" }}
                stroke="rgba(255,255,255,0.06)"
                interval="preserveStartEnd"
                minTickGap={40}
              />
              <YAxis
                domain={[yMin, yMax]}
                tick={{ fontFamily: mono, fontSize: 8, fill: "rgba(255,255,255,0.2)" }}
                stroke="rgba(255,255,255,0.06)"
                width={35}
              />
              <Tooltip content={<CustomTooltip period={period} unit={cfg.unit} />} />
              <Area
                type="stepAfter"
                dataKey="value"
                stroke={cfg.color}
                strokeWidth={1.5}
                fill={cfg.color}
                fillOpacity={0.08}
                dot={false}
                activeDot={{ r: 3, fill: cfg.color, stroke: "none" }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Stats row */}
      {chartData.length >= 2 && (
        <div style={{ display: "flex", gap: "16px", marginTop: "10px", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: "8px" }}>
          {[
            { label: "AVG", val: avg },
            { label: "MIN", val: min },
            { label: "MAX", val: max },
            { label: "READINGS", val: String(chartData.length) },
          ].map(s => (
            <div key={s.label}>
              <div style={{ fontFamily: mono, fontSize: "8px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.1em" }}>{s.label}</div>
              <div style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.5)" }}>{s.val}{s.label !== "READINGS" ? cfg.unit : ""}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
