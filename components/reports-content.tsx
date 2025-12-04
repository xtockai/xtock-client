'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useOrganizationList } from '@clerk/nextjs'

interface Location {
  id: string
  name: string
}

interface Report {
  id: string
  item_name: string
  forecast_quantity: number
  actual_quantity: number
  date: string
  location_id: string
}

type ViewMode = 'daily' | 'weekly'

export default function ReportsContent() {
  const [locations, setLocations] = useState<Location[]>([])
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [viewMode, setViewMode] = useState<ViewMode>('daily')
  const [selectedLocation, setSelectedLocation] = useState<string>('all')
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )

  const { userMemberships } = useOrganizationList({ userMemberships: { infinite: true } })
  const orgId = userMemberships?.data?.[0]?.organization?.id

  useEffect(() => {
    loadLocations()
  }, [orgId])

  useEffect(() => {
    loadReports()
  }, [selectedLocation, selectedDate, viewMode, orgId])

  const loadLocations = async () => {
    if (!orgId) return

    try {
      const { data: locs, error } = await supabase
        .from('locations')
        .select('id, name')
        .eq('organization_id', orgId)
        .order('name')

      if (error) {
        console.error('Error loading locations:', error)
        return
      }

      setLocations(locs || [])
    } catch (err) {
      console.error('Error:', err)
    }
  }

  const loadReports = async () => {
    if (!orgId) return

    setLoading(true)
    try {
      let query = supabase
        .from('reports')
        .select('*')
        .eq('organization_id', orgId)

      // Filter by location if selected
      if (selectedLocation !== 'all') {
        query = query.eq('location_id', selectedLocation)
      }

      // Filter by date range based on view mode
      if (viewMode === 'daily') {
        query = query.eq('date', selectedDate)
      } else {
        // Weekly view - get 7 days from selected date
        const startDate = new Date(selectedDate)
        const endDate = new Date(selectedDate)
        endDate.setDate(endDate.getDate() + 6)

        query = query
          .gte('date', startDate.toISOString().split('T')[0])
          .lte('date', endDate.toISOString().split('T')[0])
      }

      const { data, error } = await query.order('date', { ascending: false })

      if (error) {
        console.error('Error loading reports:', error)
        return
      }

      setReports(data || [])
    } finally {
      setLoading(false)
    }
  }

  // Aggregate data for weekly view
  const getAggregatedData = () => {
    if (viewMode === 'daily') {
      return reports
    }

    // Group by item_name and sum quantities
    const grouped = reports.reduce((acc, report) => {
      if (!acc[report.item_name]) {
        acc[report.item_name] = {
          id: report.id,
          item_name: report.item_name,
          forecast_quantity: 0,
          actual_quantity: 0,
          date: report.date,
          location_id: report.location_id
        }
      }
      acc[report.item_name].forecast_quantity += report.forecast_quantity
      acc[report.item_name].actual_quantity += report.actual_quantity
      return acc
    }, {} as Record<string, Report>)

    return Object.values(grouped)
  }

  const aggregatedData = getAggregatedData()

  // Calculate accuracy percentage
  const calculateAccuracy = (forecast: number, actual: number) => {
    if (forecast === 0) return 0
    const accuracy = (1 - Math.abs(forecast - actual) / forecast) * 100
    return Math.max(0, Math.min(100, accuracy))
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports</h1>
        <p className="text-sm text-gray-500 mt-1">Track forecast vs actual quantities</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border-2 border-gray-200 p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* View Mode Toggle */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              View Mode
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setViewMode('daily')}
                className={`px-4 py-2 rounded-lg font-medium transition-all border-2 text-sm ${
                  viewMode === 'daily'
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                📅 Daily
              </button>
              <button
                onClick={() => setViewMode('weekly')}
                className={`px-4 py-2 rounded-lg font-medium transition-all border-2 text-sm ${
                  viewMode === 'weekly'
                    ? 'bg-blue-50 border-blue-500 text-blue-600'
                    : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                📊 Weekly
              </button>
            </div>
          </div>

          {/* Location Filter */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              Location
            </label>
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors text-sm"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-2">
              {viewMode === 'daily' ? 'Date' : 'Week Starting'}
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:ring-0 transition-colors text-sm"
            />
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-xl border-2 border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Item
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Forecast
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Actual
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Variance
                </th>
                <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">
                  Accuracy
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  </td>
                </tr>
              ) : aggregatedData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <div className="text-4xl mb-3">📊</div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">No reports yet</h3>
                    <p className="text-gray-500">
                      No data available for the selected filters
                    </p>
                  </td>
                </tr>
              ) : (
                aggregatedData.map((report) => {
                  const variance = report.actual_quantity - report.forecast_quantity
                  const accuracy = calculateAccuracy(
                    report.forecast_quantity,
                    report.actual_quantity
                  )

                  return (
                    <tr key={report.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">
                          {report.item_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-gray-900 font-medium">
                          {report.forecast_quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="text-sm text-gray-900 font-medium">
                          {report.actual_quantity}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            variance > 0
                              ? 'bg-green-100 text-green-800'
                              : variance < 0
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {variance > 0 ? '+' : ''}
                          {variance}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                accuracy >= 80
                                  ? 'bg-green-500'
                                  : accuracy >= 60
                                  ? 'bg-yellow-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${accuracy}%` }}
                            ></div>
                          </div>
                          <div className="text-sm font-medium text-gray-900 w-12 text-right">
                            {accuracy.toFixed(0)}%
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {!loading && aggregatedData.length > 0 && (
          <div className="bg-gray-50 border-t border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                Showing <span className="font-semibold text-gray-900">{aggregatedData.length}</span> items
              </div>
              <div className="flex items-center gap-6">
                <div className="text-gray-600">
                  Total Forecast:{' '}
                  <span className="font-semibold text-gray-900">
                    {aggregatedData.reduce((sum, r) => sum + r.forecast_quantity, 0)}
                  </span>
                </div>
                <div className="text-gray-600">
                  Total Actual:{' '}
                  <span className="font-semibold text-gray-900">
                    {aggregatedData.reduce((sum, r) => sum + r.actual_quantity, 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
