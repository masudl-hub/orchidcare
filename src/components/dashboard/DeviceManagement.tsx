import { useState } from "react";
import { Cpu, Wifi, WifiOff, Zap, Edit2, Check, X, ChevronDown, Loader2 } from "lucide-react";
import { useDevices, useUpdateDevice, useSendDeviceCommand, type Device } from "@/hooks/useDevices";
import { usePlants } from "@/hooks/usePlants";

const mono = "ui-monospace, monospace";

const cardStyle = { border: '1px solid rgba(255,255,255,0.06)', padding: '24px' };
const labelStyle: React.CSSProperties = { fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' };

function formatAge(date: string | null): string {
  if (!date) return "never";
  const ms = Date.now() - new Date(date).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  return `${days}d ago`;
}

function statusInfo(device: Device) {
  if (device.status === "revoked") return { label: "REVOKED", color: "#666", bg: "rgba(102,102,102,0.1)" };
  if (device.status === "inactive") return { label: "INACTIVE", color: "#facc15", bg: "rgba(250,204,21,0.1)" };
  if (!device.last_seen_at) return { label: "PENDING", color: "#60a5fa", bg: "rgba(96,165,250,0.1)" };
  const ageMs = Date.now() - new Date(device.last_seen_at).getTime();
  if (ageMs > 24 * 60 * 60 * 1000) return { label: "OFFLINE", color: "#ef4444", bg: "rgba(239,68,68,0.1)" };
  if (ageMs > 30 * 60 * 1000) return { label: "STALE", color: "#facc15", bg: "rgba(250,204,21,0.1)" };
  return { label: "ONLINE", color: "#4ade80", bg: "rgba(74,222,128,0.1)" };
}

function DeviceRow({ device, plants }: { device: Device; plants: { id: string; nickname: string | null; name: string }[] }) {
  const updateDevice = useUpdateDevice();
  const sendCommand = useSendDeviceCommand();
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(device.name);
  const [showPlantPicker, setShowPlantPicker] = useState(false);
  const [identifyPending, setIdentifyPending] = useState(false);

  const info = statusInfo(device);
  const assignedPlant = plants.find(p => p.id === device.plant_id);
  const isRevoked = device.status === "revoked";

  const handleSaveName = () => {
    if (nameValue.trim() && nameValue !== device.name) {
      updateDevice.mutate({ id: device.id, name: nameValue.trim() });
    }
    setEditingName(false);
  };

  const handleAssignPlant = (plantId: string | null) => {
    updateDevice.mutate({ id: device.id, plant_id: plantId });
    setShowPlantPicker(false);
  };

  const handleIdentify = async () => {
    setIdentifyPending(true);
    try {
      await sendCommand.mutateAsync({ deviceId: device.id, command: "identify" });
      setTimeout(() => setIdentifyPending(false), 3000);
    } catch {
      setIdentifyPending(false);
    }
  };

  const handleRevoke = () => {
    updateDevice.mutate({ id: device.id, status: "revoked" });
  };

  const handleReactivate = () => {
    updateDevice.mutate({ id: device.id, status: "active" });
  };

  return (
    <div style={{
      border: '1px solid rgba(255,255,255,0.06)',
      padding: '16px 20px',
      opacity: isRevoked ? 0.4 : 1,
      transition: 'opacity 0.2s',
    }}>
      {/* Header row: name + status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
          <Cpu size={14} style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }} />
          {editingName ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1 }}>
              <input
                type="text"
                value={nameValue}
                onChange={e => setNameValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') { setNameValue(device.name); setEditingName(false); } }}
                autoFocus
                style={{
                  fontFamily: mono, fontSize: '13px', color: 'white', flex: 1,
                  backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)',
                  padding: '2px 6px', outline: 'none',
                }}
              />
              <button onClick={handleSaveName} className="cursor-pointer" style={{ background: 'none', border: 'none', padding: '2px', color: '#4ade80' }}>
                <Check size={12} />
              </button>
              <button onClick={() => { setNameValue(device.name); setEditingName(false); }} className="cursor-pointer" style={{ background: 'none', border: 'none', padding: '2px', color: 'rgba(255,255,255,0.65)' }}>
                <X size={12} />
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1, minWidth: 0 }}>
              <span style={{ fontFamily: mono, fontSize: '13px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {device.name}
              </span>
              {!isRevoked && (
                <button onClick={() => setEditingName(true)} className="cursor-pointer" style={{ background: 'none', border: 'none', padding: '2px', color: 'rgba(255,255,255,0.5)' }}>
                  <Edit2 size={10} />
                </button>
              )}
            </div>
          )}
        </div>
        <span style={{
          fontFamily: mono, fontSize: '8px', letterSpacing: '0.05em',
          padding: '1px 6px', color: info.color, background: info.bg, flexShrink: 0,
        }}>
          {info.label}
        </span>
      </div>

      {/* Details grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        <div>
          <div style={labelStyle}>token</div>
          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{device.device_token_prefix}...</div>
        </div>
        <div>
          <div style={labelStyle}>last seen</div>
          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>{formatAge(device.last_seen_at)}</div>
        </div>
        <div>
          <div style={labelStyle}>added</div>
          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.8)' }}>
            {new Date(device.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      {/* Plant assignment */}
      <div style={{ marginBottom: '12px' }}>
        <div style={labelStyle}>assigned plant</div>
        {showPlantPicker ? (
          <div style={{ marginTop: '4px' }}>
            <div style={{
              border: '1px solid rgba(255,255,255,0.1)',
              maxHeight: '150px', overflowY: 'auto',
            }}>
              <button
                onClick={() => handleAssignPlant(null)}
                className="cursor-pointer"
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.7)',
                  padding: '6px 10px', border: 'none', background: 'transparent',
                }}
              >
                — none (pulse-check) —
              </button>
              {plants.map(p => (
                <button
                  key={p.id}
                  onClick={() => handleAssignPlant(p.id)}
                  className="cursor-pointer"
                  style={{
                    display: 'block', width: '100%', textAlign: 'left',
                    fontFamily: mono, fontSize: '11px',
                    color: p.id === device.plant_id ? '#4ade80' : 'rgba(255,255,255,0.85)',
                    padding: '6px 10px', border: 'none',
                    background: p.id === device.plant_id ? 'rgba(74,222,128,0.06)' : 'transparent',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                  }}
                >
                  {p.nickname || p.name}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowPlantPicker(false)}
              className="cursor-pointer"
              style={{
                fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.6)',
                background: 'none', border: 'none', padding: '4px 0', marginTop: '4px',
              }}
            >
              cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => !isRevoked && setShowPlantPicker(true)}
            disabled={isRevoked}
            className={isRevoked ? '' : 'cursor-pointer'}
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              fontFamily: mono, fontSize: '11px',
              color: assignedPlant ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.55)',
              background: 'none', border: 'none', padding: '2px 0',
            }}
          >
            {assignedPlant ? (assignedPlant.nickname || assignedPlant.name) : 'unassigned'}
            {!isRevoked && <ChevronDown size={10} style={{ color: 'rgba(255,255,255,0.5)' }} />}
          </button>
        )}
      </div>

      {/* Actions */}
      {!isRevoked && (
        <div style={{ display: 'flex', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
          <button
            onClick={handleIdentify}
            disabled={identifyPending}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: '9px', letterSpacing: '0.05em',
              padding: '4px 10px', color: identifyPending ? '#4ade80' : 'rgba(255,255,255,0.8)',
              border: `1px solid ${identifyPending ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.08)'}`,
              background: identifyPending ? 'rgba(74,222,128,0.06)' : 'transparent',
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <Zap size={10} /> {identifyPending ? 'BLINKING...' : 'IDENTIFY'}
          </button>
          <button
            onClick={handleRevoke}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: '9px', letterSpacing: '0.05em',
              padding: '4px 10px', color: 'rgba(239,68,68,0.85)',
              border: '1px solid rgba(239,68,68,0.15)', background: 'transparent',
            }}
          >
            REVOKE
          </button>
        </div>
      )}

      {/* Revoked: reactivate */}
      {isRevoked && (
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '10px' }}>
          <button
            onClick={handleReactivate}
            className="cursor-pointer"
            style={{
              fontFamily: mono, fontSize: '9px', letterSpacing: '0.05em',
              padding: '4px 10px', color: 'rgba(255,255,255,0.65)',
              border: '1px solid rgba(255,255,255,0.08)', background: 'transparent',
            }}
          >
            REACTIVATE
          </button>
        </div>
      )}
    </div>
  );
}

export function DeviceManagement() {
  const { data: devices, isLoading } = useDevices();
  const { data: plants } = usePlants();

  const plantList = (plants || []).map((p: any) => ({ id: p.id, nickname: p.nickname, name: p.name }));
  const activeDevices = (devices || []).filter(d => d.status !== "revoked");
  const revokedDevices = (devices || []).filter(d => d.status === "revoked");

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Wifi size={14} style={{ color: 'rgba(255,255,255,0.6)' }} />
          <span style={{ fontFamily: mono, fontSize: '12px', color: 'rgba(255,255,255,0.85)' }}>sensor devices</span>
        </div>
        <span style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
          {activeDevices.length} active
        </span>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0' }}>
          <Loader2 size={14} className="animate-spin" style={{ color: 'rgba(255,255,255,0.55)' }} />
          <span style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.55)' }}>loading devices...</span>
        </div>
      ) : !devices || devices.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <WifiOff size={24} style={{ margin: '0 auto 12px', color: 'rgba(255,255,255,0.1)' }} />
          <div style={{ fontFamily: mono, fontSize: '11px', color: 'rgba(255,255,255,0.65)', marginBottom: '6px' }}>
            no sensors registered
          </div>
          <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.5)' }}>
            ask orchid to set up a sensor device
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {activeDevices.map(d => <DeviceRow key={d.id} device={d} plants={plantList} />)}
          {revokedDevices.length > 0 && (
            <>
              <div style={{ fontFamily: mono, fontSize: '9px', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '8px' }}>
                revoked
              </div>
              {revokedDevices.map(d => <DeviceRow key={d.id} device={d} plants={plantList} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
