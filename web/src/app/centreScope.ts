import type {CentreScope, ProgrammeContext} from '../session/controller';

// The production seed must use these IDs so a label change cannot put sample records in official reports.
export const SAMPLE_CENTRE_IDS = {
  mass: 'edf4e4f2-b379-4753-be3d-d0aae6e9615c',
  kirti: '0147955c-f6fb-43c5-a028-ff52f4d01cca',
} as const;

export const isSampleCentre = ({id}: CentreScope) => id === SAMPLE_CENTRE_IDS.mass || id === SAMPLE_CENTRE_IDS.kirti;

export function selectCentreScope(context: ProgrammeContext, samples: boolean): ProgrammeContext {
  if (context.role !== 'Leadership' || !context.centres.some(isSampleCentre)) return context;
  return {
    ...context,
    centres: context.centres.filter(centre => isSampleCentre(centre) === samples),
    capabilities: samples ? {...context.capabilities, export: false} : context.capabilities,
  };
}
