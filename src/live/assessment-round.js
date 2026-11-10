const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function assessmentRoundForDate(date, academicYear) {
  if (!DATE.test(date || '') || !academicYear?.starts_on || !academicYear?.ends_before || date < academicYear.starts_on || date >= academicYear.ends_before) {
    throw new Error('Choose an assessment date within the selected academic year.');
  }
  const start = new Date(`${academicYear.starts_on}T00:00:00Z`);
  const observed = new Date(`${date}T00:00:00Z`);
  const months = (observed.getUTCFullYear() - start.getUTCFullYear()) * 12 + observed.getUTCMonth() - start.getUTCMonth();
  const quarter = Math.floor(months / 3) + 1;
  if (quarter < 1 || quarter > 4) throw new Error('The assessment date does not map to F1–F4.');
  return Object.freeze({quarter, label:`F${quarter}`});
}

export function assessmentDefinitionForDate(date, academicYear, periods, definitions) {
  const round = assessmentRoundForDate(date, academicYear);
  const period = periods.find(value => value.academic_year_id === academicYear.id && Number(value.quarter) === round.quarter);
  const definition = period && definitions.find(value => value.period_id === period.id && Number(value.max_score) === 25);
  if (!definition) throw new Error(`${round.label} has no approved 25-mark assessment definition.`);
  return Object.freeze({...round, period, definition});
}
