// Worktime AML evaluator
// POST { user_ids?: string[], company_id: string, batch_id?: string }
// Iterates entries the last 365 days per user, computes 24h/week/8w-avg/OT/rest checks,
// upserts open alerts and resolves stale ones.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

interface Entry {
  id: string;
  user_id: string;
  work_date: string;
  start_at: string | null;
  end_at: string | null;
  hours: number;
  hours_overtime: number;
  total_hours: number;
  ordinary_hours: number;
  approved_by: string | null;
  source_system: string | null;
}

interface RuleSet {
  max_hours_per_day: number;
  warn_hours_per_day: number;
  max_hours_per_week: number;
  warn_hours_per_week: number;
  max_avg_hours_week_8w?: number;
  max_overtime_7d: number;
  warn_overtime_7d: number;
  max_overtime_4w: number;
  warn_overtime_4w: number;
  max_overtime_52w: number;
  warn_overtime_52w: number;
  min_rest_hours: number;
  overtime_requires_approval?: boolean;
  warning_threshold_percent?: number;
}

const DEFAULT_RULES: RuleSet = {
  max_hours_per_day: 13,
  warn_hours_per_day: 10,
  max_hours_per_week: 48,
  warn_hours_per_week: 48,
  max_avg_hours_week_8w: 48,
  max_overtime_7d: 13,
  warn_overtime_7d: 10,
  max_overtime_4w: 30,
  warn_overtime_4w: 25,
  max_overtime_52w: 240,
  warn_overtime_52w: 200,
  min_rest_hours: 11,
  overtime_requires_approval: true,
  warning_threshold_percent: 80,
};

function isoWeekStart(d: Date): string {
  const dt = new Date(d);
  const day = (dt.getUTCDay() + 6) % 7; // monday=0
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}
function addDays(d: string, n: number): string {
  const dt = new Date(d + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

interface Alert {
  user_id: string;
  rule_key: string;
  severity: "info" | "warning" | "critical";
  period_start: string;
  period_end: string;
  value: number;
  threshold: number;
  title: string;
  explanation: string;
  possible_company_consequence: string;
  recommended_action: string;
}

function evaluateUser(entries: Entry[], rules: RuleSet, requireApproval: boolean): Alert[] {
  const alerts: Alert[] = [];
  if (entries.length === 0) return alerts;

  const userId = entries[0].user_id;
  const warnPct = (rules.warning_threshold_percent ?? 80) / 100;

  // 24h checks per day
  const byDay: Record<string, Entry[]> = {};
  for (const e of entries) (byDay[e.work_date] ??= []).push(e);

  for (const [day, list] of Object.entries(byDay)) {
    const total = list.reduce((s, e) => s + (e.total_hours || e.hours || 0), 0);
    const hasTimes = list.some((e) => e.start_at && e.end_at);
    const isCritical = total > rules.max_hours_per_day;
    const sources = Array.from(new Set(list.map((e) => e.source_system).filter(Boolean)));
    const sourceLabel = sources.includes("tripletex_monthly")
      ? "Tripletex månedsoversikt"
      : sources.join(", ") || "ukjent";
    const noteNoTimes = hasTimes
      ? ""
      : ` Importfilen (${sourceLabel}) mangler start- og sluttid, så eksakt 24-timersvurdering kan ikke kontrolleres. Kontrolltype: dato-basert.`;
    if (total > rules.max_hours_per_day) {
      alerts.push({
        user_id: userId,
        rule_key: "max_hours_24h",
        severity: "critical",
        period_start: day,
        period_end: day,
        value: total,
        threshold: rules.max_hours_per_day,
        title: hasTimes
          ? `Over ${rules.max_hours_per_day}t arbeidstid på 24t (${day})`
          : `Over ${rules.max_hours_per_day}t registrert arbeidstid på dato (${day})`,
        explanation: hasTimes
          ? `Samlet arbeidstid ${total.toFixed(1)}t overstiger AML-grensen på ${rules.max_hours_per_day}t per døgn.`
          : `Det er registrert ${total.toFixed(1)}t arbeidstid på samme dato (grense ${rules.max_hours_per_day}t).${noteNoTimes}`,
        possible_company_consequence: "Brudd på AML §10-5. Kan utløse sanksjon ved tilsyn.",
        recommended_action: "Kontroller at registreringen er korrekt og dokumenter årsak til avvik.",
      });
    } else if (!isCritical && total >= rules.max_hours_per_day * warnPct) {
      alerts.push({
        user_id: userId,
        rule_key: "approaching_24h",
        severity: "warning",
        period_start: day,
        period_end: day,
        value: total,
        threshold: rules.max_hours_per_day,
        title: hasTimes
          ? `Nærmer seg dagsgrense (${day})`
          : `Nærmer seg dagsgrense på dato (${day})`,
        explanation: `Ansatt har ${total.toFixed(1)}t arbeid – nærmer seg ${rules.max_hours_per_day}t.${noteNoTimes}`,
        possible_company_consequence: "Risiko for brudd ved videre arbeid samme døgn.",
        recommended_action: "Unngå ytterligere overtid i dag.",
      });
    }
  }

  // Weekly + 8-week rolling
  const byWeek: Record<string, number> = {};
  for (const e of entries) {
    const ws = isoWeekStart(new Date(e.work_date + "T00:00:00Z"));
    byWeek[ws] = (byWeek[ws] ?? 0) + (e.total_hours || e.hours || 0);
  }
  const sortedWeeks = Object.keys(byWeek).sort();
  for (const ws of sortedWeeks) {
    const wTotal = byWeek[ws];
    const we = addDays(ws, 6);
    if (wTotal > rules.warn_hours_per_week) {
      alerts.push({
        user_id: userId,
        rule_key: "week_over_48",
        severity: "warning",
        period_start: ws,
        period_end: we,
        value: wTotal,
        threshold: rules.max_hours_per_week,
        title: `Uke over 48t arbeidstid`,
        explanation: `Samlet arbeidstid ${wTotal.toFixed(1)}t denne uken. Dette kan være tillatt ved gjennomsnittsberegning, men må kontrolleres mot 8-ukers snitt og avtalegrunnlag.`,
        possible_company_consequence: "Mulig AML-brudd dersom 8-ukers snitt > 48t eller mangler avtale.",
        recommended_action: "Vurder å unngå mer overtid kommende uke, dokumenter årsak og fordel arbeid.",
      });
    }

    // 8-week rolling avg ending at this week
    const idx = sortedWeeks.indexOf(ws);
    if (idx >= 7) {
      const slice = sortedWeeks.slice(idx - 7, idx + 1);
      const avg = slice.reduce((s, k) => s + byWeek[k], 0) / 8;
      const limit = rules.max_avg_hours_week_8w ?? 48;
      if (avg > limit) {
        alerts.push({
          user_id: userId,
          rule_key: "avg_8w_over_48",
          severity: "critical",
          period_start: slice[0],
          period_end: we,
          value: avg,
          threshold: limit,
          title: `8-ukers snitt over ${limit}t/uke`,
          explanation: `Gjennomsnittlig arbeidstid siste 8 uker er ${avg.toFixed(1)}t/uke – over AML-grensen på ${limit}t/uke selv ved gjennomsnittsberegning.`,
          possible_company_consequence: "Brudd på AML §10-5. Krever umiddelbar oppfølging.",
          recommended_action: "Reduser arbeidstid de neste ukene og dokumenter tiltak.",
        });
      }
    }
  }

  // Overtime windows
  const today = new Date();
  function otSum(daysBack: number): { sum: number; from: string; to: string } {
    const to = today.toISOString().slice(0, 10);
    const from = addDays(to, -daysBack);
    const sum = entries
      .filter((e) => e.work_date >= from && e.work_date <= to)
      .reduce((s, e) => s + (e.hours_overtime || 0), 0);
    return { sum, from, to };
  }
  const ot7 = otSum(7);
  const ot28 = otSum(28);
  const ot365 = otSum(365);

  for (const [key, ot, max, warn, label] of [
    ["ot_7d", ot7, rules.max_overtime_7d, rules.warn_overtime_7d, "siste 7 dager"],
    ["ot_4w", ot28, rules.max_overtime_4w, rules.warn_overtime_4w, "siste 4 uker"],
    ["ot_52w", ot365, rules.max_overtime_52w, rules.warn_overtime_52w, "siste 52 uker"],
  ] as const) {
    const sev: Alert["severity"] | null =
      ot.sum > max ? "critical" : ot.sum >= warn ? "warning" : null;
    if (sev) {
      alerts.push({
        user_id: userId,
        rule_key: key,
        severity: sev,
        period_start: ot.from,
        period_end: ot.to,
        value: ot.sum,
        threshold: max,
        title: `Overtid ${label}: ${ot.sum.toFixed(1)}t`,
        explanation: `Sum overtid ${ot.sum.toFixed(1)}t (${label}) – AML-grense ${max}t.`,
        possible_company_consequence:
          sev === "critical"
            ? "Brudd på AML §10-6. Tilsynsrisiko."
            : "Nærmer seg AML-grensen for overtid.",
        recommended_action: "Reduser overtid eller dokumenter særskilt grunn og avtale.",
      });
    }
  }

  // Rest time
  const sorted = [...entries].filter((e) => e.start_at && e.end_at).sort(
    (a, b) => (a.start_at! < b.start_at! ? -1 : 1)
  );
  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = new Date(sorted[i - 1].end_at!).getTime();
    const nextStart = new Date(sorted[i].start_at!).getTime();
    const restHrs = (nextStart - prevEnd) / 3600000;
    if (restHrs > 0 && restHrs < rules.min_rest_hours) {
      alerts.push({
        user_id: userId,
        rule_key: "rest_below_min",
        severity: restHrs < 8 ? "critical" : "warning",
        period_start: sorted[i - 1].work_date,
        period_end: sorted[i].work_date,
        value: restHrs,
        threshold: rules.min_rest_hours,
        title: `Hviletid ${restHrs.toFixed(1)}t under ${rules.min_rest_hours}t`,
        explanation: `Mellom slutt ${sorted[i - 1].end_at} og start ${sorted[i].start_at} er det kun ${restHrs.toFixed(1)}t hvile.`,
        possible_company_consequence: "Mulig brudd på AML §10-8 om døgnhvile.",
        recommended_action: "Forskyv neste arbeidsøkt eller dokumenter unntak.",
      });
    }
  }

  // OT without approval
  if (requireApproval) {
    const unapproved = entries.filter(
      (e) => (e.hours_overtime || 0) > 0 && !e.approved_by
    );
    if (unapproved.length > 0) {
      const total = unapproved.reduce((s, e) => s + e.hours_overtime, 0);
      alerts.push({
        user_id: userId,
        rule_key: "ot_no_approval",
        severity: "warning",
        period_start: unapproved[0].work_date,
        period_end: unapproved[unapproved.length - 1].work_date,
        value: total,
        threshold: 0,
        title: `${total.toFixed(1)}t overtid uten godkjenning`,
        explanation: `${unapproved.length} timeoppføringer med overtid mangler ledergodkjenning. Overtid fra import er registrert, men ikke automatisk sendt til godkjenning.`,
        possible_company_consequence: "Manglende sporbarhet kan svekke selskapets dokumentasjonskrav.",
        recommended_action: "Be leder godkjenne overtid med årsak.",
      });
    }
  }

  return alerts;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const body = await req.json().catch(() => ({}));
    const company_id: string = body.company_id;
    const batch_id: string | undefined = body.batch_id;
    if (!company_id) {
      return new Response(JSON.stringify({ error: "company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sinceDate = addDays(new Date().toISOString().slice(0, 10), -365);

    let userIds: string[] = body.user_ids ?? [];
    if (userIds.length === 0) {
      const { data: userRows } = await supabase
        .from("worktime_entries")
        .select("user_id")
        .eq("company_id", company_id)
        .gte("work_date", sinceDate)
        .not("user_id", "is", null);
      userIds = Array.from(new Set((userRows ?? []).map((r: any) => r.user_id)));
    }

    // Load default ruleset; auto-create if missing so the engine is never silently no-op
    let { data: rsRow } = await supabase
      .from("worktime_rulesets")
      .select("rules")
      .eq("company_id", company_id)
      .eq("is_default", true)
      .maybeSingle();
    if (!rsRow) {
      const { data: created } = await supabase
        .from("worktime_rulesets")
        .insert({
          company_id,
          name: "MCS standard AML",
          description: "Auto-opprettet standardregelsett for AML-evaluering.",
          is_default: true,
          rules: DEFAULT_RULES as any,
        })
        .select("rules")
        .maybeSingle();
      rsRow = created ?? { rules: DEFAULT_RULES as any };
    }
    const rules: RuleSet = { ...DEFAULT_RULES, ...((rsRow?.rules as any) ?? {}) };

    let totalAlerts = 0;
    let totalResolved = 0;

    for (const uid of userIds) {
      const { data: prof } = await supabase
        .from("employee_work_profiles")
        .select("overtime_requires_approval")
        .eq("company_id", company_id)
        .eq("user_id", uid)
        .maybeSingle();
      const requireApproval =
        prof?.overtime_requires_approval ?? rules.overtime_requires_approval ?? true;

      const { data: entries } = await supabase
        .from("worktime_entries")
        .select(
          "id,user_id,work_date,start_at,end_at,hours,hours_overtime,total_hours,ordinary_hours,approved_by,source_system"
        )
        .eq("company_id", company_id)
        .eq("user_id", uid)
        .gte("work_date", sinceDate)
        .neq("status", "voided")
        .order("work_date", { ascending: true });

      const computed = evaluateUser((entries ?? []) as Entry[], rules, requireApproval);

      // Upsert by (company_id, user_id, rule_key, period_start, period_end) where status open/ack
      const computedKeys = new Set<string>();
      for (const a of computed) {
        const key = `${a.user_id}|${a.rule_key}|${a.period_start}|${a.period_end}`;
        computedKeys.add(key);
        const { data: existing } = await supabase
          .from("worktime_alerts")
          .select("id, status")
          .eq("company_id", company_id)
          .eq("user_id", uid)
          .eq("rule_key", a.rule_key)
          .eq("period_start", a.period_start)
          .eq("period_end", a.period_end)
          .in("status", ["open", "acknowledged"])
          .maybeSingle();

        const payload = {
          company_id,
          user_id: a.user_id,
          rule_key: a.rule_key,
          severity: a.severity,
          period_start: a.period_start,
          period_end: a.period_end,
          value: a.value,
          threshold: a.threshold,
          why: a.explanation,
          consequence: a.possible_company_consequence,
          suggested_action: a.recommended_action,
          title: a.title,
          explanation: a.explanation,
          possible_company_consequence: a.possible_company_consequence,
          recommended_action: a.recommended_action,
          source_import_batch_id: batch_id ?? null,
          status: "open",
        };
        if (existing) {
          await supabase.from("worktime_alerts").update(payload).eq("id", existing.id);
        } else {
          await supabase.from("worktime_alerts").insert(payload);
          totalAlerts++;
        }
      }

      // Resolve stale alerts
      const { data: openOnes } = await supabase
        .from("worktime_alerts")
        .select("id, rule_key, period_start, period_end")
        .eq("company_id", company_id)
        .eq("user_id", uid)
        .in("status", ["open", "acknowledged"]);
      // Build supersede map: day -> true if a critical day-rule was computed
      const criticalDays = new Set(
        computed.filter((c) => c.rule_key === "max_hours_24h").map((c) => c.period_start)
      );
      for (const o of openOnes ?? []) {
        const key = `${uid}|${o.rule_key}|${o.period_start}|${o.period_end}`;
        if (!computedKeys.has(key)) {
          const superseded = o.rule_key === "approaching_24h" && criticalDays.has(o.period_start);
          await supabase
            .from("worktime_alerts")
            .update({
              status: "resolved",
              resolved_at: new Date().toISOString(),
              resolution_comment: superseded
                ? "Erstattet av mer alvorlig varsel for samme dato"
                : "Auto-løst: forhold ikke lenger til stede",
            })
            .eq("id", o.id);
          totalResolved++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        users_evaluated: userIds.length,
        new_alerts: totalAlerts,
        resolved_alerts: totalResolved,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("aml-evaluate error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
