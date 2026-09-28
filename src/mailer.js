/* ============================================================
   SIKEDA — Template email HTML bergaya SIKEDA.
   Dipakai: email reset kata sandi, email welcome anggota.
   Tabel + inline style agar tampil konsisten di Gmail/Outlook.
   ============================================================ */

/**
 * Bungkus konten dalam layout email SIKEDA.
 * @param {string} title  Judul di dalam kartu (mis. "Reset kata sandi")
 * @param {string} bodyHtml HTML bagian tengah (tanpa wrapper)
 * @returns {string}
 */
function sikedaEmail(title, bodyHtml){
  return '<div style="margin:0;padding:28px 16px;background:#eef1f6;font-family:Segoe UI,Arial,sans-serif;">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 6px 24px rgba(8,17,32,.08);">' +

    /* Header brand */
    '<tr><td style="background:#0d1b33;padding:26px 32px;">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
    '<td style="width:44px;height:44px;background:#12264a;border-radius:12px;text-align:center;vertical-align:middle;font-size:20px;color:#eac06a;">&#128737;</td>' +
    '<td style="padding-left:12px;">' +
    '<div style="font-size:19px;font-weight:800;color:#ffffff;letter-spacing:.03em;">SIKEDA</div>' +
    '<div style="font-size:11.5px;color:rgba(238,242,248,.65);">DPD Nusantara Bersatu</div>' +
    '</td></tr></table>' +
    '</td></tr>' +

    /* Konten */
    '<tr><td style="padding:32px;">' +
    '<h2 style="margin:0 0 14px;font-size:19px;color:#0d1b33;">' + title + '</h2>' +
    bodyHtml +
    '</td></tr>' +

    /* Footer */
    '<tr><td style="padding:18px 32px;background:#f4f6fa;border-top:1px solid #e7ebf2;">' +
    '<p style="margin:0;font-size:11.5px;color:#8a94a6;line-height:1.6;">Email otomatis dari sistem keanggotaan SIKEDA. Abaikan bila Anda tidak merasa terdaftar.</p>' +
    '</td></tr>' +

    '</table></div>';
}

/** Tombol CTA berwarna */
function emailButton(link, label){
  return '<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr><td align="center" style="border-radius:11px;background:#12264a;">' +
    '<a href="' + link + '" style="display:inline-block;padding:13px 28px;font-size:14.5px;font-weight:700;color:#ffffff;text-decoration:none;">' + label + '</a>' +
    '</td></tr></table>';
}

/** Baris data sederhana (label — nilai) */
function emailRow(label, value){
  return '<tr><td style="padding:7px 0;font-size:13.5px;color:#7a8598;width:38%;">' + label + '</td>' +
    '<td style="padding:7px 0;font-size:13.5px;color:#0d1b33;font-weight:600;">' + value + '</td></tr>';
}

module.exports = { sikedaEmail, emailButton, emailRow };
