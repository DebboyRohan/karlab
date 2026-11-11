// Flow diagrams for the Docs page. Plain SVG, coloured with Mantine theme variables so they
// follow the light and dark themes.

const EDGE = "var(--mantine-color-gray-5)";
const INK = "var(--mantine-color-text)";
const QUIET = "var(--mantine-color-dimmed)";
const ACCENT = "var(--mantine-color-ledger-6)";
const TINT = "var(--mantine-color-default-hover)";

function Frame({ title, height, children }: { title: string; height: number; children: React.ReactNode }) {
  return (
    <figure className="doc-figure">
      <svg viewBox={`0 0 760 ${height}`} role="img" aria-label={title} fontSize="13" style={{ width: "100%", maxWidth: 760 }}>
        <text x="24" y="32" fontSize="15" fontWeight="600" fill={INK}>
          {title}
        </text>
        {children}
      </svg>
    </figure>
  );
}

function Arrowhead({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0L10 5L0 10z" fill={EDGE} />
      </marker>
    </defs>
  );
}

function Box({ x, y, w, h, main, tint }: { x: number; y: number; w: number; h: number; main?: boolean; tint?: boolean }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx="8"
      fill={main ? ACCENT : tint ? TINT : "none"}
      fillOpacity={main ? 0.12 : 1}
      stroke={main ? ACCENT : EDGE}
      strokeWidth={main ? 2 : 1.25}
    />
  );
}

/** A box with a bold name and up to a few quiet lines underneath, left-aligned. */
function Card({ x, y, w, name, lines = [], main, tint }: { x: number; y: number; w: number; name: string; lines?: string[]; main?: boolean; tint?: boolean }) {
  const h = 40 + 16 * lines.length;
  return (
    <g>
      <Box x={x} y={y} w={w} h={h} main={main} tint={tint} />
      <text x={x + 12} y={y + 24} fontWeight="600" fill={INK}>
        {name}
      </text>
      {lines.map((line, i) => (
        <text key={line} x={x + 12} y={y + 42 + 16 * i} fontSize="11.5" fill={QUIET}>
          {line}
        </text>
      ))}
    </g>
  );
}

function Paths({ id, d }: { id?: string; d: string[] }) {
  return (
    <g fill="none" stroke={EDGE} strokeWidth="1.25">
      {d.map((p) => (
        <path key={p} d={p} markerEnd={id ? `url(#${id})` : undefined} />
      ))}
    </g>
  );
}

export function OverviewDiagram() {
  return (
    <Frame title="One run: three inputs feed one engine, which feeds one table of results" height={634}>
      <Arrowhead id="ov-arrow" />
      <Paths id="ov-arrow" d={["M134 128V158", "M134 232V266", "M380 128V266", "M626 128V266", "M198 340H212", "M372 340H386", "M546 340H560", "M380 418V448", "M380 522V552"]} />
      <Card x={24} y={56} w={220} name="1 · Population sets" lines={["distributions, behaviour,", "awareness"]} />
      <Card x={270} y={56} w={220} name="3 · Tax policy" lines={["income tax, GST, wealth tax,", "transfers, audits"]} />
      <Card x={516} y={56} w={220} name="4 · Run setup" lines={["baseline, policies, mode,", "equal revenue, ε"]} />
      <Card x={24} y={160} w={220} name="2 · Sampler" lines={["1,500 weighted households", "per set"]} />
      <Box x={24} y={268} w={712} h={150} main />
      <text x="40" y="290" fontWeight="600" fill={INK}>
        5 · Engine, run once per policy
      </text>
      <Card x={40} y={304} w={158} name="Perception" lines={["what each household", "knows (M0–M3)"]} />
      <Card x={214} y={304} w={158} name="Decisions" lines={["effort, reporting,", "sector, claims"]} />
      <Card x={388} y={304} w={158} name="Audit equilibrium" lines={["iterate p to a", "Nash fixed point"]} />
      <Card x={562} y={304} w={158} name="Settlement" lines={["true rules: taxes,", "transfers, utility"]} />
      <text x="40" y="402" fontSize="11.5" fill={QUIET}>
        repeated for each policy, each M3 period and the equal-revenue lump sum
      </text>
      <Card x={200} y={450} w={360} name="6 · Analytics" lines={["revenue, equality, equity, efficiency,", "welfare, per set, vs baseline"]} />
      <Card x={200} y={554} w={360} name="Results screen and saved run" lines={["how to read it: last section"]} />
    </Frame>
  );
}

export function ParametersDiagram() {
  const cols: [number, string, string[]][] = [
    [24, "Who", ["population", "region, tags", "household size", "earners"]],
    [169, "Income, wealth", ["income shape", "median, σ, α", "income sources", "formal share", "wealth shape", "correlation ρ"]],
    [314, "Spending", ["spending share", "APC elasticity η", "GST basket β", "informal buying φ"]],
    [459, "Behaviour", ["ETI e", "mobility", "switch penalty π", "evadable share κ", "risk aversion γ", "tax morale μ", "avoidance ω"]],
    [604, "Information", ["awareness × 3", "rate perception", "audit belief p̂", "claiming cost", "peer learning λ"]],
  ];
  return (
    <Frame title="A population set is five groups of parameters" height={364}>
      <Paths d={["M380 96V112", "M90 112H670", "M90 112V128", "M235 112V128", "M380 112V128", "M525 112V128", "M670 112V128"]} />
      <Box x={280} y={56} w={200} h={40} main />
      <text x="380" y="81" textAnchor="middle" fontWeight="600" fill={INK}>
        Population set
      </text>
      {cols.map(([x, name, lines]) => (
        <g key={name}>
          <Box x={x} y={128} w={132} h={152} />
          <text x={x + 12} y={152} fontWeight="600" fill={INK}>
            {name}
          </text>
          {lines.map((line, i) => (
            <text key={line} x={x + 12} y={170 + 16 * i} fontSize="11.5" fill={QUIET}>
              {line}
            </text>
          ))}
        </g>
      ))}
      <Box x={24} y={300} w={712} h={40} tint />
      <text x="380" y="325" textAnchor="middle" fontSize="12" fill={INK}>
        Economy settings: samples per set, poverty line, seed, calibration targets
      </text>
    </Frame>
  );
}

export function SamplerDiagram() {
  const steps: [string, string][] = [
    ["1 · Seed per set", "seed × 1,000,003 + hash(set id): sets draw independently"],
    ["2 · Stratified draws", "u = (π + U) ÷ N: exactly one draw in every 1/N slice"],
    ["3 · Copula scores", "z_y = Φ⁻¹(u),   z_w = ρ z_y + √(1 − ρ²) ε"],
    ["4 · Quantile functions", "y₀ = Q_income(Φ(z_y)),   W = Q_wealth(Φ(z_w))"],
    ["5 · Spending and flags", "APC = APC_m (y₀/m)^η e^(δε′);  formal, mobile, aware: coin flips"],
    ["6 · Weights, stacking", "w = H ÷ N;  12 sets × 1,500 = 18,000 rows for 145 crore people"],
  ];
  return (
    <Frame title="The sampler turns each set into 1,500 weighted households" height={488}>
      <Arrowhead id="sa-arrow" />
      <Paths id="sa-arrow" d={["M140 104V126", "M140 176V198", "M140 248V270", "M140 320V342", "M140 392V414"]} />
      {steps.map(([name, maths], i) => {
        const y = 56 + 72 * i;
        return (
          <g key={name}>
            <Box x={24} y={y} w={712} h={48} main={i === steps.length - 1} />
            <text x="40" y={y + 29} fontWeight="600" fill={INK}>
              {name}
            </text>
            <text x="250" y={y + 29} fontSize="12" fill={INK}>
              {maths}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}

export function PolicyDiagram() {
  const parts: [number, number, string, string[]][] = [
    [40, 96, "Income tax", ["per earner, after deductions", "slab tax S(x) − rebate if x ≤ x̄", "× (1 + cess) × earners"]],
    [272, 96, "GST", ["γ = (1−φ) Σ β g/(1+g)", "× consumption", "basket differs by group"]],
    [504, 96, "Wealth tax", ["τ_W · max(W(1−ω) − W*, 0)", "ω = avoidance access", "W* = exemption threshold"]],
    [40, 200, "Transfers", ["universal or targeted", "claim needed? leakage ℓ", "exclusion, inclusion errors"]],
    [272, 200, "Enforcement", ["audit probability p", "penalty θ × tax evaded", "optional audit capacity A"]],
    [504, 200, "Outreach", ["awareness campaign o", "speeds learning in M3"]],
  ];
  return (
    <Frame title="A policy is six switchable parts, all applied at settlement" height={400}>
      <Arrowhead id="po-arrow" />
      <Box x={24} y={56} w={712} h={248} />
      <text x="40" y="80" fontWeight="600" fill={INK}>
        Tax policy
      </text>
      {parts.map(([x, y, name, lines]) => (
        <g key={name}>
          <Box x={x} y={y} w={216} h={88} />
          <text x={x + 12} y={y + 24} fontWeight="600" fill={INK}>
            {name}
          </text>
          {lines.map((line, i) => (
            <text key={line} x={x + 12} y={y + 42 + 16 * i} fontSize="11.5" fill={QUIET}>
              {line}
            </text>
          ))}
        </g>
      ))}
      <Paths id="po-arrow" d={["M380 304V326"]} />
      <Box x={160} y={328} w={440} h={52} main />
      <text x="380" y="350" textAnchor="middle" fontWeight="600" fill={INK}>
        Settlement applies every part to every household
      </text>
      <text x="380" y="368" textAnchor="middle" fontSize="11.5" fill={QUIET}>
        Engine, step D4
      </text>
    </Frame>
  );
}

export function RunDiagram() {
  return (
    <Frame title="A run is an experiment: same households, one control, several treatments" height={416}>
      <Arrowhead id="ru-arrow" />
      <Paths d={["M380 104V120", "M134 120H626"]} />
      <Paths id="ru-arrow" d={["M134 120V134", "M380 120V134", "M626 120V134", "M134 192V230", "M380 192V230", "M626 192V230", "M380 284V314"]} />
      <Box x={180} y={56} w={400} h={48} tint />
      <text x="380" y="77" textAnchor="middle" fontWeight="600" fill={INK}>
        Same synthetic households
      </text>
      <text x="380" y="94" textAnchor="middle" fontSize="11.5" fill={QUIET}>
        one seed, used by every policy
      </text>
      <Card x={24} y={136} w={220} name="Baseline (control)" lines={["net revenue R₀"]} />
      <Card x={270} y={136} w={220} name="Policy A (treatment)" lines={["+ lump sum L_A if equal revenue"]} />
      <Card x={516} y={136} w={220} name="Policy B (treatment)" lines={["+ lump sum L_B if equal revenue"]} />
      <Box x={24} y={232} w={712} h={52} />
      <text x="380" y="254" textAnchor="middle" fontWeight="600" fill={INK}>
        Engine in one mode: M0, M1, M2 or M3
      </text>
      <text x="380" y="272" textAnchor="middle" fontSize="11.5" fill={QUIET}>
        same ε and number of periods for every policy
      </text>
      <Box x={160} y={316} w={440} h={52} main />
      <text x="380" y="338" textAnchor="middle" fontWeight="600" fill={INK}>
        Compare each treatment with the baseline
      </text>
      <text x="380" y="356" textAnchor="middle" fontSize="11.5" fill={QUIET}>
        Δ EDE welfare, Δ Gini, who gains, who loses
      </text>
      <text x="380" y="394" textAnchor="middle" fontSize="11.5" fill={QUIET}>
        In M2 and M3 each policy is also rerun in M1 to measure the information gap
      </text>
    </Frame>
  );
}

function Diamond({ cx, cy, hw, hh, label }: { cx: number; cy: number; hw: number; hh: number; label: string }) {
  return (
    <g>
      <polygon points={`${cx - hw},${cy} ${cx},${cy - hh} ${cx + hw},${cy} ${cx},${cy + hh}`} fill="none" stroke={EDGE} strokeWidth="1.25" />
      <text x={cx} y={cy + 4} textAnchor="middle" fill={INK}>
        {label}
      </text>
    </g>
  );
}

function Note({ x, y, text, anchor = "start" }: { x: number; y: number; text: string; anchor?: "start" | "middle" | "end" }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize="11.5" fill={QUIET}>
      {text}
    </text>
  );
}

export function PeriodDiagram() {
  return (
    <Frame title="One period: households decide on perceived rules, the state settles with true ones" height={744}>
      <Arrowhead id="pe-arrow" />
      <Paths
        id="pe-arrow"
        d={[
          "M400 108V126", "M400 180V198", "M400 252V274", "M400 328V350", "M400 404V422", "M400 480V506",
          "M400 560V582", "M400 640V666", "M460 154H582", "M660 180V534H552", "M310 452H200V94H248", "M300 612H60V70H248",
        ]}
      />
      <Card x={250} y={56} w={300} name="D1 · Perception" lines={["what each household knows (mode M0–M3)"]} main />
      <Diamond cx={400} cy={154} hw={60} hh={26} label="Mode M0?" />
      <Card x={584} y={128} w={152} name="No behaviour" lines={["z = y₀, report all"]} />
      <Card x={250} y={200} w={300} name="D2 · Effort" lines={["max z − T(z) − v(z) over slab optima + grid"]} />
      <Card x={250} y={276} w={300} name="D2 · Reporting" lines={["max over r: (1−p̂)U(c) + p̂U(c − (1+θ)E)"]} />
      <Card x={250} y={352} w={300} name="D2 · Sector (mobile households)" lines={["formal if U_F ≥ U_I"]} />
      <Diamond cx={400} cy={452} hw={90} hh={28} label="Audit capacity set?" />
      <Card x={250} y={508} w={300} name="D4 · Settlement with true rules" lines={["taxes, penalty, transfers, GST, utility"]} main />
      <Diamond cx={400} cy={612} hw={100} hh={28} label="M3, periods left?" />
      <Card x={250} y={668} w={300} name="Steps F–H · Summarise" lines={["measures, vs baseline, full-information rerun"]} />
      <Note x={520} y={146} text="yes" anchor="middle" />
      <Note x={410} y={194} text="no" />
      <Note x={255} y={444} text="yes: new p" anchor="middle" />
      <Note x={410} y={498} text="no" />
      <Note x={192} y={250} text="p = min(1, A ÷ evaders)," anchor="end" />
      <Note x={192} y={266} text="repeat until it settles" anchor="end" />
      <Note x={180} y={604} text="yes: update awareness, beliefs" anchor="middle" />
      <Note x={410} y={658} text="no" />
    </Frame>
  );
}

export function AnalyticsDiagram() {
  const families: [string, string][] = [
    ["Revenue", "gross, transfer spending, leakage, net"],
    ["Equality", "Gini, Theil split, Atkinson, Palma, poverty"],
    ["Equity", "Kakwani, Reynolds–Smolensky, net tax rate"],
    ["Efficiency", "output loss, excess burden (deadweight loss)"],
    ["Welfare", "mean utility, EDE utility (the headline)"],
    ["Compliance", "formal share, under-reporting, tax gap"],
    ["Information gap", "benefit capture, unclaimed, unaware tax"],
  ];
  return (
    <Frame title="Analytics: one settled table, seven families of measures" height={432}>
      <Arrowhead id="an-arrow" />
      <Paths d={["M224 222H262", "M262 76V388"]} />
      <Paths id="an-arrow" d={families.map((_, i) => `M262 ${76 + 52 * i}H298`)} />
      <Card x={24} y={178} w={200} name="Settled table" lines={["18,000 rows × weights", "earnings, taxes, transfers,", "disposable, GST, utility"]} tint />
      <Note x={36} y={296} text="also per set, per income band," />
      <Note x={36} y={312} text="and against the baseline" />
      {families.map(([name, measures], i) => {
        const y = 56 + 52 * i;
        const main = name === "Welfare";
        return (
          <g key={name}>
            <Box x={300} y={y} w={436} h={40} main={main} />
            <text x="312" y={y + 25} fontWeight="600" fill={INK}>
              {name}
            </text>
            <text x="436" y={y + 25} fontSize="11.5" fill={main ? INK : QUIET}>
              {measures}
            </text>
          </g>
        );
      })}
    </Frame>
  );
}
