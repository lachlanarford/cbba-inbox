import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function PrintLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen bg-white text-[#111827]" style={{ colorScheme: 'light' }}>
      <style>{`
        html, body { background: #fff !important; color: #111827 !important; }
      `}</style>
      {children}
    </div>
  )
}
