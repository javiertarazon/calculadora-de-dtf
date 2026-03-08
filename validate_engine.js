const PALETTE = ['#ff5f6d', '#ffc371', '#38bdf8', '#34d399', '#f472b6', '#f59e0b', '#22c55e', '#60a5fa'];
const STANDARD_WIDTHS_MM = [300, 450, 600];
const BILLING_STEP_METERS = 0.1;

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

function fitAcross(totalWidth, itemWidth, margin) {
    return Math.max(0, Math.floor((totalWidth + margin) / (itemWidth + margin)));
}

function resolvePricingForWidth(nominalWidthMm, settings) {
    const exactWidth = STANDARD_WIDTHS_MM.find((width) => Math.abs(width - nominalWidthMm) < 0.0001);
    if (exactWidth) {
        return {
            referenceWidthMm: exactWidth,
            price: settings.prices[exactWidth] ?? 0,
        };
    }

    const nearestWidth = [...STANDARD_WIDTHS_MM].sort((left, right) => Math.abs(left - nominalWidthMm) - Math.abs(right - nominalWidthMm))[0];
    return {
        referenceWidthMm: nearestWidth,
        price: settings.prices[nearestWidth] ?? 0,
    };
}

function normalizeFormData(state, settings) {
    const factor = state.unitSystem === 'cm' ? 10 : 1;
    const nominalRollWidth = state.rollWidth * factor;
    const usableRollWidth = Math.max(0, nominalRollWidth - (settings.safetySideMm * 2));
    const appliedPricing = resolvePricingForWidth(nominalRollWidth, settings);

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
            placements.push({
                x: column * (orientation.width + data.margin),
                y: currentY + row * (orientation.height + data.margin),
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
        rollWidth: data.usableRollWidth,
        usedLength: currentY,
        rotatedCount,
        normalCount: placements.length - rotatedCount,
        arrangement: `${data.designs.length} bloque(s) secuenciales`,
    });
}

function rectsIntersect(left, right) {
    return !(
        right.x >= left.x + left.width
        || right.x + right.width <= left.x
        || right.y >= left.y + left.height
        || right.y + right.height <= left.y
    );
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
                const candidate = {rect, orientation, score: [projectedLength, leftoverShort, leftoverLong, rect.y, rect.x]};
                if (isBetterCandidate(candidate, bestCandidate)) {
                    bestCandidate = candidate;
                }
            });
        });

        if (!bestCandidate) {
            return {error: `No se pudo acomodar el diseño "${piece.designName}".`};
        }

        placements.push({
            x: bestCandidate.rect.x,
            y: bestCandidate.rect.y,
            width: bestCandidate.orientation.width,
            height: bestCandidate.orientation.height,
            rotated: bestCandidate.orientation.rotated,
            designId: piece.designId,
            designName: piece.designName,
            color: piece.color,
        });
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

    const usedLength = placements.length > 0 ? Math.max(...placements.map((placement) => placement.y + placement.height)) : 0;
    return {
        placements,
        rollWidth: data.usableRollWidth,
        usedLength,
        rotatedCount,
        normalCount: placements.length - rotatedCount,
        arrangement: `${freeRects.length} espacio(s) libre(s) remanente(s)`,
        label: 'Optimizado por espacios libres',
    };
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
    return {...candidates[0], label: candidates[0].label || 'Optimizado por espacios libres'};
}

function computePricing(data, usedLength) {
    const linearMeters = usedLength / 1000;
    const billedLinearMeters = roundUpToStep(linearMeters, BILLING_STEP_METERS);
    const variableCost = billedLinearMeters * data.appliedLinearPrice;
    const totalCost = variableCost + data.fixedCost;
    const suggestedTotal = totalCost * (1 + (data.profitMargin / 100));
    return {linearMeters, billedLinearMeters, variableCost, totalCost, suggestedTotal, profitValue: suggestedTotal - totalCost};
}

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function run() {
    const settings = {
        safetySideMm: 10,
        defaultSpacingMm: 5,
        fixedCost: 100,
        prices: {300: 800, 450: 1000, 600: 1200},
    };

    const pricingQuarter = computePricing({appliedLinearPrice: 800, fixedCost: 0, profitMargin: 30}, 250);
    assert(pricingQuarter.linearMeters === 0.25, '0.25 m necesarios debe mantenerse exacto');
    assert(pricingQuarter.billedLinearMeters === 0.3, '0.25 m debe facturar 0.3 m');

    const pricing84cm = computePricing({appliedLinearPrice: 800, fixedCost: 0, profitMargin: 30}, 840);
    assert(pricing84cm.billedLinearMeters === 0.9, '0.84 m debe facturar 0.9 m');

    const pricing338 = computePricing({appliedLinearPrice: 800, fixedCost: 0, profitMargin: 30}, 3380);
    assert(pricing338.billedLinearMeters === 3.4, '3.38 m debe facturar 3.4 m');

    const baseState = {
        unitSystem: 'cm',
        rollWidth: 30,
        margin: 0.5,
        allowRotate: true,
        profitMargin: 30,
        designs: [{name: 'Frente', width: 9, height: 12, quantity: 10}],
    };
    const normalized = normalizeFormData(baseState, settings);
    assert(validateInputs(normalized) === '', 'El caso base debe validar');
    assert(normalized.rollWidth === 300, '30 cm deben normalizarse a 300 mm');
    assert(normalized.usableRollWidth === 280, '30 cm con 1 cm por lado deben dejar 280 mm útiles');

    const simple = computeSimpleLayout(normalized);
    const optimized = computeOptimizedLayout(normalized, simple);
    assert(!simple.error, 'El layout simple no debe fallar en el caso base');
    assert(!optimized.error, 'El layout optimizado no debe fallar en el caso base');
    assert(optimized.usedLength <= simple.usedLength, 'El optimizado no debe ser peor que el simple');

    const oversizedState = {
        unitSystem: 'cm',
        rollWidth: 30,
        margin: 0.5,
        allowRotate: false,
        profitMargin: 30,
        designs: [{name: 'Gigante', width: 40, height: 20, quantity: 1}],
    };
    const oversized = normalizeFormData(oversizedState, settings);
    const oversizedSimple = computeSimpleLayout(oversized);
    assert(Boolean(oversizedSimple.error), 'Un diseño más ancho que el útil debe fallar');

    const mixedState = {
        unitSystem: 'cm',
        rollWidth: 45,
        margin: 0.5,
        allowRotate: true,
        profitMargin: 30,
        designs: [
            {name: 'Espalda', width: 28, height: 35, quantity: 2},
            {name: 'Frente', width: 9, height: 12, quantity: 10},
        ],
    };
    const mixed = normalizeFormData(mixedState, settings);
    const mixedSimple = computeSimpleLayout(mixed);
    const mixedOptimized = computeOptimizedLayout(mixed, mixedSimple);
    assert(!mixedOptimized.error, 'El caso mixto optimizado no debe fallar');
    assert(mixedOptimized.count === 12, 'El caso mixto debe mantener la cantidad total de piezas');

    console.log('VALIDACION OK');
    console.log('- Redondeo de facturación por 10 cm: OK');
    console.log('- Normalización de anchos útiles: OK');
    console.log('- Caso base simple/optimizado: OK');
    console.log('- Detección de diseño fuera de ancho útil: OK');
    console.log('- Caso mixto optimizado: OK');
}

run();