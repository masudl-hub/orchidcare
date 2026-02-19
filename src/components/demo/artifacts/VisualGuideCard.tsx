import React from 'react';
import { motion } from 'framer-motion';

interface VisualGuideCardProps {
  data: {
    title: string;
    steps?: Array<{ instruction: string; imagePrompt?: string }>;
    schedule?: Record<string, string>;
    howTo?: string;
  };
  images?: Array<{ url: string; title: string }>;
  message: string;
}

export function VisualGuideCard({ data, images, message }: VisualGuideCardProps) {
  const scheduleEntries = data.schedule ? Object.entries(data.schedule) : [];

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
        marginBottom: '16px',
      }}>
        {data.title}
      </div>

      {/* Generated images */}
      {images && images.length > 0 && (
        <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {images.map((img, i) => (
            <div key={i}>
              <img
                src={img.url}
                alt={img.title}
                style={{
                  width: '100%',
                  maxWidth: '100%',
                  objectFit: 'contain',
                  background: '#000',
                  display: 'block',
                  border: 'none',
                  padding: '0',
                }}
              />
              {img.title && (
                <div style={{
                  fontFamily: 'ui-monospace, monospace',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.35)',
                  marginTop: '4px',
                }}>
                  {img.title}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

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

      {/* Steps */}
      {data.steps && data.steps.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          {data.steps.map((step, i) => (
            <div key={i} style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: 'rgba(255,255,255,0.7)',
              paddingLeft: '8px',
            }}>
              {i + 1}. {step.instruction}
            </div>
          ))}
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

    </motion.div>
  );
}
