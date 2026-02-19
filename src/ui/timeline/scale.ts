export function segmentX(startMin: number, viewStartMin: number, pxPerMin: number, leftPad = 120): number {
  return leftPad + (startMin - viewStartMin) * pxPerMin;
}

export function segmentWidth(startMin: number, endMin: number, pxPerMin: number): number {
  return (endMin - startMin) * pxPerMin;
}
