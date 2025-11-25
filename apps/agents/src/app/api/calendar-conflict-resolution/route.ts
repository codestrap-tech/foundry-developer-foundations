export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Vickie } from '@codestrap/developer-foundations-agents-vickie-bennie';
import { User } from '@osdk/foundry.admin';
import { uuidv4 } from '@codestrap/developer-foundations-utils';
import { withRequestContext } from '@codestrap/developer-foundations-utils/src/lib/asyncLocalStorage';
import { container } from '@codestrap/developer-foundations-di';
import {
  OfficeService,
  OfficeServiceV3,
  TYPES,
} from '@codestrap/developer-foundations-types';

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

export async function POST(req: NextRequest) {
  try {
    const officeService = await container.getAsync<OfficeServiceV3>(
      TYPES.OfficeServiceV3
    );

    const result = await officeService.resolveMeetingConflicts({
      userEmails: ['igor@codestrap.me'],
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error('Error executing vickie:', err);
    return new NextResponse('Internal error', { status: 500 });
  }
}
