import Script from 'next/script'

export default function WidgetDemoPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
  const embedSnippet = `<script\n  src="${appUrl}/widget.js"\n  data-url="${appUrl}"\n  data-title="CBBA Support"\n  data-color="#604484"\n><\/script>`

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <h1 className="text-2xl font-bold mb-2">Chat Widget</h1>
        <p className="text-gray-400 text-sm mb-10">
          Embed this snippet anywhere on your website to add the CBBA chat widget.
        </p>

        <div className="bg-gray-900 border border-white/10 rounded-xl p-6 mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">Embed code</p>
          <pre className="text-sm text-green-400 whitespace-pre-wrap break-all leading-relaxed">{embedSnippet}</pre>
        </div>

        <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
          <p className="text-xs text-gray-500 uppercase tracking-widest mb-4">Attributes</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-white/10">
                <th className="pb-2 font-medium">Attribute</th>
                <th className="pb-2 font-medium">Default</th>
                <th className="pb-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {[
                ['data-url', appUrl, 'Base URL of your CBBA Inbox deployment'],
                ['data-title', 'CBBA Support', 'Widget header title'],
                ['data-color', '#604484', 'Primary accent colour (hex)'],
              ].map(([attr, def, desc]) => (
                <tr key={attr}>
                  <td className="py-2.5 font-mono text-cbba-purple pr-4">{attr}</td>
                  <td className="py-2.5 text-gray-400 pr-4">{def}</td>
                  <td className="py-2.5 text-gray-400">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live widget preview */}
      <Script
        src="/widget.js"
        data-url={appUrl}
        data-title="CBBA Support"
        data-color="#604484"
        strategy="afterInteractive"
      />
    </div>
  )
}
