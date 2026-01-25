// apps-analytics.js - Management Charts Logic

// Globals
let chartInstances = {}; // Store chart instances to destroy/update
let invoicesData = [];
let tasksData = [];
let clientsData = [];

// Defaults to Current Month
// Defaults to Current Month
const now = new Date();
let filterYear = now.getFullYear();
let filterPeriod = 'MONTH'; // YEAR, SEMESTER, QUARTER, MONTH
let filterMonth = now.getMonth(); // 0-11
let filterQuarter = Math.floor(now.getMonth() / 3) + 1; // 1-4
let filterSemester = now.getMonth() < 6 ? 1 : 2; // 1-2
let filterCurrency = 'ARS'; // ARS, USD

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function() {
    // Populate Years dynamically
    populateYearSelect();

    // Set UI Defaults for other filters
    document.getElementById('analytics-month').value = filterMonth;
    document.getElementById('analytics-quarter').value = filterQuarter;
    document.getElementById('analytics-semester').value = filterSemester;
    
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
    // 1. Listen to Invoices (Collection: 'invoices')
    // Ensure we are reading the same collection as apps-cashflow.js
    // Confirmed via inspection: usually 'cashflow' or 'invoices'. Using 'invoices' based on previous context.
    // If apps-cashflow.js uses a different one, we will find out in verification.
    // 1. Listen to Transactions (Collection: 'transactions')
    // Corrected from 'invoices' to 'transactions' to match Cashflow module
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

    // 2. Listen to Tasks (CRM)
    db.collection('tasks').onSnapshot(snap => {
        tasksData = [];
        snap.forEach(doc => {
            const d = doc.data();
             // Parse Date Helper for Tasks
             let dateObj = null;
             if (d.createdAt && d.createdAt.seconds) dateObj = new Date(d.createdAt.seconds * 1000);
             else if (d.createdAt) dateObj = new Date(d.createdAt);
             // Also check for 'completedAt' if available, or use 'updatedAt' for completion trend
            
            tasksData.push({ id: doc.id, ...d, dateObj: dateObj });
        });
        updateDashboard();
    });

    // 3. Listen to Clients (CRM)
    db.collection('clients').onSnapshot(snap => {
        clientsData = [];
        snap.forEach(doc => {
            clientsData.push({ id: doc.id, ...doc.data() });
        });
        updateDashboard();
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
        updateDashboard();
    },
    
    switchTab: (tabName) => {
        setTimeout(() => {
            Object.values(chartInstances).forEach(chart => chart.resize());
        }, 200);
    }
};

function updatePeriodButtons() {
    document.querySelectorAll('.btn-group button').forEach(b => b.classList.remove('active'));
    const btnId = 'btn-period-' + filterPeriod.toLowerCase();
    const btn = document.getElementById(btnId);
    if(btn) btn.classList.add('active');
}

function updateSelectorsVisibility() {
    // Hide all first
    document.getElementById('analytics-month').classList.add('d-none');
    document.getElementById('analytics-quarter').classList.add('d-none');
    document.getElementById('analytics-semester').classList.add('d-none');

    // Show specific
    if (filterPeriod === 'MONTH') document.getElementById('analytics-month').classList.remove('d-none');
    if (filterPeriod === 'QUARTER') document.getElementById('analytics-quarter').classList.remove('d-none');
    if (filterPeriod === 'SEMESTER') document.getElementById('analytics-semester').classList.remove('d-none');
}

function updateDashboard() {
    // Filter Data Logic
    const filteredInvoices = invoicesData.filter(inv => {
        if (!inv.dateObj) return false;
        
        const yearMatch = inv.dateObj.getFullYear() === filterYear;
        if (!yearMatch) return false;

        const m = inv.dateObj.getMonth(); // 0-11
        const q = Math.floor(m / 3) + 1;
        const s = m < 6 ? 1 : 2;

        if (filterPeriod === 'MONTH') return m === filterMonth;
        if (filterPeriod === 'QUARTER') return q === filterQuarter;
        if (filterPeriod === 'SEMESTER') return s === filterSemester;
        
        return true; // YEAR
    });

    // Filter by Currency
    const currencyInvoices = filteredInvoices.filter(inv => (inv.currency || 'ARS') === filterCurrency);

    calculateKPIs(currencyInvoices);
    renderBillingCharts(currencyInvoices); // Pass filtered data (by period AND currency)
    
    // CRM Updates
    updateCRMDashboard();
}

function calculateKPIs(data) {
    let totalBilled = 0;
    let totalExpenses = 0;
    let totalPending = 0;

    data.forEach(inv => {
        const val = parseFloat(inv.amount) || 0;
        
        if(inv.type === 'INCOME') {
            totalBilled += val;
            if(inv.status !== 'PAID') totalPending += val;
        } else if (inv.type === 'EXPENSE') {
            totalExpenses += val;
            if(inv.status !== 'PAID') totalPending += val;
        }
    });

    // Special YTD Calculation (Everything in the year up to now)
    // Filter all invoices for the year, regardless of period selection
    const ytdInvoices = invoicesData.filter(inv => inv.dateObj && inv.dateObj.getFullYear() === filterYear && inv.type === 'INCOME');
    const ytdTotal = ytdInvoices.reduce((sum, inv) => sum + (parseFloat(inv.amount) || 0), 0);

    const netProfit = totalBilled - totalExpenses;

    document.getElementById('kpi-billed').innerText = formatCurrency(totalBilled);
    document.getElementById('kpi-expenses').innerText = formatCurrency(totalExpenses);
    document.getElementById('kpi-profit').innerText = formatCurrency(netProfit);
    document.getElementById('kpi-pending').innerText = formatCurrency(totalPending);
    
    // We can show YTD somewhere else or just use the Billed one (depends on context).
    // For now the Billed KPI reflects the FILTERED period. 
}

// --- Chart Rendering ---

function renderBillingCharts(data) {
    // 1. Trend (Line/Bar) WITH CURRENCY FILTER
    // Note: 'data' is already filtered by Period and Currency.
    // However, for Trend, we often want to see the whole year context but in the selected currency.
    // So let's re-filter GLOBAL `invoicesData` by Year and Currency for the Trend Chart.
    
    const yearData = invoicesData.filter(inv => 
        inv.dateObj && 
        inv.dateObj.getFullYear() === filterYear &&
        (inv.currency || 'ARS') === filterCurrency
    );
    
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const incomeByMonth = new Array(12).fill(0);
    const expenseByMonth = new Array(12).fill(0);

    yearData.forEach(inv => {
        const m = inv.dateObj.getMonth();
        const val = parseFloat(inv.amount) || 0;
        if(inv.type === 'INCOME') incomeByMonth[m] += val;
        else if(inv.type === 'EXPENSE') expenseByMonth[m] += val;
    });

    createChart('chart-billing-trend', 'bar', {
        labels: months,
        datasets: [
            {
                label: 'Ingresos',
                data: incomeByMonth,
                backgroundColor: '#2ab57d',
                borderRadius: 5
            },
            {
                label: 'Gastos',
                data: expenseByMonth,
                backgroundColor: '#fd625e',
                borderRadius: 5
            }
        ]
    });

    // 2. Income Distribution (Filtered Data Only)
    const incomeCats = {};
    data.filter(i => i.type === 'INCOME').forEach(inv => {
        const cat = inv.category || 'Varios';
        incomeCats[cat] = (incomeCats[cat] || 0) + parseFloat(inv.amount);
    });

    createChart('chart-income-dist', 'doughnut', {
        labels: Object.keys(incomeCats),
        datasets: [{
            data: Object.values(incomeCats),
            backgroundColor: ["#2ab57d", "#5156be", "#fd625e", "#ffbf53", "#4ba6ef"]
        }]
    });

    // 3. Expenses Distribution (Filtered Data Only)
    const expenseCats = {};
    data.filter(i => i.type === 'EXPENSE').forEach(inv => {
        const cat = inv.category || 'Otros';
        expenseCats[cat] = (expenseCats[cat] || 0) + parseFloat(inv.amount);
    });

    createChart('chart-expenses-dist', 'doughnut', {
        labels: Object.keys(expenseCats),
        datasets: [{
            data: Object.values(expenseCats),
            backgroundColor: ["#fd625e", "#ffbf53", "#4ba6ef", "#5156be", "#2ab57d"]
        }]
    });

    // 4. YTD Accumulation (Context: Year + Currency)
    let accIncome = 0;
    const ytdData = incomeByMonth.map(val => {
        accIncome += val;
        return accIncome;
    });

    createChart('chart-ytd', 'line', {
        labels: months,
        datasets: [{
            label: 'Ingresos Acumulados (YTD)',
            data: ytdData,
            borderColor: '#2ab57d',
            fill: true,
            backgroundColor: 'rgba(42, 181, 125, 0.1)',
            tension: 0.4
        }]
    });

    // 5. Collection Rate (Filtered Data)
    let paid = 0;
    let pending = 0;
    data.filter(i => i.type === 'INCOME').forEach(inv => {
         if(inv.status === 'PAID') paid += parseFloat(inv.amount);
         else pending += parseFloat(inv.amount);
    });

    createChart('chart-collection-rate', 'pie', {
        labels: ['Cobrado', 'Pendiente'],
        datasets: [{
            data: [paid, pending],
            backgroundColor: ["#2ab57d", "#ffbf53"]
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
    const nowLocal = new Date();
    const completedTasksThisMonth = allTasks.filter(t => {
        return t.status === 'Completada' && 
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
        labels: Object.keys(statusCounts),
        datasets: [{
            data: Object.values(statusCounts),
            backgroundColor: ["#5156be", "#2ab57d", "#fd625e", "#ffbf53", "#4ba6ef"]
        }]
    });

    // 2. Top Active Clients (Clients with most ACTIVE tasks)
    const clientTaskCounts = {};
    // Map clientId to Name first
    const clientMap = {};
    allClients.forEach(c => clientMap[c.id] = c.firstName + ' ' + c.lastName);

    allTasks.filter(t => t.status !== 'Completada').forEach(t => {
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
    });

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
        
        // Count completed in this month/year
        const count = allTasks.filter(t => {
            return t.status === 'Completada' && 
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
    });
}

function createChart(canvasId, type, dataConfig) {
    const ctx = document.getElementById(canvasId);
    if(!ctx) return;

    if(chartInstances[canvasId]) {
        chartInstances[canvasId].destroy();
    }

    chartInstances[canvasId] = new Chart(ctx, {
        type: type,
        data: dataConfig,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom' }
            },
            scales: type === 'bar' || type === 'line' ? {
                y: { beginAtZero: true }
            } : {}
        }
    });
}

function formatCurrency(val) {
    if(filterCurrency === 'USD') {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 }).format(val);
}
