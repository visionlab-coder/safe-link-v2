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
    const { device_id, preferred_lang, tag_code } = await req.json();

    if (!device_id || !preferred_lang) {
      return NextResponse.json({ error: 'device_id and preferred_lang required' }, { status: 400 });
    }

    // Check if worker already exists
    const { data: existing } = await supabase
      .from('nfc_workers')
      .select('id, preferred_lang')
      .eq('device_id', device_id)
      .single();

    if (existing) {
      // Update last seen and lang if changed
      await supabase
        .from('nfc_workers')
        .update({ last_seen_at: new Date().toISOString(), preferred_lang })
        .eq('id', existing.id);

      return NextResponse.json({ worker_id: existing.id, is_new: false });
    }

    // Get site_id from tag if provided
    let site_id: string | null = null;
    if (tag_code) {
      const { data: tag } = await supabase
        .from('nfc_tags')
        .select('site_id')
        .eq('tag_code', tag_code)
        .eq('is_active', true)
        .single();
      site_id = tag?.site_id || null;
    }

    // Create new worker
    const { data: worker, error } = await supabase
      .from('nfc_workers')
      .insert({ device_id, preferred_lang, site_id })
      .select('id')
      .single();

    if (error) {
      console.error('NFC register error:', error);
      return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
    }

    return NextResponse.json({ worker_id: worker.id, is_new: true });
  } catch (error) {
    console.error('NFC register error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
