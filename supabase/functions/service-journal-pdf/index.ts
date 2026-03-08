import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsPDF } from "npm:jspdf@2.5.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { journal_id } = await req.json();
    if (!journal_id) return new Response(JSON.stringify({ error: "journal_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate user
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get journal
    const { data: journal, error: jErr } = await supabase.from("service_journals").select("*").eq("id", journal_id).single();
    if (jErr || !journal) return new Response(JSON.stringify({ error: "Journal not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Get project + company
    const [projectRes, companyRes] = await Promise.all([
      supabase.from("events").select("title, internal_number, address, customers:customer_id(name)").eq("id", journal.project_id).single(),
      supabase.from("company_settings").select("*").limit(1).single(),
    ]);

    // Get schedule blocks for work sessions
    const { data: blocks } = await supabase
      .from("schedule_blocks")
      .select("id, start_at, end_at, title, technicians!inner(name)")
      .eq("project_id", journal.project_id)
      .is("deleted_at", null)
      .order("start_at", { ascending: true })
      .limit(100);

    // Get deviations
    const { data: deviations } = await supabase
      .from("job_tasks")
      .select("id, title, status, created_at, priority")
      .eq("job_id", journal.project_id)
      .eq("category", "avvik")
      .order("created_at", { ascending: false })
      .limit(20);

    const project = projectRes.data;
    const company = companyRes.data;
    const content = journal.content as any || {};
    const sections = journal.section_visibility as any || {};
    const signatures = journal.signatures as any || {};

    const customerName = Array.isArray(project?.customers)
      ? project.customers[0]?.name
      : (project?.customers as any)?.name || "";

    const companyName = company?.company_name || "";
    const primaryColor = company?.primary_color || "#3b9b72";

    const hexToRgb = (hex: string) => {
      const h = hex.replace("#", "");
      return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)] as [number, number, number];
    };
    const brandRgb = hexToRgb(primaryColor);

    const formatDate = (d: Date) => `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;
    const formatTime = (d: Date) => `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;

    // ── LOGO ──
    let logoImageData: string | null = null;
    if (company?.logo_url) {
      try {
        const logoRes = await fetch(company.logo_url);
        if (logoRes.ok) {
          const logoBuffer = await logoRes.arrayBuffer();
          const logoBytes = new Uint8Array(logoBuffer);
          const base64 = btoa(String.fromCharCode(...logoBytes));
          const ext = company.logo_url.toLowerCase().includes(".png") ? "PNG" : "JPEG";
          logoImageData = `data:image/${ext.toLowerCase()};base64,${base64}`;
        }
      } catch (e) { console.warn("Logo load failed:", e); }
    }

    // ── BUILD PDF ──
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const mL = 20, mR = 20;
    const cW = pageW - mL - mR;
    let y = 20;

    const checkPage = (needed: number) => {
      if (y + needed > pageH - 25) { doc.addPage(); y = 20; }
    };

    const addSectionTitle = (title: string) => {
      checkPage(15);
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...brandRgb);
      doc.text(title, mL, y);
      y += 2;
      doc.setDrawColor(...brandRgb);
      doc.setLineWidth(0.3);
      doc.line(mL, y, pageW - mR, y);
      y += 6;
      doc.setTextColor(31, 41, 55);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
    };

    const addText = (text: string, maxWidth?: number) => {
      const lines = doc.splitTextToSize(text, maxWidth || cW);
      for (const line of lines) {
        checkPage(5);
        doc.text(line, mL, y);
        y += 5;
      }
    };

    const addLabel = (label: string, value: string, xOffset = 0) => {
      checkPage(10);
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(label.toUpperCase(), mL + xOffset, y);
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(31, 41, 55);
      doc.text(value || "—", mL + xOffset, y);
      y += 6;
    };

    // ═══ HEADER ═══
    let headerX = mL;
    if (logoImageData) {
      try {
        doc.addImage(logoImageData, logoImageData.includes("png") ? "PNG" : "JPEG", mL, y - 4, 30, 12);
        headerX = mL + 35;
      } catch { /* ignore */ }
    }

    // Status badge
    const statusLabels: Record<string, string> = { draft: "Utkast", review: "Til gjennomgang", approved: "Godkjent", sent: "Sendt" };
    doc.setFontSize(8);
    doc.setTextColor(107, 114, 128);
    doc.text(statusLabels[journal.status] || journal.status, pageW - mR, y, { align: "right" });
    y += 6;

    // Report type
    doc.setFontSize(9);
    doc.setTextColor(107, 114, 128);
    doc.text(journal.report_type === "arbeidsrapport" ? "ARBEIDSRAPPORT" : "SERVICEJOURNAL", mL, y);
    y += 5;

    // Project title
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55);
    const titleLines = doc.splitTextToSize(project?.title || "Ukjent prosjekt", cW);
    for (const tl of titleLines) {
      doc.text(tl, mL, y);
      y += 8;
    }
    doc.setFont("helvetica", "normal");
    y += 2;

    // Meta grid
    const metaItems = [
      { l: "Kunde", v: customerName },
      { l: "Adresse", v: project?.address || "" },
      { l: "Prosjektnr.", v: project?.internal_number || "" },
      { l: "Dato", v: formatDate(new Date()) },
      { l: "Versjon", v: `v${journal.version}` },
    ].filter(m => m.v);

    const colW = cW / 3;
    for (let i = 0; i < metaItems.length; i++) {
      const col = i % 3;
      const x = mL + col * colW;
      if (col === 0 && i > 0) y += 1;
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(metaItems[i].l.toUpperCase(), x, y);
      doc.setFontSize(9);
      doc.setTextColor(31, 41, 55);
      doc.text(metaItems[i].v, x, y + 4);
      if (col === 2 || i === metaItems.length - 1) y += 10;
    }

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(mL, y, pageW - mR, y);
    y += 8;

    // ═══ STATS BOX ═══
    const completedBlocks = (blocks || []).filter((b: any) => new Date(b.end_at) < new Date());
    const totalMin = (blocks || []).reduce((s: number, b: any) => s + Math.round((new Date(b.end_at).getTime() - new Date(b.start_at).getTime()) / 60000), 0);
    const uniqueTechs = new Set((blocks || []).map((b: any) => b.technicians?.name).filter(Boolean));

    const stats = [
      { l: "Timer", v: (totalMin / 60).toFixed(1) },
      { l: "Montører", v: String(uniqueTechs.size) },
      { l: "Avvik", v: String((deviations || []).length) },
    ];

    doc.setFillColor(249, 250, 251);
    doc.roundedRect(mL, y - 2, cW, 14, 2, 2, "F");
    stats.forEach((s, i) => {
      const sx = mL + 8 + i * (cW / 3);
      doc.setFontSize(7);
      doc.setTextColor(107, 114, 128);
      doc.text(s.l.toUpperCase(), sx, y + 3);
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text(s.v, sx, y + 10);
      doc.setFont("helvetica", "normal");
    });
    y += 18;

    // ═══ SECTIONS ═══

    // 1. Oppdrag
    if (sections.oppdrag !== false && content.summaryText) {
      addSectionTitle("Oppdrag");
      addText(content.summaryText);
      y += 4;
    }

    // 2. Utført arbeid
    if (sections.utfort !== false && content.workDescription) {
      addSectionTitle("Utført arbeid");
      addText(content.workDescription);
      y += 4;
    }

    // 3. Arbeidsøkter
    if (sections.arbeidsokter !== false && completedBlocks.length > 0) {
      addSectionTitle(`Arbeidsøkter (${completedBlocks.length})`);
      for (const block of completedBlocks) {
        checkPage(10);
        const s = new Date((block as any).start_at);
        const e = new Date((block as any).end_at);
        const dur = Math.round((e.getTime() - s.getTime()) / 60000);
        const durLabel = dur >= 60 ? `${Math.floor(dur / 60)}t ${dur % 60}m` : `${dur}m`;
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.text(formatDate(s), mL, y);
        doc.setFont("helvetica", "normal");
        doc.text(`${formatTime(s)} – ${formatTime(e)} (${durLabel})`, mL + 25, y);
        doc.setTextColor(107, 114, 128);
        doc.text((block as any).technicians?.name || "", mL + 70, y);
        doc.setTextColor(31, 41, 55);
        y += 6;
      }
      y += 4;
    }

    // 4. Merknader / avvik
    if (sections.merknader !== false) {
      const devs = deviations || [];
      const comment = content.customerComment;
      if (devs.length > 0 || comment) {
        addSectionTitle("Merknader");
        for (const dev of devs) {
          checkPage(8);
          doc.setFontSize(9);
          doc.text(`• ${(dev as any).title}`, mL, y);
          const statusLabel = (dev as any).status === "completed" ? "Lukket" : "Åpen";
          doc.setTextColor(107, 114, 128);
          doc.text(statusLabel, pageW - mR, y, { align: "right" });
          doc.setTextColor(31, 41, 55);
          y += 6;
        }
        if (comment) {
          y += 2;
          addText(comment);
        }
        y += 4;
      }
    }

    // 5. Signatur
    if (sections.signatur !== false) {
      addSectionTitle("Signatur");
      const sigY = y;
      const halfW = cW / 2 - 5;

      // Responsible
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text((signatures.responsibleRole || "Ansvarlig montør").toUpperCase(), mL, sigY);

      if (signatures.responsible) {
        try {
          doc.addImage(signatures.responsible, "PNG", mL, sigY + 2, halfW * 0.7, 18);
        } catch { /* ignore */ }
      }
      doc.setDrawColor(209, 213, 219);
      doc.line(mL, sigY + 22, mL + halfW, sigY + 22);
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(formatDate(new Date()), mL, sigY + 27);

      // Customer
      const cx = mL + halfW + 10;
      doc.text((signatures.customerRole || "Kunde").toUpperCase(), cx, sigY);
      if (signatures.customer) {
        try {
          doc.addImage(signatures.customer, "PNG", cx, sigY + 2, halfW * 0.7, 18);
        } catch { /* ignore */ }
      }
      doc.line(cx, sigY + 22, cx + halfW, sigY + 22);
      doc.text(formatDate(new Date()), cx, sigY + 27);

      y = sigY + 32;
    }

    // ═══ FOOTER on all pages ═══
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p);
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      const fY = pageH - 10;
      doc.setDrawColor(229, 231, 235);
      doc.line(mL, fY - 3, pageW - mR, fY - 3);
      const parts = [companyName, company?.org_number ? `Org: ${company.org_number}` : ""].filter(Boolean);
      doc.text(parts.join(" • "), mL, fY);
      doc.text(`Side ${p} av ${totalPages}`, pageW - mR, fY, { align: "right" });
    }

    // ── Save to storage ──
    const pdfBytes = doc.output("arraybuffer");
    const fileName = `service-journal-${journal.project_id.slice(0, 8)}-v${journal.version}.pdf`;
    const storagePath = `service-journals/${journal.project_id}/${fileName}`;

    const { error: uploadErr } = await supabase.storage
      .from("job-attachments")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage.from("job-attachments").getPublicUrl(storagePath);

    // Update journal with PDF path
    await supabase.from("service_journals").update({ pdf_storage_path: storagePath }).eq("id", journal_id);

    // Log in activity_log
    await supabase.from("activity_log").insert({
      entity_id: journal.project_id,
      entity_type: "job",
      action: "service_journal_pdf_generated",
      type: "note",
      title: `Servicejournal PDF generert (v${journal.version})`,
      description: `PDF generert for ${project?.title || "prosjekt"}`,
      performed_by: user.id,
    });

    return new Response(JSON.stringify({
      success: true,
      pdf_url: urlData.publicUrl,
      storage_path: storagePath,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("service-journal-pdf error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
