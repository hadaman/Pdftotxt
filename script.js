document.getElementById('convert-btn').addEventListener('click', () => {
    const file = document.getElementById('pdf-upload').files[0];
    if (!file) {
        alert('कृपया PDF फाइल अपलोड करें।');
        return;
    }

    const reader = new FileReader();
    reader.onload = function() {
        const typedarray = new Uint8Array(this.result);

        pdfjsLib.getDocument(typedarray).promise.then(pdf => {
            let totalPages = pdf.numPages;
            let fullText = '';

            let pagePromises = [];
            for (let i = 1; i <= totalPages; i++) {
                pagePromises.push(
                    pdf.getPage(i).then(page => 
                        page.getTextContent().then(textContent => {
                            let pageText = textContent.items.map(item => item.str).join(' ');
                            fullText += pageText + '\n';
                        })
                    )
                );
            }

            Promise.all(pagePromises).then(() => {
                document.getElementById('output').value = fullText;
            });
        });
    };

    reader.readAsArrayBuffer(file);
});
