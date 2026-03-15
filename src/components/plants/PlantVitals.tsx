import { useState } from "react";
import { useSensorData, type MetricStatus, type SensorReading } from "@/hooks/useSensorData";
import { useDevices, useUpdateDevice, useCreateDevice } from "@/hooks/useDevices";
import { Droplets, Thermometer, Wind, AlertTriangle, ChevronRight, Wifi, Plus, Copy, Check, ChevronDown, X } from "lucide-react";
import SensorHistoryChart from "./SensorHistoryChart";

const mono = "ui-monospace, monospace";
const pressStart = '"Press Start 2P", cursive';

const cardStyle = { border: '1px solid rgba(255,255,255,0.06)', padding: '24px' };
const labelStyle = { fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase' as const, letterSpacing: '0.1em' };

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
            <span style={{ ...labelStyle, color: 'rgba(255,255,255,0.8)' }}>{label}</span>
            <ChevronRight size={10} style={{
              color: 'rgba(255,255,255,0.5)',
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
              <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.55)', marginTop: '4px' }}>
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

function deviceWifiColor(lastSeenAt: string | null): string {
  if (!lastSeenAt) return 'rgba(255,255,255,0.55)';
  const ageMs = Date.now() - new Date(lastSeenAt).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return '#ef4444';       // offline — red
  if (ageMs > 30 * 60 * 1000) return '#facc15';             // stale — amber
  return '#4ade80';                                           // online — green
}

// Inline sensor picker — used in both empty state and header
function SensorPicker({ plantId, onDone }: { plantId: string; onDone?: () => void }) {
  const { data: devices } = useDevices();
  const updateDevice = useUpdateDevice();
  const createDevice = useCreateDevice();
  const [showAddNew, setShowAddNew] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [newName, setNewName] = useState("Plant Sensor");

  const activeDevices = (devices || []).filter(d => d.status === "active");
  const unassigned = activeDevices.filter(d => !d.plant_id);
  const assignedElsewhere = activeDevices.filter(d => d.plant_id && d.plant_id !== plantId);
  const assignedHere = activeDevices.filter(d => d.plant_id === plantId);

  const handleAssign = (deviceId: string) => {
    updateDevice.mutate({ id: deviceId, plant_id: plantId }, { onSuccess: () => onDone?.() });
  };

  const handleCreateAndAssign = async () => {
    try {
      const result = await createDevice.mutateAsync({ name: newName, plantId });
      setNewToken(result.token);
    } catch (e) {
      console.error("Failed to create device:", e);
    }
  };

  const handleCopy = () => {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Just created a new device — show the token
  if (newToken) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ fontFamily: mono, fontSize: '10px', color: '#4ade80', marginBottom: '8px' }}>
          sensor created & assigned
        </div>
        <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
          Copy this token into your ESP32 firmware. It won't be shown again.
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          padding: '8px 10px', background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.1)',
        }}>
          <code style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.95)', flex: 1, wordBreak: 'break-all' }}>
            {newToken}
          </code>
          <button onClick={handleCopy} className="cursor-pointer" style={{
            background: 'none', border: 'none', padding: '4px', color: copied ? '#4ade80' : 'rgba(255,255,255,0.65)', flexShrink: 0,
          }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        <button
          onClick={() => { setNewToken(null); onDone?.(); }}
          className="cursor-pointer"
          style={{
            fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.65)',
            background: 'none', border: 'none', padding: '6px 0', marginTop: '8px',
          }}
        >
          done
        </button>
      </div>
    );
  }

  // Add new device form
  if (showAddNew) {
    return (
      <div style={{ padding: '12px 0' }}>
        <div style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.8)', marginBottom: '8px' }}>
          new sensor
        </div>
        <input
          type="text"
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="Sensor name"
          style={{
            fontFamily: mono, fontSize: '11px', color: 'white', width: '100%',
            backgroundColor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
            padding: '6px 10px', outline: 'none', marginBottom: '8px',
          }}
        />
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleCreateAndAssign}
            disabled={createDevice.isPending}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: '9px', padding: '5px 12px',
              color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)',
              background: 'rgba(74,222,128,0.06)',
            }}
          >
            {createDevice.isPending ? 'creating...' : 'create & assign'}
          </button>
          <button
            onClick={() => setShowAddNew(false)}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: '9px', padding: '5px 12px',
              color: 'rgba(255,255,255,0.65)', border: '1px solid rgba(255,255,255,0.06)',
              background: 'transparent',
            }}
          >
            cancel
          </button>
        </div>
      </div>
    );
  }

  // Device list
  return (
    <div style={{ padding: '12px 0' }}>
      {/* Unassigned devices — one-tap assign */}
      {unassigned.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            available sensors
          </div>
          {unassigned.map(d => (
            <button
              key={d.id}
              onClick={() => handleAssign(d.id)}
              disabled={updateDevice.isPending}
              className="cursor-pointer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.85)',
                padding: '8px 10px', marginBottom: '4px',
                border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
                textAlign: 'left',
              }}
            >
              <Wifi size={10} style={{ color: deviceWifiColor(d.last_seen_at) }} />
              <span style={{ flex: 1 }}>{d.name}</span>
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.55)' }}>{d.device_token_prefix}...</span>
            </button>
          ))}
        </div>
      )}

      {/* Devices assigned to other plants — reassign with note */}
      {assignedElsewhere.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            move from another plant
          </div>
          {assignedElsewhere.map(d => (
            <button
              key={d.id}
              onClick={() => handleAssign(d.id)}
              disabled={updateDevice.isPending}
              className="cursor-pointer"
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.7)',
                padding: '8px 10px', marginBottom: '4px',
                border: '1px solid rgba(255,255,255,0.06)', background: 'transparent',
                textAlign: 'left',
              }}
            >
              <Wifi size={10} style={{ color: 'rgba(255,255,255,0.55)' }} />
              <span style={{ flex: 1 }}>{d.name}</span>
              <span style={{ fontSize: '8px', color: 'rgba(250,204,21,0.8)' }}>in use</span>
            </button>
          ))}
        </div>
      )}

      {/* Already assigned here */}
      {assignedHere.length > 0 && (
        <div style={{ marginBottom: '8px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            currently assigned
          </div>
          {assignedHere.map(d => (
            <div
              key={d.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                fontFamily: mono, fontSize: '11px', color: '#4ade80',
                padding: '8px 10px', marginBottom: '4px',
                border: '1px solid rgba(74,222,128,0.15)', background: 'rgba(74,222,128,0.04)',
              }}
            >
              <Wifi size={10} style={{ color: deviceWifiColor(d.last_seen_at) }} />
              <span style={{ flex: 1 }}>{d.name}</span>
              <button
                onClick={() => updateDevice.mutate({ id: d.id, plant_id: null })}
                className="cursor-pointer"
                title="Remove sensor"
                style={{ background: 'none', border: 'none', padding: '2px', color: 'rgba(255,255,255,0.6)' }}
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new sensor */}
      <button
        onClick={() => setShowAddNew(true)}
        className="cursor-pointer"
        style={{
          display: 'flex', alignItems: 'center', gap: '6px', width: '100%',
          fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.6)',
          padding: '8px 10px',
          border: '1px dashed rgba(255,255,255,0.08)', background: 'transparent',
          textAlign: 'left',
        }}
      >
        <Plus size={10} /> add new sensor
      </button>

      {onDone && (
        <button
          onClick={onDone}
          className="cursor-pointer"
          style={{
            fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.55)',
            background: 'none', border: 'none', padding: '6px 0', marginTop: '6px',
          }}
        >
          cancel
        </button>
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
  const [showSensorPicker, setShowSensorPicker] = useState(false);

  const toggleMetric = (name: string) => setExpandedMetric(prev => prev === name ? null : name);

  if (isLoading) {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: pressStart, fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
          PLANT VITALS
        </div>
        <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginTop: '16px' }}>
          Loading sensor data...
        </div>
      </div>
    );
  }

  if (!data?.latest) {
    return (
      <div style={cardStyle}>
        <div style={{ fontFamily: pressStart, fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em', marginBottom: '12px' }}>
          PLANT VITALS
        </div>
        <SensorPicker plantId={plantId} />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontFamily: pressStart, fontSize: '9px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.05em' }}>
            PLANT VITALS
          </div>
          <button
            onClick={() => setShowSensorPicker(!showSensorPicker)}
            className="cursor-pointer"
            style={{ background: 'none', border: 'none', padding: '2px', color: 'rgba(255,255,255,0.5)' }}
          >
            <ChevronDown size={10} style={{ transform: showSensorPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {lastReadingAge && (
            <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.6)' }}>
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

      {/* Sensor picker (expandable from header) */}
      {showSensorPicker && (
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '12px' }}>
          <SensorPicker plantId={plantId} onDone={() => setShowSensorPicker(false)} />
        </div>
      )}

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
          <div style={{ fontFamily: mono, fontSize: '10px', color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
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
        <div style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(255,255,255,0.5)', marginTop: '8px', textAlign: 'center' }}>
          ask orchid to set ideal ranges for this plant
        </div>
      )}
    </div>
  );
}
