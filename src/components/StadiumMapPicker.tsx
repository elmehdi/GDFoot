import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useI18n } from '../context/LanguageContext'
import type { Coordinates } from '../lib/maps'

const CASABLANCA: [number, number] = [33.5731, -7.5898]

export default function StadiumMapPicker({ value, onChange }: { value: Coordinates | null; onChange: (point: Coordinates) => void }) {
  const { t } = useI18n()
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const marker = useRef<L.CircleMarker | null>(null)
  const onChangeRef = useRef(onChange)
  const [locationError, setLocationError] = useState('')
  onChangeRef.current = onChange

  useEffect(() => {
    if (!container.current) return
    const initial: [number, number] = value ? [value.latitude, value.longitude] : CASABLANCA
    const instance = L.map(container.current, { scrollWheelZoom: false }).setView(initial, value ? 16 : 11)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
    }).addTo(instance)
    instance.on('click', event => onChangeRef.current({ latitude: Number(event.latlng.lat.toFixed(6)), longitude: Number(event.latlng.lng.toFixed(6)) }))
    map.current = instance
    window.setTimeout(() => instance.invalidateSize(), 0)
    return () => { instance.remove(); map.current = null; marker.current = null }
  }, [])

  useEffect(() => {
    if (!map.current || !value) return
    const point: [number, number] = [value.latitude, value.longitude]
    if (!marker.current) marker.current = L.circleMarker(point, { radius: 10, color: '#d4ef88', weight: 3, fillColor: '#354c25', fillOpacity: 1 }).addTo(map.current)
    else marker.current.setLatLng(point)
  }, [value?.latitude, value?.longitude])

  const useCurrentLocation = () => {
    setLocationError('')
    if (!navigator.geolocation) { setLocationError(t('Location unavailable. Choose the pin on the map.')); return }
    navigator.geolocation.getCurrentPosition(position => {
      const point = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) }
      map.current?.setView([point.latitude, point.longitude], 16)
      onChange(point)
    }, () => setLocationError(t('Location unavailable. Choose the pin on the map.')))
  }

  return <div className="stadium-map-picker"><p className="field-hint">{t('Tap the map to place the stadium pin.')}</p><div ref={container} className="stadium-map" role="application" aria-label={t('Stadium location map')} /><div className="stadium-map-actions"><button type="button" className="secondary-button" onClick={useCurrentLocation}>{t('Use my location')}</button>{value && <span>{t('Pin selected')}</span>}</div>{locationError && <p role="alert" className="form-error">{locationError}</p>}</div>
}
