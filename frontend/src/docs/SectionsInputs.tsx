// Docs page, first half: what the user sets up before a run.

import { Alert, List, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { OverviewDiagram, ParametersDiagram, PolicyDiagram, RunDiagram, SamplerDiagram } from "./Diagrams";
import { Eq, M } from "./Math";
import { Cite, DocTable, H3, P, Section, Src } from "./parts";

const r = String.raw;

export function IntroSection() {
  return (
    <Section
      id="about"
      title="About this guide"
      lead="This guide explains how KarLab turns a description of population groups and a tax policy into results: every step, with its mathematics and the economics behind it."
    >
      <P>
        KarLab is a population-set tax simulator. A researcher describes an economy as a few groups of households, writes tax
        policies, and runs them against a baseline like a controlled experiment. Households respond to the rules as they{" "}
        <i>perceive</i> them, while the government collects tax with the rules as they <i>are</i>. The guide follows the data
        through the program in the order it flows, and names the source file for each step so you can check it.
      </P>
      <Alert variant="light" icon={<IconInfoCircle size={18} />} title="What the checks on this engine show, and what they don't" mb="md">
        The engine reproduces the Piketty–Saez optimal flat tax and the bunching that theory predicts at a tax notch. That
        shows its economics is implemented correctly (internal validity). It does not show that the numbers describe India
        (external validity): the bundled India economy is illustrative, with plausible orders of magnitude rather than values
        estimated from survey data.
      </Alert>
    </Section>
  );
}

export function OverviewSection() {
  return (
    <Section id="overview" title="At a glance" lead="Three inputs (population sets, tax policies, a run setup) become one table of results, and every step in between is a formula you can write down.">
      <OverviewDiagram />
      <P>
        Read the diagram top to bottom. The sampler turns the population sets into households once; the engine runs once per
        policy on those same households; the analytics turn the settled table into the results screen. The theory buttons
        (section 7) write ready-made policies into step 3.
      </P>
    </Section>
  );
}

export function ParametersSection() {
  return (
    <Section
      id="parameters"
      title="1 · Setting population parameters"
      lead="A population set is one group of people described by about 35 numbers: distributions (who earns and owns what), behaviour (how people react to tax) and information (what they know)."
    >
      <ParametersDiagram />
      <P>
        The fields live in <Src>backend/src/karlab/schemas.py</Src>. The defaults below are what a new set starts with.
      </P>

      <H3>Who they are</H3>
      <DocTable
        head={["Field", "Meaning", "Default (range)", "Used for"]}
        rows={[
          ["Population", "People represented", "1 crore (> 0)", "Weights: households = population ÷ household size"],
          ["Region", "Urban, semi-urban or rural", "urban", "Targeting transfers by region"],
          ["Tags", "Labels such as farmer, bpl", "none", "Targeting transfers by tag"],
          ["Household size", "People per household", "4.4 (≥ 1)", "Per-person figures, poverty"],
          ["Earners per household", "People who earn", "1.4 (≥ 1)", "Income tax is charged per earner"],
        ]}
      />

      <H3>Income and wealth</H3>
      <DocTable
        head={["Field", "Meaning", "Default (range)", "Used for"]}
        rows={[
          ["Income distribution", "Lognormal, lognormal with a Pareto tail, or Pareto", "lognormal", <>Household income with no tax, <M>{"y_0"}</M></>],
          ["Median m", "Middle household income", "₹3 lakh", "Centre of the distribution"],
          [<M key="s">{r`\sigma`}</M>, "Spread of log income", "0.6 (0–3)", "Inequality inside the set"],
          [<M key="a">{r`\alpha`}</M>, "Pareto tail index; smaller = fatter tail", "1.8 (> 1)", "Top incomes"],
          ["Tail start q", "Percentile where the Pareto tail begins", "0.9", "Where the two shapes join"],
          ["Income sources", "Shares from wage, self-employment, agriculture, capital (rescaled to sum to 1)", "0.5 / 0.3 / 0.1 / 0.1", "Wage share gets the standard deduction; agriculture can be exempt"],
          ["Formal share", "Probability a household works formally", "0.5 (0–1)", "Only formal households pay income tax"],
          ["Wealth distribution", "Same three shapes as income", "lognormal, median ₹8 lakh, σ 1.2", "Wealth tax base"],
          [<>Income–wealth correlation <M>{r`\rho`}</M></>, "How strongly richer households are wealthier", "0.6 (−0.99 to 0.99)", "Copula in the sampler"],
        ]}
      />

      <H3>Spending</H3>
      <DocTable
        head={["Field", "Meaning", "Default (range)", "Used for"]}
        rows={[
          ["Spending share at the median (APC)", "Share of disposable income spent", "0.8 (≤ 1.5)", "Consumption, so GST"],
          [<>APC income elasticity <M>{r`\eta`}</M></>, "How the spending share changes with income (negative = richer save more)", "−0.15", "Varies APC inside the set"],
          [<>APC dispersion <M>{r`\delta`}</M></>, "Random spread of APC between households", "0.08", "Variety between households"],
          [<>GST basket <M>{r`\beta`}</M></>, "Spending shares in exempt / 5% / 18% / 40% goods", "0.30 / 0.40 / 0.27 / 0.03", "Effective GST rate"],
          [<>Informal purchase share <M>{r`\varphi`}</M></>, "Spending on which no GST is collected", "0.3", "Effective GST rate"],
        ]}
      />

      <H3>Behaviour</H3>
      <DocTable
        head={["Field", "Meaning", "Default (range)", "Used for"]}
        rows={[
          [<>ETI <M>{"e"}</M></>, "Elasticity of taxable income", "0.2 (0–2)", <>Effort: <M>{r`z = y_0(1-t)^e`}</M></>],
          ["Mobility", "Share able to switch between formal and informal work", "0.1", "Sector choice"],
          [<>Switching penalty <M>{r`\pi`}</M></>, "Share of income lost by switching sector", "0.15", "Sector choice"],
          [<>Evadable share <M>{r`\kappa`}</M></>, "Share of the tax base not reported by employers or banks", "0.3", "How much income can be hidden"],
          [<>Risk aversion <M>{r`\gamma`}</M></>, "Relative risk aversion (CRRA)", "2 (0–10)", "Evasion gamble"],
          [<>Tax morale <M>{r`\mu`}</M></>, "Guilt cost per rupee evaded", "0.3 (0–1)", "Evasion and sector choice"],
          [<>Avoidance access <M>{r`\omega`}</M></>, "Share of wealth that can be moved out of the wealth-tax base", "0", "Wealth tax"],
        ]}
      />

      <H3>Information</H3>
      <DocTable
        head={["Field", "Meaning", "Default (range)", "Used for"]}
        rows={[
          ["Awareness: rebate, deductions, transfers", "Probability a household knows each", "0.6 / 0.4 / 0.7", "Claims (modes M2 and M3)"],
          ["Rate perception", "Exact marginal rates, or only the average rate", "exact", "Effort choice"],
          [<>Perceived audit probability <M>{r`\hat p`}</M></>, "What households believe; blank means the true rate", "blank", "Evasion gamble"],
          ["Compliance cost", "Cost of filing or claiming a benefit", "₹1,000", "Claim only if the benefit is larger"],
          [<>Peer learning <M>{r`\lambda`}</M></>, "Per-period speed at which awareness spreads", "0.15", "Learning (M3)"],
        ]}
      />
      <P>
        Three fields are stored but not yet used in any calculation: literacy, the inherited-wealth share, and the split
        between self-employment and capital income (only the wage and agriculture shares enter the tax maths).
      </P>

      <H3>Economy settings</H3>
      <List mb="md" spacing={4}>
        <List.Item><b>Samples per set</b> (1,500 by default; 100–20,000): how many synthetic households each set becomes.</List.Item>
        <List.Item><b>Poverty line</b> (₹36,000 per person per year by default): used for the poverty headcount and gap.</List.Item>
        <List.Item><b>Seed</b> (7 by default): fixes the random draws, so every run can be reproduced exactly.</List.Item>
        <List.Item><b>Calibration targets</b> (optional): national population, total income, income-tax and GST revenue, taxpayers and the income Gini, compared on the Calibration tab.</List.Item>
      </List>
      <P>
        While you edit a set, a live preview samples 4,000 households from it and shows income and wealth histograms on a log
        scale, the 10th to 99th percentiles and the average spending share, so you can check the numbers look like the group you
        surveyed.
      </P>

      <H3 id="distributions">Why these three income and wealth distributions</H3>
      <P>Each shape fits a different part of how income and wealth are spread, and together they cover the whole range.</P>
      <Text fw={600} mb={4}>Lognormal: for most people</Text>
      <P>
        The logarithm of income follows a bell curve. It arises when incomes grow by many random <i>percentage</i> changes,
        which multiply together (Gibrat's law; <Cite id="gibrat1931">Gibrat 1931</Cite>,{" "}
        <Cite id="aitchison1957">Aitchison and Brown 1957</Cite>). Its two parameters can be read off survey data: the median,
        and a spread σ that maps directly to the group's Gini:
      </P>
      <Eq>{r`Q(u) = m\,e^{\sigma\,\Phi^{-1}(u)}, \qquad \text{Gini} = 2\,\Phi\!\left(\tfrac{\sigma}{\sqrt 2}\right) - 1`}</Eq>
      <P>For example σ = 0.6 gives a Gini of about 0.33 inside the group. Its weakness: the top tail is too thin, so it misses the very rich.</P>
      <Text fw={600} mb={4}>Pareto: for the very rich</Text>
      <P>
        Above some level, the share of people earning more than x falls as a power of x. This pattern, first described by{" "}
        <Cite id="pareto1896">Pareto (1896–97)</Cite>, is what top incomes and wealth show in tax data around the world{" "}
        (<Cite id="atkinson2011">Atkinson, Piketty and Saez 2011</Cite>) and in India (<Cite id="chancel2019">Chancel and Piketty 2019</Cite>).
      </P>
      <Eq>{r`Q(u) = x_{\min}\,(1-u)^{-1/\alpha}, \quad x_{\min} = m\,2^{-1/\alpha}, \qquad \frac{z_m}{z_m - \bar z} = \alpha, \qquad \text{Gini} = \frac{1}{2\alpha - 1}`}</Eq>
      <P>
        The middle identity matters: for a Pareto tail, the ratio a that the Saez top-rate formula needs is simply α, so the α
        you type for a group is the a in the formula (section 7). In the bundled economy the top 0.1% use α = 1.6 for income
        and 1.4 for wealth, which is more concentrated.
      </P>
      <Text fw={600} mb={4}>Lognormal with a Pareto tail: for mixed groups</Text>
      <P>
        Lognormal up to percentile q, Pareto above it, joined so the income at q matches. Groups such as professionals are
        mostly middle-class with a few very rich members. It also matches how Indian data arrives: household surveys capture the
        middle but miss the rich, while tax data and the World Inequality Database capture the top.
      </P>
      <Eq>{r`Q(u) = \begin{cases} m\,e^{\sigma\Phi^{-1}(u)} & u \le q \\[4pt] x_q\left(\dfrac{1-q}{1-u}\right)^{1/\alpha} & u > q \end{cases}, \qquad x_q = m\,e^{\sigma\Phi^{-1}(q)}`}</Eq>
      <P>
        Richer shapes (Singh–Maddala, Dagum, generalized beta) can fit data slightly better but need three or four parameters
        with no intuitive meaning. These three have parameters a researcher can set from a survey summary, and two of them
        connect directly to optimal-tax theory. Wealth uses the same shapes with a larger σ and a smaller α. One limitation: the
        joined shape matches the level of income at q but not its slope, which does not affect any tax calculation.
      </P>
    </Section>
  );
}

export function SamplerSection() {
  return (
    <Section
      id="sampler"
      title="2 · Preparing the synthetic population"
      lead="The sampler turns each set's distributions into N concrete households (1,500 by default) and gives each a weight, so a few thousand rows stand for 145 crore people."
    >
      <SamplerDiagram />
      <P>
        Code: <Src>population/sampler.py</Src> and <Src>population/distributions.py</Src>.
      </P>
      <P>
        <b>Step 1. A separate random stream per set.</b> Each set's seed is (economy seed × 1,000,003 + a hash of the set's id)
        mod 2³². Editing one set never changes the draws of the others.
      </P>
      <P>
        <b>Step 2. Stratified draws.</b> Instead of N purely random numbers, the engine shuffles the slots 0, 1, …, N−1 (π) and
        draws one random point inside each slot, so exactly one household falls in each 1/N slice of the distribution:
      </P>
      <Eq>{r`u_j = \frac{\pi_j + U_j}{N}, \qquad U_j \sim \text{Uniform}(0,1)`}</Eq>
      <P>
        <b>Step 3. Tie income and wealth together with a Gaussian copula</b> (<Cite id="nelsen2006">Nelsen 2006</Cite>). Turn u
        into a standard normal score and build a correlated score for wealth; ρ is the set's income–wealth correlation:
      </P>
      <Eq>{r`z^{y} = \Phi^{-1}(u), \qquad z^{w} = \rho\,z^{y} + \sqrt{1-\rho^{2}}\;\varepsilon, \qquad \varepsilon \sim N(0,1)`}</Eq>
      <P>
        <b>Step 4. Convert scores into rupees</b> with the quantile functions of section 1:{" "}
        <M>{r`y_0 = Q_{\text{income}}(\Phi(z^y))`}</M> and <M>{r`W = Q_{\text{wealth}}(\Phi(z^w))`}</M>.
      </P>
      <P>
        <b>Step 5. Spending share and yes/no characteristics.</b> Richer households spend a smaller share, with some random
        variety; each household then gets coin flips for being formal, mobile, and aware of the rebate, deductions and transfers,
        plus 8 fixed random numbers used later for scheme exclusion and inclusion errors.
      </P>
      <Eq>{r`\text{APC}_i = \text{APC}_m \left(\frac{y_{0i}}{m}\right)^{\eta} e^{\delta\,\varepsilon_i'}, \quad \text{clipped to } [0.2,\ 1.4]`}</Eq>
      <P>
        <b>Step 6. Weights and stacking.</b> Each row stands for <M>{r`w = H_s / N`}</M> real households, where{" "}
        <M>{r`H_s`}</M> = population ÷ household size. Rural landless labour, for example, has 25 crore people ÷ 4.6 = 5.43
        crore households, so each of its 1,500 rows stands for about 36,000 households. All sets are stacked into one table
        (12 × 1,500 = 18,000 rows), and every later total is a weighted sum such as <M>{r`\sum_i w_i z_i`}</M>.
      </P>
      <P>
        <b>Why this matters.</b> Keeping distributions keeps inequality <i>inside</i> groups, which decides who crosses a tax
        threshold. Fixing the seed applies every policy to identical households ("common random numbers"), so the difference
        between two policies comes from the policies, not from sampling luck.
      </P>
    </Section>
  );
}

export function PolicySection() {
  return (
    <Section id="policy" title="3 · Writing a tax policy" lead="A policy is six switchable parts; each is a formula that takes a household's choices and returns rupees.">
      <PolicyDiagram />
      <P>
        Code: <Src>schemas.py</Src> (the fields) and <Src>policy/taxes.py</Src> (the formulas).
      </P>
      <H3>Income tax, per earner</H3>
      <P>
        Income is split equally across the k earners of a household and each earner is taxed separately. With agricultural
        share a (if exempt), wage share <M>{"s_w"}</M>, standard deduction D and savings-deduction cap C (used only by
        households aware of deductions), taxable income per earner is
      </P>
      <Eq>{r`x = \max\!\Big(\tfrac{z(1-a)}{k} - \min\big(D,\ \tfrac{z\,s_w}{k}\big) - \mathbb{1}_{\text{aware}}\min\big(C,\ \tfrac{z(1-\text{APC})}{k}\big),\ 0\Big)`}</Eq>
      <P>The slab tax, with thresholds <M>{"t_j"}</M> and rates <M>{"r_j"}</M> (sorted automatically; a 0% slab from ₹0 is added if missing):</P>
      <Eq>{r`S(x) = \sum_j r_j \cdot \min\big(\max(x - t_j,\ 0),\ t_{j+1} - t_j\big)`}</Eq>
      <P>A rebate of up to R applies when taxable income is at most x̄ and the household claims it; cess c is added on top:</P>
      <Eq>{r`T = k\,(1+c)\,\Big[S(x) - \mathbb{1}_{\text{claims}}\,\mathbb{1}_{x \le \bar x}\,\min\big(S(x),\ R\big)\Big]`}</Eq>
      <P>
        Under the 2025 new regime (R = ₹60,000, x̄ = ₹12 lakh, c = 4%), tax jumps from ₹0 to ₹62,400 as taxable income crosses
        ₹12 lakh. A jump in the tax <i>amount</i> is a <b>notch</b>, and theory predicts people bunch just below it{" "}
        (<Cite id="kleven2013">Kleven and Waseem 2013</Cite>; <Cite id="saez2010">Saez 2010</Cite> for kinks).
      </P>
      <H3>GST, by category</H3>
      <P>
        Spending is tax-inclusive, so the GST inside each rupee spent on category c is <M>{r`g_c/(1+g_c)`}</M>. With basket
        shares β and informal purchase share φ:
      </P>
      <Eq>{r`\gamma = (1-\varphi)\sum_c \beta_c\,\frac{g_c}{1+g_c}, \qquad \text{GST} = \gamma \times \text{APC} \times \max(\text{disposable income},\ 0)`}</Eq>
      <P>
        Poorer groups buy more exempt and informal goods, so their γ is lower, but they spend a larger share of income, so GST
        can take a similar share of income across most of the distribution.
      </P>
      <H3>Wealth tax</H3>
      <Eq>{r`T_W = \tau_W \cdot \max\big(W(1-\omega) - W^{*},\ 0\big)`}</Eq>
      <P>ω is the set's avoidance access and W* the exemption threshold; in mode M0, ω = 0.</P>
      <H3>Transfers</H3>
      <P>
        Each scheme has an amount per household; is universal or targeted by region, tags or reported income; may need a claim;
        and has three error rates. Leakage, exclusion and inclusion errors are well documented for Indian schemes{" "}
        (<Cite id="dreze2015">Drèze and Khera 2015</Cite>; <Cite id="muralidharan2016">Muralidharan, Niehaus and Sukhtankar 2016</Cite>).
      </P>
      <Eq>{r`\text{receives} = (\text{eligible} \wedge \text{claims} \wedge \neg\text{excluded}) \vee (\neg\text{eligible} \wedge \text{included}), \qquad \text{cost} = \frac{\text{received}}{1-\ell}`}</Eq>
      <List mb="md" spacing={4}>
        <List.Item><b>Claims</b>: aware of transfers and the amount exceeds the claiming cost, which eligible claimants pay. Low awareness and hassle costs explain much of non-take-up (<Cite id="bhargava2015">Bhargava and Manoli 2015</Cite>).</List.Item>
        <List.Item><b>Exclusion error</b>: eligible households randomly left out. <b>Inclusion error</b>: ineligible households randomly let in.</List.Item>
        <List.Item><b>Leakage ℓ</b>: the share of spending lost before it reaches anyone.</List.Item>
        <List.Item>Means tests use <i>reported</i> income: hiding income can make a household eligible, and informal households report zero.</List.Item>
      </List>
      <H3>Enforcement and outreach</H3>
      <List mb="md" spacing={4}>
        <List.Item><b>Audit probability p</b> and <b>penalty θ</b>: a caught evader pays the evaded tax plus θ times it.</List.Item>
        <List.Item><b>Audit capacity A</b> (optional): the tax office can audit only A households a year, so p becomes an equilibrium outcome (section 5, step D3).</List.Item>
        <List.Item><b>Outreach o</b>: an awareness campaign that raises the chance of learning each period in M3.</List.Item>
      </List>
      <P>
        The policy screen draws the average rate T(x)/x and the marginal rate [T(x + Δ) − T(x)]/Δ for one salaried earner as
        you edit, so kinks and the notch are visible. <b>Duplicate</b> a policy to change one thing at a time: the clean way to
        run a controlled experiment.
      </P>
    </Section>
  );
}

export function RunSection() {
  return (
    <Section
      id="run"
      title="4 · Setting up a run"
      lead="A run is one experiment: one economy, one baseline (the control) and any number of policies (the treatments), all under one assumption about behaviour."
    >
      <RunDiagram />
      <DocTable
        head={["Option", "What it controls", "Default"]}
        rows={[
          ["Economy", "Which population sets are used", "—"],
          ["Baseline policy", "The control every other policy is compared against", "—"],
          ["Policies to test", "The treatments", "none"],
          ["Mode", "How people respond: M0 mechanical, M1 full information, M2 information gap, M3 learning", "M2"],
          ["Periods", "Rounds of learning in M3", "8 (1–50)"],
          ["Equal revenue", "Hold every policy at the baseline's net revenue with a lump sum per household", "off"],
          [<>Inequality aversion <M key="e">{r`\varepsilon`}</M></>, "How much the welfare measure weights the poor; 0 = only the total counts", "1 (0–5)"],
          ["Samples per set, seed", "Override the economy's settings for this run", "economy's"],
        ]}
      />
      <H3>The four modes</H3>
      <DocTable
        head={["Mode", "What households know", "Game structure"]}
        rows={[
          ["M0", "Nothing changes: full compliance, everyone claims everything", "Pure accounting"],
          ["M1", "The true rules, exactly", "Stackelberg: the government moves first, households best-respond; a Nash equilibrium among evaders if audits are limited"],
          ["M2", "Their own perceived rules: awareness, average-rate thinking, audit beliefs", "As M1, on perceived rules"],
          ["M3", "Starts like M2; awareness and audit beliefs update each period", "Repeated game with learning"],
        ]}
      />
      <P>
        Comparing neighbouring modes isolates one channel: M0 → M1 is the effect of behaviour, M1 → M2 the cost of the
        information gap, M2 → M3 the effect of learning. People respond to the taxes they notice and understand{" "}
        (<Cite id="chetty2009">Chetty, Looney and Kroft 2009</Cite>), sometimes to average rather than marginal rates{" "}
        (<Cite id="liebman2004">Liebman and Zeckhauser 2004</Cite>); M2 builds those findings in.
      </P>
      <Text mb="sm">
        To design a good experiment: change one thing per treatment, use equal revenue when policies raise different amounts,
        and run the same comparison in M1 and M2 to see how much of a result comes from the information gap.
      </Text>
    </Section>
  );
}
