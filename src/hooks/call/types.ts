// Hook return types
export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'ended' | 'error';

// ---------------------------------------------------------------------------
// annotate_view — spatial annotations on camera feed
// ---------------------------------------------------------------------------

export type GridRegion = 'TL' | 'TC' | 'TR' | 'ML' | 'MC' | 'MR' | 'BL' | 'BC' | 'BR';
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
