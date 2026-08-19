// The presentational shell shared by every DivvyUp email. Kept apart from the
// copy in authEmails.ts, the same split as the app: this file is the layout,
// those are the words.
//
// Everything here is table-based with inline styles on purpose: mail clients
// (Gmail, Outlook) strip <style> blocks and never resolve CSS custom
// properties, so the palette values are hardcoded here rather than read from
// App.css's var()s. The logo is an absolute Cloudinary URL, never a CID
// attachment or a base64 data URI (Gmail clips both).

const LOGO_URL = 'https://res.cloudinary.com/dqu8cekw4/image/upload/v1787162453/logo.png';

const COLORS = {
    primary: '#1e90ff',
    text: '#252424',
    muted: '#6b7280',
    background: '#f8f7f7',
    surface: '#ffffff',
    border: '#e5e5e5',
};

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

export interface EmailContent {
    heading: string;
    body: string[];
    action: { label: string; url: string };
    footnote: string;
}

const paragraph = (html: string) =>
    `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:${COLORS.text};">${html}</p>`;

export const layout = ({ heading, body, action, footnote }: EmailContent) => `
<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background-color:${COLORS.background};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${COLORS.background};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:${COLORS.surface};border:1px solid ${COLORS.border};border-radius:12px;overflow:hidden;">
          <tr>
            <td align="center" style="padding:32px 32px 24px;">
              <img src="${LOGO_URL}" alt="DivvyUp" width="48" height="48" style="display:block;border:0;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3;color:${COLORS.text};">${escapeHtml(heading)}</h1>
              ${body.map((text) => paragraph(escapeHtml(text))).join('\n              ')}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
                <tr>
                  <td align="center" style="border-radius:8px;background-color:${COLORS.primary};">
                    <a href="${action.url}" style="display:inline-block;padding:12px 28px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px;">${escapeHtml(action.label)}</a>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:13px;line-height:1.6;color:${COLORS.muted};word-break:break-all;">If the button does not work, copy and paste this link into your browser:<br /><a href="${action.url}" style="color:${COLORS.primary};">${escapeHtml(action.url)}</a></p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};">
              <p style="margin:0;font-size:13px;line-height:1.6;color:${COLORS.muted};">${escapeHtml(footnote)}</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0;font-size:12px;color:${COLORS.muted};">DivvyUp — split expenses, not friendships.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
