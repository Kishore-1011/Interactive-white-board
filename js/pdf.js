// --- PDF export ---

// A one-page PDF holding a picture of the board, written directly so no library is needed.
function buildPdf(jpeg, pixelWidth, pixelHeight) {
    const scale = PDF_PAGE_SIZE / Math.max(pixelWidth, pixelHeight);
    const pageWidth = Math.round(pixelWidth * scale * 100) / 100;
    const pageHeight = Math.round(pixelHeight * scale * 100) / 100;

    const encoder = new TextEncoder();
    const parts = [];
    const offsets = [];
    let length = 0;
    const add = (data) => {
        const bytes = typeof data === 'string' ? encoder.encode(data) : data;
        parts.push(bytes);
        length += bytes.length;
    };
    const addObject = (number, body) => {
        offsets[number] = length;
        add(`${number} 0 obj\n${body}\nendobj\n`);
    };

    add('%PDF-1.4\n');
    addObject(1, '<< /Type /Catalog /Pages 2 0 R >>');
    addObject(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    addObject(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] `
        + '/Resources << /XObject << /Board 4 0 R >> >> /Contents 5 0 R >>');

    offsets[4] = length;
    add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pixelWidth} /Height ${pixelHeight} `
        + `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    add(jpeg);
    add('\nendstream\nendobj\n');

    const content = `q ${pageWidth} 0 0 ${pageHeight} 0 0 cm /Board Do Q`;
    addObject(5, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);

    const xrefStart = length;
    const entries = offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
    add(`xref\n0 6\n0000000000 65535 f \n${entries}`);
    add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`);

    return new Blob(parts, { type: 'application/pdf' });
}

function exportPdf() {
    const canvas = renderBoardCanvas();
    canvas.toBlob(async (blob) => {
        const jpeg = new Uint8Array(await blob.arrayBuffer());
        downloadBlob(buildPdf(jpeg, canvas.width, canvas.height), exportFilename('pdf'));
    }, 'image/jpeg', PDF_JPEG_QUALITY);
}
