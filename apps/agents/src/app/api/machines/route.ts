export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { MachineDao } from '@codestrap/developer-foundations-types';
import { TYPES } from '@codestrap/developer-foundations-types';
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

    console.log(`calling machineDao.read with id ${id}`);

    return withRequestContext({ token, requestId: uuidv4() }, async () => {
      const machineDao = container.get<MachineDao>(TYPES.MachineDao);
      const result = await machineDao.read(id);

      return NextResponse.json(result);
    });
  } catch (err) {
    console.error('Error reading machine object:', (err as Error).stack);
    return new NextResponse('Internal error', { status: 500 });
  }
}
