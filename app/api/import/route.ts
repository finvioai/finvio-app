import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseRawFile, applyColumnMapping, type ColumnMapping } from '@/lib/csv-parser'
import { categorize } from '@/lib/categorization/rules'
import { z } from 'zod'

const MappingSchema = z.object({
  date: z.string().min(1),
  amount: z.string().optional(),
  description: z.string().min(1),
  type: z.string().optional(),
  category: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  positiveIs: z.enum(['income', 'expense']).optional(),
})

// POST /api/import
// multipart/form-data: file (binary), mapping (JSON string)
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: member } = await supabase
    .from('org_members')
    .select('org_id')
    .eq('user_id', user.id)
    .single()
  if (!member) return NextResponse.json({ error: 'Organization not found' }, { status: 400 })

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  const mappingRaw = formData.get('mapping') as string | null

  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  if (!mappingRaw) return NextResponse.json({ error: 'No column mapping provided' }, { status: 400 })

  let mappingData: unknown
  try { mappingData = JSON.parse(mappingRaw) } catch {
    return NextResponse.json({ error: 'Invalid mapping JSON' }, { status: 400 })
  }

  const parsedMapping = MappingSchema.safeParse(mappingData)
  if (!parsedMapping.success) {
    return NextResponse.json({ error: parsedMapping.error.flatten() }, { status: 400 })
  }
  const mapping = parsedMapping.data as ColumnMapping

  // Validate mapping has either amount or debit+credit
  if (!mapping.amount && !(mapping.debit && mapping.credit)) {
    return NextResponse.json({ error: 'Provide either amount column or both debit and credit columns' }, { status: 400 })
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer())
  const fileName = file.name
  const fileType = fileName.endsWith('.xlsx') || fileName.endsWith('.xls') ? 'xlsx' : 'csv'

  // Upload file to Supabase Storage for audit trail
  const storagePath = `${member.org_id}/${Date.now()}_${fileName}`
  const { data: storageData } = await supabase.storage
    .from('csv-imports')
    .upload(storagePath, fileBuffer, { contentType: file.type || 'text/csv', upsert: false })

  const fileUrl = storageData?.path ?? storagePath

  // Parse the file
  let rawRows: ReturnType<typeof parseRawFile>['rawRows']
  let headers: string[]
  try {
    const parsed = parseRawFile(fileBuffer, fileType)
    rawRows = parsed.rawRows
    headers = parsed.headers
  } catch (err) {
    return NextResponse.json({ error: `File parse error: ${err instanceof Error ? err.message : 'Unknown error'}` }, { status: 400 })
  }

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'File contains no data rows' }, { status: 400 })
  }

  // Apply column mapping
  const { rows: parsedRows, errors } = applyColumnMapping(rawRows, mapping)

  // Create csv_imports record
  const { data: importRecord } = await supabase
    .from('csv_imports')
    .insert({
      org_id: member.org_id,
      file_name: fileName,
      file_type: fileType,
      file_url: fileUrl,
      total_rows: rawRows.length,
      column_mapping: mapping as unknown as import('@/types/database').Json,
      status: 'processing',
      uploaded_by: user.id,
    })
    .select('id')
    .single()

  // Insert transactions (with auto-categorization for rows without a category)
  let imported = 0
  let skipped = 0
  const importId = importRecord?.id ?? 'unknown'

  for (let i = 0; i < parsedRows.length; i++) {
    const row = parsedRows[i]
    const sourceRefId = `${importId}_${row.rowIndex}`

    // Idempotency check
    const { data: existing } = await supabase
      .from('transactions')
      .select('id')
      .eq('org_id', member.org_id)
      .eq('source_ref_id', sourceRefId)
      .maybeSingle()

    if (existing) { skipped++; continue }

    let category = row.category
    let categoryConfidence: string
    let categoryMethod: string

    if (category) {
      categoryConfidence = 'high'
      categoryMethod = 'user'
    } else {
      const result = await categorize(row.description, row.type, member.org_id)
      category = result.category
      categoryConfidence = result.confidence
      categoryMethod = result.method
    }

    await supabase.from('transactions').insert({
      org_id: member.org_id,
      type: row.type,
      amount: row.amount,
      description: row.description,
      date: row.date,
      category,
      category_confidence: categoryConfidence,
      category_method: categoryMethod,
      source: 'csv',
      source_ref_id: sourceRefId,
      is_reviewed: !!row.category,
    })
    imported++
  }

  // Update import record with results
  if (importRecord) {
    await supabase.from('csv_imports').update({
      status: 'completed',
      imported_rows: imported,
      skipped_rows: skipped + errors.length,
      error_log: errors.length > 0 ? errors as unknown as import('@/types/database').Json : null,
    }).eq('id', importRecord.id)
  }

  return NextResponse.json({
    imported,
    skipped,
    errors: errors.length,
    errorDetails: errors.slice(0, 20), // return first 20 errors
    total: rawRows.length,
    headers,
  }, { status: 201 })
}

// GET /api/import — parse file headers only (for column mapping step)
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check for preview param — handled as POST with action=preview
  return NextResponse.json({ message: 'Use POST to upload a file' })
}
