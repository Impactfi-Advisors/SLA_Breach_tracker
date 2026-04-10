import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
import { getOutages } from '@/lib/db'

export async function GET() {
  const outages = await getOutages()
  return NextResponse.json(outages)
}
