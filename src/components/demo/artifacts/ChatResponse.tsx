import React from 'react';
import { motion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';

interface ChatResponseProps {
  text: string;
  images?: { url: string; title: string }[];
}

export function ChatResponse({ text, images }: ChatResponseProps) {
  return (
    <motion.div
      initial={{ y: 40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        fontFamily: 'ui-monospace, monospace',
        fontSize: '12px',
        lineHeight: '1.6',
        color: 'rgba(255,255,255,0.7)',
      }}
    >
      <div className="prose prose-invert prose-sm max-w-none"
        style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: '12px',
          lineHeight: '1.6',
        }}
      >
        <ReactMarkdown
          components={{
            p: ({ children }) => <p style={{ margin: '0 0 8px 0', color: 'rgba(255,255,255,0.7)' }}>{children}</p>,
            strong: ({ children }) => <strong style={{ color: 'rgba(255,255,255,0.9)' }}>{children}</strong>,
            em: ({ children }) => <em style={{ color: 'rgba(255,255,255,0.6)' }}>{children}</em>,
            ul: ({ children }) => <ul style={{ margin: '4px 0', paddingLeft: '16px', color: 'rgba(255,255,255,0.7)' }}>{children}</ul>,
            ol: ({ children }) => <ol style={{ margin: '4px 0', paddingLeft: '16px', color: 'rgba(255,255,255,0.7)' }}>{children}</ol>,
            li: ({ children }) => <li style={{ margin: '2px 0' }}>{children}</li>,
            a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'underline' }}>{children}</a>,
          }}
        >
          {text}
        </ReactMarkdown>
      </div>

      {images && images.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
          {images.map((img, i) => (
            <div key={i} style={{ borderRadius: '8px', overflow: 'hidden' }}>
              <img
                src={img.url}
                alt={img.title || ''}
                style={{ width: '100%', display: 'block', borderRadius: '8px' }}
                loading="lazy"
              />
              {img.title && (
                <p style={{
                  margin: '4px 0 0',
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.4)',
                  fontFamily: 'ui-monospace, monospace',
                }}>
                  {img.title}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
