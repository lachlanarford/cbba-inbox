import BugReportForm from '@/components/settings/BugReportForm'

export default function BugReportsPage() {
  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-lg font-semibold text-white">Report an Issue</h1>
        <p className="text-sm text-gray-400 mt-1">Submit bug reports or feature requests to the admin team.</p>
      </div>
      <BugReportForm />
    </div>
  )
}
