import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
import {
  subscribeManagerLiveData,
  buildRevenueOrders,
  buildDateRanges,
  recordsInRange,
  sumRevenue,
  calcPercentChange,
  getEmployeeDisplayName,
  normalizeOrderItems,
  normalizeRole,
  roleLabel,
  isActiveEmployee,
  isPaidBonus,
  formatMoneyEUR,
  formatPercent,
  formatHours,
  formatMinutes,
  formatTime,
  toDateSafe,
  toMillis,
  numberOrNull,
  firstNumber,
  mapValues,
  escapeHtml,
} from "./manager-live-data.js";

const DAY_LABELS_BG = ["Неделя", "Понеделник", "Вторник", "Сряда", "Четвъртък", "Петък", "Събота"];
const missingElements = new Set();

const el = {
  financeTodayRevenue: byId("financeTodayRevenue", "financeSalesToday"),
  financeTodayChange: byId("financeTodayChange", "financeSalesTodayChange"),
  financeWeekRevenue: byId("financeWeekRevenue", "financeSalesWeek"),
  financeWeekChange: byId("financeWeekChange", "financeSalesWeekChange"),
  financeMonthRevenue: byId("financeMonthRevenue", "financeSalesMonth"),
  financeMonthChange: byId("financeMonthChange", "financeSalesMonthChange"),
  financeAvgCheck: byId("financeAvgCheck"),
  financeAvgCheckChange: byId("financeAvgCheckChange"),
  financeCategoryRows: byId("financeCategoryRows", "tblFinanceCategories"),
  financeFoodCost: byId("financeFoodCost", "financeFoodCostPct"),
  financeFoodCostBar: byId("financeFoodCostBar", "financeFoodCostProgress"),
  financeLaborCost: byId("financeLaborCost", "financeLaborCostPct"),
  financeLaborCostBar: byId("financeLaborCostBar", "financeLaborCostProgress"),
  financeGrossMargin: byId("financeGrossMargin", "financeGrossMarginPct"),
  financeGrossMarginBar: byId("financeGrossMarginBar", "financeGrossMarginProgress"),
  financeShiftMorningValue: byId("financeShiftMorningValue"),
  financeShiftMorningBar: byId("financeShiftMorningBar"),
  financeShiftLunchValue: byId("financeShiftLunchValue"),
  financeShiftLunchBar: byId("financeShiftLunchBar"),
  financeShiftEveningValue: byId("financeShiftEveningValue"),
  financeShiftEveningBar: byId("financeShiftEveningBar"),

  analyticsPeakHour: byId("analyticsPeakHour"),
  analyticsPeakHourSub: byId("analyticsPeakHourSub"),
  analyticsBusiestDay: byId("analyticsBusiestDay"),
  analyticsBusiestDaySub: byId("analyticsBusiestDaySub"),
  analyticsAvgRating: byId("analyticsAvgRating"),
  analyticsAvgRatingSub: byId("analyticsAvgRatingSub"),

  kpiActiveStaff: byId("kpiActiveStaff"),
  kpiTotalStaff: byId("kpiTotalStaff"),
  kpiWorkedHoursToday: byId("kpiWorkedHoursToday"),
  kpiWorkedHoursTodayChange: byId("kpiWorkedHoursTodayChange"),
  kpiAvgProductivity: byId("kpiAvgProductivity"),
  kpiAvgProductivityChange: byId("kpiAvgProductivityChange"),
  kpiPaidBonuses: byId("kpiPaidBonuses"),
  kpiPaidBonusesSub: byId("kpiPaidBonusesSub", "kpiPaidBonusesChange"),
  tblWaiterSales: byId("tblWaiterSales"),
  tblCookPerformance: byId("tblCookPerformance"),
  tblAttendance: byId("tblAttendance"),
  tblRoleCounts: byId("tblRoleCounts"),
  roleCountWaiter: byId("roleCountWaiter"),
  roleCountCook: byId("roleCountCook"),
  roleCountBar: byId("roleCountBar"),
  roleCountManager: byId("roleCountManager"),
  roleCountOwner: byId("roleCountOwner"),

  tblSystemLogs: byId("tblSystemLogs"),
  logsToggleBtn: byIdOptional("logsToggleBtn"),
};

let latestLogs = [];
let logsMode = "latest";
let cachedAllLogs = null;
let latestLogsHasMore = false;
let systemLogsLoaded = false;

subscribeManagerLiveData((snapshot) => {
  renderAll(snapshot);
});

window.addEventListener("manager:tabchange", (event) => {
  if (event?.detail?.tabName === "settings") {
    loadSystemLogs();
  }
});

ensureLogsToggleBtn()?.addEventListener("click", onLogsToggleClick);

function renderAll(snapshot) {
  const ranges = buildDateRanges();
  const revenueOrders = buildRevenueOrders(snapshot);
  const context = {
    snapshot,
    ranges,
    revenueOrders,
    employees: mapValues(snapshot.employeesById),
    kitchenHistory: mapValues(snapshot.kitchenHistoryById),
    bonuses: mapValues(snapshot.bonusesById),
    payments: mapValues(snapshot.paymentsById),
    shifts: mapValues(snapshot.shiftsById),
    attendance: mapValues(snapshot.attendanceById),
  };

  renderFinance(context);
  renderStaff(context);
  renderWaiterSales(context);
  renderCookPerformance(context);
  renderAttendance(context);
  renderRoleCounts(context);
  renderAnalytics(context);
}

function renderFinance(context) {
  const { ranges, revenueOrders } = context;
  const todayOrders = recordsInRange(revenueOrders, ranges.todayStart, ranges.tomorrowStart);
  const yesterdayOrders = recordsInRange(revenueOrders, ranges.yesterdayStart, ranges.todayStart);
  const weekOrders = recordsInRange(revenueOrders, ranges.weekStart, ranges.nextWeekStart);
  const prevWeekOrders = recordsInRange(revenueOrders, ranges.prevWeekStart, ranges.weekStart);
  const monthOrders = recordsInRange(revenueOrders, ranges.monthStart, ranges.nextMonthStart);
  const prevMonthOrders = recordsInRange(revenueOrders, ranges.prevMonthStart, ranges.monthStart);

  const todayRevenue = sumRevenue(todayOrders);
  const yesterdayRevenue = sumRevenue(yesterdayOrders);
  const weekRevenue = sumRevenue(weekOrders);
  const prevWeekRevenue = sumRevenue(prevWeekOrders);
  const monthRevenue = sumRevenue(monthOrders);
  const prevMonthRevenue = sumRevenue(prevMonthOrders);
  const avgCheck = monthOrders.length ? monthRevenue / monthOrders.length : 0;
  const prevAvgCheck = prevMonthOrders.length ? prevMonthRevenue / prevMonthOrders.length : 0;

  setText(el.financeTodayRevenue, formatMoneyEUR(todayRevenue));
  setText(el.financeTodayChange, formatChange(calcPercentChange(todayRevenue, yesterdayRevenue)));
  setText(el.financeWeekRevenue, formatMoneyEUR(weekRevenue));
  setText(el.financeWeekChange, formatChange(calcPercentChange(weekRevenue, prevWeekRevenue)));
  setText(el.financeMonthRevenue, formatMoneyEUR(monthRevenue));
  setText(el.financeMonthChange, formatChange(calcPercentChange(monthRevenue, prevMonthRevenue)));
  setText(el.financeAvgCheck, formatMoneyEUR(avgCheck));
  setText(el.financeAvgCheckChange, formatChange(calcPercentChange(avgCheck, prevAvgCheck)));

  renderRevenueByCategory(monthOrders);
  renderCostKpis(context, monthOrders, monthRevenue);
  renderShiftChart(todayOrders);
}

function renderRevenueByCategory(periodOrders) {
  if (!el.financeCategoryRows) return;

  const byCategory = new Map();
  periodOrders.forEach((order) => {
    order.items.forEach((item) => {
      const revenue = itemRevenue(item);
      if (revenue <= 0) return;
      const category = displayCategory(item.category);
      byCategory.set(category, (byCategory.get(category) || 0) + revenue);
    });
  });

  const rows = Array.from(byCategory.entries())
    .map(([category, revenue]) => ({ category, revenue }))
    .sort((left, right) => right.revenue - left.revenue);
  const total = rows.reduce((sum, row) => sum + row.revenue, 0);

  el.financeCategoryRows.innerHTML = rows.length && total > 0
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.category)}</td>
          <td>${escapeHtml(formatMoneyEUR(row.revenue))}</td>
          <td>${escapeHtml(formatPercent((row.revenue / total) * 100))}</td>
        </tr>
      `).join("")
    : emptyRow(3);
}

function renderCostKpis(context, monthOrders, monthRevenue) {
  const foodCost = computeFoodCost(monthOrders);
  const laborCost = computeLaborCost(context, context.ranges.monthStart, context.ranges.nextMonthStart);

  if (foodCost.available && monthRevenue > 0) {
    const pct = (foodCost.cost / monthRevenue) * 100;
    setText(el.financeFoodCost, formatPercent(pct));
    setProgress(el.financeFoodCostBar, pct);
  } else {
    setText(el.financeFoodCost, "—");
    setProgress(el.financeFoodCostBar, 0);
  }

  if (laborCost.available && monthRevenue > 0) {
    const pct = (laborCost.cost / monthRevenue) * 100;
    setText(el.financeLaborCost, formatPercent(pct));
    setProgress(el.financeLaborCostBar, pct);
  } else {
    setText(el.financeLaborCost, "—");
    setProgress(el.financeLaborCostBar, 0);
  }

  if (foodCost.available && monthRevenue > 0) {
    const marginBase = laborCost.available ? monthRevenue - foodCost.cost - laborCost.cost : monthRevenue - foodCost.cost;
    const marginPct = (marginBase / monthRevenue) * 100;
    setText(el.financeGrossMargin, formatPercent(marginPct));
    setProgress(el.financeGrossMarginBar, marginPct);
  } else {
    setText(el.financeGrossMargin, "—");
    setProgress(el.financeGrossMarginBar, 0);
  }
}

function renderShiftChart(todayOrders) {
  const shifts = { morning: 0, lunch: 0, evening: 0 };

  todayOrders.forEach((order) => {
    const date = toDateSafe(order.timestamp);
    if (!date) return;

    const hour = date.getHours();
    if (hour >= 6 && hour < 12) shifts.morning += Number(order.total) || 0;
    else if (hour >= 12 && hour < 18) shifts.lunch += Number(order.total) || 0;
    else if (hour >= 18 && hour < 24) shifts.evening += Number(order.total) || 0;
  });

  const max = Math.max(shifts.morning, shifts.lunch, shifts.evening, 0);
  setShift(el.financeShiftMorningValue, el.financeShiftMorningBar, shifts.morning, max);
  setShift(el.financeShiftLunchValue, el.financeShiftLunchBar, shifts.lunch, max);
  setShift(el.financeShiftEveningValue, el.financeShiftEveningBar, shifts.evening, max);
}

function renderStaff(context) {
  const { employees, ranges, revenueOrders } = context;
  const total = employees.length;
  const active = employees.filter(isActiveEmployee).length;
  const todayHours = totalWorkedHoursForDay(context, ranges.todayStart);
  const yesterdayHours = totalWorkedHoursForDay(context, ranges.yesterdayStart);
  const todayRevenue = sumRevenue(recordsInRange(revenueOrders, ranges.todayStart, ranges.tomorrowStart));
  const yesterdayRevenue = sumRevenue(recordsInRange(revenueOrders, ranges.yesterdayStart, ranges.todayStart));
  const productivity = todayHours > 0 ? todayRevenue / todayHours : null;
  const yesterdayProductivity = yesterdayHours > 0 ? yesterdayRevenue / yesterdayHours : null;
  const bonusesPaid = computePaidBonuses(context, ranges.weekStart, ranges.nextWeekStart);

  setText(el.kpiActiveStaff, String(active));
  setText(el.kpiTotalStaff, `от ${total} общо`);
  setText(el.kpiWorkedHoursToday, formatHours(todayHours));
  setText(el.kpiWorkedHoursTodayChange, formatChange(calcPercentChange(todayHours, yesterdayHours)));
  setText(el.kpiAvgProductivity, productivity == null ? "—" : `${formatMoneyEUR(productivity)}/ч`);
  setText(el.kpiAvgProductivityChange, productivity == null ? "—" : formatChange(calcPercentChange(productivity, yesterdayProductivity)));
  setText(el.kpiPaidBonuses, formatMoneyEUR(bonusesPaid));
  setText(el.kpiPaidBonusesSub, "тази седмица");
}

function renderWaiterSales(context) {
  if (!el.tblWaiterSales) return;

  const { employees, ranges, revenueOrders } = context;
  const monthOrders = recordsInRange(revenueOrders, ranges.monthStart, ranges.nextMonthStart);
  const employeeById = buildEmployeeIndex(employees);
  const rowsByWaiter = new Map();

  employees
    .filter((employee) => normalizeRole(employee.role || employee.position || employee.jobTitle) === "waiter")
    .forEach((employee) => {
      const id = employeeKey(employee);
      if (!id) return;
      rowsByWaiter.set(id, {
        id,
        name: getEmployeeDisplayName(employee),
        revenue: 0,
        tables: new Set(),
        status: employee.status || "—",
      });
    });

  monthOrders.forEach((order) => {
    const id = order.waiterId || "";
    if (!id) return;

    const employee = employeeById.get(id) || null;
    const current = rowsByWaiter.get(id) || {
      id,
      name: waiterDisplayName(order, employee, id),
      revenue: 0,
      tables: new Set(),
      status: employee?.status || "—",
    };

    current.name = waiterDisplayName(order, employee, id) || current.name || id;
    current.revenue += Number(order.total) || 0;
    const table = order.tableNumber || order.tableId || "";
    if (table) current.tables.add(table);
    current.status = employee?.status || current.status || "—";
    rowsByWaiter.set(id, current);
  });

  const rows = Array.from(rowsByWaiter.values())
    .sort((left, right) => right.revenue - left.revenue || left.name.localeCompare(right.name, "bg"));

  el.tblWaiterSales.innerHTML = rows.length
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.name)}</td>
          <td>${escapeHtml(formatMoneyEUR(row.revenue))}</td>
          <td>${row.tables.size}</td>
          <td>${statusBadge(row.status)}</td>
        </tr>
      `).join("")
    : emptyRow(4);
}

function renderCookPerformance(context) {
  if (!el.tblCookPerformance) return;

  const cooks = context.employees
    .filter((employee) => {
      const role = normalizeRole(employee.role || employee.position || employee.jobTitle);
      return role === "cook" || role === "kitchen";
    })
    .sort((left, right) => getEmployeeDisplayName(left).localeCompare(getEmployeeDisplayName(right), "bg"));

  if (!cooks.length) {
    el.tblCookPerformance.innerHTML = emptyRow(4);
    return;
  }

  const historyByCook = new Map();
  context.kitchenHistory.forEach((record) => {
    const id = cookId(record);
    if (!id) return;
    if (!historyByCook.has(id)) historyByCook.set(id, []);
    historyByCook.get(id).push(record);
  });

  el.tblCookPerformance.innerHTML = cooks.map((cook) => {
    const ids = employeeIds(cook);
    const records = ids.flatMap((id) => historyByCook.get(id) || []);
    const metrics = computeCookMetrics(records);

    return `
      <tr>
        <td>${escapeHtml(getEmployeeDisplayName(cook))}</td>
        <td>${escapeHtml(metrics.avgLabel)}</td>
        <td>${escapeHtml(metrics.errorsLabel)}</td>
        <td>${metrics.badge}</td>
      </tr>
    `;
  }).join("");
}

function renderAttendance(context) {
  if (!el.tblAttendance) return;

  const rows = context.employees
    .slice()
    .sort((left, right) => getEmployeeDisplayName(left).localeCompare(getEmployeeDisplayName(right), "bg"));

  el.tblAttendance.innerHTML = rows.length
    ? rows.map((employee) => {
      const info = getEmployeeWorkInfoForDay(context, employee, context.ranges.todayStart);
      return `
        <tr>
          <td>${escapeHtml(getEmployeeDisplayName(employee))}</td>
          <td>${escapeHtml(roleLabel(normalizeRole(employee.role || employee.position || employee.jobTitle)))}</td>
          <td>${escapeHtml(formatTime(info.start))}</td>
          <td>${escapeHtml(formatTime(info.end))}</td>
          <td>${escapeHtml(formatHours(info.hours))}</td>
          <td>${attendanceBadge(info.status || employee.status)}</td>
        </tr>
      `;
    }).join("")
    : emptyRow(6);
}

function renderRoleCounts(context) {
  const counts = {
    waiter: 0,
    cook: 0,
    kitchen: 0,
    bar: 0,
    manager: 0,
    owner: 0,
  };

  context.employees.forEach((employee) => {
    const role = normalizeRole(employee.role || employee.position || employee.jobTitle);
    if (role in counts) counts[role] += 1;
  });

  setText(el.roleCountWaiter, String(counts.waiter));
  setText(el.roleCountCook, String(counts.cook + counts.kitchen));
  setText(el.roleCountBar, String(counts.bar));
  setText(el.roleCountManager, String(counts.manager));
  setText(el.roleCountOwner, String(counts.owner));
}

function renderAnalytics(context) {
  const monthOrders = recordsInRange(context.revenueOrders, context.ranges.monthStart, context.ranges.nextMonthStart);
  const hourCounts = new Map();
  const dayCounts = new Map();

  monthOrders.forEach((order) => {
    const date = toDateSafe(order.timestamp);
    if (!date) return;
    const hour = date.getHours();
    const hourLabel = `${String(hour).padStart(2, "0")}:00-${String((hour + 1) % 24).padStart(2, "0")}:00`;
    hourCounts.set(hourLabel, (hourCounts.get(hourLabel) || 0) + 1);
    dayCounts.set(DAY_LABELS_BG[date.getDay()], (dayCounts.get(DAY_LABELS_BG[date.getDay()]) || 0) + 1);
  });

  const topHour = topCountEntry(hourCounts);
  const topDay = topCountEntry(dayCounts);
  const rating = averageRating(monthOrders);

  setText(el.analyticsPeakHour, topHour ? topHour[0] : "—");
  setText(el.analyticsPeakHourSub, topHour ? `${topHour[1]} поръчки този месец` : "Няма данни.");
  setText(el.analyticsBusiestDay, topDay ? topDay[0] : "—");
  setText(el.analyticsBusiestDaySub, topDay ? `${topDay[1]} поръчки този месец` : "Няма данни.");
  setText(el.analyticsAvgRating, rating == null ? "—" : rating.toLocaleString("bg-BG", { maximumFractionDigits: 1 }));
  setText(el.analyticsAvgRatingSub, rating == null ? "Няма reviews данни." : "средно от реални оценки");
}

function computeFoodCost(periodOrders) {
  let cost = 0;
  let soldLines = 0;
  let costLines = 0;

  periodOrders.forEach((order) => {
    order.items.forEach((item) => {
      const revenue = itemRevenue(item);
      if (revenue <= 0) return;
      soldLines += 1;

      const unitCost = numberOrNull(item.cost);
      if (unitCost == null) return;
      costLines += 1;
      cost += unitCost * (Number(item.qty) || 1);
    });
  });

  return {
    available: soldLines > 0 && costLines === soldLines,
    cost,
  };
}

function computeLaborCost(context, start, end) {
  let cost = 0;
  let employeesWithHours = 0;
  let employeesWithRate = 0;

  context.employees.forEach((employee) => {
    const hours = getEmployeeHoursForPeriod(context, employee, start, end);
    if (hours == null || hours <= 0) return;
    employeesWithHours += 1;

    const rate = hourlyRate(employee);
    if (rate == null) return;
    employeesWithRate += 1;
    cost += rate * hours;
  });

  return {
    available: employeesWithHours > 0 && employeesWithHours === employeesWithRate,
    cost,
  };
}

function totalWorkedHoursForDay(context, dayStart) {
  return context.employees.reduce((sum, employee) => {
    const info = getEmployeeWorkInfoForDay(context, employee, dayStart);
    return sum + (Number.isFinite(info.hours) ? info.hours : 0);
  }, 0);
}

function getEmployeeWorkInfoForDay(context, employee, dayStart) {
  const dayEnd = addDays(dayStart, 1);
  const entries = collectWorkEntries(context, employee)
    .filter((entry) => entryTouchesRange(entry, dayStart, dayEnd))
    .sort((left, right) => toMillis(entryDate(left, dayStart)) - toMillis(entryDate(right, dayStart)));
  const source = entries[0] || directWorkInfo(employee, dayStart) || {};

  const start = toDateForDay(source.checkIn ?? source.clockIn ?? source.shiftStart ?? source.start ?? source.startedAt, dayStart);
  const end = toDateForDay(source.checkOut ?? source.clockOut ?? source.shiftEnd ?? source.end ?? source.endedAt, dayStart);
  let hours = hoursFromEntry(source, dayStart);

  if (hours == null && start && end && end > start) {
    hours = (end.getTime() - start.getTime()) / 3600000;
  }

  const status = source.attendanceStatus || source.status || employee.status || (start ? "present" : "—");
  return { start, end, hours, status };
}

function getEmployeeHoursForPeriod(context, employee, start, end) {
  let total = 0;
  let hasHours = false;

  collectWorkEntries(context, employee).forEach((entry) => {
    if (!entryTouchesRange(entry, start, end)) return;
    const hours = hoursFromEntry(entry, start);
    if (hours == null) return;
    total += hours;
    hasHours = true;
  });

  if (hasHours) return total;

  const isSingleDay = end.getTime() - start.getTime() <= 86400000;
  if (isSingleDay) {
    const dayInfo = getEmployeeWorkInfoForDay(context, employee, start);
    if (dayInfo.hours != null) return dayInfo.hours;
  }

  if (start.getDate() === 1) {
    const monthly = firstNumber(
      employee.workedHoursThisMonth,
      employee.hoursWorkedThisMonth,
      employee.monthlyHours,
      employee.shiftHoursThisMonth
    );
    if (monthly != null) return monthly;
  }

  return null;
}

function collectWorkEntries(context, employee) {
  const ids = new Set(employeeIds(employee));
  const rows = [];

  [employee.attendance, employee.shifts, employee.timeEntries, employee.workLogs].forEach((source) => {
    if (Array.isArray(source)) rows.push(...source);
    else if (source && typeof source === "object") rows.push(...Object.values(source));
  });

  [...context.attendance, ...context.shifts].forEach((entry) => {
    if (entryBelongsToEmployee(entry, ids)) rows.push(entry);
  });

  return dedupeRows(rows);
}

function directWorkInfo(employee, dayStart) {
  const hasDirect = [
    "workedHoursToday",
    "hoursToday",
    "hoursWorkedToday",
    "todayHours",
    "checkIn",
    "checkOut",
    "clockIn",
    "clockOut",
    "shiftStart",
    "shiftEnd",
  ].some((field) => employee?.[field] != null && employee?.[field] !== "");

  if (!hasDirect) return null;

  const dateValue = toDateSafe(
    employee.attendanceDate ||
    employee.workDate ||
    employee.shiftDate ||
    employee.lastCheckInDate ||
    employee.checkIn ||
    employee.shiftStart
  );

  if (dateValue && !isSameDay(dateValue, dayStart)) return null;
  if (!dateValue && !isSameDay(dayStart, new Date())) return null;
  return employee;
}

function entryTouchesRange(entry, start, end) {
  const date = toDateSafe(entry.date || entry.day || entry.workDate || entry.shiftDate || entry.createdAt);
  if (date) {
    const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    return day.getTime() >= start.getTime() && day.getTime() < end.getTime();
  }

  const checkIn = entryDate(entry, start);
  if (checkIn) return checkIn.getTime() >= start.getTime() && checkIn.getTime() < end.getTime();
  return false;
}

function entryDate(entry, dayStart) {
  return toDateForDay(entry.checkIn || entry.clockIn || entry.shiftStart || entry.start || entry.startedAt || entry.createdAt, dayStart);
}

function hoursFromEntry(entry, dayStart) {
  const direct = firstNumber(
    entry.workedHoursToday,
    entry.hoursToday,
    entry.workedHours,
    entry.hoursWorked,
    entry.shiftHours,
    entry.hours,
    entry.durationHours
  );
  if (direct != null) return direct;

  const minutes = firstNumber(entry.durationMinutes, entry.minutesWorked, entry.workedMinutes);
  if (minutes != null) return minutes / 60;

  const seconds = firstNumber(entry.durationSec, entry.durationSeconds, entry.secondsWorked);
  if (seconds != null) return seconds / 3600;

  const start = toDateForDay(entry.checkIn ?? entry.clockIn ?? entry.shiftStart ?? entry.start ?? entry.startedAt, dayStart);
  const end = toDateForDay(entry.checkOut ?? entry.clockOut ?? entry.shiftEnd ?? entry.end ?? entry.endedAt, dayStart);
  if (start && end && end > start) return (end.getTime() - start.getTime()) / 3600000;
  return null;
}

function computePaidBonuses(context, start, end) {
  const rows = [];

  context.bonuses.forEach((bonus) => {
    if (!isPaidBonus(bonus)) return;
    if (!recordTouchesRange(bonus, start, end)) return;
    rows.push(firstNumber(bonus.amount, bonus.bonus, bonus.total, bonus.value, bonus.paidAmount) || 0);
  });

  context.payments.forEach((payment) => {
    if (!paymentLooksBonus(payment) || !isPaidBonus(payment)) return;
    if (!recordTouchesRange(payment, start, end)) return;
    rows.push(firstNumber(payment.amount, payment.bonus, payment.total, payment.value, payment.paidAmount) || 0);
  });

  context.employees.forEach((employee) => {
    const direct = firstNumber(employee.paidBonusThisWeek, employee.bonusPaidThisWeek, employee.weeklyPaidBonus);
    if (direct != null) rows.push(direct);
  });

  return rows.reduce((sum, value) => sum + value, 0);
}

function computeCookMetrics(records) {
  let totalDurationSec = 0;
  let totalItems = 0;
  let errors = 0;
  let hasErrorField = false;

  records.forEach((record) => {
    const duration = durationFromRecord(record);
    const itemCount = itemCountFromRecord(record);
    if (duration != null && duration > 0 && itemCount > 0) {
      totalDurationSec += duration;
      totalItems += itemCount;
    }

    const recordErrors = firstNumber(record.errors, record.mistakes, record.rejects, record.rejectedItems, record.voids);
    if (recordErrors != null) {
      errors += recordErrors;
      hasErrorField = true;
    }
  });

  if (!totalItems) {
    return {
      avgLabel: "—",
      errorsLabel: hasErrorField ? String(errors) : "—",
      badge: `<span class="status-badge status-info">—</span>`,
    };
  }

  const avgSec = totalDurationSec / totalItems;
  const avgMin = avgSec / 60;
  let label = "Среден";
  let klass = "status-warning";
  if (avgMin <= 12) {
    label = "Отличен";
    klass = "status-success";
  } else if (avgMin <= 18) {
    label = "Добър";
    klass = "status-info";
  }

  return {
    avgLabel: formatMinutes(avgSec),
    errorsLabel: hasErrorField ? String(errors) : "—",
    badge: `<span class="status-badge ${klass}">${label}</span>`,
  };
}

function itemCountFromRecord(record) {
  const direct = firstNumber(record.itemCount, record.activeItemCount, record.count, record.totalQty, record.quantity);
  if (direct != null && direct > 0) return direct;
  return normalizeOrderItems(record).reduce((sum, item) => sum + (Number(item.qty) || 0), 0);
}

function durationFromRecord(record) {
  const direct = firstNumber(record.durationSec, record.durationSeconds, record.kitchenDurationSec, record.prepDurationSec);
  if (direct != null) return direct;

  const start = toMillis(record.kitchenStartedAt || record.startedAt || record.startAt || record.createdAt);
  const end = toMillis(record.kitchenDoneAt || record.doneAt || record.completedAt || record.servedAt || record.closedAt);
  if (start > 0 && end > start) return (end - start) / 1000;
  return null;
}

function averageRating(orders) {
  const ratings = [];
  orders.forEach((order) => {
    const raw = order.raw || order;
    const rating = firstNumber(raw.rating, raw.reviewRating, raw.customerRating, raw.feedback?.rating, raw.order?.rating);
    if (rating != null) ratings.push(rating);
  });
  return ratings.length ? ratings.reduce((sum, value) => sum + value, 0) / ratings.length : null;
}

function paymentLooksBonus(record) {
  const text = [
    record.type,
    record.category,
    record.reason,
    record.description,
    record.kind,
  ].join(" ").toLowerCase();
  return text.includes("bonus") || text.includes("бонус");
}

function recordTouchesRange(record, start, end) {
  const date = toDateSafe(record.paidAt || record.closedAt || record.completedAt || record.createdAt || record.timestamp || record.date);
  return date ? date.getTime() >= start.getTime() && date.getTime() < end.getTime() : false;
}

function cookId(record) {
  return String(
    record?.cookId ||
    record?.chefId ||
    record?.kitchenId ||
    record?.employeeId ||
    record?.staffId ||
    record?.preparedBy ||
    record?.completedBy ||
    record?.userId ||
    ""
  ).trim();
}

function hourlyRate(employee) {
  return firstNumber(employee.hourlyRate, employee.hourlyWage, employee.rate, employee.wage, employee.salaryPerHour);
}

function buildEmployeeIndex(employees) {
  const index = new Map();
  employees.forEach((employee) => {
    employeeIds(employee).forEach((id) => index.set(id, employee));
  });
  return index;
}

function employeeKey(employee) {
  return employeeIds(employee)[0] || "";
}

function employeeIds(employee) {
  return [
    employee?.id,
    employee?.uid,
    employee?.userId,
    employee?.employeeId,
    employee?.staffId,
    employee?.authUid,
    employee?.email,
  ].map((value) => String(value || "").trim()).filter(Boolean);
}

function entryBelongsToEmployee(entry, ids) {
  return [
    entry.employeeId,
    entry.staffId,
    entry.userId,
    entry.uid,
    entry.employeeUID,
    entry.workerId,
    entry.createdBy,
  ].some((value) => ids.has(String(value || "").trim()));
}

function dedupeRows(rows) {
  const seen = new Set();
  return rows.filter((row, index) => {
    if (!row || typeof row !== "object") return false;
    const key = row.id || row.path || `${row.employeeId || row.staffId || ""}|${row.date || row.createdAt || ""}|${index}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function waiterDisplayName(order, employee, id) {
  if (order.waiterName) return order.waiterName;
  if (employee) return getEmployeeDisplayName(employee);
  return id || "—";
}

function itemRevenue(item) {
  const total = numberOrNull(item.total);
  if (total != null) return total;
  return (Number(item.qty) || 0) * (Number(item.price) || 0);
}

function displayCategory(value) {
  const key = String(value || "").trim().toLowerCase();
  const labels = {
    food: "Храна",
    foods: "Храна",
    kitchen: "Храна",
    drinks: "Напитки",
    drink: "Напитки",
    beverage: "Напитки",
    beverages: "Напитки",
    dessert: "Десерти",
    desserts: "Десерти",
    десерт: "Десерти",
    десерти: "Десерти",
    напитка: "Напитки",
    напитки: "Напитки",
    храна: "Храна",
  };
  return labels[key] || String(value || "Без категория").trim();
}

function topCountEntry(map) {
  const rows = Array.from(map.entries());
  rows.sort((left, right) => right[1] - left[1] || String(left[0]).localeCompare(String(right[0]), "bg"));
  return rows[0] || null;
}

function statusBadge(status) {
  const key = String(status || "").trim().toLowerCase();
  if (["active", "активен", "online", "enabled"].includes(key)) {
    return `<span class="status-badge status-success">Активен</span>`;
  }
  if (["pending", "waiting", "чака", "чакане"].includes(key)) {
    return `<span class="status-badge status-warning">Чака</span>`;
  }
  if (!key || key === "—") return `<span class="status-badge status-info">—</span>`;
  return `<span class="status-badge status-info">${escapeHtml(status)}</span>`;
}

function attendanceBadge(status) {
  const key = String(status || "").trim().toLowerCase();
  if (["present", "checked_in", "working", "active", "присъства"].includes(key)) {
    return `<span class="status-badge status-success">Присъства</span>`;
  }
  if (["late", "закъснение"].includes(key)) {
    return `<span class="status-badge status-warning">Закъснение</span>`;
  }
  if (["inactive", "absent", "почивка"].includes(key)) {
    return `<span class="status-badge status-info">Почивка</span>`;
  }
  return `<span class="status-badge status-info">${escapeHtml(status || "—")}</span>`;
}

function ensureLogsToggleBtn() {
  if (el.logsToggleBtn) return el.logsToggleBtn;
  if (!el.tblSystemLogs) return null;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.id = "logsToggleBtn";
  btn.className = "btn btn-secondary";
  btn.hidden = true;
  btn.textContent = "Виж всички";

  const table = el.tblSystemLogs.closest("table");
  if (table) table.insertAdjacentElement("afterend", btn);
  else el.tblSystemLogs.parentElement?.appendChild(btn);

  el.logsToggleBtn = btn;
  return btn;
}

function setLogsToggleButton() {
  const btn = ensureLogsToggleBtn();
  if (!btn) return;

  const shouldShow = logsMode === "all" || latestLogsHasMore;
  btn.hidden = !shouldShow;
  if (!shouldShow) return;
  btn.textContent = logsMode === "all" ? "Скрий" : "Виж всички";
}

async function refreshLatestLogsHasMore() {
  try {
    const snap = await getDocs(query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(4)));
    latestLogsHasMore = snap.docs.length > 3;
  } catch (err) {
    latestLogsHasMore = false;
    console.error("logs count check:", err);
  }
  setLogsToggleButton();
}

function startLatestLogsListener() {
  if (systemLogsLoaded) return;
  systemLogsLoaded = true;

  onSnapshot(
    query(collection(db, "logs"), orderBy("createdAt", "desc"), limit(3)),
    (snap) => {
      latestLogs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
      cachedAllLogs = null;
      if (logsMode === "latest") renderLogs(latestLogs, "latest");
      refreshLatestLogsHasMore();
    },
    (err) => {
      console.error("logs listener:", err);
    }
  );
}

async function ensureAllLogsCached() {
  if (cachedAllLogs !== null) return;
  const snap = await getDocs(query(collection(db, "logs"), orderBy("createdAt", "desc")));
  cachedAllLogs = snap.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
}

function loadSystemLogs() {
  startLatestLogsListener();
  logsMode = "latest";
  renderLogs(latestLogs, "latest");
  setLogsToggleButton();
  refreshLatestLogsHasMore();
}

async function onLogsToggleClick() {
  try {
    if (logsMode === "latest") {
      await ensureAllLogsCached();
      logsMode = "all";
      renderLogs(cachedAllLogs ?? [], "all");
      setLogsToggleButton();
      return;
    }

    logsMode = "latest";
    renderLogs(latestLogs, "latest");
    setLogsToggleButton();
  } catch (err) {
    console.error("logs toggle:", err);
  }
}

function renderLogs(logRows, mode = "latest") {
  if (!el.tblSystemLogs) return;

  const sorted = [...(logRows ?? [])].sort((left, right) => toMillis(right.createdAt) - toMillis(left.createdAt));
  const rows = mode === "latest" ? sorted.slice(0, 3) : sorted;

  el.tblSystemLogs.innerHTML = rows.length
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(formatDateTime(row.createdAt))}</td>
          <td>${escapeHtml(row.userName ?? row.actorEmail ?? row.actorUid ?? "System")}</td>
          <td>${escapeHtml(row.action ?? row.type ?? "—")}</td>
          <td>${escapeHtml(row.details ?? row.message ?? "—")}</td>
        </tr>
      `).join("")
    : emptyRow(4);
}

function setShift(valueEl, barEl, value, max) {
  setText(valueEl, formatMoneyEUR(value));
  if (!barEl) return;
  const pct = max > 0 ? Math.max(4, (value / max) * 100) : 0;
  barEl.style.height = `${Math.min(100, pct).toFixed(0)}%`;
}

function setProgress(node, value) {
  if (!node) return;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  node.style.width = `${pct.toFixed(1)}%`;
}

function formatChange(value) {
  if (value == null) return "—";
  const arrow = value >= 0 ? "↑" : "↓";
  return `${arrow} ${Math.abs(value).toLocaleString("bg-BG", { maximumFractionDigits: 1 })}%`;
}

function formatDateTime(value) {
  const date = toDateSafe(value);
  if (!date) return "—";
  return date.toLocaleString("bg-BG");
}

function toDateForDay(value, dayStart) {
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (match) {
      return new Date(
        dayStart.getFullYear(),
        dayStart.getMonth(),
        dayStart.getDate(),
        Number(match[1]),
        Number(match[2]),
        Number(match[3] || 0)
      );
    }
  }
  return toDateSafe(value);
}

function isSameDay(left, right) {
  const a = toDateSafe(left);
  const b = toDateSafe(right);
  if (!a || !b) return false;
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function addDays(date, days) {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  next.setDate(next.getDate() + days);
  return next;
}

function emptyRow(colspan) {
  return `<tr><td colspan="${colspan}" style="opacity:.7;padding:10px;">Няма данни.</td></tr>`;
}

function setText(node, value) {
  if (node) node.textContent = String(value ?? "—");
}

function byId(...ids) {
  const found = byIdOptional(...ids);
  if (!found) warnMissing(ids);
  return found;
}

function byIdOptional(...ids) {
  for (const id of ids) {
    const node = document.getElementById(id);
    if (node) return node;
  }
  return null;
}

function warnMissing(ids) {
  const key = ids.join(" / ");
  if (missingElements.has(key)) return;
  missingElements.add(key);
  console.warn(`[ManagerStats] missing DOM element: ${key}`);
}
