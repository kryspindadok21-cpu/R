import { NextResponse, type NextRequest } from 'next/server';
import { csvFilename, leadsToCsv } from '@/lib/export/csv';
import { getMessages, listLeads } from '@/lib/db/queries';
import { parseFilters } from '@/lib/filters';
import { DEFAULT_TONE, TONES, type GeneratedMessage, type Tone } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const filters = parseFilters(params);

  const toneParam = params.get('tone');
  const tone: Tone = TONES.includes(toneParam as Tone) ? (toneParam as Tone) : DEFAULT_TONE;

  const leads = await listLeads(filters);

  const messagesByLead = new Map<number, GeneratedMessage[]>();
  for (const lead of leads) {
    messagesByLead.set(lead.id, await getMessages(lead.id));
  }

  const csv = leadsToCsv(leads, messagesByLead, { tone });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${csvFilename()}"`,
      'Cache-Control': 'no-store',
    },
  });
}
