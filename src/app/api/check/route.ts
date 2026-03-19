import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getErrorMessage } from '@/utils/errors';

interface HealthItem {
    status: 'pending' | 'ok' | 'error';
    message: string;
}

interface ApiErrorResponse {
    error?: { message?: string };
}

export async function GET() {
    const results: Record<string, HealthItem> = {
        supabase: { status: 'pending', message: '' },
        google_translate: { status: 'pending', message: '' },
        google_tts: { status: 'pending', message: '' },
        google_stt: { status: 'pending', message: '' },
    };

    const GOOGLE_API_KEY = process.env.GOOGLE_CLOUD_API_KEY?.trim();
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    // 1. Supabase Check
    try {
        if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase env vars not configured');
        const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { error } = await supabase.from('sites').select('id').limit(1);
        if (error) throw error;
        results.supabase = { status: 'ok', message: 'Connected' };
    } catch (error: unknown) {
        results.supabase = { status: 'error', message: getErrorMessage(error) };
    }

    // 2. Google Translate (Gemini) Check - Simple Probing
    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: "hi" }] }],
                    generationConfig: { maxOutputTokens: 5 }
                })
            }
        );
        if (response.ok) {
            results.google_translate = { status: 'ok', message: 'Gemini 2.0 Flash is Active' };
        } else {
            const err = await response.json() as ApiErrorResponse;
            results.google_translate = { status: 'error', message: err.error?.message || 'API Error' };
        }
    } catch (error: unknown) {
        results.google_translate = { status: 'error', message: getErrorMessage(error) };
    }

    // 3. Google TTS Check
    try {
        const response = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                input: { text: "test" },
                voice: { languageCode: "ko-KR", ssmlGender: "FEMALE" },
                audioConfig: { audioEncoding: 'MP3' }
            })
        });
        if (response.ok) {
            results.google_tts = { status: 'ok', message: 'TTS Engine is Active' };
        } else {
            const err = await response.json() as ApiErrorResponse;
            results.google_tts = { status: 'error', message: err.error?.message || 'API Error' };
        }
    } catch (error: unknown) {
        results.google_tts = { status: 'error', message: getErrorMessage(error) };
    }

    // 4. Google STT Check
    try {
        if (!GOOGLE_API_KEY) throw new Error('Missing API key');
        const response = await fetch(
            `https://speech.googleapis.com/v1/speech:recognize?key=${GOOGLE_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config: { encoding: 'LINEAR16', sampleRateHertz: 16000, languageCode: 'ko-KR' }, audio: { content: '' } })
            }
        );
        results.google_stt = response.ok || response.status === 400
            ? { status: 'ok', message: 'STT Engine is Active' }
            : { status: 'error', message: `HTTP ${response.status}` };
    } catch (error: unknown) {
        results.google_stt = { status: 'error', message: getErrorMessage(error) };
    }

    return NextResponse.json(results);
}
