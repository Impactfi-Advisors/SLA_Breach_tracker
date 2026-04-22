import {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  AlignmentType, Table, TableRow, TableCell, WidthType,
  BorderStyle, ShadingType, UnderlineType, NumberFormat,
  convertInchesToTwip, PageBreak, Header, Footer,
} from 'docx'
import { writeFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../docs/SLA_Breach_Tracker_Admin_Guide.docx')

// ─── Style helpers ───────────────────────────────────────────────────────────
const BLUE   = '1E40AF'
const DKBLUE = '1E3A8A'
const GRAY   = '64748B'
const LGRAY  = 'F1F5F9'
const RED    = 'DC2626'
const GREEN  = '16A34A'
const AMBER  = 'D97706'
const WHITE  = 'FFFFFF'

function h1(text) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    border: { bottom: { color: BLUE, size: 8, style: BorderStyle.SINGLE } },
    children: [new TextRun({ text, bold: true, color: DKBLUE, size: 32 })],
    text: undefined,
  })
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    children: [new TextRun({ text, bold: true, color: BLUE, size: 26 })],
  })
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, bold: true, color: '334155', size: 22 })],
  })
}

function p(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120 },
    children: [new TextRun({ text, color: '374151', size: 20, ...opts })],
  })
}

function bullet(text, level = 0) {
  return new Paragraph({
    bullet: { level },
    spacing: { after: 80 },
    children: typeof text === 'string'
      ? [new TextRun({ text, color: '374151', size: 20 })]
      : text,
  })
}

function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: 'steps', level },
    spacing: { after: 80 },
    children: typeof text === 'string'
      ? [new TextRun({ text, color: '374151', size: 20 })]
      : text,
  })
}

function bold(text) {
  return new TextRun({ text, bold: true, color: '111827', size: 20 })
}

function mono(text) {
  return new TextRun({ text, font: 'Courier New', color: BLUE, size: 18 })
}

function note(text, color = '1D4ED8', bg = 'EFF6FF') {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: bg },
    indent: { left: convertInchesToTwip(0.25) },
    border: { left: { color, size: 24, style: BorderStyle.SINGLE } },
    children: [new TextRun({ text: `ℹ  ${text}`, color, size: 19 })],
  })
}

function warning(text) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: 'FFFBEB' },
    indent: { left: convertInchesToTwip(0.25) },
    border: { left: { color: AMBER, size: 24, style: BorderStyle.SINGLE } },
    children: [new TextRun({ text: `⚠  ${text}`, color: AMBER, size: 19 })],
  })
}

function tip(text) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { type: ShadingType.CLEAR, fill: 'F0FDF4' },
    indent: { left: convertInchesToTwip(0.25) },
    border: { left: { color: GREEN, size: 24, style: BorderStyle.SINGLE } },
    children: [new TextRun({ text: `✓  ${text}`, color: GREEN, size: 19 })],
  })
}

function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] })
}

function spacer() {
  return new Paragraph({ spacing: { after: 160 } })
}

function tableRow(cells, isHeader = false) {
  return new TableRow({
    tableHeader: isHeader,
    children: cells.map(({ text, width = 20 }) =>
      new TableCell({
        width: { size: width, type: WidthType.PERCENTAGE },
        shading: isHeader ? { type: ShadingType.CLEAR, fill: DKBLUE } : undefined,
        margins: { top: 60, bottom: 60, left: 120, right: 120 },
        children: [new Paragraph({
          children: [new TextRun({
            text,
            bold: isHeader,
            color: isHeader ? WHITE : '374151',
            size: 18,
          })],
        })],
      })
    ),
  })
}

// ─── Document sections ────────────────────────────────────────────────────────
const doc = new Document({
  numbering: {
    config: [{
      reference: 'steps',
      levels: [
        {
          level: 0, numFmt: NumberFormat.DECIMAL, text: '%1.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } },
        },
        {
          level: 1, numFmt: NumberFormat.LOWER_LETTER, text: '%2.',
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 1080, hanging: 360 } } },
        },
      ],
    }],
  },
  styles: {
    default: {
      document: {
        run: { font: 'Calibri', size: 20, color: '374151' },
        paragraph: { spacing: { line: 276 } },
      },
    },
  },
  sections: [
    {
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1.25),
          },
        },
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            border: { bottom: { color: BLUE, size: 4, style: BorderStyle.SINGLE } },
            children: [new TextRun({ text: 'SLA Breach Tracker  |  Admin Guide  |  Impact FI Advisors', color: GRAY, size: 16 })],
          })],
        }),
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            border: { top: { color: 'E2E8F0', size: 4, style: BorderStyle.SINGLE } },
            children: [new TextRun({ text: 'Confidential — Impact FI Advisors', color: GRAY, size: 16 })],
          })],
        }),
      },
      children: [

        // ── Cover ─────────────────────────────────────────────────────────
        new Paragraph({
          spacing: { before: 800, after: 200 },
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'SLA Breach Tracker', bold: true, size: 56, color: DKBLUE })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 80 },
          children: [new TextRun({ text: 'Admin User Guide', size: 36, color: BLUE })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 600 },
          children: [new TextRun({ text: 'Impact FI Advisors  ·  Confidential', size: 20, color: GRAY })],
        }),

        pageBreak(),

        // ── 1. Overview ───────────────────────────────────────────────────
        h1('1. Overview'),
        p('The SLA Breach Tracker is Impact FI Advisors\' internal platform for monitoring fintech vendor Service Level Agreements on behalf of bank clients. It calculates downtime, detects SLA breaches, applies contractual penalties, and exposes a read-only portal for each bank to review their own data.'),
        spacer(),
        h2('Who uses this system?'),
        bullet([bold('Admins (Impact FI staff): '), new TextRun({ text: 'full access — manage banks, SLA rules, log outages, generate reports.', size: 20, color: '374151' })]),
        bullet([bold('Banks (clients): '), new TextRun({ text: 'read-only portal access via a unique link — no login required.', size: 20, color: '374151' })]),
        spacer(),
        h2('Domain model at a glance'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow([
              { text: 'Concept', width: 20 },
              { text: 'Meaning', width: 50 },
              { text: 'Example', width: 30 },
            ], true),
            tableRow([{ text: 'Bank', width: 20 }, { text: 'Your bank client — the entity receiving SLA monitoring', width: 50 }, { text: 'First National Bank', width: 30 }]),
            tableRow([{ text: 'Vendor', width: 20 }, { text: 'Fintech company providing technology to the bank', width: 50 }, { text: 'Fiserv, Jack Henry', width: 30 }]),
            tableRow([{ text: 'Product', width: 20 }, { text: 'A specific service offered by a vendor', width: 50 }, { text: 'Core Banking, Mobile App', width: 30 }]),
            tableRow([{ text: 'SLA Rule', width: 20 }, { text: 'Uptime % and penalty per hour for a bank/vendor/product', width: 50 }, { text: '99.9 % uptime, $500/hr', width: 30 }]),
            tableRow([{ text: 'Outage', width: 20 }, { text: 'A recorded downtime event for a product', width: 50 }, { text: 'Core Banking down 3 hrs', width: 30 }]),
          ],
        }),

        pageBreak(),

        // ── 2. Logging In ─────────────────────────────────────────────────
        h1('2. Logging In'),
        p('Navigate to the application URL in any modern browser. You will be redirected to the login page.'),
        numbered('Enter your admin credentials (email + password).'),
        numbered('Click Sign In.'),
        numbered('You will be taken to the main dashboard.'),
        spacer(),
        warning('The admin login is separate from bank portals. Banks never log in — they use a dedicated portal link.'),
        note('Session cookies expire after inactivity. If you see the login page unexpectedly, simply sign in again.'),

        pageBreak(),

        // ── 3. Navigation ─────────────────────────────────────────────────
        h1('3. Navigation'),
        p('The left sidebar contains all admin sections:'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow([{ text: 'Menu Item', width: 25 }, { text: 'Purpose', width: 75 }], true),
            tableRow([{ text: 'Dashboard', width: 25 }, { text: 'Overview stats: active outages, breaches, total penalties', width: 75 }]),
            tableRow([{ text: 'Banks', width: 25 }, { text: 'Manage bank clients — add, edit, generate portal links', width: 75 }]),
            tableRow([{ text: 'SLA Config', width: 25 }, { text: 'Define uptime SLA thresholds and penalties per bank/vendor/product', width: 75 }]),
            tableRow([{ text: 'Inbox', width: 25 }, { text: 'Manually log outage start/end events', width: 75 }]),
            tableRow([{ text: 'Breach Log', width: 25 }, { text: 'Full history of all outages across all banks', width: 75 }]),
            tableRow([{ text: 'Report', width: 25 }, { text: 'AI-generated SLA breach reports (downloadable)', width: 75 }]),
            tableRow([{ text: 'Products', width: 25 }, { text: 'Vendor product catalog', width: 75 }]),
            tableRow([{ text: 'Email Config', width: 25 }, { text: 'IMAP settings for automated email ingestion', width: 75 }]),
          ],
        }),

        pageBreak(),

        // ── 4. Banks ──────────────────────────────────────────────────────
        h1('4. Banks'),
        p('Every bank client must be registered before any SLA rules or outages can be associated with them.'),
        spacer(),

        h2('4.1  Adding a Bank'),
        numbered('Click Banks in the sidebar.'),
        numbered('Click Add Bank (top-right button).'),
        numbered('Fill in the two required fields:'),
        numbered([bold('Bank Name: '), new TextRun({ text: 'full legal name, e.g. First National Bank.', size: 20, color: '374151' })], 1),
        numbered([bold('Email Alias: '), new TextRun({ text: 'short slug used in the email routing address, e.g. ', size: 20, color: '374151' }), mono('firstnational'), new TextRun({ text: '. Lowercase letters, numbers, hyphens, underscores only.', size: 20, color: '374151' })], 1),
        numbered('Click Save Bank.'),
        spacer(),
        note('The email alias determines the inbound email address: sla+{alias}@impactfiadvisors.com. Emails sent to that address will be automatically associated with this bank.'),
        spacer(),

        h2('4.2  The Portal Link'),
        p('Each bank gets a unique read-only portal URL. After adding a bank:'),
        numbered('Locate the bank in the Banks list.'),
        numbered('Click the copy icon next to Portal Link to copy the URL to your clipboard.'),
        numbered('Send this URL to your bank contact via email or your usual communication channel.'),
        spacer(),
        tip('The portal link never expires unless you explicitly regenerate the token. Banks can bookmark it.'),
        spacer(),

        h2('4.3  Regenerating a Portal Token'),
        p('If a portal link is compromised or shared with the wrong person:'),
        numbered('Open the Banks page.'),
        numbered('Click the refresh icon next to the affected bank.'),
        numbered('Confirm the action. The old link is immediately invalidated.'),
        numbered('Share the new portal link with the bank.'),
        warning('The old portal URL stops working instantly. Notify the bank contact before regenerating so they are not caught off guard.'),
        spacer(),

        h2('4.4  Editing or Deleting a Bank'),
        bullet('Click the Edit (pencil) icon to update the bank name or email alias.'),
        bullet('Click the Delete (trash) icon to permanently remove a bank and all associated data.'),
        warning('Deleting a bank is irreversible. All SLA rules, outages, and events for that bank will be permanently removed.'),

        pageBreak(),

        // ── 5. SLA Config ─────────────────────────────────────────────────
        h1('5. SLA Configuration'),
        p('SLA rules define what level of uptime each vendor must meet for a specific bank, and what the financial penalty is per hour of excess downtime.'),
        spacer(),

        h2('5.1  Adding an SLA Rule'),
        numbered('Click SLA Config in the sidebar.'),
        numbered('Select the Bank from the dropdown at the top of the form.'),
        numbered('Enter the Vendor name (e.g. Fiserv).'),
        numbered('Enter the Product name (e.g. Core Banking).'),
        numbered('Enter the Uptime SLA % (e.g. 99.9 for 99.9% uptime).'),
        numbered('Enter the Penalty per Hour in USD (e.g. 500 for $500/hr).'),
        numbered('Click Add Rule.'),
        spacer(),
        note('The allowed downtime in minutes per month is automatically calculated as: days-in-month × 1440 × (1 − uptime_pct / 100). Breaches are computed cumulatively across all outages in the same calendar month.'),
        spacer(),

        h2('5.2  How Breach Detection Works'),
        p('When an outage is resolved, the system:'),
        numbered('Sums all resolved outage minutes for that bank/vendor/product combination in the current calendar month.'),
        numbered('Compares the total to the allowed downtime from the SLA rule.'),
        numbered('If total minutes > allowed minutes, the status is set to Breached and a penalty is calculated.'),
        numbered('Penalty = (excess minutes ÷ 60) × penalty_per_hr.'),
        spacer(),

        h2('5.3  Deleting an SLA Rule'),
        p('Click the trash icon on any rule row. This does not retroactively change breach status on past outages.'),

        pageBreak(),

        // ── 6. Inbox — Logging Events ─────────────────────────────────────
        h1('6. Inbox — Logging Events'),
        p('Use the Inbox page to manually record outage start and end events when automated email ingestion is not yet set up, or when you need to log an event after the fact.'),
        spacer(),

        h2('6.1  Logging an Outage Start'),
        numbered('Click Inbox in the sidebar.'),
        numbered('Select the Bank from the Bank dropdown.'),
        numbered('Enter the Vendor name (must match the vendor in the SLA rule exactly).'),
        numbered('Enter the Product name (must match the product in the SLA rule exactly).'),
        numbered('Set Event Type to outage_start.'),
        numbered('Set the Timestamp to when the outage began. Defaults to now.'),
        numbered('Click Log Event.'),
        spacer(),
        warning('Vendor and product names are case-sensitive and must exactly match the SLA rule. A mismatch means the system will not link the outage to any SLA and breach detection will not fire.'),
        spacer(),

        h2('6.2  Logging an Outage End (Resolution)'),
        numbered('Repeat steps 1–5 above, but set Event Type to outage_end.'),
        numbered('Set the Timestamp to when the outage was resolved.'),
        numbered('Click Log Event.'),
        spacer(),
        p('On receiving an outage_end event, the system automatically:'),
        bullet('Closes the open outage and calculates duration in minutes.'),
        bullet('Looks up the matching SLA rule.'),
        bullet('Computes cumulative downtime for the month.'),
        bullet('Sets breach_status to within or breached and calculates penalty_usd.'),
        spacer(),
        tip('After logging an end event, go to Breach Log to confirm the outage now shows a status and penalty amount.'),

        pageBreak(),

        // ── 7. Breach Log ─────────────────────────────────────────────────
        h1('7. Breach Log'),
        p('The Breach Log is a full-history table of every outage across all banks.'),
        spacer(),
        h2('Columns'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow([{ text: 'Column', width: 20 }, { text: 'Meaning', width: 80 }], true),
            tableRow([{ text: 'Bank', width: 20 }, { text: 'Which bank client this outage belongs to', width: 80 }]),
            tableRow([{ text: 'Vendor', width: 20 }, { text: 'Fintech vendor responsible for the product', width: 80 }]),
            tableRow([{ text: 'Product', width: 20 }, { text: 'Specific service that experienced the outage', width: 80 }]),
            tableRow([{ text: 'Start', width: 20 }, { text: 'Timestamp when the outage began', width: 80 }]),
            tableRow([{ text: 'End', width: 20 }, { text: 'Timestamp when it was resolved (— if still active)', width: 80 }]),
            tableRow([{ text: 'Duration', width: 20 }, { text: 'Total downtime in hours and minutes', width: 80 }]),
            tableRow([{ text: 'Status', width: 20 }, { text: 'ACTIVE (ongoing) · WITHIN · BREACHED · PENDING', width: 80 }]),
            tableRow([{ text: 'Penalty', width: 20 }, { text: 'USD penalty owed (0.00 if within SLA)', width: 80 }]),
          ],
        }),
        spacer(),
        h2('Status Meanings'),
        bullet([bold('ACTIVE: '), new TextRun({ text: 'Outage has started but not yet resolved.', size: 20, color: '374151' })]),
        bullet([bold('WITHIN: '), new TextRun({ text: 'Resolved and cumulative downtime is within the allowed SLA threshold.', size: 20, color: '374151' })]),
        bullet([bold('BREACHED: '), new TextRun({ text: 'Resolved and cumulative downtime exceeds the SLA. A penalty applies.', size: 20, color: '374151' })]),
        bullet([bold('PENDING: '), new TextRun({ text: 'No matching SLA rule was found — breach cannot be determined.', size: 20, color: '374151' })]),

        pageBreak(),

        // ── 8. Report Generation ──────────────────────────────────────────
        h1('8. Report Generation'),
        p('The Report page uses AI to generate a professional SLA breach report narrative for a specific bank, vendor, and month.'),
        spacer(),

        h2('8.1  Generating a Report'),
        numbered('Click Report in the sidebar.'),
        numbered('Select the Bank.'),
        numbered('Select the Vendor from the dropdown (only vendors with SLA rules for that bank are shown).'),
        numbered('Select the Month and Year.'),
        numbered('Click Generate Report.'),
        numbered('The AI-generated report appears on screen. Review it for accuracy.'),
        numbered('Use your browser\'s print function (Ctrl+P / Cmd+P) to save as PDF or print.'),
        spacer(),
        note('The report includes breach status, downtime duration, penalty amounts, and a professional narrative summarising the vendor\'s SLA performance for the selected month. It is addressed from Impact FI Advisors to the bank.'),
        spacer(),
        tip('Share the PDF with the bank contact and/or the fintech vendor as part of your monthly reporting process.'),

        pageBreak(),

        // ── 9. Email Configuration ────────────────────────────────────────
        h1('9. Email Configuration'),
        p('The system can automatically ingest outage events from inbound emails sent to the Impact FI Advisors SLA mailbox. This removes the need for manual event logging.'),
        spacer(),

        h2('9.1  How Email Routing Works'),
        p('Each bank has an email alias (set on the Banks page). The corresponding inbound address is:'),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 120, after: 120 },
          children: [mono('sla+{alias}@impactfiadvisors.com')],
        }),
        p('For example, if the alias is firstnational, the address is sla+firstnational@impactfiadvisors.com.'),
        p('When a vendor sends a service notification to that address, the system:'),
        numbered('Polls the IMAP mailbox for new messages.'),
        numbered('Extracts the bank from the +alias portion of the TO address.'),
        numbered('Passes the email body to AI to identify vendor, product, and event type.'),
        numbered('Creates the appropriate outage start or end event automatically.'),
        spacer(),
        tip('Ask the fintech vendor\'s support team to copy sla+{alias}@impactfiadvisors.com on all incident notifications. Most vendors support BCC lists on their status update emails.'),
        spacer(),

        h2('9.2  Adding an IMAP Account'),
        numbered('Click Email Config in the sidebar.'),
        numbered('Click Add Email Account.'),
        numbered('Fill in the IMAP host, port, username, and password.'),
        numbered('Click Test Connection to verify credentials.'),
        numbered('Click Save.'),
        spacer(),
        warning('Credentials are stored encrypted. Never share them. If the IMAP password changes, update the account here immediately.'),
        spacer(),

        h2('9.3  Polling Log'),
        p('Click Email Config › Poll Log to see a history of every email polling attempt, including which messages were processed and any errors.'),

        pageBreak(),

        // ── 10. Products Catalog ──────────────────────────────────────────
        h1('10. Products Catalog'),
        p('The Products page is an optional catalog of vendor products with category classifications. It is used as a reference — adding products here does not automatically create SLA rules.'),
        spacer(),
        h2('Adding a Product'),
        numbered('Click Products in the sidebar.'),
        numbered('Enter the Vendor name (e.g. Jack Henry).'),
        numbered('Enter the Product name (e.g. Silverlake Core).'),
        numbered('Select a Category: Core, Mobile, Web, API, or Other.'),
        numbered('Click Add Product.'),

        pageBreak(),

        // ── 11. Onboarding a New Bank ─────────────────────────────────────
        h1('11. Onboarding a New Bank — Step-by-Step'),
        p('Follow this checklist when a new bank client starts with Impact FI Advisors.'),
        spacer(),

        h2('Step 1 — Register the Bank'),
        numbered('Go to Banks → click Add Bank.'),
        numbered('Enter the full bank name and choose a short email alias (lowercase, no spaces).'),
        numbered('Click Save Bank.'),
        spacer(),
        tip('Use a consistent alias pattern, e.g. firstnational, rivercity, coastalbank.'),
        spacer(),

        h2('Step 2 — Add SLA Rules'),
        numbered('Go to SLA Config.'),
        numbered('Select the newly added bank from the Bank dropdown.'),
        numbered('For each vendor+product the bank uses, add a rule with the agreed uptime % and penalty per hour.'),
        numbered('Repeat until all covered products have rules.'),
        spacer(),
        note('SLA rules should match the contractual SLA between the bank and each fintech vendor. Get these figures from the vendor contracts or the bank\'s procurement team.'),
        spacer(),

        h2('Step 3 — Share the Portal Link'),
        numbered('Go to Banks.'),
        numbered('Find the bank row and click the copy icon next to Portal Link.'),
        numbered('Email the link to the bank\'s designated contact (e.g. the bank\'s VP of Technology).'),
        numbered('Let them know the portal is read-only and always shows live data.'),
        spacer(),

        h2('Step 4 — Set Up Email Routing (Optional but Recommended)'),
        numbered('Determine the inbound email address: sla+{alias}@impactfiadvisors.com.'),
        numbered('Contact each fintech vendor and ask them to add this address to their incident notification list.'),
        numbered('Verify by sending a test email and checking the Poll Log.'),
        spacer(),

        h2('Step 5 — Log the First Outage (Test)'),
        numbered('Go to Inbox.'),
        numbered('Select the bank, enter a known vendor+product, set event type to outage_start.'),
        numbered('Log it, then immediately log an outage_end with a 10-minute difference.'),
        numbered('Go to Breach Log and confirm the outage appears with status WITHIN.'),
        numbered('Go to the portal link and confirm the bank can see the outage.'),
        spacer(),
        tip('Run this test before giving the portal link to the bank. It confirms the entire pipeline is working.'),

        pageBreak(),

        // ── 12. Understanding the Bank Portal ────────────────────────────
        h1('12. Understanding the Bank Portal'),
        p('The portal is what your bank clients see. It is read-only and requires no login.'),
        spacer(),
        h2('Portal Sections'),
        bullet([bold('Summary Cards: '), new TextRun({ text: 'Active outages, total penalties this month, breach count, within-SLA count.', size: 20, color: '374151' })]),
        bullet([bold('SLA Agreements: '), new TextRun({ text: 'All SLA rules configured for the bank — uptime % and penalty per hour.', size: 20, color: '374151' })]),
        bullet([bold('Outage History: '), new TextRun({ text: 'Filterable table (All / Active / Breached / Within) with full detail.', size: 20, color: '374151' })]),
        spacer(),
        p('The portal shows the last 12 months of data. Banks cannot edit anything or access other banks\' data.'),
        warning('The portal URL contains a secret token. Treat it like a password — do not post it publicly.'),

        pageBreak(),

        // ── 13. Quick Reference ───────────────────────────────────────────
        h1('13. Quick Reference — Common Tasks'),
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            tableRow([{ text: 'Task', width: 40 }, { text: 'Where to go', width: 60 }], true),
            tableRow([{ text: 'Add a new bank', width: 40 }, { text: 'Banks → Add Bank', width: 60 }]),
            tableRow([{ text: 'Share a bank\'s portal link', width: 40 }, { text: 'Banks → copy Portal Link icon', width: 60 }]),
            tableRow([{ text: 'Reset a portal link', width: 40 }, { text: 'Banks → refresh icon → confirm', width: 60 }]),
            tableRow([{ text: 'Add an SLA rule', width: 40 }, { text: 'SLA Config → select bank → fill form', width: 60 }]),
            tableRow([{ text: 'Record an outage start', width: 40 }, { text: 'Inbox → select bank → outage_start', width: 60 }]),
            tableRow([{ text: 'Record an outage end', width: 40 }, { text: 'Inbox → select bank → outage_end', width: 60 }]),
            tableRow([{ text: 'View all outages', width: 40 }, { text: 'Breach Log', width: 60 }]),
            tableRow([{ text: 'Generate a monthly report', width: 40 }, { text: 'Report → select bank, vendor, month', width: 60 }]),
            tableRow([{ text: 'Set up auto email ingestion', width: 40 }, { text: 'Email Config → Add Email Account', width: 60 }]),
            tableRow([{ text: 'Check email poll history', width: 40 }, { text: 'Email Config → Poll Log', width: 60 }]),
            tableRow([{ text: 'Add a vendor product', width: 40 }, { text: 'Products → fill form → Add Product', width: 60 }]),
          ],
        }),

        pageBreak(),

        // ── 14. Troubleshooting ───────────────────────────────────────────
        h1('14. Troubleshooting'),
        spacer(),
        h3('Outage shows status PENDING'),
        p('The system could not find an SLA rule matching the vendor+product. Check:'),
        bullet('The vendor name in the outage exactly matches the SLA rule (case-sensitive).'),
        bullet('The product name in the outage exactly matches the SLA rule.'),
        bullet('An SLA rule exists for this bank, vendor, and product in SLA Config.'),
        spacer(),
        h3('Portal link returns "Invalid or expired portal link"'),
        bullet('The token has been regenerated. Share the new link from the Banks page.'),
        bullet('The bank was deleted. Re-add the bank and create a new portal link.'),
        spacer(),
        h3('Email ingestion not picking up messages'),
        bullet('Verify the IMAP credentials are correct (Email Config → Test Connection).'),
        bullet('Confirm the vendor is sending to the correct address: sla+{alias}@impactfiadvisors.com.'),
        bullet('Check the Poll Log for error messages.'),
        bullet('Confirm the email alias in the Banks page matches exactly what is in the TO address.'),
        spacer(),
        h3('Build or server errors'),
        p('If the application is not starting correctly, run the following in the project root:'),
        new Paragraph({
          spacing: { before: 80, after: 80 },
          shading: { type: ShadingType.CLEAR, fill: '1E293B' },
          indent: { left: convertInchesToTwip(0.25) },
          children: [new TextRun({ text: 'npm run build && npm start', font: 'Courier New', color: '86EFAC', size: 18 })],
        }),
        spacer(),

        // ── End ───────────────────────────────────────────────────────────
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 400 },
          children: [new TextRun({ text: '— End of Admin Guide —', color: GRAY, size: 18, italics: true })],
        }),
      ],
    },
  ],
})

Packer.toBuffer(doc).then(buf => {
  writeFileSync(OUT, buf)
  console.log('Written:', OUT)
})
