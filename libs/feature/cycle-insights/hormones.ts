// estimated hormone concentrations for a cycle day — the quantitative output the
// sensor-fusion model produces from the multi-system physiological signature. Pure,
// deterministic curves shaped to the textbook 28-day profile so the app can show
// values + trend lines (estradiol pg/mL, progesterone ng/mL, LH/FSH mIU/mL).

export interface HormoneEstimate {
  estradiolPgMl: number;
  progesteroneNgMl: number;
  lhMiuMl: number;
  fshMiuMl: number;
}

// gaussian bump centered at `mu` with spread `sigma`, peak 1.
const bump = (day: number, mu: number, sigma: number): number =>
  Math.exp(-((day - mu) ** 2) / (2 * sigma * sigma));

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;

  return Math.round(value * f) / f;
};

export const estimateHormones = (cycleDay: number): HormoneEstimate => {
  // clamp into a single cycle for shape stability
  const d = ((((Math.round(cycleDay) - 1) % 28) + 28) % 28) + 1;

  // estradiol: low follicular baseline, sharp pre-ovulatory peak (~day 13), a
  // broader secondary luteal rise (~day 21).
  const estradiol = 38 + 250 * bump(d, 13, 2.4) + 120 * bump(d, 21, 4.5);

  // progesterone: <1 ng/mL until ovulation, then the luteal rise peaking mid-luteal.
  const progesterone = 0.4 + 13 * bump(d, 21, 3.8);

  // LH: baseline with the ovulatory surge (~day 13.5), the narrowest, sharpest peak.
  const lh = 6 + 52 * bump(d, 13.5, 1.1);

  // FSH: baseline with an early-follicular lift and a small mid-cycle bump.
  const fsh = 5.5 + 3 * bump(d, 3, 3) + 4.5 * bump(d, 13.5, 1.4);

  return {
    estradiolPgMl: round(estradiol, 0),
    progesteroneNgMl: round(progesterone, 1),
    lhMiuMl: round(lh, 1),
    fshMiuMl: round(fsh, 1),
  };
};
