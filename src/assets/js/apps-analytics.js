// apps-analytics.js - Management Charts Logic

// Globals
let chartInstances = {}; // Store chart instances to destroy/update
let invoicesData = [];
let tasksData = [];
let clientsData = [];
let accountsData = []; // Cuentas
let assetsData = []; // Activos (Inversiones)

// Configuración
const EXCHANGE_RATE = 1200; // Hardcoded exchange rate for ARS/USD conversion

// Defaults to Current Month
const now = new Date();
let filterYear = now.getFullYear();
let filterPeriod = 'YEAR'; // YEAR, MONTH
let filterMonth = now.getMonth(); // 0-11
let filterCurrency = 'ARS'; // ARS, USD
let filterAccount = 'ALL'; 

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Set Chart.js Defaults for better legibility
    if (typeof Chart !== 'undefined') {
        Chart.defaults.font.family = "'Inter', 'Roboto', 'Helvetica Neue', 'Helvetica', 'Arial', sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#495057';
        Chart.defaults.plugins.tooltip.padding = 10;
        Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    }

    // Populate Years dynamically
    populateYearSelect();

    // Set UI Defaults for other filters
    document.getElementById('analytics-month').value = filterMonth;
    
    // Set Active Button
    updatePeriodButtons();
    updateSelectorsVisibility();

    window.Imala.auth.checkAuth(user => {
        console.log("Analytics Auth:", user);
        loadData();
    });
});

function populateYearSelect() {
    const select = document.getElementById('analytics-year');
    if(!select) return;
    
    select.innerHTML = '';
    const startYear = 2024; // Project start
    const endYear = filterYear + 1; // Current year + 1 for flexibility

    for(let y = endYear; y >= startYear; y--) {
        const opt = document.createElement('option');
        opt.value = y;
        opt.textContent = y;
        if(y === filterYear) opt.selected = true;
        select.appendChild(opt);
    }
}

// --- Data Loading ---
function loadData() {
    // 1. Transactions (Operations)
    db.collection('transactions').onSnapshot(snap => {
        invoicesData = [];
        snap.forEach(doc => {
            const d = doc.data();
            // Parse Date Helper
            let dateObj = null;
            if (d.date && d.date.seconds) dateObj = new Date(d.date.seconds * 1000);
            else if (d.date) dateObj = new Date(d.date);

            // Ensure we have a valid date object before pushing
            if (dateObj && !isNaN(dateObj.getTime())) {
                invoicesData.push({ id: doc.id, ...d, dateObj: dateObj });
            }
        });
        updateDashboard();
    });

    // 2. CRM Tasks
    db.collection('tasks').onSnapshot(snap => {
        tasksData = [];
        snap.forEach(doc => {
            const d = doc.data();
            
            // Robust Date Parsing for Tasks: dueDate (preferred for trend) > createdAt > date
            let dateObj = null;
            if (d.dueDate) dateObj = new Date(d.dueDate + 'T12:00:00'); // Ensure it's treated as local noon
            else if (d.date && d.date.seconds) dateObj = new Date(d.date.seconds * 1000);
            else if (d.createdAt && d.createdAt.seconds) dateObj = new Date(d.createdAt.seconds * 1000);
            else if (d.createdAt) dateObj = new Date(d.createdAt);
            else if (d.date) dateObj = new Date(d.date);
            
            tasksData.push({ id: doc.id, ...d, dateObj: dateObj });
        });
        updateDashboard();
    });

    // 3. Clients
    db.collection('clients').onSnapshot(snap => {
        clientsData = [];
        snap.forEach(doc => {
            clientsData.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
    });

    // 4. Accounts (Liquidity)
    db.collection('cashflow_accounts').onSnapshot(snap => {
        accountsData = [];
        snap.forEach(doc => accountsData.push({ id: doc.id, ...doc.data() }));
        populateAccountSelect();
        updateDashboard();
    });

    // 5. Assets (Wealth)
    db.collection('cashflow_assets').onSnapshot(snap => {
        assetsData = [];
        snap.forEach(doc => {
            const d = doc.data();
            if(!d.isDeleted) {
                assetsData.push({ id: doc.id, ...d });
            }
        });
        updateDashboard();
    });
}

function populateAccountSelect() {
    const select = document.getElementById('analytics-account');
    if (!select) return;

    // Keep "Todas las Cuentas"
    select.innerHTML = '<option value="ALL">Todas las Cuentas</option>';

    accountsData.filter(a => a.isActive !== false).forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = `${acc.name} (${acc.currency})`;
        if (acc.id === filterAccount) opt.selected = true;
        select.appendChild(opt);
    });
}

// --- Dashboard Logic ---

const appAnalytics = {
    setPeriod: (period) => {
        filterPeriod = period;
        updatePeriodButtons();
        updateSelectorsVisibility();
        updateDashboard();
    },

    setCurrency: (curr) => {
        filterCurrency = curr;
        // Update UI Labels
        document.querySelectorAll('.currency-label').forEach(el => el.innerText = curr);
        
        // Update selection state if needed
        const btnArs = document.getElementById('currency-ars');
        const btnUsd = document.getElementById('currency-usd');
        if (btnArs) btnArs.checked = (curr === 'ARS');
        if (btnUsd) btnUsd.checked = (curr === 'USD');
        
        updateDashboard();
    },

    showChartHelp: (chartKey) => {
        const helpData = {
            'RUN_RATE': {
                title: 'Ayuda: Run Rate (Ingresos vs Gastos)',
                content: `
                    <p>Este gráfico muestra el pulso operativo de tu negocio mes a mes:</p>
                    <ul class="text-muted">
                        <li><strong>Ingresos (Verde):</strong> Dinero que entra por ventas o servicios.</li>
                        <li><strong>Gastos (Rojo):</strong> Costos operativos y salidas de dinero.</li>
                    </ul>
                    <p class="mb-0"><strong>Interpretación:</strong> Lo ideal es ver las barras verdes consistentemente por encima de las rojas. Si la diferencia se achica, tu margen operativo está bajo presión.</p>
                `
            },
            'COST_STRUCTURE': {
                title: 'Ayuda: Estructura de Costos',
                content: `
                    <p>Visualiza en qué se está yendo tu dinero:</p>
                    <p class="text-muted">Divide tus gastos por categorías para identificar los centros de mayor costo.</p>
                    <p class="mb-0"><strong>Interpretación:</strong> Te permite detectar gastos "hormiga" o áreas donde podrías optimizar recursos si un sector se vuelve demasiado dominante.</p>
                `
            },
            'INCOME_TREND': {
                title: 'Ayuda: Tendencia de Ingresos',
                content: `
                    <p>Compara tus ingresos actuales con el mismo periodo del año anterior:</p>
                    <ul class="text-muted">
                        <li><strong>Año Actual:</strong> Tu desempeño presente.</li>
                        <li><strong>Año Anterior (Línea tenue):</strong> Tu referencia histórica.</li>
                    </ul>
                    <p class="mb-0"><strong>Interpretación:</strong> Te ayuda a entender la estacionalidad de tu negocio y a validar si estás creciendo interanualmente.</p>
                `
            },
            'ASSET_ALLOCATION': {
                title: 'Ayuda: Asignación de Activos',
                content: `
                    <p>Muestra cómo está distribuido tu patrimonio invertido:</p>
                    <p class="text-muted">Indica el porcentaje de capital en cada tipo de activo (ej: Cripto, Acciones, Inmuebles, Fondo de Emergencia).</p>
                    <p class="mb-0"><strong>Interpretación:</strong> Es clave para la gestión de riesgo. Una cartera diversificada te protege contra la volatilidad de un sector específico.</p>
                `
            },
            'CURRENCY_COMPOSITION': {
                title: 'Ayuda: Composición por Moneda',
                content: `
                    <p>Indica tu exposición cambiaria:</p>
                    <p class="text-muted">Muestra qué porcentaje de tu patrimonio total (Cajas + Inversiones) está en cada moneda (ARS, USD, etc.).</p>
                    <p class="mb-0"><strong>Interpretación:</strong> En contextos inflacionarios, te permite controlar si estás manteniendo una cobertura adecuada en moneda dura.</p>
                `
            },
            'WEALTH_EVOLUTION': {
                title: 'Ayuda: Evolución Patrimonial',
                content: `
                    <p>La métrica definitiva de salud financiera a largo plazo:</p>
                    <p class="text-muted">Suma el valor de todas tus cajas y activos mes a mes.</p>
                    <p class="mb-0"><strong>Interpretación:</strong> No importa cuánto ganes, sino cuánto conserves. Una pendiente ascendente indica que tu riqueza neta real está aumentando.</p>
                `
            }
        };

        const help = helpData[chartKey];
        if (help) {
            const titleEl = document.getElementById('help-title');
            const contentEl = document.getElementById('help-content');
            const modalEl = document.getElementById('modal-chart-help');

            if (titleEl) titleEl.innerText = help.title;
            if (contentEl) contentEl.innerHTML = help.content;
            
            if (modalEl) {
                const modal = new bootstrap.Modal(modalEl);
                modal.show();
            } else {
                console.warn("Help modal element not found");
                alert(help.title + "\n\n" + help.content.replace(/<[^>]*>?/gm, ''));
            }
        }
    },
    
    switchTab: (tabName) => {
        currentTab = tabName;
        setTimeout(() => {
            Object.values(chartInstances).forEach(chart => {
                if(chart && typeof chart.resize === 'function') chart.resize();
            });
            updateDashboard(); // Re-render for the specific tab
        }, 200);
    },

    showChartHelp: (chartKey) => {
        const helpData = {
            'WEALTH_EVOLUTION': {
                title: 'Ayuda: Evolución del Patrimonio',
                content: `
                    <p>Este gráfico muestra la trayectoria de tu capital durante todo el año:</p>
                    <ul class="text-muted">
                        <li><strong>Caja Disponible (Línea Azul):</strong> Es tu liquidez real. Dinero libre para gastar después de operar y ahorrar.</li>
                        <li><strong>Reservas Totales (Línea Verde):</strong> Es el acumulado de todos tus ahorros y fondos de reserva activos.</li>
                    </ul>
                    <p class="mb-0"><strong>Tip:</strong> Busca que la línea verde siempre suba, indicando que tu patrimonio crece mes a mes.</p>
                `
            },
            'SAVINGS_DISTRIBUTION': {
                title: 'Ayuda: Distribución por Metas',
                content: `
                    <p>Muestra cómo tienes repartido tu capital de reserva actual:</p>
                    <p class="text-muted">Toma el total de tus ahorros y los divide por las categorías que has definido (ej. Inversiones, Fondo de Emergencia, Viajes).</p>
                    <p class="mb-0"><strong>Tip:</strong> Te ayuda a detectar si estás demasiado concentrado en una sola meta.</p>
                `
            },
            'MONTHLY_SAVINGS': {
                title: 'Ayuda: Ahorro Mensual',
                content: `
                    <p>Mide tu ritmo de ahorro o "capitalización" mensual:</p>
                    <p class="text-muted">Cada barra representa el monto neto que lograste mover del saldo disponible hacia tus ahorros en ese mes específico.</p>
                    <p class="mb-0"><strong>Tip:</strong> Compara los picos y valles para entender qué meses son más propicios para tu ahorro.</p>
                `
            },
            'SURVIVAL_RATE': {
                title: 'Ayuda: Supervivencia Estimada',
                content: `
                    <p>Indica cuántos meses podrías mantener tu estilo de vida actual sin percibir ingresos:</p>
                    <ul class="text-muted">
                        <li><strong>Cálculo:</strong> Divide tus Reservas Totales por tu promedio de gastos de la <strong>moneda seleccionada</strong> de los últimos 6 meses.</li>
                        <li><strong>Significado:</strong> Si el valor es 6.0, significa que tienes ahorros para cubrir 6 meses de gastos en esa moneda.</li>
                        <li><strong>Nota:</strong> Si no tienes gastos registrados en esta moneda, el sistema asumirá una supervivencia prolongada (+99).</li>
                    </ul>
                    <p class="mb-0"><strong>Tip:</strong> Los expertos recomiendan tener entre 3 y 6 meses de "pista financiera" como fondo de emergencia.</p>
                `
            },
            'SAVINGS_PROGRESS': {
                title: 'Ayuda: Progreso de Metas',
                content: `
                    <p>Muestra qué tan cerca estás de alcanzar tus objetivos financieros definidos:</p>
                    <ul class="text-muted">
                        <li><strong>Rojo:</strong> Menos del 30% completado.</li>
                        <li><strong>Amarillo:</strong> Entre el 30% y 70%.</li>
                        <li><strong>Verde:</strong> Más del 70% del camino recorrido.</li>
                    </ul>
                    <p class="mb-0"><strong>Tip:</strong> Define un "Monto Objetivo" al crear un ahorro para que aparezca en este panel.</p>
                `
            },
            'CRM_STATUS': {
                title: 'Ayuda: Estado de Tareas',
                content: `
                    <p>Muestra la distribución de tus tareas actuales por su estado de gestión:</p>
                    <p class="text-muted">Te permite ver rápidamente cuántas tareas tienes pendientes, en curso o completadas.</p>
                    <p class="mb-0"><strong>Tip:</strong> Ideal para identificar cuellos de botella en la gestión diaria.</p>
                `
            },
            'CRM_CLIENTS': {
                title: 'Ayuda: Top Clientes Activos',
                content: `
                    <p>Identifica a los clientes que requieren mayor atención:</p>
                    <p class="text-muted">Muestra los 5 clientes que tienen más tareas abiertas (no completadas).</p>
                    <p class="mb-0"><strong>Tip:</strong> Te ayuda a priorizar tu tiempo hacia los casos con mayor actividad o complejidad.</p>
                `
            },
            'CRM_TREND': {
                title: 'Ayuda: Tendencia de Tareas',
                content: `
                    <p>Mide tu productividad operativa en los últimos 6 meses:</p>
                    <p class="text-muted">Muestra la cantidad de tareas que lograste cerrar (estado "Completada") cada mes.</p>
                    <p class="mb-0"><strong>Tip:</strong> Una línea ascendente o estable indica un buen ritmo de resolución de requerimientos.</p>
                `
            }
        };

        const help = helpData[chartKey];
        if (help) {
            document.getElementById('help-title').innerText = help.title;
            document.getElementById('help-content').innerHTML = help.content;
            const modal = new bootstrap.Modal(document.getElementById('modal-chart-help'));
            modal.show();
        }
    },

    applyFilters: () => {
        filterYear = parseInt(document.getElementById('analytics-year').value);
        filterMonth = parseInt(document.getElementById('analytics-month').value);
        filterQuarter = parseInt(document.getElementById('analytics-quarter').value);
        filterSemester = parseInt(document.getElementById('analytics-semester').value);
        filterAccount = document.getElementById('analytics-account').value;
        updateDashboard();
    }
};

let currentTab = 'BILLING';

function updatePeriodButtons() {
    document.querySelectorAll('.btn-group button').forEach(b => b.classList.remove('active'));
    const btnId = 'btn-period-' + filterPeriod.toLowerCase();
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
}

function updateSelectorsVisibility() {
    // Hide all first
    const m = document.getElementById('analytics-month');
    const q = document.getElementById('analytics-quarter');
    const s = document.getElementById('analytics-semester');

    if (m) m.classList.add('d-none');
    if (q) q.classList.add('d-none');
    if (s) s.classList.add('d-none');

    // Show specific
    if (filterPeriod === 'MONTH' && m) m.classList.remove('d-none');
    if (filterPeriod === 'QUARTER' && q) q.classList.remove('d-none');
    if (filterPeriod === 'SEMESTER' && s) s.classList.remove('d-none');
}
function updateDashboard() {
    // 1. Filter Transactions (Operations)
    let filteredTx = invoicesData;
    if (filterAccount !== 'ALL') {
        filteredTx = invoicesData.filter(tx => tx.accountId === filterAccount);
    }

    // Filter by Year
    const yearTx = filteredTx.filter(tx => tx.dateObj.getFullYear() === filterYear);

    // Filter by Period for KPIs
    const periodData = yearTx.filter(tx => {
        if (filterPeriod === 'MONTH') return tx.dateObj.getMonth() === filterMonth;
        return true; // YEAR
    });

    // 2. Calculate KPIs
    calculateOperativeKPIs(periodData);
    calculateWealthKPIs();
    
    // 3. Render Charts based on Tab
    if (currentTab === 'BILLING') {
        renderOperativeDashboard(yearTx); 
    } else if (currentTab === 'SAVINGS') {
        renderWealthDashboard();
    } else if (currentTab === 'CRM') {
        updateCRMDashboard();
    }
}

function calculateOperativeKPIs(periodData) {
    let income = 0;
    let expenses = 0;
    let savings = 0;

    periodData.forEach(tx => {
        let amount = parseFloat(tx.amount) || 0;
        
        // Convert to Filter Currency if needed
        if (tx.currency === 'USD' && filterCurrency === 'ARS') amount *= EXCHANGE_RATE;
        if (tx.currency === 'ARS' && filterCurrency === 'USD') amount /= EXCHANGE_RATE;

        if (tx.type === 'INCOME') {
            income += amount;
        } else if (tx.type === 'EXPENSE') {
            // EXCLUDE INVESTMENT from Operating Expenses
            if (tx.category !== 'INVESTMENT') {
                expenses += amount;
            }
        } else if (tx.type === 'SAVING') {
            savings += amount;
        }
    });

    const profit = income - expenses;
    const savingsRate = income > 0 ? (savings / income) * 100 : 0;

    // Update UI
    if(document.getElementById('kpi-billed')) document.getElementById('kpi-billed').innerText = formatCurrency(income);
    if(document.getElementById('kpi-expenses')) document.getElementById('kpi-expenses').innerText = formatCurrency(expenses);
    if(document.getElementById('kpi-profit')) document.getElementById('kpi-profit').innerText = formatCurrency(profit);
    if(document.getElementById('kpi-savings-rate')) document.getElementById('kpi-savings-rate').innerText = savingsRate.toFixed(1);
}

function calculateWealthKPIs() {
    let totalLiquidity = 0;
    let totalInvested = 0;

    // 1. Accounts Liquidity
    accountsData.forEach(acc => {
        let balance = parseFloat(acc.balance) || 0;
        if (acc.currency === 'USD' && filterCurrency === 'ARS') balance *= EXCHANGE_RATE;
        if (acc.currency === 'ARS' && filterCurrency === 'USD') balance /= EXCHANGE_RATE;
        totalLiquidity += balance;
    });

    // 2. Assets (Inversiones)
    assetsData.forEach(asset => {
        // Use currentValuation if available, otherwise investedAmount
        let value = parseFloat(asset.currentValuation) || parseFloat(asset.investedAmount) || parseFloat(asset.amount) || 0;
        if (asset.currency === 'USD' && filterCurrency === 'ARS') value *= EXCHANGE_RATE;
        if (asset.currency === 'ARS' && filterCurrency === 'USD') value /= EXCHANGE_RATE;
        totalInvested += value;
    });

    const totalWealth = totalLiquidity + totalInvested;

    // 3. Runway (Average monthly expenses of LAST 3 MONTHS)
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    
    const recentExpenses = invoicesData.filter(tx => 
        tx.type === 'EXPENSE' && 
        tx.category !== 'INVESTMENT' &&
        tx.dateObj >= threeMonthsAgo
    );

    let totalRecentExpenses = 0;
    recentExpenses.forEach(tx => {
        let amount = parseFloat(tx.amount) || 0;
        if (tx.currency === 'USD' && filterCurrency === 'ARS') amount *= EXCHANGE_RATE;
        if (tx.currency === 'ARS' && filterCurrency === 'USD') amount /= EXCHANGE_RATE;
        totalRecentExpenses += amount;
    });

    const avgMonthlyExpense = totalRecentExpenses / 3;
    const runway = avgMonthlyExpense > 0 ? totalLiquidity / avgMonthlyExpense : (totalLiquidity > 0 ? 99 : 0);

    // Update UI
    if(document.getElementById('kpi-total-wealth')) document.getElementById('kpi-total-wealth').innerText = formatCurrency(totalWealth);
    if(document.getElementById('kpi-liquidity')) document.getElementById('kpi-liquidity').innerText = formatCurrency(totalLiquidity);
    if(document.getElementById('kpi-invested')) document.getElementById('kpi-invested').innerText = formatCurrency(totalInvested);
    if(document.getElementById('kpi-survival-months')) document.getElementById('kpi-survival-months').innerText = runway.toFixed(1);
}

// --- Chart Rendering ---

function renderOperativeDashboard(yearTx) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const incomeByMonth = new Array(12).fill(0);
    const expenseByMonth = new Array(12).fill(0);
    const prevYearIncome = new Array(12).fill(0);

    // Current Year Data
    yearTx.forEach(tx => {
        const m = tx.dateObj.getMonth();
        let amount = parseFloat(tx.amount) || 0;
        if (tx.currency === 'USD' && filterCurrency === 'ARS') amount *= EXCHANGE_RATE;
        if (tx.currency === 'ARS' && filterCurrency === 'USD') amount /= EXCHANGE_RATE;

        if (tx.type === 'INCOME') incomeByMonth[m] += amount;
        else if (tx.type === 'EXPENSE' && tx.category !== 'INVESTMENT') expenseByMonth[m] += amount;
    });

    // Previous Year Income (for comparison)
    invoicesData.filter(tx => 
        tx.dateObj.getFullYear() === (filterYear - 1) && 
        tx.type === 'INCOME' &&
        (filterAccount === 'ALL' || tx.accountId === filterAccount)
    ).forEach(tx => {
        const m = tx.dateObj.getMonth();
        let amount = parseFloat(tx.amount) || 0;
        if (tx.currency === 'USD' && filterCurrency === 'ARS') amount *= EXCHANGE_RATE;
        if (tx.currency === 'ARS' && filterCurrency === 'USD') amount /= EXCHANGE_RATE;
        prevYearIncome[m] += amount;
    });

    // 1. Run Rate Chart
    createChart('chart-billing-trend', 'bar', {
        labels: months,
        datasets: [
            {
                label: 'Ingresos ' + filterYear,
                data: incomeByMonth,
                backgroundColor: '#2ab57d',
                borderRadius: 5
            },
            {
                label: 'Gastos ' + filterYear,
                data: expenseByMonth,
                backgroundColor: '#fd625e',
                borderRadius: 5
            }
        ]
    });

    // 2. Cost Structure (Doughnut)
    const expenseCats = {};
    yearTx.filter(tx => tx.type === 'EXPENSE' && tx.category !== 'INVESTMENT').forEach(tx => {
        const cat = tx.category || 'Varios';
        let amount = parseFloat(tx.amount) || 0;
        if (tx.currency === 'USD' && filterCurrency === 'ARS') amount *= EXCHANGE_RATE;
        if (tx.currency === 'ARS' && filterCurrency === 'USD') amount /= EXCHANGE_RATE;
        expenseCats[cat] = (expenseCats[cat] || 0) + amount;
    });

    // Get Top 5 + Others
    const sortedCats = Object.entries(expenseCats).sort((a,b) => b[1] - a[1]);
    const top5 = sortedCats.slice(0, 5);
    const others = sortedCats.slice(5).reduce((sum, current) => sum + current[1], 0);
    
    const finalLabels = top5.map(c => c[0]);
    const finalData = top5.map(c => c[1]);
    if(others > 0) {
        finalLabels.push('Otros');
        finalData.push(others);
    }

    createChart('chart-expenses-dist', 'doughnut', {
        labels: finalLabels,
        datasets: [{
            data: finalData,
            backgroundColor: ["#fd625e", "#ffbf53", "#4ba6ef", "#5156be", "#2ab57d", "#ced4da"]
        }]
    });

    // 3. Income Trend (Interanual)
    createChart('chart-income-trend', 'line', {
        labels: months,
        datasets: [
            {
                label: 'Ingresos ' + filterYear,
                data: incomeByMonth,
                borderColor: '#5156be',
                backgroundColor: 'rgba(81, 86, 190, 0.1)',
                fill: true,
                tension: 0.4
            },
            {
                label: 'Ingresos ' + (filterYear - 1),
                data: prevYearIncome,
                borderColor: '#ced4da',
                borderDash: [5, 5],
                fill: false,
                tension: 0.4
            }
        ]
    });
}

function renderWealthDashboard() {
    // 1. Asset Allocation (By Category)
    const assetCats = {};
    assetsData.forEach(asset => {
        const cat = asset.category || 'Inversión';
        let value = parseFloat(asset.currentValuation) || parseFloat(asset.investedAmount) || parseFloat(asset.amount) || 0;
        if (asset.currency === 'USD' && filterCurrency === 'ARS') value *= EXCHANGE_RATE;
        if (asset.currency === 'ARS' && filterCurrency === 'USD') value /= EXCHANGE_RATE;
        assetCats[cat] = (assetCats[cat] || 0) + value;
    });

    createChart('chart-asset-allocation', 'doughnut', {
        labels: Object.keys(assetCats),
        datasets: [{
            data: Object.values(assetCats),
            backgroundColor: ["#5156be", "#2ab57d", "#ffbf53", "#fd625e", "#4ba6ef"]
        }]
    });

    // 2. Currency Composition (Stacked Bar: Liquidity)
    let liqARS = 0;
    let liqUSD = 0;
    accountsData.forEach(acc => {
        // Use updated balance if available, or try to derive it if possible
        // Currently deriving balance in analytics is hard without recalculating whole history.
        // We assume 'balance' field is kept up to date by apps-cashflow.js updates.
        let bal = parseFloat(acc.balance) || 0;
        if(acc.currency === 'ARS') liqARS += bal;
        else if(acc.currency === 'USD') liqUSD += (bal * EXCHANGE_RATE); 
    });
    
    // If filter is USD, convert both to USD
    if(filterCurrency === 'USD') {
        liqARS /= EXCHANGE_RATE;
        liqUSD /= EXCHANGE_RATE;
    }

    createChart('chart-currency-composition', 'bar', {
        labels: ['Liquidez (Caja)'],
        datasets: [
            {
                label: 'ARS',
                data: [liqARS],
                backgroundColor: '#2ab57d'
            },
            {
                label: 'USD',
                data: [liqUSD],
                backgroundColor: '#5156be'
            }
        ]
    }, {
        indexAxis: 'y',
        plugins: { legend: { display: true } },
        scales: { x: { stacked: true }, y: { stacked: true } }
    });

    // 3. Progress Bars (Goals)
    const container = document.getElementById('goals-progress-container');
    if (container) {
        container.innerHTML = '';
        const goals = assetsData.filter(a => a.targetAmount > 0);
        
        if (goals.length === 0) {
            container.innerHTML = '<p class="text-muted text-center pt-5">No hay activos con "Objetivo" definido.</p>';
        } else {
            goals.forEach(g => {
                const amount = parseFloat(g.investedAmount) || parseFloat(g.amount) || 0;
                const target = parseFloat(g.targetAmount) || 0;
                const perc = Math.min(100, (amount / target) * 100);
                const colorClass = perc < 30 ? 'bg-danger' : (perc < 70 ? 'bg-warning' : 'bg-success');
                
                const html = `
                    <div class="mb-4">
                        <div class="d-flex align-items-center mb-2">
                            <div class="flex-grow-1"><h5 class="font-size-14 mb-0">${g.name}</h5></div>
                            <div class="flex-shrink-0"><span class="badge badge-soft-primary">${perc.toFixed(0)}%</span></div>
                        </div>
                        <div class="progress animated-progess custom-progress">
                            <div class="progress-bar ${colorClass}" role="progressbar" style="width: ${perc}%"></div>
                        </div>
                        <div class="d-flex justify-content-between mt-1">
                            <small class="text-muted">${formatCurrency(amount)}</small>
                            <small class="text-muted">Meta: ${formatCurrency(target)}</small>
                        </div>
                    </div>
                `;
                container.insertAdjacentHTML('beforeend', html);
            });
        }
    }

    // 4. Wealth Evolution (Line) - Simulated trend based on last 6 months transactions if historical snapshots missing
    // For now, let's use a simple trend of the current month vs previous months totals if possible
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const wealthTrend = new Array(12).fill(0);
    // Simple logic: cumulative wealth based on transactions (imperfect but better than flat line)
    // We would need snapshots for 100% accuracy, but we can simulate by subtracting/adding transactions backwards.
    // Given the complexity and potential errors, a simpler approach is to show current for now.
    // IMPROVEMENT: Fill only up to current month with current total.
    const currentM = new Date().getMonth();
    const currentTotal = parseFloat(document.getElementById('kpi-total-wealth').innerText.replace(/[^0-9.-]+/g,"")) || 0;
    for(let i=0; i<=currentM; i++) wealthTrend[i] = currentTotal;

    createChart('chart-wealth-evolution', 'line', {
        labels: months,
        datasets: [{
            label: 'Patrimonio Neto',
            data: wealthTrend,
            borderColor: '#2ab57d',
            backgroundColor: 'rgba(42, 181, 125, 0.1)',
            fill: true,
            tension: 0.4
        }]
    });
}

// --- Helpers ---



// --- CRM Logic ---

function updateCRMDashboard() {
    // Filter Tasks based on Year/Period filters? 
    // Usually CRM is more "Current State", but "Tasks Completed" could be filtered.
    // Let's filter tasks by the global date filter for trend/completion analysis.
    // For "Active Tasks" and "Active Clients", we usually want the CURRENT status, regardless of date filter,
    // OR we can show "Active during that period". 
    // For simplicity: Status & Active Clients = Current Snapshot interaction. 
    // Completed Tasks = Filtered by selected period.

    const filteredTasks = tasksData.filter(t => {
        if (!t.dateObj) return false;
        // Basic Year Filter
        return t.dateObj.getFullYear() === filterYear;
    });

    calculateCRMKPIs(tasksData, clientsData); // Pass ALL data for current status
    renderCRMCharts(tasksData, clientsData);
}

function calculateCRMKPIs(allTasks, allClients) {
    // 1. Total Active Clients
    // Simple count of clients collection? Or clients with active tasks?
    // Let's use total clients count for now.
    const totalClients = allClients.length;

    // 2. Active Tasks
    const activeTasks = allTasks.filter(t => t.status !== 'Completada' && t.status !== 'Cancelada').length;

    // 3. Completed Tasks (This Month - regardless of global filter for this specific KPI card usually, 
    //    but let's respect global filter if 'MONTH' is selected? 
    //    Standard usage: This Month defaults.
    // 3. Completed Tasks (This Month)
    const nowLocal = new Date();
    const completedTasksThisMonth = allTasks.filter(t => {
        const isCompleted = (t.status === 'Completada' || t.status === 'COMPLETED');
        return isCompleted && 
               t.dateObj && 
               t.dateObj.getMonth() === nowLocal.getMonth() && 
               t.dateObj.getFullYear() === nowLocal.getFullYear();
    }).length;

    document.getElementById('kpi-crm-clients').innerText = totalClients;
    document.getElementById('kpi-crm-active-tasks').innerText = activeTasks;
    document.getElementById('kpi-crm-completed-tasks').innerText = completedTasksThisMonth;
}

function renderCRMCharts(allTasks, allClients) {
    // 1. Task Status Distribution (Current Snapshot)
    const statusCounts = {};
    allTasks.forEach(t => {
        const s = t.status || 'Sin Estado';
        statusCounts[s] = (statusCounts[s] || 0) + 1;
    });

    createChart('chart-crm-status', 'doughnut', {
        labels: Object.keys(statusCounts).map(s => {
            if(s === 'TODO') return 'Pendiente';
            if(s === 'COMPLETED' || s === 'Completada') return 'Completado';
            if(s === 'LATE') return 'Atrasado';
            return s;
        }),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ["#5156be", "#2ab57d", "#fd625e", "#ffbf53", "#4ba6ef"]
        }]
    }, { noCurrency: true });

    // 2. Top Active Clients (Clients with most ACTIVE tasks)
    const clientTaskCounts = {};
    const clientMap = {};
    allClients.forEach(c => {
        const name = (c.firstName || c.lastName) 
            ? ((c.firstName || '') + ' ' + (c.lastName || '')).trim() 
            : (c.name || 'Cliente sin nombre');
        clientMap[c.id] = name;
    });

    allTasks.filter(t => t.status !== 'Completada' && t.status !== 'COMPLETED').forEach(t => {
        if(t.clientId) {
            const name = clientMap[t.clientId] || 'Desconocido';
            clientTaskCounts[name] = (clientTaskCounts[name] || 0) + 1;
        }
    });

    // Sort and get Top 5
    const topClients = Object.entries(clientTaskCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    createChart('chart-crm-clients', 'bar', {
        labels: topClients.map(x => x[0]),
        datasets: [{
            label: 'Tareas Activas',
            data: topClients.map(x => x[1]),
            backgroundColor: '#5156be',
            borderRadius: 5
        }]
    }, { noCurrency: true });

    // 3. Task Completion Trend (Last 6 Months from now)
    // Regardless of filter, usually "Last 6 Months" is a fixed standard view or YTD.
    // Let's do Last 6 Months.
    const months = [];
    const completedCounts = [];
    
    for(let i=5; i>=0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const mName = d.toLocaleString('es-ES', { month: 'short' });
        months.push(mName);
        
        // Count completed in this month/year (Unified statuses)
        const count = allTasks.filter(t => {
            const isCompleted = (t.status === 'Completada' || t.status === 'COMPLETED');
            return isCompleted && 
                   t.dateObj && 
                   t.dateObj.getMonth() === d.getMonth() && 
                   t.dateObj.getFullYear() === d.getFullYear();
        }).length;
        completedCounts.push(count);
    }

    createChart('chart-crm-trend', 'line', {
        labels: months,
        datasets: [{
            label: 'Tareas Completadas',
            data: completedCounts,
            borderColor: '#2ab57d',
            fill: true,
            backgroundColor: 'rgba(42, 181, 125, 0.1)',
            tension: 0.4
        }]
    }, { noCurrency: true });
}

function createChart(canvasId, type, dataConfig, extraOptions = {}) {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;

    if(chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'bottom' },
            tooltip: {
                callbacks: {
                    label: function(context) {
                        let label = context.dataset.label || '';
                        if (label) label += ': ';
                        
                        const value = (typeof context.parsed === 'object' && context.parsed !== null) 
                            ? context.parsed.y 
                            : context.parsed;
                            
                        const formattedValue = extraOptions.noCurrency ? value : formatCurrency(value);

                        if (type === 'pie' || type === 'doughnut') {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return `${extraOptions.noCurrency ? context.label : label}${formattedValue} (${percentage})`;
                        }
                        return `${label}${formattedValue}`;
                    }
                }
            }
        },
        scales: type === 'bar' || type === 'line' ? {
            y: { 
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)' },
                ticks: {
                    callback: function(value) {
                        if (extraOptions.noCurrency) return value;
                        if (value >= 1000) return formatCurrency(value);
                        return value;
                    }
                }
            },
            x: {
                grid: { display: false }
            }
        } : {}
    };

    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: dataConfig,
        options: chartOptions
    });
}

function formatCurrency(val) {
    if(filterCurrency === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);
}
