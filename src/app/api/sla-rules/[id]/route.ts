import { NextRequest, NextResponse } from 'next/server'
import { deleteSLARule } from '@/lib/db'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr, 10)
  if (isNaN(id)) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  }
  await deleteSLARule(id)
  return NextResponse.json({ success: true })
}
