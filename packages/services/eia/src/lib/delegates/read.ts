import type {
  EIAResponse,
  GasScenarioResult,
} from '@codestrap/developer-foundations-types';

async function fetchCaGasPriceFromEIA(): Promise<{
  date: string;
  price: number;
}> {
  const url = new URL(process.env['EIA_BASE_URL']!);
  url.searchParams.set('api_key', process.env['EIA_API_KEY']!);
  url.searchParams.set('frequency', 'weekly');
  url.searchParams.set('data[0]', 'value');
  url.searchParams.set('facets[series][]', process.env['CA_SERIES_ID']!);
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('length', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EIA API call failed: ${res.statusText}`);

  const json = (await res.json()) as EIAResponse;
  const latest = json.response?.data?.[0];
  if (!latest) throw new Error('No data returned from EIA API.');

  return {
    date: latest.period,
    price: parseFloat(latest.value),
  };
}

export async function getCaGasTracker(
  scenarioPrices: number[] = [5, 6, 7, 8],
  caGallonsYear = 13.4e9,
  caGdp = 4.1e12,
  caShareUsGdp = 0.14,
): Promise<GasScenarioResult[]> {
  const { date, price: baselinePrice } = await fetchCaGasPriceFromEIA();

  return scenarioPrices.map((p) => {
    const delta = p - baselinePrice;
    const incrementalCost = delta * caGallonsYear;
    const pctCaGdp = (incrementalCost / caGdp) * 100;
    const usGdpDrag = (pctCaGdp * caShareUsGdp) / 100;

    return {
      date,
      baselinePrice: parseFloat(baselinePrice.toFixed(3)),
      scenarioPrice: parseFloat(p.toFixed(2)),
      deltaVsBaseline: parseFloat(delta.toFixed(3)),
      annualIncrementalCostBn: parseFloat((incrementalCost / 1e9).toFixed(2)),
      pctOfCaGdp: parseFloat(pctCaGdp.toFixed(2)),
      impliedUsGdpDrag: parseFloat(usGdpDrag.toFixed(3)),
    };
  });
}

export function getVegaGasTrackerData(results: GasScenarioResult[]) {
  return {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    description: 'California Gas Price Scenarios - Annual Cost Impact',
    data: {
      name: 'gasPriceScenarios',
      values: results.map((r) => ({
        date: r.date,
        scenario: r.scenarioPrice,
        delta: r.deltaVsBaseline,
        annualCost: r.annualIncrementalCostBn,
        pctOfCaGdp: r.pctOfCaGdp,
        usGdpDrag: r.impliedUsGdpDrag,
      })),
    },
    mark: 'bar',
    encoding: {
      x: {
        field: 'scenario',
        type: 'ordinal',
        title: 'Scenario Price ($/gal)',
      },
      y: {
        field: 'annualCost',
        type: 'quantitative',
        title: 'Annual Incremental Cost ($B)',
      },
      tooltip: [
        { field: 'scenario', type: 'ordinal', title: 'Scenario Price ($/gal)' },
        {
          field: 'annualCost',
          type: 'quantitative',
          title: 'Annual Cost ($B)',
        },
        { field: 'pctOfCaGdp', type: 'quantitative', title: '% of CA GDP' },
        { field: 'usGdpDrag', type: 'quantitative', title: 'US GDP Drag (pp)' },
      ],
    },
  };
}
