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
                skipEmptyLines: 'greedy',
                encoding: "UTF-8",
                complete: (results) => {
                    console.log("Datos crudos:", results.data);

                    if (!results.data || results.data.length < 2) { /*...*/ } // Manejo de error igual

                    const dataRows = results.data.slice(1);
                    productMap.clear();
                    allProducts = dataRows
                        .map((row, index) => {
                            const clave = String(row[0] || '').trim();
                            const descripcion = String(row[1] || '').trim();
                            const precioStrRaw = String(row[2] || '0');
                            const precioStrClean = precioStrRaw.replace(/[$,\s]/g, '').replace(/,/g, '');
                            const precio = parseFloat(precioStrClean);
                            const internalId = `item-${index + 1}-${clave || Math.random().toString(16).slice(2)}`;

                            if (clave && descripcion && !isNaN(precio) && precio >= 0) {
                                const productData = {
                                    clave: clave, descripcion: descripcion, precioBase: precio,
                                    unidadMedida: 'PZA', id: internalId
                                };
                                productMap.set(internalId, productData);
                                return productData;
                            }
                            console.warn(`   -> Fila ${index + 2} IGNORADA. Datos:`, row);
                            return null;
                        })
                        .filter(p => p !== null);

                    if (allProducts.length === 0) { /*...*/ } // Manejo de error igual
                    else {
                        loadingStatusEl.textContent = `Productos cargados:`;
                        loadingStatusEl.className = 'status-success';
                        productCountInfoEl.textContent = `(${allProducts.length})`;
                        filterClaveEl.disabled = false;
                        filterDescripcionEl.disabled = false;
                        applyFiltersAndDisplay();
                    }
                },
                error: (error) => { /*...*/ } // Manejo de error igual
            });
        } catch (error) { /*...*/ } // Manejo de error igual
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
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-gray-500">No se encontraron productos con esos filtros.</td></tr>`;
        } else {
            pageProducts.forEach(product => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="align-top">${product.clave}</td>
                    <td class="align-top">${product.descripcion}</td>
                    <td class="text-right align-top">${formatCurrency(product.precioBase)}</td>
                    <td class="text-center align-top">
                        <input type="number" min="1" value="1" class="w-16 border rounded px-1 py-0.5 text-center text-sm product-quantity" data-product-id="${product.id}">
                    </td>
                    <td class="text-center align-top">
                        <button class="add-to-quote-btn bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition" data-product-id="${product.id}">+</button>
                    </td>
                `;
                productsBodyEl.appendChild(row);
            });
        }
        updatePagination(totalPages);
    }

     function updatePagination(totalPages) { /*...*/ } // Igual
     function changePage(direction) { /*...*/ } // Igual
     function addToQuote(productId, quantity) { /*...*/ } // Igual
     function removeFromQuote(productId) { /*...*/ } // Igual

    function updateQuoteDisplay() {
        quoteBodyEl.innerHTML = '';
        let subtotal = 0;
        const discountPercent = parseFloat(priceLevelEl.value) || 0;

        if (quoteItems.length === 0) {
            quoteBodyEl.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-400 text-xs">Añade productos...</td></tr>`;
        } else {
            quoteItems.forEach((item, index) => {
                const unitPrice = calculateDiscountedPrice(item.precioBase, discountPercent);
                const itemTotal = unitPrice * item.quantity;
                subtotal += itemTotal;
                const row = document.createElement('tr');
                // <<< AJUSTE VISIBILIDAD TABLA UI >>>
                // Añadimos clase 'quote-description' y 'title' a la descripción
                row.innerHTML = `
                    <td class="text-center">${index + 1}</td>
                    <td>${item.clave}</td>
                    <td class="quote-description" title="${item.descripcion}">${item.descripcion}</td> {/* Clase y title añadidos */}
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${item.unidadMedida}</td>
                    <td class="text-right">${formatCurrency(unitPrice)}</td>
                    <td class="text-center">${discountPercent}%</td>
                    <td class="text-right">${formatCurrency(itemTotal)}</td>
                    <td class="text-center">
                        <button class="remove-from-quote-btn text-red-500 hover:text-red-700 font-bold px-1" data-product-id="${item.id}">X</button> {/* Padding reducido */}
                    </td>
                `;
                quoteBodyEl.appendChild(row);
            });
        }

        const iva = subtotal * IVA_RATE;
        const total = subtotal + iva;
        quoteSubtotalEl.textContent = formatCurrency(subtotal);
        quoteIvaEl.textContent = formatCurrency(iva);
        quoteTotalEl.textContent = formatCurrency(total);
        const hasItems = quoteItems.length > 0;
        sendWhatsappBtn.disabled = !hasItems;
        generatePdfBtn.disabled = !hasItems;
    }

    function calculateDiscountedPrice(basePrice, discountPercent) { /*...*/ } // Igual
    function formatCurrency(value) { /*...*/ } // Igual
    function formatDate(dateString) { /*...*/ } // Igual

    function generatePdf() {
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
            // <<< AJUSTE PDF: Estilo para forzar salto de línea en descripción >>>
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px;">${item.clave}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px; word-wrap: break-word;">${item.descripcion}</td> {/* word-wrap añadido */}
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: center;">${item.quantity}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: center;">${item.unidadMedida}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: right;">${formatCurrency(unitPrice)}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: center;">${discountPercent}%</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: right;">${formatCurrency(itemTotal)}</td>
            `;
            pdfQuoteBodyEl.appendChild(row);
        });
        const pdfIva = pdfSubtotal * IVA_RATE;
        const pdfTotal = pdfSubtotal + pdfIva;
        pdfSubtotalEl.textContent = formatCurrency(pdfSubtotal); // Mantenemos el símbolo $
        pdfIvaEl.textContent = formatCurrency(pdfIva);
        pdfTotalEl.textContent = formatCurrency(pdfTotal);

        const element = document.getElementById('pdf-template');
        const pdfFilename = `Cotizacion_${(folioEl.value || 'SF').replace(/[^a-zA-Z0-9]/g, '_')}_${(clientNameEl.value || 'Cliente').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
        const opt = {
            margin: [5, 5, 10, 5], filename: pdfFilename, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };
        element.classList.remove('hidden'); element.style.display = 'block';
        html2pdf().from(element).set(opt).save().then(() => {
            element.style.display = 'none'; element.classList.add('hidden');
        }).catch(err => {
            console.error("Error PDF:", err); element.style.display = 'none'; element.classList.add('hidden');
            alert("Error al generar PDF. Revisa la consola (F12).");
        });
    }

     function generateWhatsAppMessage() { /*...*/ } // Igual
     function sendWhatsApp() { /*...*/ } // Igual

    // --- Event Listeners ---
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
