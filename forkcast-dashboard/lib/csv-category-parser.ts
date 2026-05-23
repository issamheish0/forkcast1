// lib/csv-category-parser.ts
import type { MenuCategory } from "@/types"

export interface CSVCategory {
  name: string
  description?: string
  display_order?: number
  is_active?: boolean
}

export interface CSVCategoryValidationError {
  row: number
  field: string
  message: string
  value?: string
}

export interface CSVCategoryParseResult {
  valid: CSVCategory[]
  errors: CSVCategoryValidationError[]
  totalRows: number
}

/**
 * Parse CSV text into structured menu categories
 */
export function parseCategoriesCSV(csvText: string): CSVCategoryParseResult {
  const lines = csvText.trim().split('\n')
  const valid: CSVCategory[] = []
  const errors: CSVCategoryValidationError[] = []

  if (lines.length === 0) {
    return { valid, errors: [{ row: 0, field: 'file', message: 'CSV file is empty' }], totalRows: 0 }
  }

  // Parse header
  const header = parseCSVLine(lines[0])
  const requiredFields = ['name']

  // Validate header
  const missingFields = requiredFields.filter(field =>
    !header.some(h => h.toLowerCase() === field.toLowerCase())
  )

  if (missingFields.length > 0) {
    return {
      valid,
      errors: [{
        row: 0,
        field: 'header',
        message: `Missing required columns: ${missingFields.join(', ')}`
      }],
      totalRows: 0
    }
  }

  // Create header mapping
  const headerMap = new Map<string, number>()
  header.forEach((col, index) => {
    headerMap.set(col.toLowerCase().trim(), index)
  })

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue // Skip empty lines

    const values = parseCSVLine(line)
    const rowErrors: CSVCategoryValidationError[] = []

    // Extract values
    const name = getValue(values, headerMap, 'name')
    const description = getValue(values, headerMap, 'description')
    const displayOrderStr = getValue(values, headerMap, 'display_order')
    const isActiveStr = getValue(values, headerMap, 'is_active')

    // Validate required fields
    if (!name || name.trim() === '') {
      rowErrors.push({ row: i + 1, field: 'name', message: 'Category name is required', value: name })
    }

    // Validate display order
    let display_order: number | undefined
    if (displayOrderStr && displayOrderStr.trim() !== '') {
      const parsed = parseInt(displayOrderStr)
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push({ row: i + 1, field: 'display_order', message: 'Invalid display order', value: displayOrderStr })
      } else {
        display_order = parsed
      }
    }

    // Parse boolean field
    const is_active = parseBooleanField(isActiveStr, true)

    // If no errors, add to valid categories
    if (rowErrors.length === 0) {
      valid.push({
        name: name.trim(),
        description: description?.trim() || undefined,
        display_order,
        is_active
      })
    } else {
      errors.push(...rowErrors)
    }
  }

  return {
    valid,
    errors,
    totalRows: lines.length - 1 // Exclude header
  }
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    const nextChar = line[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"'
        i++ // Skip next quote
      } else {
        // Toggle quotes
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      // End of field
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  // Add last field
  result.push(current.trim())

  return result
}

/**
 * Get value from CSV row by header name
 */
function getValue(values: string[], headerMap: Map<string, number>, fieldName: string): string {
  const index = headerMap.get(fieldName.toLowerCase())
  if (index === undefined) return ''
  return values[index] || ''
}

/**
 * Parse boolean field from string
 */
function parseBooleanField(value: string | undefined, defaultValue: boolean): boolean {
  if (!value || value.trim() === '') return defaultValue
  const lower = value.toLowerCase().trim()
  return lower === 'true' || lower === '1' || lower === 'yes' || lower === 'y'
}

/**
 * Generate CSV template for categories - AI FRIENDLY
 */
export function generateCategoriesTemplate(): string {
  const headers = ['name', 'description', 'display_order', 'is_active']

  const examples = [
    [
      'Appetizers',
      'Start your meal with our delicious appetizers',
      '1',
      'true'
    ],
    [
      'Salads',
      'Fresh and healthy salad options',
      '2',
      'true'
    ],
    [
      'Pizza',
      'Hand-tossed pizzas with fresh ingredients',
      '3',
      'true'
    ],
    [
      'Pasta',
      'Traditional Italian pasta dishes',
      '4',
      'true'
    ],
    [
      'Main Course',
      'Hearty main dishes and entrees',
      '5',
      'true'
    ],
    [
      'Seafood',
      'Fresh seafood selections',
      '6',
      'true'
    ],
    [
      'Desserts',
      'Sweet treats to end your meal',
      '7',
      'true'
    ],
    [
      'Beverages',
      'Drinks, coffee, and refreshments',
      '8',
      'true'
    ]
  ]

  const rows = [headers, ...examples]
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}

/**
 * Convert CSV categories to database format
 */
export function convertCSVToCategories(
  csvCategories: CSVCategory[],
  restaurantId: string
): Partial<MenuCategory>[] {
  return csvCategories.map((csvCat, index) => ({
    restaurant_id: restaurantId,
    name: csvCat.name,
    description: csvCat.description || null,
    display_order: csvCat.display_order ?? index,
    is_active: csvCat.is_active ?? true
    // Let database auto-generate: id, created_at, updated_at
  }))
}

/**
 * Download CSV template file for categories
 */
export function downloadCategoriesTemplate() {
  const csv = generateCategoriesTemplate()
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  link.setAttribute('href', url)
  link.setAttribute('download', 'menu-categories-template.csv')
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
