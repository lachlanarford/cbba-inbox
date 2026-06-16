'use client'

import { useState, useRef, useTransition } from 'react'

interface BrandingSettingsProps {
  initialAccentColor: string
  initialLogoUrl: string
}

const PRESET_COLOURS = [
  { label: 'CBBA Purple', hex: '#604484' },
  { label: 'Ocean Blue', hex: '#2563eb' },
  { label: 'Teal', hex: '#0d9488' },
  { label: 'Crimson', hex: '#dc2626' },
  { label: 'Forest', hex: '#16a34a' },
  { label: 'Slate', hex: '#475569' },
  { label: 'Orange', hex: '#ea580c' },
  { label: 'Rose', hex: '#e11d48' },
]

async function saveBrandingSetting(key: string, value: string) {
  await fetch('/api/settings/branding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, value }),
  })
}

export default function BrandingSettings({ initialAccentColor, initialLogoUrl }: BrandingSettingsProps) {
  const [accentColor, setAccentColor] = useState(initialAccentColor)
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [saved, setSaved] = useState(false)
  const [isSaving, startSave] = useTransition()
  const fileInputRef = useRef<HTMLInputElement>(null)

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setUploadError('')
  }

  async function uploadLogo() {
    if (!logoFile) return
    setUploading(true)
    setUploadError('')
    try {
      const form = new FormData()
      form.append('logo', logoFile)
      const res = await fetch('/api/settings/logo', { method: 'POST', body: form })
      const json = await res.json() as { logo_url?: string; error?: string }
      if (!res.ok) { setUploadError(json.error ?? 'Upload failed'); return }
      setLogoUrl(json.logo_url ?? '')
      setLogoFile(null)
      setLogoPreview(null)
    } finally {
      setUploading(false)
    }
  }

  function handleSave() {
    startSave(async () => {
      if (logoFile) await uploadLogo()
      await saveBrandingSetting('brand_accent_color', accentColor)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    })
  }

  const displayLogo = logoPreview ?? logoUrl

  return (
    <div className="space-y-6">
      {/* Accent colour */}
      <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6 space-y-5">
        <h2 className="text-sm font-semibold text-white">Accent colour</h2>

        <div>
          <p className="text-xs text-gray-500 mb-3">Presets</p>
          <div className="flex flex-wrap gap-2.5">
            {PRESET_COLOURS.map((p) => (
              <button
                key={p.hex}
                onClick={() => setAccentColor(p.hex)}
                title={p.label}
                className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${
                  accentColor.toLowerCase() === p.hex.toLowerCase() ? 'border-white scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: p.hex }}
              />
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-3">Custom colour</p>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setAccentColor(e.target.value) }}
              className="w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-cbba-purple"
            />
            <div className="flex items-center gap-2 ml-2">
              <span className="w-6 h-6 rounded-full" style={{ backgroundColor: accentColor }} />
              <span className="text-xs text-gray-500">Preview</span>
            </div>
          </div>
        </div>

        <p className="text-xs text-gray-600">Changes apply after saving and refreshing the page.</p>
      </div>

      {/* Logo */}
      <div className="bg-cbba-navy-dark border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white">Logo</h2>

        {/* Preview */}
        <div className="flex items-center gap-3 p-3 bg-cbba-navy rounded-lg border border-white/5">
          <span className="text-xs text-gray-500">Preview:</span>
          {displayLogo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayLogo} alt="Logo preview" className="h-8 w-auto max-w-[160px] object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-cbba-gold font-bold text-xl tracking-tight">CBBA</span>
              <span className="text-white/60 font-light text-sm tracking-widest uppercase">Inbox</span>
            </div>
          )}
        </div>

        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,.svg"
            onChange={handleLogoChange}
            className="hidden"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 hover:text-white hover:border-white/20 transition-colors"
            >
              {logoFile ? logoFile.name : 'Choose file'}
            </button>
            {logoFile && (
              <button
                onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Remove
              </button>
            )}
            {!logoFile && logoUrl && (
              <button
                onClick={async () => {
                  await saveBrandingSetting('brand_logo_url', '')
                  setLogoUrl('')
                }}
                className="text-xs text-gray-500 hover:text-red-400 transition-colors"
              >
                Remove logo
              </button>
            )}
          </div>
          <p className="text-xs text-gray-600 mt-1.5">PNG, JPG, WebP or SVG. Max 2MB. Transparent background recommended.</p>
          {uploadError && <p className="text-xs text-red-400 mt-1">{uploadError}</p>}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={isSaving || uploading}
          className="px-5 py-2.5 rounded-lg bg-cbba-purple text-white text-sm font-medium disabled:opacity-50 hover:bg-cbba-purple-light transition-colors"
        >
          {isSaving || uploading ? 'Saving...' : 'Save changes'}
        </button>
        {saved && <span className="text-xs text-green-400">Saved. Refresh to see changes.</span>}
      </div>
    </div>
  )
}
