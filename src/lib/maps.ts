import type { Stadium } from './database.types'

export type Coordinates = { latitude: number; longitude: number }

export function stadiumCoordinates(stadium: Stadium | null | undefined): Coordinates | null {
  if (stadium?.latitude == null || stadium.longitude == null) return null
  return { latitude: Number(stadium.latitude), longitude: Number(stadium.longitude) }
}

export function directionsLinks({ latitude, longitude }: Coordinates) {
  const point = `${latitude},${longitude}`
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(point)}&travelmode=driving`,
    waze: `https://www.waze.com/ul?ll=${encodeURIComponent(point)}&navigate=yes`,
  }
}
