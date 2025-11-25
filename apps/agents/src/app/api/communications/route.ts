export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { TYPES, CommsDao } from '@codestrap/developer-foundations-types';
import { container } from '@codestrap/developer-foundations-di';
import { uuidv4 } from '@codestrap/developer-foundations-utils';
import { withRequestContext } from '@codestrap/developer-foundations-utils/src/lib/asyncLocalStorage';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers':
        'Content-Type, Authorization, x-foundry-access-token',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const token = req.headers.get('x-foundry-access-token');

    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({
        response_type: 'ephemeral',
        text: '⚠️ Missing required id param.',
      });
    }

    return withRequestContext({ token, requestId: uuidv4() }, async () => {
      const commsDao = container.get<CommsDao>(TYPES.CommsDao);
      const result = await commsDao.read(id);

      return NextResponse.json(result);
    });
  } catch (err) {
    console.error('Error reading communications object:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
