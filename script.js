document.addEventListener('DOMContentLoaded', () => {
    const STORAGE_KEY = 'dtf-roll-last-config';
    const SETTINGS_KEY = 'dtf-roll-settings';
    const PALETTE = ['#ff5f6d', '#ffc371', '#38bdf8', '#34d399', '#f472b6', '#f59e0b', '#22c55e', '#60a5fa'];
    const QUICK_PRESETS_CM = {
        frente: {
            pequeno: {name: 'Frente pequeño', width: 9, height: 12},
            mediano: {name: 'Frente mediano', width: 11, height: 16},
            grande: {name: 'Frente grande', width: 14, height: 20},
        },
        espalda: {
            pequeno: {name: 'Espalda pequeña', width: 20, height: 25},
            mediano: {name: 'Espalda mediana', width: 28, height: 35},
            grande: {name: 'Espalda grande', width: 30, height: 40},
        },
    };
    const STANDARD_WIDTHS_MM = [300, 450, 600];
    const BILLING_STEP_METERS = 0.1;
    const DEFAULT_SETTINGS = {
        safetySideMm: 10,
        defaultSpacingMm: 5,
        fixedCost: 0,
        prices: {
            300: 0,
            450: 0,
            600: 0,
        },
    };

    const form = document.getElementById('calc-form');
    const resultSection = document.getElementById('result');
    const designList = document.getElementById('design-list');
    const rowTemplate = document.getElementById('design-row-template');
    const addDesignButton = document.getElementById('add-design');
    const quickAddPanel = document.getElementById('quick-add-panel');
    const closeQuickAddButton = document.getElementById('close-quick-add');
    const confirmQuickAddButton = document.getElementById('confirm-quick-add');
    const manualQuickAddButton = document.getElementById('manual-quick-add');
    const quickQuantityInput = document.getElementById('quick-quantity');
    const quickPositionGroup = document.getElementById('quick-position-group');
    const quickSizeGroup = document.getElementById('quick-size-group');
    const unitSelect = document.getElementById('unit-system');
    const resetButton = document.getElementById('reset-form');
    const unitLabels = Array.from(document.querySelectorAll('[data-unit-label]'));
    const rollPresetButtons = Array.from(document.querySelectorAll('.roll-preset'));
    const usableWidthNote = document.getElementById('usable-width-note');
    const pricingSourceNote = document.getElementById('pricing-source-note');
    const appliedLinearPriceInput = document.getElementById('applied-linear-price');
    const appliedFixedCostInput = document.getElementById('applied-fixed-cost');
    const settingsPanel = document.getElementById('settings-panel');
    const openSettingsButton = document.getElementById('open-settings');
    const closeSettingsButton = document.getElementById('close-settings');
    const saveSettingsButton = document.getElementById('save-settings');
    const resetSettingsButton = document.getElementById('reset-settings');
    const clearLocalDataButton = document.getElementById('clear-local-data');
    const settingsStatus = document.getElementById('settings-status');
    const installStatus = document.getElementById('install-status');
    const connectionStatus = document.getElementById('connection-status');
    const installAppButton = document.getElementById('install-app');

    let previousUnit = unitSelect.value;
    let currentCalculation = null;
    let quickSelection = {position: 'frente', size: 'pequeno'};
    let currentSettings = loadSettings();
    let deferredInstallPrompt = null;

    initialize();

    function initialize() {
        registerServiceWorker();
        syncSettingsInputsFromState(currentSettings, unitSelect.value);

        const stored = loadStoredState();
        if (stored && Array.isArray(stored.designs) && stored.designs.length > 0) {
            setFormValues(stored);
        } else {
            applyDefaultFormValues();
            renderDesignRows(getDefaultDesigns());
        }

        updateUnitLabels(unitSelect.value);
        updateRollPresetLabels(unitSelect.value);
        previousUnit = unitSelect.value;
        updateOperationalNotes();
        updateConnectionStatus();
        updateInstallUi();
        attachEvents();
        markResultsAsStale('Configuración lista. Pulsa Calcular acomodo para actualizar el resultado.');
    }

    function attachEvents() {
        form.addEventListener('submit', (event) => {
            event.preventDefault();
            calculate();
        });

        form.addEventListener('input', () => {
            persistCurrentForm();
            updateOperationalNotes();
            markResultsAsStale();
        });

        unitSelect.addEventListener('change', () => {
            convertDisplayedUnits(previousUnit, unitSelect.value);
            updateUnitLabels(unitSelect.value);
            updateRollPresetLabels(unitSelect.value);
            previousUnit = unitSelect.value;
            persistCurrentForm();
            updateOperationalNotes();
            markResultsAsStale('Unidad actualizada. Pulsa Calcular acomodo para recalcular.');
        });

        addDesignButton.addEventListener('click', () => {
            quickAddPanel.classList.remove('is-hidden');
        });

        closeQuickAddButton.addEventListener('click', () => {
            quickAddPanel.classList.add('is-hidden');
        });

        quickPositionGroup.addEventListener('click', (event) => {
            const button = event.target.closest('[data-position]');
            if (!button) {
                return;
            }

            quickSelection.position = button.dataset.position;
            setActiveSegment(quickPositionGroup, button);
        });

        quickSizeGroup.addEventListener('click', (event) => {
            const button = event.target.closest('[data-size]');
            if (!button) {
                return;
            }

            quickSelection.size = button.dataset.size;
            setActiveSegment(quickSizeGroup, button);
        });

        confirmQuickAddButton.addEventListener('click', () => {
            const quantity = Math.max(1, parseInt(quickQuantityInput.value, 10) || 1);
            const preset = QUICK_PRESETS_CM[quickSelection.position][quickSelection.size];
            appendDesignRow({
                name: preset.name,
                width: convertPresetLengthFromCm(preset.width),
                height: convertPresetLengthFromCm(preset.height),
                quantity,
            });
            quickQuantityInput.value = '1';
            quickAddPanel.classList.add('is-hidden');
            persistCurrentForm();
            markResultsAsStale('Diseño agregado. Pulsa Calcular acomodo para actualizar el plano.');
        });

        manualQuickAddButton.addEventListener('click', () => {
            appendDesignRow({name: '', width: '', height: '', quantity: 1});
            quickAddPanel.classList.add('is-hidden');
            persistCurrentForm();
            markResultsAsStale('Fila agregada. Pulsa Calcular acomodo para actualizar el plano.');
        });

        designList.addEventListener('click', (event) => {
            const button = event.target.closest('.remove-design');
            if (!button) {
                return;
            }

            const row = button.closest('.design-row');
            if (designList.children.length === 1) {
                row.querySelector('.design-name').value = '';
                row.querySelector('.design-width').value = '';
                row.querySelector('.design-height').value = '';
                row.querySelector('.design-quantity').value = '0';
            } else {
                row.remove();
            }

            persistCurrentForm();
            markResultsAsStale('Diseño actualizado. Pulsa Calcular acomodo para recalcular.');
        });

        rollPresetButtons.forEach((button) => {
            button.addEventListener('click', () => {
                document.getElementById('roll-width').value = displayLengthFromMm(parseFloat(button.dataset.widthMm), unitSelect.value);
                persistCurrentForm();
                updateOperationalNotes();
                markResultsAsStale('Ancho aplicado. Pulsa Calcular acomodo para recalcular.');
            });
        });

        openSettingsButton.addEventListener('click', () => {
            openSettingsPanel();
        });

        closeSettingsButton.addEventListener('click', () => {
            closeSettingsPanel();
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && !settingsPanel.classList.contains('is-hidden')) {
                closeSettingsPanel();
            }
        });

        document.addEventListener('click', (event) => {
            if (settingsPanel.classList.contains('is-hidden')) {
                return;
            }

            const clickedInsidePanel = settingsPanel.contains(event.target);
            const clickedOpenButton = openSettingsButton.contains(event.target);
            if (!clickedInsidePanel && !clickedOpenButton) {
                closeSettingsPanel();
            }
        });

        saveSettingsButton.addEventListener('click', () => {
            const nextSettings = collectSettingsFromInputs();
            if (nextSettings.safetySideMm < 0 || nextSettings.defaultSpacingMm < 0) {
                setSettingsStatus('Los valores de seguridad y separación no pueden ser negativos.');
                return;
            }

            currentSettings = nextSettings;
            if (!setStorageJson(SETTINGS_KEY, currentSettings)) {
                setSettingsStatus('No se pudo guardar la configuración local en este navegador.');
                return;
            }
            document.getElementById('margin').value = displayLengthFromMm(currentSettings.defaultSpacingMm, unitSelect.value);
            updateOperationalNotes();
            persistCurrentForm();
            markResultsAsStale('Configuración guardada. Pulsa Calcular acomodo para actualizar con los nuevos parámetros.');
            setSettingsStatus('Configuración guardada en este navegador.');
        });

        resetSettingsButton.addEventListener('click', () => {
            currentSettings = cloneSettings(DEFAULT_SETTINGS);
            syncSettingsInputsFromState(currentSettings, unitSelect.value);
            document.getElementById('margin').value = displayLengthFromMm(currentSettings.defaultSpacingMm, unitSelect.value);
            if (!setStorageJson(SETTINGS_KEY, currentSettings)) {
                setSettingsStatus('No se pudo restaurar la configuración base en el almacenamiento local.');
                return;
            }
            updateOperationalNotes();
            persistCurrentForm();
            markResultsAsStale('Configuración base restaurada. Pulsa Calcular acomodo para recalcular.');
            setSettingsStatus('Configuración base restaurada.');
        });

        clearLocalDataButton.addEventListener('click', () => {
            clearLocalAppData();
            currentSettings = cloneSettings(DEFAULT_SETTINGS);
            syncSettingsInputsFromState(currentSettings, unitSelect.value);
            applyDefaultFormValues();
            renderDesignRows(getDefaultDesigns());
            updateUnitLabels(unitSelect.value);
            updateRollPresetLabels(unitSelect.value);
            previousUnit = unitSelect.value;
            updateOperationalNotes();
            markResultsAsStale('Datos locales borrados. La app volvió a la configuración inicial.');
            setSettingsStatus('Datos locales eliminados en este navegador.');
        });

        resetButton.addEventListener('click', () => {
            applyDefaultFormValues();
            renderDesignRows(getDefaultDesigns());
            updateUnitLabels(unitSelect.value);
            updateRollPresetLabels(unitSelect.value);
            previousUnit = unitSelect.value;
            updateOperationalNotes();
            persistCurrentForm();
            currentCalculation = null;
            setResultPlaceholder('Se restauró la configuración por defecto. Pulsa Calcular acomodo para generar un nuevo plano.');
        });

        window.addEventListener('online', updateConnectionStatus);
        window.addEventListener('offline', updateConnectionStatus);

        window.addEventListener('beforeinstallprompt', (event) => {
            event.preventDefault();
            deferredInstallPrompt = event;
            updateInstallUi();
        });

        window.addEventListener('appinstalled', () => {
            deferredInstallPrompt = null;
            updateInstallUi(true);
        });

        installAppButton?.addEventListener('click', async () => {
            if (!deferredInstallPrompt) {
                return;
            }

            deferredInstallPrompt.prompt();
            try {
                await deferredInstallPrompt.userChoice;
            } catch {
                // Si el navegador cancela o no expone la respuesta, solo refrescamos el estado.
            }
            deferredInstallPrompt = null;
            updateInstallUi();
        });
    }

    function applyDefaultFormValues() {
        unitSelect.value = 'cm';
        document.getElementById('roll-width').value = '60';
        document.getElementById('margin').value = displayLengthFromMm(currentSettings.defaultSpacingMm, 'cm');
        document.getElementById('allow-rotate').checked = true;
        document.getElementById('profit-margin').value = '30';
    }

    function getDefaultDesigns() {
        return [
            {name: 'Frente pequeño', width: 9, height: 12, quantity: 12},
            {name: 'Espalda mediana', width: 28, height: 35, quantity: 4},
        ];
    }

    function setFormValues(values) {
        unitSelect.value = values.unitSystem === 'mm' ? 'mm' : 'cm';
        document.getElementById('roll-width').value = values.rollWidth ?? displayLengthFromMm(600, unitSelect.value);
        document.getElementById('margin').value = values.margin ?? displayLengthFromMm(currentSettings.defaultSpacingMm, unitSelect.value);
        document.getElementById('allow-rotate').checked = values.allowRotate !== false;
        document.getElementById('profit-margin').value = values.profitMargin ?? '30';
        renderDesignRows(Array.isArray(values.designs) && values.designs.length > 0 ? values.designs : getDefaultDesigns());
    }

    function renderDesignRows(designs) {
        designList.innerHTML = '';
        designs.forEach((design) => appendDesignRow(design));
    }

    function appendDesignRow(design) {
        const fragment = rowTemplate.content.cloneNode(true);
        const row = fragment.querySelector('.design-row');
        row.querySelector('.design-name').value = design.name ?? '';
        row.querySelector('.design-width').value = design.width ?? '';
        row.querySelector('.design-height').value = design.height ?? '';
        row.querySelector('.design-quantity').value = design.quantity ?? 1;
        designList.appendChild(row);
    }

    function calculate() {
        const state = collectFormState();
        const data = normalizeFormData(state, currentSettings);
        const validationMessage = validateInputs(data);
        if (validationMessage) {
            currentCalculation = null;
            resultSection.innerHTML = `<p class="placeholder">${escapeHtml(validationMessage)}</p>`;
            return;
        }

        persistCurrentForm();

        const simpleLayout = computeSimpleLayout(data);
        const optimizedLayout = computeOptimizedLayout(data, simpleLayout);
        const activeLayout = optimizedLayout;

        if (activeLayout.error) {
            currentCalculation = null;
            resultSection.innerHTML = `<p class="placeholder">${escapeHtml(activeLayout.error)}</p>`;
            return;
        }

        const pricing = computePricing(data, activeLayout.usedLength);
        const widthRecommendations = computeWidthRecommendations(state, currentSettings);

        currentCalculation = {
            data,
            simpleLayout,
            optimizedLayout,
            activeLayout,
            pricing,
            widthRecommendations,
        };

        renderResult(currentCalculation);
        attachResultActions();
        drawPreview(activeLayout, data);
        setSettingsStatus('Cálculo actualizado.');
    }

    function collectFormState() {
        return {
            unitSystem: unitSelect.value,
            rollWidth: readNumber('roll-width'),
            margin: readNumber('margin', displayLengthFromMm(currentSettings.defaultSpacingMm, unitSelect.value)),
            allowRotate: document.getElementById('allow-rotate').checked,
            mode: 'optimized',
            profitMargin: readNumber('profit-margin', 30),
            designs: Array.from(designList.querySelectorAll('.design-row')).map((row) => ({
                name: row.querySelector('.design-name').value.trim(),
                width: parseFloat(row.querySelector('.design-width').value),
                height: parseFloat(row.querySelector('.design-height').value),
                quantity: parseInt(row.querySelector('.design-quantity').value, 10),
            })),
        };
    }

    function normalizeFormData(state, settings) {
        const factor = state.unitSystem === 'cm' ? 10 : 1;
        const nominalRollWidth = state.rollWidth * factor;
        const usableRollWidth = Math.max(0, nominalRollWidth - (settings.safetySideMm * 2));
        const appliedPricing = resolvePricingForWidth(nominalRollWidth, settings, state.unitSystem);

        return {
            ...state,
            rollWidth: nominalRollWidth,
            usableRollWidth,
            safetySideMm: settings.safetySideMm,
            margin: state.margin * factor,
            profitMargin: Number.isFinite(state.profitMargin) ? state.profitMargin : 30,
            fixedCost: settings.fixedCost,
            appliedLinearPrice: appliedPricing.price,
            appliedPricingWidthMm: appliedPricing.referenceWidthMm,
            pricingSourceLabel: appliedPricing.label,
            designs: state.designs
                .map((design, index) => ({
                    id: `design-${index + 1}`,
                    name: design.name || `Diseño ${index + 1}`,
                    width: (Number.isFinite(design.width) ? design.width : 0) * factor,
                    height: (Number.isFinite(design.height) ? design.height : 0) * factor,
                    quantity: Number.isFinite(design.quantity) ? Math.max(0, Math.round(design.quantity)) : 0,
                    color: PALETTE[index % PALETTE.length],
                }))
                .filter((design) => design.quantity > 0),
        };
    }

    function validateInputs(data) {
        if (data.rollWidth <= 0) {
            return 'El ancho del rollo debe ser mayor a cero.';
        }

        if (data.usableRollWidth <= 0) {
            return 'El ancho útil quedó en cero o negativo. Reduce el margen de seguridad o aumenta el ancho del rollo.';
        }

        if (data.margin < 0) {
            return 'La separación mínima no puede ser negativa.';
        }

        if (data.designs.length === 0) {
            return 'Debes ingresar al menos un diseño con cantidad mayor a cero.';
        }

        const invalidDesign = data.designs.find((design) => design.width <= 0 || design.height <= 0);
        if (invalidDesign) {
            return `El diseño "${invalidDesign.name}" debe tener ancho y alto mayores a cero.`;
        }

        return '';
    }

    function computeSimpleLayout(data) {
        let currentY = 0;
        const placements = [];
        let rotatedCount = 0;

        for (let designIndex = 0; designIndex < data.designs.length; designIndex += 1) {
            const design = data.designs[designIndex];
            const orientation = chooseSimpleOrientation(design, data.usableRollWidth, data.margin, data.allowRotate);
            if (!orientation) {
                return {error: `El diseño "${design.name}" no cabe dentro del ancho útil del rollo.`};
            }

            const columns = fitAcross(data.usableRollWidth, orientation.width, data.margin);
            const rows = Math.ceil(design.quantity / columns);

            for (let index = 0; index < design.quantity; index += 1) {
                const row = Math.floor(index / columns);
                const column = index % columns;
                const x = column * (orientation.width + data.margin);
                const y = currentY + row * (orientation.height + data.margin);

                placements.push({
                    x,
                    y,
                    width: orientation.width,
                    height: orientation.height,
                    rotated: orientation.rotated,
                    designId: design.id,
                    designName: design.name,
                    color: design.color,
                });
            }

            if (orientation.rotated) {
                rotatedCount += design.quantity;
            }

            const blockLength = rows > 0 ? (rows * orientation.height) + ((rows - 1) * data.margin) : 0;
            currentY += blockLength;
            if (designIndex < data.designs.length - 1) {
                currentY += data.margin;
            }
        }

        return summarizeLayout({
            label: 'Simple por bloques',
            placements,
            nominalRollWidth: data.rollWidth,
            rollWidth: data.usableRollWidth,
            usedLength: currentY,
            rotatedCount,
            normalCount: placements.length - rotatedCount,
            arrangement: `${data.designs.length} bloque(s) secuenciales`,
        });
    }

    function chooseSimpleOrientation(design, usableRollWidth, margin, allowRotate) {
        const options = [{width: design.width, height: design.height, rotated: false}];
        if (allowRotate && design.width !== design.height) {
            options.push({width: design.height, height: design.width, rotated: true});
        }

        const valid = options
            .map((option) => {
                const columns = fitAcross(usableRollWidth, option.width, margin);
                if (columns <= 0) {
                    return null;
                }

                const rows = Math.ceil(design.quantity / columns);
                const usedLength = rows > 0 ? (rows * option.height) + ((rows - 1) * margin) : 0;
                return {...option, columns, rows, usedLength};
            })
            .filter(Boolean);

        if (valid.length === 0) {
            return null;
        }

        valid.sort((left, right) => {
            if (left.usedLength !== right.usedLength) {
                return left.usedLength - right.usedLength;
            }
            return right.columns - left.columns;
        });

        return valid[0];
    }

    function computeOptimizedLayout(data, simpleLayout) {
        if (simpleLayout?.error) {
            return simpleLayout;
        }

        const pieces = expandDesigns(data.designs);
        const sorters = [
            (left, right) => Math.max(right.width, right.height) - Math.max(left.width, left.height),
            (left, right) => (right.width * right.height) - (left.width * left.height),
            (left, right) => right.height - left.height,
            (left, right) => right.width - left.width,
            (left, right) => left.width - right.width,
            (left, right) => left.height - right.height,
        ];

        const candidates = sorters
            .map((sorter) => packWithFreeRects(data, [...pieces].sort(sorter), simpleLayout.usedLength))
            .filter((candidate) => !candidate.error)
            .map((candidate) => summarizeLayout(candidate));

        candidates.push(simpleLayout);

        candidates.sort((left, right) => {
            if (left.usedLength !== right.usedLength) {
                return left.usedLength - right.usedLength;
            }
            return right.usagePercent - left.usagePercent;
        });

        return {
            ...candidates[0],
            label: candidates[0].label || 'Optimizado por espacios libres',
        };
    }

    function packWithFreeRects(data, pieces, maxLength) {
        const containerWidth = data.usableRollWidth + data.margin;
        const containerHeight = maxLength + data.margin;
        let freeRects = [{x: 0, y: 0, width: containerWidth, height: containerHeight}];
        const placements = [];
        let rotatedCount = 0;

        for (const piece of pieces) {
            const orientationOptions = getOrientationOptions(piece, data.allowRotate, data.usableRollWidth)
                .map((orientation) => ({
                    ...orientation,
                    paddedWidth: orientation.width + data.margin,
                    paddedHeight: orientation.height + data.margin,
                }));

            if (orientationOptions.length === 0) {
                return {error: `El diseño "${piece.designName}" no cabe dentro del ancho útil del rollo.`};
            }

            let bestCandidate = null;

            orientationOptions.forEach((orientation) => {
                freeRects.forEach((rect) => {
                    if (orientation.paddedWidth > rect.width || orientation.paddedHeight > rect.height) {
                        return;
                    }

                    const projectedLength = rect.y + orientation.height;
                    const leftoverShort = Math.min(rect.width - orientation.paddedWidth, rect.height - orientation.paddedHeight);
                    const leftoverLong = Math.max(rect.width - orientation.paddedWidth, rect.height - orientation.paddedHeight);
                    const candidate = {
                        rect,
                        orientation,
                        score: [projectedLength, leftoverShort, leftoverLong, rect.y, rect.x],
                    };
                    if (isBetterCandidate(candidate, bestCandidate)) {
                        bestCandidate = candidate;
                    }
                });
            });

            if (!bestCandidate) {
                return {error: `No se pudo acomodar el diseño "${piece.designName}".`};
            }

            placements.push(createPlacement(piece, bestCandidate.orientation, bestCandidate.rect.x, bestCandidate.rect.y));
            if (bestCandidate.orientation.rotated) {
                rotatedCount += 1;
            }

            const occupiedRect = {
                x: bestCandidate.rect.x,
                y: bestCandidate.rect.y,
                width: bestCandidate.orientation.paddedWidth,
                height: bestCandidate.orientation.paddedHeight,
            };
            freeRects = pruneFreeRects(splitFreeRects(freeRects, occupiedRect));
        }

        const usedLength = placements.length > 0
            ? Math.max(...placements.map((placement) => placement.y + placement.height))
            : 0;

        return {
            placements,
            nominalRollWidth: data.rollWidth,
            rollWidth: data.usableRollWidth,
            usedLength,
            rotatedCount,
            normalCount: placements.length - rotatedCount,
            arrangement: `${freeRects.length} espacio(s) libre(s) remanente(s)`,
            label: 'Optimizado por espacios libres',
        };
    }

    function expandDesigns(designs) {
        const pieces = [];
        designs.forEach((design) => {
            for (let index = 0; index < design.quantity; index += 1) {
                pieces.push({
                    designId: design.id,
                    designName: design.name,
                    width: design.width,
                    height: design.height,
                    color: design.color,
                });
            }
        });
        return pieces;
    }

    function computeWidthRecommendations(state, settings) {
        const recommendations = STANDARD_WIDTHS_MM
            .map((widthMm) => {
                const candidateState = {...state, rollWidth: displayLengthFromMm(widthMm, state.unitSystem)};
                const candidateData = normalizeFormData(candidateState, settings);
                const validation = validateInputs(candidateData);
                if (validation) {
                    return null;
                }

                const simpleLayout = computeSimpleLayout(candidateData);
                const optimizedLayout = computeOptimizedLayout(candidateData, simpleLayout);
                if (optimizedLayout.error) {
                    return null;
                }

                const pricing = computePricing(candidateData, optimizedLayout.usedLength);
                return {
                    nominalWidthMm: widthMm,
                    usableWidthMm: candidateData.usableRollWidth,
                    layout: optimizedLayout,
                    pricing,
                };
            })
            .filter(Boolean);

        if (recommendations.length === 0) {
            return null;
        }

        return {
            bestByWaste: [...recommendations].sort((left, right) => left.layout.wasteArea - right.layout.wasteArea)[0],
            bestByCost: [...recommendations].sort((left, right) => left.pricing.totalCost - right.pricing.totalCost)[0],
            bestByProfit: [...recommendations].sort((left, right) => right.pricing.profitValue - left.pricing.profitValue)[0],
            bestByLength: [...recommendations].sort((left, right) => left.layout.usedLength - right.layout.usedLength)[0],
            all: recommendations,
        };
    }

    function computePricing(data, usedLength) {
        const linearMeters = usedLength / 1000;
        const billedLinearMeters = roundUpToStep(linearMeters, BILLING_STEP_METERS);
        const variableCost = billedLinearMeters * data.appliedLinearPrice;
        const totalCost = variableCost + data.fixedCost;
        const suggestedTotal = totalCost * (1 + (data.profitMargin / 100));
        return {
            linearMeters,
            billedLinearMeters,
            variableCost,
            totalCost,
            suggestedTotal,
            profitValue: suggestedTotal - totalCost,
        };
    }

    function renderResult(calculation) {
        const {data, simpleLayout, optimizedLayout, activeLayout, pricing, widthRecommendations} = calculation;
        const legendHtml = buildLegendHtml(data.designs, data.unitSystem);
        const widthSuggestionHtml = widthRecommendations ? renderWidthSuggestions(widthRecommendations, data.unitSystem, data.rollWidth) : '';

        resultSection.innerHTML = `
            <div class="summary-head">
                <div>
                    <p class="eyebrow">Resultado</p>
                    <h3>Resumen de producción</h3>
                </div>
                <span class="summary-badge">Optimizado</span>
            </div>

            <div class="priority-grid">
                <article class="metric-card metric-card-priority metric-card-meters">
                    <p class="metric-title">Metros lineales necesarios</p>
                    <p class="metric-value metric-value-priority">${formatMeters(pricing.linearMeters)}</p>
                    <p class="metric-subtitle">Cobro sobre ${formatMeters(pricing.billedLinearMeters)} con mínimo facturable de 10 cm</p>
                </article>
                <article class="metric-card metric-card-priority">
                    <p class="metric-title">Costo estimado</p>
                    <p class="metric-value metric-value-priority">${formatCurrency(pricing.totalCost)}</p>
                    <p class="metric-subtitle">Metraje facturable ${formatMeters(pricing.billedLinearMeters)} · tarifa ${formatCurrency(data.appliedLinearPrice)} + fijo ${formatCurrency(data.fixedCost)}</p>
                </article>
                <article class="metric-card metric-card-priority metric-card-profit">
                    <p class="metric-title">Ganancia estimada</p>
                    <p class="metric-value metric-value-priority">${formatCurrency(pricing.profitValue)}</p>
                    <p class="metric-subtitle">Precio sugerido ${formatCurrency(pricing.suggestedTotal)}</p>
                </article>
            </div>

            <div class="result-grid result-grid-compact">
                <article class="metric-card">
                    <p class="metric-title">Diseños totales</p>
                    <p class="metric-value">${activeLayout.count}</p>
                    <p class="metric-subtitle">${data.designs.length} tamaño(s) distinto(s)</p>
                </article>
                <article class="metric-card">
                    <p class="metric-title">Aprovechamiento</p>
                    <p class="metric-value">${formatNumber(activeLayout.usagePercent)}%</p>
                    <p class="metric-subtitle">Desperdicio ${formatArea(activeLayout.wasteArea, data.unitSystem)}</p>
                </article>
                <article class="metric-card">
                    <p class="metric-title">Largo calculado</p>
                    <p class="metric-value">${formatLength(activeLayout.usedLength, data.unitSystem)}</p>
                    <p class="metric-subtitle">Ancho útil ${formatLength(data.usableRollWidth, data.unitSystem)}</p>
                </article>
                <article class="metric-card">
                    <p class="metric-title">Precio sugerido</p>
                    <p class="metric-value metric-value-small">${formatCurrency(pricing.suggestedTotal)}</p>
                    <p class="metric-subtitle">Con margen ${formatNumber(data.profitMargin)}%</p>
                </article>
            </div>

            <div class="commercial-strip commercial-strip-summary">
                <article class="commercial-item">
                    <p class="small">Área desperdiciada</p>
                    <p>${formatArea(activeLayout.wasteArea, data.unitSystem)}</p>
                </article>
                <article class="commercial-item">
                    <p class="small">Piezas rotadas</p>
                    <p>${activeLayout.rotatedCount}</p>
                </article>
                <article class="commercial-item">
                    <p class="small">Método</p>
                    <p>${activeLayout.label}</p>
                </article>
                <article class="commercial-item">
                    <p class="small">Disposición</p>
                    <p>${activeLayout.arrangement}</p>
                </article>
            </div>

            ${widthSuggestionHtml}

            <div class="layout-panel">
                <article class="preview-card">
                    <h3>Vista previa del tramo calculado</h3>
                    <canvas id="preview" width="760" height="980"></canvas>
                    <p class="result-note">La vista marca el ancho nominal del rollo y el ancho útil interior después del margen de seguridad.</p>
                    <div class="legend-list">${legendHtml}</div>
                    <div class="comparison">
                        <p><strong>Acomodo optimizado:</strong> el cálculo prioriza menor largo usado y mejor aprovechamiento dentro del ancho útil disponible.</p>
                        <p>El resultado mostrado ya corresponde al mejor acomodo encontrado para esta combinación de diseños.</p>
                    </div>

                    <div class="result-actions">
                        <button type="button" id="download-image">Exportar imagen</button>
                        <button type="button" id="download-order" class="button-secondary">Descargar orden</button>
                        <button type="button" id="print-pdf" class="button-secondary">Exportar PDF</button>
                    </div>
                </article>
            </div>
        `;
    }

    function renderWidthSuggestions(widthRecommendations, unitSystem, currentWidth) {
        const currentEntry = widthRecommendations.all.find((entry) => entry.nominalWidthMm === currentWidth) || widthRecommendations.bestByCost;
        const rowsHtml = widthRecommendations.all.map((entry) => {
            const tags = [];
            if (entry.nominalWidthMm === widthRecommendations.bestByWaste.nominalWidthMm) {
                tags.push('menos desperdicio');
            }
            if (entry.nominalWidthMm === widthRecommendations.bestByCost.nominalWidthMm) {
                tags.push('menor costo');
            }
            if (entry.nominalWidthMm === widthRecommendations.bestByProfit.nominalWidthMm) {
                tags.push('mayor ganancia');
            }
            if (entry.nominalWidthMm === currentWidth) {
                tags.push('actual');
            }

            return `
            <div class="commercial-item commercial-item-width${entry.nominalWidthMm === currentWidth ? ' commercial-item-current' : ''}">
                <p class="small">${formatLength(entry.nominalWidthMm, unitSystem)} nominal</p>
                <p class="commercial-value">${formatMeters(entry.pricing.billedLinearMeters)}</p>
                <p class="metric-subtitle">Necesario ${formatMeters(entry.pricing.linearMeters)}</p>
                <p class="metric-subtitle">Desperdicio ${formatArea(entry.layout.wasteArea, unitSystem)}</p>
                <p class="metric-subtitle">Costo ${formatCurrency(entry.pricing.totalCost)}</p>
                <p class="metric-subtitle">Ganancia ${formatCurrency(entry.pricing.profitValue)}</p>
                <p class="metric-subtitle">${tags.join(' · ')}</p>
            </div>`;
        }).join('');

        const wasteDelta = currentEntry.layout.wasteArea - widthRecommendations.bestByWaste.layout.wasteArea;
        const costDelta = currentEntry.pricing.totalCost - widthRecommendations.bestByCost.pricing.totalCost;
        const profitDelta = widthRecommendations.bestByProfit.pricing.profitValue - currentEntry.pricing.profitValue;

        return `
            <div class="comparison comparison-wide">
                <p><strong>Comparativa de anchos rápidos:</strong> menos desperdicio con ${formatLength(widthRecommendations.bestByWaste.nominalWidthMm, unitSystem)}, menor costo con ${formatLength(widthRecommendations.bestByCost.nominalWidthMm, unitSystem)} y mayor ganancia con ${formatLength(widthRecommendations.bestByProfit.nominalWidthMm, unitSystem)}.</p>
                <p>${wasteDelta > 0 ? `Cambiando desde el ancho actual al mejor en desperdicio bajarías ${formatArea(wasteDelta, unitSystem)}.` : 'El ancho actual ya está entre las mejores opciones de desperdicio.'} ${costDelta > 0 ? `También podrías ahorrar ${formatCurrency(costDelta)} en costo estimado.` : 'No hay ahorro adicional relevante en costo frente al ancho actual.'} ${profitDelta > 0 ? `Y existe una opción con ${formatCurrency(profitDelta)} más de ganancia estimada.` : 'La ganancia del ancho actual ya está en el mejor nivel estimado.'}</p>
            </div>
            <div class="commercial-strip commercial-strip-widths">
                ${rowsHtml}
            </div>
        `;
    }

    function drawPreview(layout, data) {
        const canvas = document.getElementById('preview');
        if (!canvas) {
            return;
        }

        const ctx = canvas.getContext('2d');
        const padding = 36;
        const scale = Math.min(
            (canvas.width - (padding * 2)) / Math.max(data.rollWidth, 1),
            (canvas.height - (padding * 2)) / Math.max(layout.usedLength, 1)
        );
        const drawNominalWidth = data.rollWidth * scale;
        const drawUsableWidth = data.usableRollWidth * scale;
        const drawHeight = layout.usedLength * scale;
        const originX = (canvas.width - drawNominalWidth) / 2;
        const originY = 24;
        const innerX = originX + (data.safetySideMm * scale);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#3a3f47';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#c7cad1';
        ctx.strokeStyle = '#545b66';
        ctx.lineWidth = 2;
        ctx.fillRect(originX, originY, drawNominalWidth, drawHeight);
        ctx.strokeRect(originX, originY, drawNominalWidth, drawHeight);

        if (data.safetySideMm > 0) {
            ctx.fillStyle = 'rgba(217, 119, 6, 0.15)';
            ctx.fillRect(originX, originY, data.safetySideMm * scale, drawHeight);
            ctx.fillRect(originX + drawNominalWidth - (data.safetySideMm * scale), originY, data.safetySideMm * scale, drawHeight);
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.fillRect(innerX, originY, drawUsableWidth, drawHeight);

        layout.placements.forEach((placement) => {
            const x = innerX + (placement.x * scale);
            const y = originY + (placement.y * scale);
            const width = placement.width * scale;
            const height = placement.height * scale;
            ctx.fillStyle = placement.color;
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.lineWidth = 1;
            ctx.fillRect(x, y, width, height);
            ctx.strokeRect(x, y, width, height);
            if (width > 58 && height > 24) {
                ctx.fillStyle = '#0f1115';
                ctx.font = '700 13px Segoe UI';
                ctx.fillText(placement.designName, x + 6, y + 16);
            }
        });

        ctx.fillStyle = '#eef2f7';
        ctx.font = '700 15px Segoe UI';
        ctx.fillText(`Nominal: ${formatLength(data.rollWidth, data.unitSystem)}`, originX, originY - 10);
        ctx.fillText(`Útil: ${formatLength(data.usableRollWidth, data.unitSystem)}`, innerX, originY + drawHeight + 22);
        ctx.fillText(`Largo: ${formatLength(layout.usedLength, data.unitSystem)}`, originX + drawNominalWidth - 170, originY + drawHeight + 22);
    }

    function exportPreviewAsImage() {
        const canvas = document.getElementById('preview');
        if (!canvas) {
            return;
        }

        const link = document.createElement('a');
        link.download = buildFileName('rollo-dtf', 'png');
        link.href = canvas.toDataURL('image/png');
        link.click();
    }

    function exportCutOrder() {
        if (!currentCalculation) {
            return;
        }

        const {data, activeLayout, pricing} = currentCalculation;
        const designLines = data.designs.map((design) => `- ${design.name}: ${formatLength(design.width, data.unitSystem)} x ${formatLength(design.height, data.unitSystem)} · ${design.quantity} uds`).join('\n');
        const content = [
            'ORDEN DE CORTE DTF',
            '==================',
            `Fecha: ${new Date().toLocaleString('es-UY')}`,
            '',
            'ROLLO',
            `Ancho nominal: ${formatLength(data.rollWidth, data.unitSystem)}`,
            `Ancho util: ${formatLength(data.usableRollWidth, data.unitSystem)}`,
            `Seguridad lateral: ${formatLength(data.safetySideMm, data.unitSystem)} por lado`,
            `Separacion: ${formatLength(data.margin, data.unitSystem)}`,
            `Rotacion permitida: ${data.allowRotate ? 'Si' : 'No'}`,
            'Metodo: optimizado',
            '',
            'DISENOS',
            designLines,
            '',
            'RESULTADO',
            `Largo calculado: ${formatLength(activeLayout.usedLength, data.unitSystem)}`,
            `Metros lineales necesarios: ${formatMeters(pricing.linearMeters)}`,
            `Metros lineales facturables: ${formatMeters(pricing.billedLinearMeters)}`,
            `Piezas totales: ${activeLayout.count}`,
            `Aprovechamiento: ${formatNumber(activeLayout.usagePercent)}%`,
            '',
            'COSTOS',
            `Tarifa lineal: ${formatCurrency(data.appliedLinearPrice)}`,
            `Costo fijo: ${formatCurrency(data.fixedCost)}`,
            `Costo variable sobre ${formatMeters(pricing.billedLinearMeters)}: ${formatCurrency(pricing.variableCost)}`,
            `Costo total: ${formatCurrency(pricing.totalCost)}`,
            `Precio sugerido: ${formatCurrency(pricing.suggestedTotal)}`,
        ].join('\n');

        const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.href = url;
        link.download = buildFileName('orden-rollo-dtf', 'txt');
        link.click();
        URL.revokeObjectURL(url);
    }

    function attachResultActions() {
        document.getElementById('download-image')?.addEventListener('click', exportPreviewAsImage);
        document.getElementById('download-order')?.addEventListener('click', exportCutOrder);
        document.getElementById('print-pdf')?.addEventListener('click', () => window.print());
    }

    function buildLegendHtml(designs, unitSystem) {
        return designs.map((design) => `
            <div class="legend-item">
                <span class="legend-swatch" style="background:${design.color}"></span>
                <span>${escapeHtml(design.name)} · ${formatLength(design.width, unitSystem)} x ${formatLength(design.height, unitSystem)}</span>
            </div>
        `).join('');
    }

    function updateOperationalNotes() {
        const unit = unitSelect.value;
        const nominalWidthMm = parseDisplayLength(document.getElementById('roll-width').value, unit);
        const usableWidthMm = Math.max(0, nominalWidthMm - (currentSettings.safetySideMm * 2));
        const pricingInfo = resolvePricingForWidth(nominalWidthMm, currentSettings, unit);

        usableWidthNote.textContent = usableWidthMm > 0
            ? `Ancho nominal ${formatLength(nominalWidthMm, unit)}. Con ${formatLength(currentSettings.safetySideMm, unit)} por lado, el ancho útil queda en ${formatLength(usableWidthMm, unit)}.`
            : 'El ancho útil quedó en cero o negativo con la seguridad lateral actual.';

        appliedLinearPriceInput.value = formatCurrency(pricingInfo.price);
        appliedFixedCostInput.value = formatCurrency(currentSettings.fixedCost);
        pricingSourceNote.textContent = `Tarifa tomada de ${pricingInfo.label}. Costo fijo base ${formatCurrency(currentSettings.fixedCost)}.`;
    }

    function collectSettingsFromInputs() {
        return {
            safetySideMm: parseDisplayLength(document.getElementById('settings-safety-side').value, unitSelect.value),
            defaultSpacingMm: parseDisplayLength(document.getElementById('settings-default-spacing').value, unitSelect.value),
            fixedCost: readNumber('settings-fixed-cost', 0),
            prices: {
                300: readNumber('settings-price-30', 0),
                450: readNumber('settings-price-45', 0),
                600: readNumber('settings-price-60', 0),
            },
        };
    }

    function syncSettingsInputsFromState(settings, unit) {
        document.getElementById('settings-safety-side').value = displayLengthFromMm(settings.safetySideMm, unit);
        document.getElementById('settings-default-spacing').value = displayLengthFromMm(settings.defaultSpacingMm, unit);
        document.getElementById('settings-fixed-cost').value = settings.fixedCost;
        document.getElementById('settings-price-30').value = settings.prices[300] ?? 0;
        document.getElementById('settings-price-45').value = settings.prices[450] ?? 0;
        document.getElementById('settings-price-60').value = settings.prices[600] ?? 0;
    }

    function loadSettings() {
        const stored = getStorageJson(SETTINGS_KEY);
        if (!stored || typeof stored !== 'object') {
            return cloneSettings(DEFAULT_SETTINGS);
        }

        return {
            safetySideMm: Number.isFinite(stored.safetySideMm) ? Math.max(0, stored.safetySideMm) : DEFAULT_SETTINGS.safetySideMm,
            defaultSpacingMm: Number.isFinite(stored.defaultSpacingMm) ? Math.max(0, stored.defaultSpacingMm) : DEFAULT_SETTINGS.defaultSpacingMm,
            fixedCost: Number.isFinite(stored.fixedCost) ? Math.max(0, stored.fixedCost) : DEFAULT_SETTINGS.fixedCost,
            prices: {
                300: Number.isFinite(stored.prices?.[300]) ? Math.max(0, stored.prices[300]) : DEFAULT_SETTINGS.prices[300],
                450: Number.isFinite(stored.prices?.[450]) ? Math.max(0, stored.prices[450]) : DEFAULT_SETTINGS.prices[450],
                600: Number.isFinite(stored.prices?.[600]) ? Math.max(0, stored.prices[600]) : DEFAULT_SETTINGS.prices[600],
            },
        };
    }

    function loadStoredState() {
        const parsed = getStorageJson(STORAGE_KEY);
        return parsed && typeof parsed === 'object' ? sanitizeStoredState(parsed) : null;
    }

    function persistCurrentForm() {
        const saved = setStorageJson(STORAGE_KEY, collectFormState());
        if (!saved) {
            setSettingsStatus('No se pudo guardar el formulario localmente.');
        }
        return saved;
    }

    function clearLocalAppData() {
        try {
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(SETTINGS_KEY);
        } catch {
            setSettingsStatus('No se pudieron borrar los datos locales del navegador.');
        }
    }

    function sanitizeStoredState(state) {
        const normalizedUnit = state.unitSystem === 'mm' ? 'mm' : 'cm';
        const normalizedDesigns = Array.isArray(state.designs)
            ? state.designs.map((design) => ({
                name: typeof design?.name === 'string' ? design.name : '',
                width: Number.isFinite(design?.width) ? design.width : '',
                height: Number.isFinite(design?.height) ? design.height : '',
                quantity: Number.isFinite(design?.quantity) ? Math.max(0, Math.round(design.quantity)) : 0,
            }))
            : getDefaultDesigns();

        return {
            unitSystem: normalizedUnit,
            rollWidth: Number.isFinite(state.rollWidth) ? Math.max(0, state.rollWidth) : displayLengthFromMm(600, normalizedUnit),
            margin: Number.isFinite(state.margin) ? Math.max(0, state.margin) : displayLengthFromMm(currentSettings.defaultSpacingMm, normalizedUnit),
            allowRotate: state.allowRotate !== false,
            mode: 'optimized',
            profitMargin: Number.isFinite(state.profitMargin) ? Math.max(0, state.profitMargin) : 30,
            designs: normalizedDesigns.length > 0 ? normalizedDesigns : getDefaultDesigns(),
        };
    }

    function resolvePricingForWidth(nominalWidthMm, settings, unitSystem) {
        const exactWidth = STANDARD_WIDTHS_MM.find((width) => Math.abs(width - nominalWidthMm) < 0.0001);
        if (exactWidth) {
            return {
                referenceWidthMm: exactWidth,
                price: settings.prices[exactWidth] ?? 0,
                label: `ancho ${formatLength(exactWidth, unitSystem)}`,
            };
        }

        const nearestWidth = [...STANDARD_WIDTHS_MM].sort((left, right) => Math.abs(left - nominalWidthMm) - Math.abs(right - nominalWidthMm))[0];
        return {
            referenceWidthMm: nearestWidth,
            price: settings.prices[nearestWidth] ?? 0,
            label: `ancho cercano ${formatLength(nearestWidth, unitSystem)} para un ancho personalizado de ${formatLength(nominalWidthMm, unitSystem)}`,
        };
    }

    function summarizeLayout(config) {
        const usedArea = config.placements.reduce((total, placement) => total + (placement.width * placement.height), 0);
        const rollArea = config.rollWidth * config.usedLength;
        const usagePercent = rollArea > 0 ? (usedArea / rollArea) * 100 : 0;
        const wasteArea = Math.max(0, rollArea - usedArea);
        const occupiedWidth = config.placements.length > 0 ? Math.max(...config.placements.map((placement) => placement.x + placement.width)) : 0;

        return {
            ...config,
            count: config.placements.length,
            usedArea,
            rollArea,
            usagePercent,
            wasteArea,
            occupiedWidth,
        };
    }

    function createPlacement(piece, orientation, x, y) {
        return {
            x,
            y,
            width: orientation.width,
            height: orientation.height,
            rotated: orientation.rotated,
            designId: piece.designId,
            designName: piece.designName,
            color: piece.color,
        };
    }

    function splitFreeRects(freeRects, occupiedRect) {
        const next = [];

        freeRects.forEach((rect) => {
            if (!rectsIntersect(rect, occupiedRect)) {
                next.push(rect);
                return;
            }

            if (occupiedRect.x > rect.x) {
                next.push({x: rect.x, y: rect.y, width: occupiedRect.x - rect.x, height: rect.height});
            }

            if ((occupiedRect.x + occupiedRect.width) < (rect.x + rect.width)) {
                next.push({
                    x: occupiedRect.x + occupiedRect.width,
                    y: rect.y,
                    width: (rect.x + rect.width) - (occupiedRect.x + occupiedRect.width),
                    height: rect.height,
                });
            }

            if (occupiedRect.y > rect.y) {
                next.push({x: rect.x, y: rect.y, width: rect.width, height: occupiedRect.y - rect.y});
            }

            if ((occupiedRect.y + occupiedRect.height) < (rect.y + rect.height)) {
                next.push({
                    x: rect.x,
                    y: occupiedRect.y + occupiedRect.height,
                    width: rect.width,
                    height: (rect.y + rect.height) - (occupiedRect.y + occupiedRect.height),
                });
            }
        });

        return next.filter((rect) => rect.width > 0 && rect.height > 0);
    }

    function pruneFreeRects(freeRects) {
        return freeRects.filter((rect, index) => !freeRects.some((other, otherIndex) => {
            if (index === otherIndex) {
                return false;
            }

            return rect.x >= other.x
                && rect.y >= other.y
                && (rect.x + rect.width) <= (other.x + other.width)
                && (rect.y + rect.height) <= (other.y + other.height);
        }));
    }

    function rectsIntersect(left, right) {
        return !(
            right.x >= left.x + left.width
            || right.x + right.width <= left.x
            || right.y >= left.y + left.height
            || right.y + right.height <= left.y
        );
    }

    function getOrientationOptions(piece, allowRotate, usableRollWidth) {
        const options = [];
        if (piece.width <= usableRollWidth) {
            options.push({width: piece.width, height: piece.height, rotated: false});
        }
        if (allowRotate && piece.width !== piece.height && piece.height <= usableRollWidth) {
            options.push({width: piece.height, height: piece.width, rotated: true});
        }
        return options;
    }

    function isBetterCandidate(candidate, currentBest) {
        if (!currentBest) {
            return true;
        }

        for (let index = 0; index < candidate.score.length; index += 1) {
            if (candidate.score[index] < currentBest.score[index]) {
                return true;
            }
            if (candidate.score[index] > currentBest.score[index]) {
                return false;
            }
        }

        return false;
    }

    function fitAcross(totalWidth, itemWidth, margin) {
        return Math.max(0, Math.floor((totalWidth + margin) / (itemWidth + margin)));
    }

    function setActiveSegment(container, activeButton) {
        container.querySelectorAll('.segment-button').forEach((button) => {
            button.classList.toggle('is-active', button === activeButton);
        });
    }

    function convertPresetLengthFromCm(valueInCm) {
        return unitSelect.value === 'cm' ? valueInCm : roundValue(valueInCm * 10, 2);
    }

    function markResultsAsStale(message = 'Hay cambios pendientes. Pulsa Calcular acomodo para actualizar el resultado.') {
        currentCalculation = null;
        setResultPlaceholder(message);
    }

    function setResultPlaceholder(message) {
        resultSection.innerHTML = `<p class="placeholder">${escapeHtml(message)}</p>`;
    }

    function setSettingsStatus(message) {
        settingsStatus.textContent = message;
    }

    function updateConnectionStatus() {
        if (!connectionStatus) {
            return;
        }

        const isOnline = navigator.onLine;
        connectionStatus.textContent = isOnline ? 'En línea' : 'Offline disponible';
        connectionStatus.className = isOnline
            ? 'app-status-pill app-status-pill-muted'
            : 'app-status-pill app-status-pill-offline';
    }

    function updateInstallUi(isInstalled = isRunningStandalone()) {
        if (!installStatus || !installAppButton) {
            return;
        }

        if (isInstalled) {
            installStatus.textContent = 'App instalada';
            installStatus.className = 'app-status-pill';
            installAppButton.classList.add('is-hidden');
            return;
        }

        if (deferredInstallPrompt) {
            installStatus.textContent = 'Instalación disponible';
            installStatus.className = 'app-status-pill app-status-pill-warning';
            installAppButton.classList.remove('is-hidden');
            return;
        }

        installStatus.textContent = 'Web lista para instalar';
        installStatus.className = 'app-status-pill';
        installAppButton.classList.add('is-hidden');
    }

    function isRunningStandalone() {
        return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    }

    function openSettingsPanel() {
        settingsPanel.classList.remove('is-hidden');
    }

    function closeSettingsPanel() {
        settingsPanel.classList.add('is-hidden');
    }

    function updateUnitLabels(unit) {
        unitLabels.forEach((label) => {
            label.textContent = unit;
        });
    }

    function updateRollPresetLabels(unit) {
        rollPresetButtons.forEach((button) => {
            const widthMm = parseFloat(button.dataset.widthMm);
            const displayValue = displayLengthFromMm(widthMm, unit);
            button.textContent = `${formatNumber(displayValue)} ${unit}`;
        });
    }

    function convertDisplayedUnits(fromUnit, toUnit) {
        if (fromUnit === toUnit) {
            return;
        }

        Array.from(document.querySelectorAll('[data-dimension]')).forEach((input) => {
            const currentValue = parseFloat(input.value);
            if (!Number.isFinite(currentValue)) {
                return;
            }

            const valueInMm = fromUnit === 'cm' ? currentValue * 10 : currentValue;
            input.value = displayLengthFromMm(valueInMm, toUnit);
        });
    }

    function cloneSettings(settings) {
        return {
            safetySideMm: settings.safetySideMm,
            defaultSpacingMm: settings.defaultSpacingMm,
            fixedCost: settings.fixedCost,
            prices: {
                300: settings.prices[300],
                450: settings.prices[450],
                600: settings.prices[600],
            },
        };
    }

    function buildFileName(prefix, extension) {
        const now = new Date();
        const stamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
        return `${prefix}_${stamp}.${extension}`;
    }

    function readNumber(id, fallback = 0) {
        const value = parseFloat(document.getElementById(id).value);
        return Number.isFinite(value) ? value : fallback;
    }

    function parseDisplayLength(value, unitSystem) {
        const parsed = parseFloat(value);
        if (!Number.isFinite(parsed)) {
            return 0;
        }
        return unitSystem === 'cm' ? parsed * 10 : parsed;
    }

    function displayLengthFromMm(value, unitSystem) {
        return unitSystem === 'cm' ? roundValue(value / 10, 2) : roundValue(value, 2);
    }

    function formatLength(valueInMm, unitSystem) {
        const converted = unitSystem === 'cm' ? valueInMm / 10 : valueInMm;
        return `${formatNumber(converted)} ${unitSystem}`;
    }

    function formatArea(valueInMm2, unitSystem) {
        if (unitSystem === 'cm') {
            return `${formatNumber(valueInMm2 / 100)} cm²`;
        }
        return `${formatNumber(valueInMm2)} mm²`;
    }

    function formatMeters(value) {
        return `${formatNumber(value)} m`;
    }

    function formatCurrency(value) {
        return new Intl.NumberFormat('es-UY', {
            style: 'currency',
            currency: 'UYU',
            maximumFractionDigits: 2,
        }).format(value || 0);
    }

    function formatNumber(value) {
        return new Intl.NumberFormat('es-UY', {
            maximumFractionDigits: 2,
        }).format(value || 0);
    }

    function roundValue(value, decimals) {
        const factor = 10 ** decimals;
        return Math.round(value * factor) / factor;
    }

    function roundUpToStep(value, step) {
        if (step <= 0) {
            return value;
        }

        const scaled = Math.ceil(((value + Number.EPSILON) / step));
        return roundValue(scaled * step, 4);
    }

    function escapeHtml(value) {
        return String(value)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }

    function setStorageJson(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch {
            return false;
        }
    }

    function getStorageJson(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) {
                return null;
            }
            return JSON.parse(raw);
        } catch {
            try {
                localStorage.removeItem(key);
            } catch {
                // ignore cleanup failures
            }
            return null;
        }
    }

    function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            return;
        }

        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js').catch(() => {
                // La app puede seguir funcionando sin service worker durante las verificaciones.
            });
        });
    }
});