import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  );
}

export async function POST(req: NextRequest) {
  const supabase = getSupabase();
  try {
    const { device_id, tbm_notice_id, tag_code } = await req.json();

    if (!device_id || !tbm_notice_id) {
      return NextResponse.json({ error: 'device_id and tbm_notice_id required' }, { status: 400 });
    }

    // Find worker
    const { data: worker } = await supabase
      .from('nfc_workers')
      .select('id')
      .eq('device_id', device_id)
      .single();

    if (!worker) {
      return NextResponse.json({ error: 'Worker not found' }, { status: 404 });
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

    // Check if already confirmed (upsert-like behavior)
    const { data: existing } = await supabase
      .from('nfc_tbm_ack')
      .select('id')
      .eq('nfc_worker_id', worker.id)
      .eq('tbm_notice_id', tbm_notice_id)
      .single();

    if (existing) {
      return NextResponse.json({ success: true, already_confirmed: true });
    }

    // Record TBM acknowledgement
    const { error } = await supabase
      .from('nfc_tbm_ack')
      .insert({
        nfc_worker_id: worker.id,
        tbm_notice_id,
        tag_id,
      });

    if (error) {
      console.error('TBM confirm error:', error);
      return NextResponse.json({ error: 'Confirmation failed' }, { status: 500 });
    }

    return NextResponse.json({ success: true, already_confirmed: false });
  } catch (error) {
    console.error('TBM confirm error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
