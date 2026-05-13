import SignInButton from '@/components/auth/SignInButton'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cbba-navy">
      <div className="w-full max-w-sm space-y-8 px-4">
        {/* Logo / wordmark */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2">
            <span className="text-cbba-gold font-bold text-3xl tracking-tight">CBBA</span>
            <span className="text-white font-light text-xl tracking-widest uppercase">Storm</span>
          </div>
          <p className="text-gray-400 text-sm">Staff Inbox</p>
        </div>

        {/* Card */}
        <div className="bg-cbba-navy-light border border-white/10 rounded-2xl p-8 space-y-6 shadow-2xl">
          <div className="space-y-1 text-center">
            <h1 className="text-xl font-semibold text-white">Welcome back</h1>
            <p className="text-gray-400 text-sm">Sign in with your CBBA Google account</p>
          </div>

          <SignInButton />

          <p className="text-center text-xs text-gray-500">
            Staff access only. Contact your administrator if you need an account.
          </p>
        </div>
      </div>
    </div>
  )
}
