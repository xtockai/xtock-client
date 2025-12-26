'use client'
import { useState, useRef } from 'react'
import Papa from 'papaparse'

interface CSVUploadProps {
  locationName: string
  onUpload: (data: CSVData[]) => void
  onError: (error: string) => void
  onClose: () => void
  uploading: boolean
}

interface CSVData {
  date: string
  item: string
  quantity: number
}

interface CSVRowData {
  [key: string]: string
}

export default function LocationCSVUpload({ locationName, onUpload, onError, onClose, uploading }: CSVUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<CSVData[] | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const requiredColumns = ['date', 'quantity']
  const optionalNameColumns = ['product', 'name', 'item']

  const validateColumns = (headers: string[]): { isValid: boolean; error?: string } => {
    const normalizedHeaders = headers.map(h => h.toLowerCase().trim())
    
    // Check for date column
    if (!normalizedHeaders.some(h => h.includes('date') || h === 'timestamp' || h === 'day' || h === 'fecha')) {
      return { 
        isValid: false, 
        error: 'Missing required column: "date" (or similar like timestamp, day, fecha)' 
      }
    }

    // Check for quantity column
    if (!normalizedHeaders.some(h => h.includes('quantity') || h === 'qty' || h === 'amount' || h === 'cantidad')) {
      return { 
        isValid: false, 
        error: 'Missing required column: "quantity" (or similar like qty, amount, cantidad)' 
      }
    }

    // Check for product/name column
    const hasProductColumn = normalizedHeaders.some(h => 
      optionalNameColumns.some(col => h.includes(col)) || 
      h.includes('producto') || 
      h.includes('articulo')
    )
    
    if (!hasProductColumn) {
      return { 
        isValid: false, 
        error: 'Missing required column: "product", "name", or "item" (or similar like producto, articulo)' 
      }
    }

    return { isValid: true }
  }

  const normalizeData = (data: CSVRowData[]): CSVData[] => {
    return data.map(row => {
      const normalizedRow: any = {}
      const keys = Object.keys(row)

      // Find date column
      const dateKey = keys.find(k => {
        const lower = k.toLowerCase()
        return lower.includes('date') || lower === 'timestamp' || lower === 'day' || lower === 'fecha'
      })

      // Find quantity column
      const quantityKey = keys.find(k => {
        const lower = k.toLowerCase()
        return lower.includes('quantity') || lower === 'qty' || lower === 'amount' || lower === 'cantidad'
      })

      // Find product/name column
      const productKey = keys.find(k => {
        const lower = k.toLowerCase()
        return optionalNameColumns.some(col => lower.includes(col)) || 
               lower.includes('producto') || 
               lower.includes('articulo')
      })

      if (dateKey) normalizedRow.date = row[dateKey]
      if (quantityKey) normalizedRow.quantity = parseInt(row[quantityKey]) || 0
      if (productKey) normalizedRow.item = row[productKey]

      return normalizedRow
    }).filter(row => row.date && row.quantity && row.item) // Filter out invalid rows
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.csv')) {
      onError('Please upload a CSV file')
      return
    }

    setFileName(file.name)
    setIsProcessing(true)

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          if (results.errors.length > 0) {
            onError(`CSV parsing error: ${results.errors[0].message}`)
            setIsProcessing(false)
            return
          }

          const data = results.data as CSVRowData[]
          if (data.length === 0) {
            onError('CSV file is empty')
            setIsProcessing(false)
            return
          }

          // Validate columns
          const headers = Object.keys(data[0])
          const validation = validateColumns(headers)
          
          if (!validation.isValid) {
            onError(validation.error || 'Invalid CSV format')
            setIsProcessing(false)
            return
          }

          // Normalize and transform data
          const normalizedData = normalizeData(data)
          if (normalizedData.length === 0) {
            onError('No valid data rows found in CSV')
            setIsProcessing(false)
            return
          }

          setPreviewData(normalizedData.slice(0, 5)) // Show first 5 rows as preview
          setIsProcessing(false)
        } catch (error) {
          onError('Error processing CSV file')
          setIsProcessing(false)
        }
      },
      error: (error) => {
        onError(`Failed to read CSV: ${error.message}`)
        setIsProcessing(false)
      }
    })
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  const handleConfirmUpload = () => {
    if (previewData) {
      // Get all normalized data, not just preview
      const fileInput = fileInputRef.current
      if (fileInput?.files?.[0]) {
        Papa.parse(fileInput.files[0], {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const data = results.data as CSVRowData[]
            const normalizedData = normalizeData(data)
            onUpload(normalizedData)
          }
        })
      }
    }
  }

  const handleRemove = () => {
    setFileName(null)
    setPreviewData(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Upload Sales Data for {locationName}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100"
              disabled={uploading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-6 space-y-6">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
            disabled={uploading}
          />
          
          {/* Info Box */}
          <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-semibold text-blue-900 mb-1">Important Notes:</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• Only new data will be added - no duplicates will be created</li>
                  <li>• Required columns: date, quantity, product/item name</li>
                  <li>• Existing data with the same date and item will be skipped</li>
                  <li>• CSV must be properly formatted with headers</li>
                </ul>
              </div>
            </div>
          </div>

          {!previewData ? (
            <div 
              onClick={handleUploadClick}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                isProcessing 
                  ? 'border-gray-300 bg-gray-50 cursor-not-allowed' 
                  : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 hover:shadow-lg'
              } group`}
            >
              <div className="space-y-3">
                <svg className={`w-16 h-16 mx-auto transition-colors ${
                  isProcessing ? 'text-gray-400' : 'text-gray-400 group-hover:text-blue-500'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                <div>
                  <p className={`font-medium ${isProcessing ? 'text-gray-500' : 'text-gray-600 group-hover:text-blue-600'}`}>
                    {isProcessing ? 'Processing...' : 'Click to upload CSV file'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Must include: date, quantity, and product/name columns
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="font-medium text-green-800">{fileName}</p>
                      <p className="text-sm text-green-600">Ready to upload</p>
                    </div>
                  </div>
                  <button
                    onClick={handleRemove}
                    className="text-green-600 hover:text-green-800 transition-colors"
                    disabled={uploading}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border-2 border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <h4 className="font-medium text-gray-900">Preview (first 5 rows)</h4>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Date</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Item</th>
                        <th className="px-4 py-2 text-left font-medium text-gray-700">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.map((row, index) => (
                        <tr key={index} className="border-b border-gray-200">
                          <td className="px-4 py-2 text-gray-900">{row.date}</td>
                          <td className="px-4 py-2 text-gray-900">{row.item}</td>
                          <td className="px-4 py-2 text-gray-900">{row.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="sticky bottom-0 bg-gray-50 px-6 py-4 rounded-b-2xl border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 hover:border-gray-400 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmUpload}
            disabled={!previewData || uploading}
            className="flex-1 px-8 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-indigo-700 hover:shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:hover:scale-100"
          >
            {uploading ? 'Uploading...' : 'Upload Data'}
          </button>
        </div>
      </div>
    </div>
  )
}