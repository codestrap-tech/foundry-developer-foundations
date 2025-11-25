export const runtime = 'nodejs';

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import type { EnergyService} from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const eiaService = container.get<EnergyService>(TYPES.EnergyService);

    const {
      scenarioPrices = [5, 6, 7, 8],
      caGallonsYear = 13.4e9,
      caGdp = 4.1e12,
      caShareUsGdp = 0.14,
    } = await safeJson(req);

    // Validate minimal sanity on inputs (keep it lightweight, no extra deps)
    if (
      !Array.isArray(scenarioPrices) ||
      !scenarioPrices.every((n) => typeof n === 'number')
    ) {
      return badRequest('scenarioPrices must be an array of numbers.');
    }
    if (typeof caGallonsYear !== 'number' || caGallonsYear <= 0) {
      return badRequest('caGallonsYear must be a positive number.');
    }
    if (typeof caGdp !== 'number' || caGdp <= 0) {
      return badRequest('caGdp must be a positive number.');
    }
    if (
      typeof caShareUsGdp !== 'number' ||
      caShareUsGdp <= 0 ||
      caShareUsGdp > 1
    ) {
      return badRequest('caShareUsGdp must be a number between 0 and 1.');
    }

    const results = await eiaService.read(
      scenarioPrices,
      caGallonsYear,
      caGdp,
      caShareUsGdp
    );

    return NextResponse.json(results, {
      status: 200,
      headers: corsHeaders(),
    });
  } catch (err) {
    console.error('energy/read error:', err);
    return NextResponse.json(
      { error: (err as Error)?.message ?? 'Internal error' },
      { status: 500, headers: corsHeaders() }
    );
  }
}

/** Helpers */

async function safeJson(req: NextRequest) {
  try {
    if (req.headers.get('content-type')?.includes('application/json')) {
      return await req.json();
    }
    // Support x-www-form-urlencoded if you want parity with your template
    const text = await req.text();
    try {
      return JSON.parse(text);
    } catch {
      // fallback to URLSearchParams
      const params = new URLSearchParams(text);
      return Object.fromEntries(params.entries());
    }
  } catch {
    return {};
  }
}

function badRequest(message: string) {
  return NextResponse.json(
    { error: message },
    { status: 400, headers: corsHeaders() }
  );
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
