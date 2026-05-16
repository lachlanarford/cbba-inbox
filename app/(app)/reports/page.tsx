'use client'

import { useState } from 'react'
import DateRangeFilter, { PRESETS, type DateRange } from '@/components/reporting/DateRangeFilter'
import ResponseTimeCard from '@/components/reporting/ResponseTimeCard'
import StaffVsAiCard from '@/components/reporting/StaffVsAiCard'
import CategoryDistributionCard from '@/components/reporting/CategoryDistributionCard'
import FeedbackScoresCard from '@/components/reporting/FeedbackScoresCard'
import VolumeByChannelCard from '@/components/reporting/VolumeByChannelCard'
import ResolutionRateCard from '@/components/reporting/ResolutionRateCard'

export default function ReportsPage() {
  const [range, setRange] = useState<DateRange>(PRESETS[1])

  return (
    <div className="p-6 h-full overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-semibold text-white">Reports</h1>
            <p className="text-xs text-gray-500 mt-0.5">Conversation and performance analytics</p>
          </div>
          <DateRangeFilter value={range} onChange={setRange} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <VolumeByChannelCard range={range} />
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <ResponseTimeCard range={range} />
          <ResolutionRateCard range={range} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <StaffVsAiCard range={range} />
          <CategoryDistributionCard range={range} />
          <FeedbackScoresCard range={range} />
        </div>
      </div>
    </div>
  )
}
