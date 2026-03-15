import { useState } from "react";
import { useSensorData, type MetricStatus, type SensorReading } from "@/hooks/useSensorData";
import { Droplets, Thermometer, Wind, AlertTriangle, ChevronRight } from "lucide-react";
import SensorHistoryChart from "./SensorHistoryChart";

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';

const cardStyle = { border: '1px solid rgba(255,255,255,0.06)', padding: '24px' };
const labelStyle = { fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' };

// Color palette matching existing event type colors
const metricColors: Record<string, { ok: string; warning: string; critical: string; bg: string }> = {
  soil_moisture: { ok: '#4ade80', warning: '#facc15', critical: '#ef4444', bg: 'rgba(74,222,128,0.08)' },
  temperature: { ok: '#fb923c', warning: '#facc15', critical: '#ef4444', bg: 'rgba(251,146,60,0.08)' },
  humidity: { ok: '#60a5fa', warning: '#facc15', critical: '#ef4444', bg: 'rgba(96,165,250,0.08)' },
  light_lux: { ok: '#fbbf24', warning: '#facc15', critical: '#ef4444', bg: 'rgba(251,191,36,0.08)' },
};

const metricIcons: Record<string, typeof Droplets> = {
  soil_moisture: Droplets,
  temperature: Thermometer,
  humidity: Wind,
};

const metricLabels: Record<string, string> = {
  soil_moisture: 'MOISTURE',
  temperature: 'TEMP',
  humidity: 'HUMIDITY',
};

// Pixel-art style sparkline rendered with CSS
function Sparkline({ data, metric, ranges }: { data: SensorReading[]; metric: string; ranges: any }) {
  if (data.length < 2) return null;

  const values = data.map((d: any) => d[metric]).filter((v: any) => v != null) as number[];
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  // Normalize to 0-1
  const normalized = values.map(v => (v - min) / range);

  // Downsample to ~30 bars
  const barCount = Math.min(30, normalized.length);
  const step = normalized.length / barCount;
  const bars: number[] = [];
  for (let i = 0; i < barCount; i++) {
    bars.push(normalized[Math.floor(i * step)]);
  }

  // Get ideal range for background band
  const idealMin = ranges?.[`${metric}_ideal_min`];
  const idealMax = ranges?.[`${metric}_ideal_max`];
  let bandBottom = 0;
  let bandHeight = 100;
  if (idealMin != null && idealMax != null && range > 0) {
    bandBottom = ((idealMin - min) / range) * 100;
    bandHeight = ((idealMax - idealMin) / range) * 100;
    bandBottom = Math.max(0, Math.min(100, bandBottom));
    bandHeight = Math.max(0, Math.min(100 - bandBottom, bandHeight));
  }

  const colors = metricColors[metric] || metricColors.soil_moisture;

  return (
    <div style={{ position: 'relative', height: '32px', width: '100%', display: 'flex', alignItems: 'flex-end', gap: '1px' }}>
      {/* Ideal range background band */}
      {idealMin != null && idealMax != null && (
        <div style={{
          position: 'absolute',
          bottom: `${bandBottom}%`,
          left: 0,
          right: 0,
          height: `${bandHeight}%`,
          background: 'rgba(74,222,128,0.06)',
          borderTop: '1px solid rgba(74,222,128,0.15)',
          borderBottom: '1px solid rgba(74,222,128,0.15)',
        }} />
      )}
      {/* Pixel bars */}
      {bars.map((val, i) => {
        const height = Math.max(2, val * 28);
        const isLast = i === bars.length - 1;
        return (
          <div
            key={i}
            style={{
              width: `${100 / barCount}%`,
              height: `${height}px`,
              background: isLast ? colors.ok : 'rgba(255,255,255,0.15)',
              imageRendering: 'pixelated',
              transition: 'height 0.3s ease',
            }}
          />
        );
      })}
    </div>
  );
}

function RangeBar({ metric }: { metric: MetricStatus }) {
  if (metric.idealMin == null || metric.idealMax == null || metric.min == null || metric.max == null) return null;

  const totalRange = metric.max - metric.min;
  if (totalRange <= 0) return null;

  const pos = ((metric.value - metric.min) / totalRange) * 100;
  const idealStart = ((metric.idealMin - metric.min) / totalRange) * 100;
  const idealWidth = ((metric.idealMax - metric.idealMin) / totalRange) * 100;

  const statusColor = metric.status === 'critical' ? '#ef4444' : metric.status === 'warning' ? '#facc15' : '#4ade80';

  return (
    <div style={{ position: 'relative', height: '6px', width: '100%', background: 'rgba(255,255,255,0.04)', marginTop: '6px', imageRendering: 'pixelated' }}>
      {/* Danger zones */}
      <div style={{ position: 'absolute', left: 0, width: `${idealStart}%`, height: '100%', background: 'rgba(239,68,68,0.15)' }} />
      <div style={{ position: 'absolute', right: 0, width: `${100 - idealStart - idealWidth}%`, height: '100%', background: 'rgba(239,68,68,0.15)' }} />
      {/* Ideal zone */}
      <div style={{ position: 'absolute', left: `${idealStart}%`, width: `${idealWidth}%`, height: '100%', background: 'rgba(74,222,128,0.15)' }} />
      {/* Current value marker */}
      <div style={{
        position: 'absolute',
        left: `${Math.max(0, Math.min(100, pos))}%`,
        top: '-2px',
        width: '4px',
        height: '10px',
        background: statusColor,
        transform: 'translateX(-2px)',
        imageRendering: 'pixelated',
      }} />
    </div>
  );
}

function MetricRow({ name, metric, history, ranges, expanded, onTap, plantId }: {
  name: string; metric: MetricStatus | null; history: SensorReading[]; ranges: any;
  expanded: boolean; onTap: () => void; plantId: string;
}) {
  if (!metric) return null;

  const colors = metricColors[name] || metricColors.soil_moisture;
  const Icon = metricIcons[name];
  const label = metricLabels[name];
  const statusColor = metric.status === 'critical' ? colors.critical : metric.status === 'warning' ? colors.warning : colors.ok;

  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
      <div
        onClick={onTap}
        className="cursor-pointer"
        style={{ padding: '12px 0' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {Icon && <Icon size={12} style={{ color: statusColor, opacity: 0.8 }} />}
            <span style={{ ...labelStyle, color: 'rgba(255,255,255,0.4)' }}>{label}</span>
            <ChevronRight size={10} style={{
              color: 'rgba(255,255,255,0.15)',
              transform: expanded ? 'rotate(90deg)' : 'none',
              transition: 'transform 0.2s',
            }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: mono, fontSize: '16px', color: statusColor, fontWeight: 600 }}>
              {metric.value}{metric.unit}
            </span>
            <span style={{
              fontFamily: mono,
              fontSize: '8px',
              padding: '1px 5px',
              background: statusColor === colors.ok ? 'rgba(74,222,128,0.1)' : statusColor === colors.warning ? 'rgba(250,204,21,0.1)' : 'rgba(239,68,68,0.1)',
              color: statusColor,
              letterSpacing: '0.05em',
            }}>
              {metric.status === 'ok' ? 'OK' : metric.status === 'warning' ? 'WATCH' : metric.status === 'critical' ? 'DANGER' : metric.status.toUpperCase()}
            </span>
          </div>
        </div>
        {!expanded && (
          <>
            <Sparkline data={history} metric={name} ranges={ranges} />
            <RangeBar metric={metric} />
            {metric.idealMin != null && metric.idealMax != null && (
              <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.2)', marginTop: '4px' }}>
                ideal: {metric.idealMin}–{metric.idealMax}{metric.unit}
              </div>
            )}
          </>
        )}
      </div>
      {expanded && (
        <SensorHistoryChart plantId={plantId} metric={name} onClose={onTap} />
      )}
    </div>
  );
}

interface PlantVitalsProps {
  plantId: string;
}

export default function PlantVitals({ plantId }: PlantVitalsProps) {
  const { data, isLoading } = useSensorData(plantId);
  const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

  const toggleMetric = (name: string) => setExpandedMetric(prev => prev === name ? null : name);

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: pressStart, fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
          PLANT VITALS
        </div>
        <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '16px' }}>
          Loading sensor data...
        </div>
      </div>
    );
  }

  if (!data?.latest) {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: pressStart, fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
          PLANT VITALS
        </div>
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginBottom: '8px' }}>
            no sensor data
          </div>
          <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.2)' }}>
            assign a sensor to this plant to see vitals
          </div>
        </div>
      </div>
    );
  }

  const { metrics, ranges, alerts, history, isStale, isOffline, lastReadingAge } = data;

  return (
    <div style={{
      ...cardStyle,
      opacity: isOffline ? 0.4 : isStale ? 0.7 : 1,
      transition: 'opacity 0.3s ease',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ fontFamily: pressStart, fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.05em' }}>
          PLANT VITALS
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {lastReadingAge && (
            <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.25)' }}>
              {lastReadingAge}
            </span>
          )}
          {isOffline && (
            <span style={{ fontFamily: mono, fontSize: '8px', color: '#ef4444', padding: '1px 5px', background: 'rgba(239,68,68,0.1)' }}>OFFLINE</span>
          )}
          {isStale && !isOffline && (
            <span style={{ fontFamily: mono, fontSize: '8px', color: '#facc15', padding: '1px 5px', background: 'rgba(250,204,21,0.1)' }}>STALE</span>
          )}
          {!isStale && !isOffline && (
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 4px rgba(74,222,128,0.5)' }} />
          )}
        </div>
      </div>

      {/* Alert banner */}
      {alerts.length > 0 && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          padding: '10px 12px',
          marginBottom: '12px',
          background: alerts.some(a => a.severity === 'critical') ? 'rgba(239,68,68,0.06)' : 'rgba(250,204,21,0.06)',
          border: `1px solid ${alerts.some(a => a.severity === 'critical') ? 'rgba(239,68,68,0.15)' : 'rgba(250,204,21,0.15)'}`,
        }}>
          <AlertTriangle size={12} style={{ color: alerts.some(a => a.severity === 'critical') ? '#ef4444' : '#facc15', marginTop: '1px', flexShrink: 0 }} />
          <div style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
            {alerts.map(a => a.message).join(" · ")}
          </div>
        </div>
      )}

      {/* Metric rows */}
      <MetricRow name="soil_moisture" metric={metrics.soil_moisture} history={history} ranges={ranges} expanded={expandedMetric === "soil_moisture"} onTap={() => toggleMetric("soil_moisture")} plantId={plantId} />
      <MetricRow name="temperature" metric={metrics.temperature} history={history} ranges={ranges} expanded={expandedMetric === "temperature"} onTap={() => toggleMetric("temperature")} plantId={plantId} />
      <MetricRow name="humidity" metric={metrics.humidity} history={history} ranges={ranges} expanded={expandedMetric === "humidity"} onTap={() => toggleMetric("humidity")} plantId={plantId} />
      {metrics.light_lux && (
        <MetricRow name="light_lux" metric={metrics.light_lux} history={history} ranges={ranges} expanded={expandedMetric === "light_lux"} onTap={() => toggleMetric("light_lux")} plantId={plantId} />
      )}

      {/* No ranges hint */}
      {!ranges && (
        <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.15)', marginTop: '8px', textAlign: 'center' }}>
          ask orchid to set ideal ranges for this plant
        </div>
      )}
    </div>
  );
}
