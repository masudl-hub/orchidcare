import React from 'react';
import { motion } from 'framer-motion';

interface CareGuideCardProps {
  data: {
    topic: string;
    plant: string;
    schedule: Record<string, string>;
    howTo: string;
    troubleshooting?: string[];
  };
  message: string;
}

export function CareGuideCard({ data, message }: CareGuideCardProps) {
  const scheduleEntries = Object.entries(data.schedule);

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

      {/* Title */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        marginBottom: '4px',
      }}>
        {data.topic}
      </div>

      {/* Plant name */}
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: '16px',
      }}>
        {data.plant}
      </div>

      {/* Schedule section */}
      {scheduleEntries.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#fff',
            marginBottom: '8px',
          }}>
            SCHEDULE
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: '4px 16px',
            fontFamily: 'ui-monospace, monospace',
            fontSize: '11px',
          }}>
            {scheduleEntries.map(([season, frequency]) => (
              <React.Fragment key={season}>
                <span style={{ color: 'rgba(255,255,255,0.4)' }}>{season}</span>
                <span style={{ color: 'rgba(255,255,255,0.85)' }}>{frequency}</span>
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {/* How-to text */}
      {data.howTo && (
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '12px',
          lineHeight: '1.6',
          color: 'rgba(255,255,255,0.7)',
          marginBottom: '16px',
        }}>
          {data.howTo}
        </div>
      )}

      {/* Troubleshooting */}
      {data.troubleshooting && data.troubleshooting.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: '11px',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#fff',
            marginBottom: '8px',
          }}>
            TROUBLESHOOTING
          </div>
          {data.troubleshooting.map((item, i) => (
            <div key={i} style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'rgba(255,255,255,0.7)',
              paddingLeft: '8px',
            }}>
              {'\u00B7'} {item}
            </div>
          ))}
        </div>
      )}

    </motion.div>
  );
}
