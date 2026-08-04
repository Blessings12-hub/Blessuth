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
        setLoading(false)
      }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!user) return
    let channel
    async function load() {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
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
      return
    }
    let channel
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('display_name, timezone')
        .eq('id', partnerUid)
        .single()
      setPartnerName(data?.display_name || null)
      setPartnerTimezone(data?.timezone || null)
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
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    const uid = data.user.id
    const pairCode = randomPairCode()
    const { error: profileError } = await supabase.from('profiles').insert({
      id: uid,
      email,
      display_name: displayName || email.split('@')[0],
      pair_code: pairCode,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    })
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

  const value = {
    user,
    profile,
    couple,
    partnerUid,
    partnerName,
    partnerTimezone,
    loading,
    signup,
    login,
    logout,
    pairWithCode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
