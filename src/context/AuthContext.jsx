import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../supabase/config'

const AuthContext = createContext(null)

export function useAuth() {
  return useContext(AuthContext)
}

function randomPairCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [couple, setCouple] = useState(null)
  const [partnerName, setPartnerName] = useState(null)
  const [partnerTimezone, setPartnerTimezone] = useState(null)
  const [partnerBirthday, setPartnerBirthday] = useState(null)
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState(null)
  const [loading, setLoading] = useState(true)

  const user = session?.user || null

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (!data.session) setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (!s) {
        setProfile(null)
        setCouple(null)
        setPartnerName(null)
        setPartnerTimezone(null)
        setPartnerBirthday(null)
        setLoading(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    let channel
    async function load() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, pair_code, couple_id, timezone, birthday, avatar_url, location_sharing_enabled, created_at')
        .eq('id', user.id)
        .single()
      if (error && error.code !== 'PGRST116') console.error('[v0] profile load failed', error)
      setProfile(data || null)
      setLoading(false)
    }
    load()
    channel = supabase
      .channel(`profile-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [user?.id])

  // Keep my timezone up to date (used to show my local time to my partner)
  useEffect(() => {
    if (!user || !profile) return
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (profile.timezone !== tz) {
      supabase.from('profiles').update({ timezone: tz }).eq('id', user.id)
    }
  }, [user?.id, profile?.timezone])

  useEffect(() => {
    if (!profile?.couple_id) {
      setCouple(null)
      return
    }
    let channel
    async function load() {
      const { data } = await supabase
        .from('couples')
        .select('*')
        .eq('id', profile.couple_id)
        .single()
      setCouple(data || null)
    }
    load()
    channel = supabase
      .channel(`couple-${profile.couple_id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'couples', filter: `id=eq.${profile.couple_id}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [profile?.couple_id])

  const partnerUid = couple
    ? couple.member1 === user?.id
      ? couple.member2
      : couple.member1
    : null

  useEffect(() => {
    if (!partnerUid) {
      setPartnerName(null)
      setPartnerTimezone(null)
      setPartnerBirthday(null)
      setPartnerAvatarUrl(null)
      return
    }
    let channel
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, timezone, birthday, avatar_url')
        .eq('id', partnerUid)
        .single()
      setPartnerName(data?.display_name || null)
      setPartnerTimezone(data?.timezone || null)
      setPartnerBirthday(data?.birthday || null)
      setPartnerAvatarUrl(data?.avatar_url || null)
    }
    load()
    channel = supabase
      .channel(`partner-profile-${partnerUid}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${partnerUid}` },
        load
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [partnerUid])

  async function signup(email, password, displayName) {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: { data: { display_name: displayName?.trim() || email.split('@')[0] } },
    })
    if (error) throw error
    if (!data.user) throw new Error('We could not create your account. Please try again.')
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: data.user.id,
      display_name: displayName?.trim() || email.split('@')[0],
      pair_code: randomPairCode(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }, { onConflict: 'id' })
    if (profileError) throw profileError
    return data.user
  }

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.user
  }

  function logout() {
    return supabase.auth.signOut()
  }

  async function pairWithCode(code) {
    const { error } = await supabase.rpc('pair_with_code', { code: code.trim().toUpperCase() })
    if (error) throw new Error(error.message)
  }

  async function unpairCouple() {
    const { error } = await supabase.rpc('unpair_couple')
    if (error) throw new Error(error.message)
  }

  // Retries on the rare chance the randomly generated code collides with
  // someone else's — the unique constraint on profiles.pair_code makes that
  // safe to detect (Postgres error code 23505).
  async function regeneratePairCode() {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = randomPairCode()
      const { error } = await supabase.from('profiles').update({ pair_code: code }).eq('id', user.id)
      if (!error) return code
      if (error.code !== '23505') throw new Error(error.message)
    }
    throw new Error('Could not generate a unique code — please try again.')
  }

  const value = {
    user,
    profile,
    couple,
    partnerUid,
    partnerName,
    partnerTimezone,
    partnerBirthday,
    partnerAvatarUrl,
    loading,
    signup,
    login,
    logout,
    pairWithCode,
    unpairCouple,
    regeneratePairCode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
