document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración ---
    const CSV_URL = 'https://raw.githubusercontent.com/raulancona/cotizadortpsgemini/main/Lista%20estandar%20Raul.csv';
    const ITEMS_PER_PAGE = 25; // Mostrar más items por página
    const IVA_RATE = 0.16;

    // --- Estado ---
    let allProducts = []; let filteredProducts = []; let quoteItems = [];
    let currentPage = 1; let productMap = new Map();

    // --- Selectores del DOM ---
    const loadingStatusEl = document.getElementById('loading-status');
    const productCountInfoEl = document.getElementById('product-count-info');
    const filterClaveEl = document.getElementById('filter-clave');
    const filterDescripcionEl = document.getElementById('filter-descripcion');
    const productsBodyEl = document.getElementById('products-body');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoEl = document.getElementById('page-info');
    const priceLevelEl = document.getElementById('price-level');
    const quoteBodyEl = document.getElementById('quote-body');
    const quoteSubtotalEl = document.getElementById('quote-subtotal');
    const quoteIvaEl = document.getElementById('quote-iva');
    const quoteTotalEl = document.getElementById('quote-total');
    const clientNameEl = document.getElementById('client-name');
    const quoteDateEl = document.getElementById('quote-date');
    const whatsappNumberEl = document.getElementById('whatsapp-number');
    const folioEl = document.getElementById('folio');
    const referenciaEl = document.getElementById('referencia');
    const operadorEl = document.getElementById('operador');
    const clientRfcEl = document.getElementById('client-rfc');
    const clientDirEl = document.getElementById('client-dir');
    const comentarioEl = document.getElementById('comentario');
    const sendWhatsappBtn = document.getElementById('send-whatsapp');
    const generatePdfBtn = document.getElementById('generate-pdf');
    // PDF Selectors (Asegúrate que coincidan con el HTML del PDF)
    const pdfFolioEl = document.getElementById('pdf-folio');
    const pdfQuoteDateEl = document.getElementById('pdf-quote-date');
    const pdfReferenciaEl = document.getElementById('pdf-referencia');
    const pdfOperadorEl = document.getElementById('pdf-operador');
    const pdfClientNameEl = document.getElementById('pdf-client-name');
    const pdfClientWhatsappEl = document.getElementById('pdf-client-whatsapp');
    const pdfClientRfcEl = document.getElementById('pdf-client-rfc');
    const pdfClientDirEl = document.getElementById('pdf-client-dir');
    const pdfComentarioEl = document.getElementById('pdf-comentario');
    const pdfQuoteBodyEl = document.getElementById('pdf-quote-body');
    const pdfSubtotalEl = document.getElementById('pdf-subtotal');
    const pdfIvaEl = document.getElementById('pdf-iva');
    const pdfTotalEl = document.getElementById('pdf-total');

    // --- Funciones ---

    async function loadProducts() {
        try {
            loadingStatusEl.textContent = 'Cargando productos...';
            loadingStatusEl.className = 'status-loading'; productCountInfoEl.textContent = '';
            filterClaveEl.disabled = true; filterDescripcionEl.disabled = true;
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-400 text-sm">Cargando...</td></tr>`;

            const urlWithTimestamp = `${CSV_URL}?t=${new Date().getTime()}`;
            const response = await fetch(urlWithTimestamp);
            if (!response.ok) throw new Error(`Error HTTP ${response.status} al cargar CSV.`);
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true, skipEmptyLines: 'greedy', encoding: "UTF-8",
                transformHeader: header => header.trim(), // Intenta limpiar encabezados
                complete: (results) => {
                    if (results.errors.length > 0) { console.warn("Errores CSV:", results.errors); }

                    productMap.clear();
                    let loadedCount = 0;
                    allProducts = results.data.map((p, index) => {
                        // Intenta leer 'Clave' o 'clave', etc.
                        const clave = String(p.Clave || p.clave || '').trim();
                        const descripcion = String(p.Descripcion || p.descripcion || '').trim();
                        const precioStrRaw = String(p.PrecioPublico || p.preciopublico || '0');
                        const unidadMedida = String(p.UnidadMedida || p.unidadmedida || 'PZA').trim();

                        // Limpieza robusta de precio
                        const precioStrClean = precioStrRaw.replace(/[^0-9.-]+/g, '').replace(/,/g, '.'); // Reemplaza coma por punto decimal
                        const precio = parseFloat(precioStrClean);

                        const internalId = `item-${index}-${clave || Math.random().toString(16).slice(2)}`;
                        const isValid = clave && descripcion && !isNaN(precio) && precio >= 0;

                        if (isValid) {
                            const productData = { clave, descripcion, precioBase: precio, unidadMedida, id: internalId };
                            productMap.set(internalId, productData);
                            loadedCount++;
                            return productData;
                        } else {
                            console.warn(` Fila ${index + 2} IGNORADA (Clave: ${!!clave}, Desc: ${!!descripcion}, Precio Válido: ${!isNaN(precio)}) | Raw:`, p);
                            return null;
                        }
                    }).filter(p => p !== null);

                    if (loadedCount === 0) {
                         loadingStatusEl.textContent = `Error: No se cargaron productos válidos.`;
                         loadingStatusEl.className = 'status-warning';
                         productCountInfoEl.textContent = `(0 productos - Revisa CSV/Consola F12)`;
                         productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-orange-600">No se pudo procesar ningún producto válido. Verifica los encabezados (Clave,Descripcion,PrecioPublico) y el formato de los datos en tu archivo CSV.</td></tr>`;
                    } else {
                        loadingStatusEl.textContent = `Productos cargados:`;
                        loadingStatusEl.className = 'status-success';
                        productCountInfoEl.textContent = `(${loadedCount})`;
                        filterClaveEl.disabled = false; filterDescripcionEl.disabled = false;
                        applyFiltersAndDisplay();
                    }
                },
                error: (error) => { /* ... */ }
            });
        } catch (error) { /* ... */ }
    }

    function applyFiltersAndDisplay() {
        const filterClave = filterClaveEl.value.toUpperCase().trim();
        const filterDescripcion = filterDescripcionEl.value.toUpperCase().trim();
        filteredProducts = allProducts.filter(p =>
            (p.clave.toUpperCase().includes(filterClave) || p.descripcion.toUpperCase().includes(filterClave)) &&
            (p.descripcion.toUpperCase().includes(filterDescripcion))
        );
        currentPage = 1;
        displayCatalogPage();
    }

    function displayCatalogPage() {
        productsBodyEl.innerHTML = '';
        const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        const endIndex = startIndex + ITEMS_PER_PAGE;
        const pageProducts = filteredProducts.slice(startIndex, endIndex);

        if (pageProducts.length === 0) {
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-6 text-gray-500">No se encontraron productos.</td></tr>`;
        } else {
            pageProducts.forEach(product => {
                const row = document.createElement('tr');
                row.classList.add('hover:bg-blue-50'); // Clase Tailwind directa para hover
                row.innerHTML = `
                    <td class="table-ui">${product.clave}</td>
                    <td class="table-ui">${product.descripcion}</td>
                    <td class="table-ui text-right">${formatCurrency(product.precioBase)}</td>
                    <td class="table-ui text-center">
                        <input type="number" min="1" value="1" class="w-14 border p-1 rounded-md text-center text-xs product-quantity" data-product-id="${product.id}">
                    </td>
                    <td class="table-ui text-center">
                        <button class="btn btn-primary btn-icon add-to-quote-btn" data-product-id="${product.id}">
                            <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                        </button>
                    </td>
                `;
                productsBodyEl.appendChild(row);
            });
        }
        updatePagination(totalPages);
    }

    function updatePagination(totalPages) {
        pageInfoEl.textContent = `Página ${currentPage} / ${totalPages > 0 ? totalPages : 1}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    function changePage(direction) { /* ... igual ... */ }
    function addToQuote(productId, quantity) { /* ... igual ... */ }
    function removeFromQuote(productId) { /* ... igual ... */ }
    function updateQuoteDisplay() { /* ... igual ... */ }
    function calculateDiscountedPrice(basePrice, discountPercent) { /* ... igual ... */ }
    function formatCurrency(value) { /* ... igual ... */ }
    function formatDate(dateString) { /* ... igual ... */ }

    function generatePdf() { // Usa la plantilla PDF simplificada
        if (quoteItems.length === 0) return;
        pdfFolioEl.textContent = folioEl.value || '-';
        pdfQuoteDateEl.textContent = formatDate(quoteDateEl.value);
        pdfReferenciaEl.textContent = referenciaEl.value || '-';
        pdfOperadorEl.textContent = operadorEl.value || '-';
        pdfClientNameEl.textContent = clientNameEl.value || '-';
        pdfClientWhatsappEl.textContent = whatsappNumberEl.value || '-';
        pdfClientRfcEl.textContent = clientRfcEl.value || 'XAXX010101000';
        pdfClientDirEl.textContent = clientDirEl.value || '-';
        pdfComentarioEl.textContent = comentarioEl.value || '-';
        pdfQuoteBodyEl.innerHTML = '';
        let pdfSubtotal = 0;
        const discountPercent = parseFloat(priceLevelEl.value) || 0;
        quoteItems.forEach((item, index) => {
            const unitPrice = calculateDiscountedPrice(item.precioBase, discountPercent);
            const itemTotal = unitPrice * item.quantity;
            pdfSubtotal += itemTotal;
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="border: 0.5pt solid #ccc; padding: 1mm; text-align: center;">${index + 1}</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm;">${item.clave}</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm; word-wrap: break-word;">${item.descripcion}</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm; text-align: center;">${item.quantity}</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm; text-align: center;">${item.unidadMedida}</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm; text-align: right;">${formatCurrency(unitPrice)}</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm; text-align: center;">${discountPercent}%</td>
                <td style="border: 0.5pt solid #ccc; padding: 1mm; text-align: right;">${formatCurrency(itemTotal)}</td>
            `;
            pdfQuoteBodyEl.appendChild(row);
        });
        const pdfIva = pdfSubtotal * IVA_RATE;
        const pdfTotal = pdfSubtotal + pdfIva;
        pdfSubtotalEl.textContent = formatCurrency(pdfSubtotal);
        pdfIvaEl.textContent = formatCurrency(pdfIva);
        pdfTotalEl.textContent = formatCurrency(pdfTotal);

        const element = document.getElementById('pdf-template');
        const pdfFilename = `Cotizacion_${(folioEl.value || 'SF').replace(/[^a-zA-Z0-9]/g, '_')}_${(clientNameEl.value || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const opt = {
            margin: [8, 8, 12, 8], filename: pdfFilename, image: { type: 'jpeg', quality: 0.95 }, // Calidad un poco menor
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        element.classList.remove('hidden'); element.style.display = 'block';
        console.log("Generando PDF...");
        html2pdf().from(element).set(opt).save().then(() => {
            console.log("PDF generado."); element.style.display = 'none'; element.classList.add('hidden');
        }).catch(err => {
            console.error("Error generando PDF:", err); element.style.display = 'none'; element.classList.add('hidden');
            alert("Error al generar PDF. Revisa la consola (F12).");
        });
    }

    function generateWhatsAppMessage() { /* ... igual ... */ }
    function sendWhatsApp() { /* ... igual ... */ }

    // --- Event Listeners ---
    let filterTimeout;
    filterClaveEl.addEventListener('input', () => { clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFiltersAndDisplay, 300); });
    filterDescripcionEl.addEventListener('input', () => { clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFiltersAndDisplay, 300); });
    prevPageBtn.addEventListener('click', () => changePage('prev'));
    nextPageBtn.addEventListener('click', () => changePage('next'));
    productsBodyEl.addEventListener('click', (event) => {
        if (event.target.closest('.add-to-quote-btn')) { // Busca el botón padre si se hace clic en el icono
            const button = event.target.closest('.add-to-quote-btn');
            const productId = button.dataset.productId;
            const quantityInput = productsBodyEl.querySelector(`input.product-quantity[data-product-id="${productId}"]`);
            const quantity = parseInt(quantityInput.value, 10);
            if (!isNaN(quantity) && quantity > 0) {
                addToQuote(productId, quantity);
                 // Feedback visual
                button.classList.remove('btn-primary');
                button.classList.add('btn-add-feedback', 'cursor-default');
                button.innerHTML = `<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd" /></svg>`; // Ícono de check
                button.disabled = true;
                setTimeout(() => {
                    button.innerHTML = `<svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>`; // Ícono de más
                    button.classList.add('btn-primary');
                    button.classList.remove('btn-add-feedback', 'cursor-default');
                    button.disabled = false;
                }, 700);
                quantityInput.value = 1;
            } else { alert("Cantidad inválida."); quantityInput.focus(); }
        }
    });
    quoteBodyEl.addEventListener('click', (event) => {
        if (event.target.closest('.remove-from-quote-btn')) { removeFromQuote(event.target.closest('.remove-from-quote-btn').dataset.productId); }
    });
    priceLevelEl.addEventListener('change', updateQuoteDisplay);
    sendWhatsappBtn.addEventListener('click', sendWhatsApp);
    generatePdfBtn.addEventListener('click', generatePdf);

    // --- Inicialización ---
    quoteDateEl.value = new Date().toISOString().split('T')[0];
    loadProducts();

}); // Fin DOMContentLoaded
