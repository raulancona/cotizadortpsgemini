document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración ---
    const CSV_URL = 'https://raw.githubusercontent.com/raulancona/cotizadortpsgemini/main/Lista%20estandar%20Raul.csv';
    const ITEMS_PER_PAGE = 20;
    const IVA_RATE = 0.16;

    // --- Estado ---
    let allProducts = [];
    let filteredProducts = [];
    let quoteItems = [];
    let currentPage = 1;
    let productMap = new Map();

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
    // PDF Template Selectors
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
            loadingStatusEl.textContent = 'Cargando productos desde GitHub...';
            loadingStatusEl.className = 'status-loading';
            productCountInfoEl.textContent = '';
            filterClaveEl.disabled = true;
            filterDescripcionEl.disabled = true;
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-gray-500">Cargando...</td></tr>`;

            const urlWithTimestamp = `${CSV_URL}?t=${new Date().getTime()}`;
            const response = await fetch(urlWithTimestamp);
            if (!response.ok) throw new Error(`Error HTTP ${response.status} al cargar CSV.`);
            const csvText = await response.text();

            Papa.parse(csvText, {
                header: true, // Usamos encabezados, asumiendo que la 1ra línea es Clave,Descripcion,PrecioPublico
                skipEmptyLines: 'greedy',
                encoding: "UTF-8",
                transformHeader: header => header.trim(),
                complete: (results) => {
                    if (results.errors.length > 0) { /* ... manejo error ... */ }
                    console.log("Resultados de PapaParse:", results);

                    productMap.clear();
                    allProducts = results.data
                        .map((p, index) => {
                            // --- LEYENDO POR NOMBRE DE COLUMNA ---
                            // Asegúrate que tu CSV tenga EXACTAMENTE estos encabezados
                            const clave = String(p.Clave || p.clave || '').trim(); // Intenta ambas capitalizaciones
                            const descripcion = String(p.Descripcion || p.descripcion || '').trim();
                            const precioStrRaw = String(p.PrecioPublico || p.preciopublico || '0');
                            const unidadMedida = String(p.UnidadMedida || p.unidadmedida || 'PZA').trim();

                            const precioStrClean = precioStrRaw.replace(/[$,\s]/g, '').replace(/,/g, '');
                            const precio = parseFloat(precioStrClean);
                            const internalId = `item-${index}-${clave || Math.random().toString(16).slice(2)}`;

                            const isClaveValid = !!clave;
                            const isDescValid = !!descripcion;
                            const isPrecioValid = !isNaN(precio) && precio >= 0;
                             // console.log(`Fila ${index + 2}: Clave='${clave}'(${isClaveValid}), Desc='${descripcion.substring(0,20)}...'(${isDescValid}), PrecioRaw='${precioStrRaw}', PrecioNum=${precio}(${isPrecioValid})`);

                            if (isClaveValid && isDescValid && isPrecioValid) {
                                const productData = {
                                    clave: clave,
                                    descripcion: descripcion,
                                    precioBase: precio, // Guardar el número limpio
                                    unidadMedida: unidadMedida,
                                    id: internalId
                                };
                                productMap.set(internalId, productData);
                                return productData;
                            }
                            console.warn(`   -> Fila ${index + 2} IGNORADA. Datos:`, p);
                            return null;
                        })
                        .filter(p => p !== null);

                    if (allProducts.length === 0) { /* ... manejo error ... */ }
                    else {
                        loadingStatusEl.textContent = `Productos cargados:`;
                        loadingStatusEl.className = 'status-success';
                        productCountInfoEl.textContent = `(${allProducts.length})`;
                        filterClaveEl.disabled = false;
                        filterDescripcionEl.disabled = false;
                        applyFiltersAndDisplay();
                    }
                },
                error: (error) => { /* ... manejo error ... */ }
            });
        } catch (error) { /* ... manejo error ... */ }
    } // Fin loadProducts

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
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-gray-500">No se encontraron productos con esos filtros.</td></tr>`;
        } else {
            pageProducts.forEach(product => {
                const row = document.createElement('tr');
                // <<< CORRECCIÓN: Solo mostrar el precio formateado, sin comentarios >>>
                row.innerHTML = `
                    <td class="align-top">${product.clave}</td>
                    <td class="align-top">${product.descripcion}</td>
                    <td class="text-right align-top">${formatCurrency(product.precioBase)}</td> {/* Solo el precio */}
                    <td class="text-center align-top">
                        <input type="number" min="1" value="1" class="w-16 border rounded px-1 py-0.5 text-center text-sm product-quantity" data-product-id="${product.id}">
                    </td>
                    <td class="text-center align-top">
                        <button class="add-to-quote-btn bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition" data-product-id="${product.id}">+</button>
                    </td>
                `;
                // <<< FIN CORRECCIÓN >>>
                productsBodyEl.appendChild(row);
            });
        }
        updatePagination(totalPages);
    }

    function updatePagination(totalPages) { /* ... igual ... */ }
    function changePage(direction) { /* ... igual ... */ }
    function addToQuote(productId, quantity) { /* ... igual ... */ }
    function removeFromQuote(productId) { /* ... igual ... */ }
    function updateQuoteDisplay() { /* ... igual ... */ }
    function calculateDiscountedPrice(basePrice, discountPercent) { /* ... igual ... */ }
    function formatCurrency(value) { /* ... igual ... */ }
    function formatDate(dateString) { /* ... igual ... */ }

    function generatePdf() {
        if (quoteItems.length === 0) return;
        // Poblar datos generales PDF (igual)
        pdfFolioEl.textContent = folioEl.value || '-';
        pdfQuoteDateEl.textContent = formatDate(quoteDateEl.value);
        pdfReferenciaEl.textContent = referenciaEl.value || '-';
        pdfOperadorEl.textContent = operadorEl.value || '-';
        pdfClientNameEl.textContent = clientNameEl.value || '-';
        pdfClientWhatsappEl.textContent = whatsappNumberEl.value || '-';
        pdfClientRfcEl.textContent = clientRfcEl.value || 'XAXX010101000';
        pdfClientDirEl.textContent = clientDirEl.value || '-';
        pdfComentarioEl.textContent = comentarioEl.value || '-';

        pdfQuoteBodyEl.innerHTML = ''; // Limpiar tabla PDF
        let pdfSubtotal = 0;
        const discountPercent = parseFloat(priceLevelEl.value) || 0;

        quoteItems.forEach((item, index) => {
            const unitPrice = calculateDiscountedPrice(item.precioBase, discountPercent);
            const itemTotal = unitPrice * item.quantity;
            pdfSubtotal += itemTotal;
            const row = document.createElement('tr');
            // <<< AJUSTE PDF: Asegura que las celdas tengan borde y padding correctos >>>
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
            margin: [8, 8, 12, 8], // Aumentar un poco margen
            filename: pdfFilename, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        element.classList.remove('hidden'); element.style.display = 'block'; // Mostrar para renderizar
        console.log("Generando PDF..."); // Log para saber que se intenta
        html2pdf().from(element).set(opt).save().then(() => {
            console.log("PDF generado.");
            element.style.display = 'none'; element.classList.add('hidden'); // Ocultar de nuevo
        }).catch(err => {
            console.error("Error generando PDF:", err); element.style.display = 'none'; element.classList.add('hidden');
            alert("Error al generar PDF. Revisa la consola (F12).");
        });
    } // Fin generatePdf

    function generateWhatsAppMessage() { /* ... igual ... */ }
    function sendWhatsApp() { /* ... igual ... */ }

    // --- Event Listeners (igual que antes) ---
    let filterTimeout;
    filterClaveEl.addEventListener('input', () => { clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFiltersAndDisplay, 300); });
    filterDescripcionEl.addEventListener('input', () => { clearTimeout(filterTimeout); filterTimeout = setTimeout(applyFiltersAndDisplay, 300); });
    prevPageBtn.addEventListener('click', () => changePage('prev'));
    nextPageBtn.addEventListener('click', () => changePage('next'));
    productsBodyEl.addEventListener('click', (event) => {
        if (event.target.classList.contains('add-to-quote-btn')) {
            const button = event.target; const productId = button.dataset.productId;
            const quantityInput = productsBodyEl.querySelector(`input.product-quantity[data-product-id="${productId}"]`);
            const quantity = parseInt(quantityInput.value, 10);
            if (!isNaN(quantity) && quantity > 0) {
                addToQuote(productId, quantity);
                button.textContent = '✓'; button.classList.remove('bg-blue-500', 'hover:bg-blue-700');
                button.classList.add('bg-green-500', 'cursor-default'); button.disabled = true;
                setTimeout(() => {
                    button.textContent = '+'; button.classList.add('bg-blue-500', 'hover:bg-blue-700');
                    button.classList.remove('bg-green-500', 'cursor-default'); button.disabled = false;
                }, 800);
                quantityInput.value = 1;
            } else { alert("Cantidad inválida."); quantityInput.focus(); }
        }
    });
    quoteBodyEl.addEventListener('click', (event) => {
        if (event.target.classList.contains('remove-from-quote-btn')) { removeFromQuote(event.target.dataset.productId); }
    });
    priceLevelEl.addEventListener('change', updateQuoteDisplay);
    sendWhatsappBtn.addEventListener('click', sendWhatsApp);
    generatePdfBtn.addEventListener('click', generatePdf);

    // --- Inicialización ---
    quoteDateEl.value = new Date().toISOString().split('T')[0];
    loadProducts();

}); // Fin DOMContentLoaded
