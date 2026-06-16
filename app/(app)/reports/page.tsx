'use client'

import { useState } from 'react'
import DateRangeFilter, { PRESETS, type ReportFilters } from '@/components/reporting/DateRangeFilter'
import SummaryStatsCard from '@/components/reporting/SummaryStatsCard'
import VolumeByChannelCard from '@/components/reporting/VolumeByChannelCard'
import BusiestHoursCard from '@/components/reporting/BusiestHoursCard'
import ResponseTimeCard from '@/components/reporting/ResponseTimeCard'
import ResolutionRateCard from '@/components/reporting/ResolutionRateCard'
import StaffVsAiCard from '@/components/reporting/StaffVsAiCard'
import StaffLeaderboardCard from '@/components/reporting/StaffLeaderboardCard'
import PriorityDistributionCard from '@/components/reporting/PriorityDistributionCard'
import CategoryDistributionCard from '@/components/reporting/CategoryDistributionCard'
import FeedbackScoresCard from '@/components/reporting/FeedbackScoresCard'
import LiveChatReportCard from '@/components/reporting/LiveChatReportCard'

const DEFAULT_FILTERS: ReportFilters = {
  range: PRESETS[1],
  channel: '',
  department: '',
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilters>(DEFAULT_FILTERS)

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Reports</h1>
            <p className="text-xs text-gray-500 mt-0.5">Conversation and performance analytics</p>
          </div>
          <DateRangeFilter filters={filters} onChange={setFilters} />
        </div>

        {/* Summary stats */}
        <SummaryStatsCard filters={filters} />

        {/* Volume + Busiest hours */}
        <div className="grid grid-cols-3 gap-4">
          <VolumeByChannelCard filters={filters} />
          <BusiestHoursCard filters={filters} />
        </div>

        {/* Response time + Resolution + Staff vs AI */}
        <div className="grid grid-cols-3 gap-4">
          <ResponseTimeCard filters={filters} />
          <ResolutionRateCard filters={filters} />
          <StaffVsAiCard filters={filters} />
        </div>

        {/* Staff leaderboard + Priority distribution */}
        <div className="grid grid-cols-3 gap-4">
          <StaffLeaderboardCard filters={filters} />
          <PriorityDistributionCard filters={filters} />
        </div>

        {/* Category distribution + Feedback scores + Live chat */}
        <div className="grid grid-cols-3 gap-4">
          <CategoryDistributionCard filters={filters} />
          <FeedbackScoresCard filters={filters} />
          <LiveChatReportCard filters={filters} />
        </div>
      </div>
    </div>
  )
}
