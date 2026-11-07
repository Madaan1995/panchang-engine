// GET muhurat — see src/server/api.ts for the request pipeline.
import { handleApiRequest } from '@/server/api';
import { productionDeps } from '@/server/deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET(request: Request): Promise<Response> {
  return handleApiRequest('muhurat', request, productionDeps());
}
