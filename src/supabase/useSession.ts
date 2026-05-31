/** Tracks the Supabase auth session; null when sync is disabled or signed out. */

import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './client'

export function useSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) =>
      setSession(s),
    )
    return () => sub.subscription.unsubscribe()
  }, [])

  return session
}
