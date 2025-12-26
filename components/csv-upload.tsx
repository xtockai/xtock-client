'use client'
import { useState, useRef } from 'react'
import Papa from 'papaparse'

interface CSVUploadProps {
  locationId: string
  locationName: string
  onUpload: (data: any[], locationId: string) => void
  onError: (error: string) => void
  isUploaded: boolean
}

interface CSVData {
  [key: string]: string
}

export default function CSVUpload({ locationId, locationName, onUpload, onError, isUploaded }: CSVUploadProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
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

  const normalizeData = (data: CSVData[]): any[] => {
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

          const data = results.data as CSVData[]
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

          onUpload(normalizedData, locationId)
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

  const handleRemove = () => {
    setFileName(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />
      
      {!isUploaded ? (
        <div 
          onClick={handleUploadClick}
          className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 transition-all group"
        >
          <div className="space-y-2">
            <svg className="w-12 h-12 mx-auto text-gray-400 group-hover:text-blue-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-600 group-hover:text-blue-600">
                {isProcessing ? 'Processing...' : 'Upload CSV for ' + locationName}
              </p>
              <p className="text-xs text-gray-500">
                Must include: date, quantity, and product/name columns
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-green-800">
                  CSV uploaded successfully
                </p>
                {fileName && (
                  <p className="text-xs text-green-600">
                    {fileName}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-green-600 hover:text-green-700 text-sm underline"
            >
              Change file
            </button>
          </div>
        </div>
      )}

      {isProcessing && (
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <svg className="animate-spin w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span className="text-sm font-medium">Processing CSV...</span>
        </div>
      )}
    </div>
  )
}