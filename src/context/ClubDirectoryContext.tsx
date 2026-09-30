import { useI18n } from '../context/LanguageContext'
import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { useAuth } from './AuthContext'
import { supabase } from '../lib/supabase'
import type { Profile, Stadium } from '../lib/database.types'

type Directory = {
  players: Profile[]; playersLoading: boolean; playersError: string; refreshPlayers: () => Promise<void>
  stadiums: Stadium[]; stadiumsLoading: boolean; stadiumsError: string; refreshStadiums: () => Promise<void>
  addStadium: (name: string) => Promise<Stadium>
  stadiumName: (id: string | null | undefined) => string
}
const DirectoryContext = createContext<Directory | null>(null)
export function ClubDirectoryProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n()

  const { user } = useAuth()
  const [players, setPlayers] = useState<Profile[]>([])
  const [playersLoading, setPlayersLoading] = useState(true)
  const [playersError, setPlayersError] = useState('')
  const [stadiums, setStadiums] = useState<Stadium[]>([])
  const [stadiumsLoading, setStadiumsLoading] = useState(true)
  const [stadiumsError, setStadiumsError] = useState('')
  const refreshPlayers = useCallback(async () => {
    setPlayersLoading(true); setPlayersError('')
    try {
      const { data, error } = await supabase.from('profiles').select('id, display_name, avatar_url, created_at').order('display_name')
      if (error) throw error
      setPlayers(data ?? [])
    } catch { setPlayersError(t("Could not load the player list.")) }
    finally { setPlayersLoading(false) }
  }, [])
  const refreshStadiums = useCallback(async () => {
    setStadiumsLoading(true); setStadiumsError('')
    try {
      const { data, error } = await supabase.from('stadiums').select('*').order('name')
      if (error) throw error
      setStadiums(data ?? [])
    } catch { setStadiumsError(t("Stadiums are unavailable right now. Please try again.")) }
    finally { setStadiumsLoading(false) }
  }, [])
  useEffect(() => {
    if (user) { void refreshPlayers(); void refreshStadiums() }
  }, [user?.id, refreshPlayers, refreshStadiums])
  const addStadium = async (name: string) => {
    if (!user) throw new Error(t("Sign in to add a stadium."))
    const normalized = name.trim().replace(/\s+/g, ' ')
    if (!normalized || normalized.length > 120) throw new Error(t("Use a stadium name between 1 and 120 characters."))
    const existing = stadiums.find(stadium => stadium.name.toLowerCase() === normalized.toLowerCase())
    if (existing) return existing
    const { data, error } = await supabase.from('stadiums').insert({ name: normalized, created_by: user.id }).select().single()
    if (error?.code === '23505') {
      // Another player may have added the same name while this form was open.
      const { data: list, error: readError } = await supabase.from('stadiums').select('*').order('name')
      const duplicate = list?.find(stadium => stadium.name.toLowerCase().replace(/\s+/g, ' ') === normalized.toLowerCase())
      if (!readError && duplicate) { setStadiums(list!); return duplicate }
    }
    if (error || !data) throw new Error(t("The stadium could not be saved. Please try again."))
    setStadiums(previous => [...previous.filter(stadium => stadium.id !== data.id), data].sort((a, b) => a.name.localeCompare(b.name)))
    return data
  }
  const stadiumName = (id: string | null | undefined) => !id ? t("Stadium to be confirmed") : stadiums.find(stadium => stadium.id === id)?.name ?? (stadiumsLoading ? t("Loading stadium...") : t("Stadium details unavailable"))
  return <DirectoryContext.Provider value={{ players, playersLoading, playersError, refreshPlayers, stadiums, stadiumsLoading, stadiumsError, refreshStadiums, addStadium, stadiumName }}>{children}</DirectoryContext.Provider>
}
export function useClubDirectory() {
  const context = useContext(DirectoryContext)
  if (!context) throw new Error('ClubDirectoryProvider is required')
  return context
}
