import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface DiagnosisCardProps {
  data: {
    issue: string;
    severity: 'mild' | 'moderate' | 'severe';
    symptoms: string[];
    treatment: string[];
    prevention?: string;
  };
  message: string;
  onFindSupplies?: (location: string) => void;
}

const SEVERITY_COLORS: Record<string, string> = {
  mild: 'rgba(255,255,255,0.3)',
  moderate: 'rgba(255,200,50,0.6)',
  severe: 'rgba(255,80,80,0.6)',
};

export function DiagnosisCard({ data, message, onFindSupplies }: DiagnosisCardProps) {
  const borderColor = SEVERITY_COLORS[data.severity] || SEVERITY_COLORS.mild;

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: '#000',
        border: '1px solid rgba(255,255,255,0.1)',
        borderLeft: `3px solid ${borderColor}`,
        padding: '20px',
        borderRadius: '0',
      }}
    >
      {/* LLM prose message — conversational intro */}
      {message && (
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '12px',
          lineHeight: '1.6',
          color: 'rgba(255,255,255,0.7)',
          marginBottom: '16px',
        }}>
          {message}
        </div>
      )}

      {/* Issue header */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        marginBottom: '8px',
      }}>
        {'\u26A0'} {data.issue}
      </div>

      {/* Severity */}
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '11px',
        color: borderColor,
        marginBottom: '12px',
      }}>
        severity: {data.severity.toUpperCase()}
      </div>

      {/* Horizontal rule */}
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.2)',
        marginBottom: '16px',
        userSelect: 'none',
      }}>
        {'\u2501'.repeat(31)}
      </div>

      {/* Symptoms */}
      {data.symptoms.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#fff',
            marginBottom: '8px',
          }}>
            SYMPTOMS
          </div>
          {data.symptoms.map((symptom, i) => (
            <div key={i} style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'rgba(255,255,255,0.7)',
              paddingLeft: '8px',
            }}>
              {'\u00B7'} {symptom}
            </div>
          ))}
        </div>
      )}

      {/* Treatment */}
      {data.treatment.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#fff',
            marginBottom: '8px',
          }}>
            TREATMENT
          </div>
          {data.treatment.map((step, i) => (
            <div key={i} style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'rgba(255,255,255,0.7)',
              paddingLeft: '8px',
            }}>
              {i + 1}. {step}
            </div>
          ))}
        </div>
      )}

      {/* Prevention */}
      {data.prevention && (
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '12px',
          lineHeight: '1.6',
          color: 'rgba(255,255,255,0.5)',
          marginBottom: '16px',
          fontStyle: 'italic',
        }}>
          {data.prevention}
        </div>
      )}

      {/* Action button — expands to location input on click */}
      <FindSuppliesButton onFindSupplies={onFindSupplies} />
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Two-state button: "find treatment supplies →" → zip/city input → send
// ---------------------------------------------------------------------------

const mono = 'ui-monospace, monospace';

function FindSuppliesButton({ onFindSupplies }: { onFindSupplies?: (location: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [location, setLocation] = useState('');
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (expanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [expanded]);

  const handleSubmit = () => {
    const trimmed = location.trim();
    if (!trimmed || !onFindSupplies) return;
    onFindSupplies(trimmed);
    setSent(true);
    setExpanded(false);
  };

  if (sent) {
    return (
      <div style={{
        fontFamily: mono,
        fontSize: '11px',
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'center',
        padding: '10px 0',
      }}>
        searching nearby stores...
      </div>
    );
  }

  return (
    <AnimatePresence mode="wait">
      {!expanded ? (
        <motion.button
          key="cta"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => onFindSupplies && setExpanded(true)}
          disabled={!onFindSupplies}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '0',
            padding: '10px 16px',
            fontFamily: mono,
            fontSize: '11px',
            color: 'rgba(255,255,255,0.7)',
            cursor: onFindSupplies ? 'pointer' : 'default',
            letterSpacing: '0.04em',
            width: '100%',
            textAlign: 'center',
            opacity: onFindSupplies ? 1 : 0.4,
            transition: 'border-color 150ms, color 150ms, opacity 150ms',
          }}
          onMouseEnter={e => {
            if (!onFindSupplies) return;
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.6)';
            e.currentTarget.style.color = '#fff';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
          }}
        >
          find treatment supplies {'\u2192'}
        </motion.button>
      ) : (
        <motion.div
          key="input"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          style={{ display: 'flex', gap: '8px', alignItems: 'center' }}
        >
          <style>{`.find-supplies-input::placeholder { color: rgba(255,255,255,0.35); opacity: 1; }`}</style>
          <input
            ref={inputRef}
            type="text"
            className="find-supplies-input"
            value={location}
            onChange={e => setLocation(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSubmit(); }}
            placeholder="zip code or city"
            style={{
              flex: 1,
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '9px 12px',
              fontFamily: mono,
              fontSize: '11px',
              color: '#fff',
              outline: 'none',
              minWidth: 0,
            }}
          />
          <button
            onClick={handleSubmit}
            disabled={!location.trim()}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '9px 14px',
              fontFamily: mono,
              fontSize: '11px',
              color: '#fff',
              cursor: location.trim() ? 'pointer' : 'default',
              opacity: location.trim() ? 1 : 0.3,
              whiteSpace: 'nowrap',
              transition: 'opacity 150ms, border-color 150ms',
            }}
          >
            GO
          </button>
          <button
            onClick={() => { setExpanded(false); setLocation(''); }}
            style={{
              background: 'transparent',
              border: 'none',
              fontFamily: mono,
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              cursor: 'pointer',
              padding: '9px 4px',
              whiteSpace: 'nowrap',
            }}
          >
            {'\u2715'}
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
