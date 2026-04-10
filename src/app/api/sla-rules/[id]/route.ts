import { NextRequest, NextResponse } from 'next/server'
import { deleteSLARule } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const id = parseInt(params.id, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  await deleteSLARule(id)
  return NextResponse.json({ success: true })
}
