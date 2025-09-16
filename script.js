const convertBtn = document.getElementById('convert-btn');
const pdfUpload = document.getElementById('pdf-upload');
const output = document.getElementById('output');
const progressText = document.getElementById('progress-text');
const copyBtn = document.getElementById('copy-btn');
const downloadBtn = document.getElementById('download-btn');

// Dictionary-based post-correction
function fixCommonOCR(text) {
    const corrections = {
        'भिवhयत': 'भविष्यत',
        'िGयाएँ': 'क्रियाएँ',
        'िGया': 'क्रिया',
        // Add more corrections here
    };
    for (let wrong in corrections) {
        let regex = new RegExp(wrong, 'g');
        text = text.replace(regex, corrections[wrong]);
    }
    return text;
}

// Convert canvas to black-white image for better OCR
function preprocessCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < imgData.data.length; i += 4) {
        let avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2])/3;
        let val = avg > 128 ? 255 : 0; // threshold
        imgData.data[i] = imgData.data[i+1] = imgData.data[i+2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
    return canvas;
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
        let fullText = '';

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 3 }); // high res

            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;

            preprocessCanvas(canvas); // black-white

            const { data: { text } } = await Tesseract.recognize(canvas, 'hin', {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        progressText.innerText = `Progress: ${Math.floor(((i-1)/pdf.numPages + m.progress/pdf.numPages)*100)}%`;
                    }
                }
            });

            fullText += fixCommonOCR(text) + '\n';
        }

        output.value = fullText;
        progressText.innerText = 'Conversion Complete!';
        alert('PDF को टेक्स्ट में बदल दिया गया!');
    };

    reader.readAsArrayBuffer(file);
});

// Copy to clipboard
copyBtn.addEventListener('click', () => {
    output.select();
    document.execCommand('copy');
    alert('Text copied to clipboard!');
});

// Download as TXT
downloadBtn.addEventListener('click', () => {
    const blob = new Blob([output.value], { type: 'text/plain' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'hindi_text.txt';
    link.click();
});
