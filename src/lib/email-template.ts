// Builds a styled HTML email for workflow notifications

interface QuoteEmailData {
  stepLabel: string;
  taskDescription: string | null;
  woNumber: string;
  companyName: string;
  projectName: string;
  quoteVersion: number;
  // Optional form summary sections
  sections?: { label: string; rows: { label: string; value: string }[] }[];
  ctaUrl: string;
  ctaLabel: string;
  /** Show a red PRICING CHANGED banner at the top */
  pricingChanged?: boolean;
}

export function buildQuoteEmail(data: QuoteEmailData): string {
  const {
    stepLabel, taskDescription, woNumber, companyName, projectName,
    quoteVersion, sections = [], ctaUrl, ctaLabel, pricingChanged,
  } = data;

  const pricingBannerHtml = pricingChanged ? `
          <tr>
            <td style="padding:0;">
              <div style="background:#dc2626;color:white;text-align:center;padding:14px 20px;font-size:18px;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;">
                ⚠ PRICING CHANGED
              </div>
              <div style="background:#fef2f2;border-bottom:2px solid #dc2626;text-align:center;padding:8px 20px;font-size:12px;color:#991b1b;">
                Factory pricing has been updated. All downstream calculations require re-approval.
              </div>
            </td>
          </tr>` : "";

  const sectionHtml = sections.map((s) => `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;">
      <tr>
        <td style="padding:8px 12px;background:#f5f3ef;border-radius:6px 6px 0 0;font-size:13px;font-weight:600;color:#44403c;border-bottom:1px solid #e7e5e4;">
          ${s.label}
        </td>
      </tr>
      ${s.rows.map((r) => `
      <tr>
        <td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #f5f3ef;">
          <span style="color:#78716c;min-width:120px;display:inline-block;">${r.label}</span>
          <span style="color:#1c1917;font-weight:500;">${r.value}</span>
        </td>
      </tr>`).join("")}
    </table>
  `).join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#fafaf9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#fafaf9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e7e5e4;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 28px 16px;border-bottom:1px solid #e7e5e4;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <div style="display:inline-block;background:#c2410c;width:22px;height:22px;border-radius:4px;text-align:center;line-height:22px;font-size:10px;color:white;font-weight:700;">W</div>
                    <span style="font-size:13px;font-weight:600;color:#44403c;letter-spacing:0.08em;margin-left:8px;vertical-align:middle;">WINHOOP CRM</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ${pricingBannerHtml}
          <!-- Step banner -->
          <tr>
            <td style="padding:20px 28px 12px;">
              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:14px 16px;">
                <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:#c2410c;font-weight:600;margin-bottom:4px;">Next Step</div>
                <div style="font-size:17px;font-weight:700;color:#1c1917;">${stepLabel}</div>
                ${taskDescription ? `<div style="font-size:13px;color:#78716c;margin-top:4px;">${taskDescription}</div>` : ""}
              </div>
            </td>
          </tr>
          <!-- Quote info -->
          <tr>
            <td style="padding:12px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:8px;">
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#78716c;width:120px;">Work Order</td>
                  <td style="padding:6px 0;font-size:13px;font-weight:600;color:#1c1917;font-family:monospace;">${woNumber}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#78716c;">Company</td>
                  <td style="padding:6px 0;font-size:13px;font-weight:500;color:#1c1917;">${companyName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#78716c;">Project</td>
                  <td style="padding:6px 0;font-size:13px;color:#1c1917;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding:6px 0;font-size:13px;color:#78716c;">Version</td>
                  <td style="padding:6px 0;font-size:13px;color:#1c1917;">v${quoteVersion}</td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Form data sections -->
          ${sectionHtml ? `<tr><td style="padding:0 28px 8px;">${sectionHtml}</td></tr>` : ""}
          <!-- CTA -->
          <tr>
            <td style="padding:12px 28px 28px;" align="center">
              <a href="${ctaUrl}" style="display:inline-block;background:#c2410c;color:white;text-decoration:none;padding:10px 28px;border-radius:6px;font-size:14px;font-weight:600;">
                ${ctaLabel}
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 28px;border-top:1px solid #e7e5e4;font-size:11px;color:#a8a29e;text-align:center;">
              Sent by Winhoop CRM. Do not reply to this email.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
