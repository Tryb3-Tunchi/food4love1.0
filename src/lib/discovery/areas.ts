// Pure module with NO imports so it can be unit-tested with node --test.

// Supported areas. The map can jump to any of them, and a member who does not want
// to share a device location can choose one instead. Either way the database stores
// only the centre of a ~2 km square, never an exact point.
export interface DiscoveryArea {
  id: string
  label: string
  center: [number, number]
}

export const DISCOVERY_AREAS: DiscoveryArea[] = [
  { id: 'lagos', label: 'Lagos', center: [6.5244, 3.3792] },
  { id: 'abuja', label: 'Abuja', center: [9.0765, 7.3986] },
  { id: 'port-harcourt', label: 'Port Harcourt', center: [4.8156, 7.0498] },
  { id: 'ibadan', label: 'Ibadan', center: [7.3775, 3.947] },
  { id: 'enugu', label: 'Enugu', center: [6.4584, 7.5464] },
  { id: 'kano', label: 'Kano', center: [12.0022, 8.5919] },
]

export function areaById(id: string): DiscoveryArea | null {
  return DISCOVERY_AREAS.find((a) => a.id === id) ?? null
}
