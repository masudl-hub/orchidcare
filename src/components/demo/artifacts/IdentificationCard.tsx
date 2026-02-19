import React from 'react';
import { motion } from 'framer-motion';

interface IdentificationCardProps {
  data: {
    species: string;
    commonName: string;
    confidence: number;
    family: string;
    origin: string;
    care: {
      light: string;
      water: string;
      humidity: string;
      toxic: boolean;
    };
  };
  message: string;
}

const TOTAL_BLOCKS = 15;

function confidenceBar(confidence: number): string {
  const filled = Math.round(confidence * TOTAL_BLOCKS);
  const empty = TOTAL_BLOCKS - filled;
  const pct = Math.round(confidence * 100);
  return '\u2588'.repeat(filled) + '\u2591'.repeat(empty) + ' ' + pct + '%';
}

export function IdentificationCard({ data, message }: IdentificationCardProps) {
  const kvPairs: Array<{ key: string; value: string; color?: string }> = [
    { key: 'family', value: data.family },
    { key: 'origin', value: data.origin },
    { key: 'light', value: data.care.light },
    { key: 'water', value: data.care.water },
    { key: 'humidity', value: data.care.humidity },
    {
      key: 'toxic',
      value: data.care.toxic ? 'yes (pets) \u26A0' : 'no',
      color: data.care.toxic ? 'rgba(255,200,50,0.85)' : undefined,
    },
  ];

  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        background: '#000',
        border: '1px solid rgba(255,255,255,0.1)',
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

      {/* Species name */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        marginBottom: '4px',
      }}>
        {data.species}
      </div>

      {/* Common name */}
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: '16px',
      }}>
        {data.commonName}
      </div>

      {/* Confidence bar */}
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '11px',
        color: 'rgba(255,255,255,0.85)',
        marginBottom: '16px',
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '4px 16px',
      }}>
        <span style={{ color: 'rgba(255,255,255,0.4)' }}>confidence</span>
        <span>{confidenceBar(data.confidence)}</span>
      </div>

      {/* Key-value grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr',
        gap: '4px 16px',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '11px',
        marginBottom: '16px',
      }}>
        {kvPairs.map(({ key, value, color }) => (
          <React.Fragment key={key}>
            <span style={{ color: 'rgba(255,255,255,0.4)' }}>{key}</span>
            <span style={{ color: color || 'rgba(255,255,255,0.85)' }}>{value}</span>
          </React.Fragment>
        ))}
      </div>

    </motion.div>
  );
}
