import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

/**
 * GET /api/tbm/library
 * 기초교육 라이브러리 조회
 * Query params: category, subcategory, accident_type, critical_only
 */
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = request.nextUrl;

    const category = searchParams.get('category');
    const subcategory = searchParams.get('subcategory');
    const accidentType = searchParams.get('accident_type');
    const criticalOnly = searchParams.get('critical_only') === 'true';

    let query = supabase
        .from('safety_education_library')
        .select('*')
        .order('category')
        .order('subcategory')
        .order('risk_level', { ascending: false });

    if (category) query = query.eq('category', category);
    if (subcategory) query = query.eq('subcategory', subcategory);
    if (accidentType) query = query.eq('accident_type', accidentType);
    if (criticalOnly) query = query.eq('is_critical', true);

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

/**
 * GET /api/tbm/library/categories
 * 대공종/세부공종 목록 조회 — 별도 라우트 대신 ?meta=categories 파라미터로 처리
 */
