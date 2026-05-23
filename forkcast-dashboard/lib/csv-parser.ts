// lib/csv-parser.ts
import type { MenuItem, MenuCategory } from "@/types"

export interface CSVMenuItem {
  name: string
  category: string
  description?: string
  price?: number // Optional for priceless menus
  dietary_tags?: string
  allergens?: string
  calories?: number
  preparation_time?: number
  is_available?: boolean
  is_featured?: boolean
  display_order?: number
}

export interface CSVValidationError {
  row: number
  field: string
  message: string
  value?: string
}

export interface CSVParseResult {
  valid: CSVMenuItem[]
  errors: CSVValidationError[]
  totalRows: number
}

/**
 * Parse CSV text into structured menu items
 * @param csvText - CSV file content
 * @param allowPriceless - If true, allows empty/zero prices for priceless menus
 */
export function parseMenuItemsCSV(csvText: string, allowPriceless: boolean = false): CSVParseResult {
  const lines = csvText.trim().split('\n')
  const valid: CSVMenuItem[] = []
  const errors: CSVValidationError[] = []

  if (lines.length === 0) {
    return { valid, errors: [{ row: 0, field: 'file', message: 'CSV file is empty' }], totalRows: 0 }
  }

  // Parse header
  const header = parseCSVLine(lines[0])
  const requiredFields = allowPriceless ? ['name', 'category'] : ['name', 'category', 'price']
  const optionalFields = ['description', 'price', 'dietary_tags', 'allergens', 'calories', 'preparation_time', 'is_available', 'is_featured', 'display_order']

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
    const rowErrors: CSVValidationError[] = []

    // Extract values
    const name = getValue(values, headerMap, 'name')
    const category = getValue(values, headerMap, 'category')
    const priceStr = getValue(values, headerMap, 'price')
    const description = getValue(values, headerMap, 'description')
    const dietaryTags = getValue(values, headerMap, 'dietary_tags')
    const allergens = getValue(values, headerMap, 'allergens')
    const caloriesStr = getValue(values, headerMap, 'calories')
    const prepTimeStr = getValue(values, headerMap, 'preparation_time')
    const isAvailableStr = getValue(values, headerMap, 'is_available')
    const isFeaturedStr = getValue(values, headerMap, 'is_featured')
    const displayOrderStr = getValue(values, headerMap, 'display_order')

    // Validate required fields
    if (!name || name.trim() === '') {
      rowErrors.push({ row: i + 1, field: 'name', message: 'Name is required', value: name })
    }
    if (!category || category.trim() === '') {
      rowErrors.push({ row: i + 1, field: 'category', message: 'Category is required', value: category })
    }

    // Validate price (required only if not priceless mode)
    if (!allowPriceless && (!priceStr || priceStr.trim() === '')) {
      rowErrors.push({ row: i + 1, field: 'price', message: 'Price is required (or enable priceless menu mode)', value: priceStr })
    }

    // Validate and parse price
    let price: number | undefined = allowPriceless ? 0 : undefined
    if (priceStr && priceStr.trim() !== '') {
      const parsedPrice = parseFloat(priceStr.replace(/[^0-9.-]/g, ''))
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        rowErrors.push({ row: i + 1, field: 'price', message: 'Invalid price format', value: priceStr })
      } else {
        price = parsedPrice
      }
    } else if (allowPriceless) {
      price = 0 // Default to 0 for priceless menus
    }

    // Validate and parse optional numeric fields
    let calories: number | undefined
    if (caloriesStr && caloriesStr.trim() !== '') {
      const parsed = parseInt(caloriesStr)
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push({ row: i + 1, field: 'calories', message: 'Invalid calories format', value: caloriesStr })
      } else {
        calories = parsed
      }
    }

    let preparation_time: number | undefined
    if (prepTimeStr && prepTimeStr.trim() !== '') {
      const parsed = parseInt(prepTimeStr)
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push({ row: i + 1, field: 'preparation_time', message: 'Invalid preparation time', value: prepTimeStr })
      } else {
        preparation_time = parsed
      }
    }

    let display_order: number | undefined
    if (displayOrderStr && displayOrderStr.trim() !== '') {
      const parsed = parseInt(displayOrderStr)
      if (isNaN(parsed) || parsed < 0) {
        rowErrors.push({ row: i + 1, field: 'display_order', message: 'Invalid display order', value: displayOrderStr })
      } else {
        display_order = parsed
      }
    }

    // Parse boolean fields
    const is_available = parseBooleanField(isAvailableStr, true)
    const is_featured = parseBooleanField(isFeaturedStr, false)

    // If no errors, add to valid items
    if (rowErrors.length === 0) {
      const item: CSVMenuItem = {
        name: name.trim(),
        category: category.trim(),
        description: description?.trim() || undefined,
        dietary_tags: dietaryTags?.trim() || undefined,
        allergens: allergens?.trim() || undefined,
        calories,
        preparation_time,
        is_available,
        is_featured,
        display_order
      }

      // Add price only if defined
      if (price !== undefined) {
        item.price = price
      }

      valid.push(item)
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
 * Generate CSV template for menu items - AI FRIENDLY
 * @param priceless - If true, generates template with 0 prices
 */
export function generateMenuItemsTemplate(priceless: boolean = false): string {
  const headers = [
    'name',
    'category',
    'description',
    'price',
    'dietary_tags',
    'allergens',
    'calories',
    'preparation_time',
    'is_available',
    'is_featured',
    'display_order'
  ]

  const priceValue = priceless ? '0' : '12.99'
  const examples = priceless ? [
    [
      'Margherita Pizza',
      'Pizza',
      'Classic tomato sauce, fresh mozzarella, and basil',
      '0',
      'vegetarian',
      'dairy, gluten',
      '650',
      '15',
      'true',
      'true',
      '1'
    ],
    [
      'Caesar Salad',
      'Salads',
      'Romaine lettuce, parmesan, croutons, Caesar dressing',
      '0',
      'vegetarian',
      'dairy, gluten, eggs',
      '320',
      '5',
      'true',
      'false',
      '2'
    ],
    [
      'Grilled Salmon',
      'Main Course',
      'Fresh Atlantic salmon with seasonal vegetables',
      '0',
      'pescatarian, gluten-free',
      'fish',
      '480',
      '20',
      'true',
      'true',
      '3'
    ],
    [
      'Spaghetti Carbonara',
      'Pasta',
      'Traditional Italian pasta with eggs, cheese, and pancetta',
      '0',
      '',
      'dairy, gluten, eggs',
      '720',
      '18',
      'true',
      'false',
      '4'
    ],
    [
      'Tiramisu',
      'Desserts',
      'Classic Italian dessert with coffee and mascarpone',
      '0',
      'vegetarian',
      'dairy, gluten, eggs',
      '450',
      '5',
      'true',
      'true',
      '5'
    ]
  ] : [
    [
      'Margherita Pizza',
      'Pizza',
      'Classic tomato sauce, fresh mozzarella, and basil',
      '12.99',
      'vegetarian',
      'dairy, gluten',
      '650',
      '15',
      'true',
      'true',
      '1'
    ],
    [
      'Caesar Salad',
      'Salads',
      'Romaine lettuce, parmesan, croutons, Caesar dressing',
      '8.99',
      'vegetarian',
      'dairy, gluten, eggs',
      '320',
      '5',
      'true',
      'false',
      '2'
    ],
    [
      'Grilled Salmon',
      'Main Course',
      'Fresh Atlantic salmon with seasonal vegetables',
      '24.99',
      'pescatarian, gluten-free',
      'fish',
      '480',
      '20',
      'true',
      'true',
      '3'
    ],
    [
      'Spaghetti Carbonara',
      'Pasta',
      'Traditional Italian pasta with eggs, cheese, and pancetta',
      '16.99',
      '',
      'dairy, gluten, eggs',
      '720',
      '18',
      'true',
      'false',
      '4'
    ],
    [
      'Tiramisu',
      'Desserts',
      'Classic Italian dessert with coffee and mascarpone',
      '7.99',
      'vegetarian',
      'dairy, gluten, eggs',
      '450',
      '5',
      'true',
      'true',
      '5'
    ]
  ]

  const rows = [headers, ...examples]
  return rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
}

/**
 * Convert CSV menu items to database format
 */
export async function convertCSVToMenuItems(
  csvItems: CSVMenuItem[],
  categories: MenuCategory[],
  restaurantId: string
): Promise<{ items: Partial<MenuItem>[]; unmatchedCategories: string[] }> {
  const items: Partial<MenuItem>[] = []
  const unmatchedCategories = new Set<string>()
  const categoryMap = new Map(categories.map(cat => [cat.name.toLowerCase(), cat.id]))

  for (const csvItem of csvItems) {
    const categoryId = categoryMap.get(csvItem.category.toLowerCase())

    if (!categoryId) {
      unmatchedCategories.add(csvItem.category)
      continue
    }

    items.push({
      restaurant_id: restaurantId,
      category_id: categoryId,
      name: csvItem.name,
      description: csvItem.description || null,
      price: csvItem.price ?? 0, // Default to 0 for priceless menus
      dietary_tags: csvItem.dietary_tags ? csvItem.dietary_tags.split(',').map(t => t.trim()) : null,
      allergens: csvItem.allergens ? csvItem.allergens.split(',').map(a => a.trim()) : null,
      calories: csvItem.calories || null,
      preparation_time: csvItem.preparation_time || null,
      is_available: csvItem.is_available ?? true,
      is_featured: csvItem.is_featured ?? false,
      display_order: csvItem.display_order ?? 0,
      image_url: null
      // Let database auto-generate: id, created_at, updated_at
    })
  }

  return {
    items,
    unmatchedCategories: Array.from(unmatchedCategories)
  }
}

/**
 * Download CSV template file
 */
export function downloadCSVTemplate(priceless: boolean = false) {
  const csv = generateMenuItemsTemplate(priceless)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)

  const fileName = priceless ? 'menu-items-template-priceless.csv' : 'menu-items-template.csv'
  link.setAttribute('href', url)
  link.setAttribute('download', fileName)
  link.style.visibility = 'hidden'

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
