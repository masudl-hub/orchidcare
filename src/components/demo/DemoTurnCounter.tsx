import React from 'react';

interface DemoTurnCounterProps {
  turnsRemaining: number;
  totalTurns: number;
}

export function DemoTurnCounter({ turnsRemaining, totalTurns }: DemoTurnCounterProps) {
  let color = 'rgba(255,255,255,0.4)';
  if (turnsRemaining === 2) color = 'rgba(255,200,50,0.6)';
  if (turnsRemaining === 1) color = 'rgba(255,80,80,0.6)';

  return (
    <div
      style={{
        textAlign: 'center',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '11px',
        color,
        paddingTop: '6px',
        paddingBottom: '4px',
        opacity: turnsRemaining <= 0 ? 0 : 1,
        transition: 'color 300ms ease-out, opacity 300ms ease-out',
      }}
    >
      {turnsRemaining} of {totalTurns} turns remaining
    </div>
  );
}
