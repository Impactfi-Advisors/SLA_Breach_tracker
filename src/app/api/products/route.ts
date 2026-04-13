import { NextRequest, NextResponse } from 'next/server'
import { getProducts, getProductsByVendor, insertProduct } from '@/lib/db'

export const dynamic = 'force-dynamic'

const VALID_CATEGORIES = ['core', 'mobile', 'web', 'api', 'other'] as const

export async function GET(req: NextRequest) {
  const vendor = req.nextUrl.searchParams.get('vendor')
  const products = vendor ? await getProductsByVendor(vendor) : await getProducts()
  return NextResponse.json(products)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { vendor, name, category } = body as Record<string, unknown>

  if (!vendor || typeof vendor !== 'string') return NextResponse.json({ error: 'vendor required' }, { status: 400 })
  if (!name || typeof name !== 'string') return NextResponse.json({ error: 'name required' }, { status: 400 })
  const cat = (category as string) ?? 'core'
  if (!VALID_CATEGORIES.includes(cat as typeof VALID_CATEGORIES[number])) {
    return NextResponse.json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` }, { status: 400 })
  }

  try {
    const id = await insertProduct(vendor.trim(), name.trim(), cat)
    return NextResponse.json({ id, vendor, name, category: cat }, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('UNIQUE')) {
      return NextResponse.json({ error: `Product "${name}" already exists for ${vendor}` }, { status: 409 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
