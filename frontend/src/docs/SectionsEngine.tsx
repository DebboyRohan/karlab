// Docs page, second half: what happens when a run starts, and how to read what comes out.

import { Anchor, List, Text } from "@mantine/core";
import { AnalyticsDiagram, PeriodDiagram } from "./Diagrams";
import { Eq, M } from "./Math";
import { Cite, DocTable, H3, P, Section, Src } from "./parts";
import { REFERENCES } from "./references";

const r = String.raw;

export function EngineSection() {
  return (
    <Section
      id="engine"
      title="5 · What the engine does when a run starts"
      lead="A run samples the households once, simulates the baseline, simulates each policy on the same households, settles everyone's taxes with the true rules and summarises the outcome."
    >
      <P>
        Code: <Src>compare.py</Src> (the run), <Src>engine.py</Src> (one period), <Src>information.py</Src> (perception),{" "}
        <Src>responders.py</Src> (decisions).
      </P>
      <PeriodDiagram />
      <P>
        In M0 households skip straight to settlement; in M1–M3 they make three decisions on the rules as they perceive them,
        the audit loop runs only when audit capacity is limited, and M3 repeats the whole period with updated awareness.
      </P>

      <H3>Step A. Sample once</H3>
      <P>The sampler (section 2) builds the household table with the run's seed. Every policy reuses this exact table.</P>

      <H3>Step B. Simulate the baseline</H3>
      <P>The baseline is solved in the chosen mode (steps D and E) and its net revenue <M>{"R_0"}</M> is recorded.</P>

      <H3>Step C. Simulate each policy, at equal revenue if asked</H3>
      <P>
        Each policy is solved the same way. With equal revenue on, a lump sum L per household (positive = a payment, negative
        = a charge) is adjusted up to four times, stopping when revenue is within one millionth of <M>{"R_0"}</M>:
      </P>
      <Eq>{r`L \leftarrow L + \frac{R(L) - R_0}{H}, \qquad H = \sum_i w_i \ \text{(real households)}`}</Eq>
      <P>
        A policy that collects more gives the surplus back equally; one that collects less covers the gap with an equal
        charge. So no policy looks fairer just because it spends more of the government's money.
      </P>

      <H3>Step D1. Perception</H3>
      <DocTable
        head={["Mode", "Awareness", "Audit probability used", "Rate seen", "Compliance"]}
        rows={[
          ["M0", "Everyone aware", "True p", "Exact", "Full: no evasion, avoidance or switching"],
          ["M1", "Everyone aware", "True p", "Exact", "Free to choose"],
          ["M2, M3", "Own flags from the sampler", <>Own belief <M key="p">{r`\hat p`}</M> (or the true p)</>, "Own (exact or average)", "Free to choose"],
        ]}
      />

      <H3>Step D2. Decisions</H3>
      <Text fw={600} mb={4}>(i) Earnings: the effort choice</Text>
      <P>
        Utility is quasi-linear, u = c − v(z), with an iso-elastic effort cost. At a flat rate t the first-order condition
        gives the standard elasticity form, so e is exactly the elasticity of taxable income with respect to the net-of-tax
        rate (<Cite id="saez2012">Saez, Slemrod and Giertz 2012</Cite>):
      </P>
      <Eq>{r`v(z) = y_0\,\frac{e}{1+e}\left(\frac{z}{y_0}\right)^{\frac{1+e}{e}} \quad\Rightarrow\quad 1-t = v'(z) \ \Rightarrow\ z^{*} = y_0(1-t)^{e}`}</Eq>
      <P>
        With slabs and a notch there is no single t, so each household tries every slab's own optimum{" "}
        <M>{r`y_0\,(1 - r_j(1+c))^{e}`}</M> plus 57 evenly spaced points from 30% to 100% of <M>{"y_0"}</M>, and keeps the one
        with the highest <M>{r`z - T(z) - v(z)`}</M>. This is what produces bunching below the ₹12 lakh notch. Households who
        perceive only their average rate <M>{r`\bar t = T(y_0)/y_0`}</M> choose <M>{r`z = y_0(1-\bar t)^{e}`}</M> instead.
      </P>
      <Text fw={600} mb={4}>(ii) Reporting: the evasion gamble</Text>
      <P>
        Following <Cite id="allingham1972">Allingham and Sandmo (1972)</Cite>, evasion is a gamble on not being audited. Only
        the evadable share κ of the base can be hidden: income reported by employers and banks cannot{" "}
        (<Cite id="kleven2011">Kleven et al. 2011</Cite>; <Cite id="slemrod2007">Slemrod 2007</Cite>). The household tries
        reporting r = 0%, 10%, …, 100% of that part:
      </P>
      <Eq>{r`\text{reported base} = \text{base}\,\big(1 - \kappa(1-r)\big), \qquad E(r) = T(\text{full report}) - T(r)`}</Eq>
      <Eq>{r`\max_r\ (1-\hat p)\,U(c_{\text{free}}) + \hat p\,U\big(c_{\text{free}} - (1+\theta)E\big), \quad c_{\text{free}} = z - T(r) - \mu E(r), \quad U(c) = \frac{c^{1-\gamma}-1}{1-\gamma}`}</Eq>
      <P>
        Consumption is per person and scaled by per-person income, so γ is relative risk aversion (U = ln c at γ = 1). μ is
        tax morale, a guilt cost per rupee evaded (<Cite id="luttmer2014">Luttmer and Singhal 2014</Cite>). A risk-neutral
        household hides everything when <M>{r`\hat p(1+\theta) + \mu < 1`}</M>; risk aversion makes the choice gradual. The
        model is known to over-predict evasion at realistic audit rates, which is why morale and audit beliefs are explicit
        parameters.
      </P>
      <Text fw={600} mb={4}>(iii) Sector: formal or informal</Text>
      <P>
        Only mobile households choose. Moving out of the current sector loses a share π of income, so <M>{r`y_F`}</M> and{" "}
        <M>{r`y_I`}</M> are <M>{"y_0"}</M> in the current sector and <M>{r`y_0(1-\pi)`}</M> in the other. B is the value of
        the transfers the household believes it would get:
      </P>
      <Eq>{r`U_F = z - T - \big[\hat p(1+\theta) + \mu\big]E - v(z) + B(\text{reported income}), \qquad U_I = y_I - v(y_I) + B(0)`}</Eq>
      <P>
        The household is formal if <M>{r`U_F \ge U_I`}</M>. Informal households pay no income tax and report zero income, which
        can make them eligible for means-tested schemes.
      </P>

      <H3>Step D3. Audit equilibrium (when audit capacity A is set)</H3>
      <P>
        The audit probability depends on how many evade, and evasion depends on the audit probability. The engine iterates,
        re-running D1 and D2 each time, until p changes by less than 0.0001 (at most 30 rounds). The result is a Nash
        equilibrium among evaders: given everyone else's choice, nobody wants to change theirs.
      </P>
      <Eq>{r`p_{\text{target}} = \min\!\left(1,\ \frac{A}{\sum_i w_i\,\mathbb{1}[\text{formal}_i \wedge r_i < 1]}\right), \qquad p \leftarrow \tfrac12\,p + \tfrac12\,p_{\text{target}}`}</Eq>

      <H3>Step D4. Settlement with the true rules</H3>
      <DocTable
        head={["Quantity", "Formula"]}
        rows={[
          ["Income tax paid", "T(reported base) for formal households, else 0; rebate and deductions only if the household claims them"],
          ["Tax evaded E", "T(full report) − T(reported)"],
          ["Penalty (expected value)", <M key="pen">{r`p\,(1+\theta)\,E`}</M>],
          ["Reported income", "Reported base + agricultural income (formal), else 0"],
          ["Wealth tax", <M key="wt">{r`\tau_W \max(W(1-\omega) - W^{*},\ 0)`}</M>],
          ["Transfers", "Each scheme's amount if it is received; cost = received ÷ (1 − ℓ); claimants pay the claiming cost"],
          [<b key="d">Disposable income</b>, "z − income tax − penalty − wealth tax + transfers − claiming costs + L"],
          ["Consumption", "APC × max(disposable, 0)"],
          ["GST", "γ × consumption"],
          [<b key="u">Utility (money-metric welfare)</b>, "disposable − GST − v(z)"],
        ]}
      />
      <P>
        The penalty is charged as its expected value rather than by random audits, so results don't jump around with audit
        luck. Settlement also computes what each household would owe if fully aware and if it reported everything; the
        differences give the "extra tax from unawareness" and the tax gap.
      </P>

      <H3>Step E. Learning over periods (M3 only)</H3>
      <P>
        M3 repeats step D in M2 for T periods. After each period, in every set s, unaware households become aware with a
        probability that rises with the share of their group already aware, a Bass-style diffusion (<Cite id="bass1969">Bass 1969</Cite>),
        plus the policy's outreach o; audit beliefs move 30% of the way toward the true rate:
      </P>
      <Eq>{r`\Pr(\text{unaware} \to \text{aware}) = \min\big(1,\ \lambda_s\,\bar a_s + o\big), \qquad \hat p \leftarrow \hat p + 0.3\,(p - \hat p)`}</Eq>

      <H3>Steps F to I. Summarise, compare, rerun, save</H3>
      <List mb="md" spacing={4}>
        <List.Item><b>F.</b> The settled table becomes the measures of section 6, overall, per set and per income band.</List.Item>
        <List.Item><b>G.</b> Each policy is compared with the baseline: gain per person = (utility under the policy − utility under the baseline) ÷ household size; the share better and worse off (by more than ₹1 a year); each set's gain; and whether any set or household loses.</List.Item>
        <List.Item><b>H.</b> In M2 and M3 the same policy is rerun in M1 with the same lump sum; the difference is the measured cost of the information gap.</List.Item>
        <List.Item><b>I.</b> The run (request, seed, every result, timing) is saved as one JSON file in <Src>workspace/runs/</Src>, so it can be reopened and reproduced exactly.</List.Item>
      </List>
    </Section>
  );
}

export function AnalyticsSection() {
  return (
    <Section
      id="analytics"
      title="6 · The analytics"
      lead="Every number on the results screen is a weighted sum over the settled household table."
    >
      <AnalyticsDiagram />
      <P>
        Code: <Src>analytics.py</Src>. Notation: <M>{"w_i"}</M> = real households a row stands for, <M>{"n_i"}</M> =
        household size, so persons = <M>{"w_i n_i"}</M>. Income measures are per person and weighted by persons.
      </P>
      <H3>Revenue</H3>
      <DocTable
        head={["Measure", "Formula"]}
        rows={[
          ["Gross revenue", "Σ w (income tax + penalties + GST + wealth tax)"],
          ["Transfer spending", "Σ w × cost (includes leakage)"],
          ["Leakage", "Transfer spending − Σ w × amount received"],
          [<b key="n">Net revenue</b>, "Gross − transfer spending − Σ w L"],
          ["Income-tax payers", "Σ w × earners × 1[income tax > 0]"],
        ]}
      />
      <H3>Equality (disposable income per person)</H3>
      <P>
        <b>Gini.</b> Sort people by income; <M>{"p_k"}</M> is the cumulative population share and <M>{"L_k"}</M> the
        cumulative income share (the Lorenz curve). The Gini is one minus twice the area under it; ranking one variable by
        another (taxes ranked by income) gives a concentration index instead.
      </P>
      <Eq>{r`G = 1 - \sum_k (p_k - p_{k-1})(L_k + L_{k-1})`}</Eq>
      <P>
        <b>Theil, split by set</b> (<Cite id="theil1967">Theil 1967</Cite>). With mean μ and income share <M>{"s_g"}</M> of
        set g, "between" measures inequality <i>across</i> your groups and "within" inequality <i>inside</i> them:
      </P>
      <Eq>{r`T = \frac{1}{N}\sum_i \frac{x_i}{\mu}\ln\frac{x_i}{\mu}, \qquad T_{\text{within}} = \sum_g s_g T_g, \qquad T_{\text{between}} = T - T_{\text{within}}`}</Eq>
      <P>
        <b>Atkinson and EDE</b> (<Cite id="atkinson1970">Atkinson 1970</Cite>). The equally-distributed equivalent is the
        equal income per person that society, with inequality aversion ε, values as much as the actual incomes:
      </P>
      <Eq>{r`\text{EDE} = \Big(\tfrac{1}{N}\textstyle\sum_i x_i^{\,1-\varepsilon}\Big)^{\frac{1}{1-\varepsilon}} \quad \big(\varepsilon = 1:\ \text{EDE} = e^{\,\text{mean}\,\ln x}\big), \qquad A = 1 - \frac{\text{EDE}}{\mu}`}</Eq>
      <P>
        <b>Shares, Palma, poverty.</b> Top 1% share = 1 − L(0.99); top 10% = 1 − L(0.90); bottom 50% = L(0.50); Palma = top
        10% ÷ bottom 40% (<Cite id="palma2011">Palma 2011</Cite>). Poverty headcount = share of people below the poverty line{" "}
        <M>{"z_p"}</M>; poverty gap = average of <M>{r`\max(z_p - x,\ 0)/z_p`}</M>.
      </P>
      <H3>Equity</H3>
      <DocTable
        head={["Measure", "Formula", "Read as"]}
        rows={[
          [<Cite key="k" id="kakwani1977">Kakwani</Cite>, "Concentration index of taxes − Gini of pre-tax income (taxes = income tax + penalties + GST + wealth tax, ranked by pre-tax income)", "Positive: taxes fall more on the rich than income does (progressive)"],
          [<Cite key="rs" id="reynolds1977">Reynolds–Smolensky</Cite>, "Gini before tax − Gini of disposable income", "How much the whole system reduces inequality"],
          ["Average net tax rate", "Σ w (taxes − transfers − L) ÷ Σ w z", "The overall take, net of transfers"],
        ]}
      />
      <H3>Efficiency</H3>
      <Eq>{r`\text{Output loss} = 1 - \frac{\sum_i w_i z_i}{\sum_i w_i y_{0i}}, \qquad \text{Excess burden} = \sum_i w_i\big[(y_{0i} - v(y_{0i})) - u_i\big] - \text{net revenue}`}</Eq>
      <P>
        Output loss is how much less people earn than they would with no taxes. The excess burden is the deadweight loss:
        everything households lose compared with no taxes, minus what the government actually collects. A pure transfer of
        money would give zero; behaviour changes, leakage and claiming costs make it positive.
      </P>
      <H3>Welfare, compliance and the information gap</H3>
      <DocTable
        head={["Measure", "Formula"]}
        rows={[
          [<b key="ede">EDE utility per person</b>, "EDE of utility per person, with the run's ε (the headline welfare number)"],
          ["Mean utility, mean disposable income", "Person-weighted averages"],
          ["Formal share", "Share of people in formal households"],
          ["Under-reporting", "Share of formal households reporting less than everything"],
          ["Tax gap", "Σ w E ÷ Σ w T(full report)"],
          ["Benefit capture", "Σ w min(received, entitled) ÷ Σ w entitled"],
          ["Unclaimed benefits", "Σ w (entitled − received by the entitled)"],
          ["Extra tax from unawareness", "Σ w [T(full report, own awareness) − T(full report, fully aware)]"],
        ]}
      />
      <P>
        Breakdowns: every measure per set; net tax by income band (P0–10 … P90–99, P99–100) as a share of pre-tax income;
        Lorenz curves; per-scheme beneficiaries, spending and capture; the comparison with the baseline; and in M3 a
        period-by-period history.
      </P>
    </Section>
  );
}

export function TheorySection() {
  return (
    <Section
      id="theory"
      title="7 · Theory baselines"
      lead="Two buttons compute a textbook optimal policy for the loaded economy, under the textbook's own assumptions, and save it as a normal policy you can run in any mode."
    >
      <P>
        Code: <Src>theory.py</Src>. The problem goes back to <Cite id="mirrlees1971">Mirrlees (1971)</Cite>: a government that
        sees earnings but not ability trades redistribution (equity) against the disincentive to earn (efficiency).
      </P>
      <H3>The optimal flat tax with a universal grant</H3>
      <P>
        <Cite id="piketty2013">Piketty and Saez (2013, eq. 3)</Cite>. (1 − ḡ) is the equity gain from redistributing; e is the
        efficiency cost, the deadweight loss of a higher rate:
      </P>
      <Eq>{r`\tau^{*} = \frac{1-\bar g}{1-\bar g+e}, \qquad \bar g = \frac{\sum_i w_i g_i z_i}{\sum_i w_i g_i \cdot \bar z}, \qquad g_i = u_i^{-\varepsilon}`}</Eq>
      <List type="ordered" mb="md" spacing={4}>
        <List.Item>Start with τ = 30%.</List.Item>
        <List.Item>Each household earns <M>{r`z_i = y_{0i}(1-\tau)^{e_i}`}</M>; the grant is τ × average z; utility per person is <M>{r`u_i = [(1-\tau)z_i + \text{grant} - v(z_i)]/n_i`}</M>.</List.Item>
        <List.Item>Welfare weights <M>{r`g_i = u_i^{-\varepsilon}`}</M>: with ε = 1, a rupee to someone twice as poor counts twice as much.</List.Item>
        <List.Item>ḡ = income-weighted average weight; e = income-weighted average ETI.</List.Item>
        <List.Item>Compute the new τ, move halfway toward it, and repeat until τ changes by less than 10⁻⁷.</List.Item>
      </List>
      <P>The saved policy has one slab at τ on all income, no GST, and a universal grant of τ × average income per household with no claim needed.</P>
      <H3>The Saez top rate</H3>
      <P>
        <Cite id="saez2001">Saez (2001)</Cite> derives the top rate from compensated and uncompensated elasticities; with one
        elasticity it takes the form in <Cite id="piketty2013">Piketty and Saez (2013, eq. 7)</Cite> and{" "}
        <Cite id="diamond2011">Diamond and Saez (2011)</Cite>. It replaces only the top slab of an existing policy:
      </P>
      <Eq>{r`\tau_{\text{top}} = \frac{1-g}{1-g+a\,e}, \qquad a = \frac{z_m}{z_m - \bar z}`}</Eq>
      <List type="ordered" mb="md" spacing={4}>
        <List.Item>Take every sampled earner with income per earner above the top threshold z̄ (at least 5 are needed).</List.Item>
        <List.Item><b>a</b>: with <M>{"z_m"}</M> their average income, a = <M>{r`z_m/(z_m - \bar z)`}</M>, the Pareto parameter of the tail.</List.Item>
        <List.Item><b>e</b>: their income-weighted average ETI.</List.Item>
        <List.Item><b>g</b>: their average welfare weight relative to the whole population's.</List.Item>
        <List.Item>The formula gives the total rate including cess, so the slab rate is <M>{r`\tau_{\text{top}}/(1+c)`}</M>, capped at 95%.</List.Item>
      </List>
      <P>
        With g ≈ 0 this is the revenue-maximising rate 1/(1 + a e). Running these policies through modes M1–M3 shows what
        informality, evasion and information gaps do to theory's best answer.
      </P>
    </Section>
  );
}

export function ReadingSection() {
  return (
    <Section
      id="reading"
      title="Reading the results"
      lead="Read a result in a fixed order: the setup, the headline welfare change, how it was paid for, who lost, and only then why."
    >
      <DocTable
        head={["Part of the screen", "Shows", "How to read it"]}
        rows={[
          ["Header strip", "Baseline, number of policies, equal revenue or not, ε, households → people represented, run time", "Check first: mode and equal revenue change every number below"],
          ["Card per policy", "Welfare (% change in EDE), change in Gini, % better and worse off, sets that lose, balancing lump sum", "The headline; the lump sum says how the comparison was made fair"],
          ["Scoreboard", "Every measure of section 6, one column per policy, with the change from the baseline", "Green = the good direction for that measure, red = the bad one: a direction, not a verdict"],
          ["Population sets", "Each set's gain or loss per person, % better and worse off", "Who wins and who pays"],
          ["Distribution", "Lorenz curves and net tax by income band", "Where in the income scale the policy bites"],
          ["Information gap (M2, M3)", "Actual result vs the full-information rerun", "The cost of people not knowing the rules"],
          ["Over time (M3)", "Revenue, Gini, capture, evasion and awareness by period", "How learning changes the result"],
          ["Transfers", "Beneficiaries, spending, amount received and capture for each scheme", "How well schemes reach people"],
        ]}
      />
      <H3>A worked example: the saved demo run</H3>
      <P>
        The demo run compares three reforms with the status quo in M3 (6 periods) at equal revenue, ε = 1. It was made with
        the bundled policies on the illustrative economy.
      </P>
      <DocTable
        head={["Policy", "Welfare", "Gini", "Better / worse off", "Sets that lose", "Lump sum per household"]}
        rows={[
          ["Old regime with deductions", "+4.34%", "−0.017", "93% / 7%", "3", "payment of ₹8,848"],
          ["Flat 15% + basic income", "+2.14%", "+0.002", "77% / 23%", "2", "charge of ₹2,019"],
          ["Auto-enrolment", "+0.74%", "−0.002", "33% / 67%", "7", "charge of ₹1,878"],
        ]}
      />
      <P>
        Reading the first row in words: the old regime raises welfare by 4.3% and lowers the Gini. It collects more income tax,
        and at equal revenue the surplus goes back as ₹8,848 to every household, which is why 93% of people gain. The three
        richest sets lose, so it is a trade-off between groups, not a Pareto improvement.
      </P>
      <H3>Checklist</H3>
      <List type="ordered" mb="md" spacing={4}>
        <List.Item><b>Check the setup line.</b> The same policy in M0 and in M2 can differ by half; say which mode you quote.</List.Item>
        <List.Item><b>Read welfare as EDE, not average income.</b> A policy can lower average utility and still raise EDE if it moves money to poorer people.</List.Item>
        <List.Item><b>State the lump sum.</b> At equal revenue, much of a reform's "gain" can be that equal payment.</List.Item>
        <List.Item><b>Look at who loses</b> before calling a policy good; zero losing sets is the Pareto check.</List.Item>
        <List.Item><b>Then explain why</b> with the scoreboard: revenue rows say where the money came from, efficiency rows how much was lost, compliance and information rows whether evasion or unawareness drove it.</List.Item>
        <List.Item><b>In M2, revenue can be higher than in M1.</b> Unclaimed benefits and rebates are savings for the government; the information-gap tab shows the cost falls on households.</List.Item>
        <List.Item><b>Compare policies within one run.</b> They share the same households, so their differences are precise; the revenue level varies by a few per cent between seeds because the top tail is hard to sample.</List.Item>
      </List>
    </Section>
  );
}

export function ReferencesSection() {
  return (
    <Section id="references" title="References" lead="Every source cited on this page. Bibliographic details were checked against Crossref, RePEc, publisher and library records.">
      <List type="ordered" spacing={6} mb="xl" size="sm">
        {REFERENCES.map((ref) => (
          <List.Item key={ref.id} id={`ref-${ref.id}`}>
            {ref.text}{" "}
            {ref.url && (
              <Anchor href={ref.url} target="_blank" rel="noreferrer" size="sm">
                {ref.url.replace("https://", "")}
              </Anchor>
            )}
          </List.Item>
        ))}
      </List>
      <Text size="sm" c="dimmed">
        Related tools: EUROMOD (<Cite id="sutherland2013">Sutherland and Figari 2013</Cite>) and TAXSIM (
        <Cite id="feenberg1993">Feenberg and Coutts 1993</Cite>) compute taxes on national microdata, mostly without behaviour;
        the AI Economist (<Cite id="zheng2022">Zheng et al. 2022</Cite>) designs taxes with reinforcement learning in a small
        simulated economy.
      </Text>
    </Section>
  );
}
