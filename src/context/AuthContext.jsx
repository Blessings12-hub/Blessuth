import { createContext, useContext, useEffect, useState } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth'
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'

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
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [couple, setCouple] = useState(null)
  const [loading, setLoading] = useState(true)

  // Track auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u)
      if (!u) {
        setProfile(null)
        setCouple(null)
        setLoading(false)
      }
    })
    return unsub
  }, [])

  // Track this user's profile doc (has pairCode / coupleId)
  useEffect(() => {
    if (!user) return
    const ref = doc(db, 'users', user.uid)
    const unsub = onSnapshot(ref, (snap) => {
      setProfile(snap.exists() ? snap.data() : null)
      setLoading(false)
    })
    return unsub
  }, [user])

  // Track the couple doc once we know the coupleId
  useEffect(() => {
    if (!profile?.coupleId) {
      setCouple(null)
      return
    }
    const ref = doc(db, 'couples', profile.coupleId)
    const unsub = onSnapshot(ref, (snap) => {
      setCouple(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    })
    return unsub
  }, [profile?.coupleId])

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    const pairCode = randomPairCode()
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      displayName: displayName || email.split('@')[0],
      pairCode,
      coupleId: null,
      createdAt: serverTimestamp(),
    })
    return cred.user
  }

  async function login(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    return cred.user
  }

  function logout() {
    return signOut(auth)
  }

  // Link two accounts using the partner's pair code
  async function pairWithCode(code) {
    const normalized = code.trim().toUpperCase()
    const meRef = doc(db, 'users', user.uid)
    const meSnap = await getDoc(meRef)
    const me = meSnap.data()

    if (me.pairCode === normalized) {
      throw new Error("That's your own code — ask your partner for theirs.")
    }

    // Find partner by pairCode. Since there's no query-by-field index set up
    // by default, we store an index doc at pairCodes/{code} -> uid.
    const indexRef = doc(db, 'pairCodes', normalized)
    const indexSnap = await getDoc(indexRef)
    if (!indexSnap.exists()) {
      throw new Error('No account found with that code.')
    }
    const partnerUid = indexSnap.data().uid
    const partnerRef = doc(db, 'users', partnerUid)
    const partnerSnap = await getDoc(partnerRef)
    if (!partnerSnap.exists()) throw new Error('Partner account not found.')
    const partner = partnerSnap.data()

    if (partner.coupleId) {
      throw new Error('That person is already paired with someone.')
    }

    const coupleId = [user.uid, partnerUid].sort().join('_')
    await setDoc(doc(db, 'couples', coupleId), {
      members: [user.uid, partnerUid],
      names: {
        [user.uid]: me.displayName,
        [partnerUid]: partner.displayName,
      },
      createdAt: serverTimestamp(),
      nextVisitDate: null,
    })
    await updateDoc(meRef, { coupleId })
    await updateDoc(partnerRef, { coupleId })
  }

  // Ensure a pairCodes/{code} -> uid lookup doc exists for this user
  async function ensurePairCodeIndex() {
    if (!profile?.pairCode || !user) return
    const ref = doc(db, 'pairCodes', profile.pairCode)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, { uid: user.uid })
    }
  }

  useEffect(() => {
    ensurePairCodeIndex()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.pairCode])

  const partnerUid = couple?.members?.find((m) => m !== user?.uid) || null
  const partnerName = partnerUid ? couple?.names?.[partnerUid] : null

  const value = {
    user,
    profile,
    couple,
    partnerUid,
    partnerName,
    loading,
    signup,
    login,
    logout,
    pairWithCode,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
