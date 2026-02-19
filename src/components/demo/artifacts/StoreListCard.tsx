import React from 'react';
import { motion } from 'framer-motion';

interface StoreListCardProps {
  data: {
    product: string;
    stores: Array<{
      name: string;
      address?: string;
      distance?: string;
      note?: string;
    }>;
  };
  message: string;
}

export function StoreListCard({ data, message }: StoreListCardProps) {
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

      {/* Header */}
      <div style={{
        fontFamily: "'Press Start 2P', monospace",
        fontSize: '11px',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#fff',
        marginBottom: '4px',
      }}>
        STORES NEAR YOU
      </div>

      {/* Product name */}
      <div style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '12px',
        color: 'rgba(255,255,255,0.5)',
        marginBottom: '16px',
      }}>
        {data.product}
      </div>

      {/* Store cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: message ? '16px' : '0' }}>
        {data.stores.map((store, i) => (
          <div
            key={i}
            style={{
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '12px',
            }}
          >
            {/* Number + Name */}
            <div style={{
              fontFamily: 'ui-monospace, monospace',
              fontSize: '12px',
              color: 'rgba(255,255,255,0.85)',
              fontWeight: 'bold',
              marginBottom: '4px',
            }}>
              {i + 1}{'  '}{store.name.toUpperCase()}
            </div>

            {/* Address */}
            {store.address && (
              <div style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.5)',
                paddingLeft: '20px',
                marginBottom: '2px',
              }}>
                {store.address}
              </div>
            )}

            {/* Distance + note */}
            {(store.distance || store.note) && (
              <div style={{
                fontFamily: 'ui-monospace, monospace',
                fontSize: '11px',
                color: 'rgba(255,255,255,0.35)',
                paddingLeft: '20px',
              }}>
                {[store.distance, store.note].filter(Boolean).join(' \u00B7 ')}
              </div>
            )}
          </div>
        ))}
      </div>

    </motion.div>
  );
}
