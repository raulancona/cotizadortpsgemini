document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración ---
    // <<< ¡ASEGÚRATE QUE ESTA URL SEA LA CORRECTA DE TU ARCHIVO RAW EN GITHUB! >>>
    const CSV_URL = 'https://raw.githubusercontent.com/raulancona/cotizadortpsgemini/refs/heads/main/Lista%20estandar%20Raul.csv'; // URL GitHub RAW
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

            // Añadir timestamp para evitar caché agresivo
            const urlWithTimestamp = `${CSV_URL}?t=${new Date().getTime()}`;
            const response = await fetch(urlWithTimestamp); // Fetch desde GitHub
            if (!response.ok) throw new Error(`Error HTTP ${response.status} al cargar CSV desde GitHub.`);
            const csvText = await response.text();

            Papa.parse(csvText, {
                // header: true, // Comentado, leemos por índice
                skipEmptyLines: 'greedy',
                encoding: "UTF-8",
                complete: (results) => {
                    console.log("Datos crudos de PapaParse:", results.data);

                    if (!results.data || results.data.length < 2) {
                        loadingStatusEl.textContent = `Error: Archivo CSV vacío o solo con encabezados.`;
                        loadingStatusEl.className = 'status-error';
                        productCountInfoEl.textContent = '(0 productos)';
                        productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-red-600">El archivo CSV parece estar vacío o no tiene datos de productos.</td></tr>`;
                        return;
                    }

                    const dataRows = results.data.slice(1); // Ignora la fila de encabezados

                    productMap.clear();
                    allProducts = dataRows
                        .map((row, index) => {
                            // Leyendo por ÍNDICE DE COLUMNA (0=Clave, 1=Desc, 2=Precio)
                            const clave = String(row[0] || '').trim();
                            const descripcion = String(row[1] || '').trim();
                            const precioStrRaw = String(row[2] || '0');
                            // const unidadMedida = String(row[3] || 'PZA').trim(); // Si tuvieras columna UM

                            const precioStrClean = precioStrRaw.replace(/[$,\s]/g, '').replace(/,/g, '');
                            const precio = parseFloat(precioStrClean);
                            const internalId = `item-${index + 1}-${clave || Math.random().toString(16).slice(2)}`;

                            if (clave && descripcion && !isNaN(precio) && precio >= 0) {
                                const productData = {
                                    clave: clave,
                                    descripcion: descripcion,
                                    precioBase: precio,
                                    unidadMedida: 'PZA', // Asume PZA
                                    // unidadMedida: unidadMedida, // Si tuvieras columna UM
                                    id: internalId
                                };
                                productMap.set(internalId, productData);
                                return productData;
                            }
                            console.warn(`   -> Fila ${index + 2} IGNORADA. Datos:`, row);
                            return null;
                        })
                        .filter(p => p !== null);

                    if (allProducts.length === 0) {
                        loadingStatusEl.textContent = `Error: No se cargaron productos válidos.`;
                        loadingStatusEl.className = 'status-warning';
                        productCountInfoEl.textContent = `(0 productos - Revisa datos CSV)`;
                        productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-orange-600">No se pudo procesar ningún producto válido. Verifica el contenido y formato del archivo CSV.</td></tr>`;
                    } else {
                        loadingStatusEl.textContent = `Productos cargados:`;
                        loadingStatusEl.className = 'status-success';
                        productCountInfoEl.textContent = `(${allProducts.length})`;
                        filterClaveEl.disabled = false;
                        filterDescripcionEl.disabled = false;
                        applyFiltersAndDisplay();
                    }
                },
                error: (error) => {
                    console.error('Error al parsear CSV:', error);
                    loadingStatusEl.textContent = `Error al procesar CSV: ${error.message}`;
                    loadingStatusEl.className = 'status-error';
                    productCountInfoEl.textContent = '(Error de parseo)';
                }
            });
        } catch (error) {
            console.error('Error al cargar productos:', error);
            loadingStatusEl.textContent = `Error al cargar desde GitHub: ${error.message}`;
            loadingStatusEl.className = 'status-error';
            productCountInfoEl.textContent = '(Error de carga)';
            productsBodyEl.innerHTML = `<tr><td colspan="5" class="text-center p-5 text-red-600">No se pudo cargar la lista. Verifica la URL del CSV y tu conexión a Internet.</td></tr>`;
        }
    } // Fin loadProducts

    // --- Resto de funciones (igual que antes) ---
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
                    <td>${product.clave}</td>
                    <td>${product.descripcion}</td>
                    <td class="text-right">${formatCurrency(product.precioBase)}</td>
                    <td class="text-center">
                        <input type="number" min="1" value="1" class="w-16 border rounded px-1 py-0.5 text-center text-sm product-quantity" data-product-id="${product.id}">
                    </td>
                    <td class="text-center">
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
            quoteBodyEl.innerHTML = `<tr><td colspan="9" class="text-center p-4 text-gray-400">Añade productos...</td></tr>`;
        } else {
            quoteItems.forEach((item, index) => {
                const unitPrice = calculateDiscountedPrice(item.precioBase, discountPercent);
                const itemTotal = unitPrice * item.quantity;
                subtotal += itemTotal;
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td class="text-center">${index + 1}</td>
                    <td>${item.clave}</td>
                    <td>${item.descripcion}</td>
                    <td class="text-center">${item.quantity}</td>
                    <td class="text-center">${item.unidadMedida}</td>
                    <td class="text-right">${formatCurrency(unitPrice)}</td>
                    <td class="text-center">${discountPercent}%</td>
                    <td class="text-right">${formatCurrency(itemTotal)}</td>
                    <td class="text-center">
                        <button class="remove-from-quote-btn text-red-500 hover:text-red-700 font-bold text-xs px-1" data-product-id="${item.id}">X</button>
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
                <td class="border border-gray-300 px-1 py-0.5 text-center">${index + 1}</td>
                <td class="border border-gray-300 px-1 py-0.5">${item.clave}</td>
                <td class="border border-gray-300 px-1 py-0.5">${item.descripcion}</td>
                <td class="border border-gray-300 px-1 py-0.5 text-center">${item.quantity}</td>
                <td class="border border-gray-300 px-1 py-0.5 text-center">${item.unidadMedida}</td>
                <td class="border border-gray-300 px-1 py-0.5 text-right">${formatCurrency(unitPrice)}</td>
                <td class="border border-gray-300 px-1 py-0.5 text-center">${discountPercent}%</td>
                <td class="border border-gray-300 px-1 py-0.5 text-right">${formatCurrency(itemTotal)}</td>
            `;
            pdfQuoteBodyEl.appendChild(row);
        });
        const pdfIva = pdfSubtotal * IVA_RATE;
        const pdfTotal = pdfSubtotal + pdfIva;
        pdfSubtotalEl.textContent = formatCurrency(pdfSubtotal).replace('MX$', '');
        pdfIvaEl.textContent = formatCurrency(pdfIva).replace('MX$', '');
        pdfTotalEl.textContent = formatCurrency(pdfTotal).replace('MX$', '');

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

     function generateWhatsAppMessage() {
        const client = clientNameEl.value || 'Cliente';
        const date = formatDate(quoteDateEl.value);
        const folio = folioEl.value || 'S/F';
        const ref = referenciaEl.value || 'N/A';
        const discountLevel = priceLevelEl.options[priceLevelEl.selectedIndex].text;
        const discountPercent = parseFloat(priceLevelEl.value) || 0;
        let message = `*COTIZACIÓN TPS*\n\n`;
        message += `*Folio:* ${folio} | *Fecha:* ${date}\n`;
        message += `*Cliente:* ${client}\n`;
        if (referenciaEl.value) message += `*Referencia:* ${ref}\n`;
        if (operadorEl.value) message += `*Operador:* ${operadorEl.value}\n`;
        message += `*Nivel Precio:* ${discountLevel}\n\n*Partidas:*\n-------------------------------------\n`;
        let subtotal = 0;
        quoteItems.forEach((item, index) => {
            const unitPrice = calculateDiscountedPrice(item.precioBase, discountPercent);
            const itemTotal = unitPrice * item.quantity;
            subtotal += itemTotal;
            message += `${index + 1}. *${item.clave}* - ${item.descripcion}\n   Cant: ${item.quantity} ${item.unidadMedida} | PU: ${formatCurrency(unitPrice)} | Importe: ${formatCurrency(itemTotal)}\n----\n`;
        });
        const iva = subtotal * IVA_RATE;
        const total = subtotal + iva;
        message += `-------------------------------------\n*Subtotal:* ${formatCurrency(subtotal)}\n*IVA (16%):* ${formatCurrency(iva)}\n*TOTAL:* *${formatCurrency(total)}*\n\n`;
        if (comentarioEl.value) message += `*Comentario:* ${comentarioEl.value}\n\n`;
        message += `_Precios sujetos a cambio. Vigencia 15 días._\nTecnología en Pinturas TPS`;
        return message;
    }

    function sendWhatsApp() {
        if (quoteItems.length === 0) return;
        let phone = whatsappNumberEl.value.replace(/\D/g, '');
        if (!phone || phone.length < 10) { alert('Número de WhatsApp inválido (10 dígitos MX).'); whatsappNumberEl.focus(); return; }
        if (phone.length === 10 && !phone.startsWith('52')) { phone = `52${phone}`; }
        else if (phone.length === 12 && phone.startsWith('521')) { phone = `52${phone.substring(3)}`; }
        else if (phone.length !== 12 || !phone.startsWith('52')) { alert('Formato incorrecto. Debe ser 52 + 10 dígitos.'); whatsappNumberEl.focus(); return; }
        const message = generateWhatsAppMessage();
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    }

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
