import type { EnergyService } from '@codestrap/developer-foundations-types';
import { getCaGasTracker, getVegaGasTrackerData } from './delegates/read';

export const eiaService: EnergyService = {
  read: getCaGasTracker,
  getVegaChartData: getVegaGasTrackerData,
};
