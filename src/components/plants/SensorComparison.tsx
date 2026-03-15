import { useState, useMemo } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, ReferenceLine } from "recharts";
import { useSensorStatusBatch } from "@/hooks/useSensorData";
import { usePlants } from "@/hooks/usePlants";

const mono = "ui-monospace, monospace";

type Metric = "soil_moisture" | "temperature" | "humidity";

const metricConfig: Record<Metric, { label: string; unit: string; color: string }> = {
  soil_moisture: { label: "MOISTURE", unit: "%", color: "#4ade80" },
  temperature: { label: "TEMP", unit: "°C", color: "#fb923c" },
  humidity: { label: "HUMIDITY", unit: "%", color: "#60a5fa" },
};

function CustomTooltip({ active, payload, unit }: any) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div style={{
      fontFamily: mono, fontSize: "10px", color: "rgba(255,255,255,0.95)",
      padding: "6px 10px", background: "rgba(0,0,0,0.85)", border: "1px solid rgba(255,255,255,0.1)",
    }}>
      <div>{d.name}</div>
      <div style={{ fontWeight: 600, marginTop: 2 }}>{d.value}{unit}</div>
    </div>
  );
}

interface Props {
  onClose: () => void;
}

export default function SensorComparison({ onClose }: Props) {
  const [metric, setMetric] = useState<Metric>("soil_moisture");
  const { data: plants } = usePlants();
  const plantIds = useMemo(() => (plants || []).map((p: any) => p.id), [plants]);
  const { data: sensorStatus, isLoading } = useSensorStatusBatch(plantIds);

  const cfg = metricConfig[metric];

  // Build chart data: only plants that have sensor data
  const chartData = useMemo(() => {
    if (!plants || !sensorStatus) return [];
    return plants
      .filter((p: any) => sensorStatus[p.id]?.soil_moisture != null)
      .map((p: any) => {
        const status = sensorStatus[p.id];
        return {
          id: p.id,
          name: (p.nickname || p.name || "").slice(0, 12),
          value: status?.soil_moisture ?? null, // batch only returns soil_moisture currently
          status: status?.status,
        };
      })
      .filter((d: any) => d.value != null)
      .sort((a: any, b: any) => (b.value ?? 0) - (a.value ?? 0));
  }, [plants, sensorStatus, metric]);

  return (
    <div style={{
      border: "1px solid rgba(255,255,255,0.06)",
      padding: "20px",
      marginBottom: "16px",
    }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <span style={{ fontFamily: mono, fontSize: "12px", color: "rgba(255,255,255,0.85)" }}>
          compare plants
        </span>
        <button
          onClick={onClose}
          className="cursor-pointer"
          style={{ fontFamily: mono, fontSize: "9px", color: "rgba(255,255,255,0.65)", background: "none", border: "none", padding: "2px 6px" }}
        >
          CLOSE
        </button>
      </div>

      {/* Metric tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "16px" }}>
        {(Object.keys(metricConfig) as Metric[]).map(m => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: "9px", letterSpacing: "0.05em",
              padding: "3px 10px",
              color: m === metric ? metricConfig[m].color : "rgba(255,255,255,0.65)",
              border: `1px solid ${m === metric ? metricConfig[m].color + "40" : "rgba(255,255,255,0.06)"}`,
              background: m === metric ? metricConfig[m].color + "10" : "transparent",
            }}
          >
            {metricConfig[m].label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.55)", padding: "24px 0", textAlign: "center" }}>
          loading...
        </div>
      ) : chartData.length === 0 ? (
        <div style={{ fontFamily: mono, fontSize: "11px", color: "rgba(255,255,255,0.55)", padding: "24px 0", textAlign: "center" }}>
          no sensor data to compare
        </div>
      ) : (
        <div style={{ width: "100%", height: Math.max(120, chartData.length * 36) }}>
          <ResponsiveContainer>
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                type="number"
                tick={{ fontFamily: mono, fontSize: 8, fill: "rgba(255,255,255,0.2)" }}
                stroke="rgba(255,255,255,0.06)"
                domain={[0, "auto"]}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontFamily: mono, fontSize: 9, fill: "rgba(255,255,255,0.4)" }}
                stroke="rgba(255,255,255,0.06)"
                width={80}
              />
              <Tooltip content={<CustomTooltip unit={cfg.unit} />} />
              <Bar
                dataKey="value"
                fill={cfg.color}
                fillOpacity={0.6}
                radius={[0, 2, 2, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      <div style={{ fontFamily: mono, fontSize: "8px", color: "rgba(255,255,255,0.5)", marginTop: "8px", textAlign: "center" }}>
        showing latest readings · moisture only in batch mode
      </div>
    </div>
  );
}
