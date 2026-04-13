import { NextRequest, NextResponse } from 'next/server'
import { getProducts, deleteProduct } from '@/lib/db'

export const dynamic = 'force-dynamic'

function parseId(raw: string) {
  const id = parseInt(raw, 10)
  return isNaN(id) || id <= 0 ? null : id
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const all = await getProducts()
  const product = all.find(p => p.id === id)
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(product)
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = parseId(params.id)
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  await deleteProduct(id)
  return NextResponse.json({ success: true })
}
