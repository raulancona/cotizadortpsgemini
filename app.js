document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración ---
    // <<< ¡CONFIRMA LA URL RAW CORRECTA! >>>
    const CSV_URL = 'https://raw.githubusercontent.com/raulancona/cotizadortpsgemini/main/Lista%20estandar%20Raul.csv';
    const ITEMS_PER_PAGE = 20;
    const IVA_RATE = 0.16;

    // --- Estado ---
    let allProducts = [];
    let filteredProducts = [];
    let quoteItems = [];
    let currentPage = 1;
    let productMap = new Map();

    // --- Selectores del DOM (Igual que antes) ---
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
                header: true, // Volvemos a usar encabezados
                skipEmptyLines: 'greedy',
                encoding: "UTF-8", // Maneja BOM
                transformHeader: header => header.trim(), // Limpia espacios encabezado
                complete: (results) => {
                    if (results.errors.length > 0) {
                        console.warn("Errores de parseo:", results.errors);
                        // Manejo de error... (igual que antes)
                    }

                    console.log("Resultados de PapaParse (con encabezados):", results); // Log para ver las keys

                    productMap.clear();
                    allProducts = results.data
                        .map((p, index) => {
                            // --- VOLVIENDO A LEER POR NOMBRE DE COLUMNA (del CSV corregido) ---
                            // Asegúrate que tu CSV tenga EXACTAMENTE estos encabezados en la primera línea:
                            // Clave,Descripcion,PrecioPublico
                            const clave = String(p.Clave || '').trim();
                            const descripcion = String(p.Descripcion || '').trim();
                            const precioStrRaw = String(p.PrecioPublico || '0');
                            const unidadMedida = String(p.UnidadMedida || 'PZA').trim(); // Si tienes esta columna

                            // --- Limpieza de Precio (Importante) ---
                            const precioStrClean = precioStrRaw.replace(/[$,\s]/g, '').replace(/,/g, '');
                            const precio = parseFloat(precioStrClean);
                            // --------------------------------------

                            const internalId = `item-${index}-${clave || Math.random().toString(16).slice(2)}`;

                            // --- Validación y Log Detallado ---
                            const isClaveValid = !!clave;
                            const isDescValid = !!descripcion;
                            const isPrecioValid = !isNaN(precio) && precio >= 0;
                            console.log(`Fila ${index + 2}: Clave='${clave}'(${isClaveValid}), Desc='${descripcion.substring(0,20)}...'(${isDescValid}), PrecioRaw='${precioStrRaw}', PrecioNum=${precio}(${isPrecioValid})`);
                            // --- Fin Log ---

                            if (isClaveValid && isDescValid && isPrecioValid) {
                                const productData = {
                                    clave: clave,
                                    descripcion: descripcion,
                                    precioBase: precio, // Asigna el número limpio
                                    unidadMedida: unidadMedida,
                                    id: internalId
                                };
                                productMap.set(internalId, productData);
                                return productData;
                            }
                            console.warn(`   -> Fila ${index + 2} IGNORADA.`);
                            return null;
                        })
                        .filter(p => p !== null);

                    // --- Lógica de éxito/error (igual que antes) ---
                    if (allProducts.length === 0) {
                        loadingStatusEl.textContent = `Error: No se cargaron productos válidos.`;
                        loadingStatusEl.className = 'status-warning';
                        productCountInfoEl.textContent = `(0 productos - Revisa CSV/Consola)`;
                        productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-orange-600">No se pudo procesar ningún producto válido. Revisa la consola (F12) para ver detalles de filas ignoradas y verifica el formato/contenido del CSV.</td></tr>`;
                    } else {
                        loadingStatusEl.textContent = `Productos cargados:`;
                        loadingStatusEl.className = 'status-success';
                        productCountInfoEl.textContent = `(${allProducts.length})`;
                        filterClaveEl.disabled = false;
                        filterDescripcionEl.disabled = false;
                        applyFiltersAndDisplay();
                    }
                },
                error: (error) => { /* ... (Manejo de error igual) ... */ }
            });
        } catch (error) { /* ... (Manejo de error igual) ... */ }
    } // Fin loadProducts

    // --- Resto de funciones (sin cambios desde la respuesta anterior) ---
    // (applyFiltersAndDisplay, displayCatalogPage, updatePagination, changePage,
    //  addToQuote, removeFromQuote, updateQuoteDisplay, calculateDiscountedPrice,
    //  formatCurrency, formatDate, generatePdf, generateWhatsAppMessage, sendWhatsApp)
    // ... (Asegúrate de que el resto del código esté presente aquí) ...
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
                    <td class="text-right align-top">${formatCurrency(product.precioBase)}</td> {/* AQUÍ SE USA precioBase */}
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

     function updatePagination(totalPages) {
        pageInfoEl.textContent = `Página ${currentPage} / ${totalPages > 0 ? totalPages : 1}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
    }

    function changePage(direction) {
        const totalPages = Math.ceil(filteredProducts.length / ITEMS_PER_PAGE);
        if (direction === 'next' && currentPage < totalPages) {
            currentPage++;
        } else if (direction === 'prev' && currentPage > 1) {
            currentPage--;
        }
        displayCatalogPage();
    }

    function addToQuote(productId, quantity) {
        const product = productMap.get(productId);
        if (!product || quantity <= 0) return;
        const existingItem = quoteItems.find(item => item.id === productId);
        if (existingItem) {
            existingItem.quantity += quantity;
        } else {
            quoteItems.push({ ...product, quantity: quantity });
        }
        updateQuoteDisplay();
    }

    function removeFromQuote(productId) {
        quoteItems = quoteItems.filter(item => item.id !== productId);
        updateQuoteDisplay();
    }

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
                row.innerHTML = `
                    <td class="text-center">${index + 1}</td>
                    <td>${item.clave}</td>
                    <td class="quote-description" title="${item.descripcion}">${item.descripcion}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${item.unidadMedida}</td>
                    <td class="text-right">${formatCurrency(unitPrice)}</td>
                    <td class="text-center">${discountPercent}%</td>
                    <td class="text-right">${formatCurrency(itemTotal)}</td>
                    <td class="text-center">
                        <button class="remove-from-quote-btn text-red-500 hover:text-red-700 font-bold px-1" data-product-id="${item.id}">X</button>
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

    function calculateDiscountedPrice(basePrice, discountPercent) {
        const discount = Number(discountPercent) / 100;
        return Number(basePrice) * (1 - discount);
    }

    function formatCurrency(value) {
        const number = Number(value);
        if (isNaN(number)) return '$0.00';
        return number.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' });
    }

    function formatDate(dateString) {
        if (!dateString || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) return new Date().toLocaleDateString('es-MX');
        try {
             const date = new Date(dateString + 'T00:00:00');
            return date.toLocaleDateString('es-MX', { day: '2-digit', month: '2-digit', year: 'numeric' });
        } catch (e) { return new Date().toLocaleDateString('es-MX'); }
    }

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
            row.innerHTML = `
                <td style="border: 1px solid #ccc; padding: 2px 3px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px;">${item.clave}</td>
                <td style="border: 1px solid #ccc; padding: 2px 3px; word-wrap: break-word;">${item.descripcion}</td>
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
        pdfSubtotalEl.textContent = formatCurrency(pdfSubtotal);
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
