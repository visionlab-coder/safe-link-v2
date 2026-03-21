import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export async function POST(req: NextRequest) {
  try {
    const { device_id, tag_code } = await req.json();

    if (!device_id) {
      return NextResponse.json({ error: 'device_id required' }, { status: 400 });
    }

    // Find worker
    const { data: worker } = await supabase
      .from('nfc_workers')
      .select('id')
      .eq('device_id', device_id)
      .single();

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found. Register first.' }, { status: 404 });
    }

    // Find tag
    let tag_id: string | null = null;
    if (tag_code) {
      const { data: tag } = await supabase
        .from('nfc_tags')
        .select('id')
        .eq('tag_code', tag_code)
        .eq('is_active', true)
        .single();
      tag_id = tag?.id || null;
    }

    // Record attendance
    const userAgent = req.headers.get('user-agent') || '';
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '';

    const { error } = await supabase
      .from('nfc_attendance')
      .insert({
        nfc_worker_id: worker.id,
        tag_id,
        check_type: 'check_in',
        user_agent: userAgent,
        ip_address: ip,
      });

    if (error) {
      console.error('Check-in error:', error);
      return NextResponse.json({ error: 'Check-in failed' }, { status: 500 });
    }

    // Update last_seen
    await supabase
      .from('nfc_workers')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', worker.id);

    return NextResponse.json({ success: true, worker_id: worker.id });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
