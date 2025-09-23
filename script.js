const convertBtn = document.getElementById('convert-btn');
const pdfUpload = document.getElementById('pdf-upload');
const output = document.getElementById('output');
const progressText = document.getElementById('progress-text');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

function fixCommonOCR(text) {
    const corrections = {
        'भिवhयत': 'भविष्यत',
        'िGयाएँ': 'क्रियाएँ',
        'िGया': 'क्रिया',
    };
    for (let wrong in corrections) {
        text = text.replace(new RegExp(wrong, 'g'), corrections[wrong]);
    }
    return text;
}

function preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
        let avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2])/3;
        let val = avg > 128 ? 255 : 0;
        imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
}

async function extractTextFromPage(page, scale=2.5) {
    // Try text extraction first
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ').trim();
    if (pageText.length > 5) return pageText; // fast path

    // Else use OCR
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: ctx, viewport }).promise;

    preprocessCanvas(canvas);

    const { data: { text } } = await Tesseract.recognize(canvas, 'hin', {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/worker.min.js',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0_best',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@2.1.5/tesseract-core.wasm.js'
    });

    return fixCommonOCR(text);
}

convertBtn.addEventListener('click', async () => {
    const file = pdfUpload.files[0];
    if (!file) { alert('कृपया PDF फाइल अपलोड करें।'); return; }

    output.value = '';
    progressText.innerText = 'Progress: 0%';

    const reader = new FileReader();
    reader.onload = async function() {
        const typedarray = new Uint8Array(this.result);
        const pdf = await pdfjsLib.getDocument(typedarray).promise;
        const totalPages = pdf.numPages;

        const pagePromises = [];
        const concurrency = 4; // max parallel pages

        for (let i = 1; i <= totalPages; i++) {
            pagePromises.push((async (pageNum) => {
                const page = await pdf.getPage(pageNum);
                const text = await extractTextFromPage(page);
                progressText.innerText = `Progress: ${Math.floor((pageNum/totalPages)*100)}%`;
                return text;
            })(i));

            // Limit concurrency
            if (pagePromises.length === concurrency || i === totalPages) {
                const results = await Promise.all(pagePromises);
                output.value += results.join('\n') + '\n';
                pagePromises.length = 0; // clear for next batch
            }
        }

        progressText.innerText = 'Conversion Complete!';
        alert('PDF converted to text!');
    };

    reader.readAsArrayBuffer(file);
});

// Copy & Download
copyBtn.addEventListener('click', () => { output.select(); document.execCommand('copy'); alert('Copied!'); });
downloadBtn.addEventListener('click', () => {
    const blob = new Blob([output.value], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hindi_text.txt';
    link.click();
});
