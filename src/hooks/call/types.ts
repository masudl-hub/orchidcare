// Hook return types
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';

// ---------------------------------------------------------------------------
// annotate_view — spatial annotations on camera feed
// ---------------------------------------------------------------------------

export type GridRegion =
  'T1' | 'T2' | 'T3' | 'T4' | 'T5' |
  'U1' | 'U2' | 'U3' | 'U4' | 'U5' |
  'M1' | 'M2' | 'M3' | 'M4' | 'M5' |
  'L1' | 'L2' | 'L3' | 'L4' | 'L5' |
  'B1' | 'B2' | 'B3' | 'B4' | 'B5';
export type MarkerType = 'arrow' | 'circle' | 'x' | 'label';
export type ArrowDirection = 'up' | 'down' | 'left' | 'right'
  | 'up-left' | 'up-right' | 'down-left' | 'down-right';

export interface AnnotationMarker {
  region: GridRegion;
  type: MarkerType;
  label?: string;
  direction?: ArrowDirection;
}

export interface AnnotationSet {
  markers: AnnotationMarker[];
  hold?: number; // seconds, default 8, 0 = indefinite
}
