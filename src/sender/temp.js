export const cToF = (c) => (c * 9) / 5 + 32;
export const fToC = (f) => ((f - 32) * 5) / 9;

export const finiteOrNull = (n) =>
  typeof n === "number" && Number.isFinite(n) ? n : null;

/**
 * Build UI-friendly temperature values while keeping °C as the source of truth.
 * @param {{
 *  telemetry: any,
 *  showFahrenheit: boolean,
 *  minC?: number,
 *  maxC?: number,
 *  bandC?: number,
 * }} opts
 */
export function getTempUiModel(opts) {
  const {
    telemetry,
    showFahrenheit,
    minC = -50,
    maxC = 80,
    bandC = 3,
  } = opts ?? {};

  const tempC = finiteOrNull(telemetry?.TEMP);
  const setTempC = finiteOrNull(telemetry?.SET_TEMP);

  const unit = showFahrenheit ? "°F" : "°C";
  const tempDisplay = tempC === null ? null : showFahrenheit ? cToF(tempC) : tempC;
  const setTempDisplay =
    setTempC === null ? null : showFahrenheit ? cToF(setTempC) : setTempC;

  const gaugeMin = showFahrenheit ? cToF(minC) : minC;
  const gaugeMax = showFahrenheit ? cToF(maxC) : maxC;
  const bandDisplay = showFahrenheit ? (bandC * 9) / 5 : bandC;

  return {
    tempC,
    setTempC,
    tempDisplay,
    setTempDisplay,
    gaugeMin,
    gaugeMax,
    unit,
    bandDisplay,
  };
}

