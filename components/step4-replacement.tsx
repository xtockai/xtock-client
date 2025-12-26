        <div className="animate-fadeIn">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">POS Provider</h2>
            <p className="text-gray-600">Choose how you want to connect your sales data</p>
          </div>

          {/* Provider Selection */}
          <div className="space-y-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Toast Option */}
              <div
                className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                  data.posProvider === 'toast'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                onClick={() => setData(prev => ({ ...prev, posProvider: 'toast' }))}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    data.posProvider === 'toast'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {data.posProvider === 'toast' && (
                      <div className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">I have Toast</h3>
                    <p className="text-sm text-gray-600">Connect directly to your Toast POS system</p>
                  </div>
                </div>
              </div>

              {/* Manual Option */}
              <div
                className={`cursor-pointer rounded-xl border-2 p-6 transition-all hover:shadow-lg ${
                  data.posProvider === 'manual'
                    ? 'border-blue-500 bg-blue-50 shadow-md'
                    : 'border-gray-300 bg-white hover:border-gray-400'
                }`}
                onClick={() => setData(prev => ({ ...prev, posProvider: 'manual' }))}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    data.posProvider === 'manual'
                      ? 'border-blue-500 bg-blue-500'
                      : 'border-gray-300'
                  }`}>
                    {data.posProvider === 'manual' && (
                      <div className="w-3 h-3 bg-white rounded-full" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">I don't have Toast</h3>
                    <p className="text-sm text-gray-600">Upload your sales data manually via CSV</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Toast Configuration */}
          {data.posProvider === 'toast' && (
            <div className="space-y-6">
              <div className="group">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Toast API Key <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="Enter your Toast API key"
                    value={data.apiKey}
                    onChange={(e) => setData(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="w-full px-4 py-3.5 pr-12 border-2 border-gray-200 rounded-xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none group-hover:border-gray-300 bg-gray-50 focus:bg-white font-mono text-sm"
                  />
                  <div className="absolute inset-y-0 right-3 flex items-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-blue-900 font-medium">Need an API key?</p>
                  <button
                    onClick={() => window.open('https://toasttab.com', '_blank')}
                    className="text-sm text-blue-600 hover:text-blue-700 underline font-medium mt-1"
                  >
                    Get your Toast API key here →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Manual Configuration */}
          {data.posProvider === 'manual' && (
            <div className="space-y-6">
              {/* Warning Message */}
              <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-200 rounded-xl">
                <div className="flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-amber-900 font-medium">Important Notice</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Without sales data, we won't be able to generate accurate predictions. You can upload CSV files now or add them later from your dashboard.
                  </p>
                </div>
              </div>

              {/* CSV Upload per Location */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Upload Sales Data (Optional)</h3>
                <p className="text-sm text-gray-600">
                  Upload historical sales data for each location. CSV files must include columns for: date, quantity, and product/item name.
                </p>
                
                {data.locations.map((location, locationIndex) => {
                  const isExpanded = expandedLocations.has(locationIndex)
                  const hasUpload = csvUploadStates[location.name]
                  const hasError = csvErrors[location.name]
                  
                  return (
                    <div key={locationIndex} className="border-2 border-gray-200 rounded-xl overflow-hidden">
                      {/* Accordion Header */}
                      <div 
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-blue-50/30 hover:from-gray-100 hover:to-blue-100/50 cursor-pointer transition-all"
                        onClick={() => toggleLocationAccordion(locationIndex)}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            <svg className="w-full h-full text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <h4 className="text-lg font-semibold text-gray-800">{location.name}</h4>
                          
                          {/* Status indicators */}
                          {hasUpload && (
                            <div className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                              ✓ Uploaded
                            </div>
                          )}
                          {hasError && (
                            <div className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                              ⚠ Error
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div className="p-6 bg-white border-t border-gray-200">
                          <CSVUpload
                            locationId={location.name}
                            locationName={location.name}
                            onUpload={handleCsvUpload}
                            onError={(error) => handleCsvError(error, location.name)}
                            isUploaded={!!hasUpload}
                          />
                          
                          {hasError && (
                            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                              <div className="flex items-center gap-2 text-red-800">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className="text-sm font-medium">{hasError}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>