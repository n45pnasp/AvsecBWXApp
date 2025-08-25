/**
 * Web App penerima data dari gun.js.
 * - Sheet "GunFilesPDF": menampung data terakhir (ditimpa setiap kali kirim) dengan urutan kolom mengikuti layout template.
 * - Sheet "Files": menyimpan seluruh riwayat (append) dengan urutan kolom lama (compat).
 */
const SPREADSHEET_ID = '1gBXmuThM3DMHqwmTEXPAZMlb3MKDS4nbZ8_lap8dj-s';

/**
 * URUTAN KOLOM PER SHEET
 * - GUNFILES_PDF_ORDER: disesuaikan dengan field di template (gambar).
 *   Catatan:
 *   - avsecBandara = namaAvsec
 *   - avsecAirlines = petugas
 *   - instansiAvsec tetap disimpan (jika ada), meski tidak semua template menampilkannya.
 *   - fotoAvsec dan fotoEvidence biasanya berupa URL/ID yang kemudian dirender via formula/IMAGE() di sheet.
 * - FILES_ORDER: urutan lama (compat), jangan diubah agar histori “Files” tetap konsisten.
 */
const GUNFILES_PDF_ORDER = [
  'tanggal',        // HARI/TANGGAL
  'namaLengkap',    // NAMA PEMILIK
  'pekerjaan',      // PEKERJAAN
  'flightNumber',   // NO. PENERBANGAN
  'seatNumber',     // NOMOR KURSI
  'nomorKTA',       // NOMOR KTP/SIM/PASPOR (sesuai payload)
  'tipeSenjata',    // JENIS SENJATA
  'jenisPeluru',    // JENIS PELURU
  'jumlahPeluru',   // JUMLAH PELURU
  'supervisor',     // SUPERVISOR
  'namaAvsec',      // AVSEC BANDARA (nama petugas bandara)
  'petugas',        // AVSEC AIRLINES (nama petugas maskapai)
  'instansiAvsec',  // (opsional) INSTANSI AVSEC
  'fotoAvsec',      // FOTO AVSEC (kiri pada blok EVIDENCE)
  'fotoEvidence'    // FOTO SENJATA / DOKUMEN (kanan pada blok EVIDENCE)
];

const FILES_ORDER = [
  'tanggal',
  'namaLengkap',
  'pekerjaan',
  'flightNumber',
  'seatNumber',
  'nomorKTA',
  'tipeSenjata',
  'jenisPeluru',
  'jumlahPeluru',
  'namaAvsec',
  'instansiAvsec',
  'petugas',
  'supervisor',
  'fotoId',
  'fotoAvsec',
  'fotoEvidence'
];

/** Helper: bentuk array nilai sesuai urutan field yang ditentukan */
function buildRowByOrder(data, order) {
  return order.map(key => (data[key] != null ? String(data[key]) : ''));
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('Payload kosong.');
    }

    // Nama sheet dari query ?sheet=...
    const sheetName = (e.parameter.sheet || 'GunFilesPDF').trim();

    // Payload JSON dari gun.js
    const data = JSON.parse(e.postData.contents);

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) throw new Error('Sheet tidak ditemukan: ' + sheetName);

    let row;

    if (sheetName === 'GunFilesPDF') {
      // === MODE TEMPLATE: tulis data terakhir ke baris 2 (kolom mengikuti layout gambar) ===
      row = buildRowByOrder(data, GUNFILES_PDF_ORDER);

      // Pastikan sheet punya cukup kolom untuk menampung semua field
      if (sheet.getMaxColumns() < row.length) {
        sheet.insertColumnsAfter(sheet.getMaxColumns(), row.length - sheet.getMaxColumns());
      }

      // Tulis selalu ke baris 2
      sheet.getRange(2, 1, 1, row.length).setValues([row]);

    } else if (sheetName === 'Files') {
      // === MODE RIWAYAT: append dengan urutan lama (compat) ===
      row = buildRowByOrder(data, FILES_ORDER);
      sheet.appendRow(row);

    } else {
      // Jika sheet lain-lain, default-kan ke perilaku riwayat dengan urutan lama
      row = buildRowByOrder(data, FILES_ORDER);
      sheet.appendRow(row);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ success: true, sheet: sheetName, cols: row.length }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
