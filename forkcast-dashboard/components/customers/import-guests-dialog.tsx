'use client'

import { useState, useRef } from 'react'
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Upload, FileText, CheckCircle, AlertTriangle, Download } from 'lucide-react'
import { toast } from 'sonner'
import { importCustomersFromCSV, type ImportResult } from '@/app/(dashboard)/customers/actions'

interface ImportGuestsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  restaurantId: string
  onSuccess: () => void
}

// CSV Template content
const CSV_TEMPLATE = `name,email,phone,notes,vip
"John Doe",john.doe@example.com,+1234567890,"Regular customer, prefers window seats",false
"Jane Smith",jane.smith@example.com,+0987654321,"Allergic to nuts",true
"Bob Wilson",bob@example.com,,"First time visitor",false`

export function ImportGuestsDialog({
  open,
  onOpenChange,
  restaurantId,
  onSuccess
}: ImportGuestsDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
      setResult(null)
    }
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'customer-import-template.csv'
    a.click()
    URL.revokeObjectURL(url)
    toast.success('Template downloaded!')
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)

    try {
      // Read file content
      const csvContent = await file.text()
      
      // Call server action directly
      const data = await importCustomersFromCSV(restaurantId, csvContent)

      if (!data.success && data.total === 0) {
        throw new Error(data.message || 'Failed to import customers')
      }

      setResult(data)
      
      const successCount = data.inserted + data.updated
      if (successCount > 0) {
        toast.success(data.message || `Imported ${successCount} customers`)
        onSuccess()
      } else if (data.failed > 0) {
        toast.error(`Failed to import ${data.failed} customers`)
      }
    } catch (error: any) {
      console.error('Import error:', error)
      toast.error(error.message || 'Failed to import customers')
    } finally {
      setUploading(false)
    }
  }

  const handleClose = () => {
    setFile(null)
    setResult(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Guests via CSV
          </DialogTitle>
          <DialogDescription>
            Upload a CSV file to bulk import guests. The CSV should have headers: name, email, phone, notes, vip.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {!result ? (
            <div className="space-y-4">
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:bg-gray-50 transition-colors cursor-pointer"
                   onClick={() => fileInputRef.current?.click()}>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept=".csv"
                  onChange={handleFileChange}
                />
                <div className="flex flex-col items-center gap-2">
                  <div className="p-3 bg-primary/10 rounded-full">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="text-sm font-medium">
                    {file ? file.name : 'Click to select CSV file'}
                  </div>
                  <div className="text-xs text-muted-foreground text-sm">{file ? `${(file.size / 1024).toFixed(2)} KB` : 'CSV files only'}
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-md text-xs space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">CSV Format Guide:</p>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleDownloadTemplate}
                    className="h-7 text-xs"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download Template
                  </Button>
                </div>
                <div className="space-y-1">
                  <p><strong>Required columns:</strong> name</p>
                  <p><strong>Optional columns:</strong> email, phone, notes, vip</p>
                </div>
                <div className="border-t pt-2 mt-2">
                  <p className="text-muted-foreground"><strong>Tips:</strong></p>
                  <ul className="list-disc list-inside text-muted-foreground space-y-1 mt-1">
                    <li>Fields with commas should be quoted: &quot;Smith, John&quot;</li>
                    <li>VIP column accepts: true, yes, 1 (case insensitive)</li>
                    <li>Duplicate emails will update existing customers</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-4 space-y-4">
              <div className={`p-3 rounded-full ${result.failed > 0 ? 'bg-amber-100' : 'bg-green-100'}`}>
                {result.failed > 0 ? (
                  <AlertTriangle className="h-6 w-6 text-amber-600" />
                ) : (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                )}
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-medium">Import Complete</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  {result.inserted > 0 && (
                    <p className="text-green-600">
                      ✓ {result.inserted} new guests added
                    </p>
                  )}
                  {result.updated > 0 && (
                    <p className="text-blue-600">
                      ↻ {result.updated} existing guests updated
                    </p>
                  )}
                  {result.failed > 0 && (
                    <p className="text-red-600">
                      ✗ {result.failed} failed to import
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {result ? 'Close' : 'Cancel'}
          </Button>
          {!result && (
            <Button onClick={handleUpload} disabled={!file || uploading}>
              {uploading ? 'Importing...' : 'Import Guests'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
