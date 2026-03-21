import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function GET(req: NextRequest) {
  try {
    const device_id = req.nextUrl.searchParams.get('device_id');

    if (!device_id) {
      return NextResponse.json({ error: 'device_id required' }, { status: 400 });
    }

    // Get today's date range (KST)
    const now = new Date();
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstNow = new Date(now.getTime() + kstOffset);
    const todayStart = new Date(kstNow.getFullYear(), kstNow.getMonth(), kstNow.getDate());
    todayStart.setTime(todayStart.getTime() - kstOffset); // Convert back to UTC

    // Fetch today's TBM notices
    const { data: notices, error } = await supabase
      .from('tbm_notices')
      .select('id, title, content, created_at')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Fetch TBM error:', error);
      return NextResponse.json({ error: 'Failed to fetch TBM' }, { status: 500 });
    }

    // Check which ones this worker already confirmed
    const { data: worker } = await supabase
      .from('nfc_workers')
      .select('id')
      .eq('device_id', device_id)
      .single();

    let confirmedIds: string[] = [];
    if (worker && notices && notices.length > 0) {
      const { data: acks } = await supabase
        .from('nfc_tbm_ack')
        .select('tbm_notice_id')
        .eq('nfc_worker_id', worker.id)
        .in('tbm_notice_id', notices.map(n => n.id));

      confirmedIds = (acks || []).map(a => a.tbm_notice_id);
    }

    const result = (notices || []).map(n => ({
      ...n,
      confirmed: confirmedIds.includes(n.id),
    }));

    return NextResponse.json({ notices: result });
  } catch (error) {
    console.error('Today TBM error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
