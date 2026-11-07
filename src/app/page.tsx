// The public demo page: today's panchang for a chosen city. No login, not
// metered. Rendered on the server from the same core report as the API.
import { buildPageModel, type PageParams } from '@/web/pageModel';
import { PanchangView } from '@/web/PanchangView';

export const dynamic = 'force-dynamic';

export default async function Home({ searchParams }: { searchParams: Promise<PageParams> }) {
  const model = buildPageModel(await searchParams, new Date());
  return <PanchangView model={model} />;
}
