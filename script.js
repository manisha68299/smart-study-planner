// --- Data helpers ---

function getTasks() {
    return JSON.parse(localStorage.getItem('tasks')) || [];
}
function saveTasks(tasks) {
    localStorage.setItem('tasks', JSON.stringify(tasks));
}

// --- Dark mode ---

const darkModeToggle = document.getElementById('darkModeToggle');
darkModeToggle.onclick = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('darkMode', document.body.classList.contains('dark'));
};
if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark');
}

// --- Task form and filter controls ---

const form = document.getElementById('taskForm');
const categoryInput = document.getElementById('category');
const priorityInput = document.getElementById('priority');
const filterCategory = document.getElementById('filterCategory');
const filterPriority = document.getElementById('filterPriority');
const searchInput = document.getElementById('searchInput');

form.addEventListener('submit', function(e) {
    e.preventDefault();
    const name = document.getElementById('taskName').value.trim();
    const dueDate = document.getElementById('dueDate').value;
    const reminderTime = document.getElementById('reminderTime').value;
    const category = categoryInput.value.trim();
    const priority = priorityInput.value;
    if (!name || !dueDate) return;
    const tasks = getTasks();
    tasks.push({
        name,
        dueDate,
        reminderTime,
        category,
        priority,
        completed: false,
        createdAt: new Date().toISOString(),
        completedAt: null,
    });
    saveTasks(tasks);
    renderTasks();
    form.reset();
    updateCategoryFilter();
});

// --- Editing & deleting ---

function startEditTask(idx) {
    const tasks = getTasks();
    const t = tasks[idx];
    document.getElementById('taskName').value = t.name;
    document.getElementById('dueDate').value = t.dueDate;
    document.getElementById('reminderTime').value = t.reminderTime || "";
    categoryInput.value = t.category || "";
    priorityInput.value = t.priority || "Low";
    // Remove & readd after editing
    tasks.splice(idx, 1);
    saveTasks(tasks);
    renderTasks();
    form.scrollIntoView({behavior: "smooth"});
}

function toggleComplete(idx) {
    const tasks = getTasks();
    tasks[idx].completed = !tasks[idx].completed;
    tasks[idx].completedAt = tasks[idx].completed ? new Date().toISOString() : null;
    saveTasks(tasks);
    renderTasks();
}

function deleteTask(idx) {
    const tasks = getTasks();
    tasks.splice(idx, 1);
    saveTasks(tasks);
    renderTasks();
}

// --- Task filtering, search, category/priorities ---

function updateCategoryFilter() {
    const tasks = getTasks();
    const categories = [...new Set(tasks.map(t => t.category).filter(Boolean))];
    filterCategory.innerHTML = '<option value="">All Categories</option>';
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        filterCategory.appendChild(opt);
    });
}

let currentFilter = {category: '', priority: '', search: ''};

filterCategory.onchange = () => {
    currentFilter.category = filterCategory.value;
    renderTasks();
};
filterPriority.onchange = () => {
    currentFilter.priority = filterPriority.value;
    renderTasks();
};
searchInput.oninput = () => {
    currentFilter.search = searchInput.value.trim().toLowerCase();
    renderTasks();
};

// --- Rendering ---

function renderTasks() {
    const tasks = getTasks();
    let filtered = tasks.filter(t => {
        const cat = currentFilter.category;
        const pri = currentFilter.priority;
        const search = currentFilter.search;
        let match = true;
        if (cat && t.category !== cat) match = false;
        if (pri && t.priority !== pri) match = false;
        if (search && !t.name.toLowerCase().includes(search)) match = false;
        return match;
    });

    // Sort: High > Medium > Low, then incomplete before completed, then due date
    filtered.sort((a, b) => {
        const priOrder = {High: 1, Medium: 2, Low: 3};
        if (a.completed !== b.completed) return a.completed ? 1 : -1;
        if (priOrder[a.priority] !== priOrder[b.priority]) return priOrder[a.priority] - priOrder[b.priority];
        return new Date(a.dueDate) - new Date(b.dueDate);
    });

    const taskList = document.getElementById('taskList');
    taskList.innerHTML = '';
    let completedCount = 0;

    filtered.forEach((task, idx) => {
        const realIdx = tasks.indexOf(task);
        const li = document.createElement('li');
        li.className = (task.completed ? 'completed ' : '') + 'priority-' + task.priority;
        li.innerHTML = `
            <div class="info">
                <strong>${task.name}</strong>
                <span style="font-size:0.95em;">
                    ${task.category ? `[${task.category}] ` : ''}
                    (Due: ${task.dueDate}${task.reminderTime ? ' ⏰'+task.reminderTime : ''})
                    <span class="priority-label" title="Priority">${task.priority}</span>
                </span>
            </div>
            <div class="actions">
                <button onclick="toggleComplete(${realIdx})">${task.completed ? 'Undo' : 'Done'}</button>
                <button onclick="startEditTask(${realIdx})">Edit</button>
                <button onclick="deleteTask(${realIdx})">Delete</button>
            </div>
        `;
        if (task.completed) completedCount++;
        taskList.appendChild(li);
    });

    // Progress bar update
    const progress = tasks.length ? (tasks.filter(t=>t.completed).length / tasks.length) * 100 : 0;
    document.getElementById('progressBar').style.width = progress + '%';

    // Stats
    const completedToday = tasks.filter(t => t.completedAt && new Date(t.completedAt).toDateString() === new Date().toDateString()).length;
    const total = tasks.length;
    document.getElementById('completedStats').textContent = `Completed today: ${completedToday} / ${total}`;

    // Streaks: count max consecutive days with at least 1 completed
    document.getElementById('streakStats').textContent = `Productivity streak: ${getStreak(tasks)} days`;

    // Calendar
    renderCalendar(tasks);

    // Reminder notifications
    scheduleReminders(tasks);

    // Update filter options
    updateCategoryFilter();
}

// --- Productivity Streaks (consecutive days with at least 1 completion) ---

function getStreak(tasks) {
    const completedDays = new Set(tasks.filter(t=>t.completedAt).map(t=> (new Date(t.completedAt)).toDateString()));
    if (!completedDays.size) return 0;
    // Get sorted array of unique completion days
    const days = Array.from(completedDays).map(d=> new Date(d)).sort((a,b)=>a-b);
    // Now streak calculation
    let streak = 1, maxStreak = 1;
    for (let i=1; i<days.length; ++i) {
        const diff = (days[i] - days[i-1])/(1000*60*60*24);
        if (diff === 1) streak++;
        else streak = 1;
        if (streak > maxStreak) maxStreak = streak;
    }
    // Active streak: check if today is the last day
    const lastDay = days[days.length-1];
    const today = new Date();
    const diff = (today.setHours(0,0,0,0) - lastDay.setHours(0,0,0,0))/(1000*60*60*24);
    return diff===0 ? streak : 0;
}

// --- Calendar View ---

function renderCalendar(tasks) {
    const cal = document.getElementById('calendar');
    cal.innerHTML = "";
    const now = new Date();
    const year = now.getFullYear(), month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    // Map date string to number of tasks due
    const dueMap = {};
    tasks.forEach(t => {
        if (!dueMap[t.dueDate]) dueMap[t.dueDate] = 0;
        dueMap[t.dueDate]++;
    });
    // Blank days before 1st
    for (let i=0; i<firstDay; i++) {
        const div = document.createElement('div');
        div.className = 'calendar-day';
        cal.appendChild(div);
    }
    for (let d=1; d<=daysInMonth; d++) {
        const ds = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const div = document.createElement('div');
        div.className = 'calendar-day';
        if (ds === now.toISOString().slice(0,10)) div.classList.add('today');
        if (dueMap[ds]) {
            div.classList.add('has-task');
            div.title = `${dueMap[ds]} task(s) due`;
        }
        div.textContent = d;
        cal.appendChild(div);
    }
}

// --- Browser Notifications for Reminders ---

function scheduleReminders(tasks) {
    if (!("Notification" in window)) return;
    // Request permission if needed
    if (Notification.permission === "default") {
        Notification.requestPermission();
        return;
    }
    // Only schedule notifications for incomplete tasks due today with reminderTime, and not already notified
    const now = new Date();
    tasks.forEach((task, idx) => {
        if (!task.reminderTime || task.completed) return;
        const dueDate = new Date(task.dueDate + "T" + task.reminderTime);
        // If due today and in future
        if (dueDate > now && dueDate - now < 1000*60*60*24) {
            // Prevent duplicate notifications by keeping a notified flag in localStorage
            const notifiedKey = "notified-" + idx + "-" + task.dueDate + "-" + task.reminderTime;
            if (!localStorage.getItem(notifiedKey)) {
                setTimeout(() => {
                    if (Notification.permission === "granted") {
                        new Notification("Study Reminder", { 
                            body: `${task.name} (${task.category || "General"}) due at ${task.reminderTime}`
                        });
                        localStorage.setItem(notifiedKey, "yes");
                    }
                }, dueDate - now);
            }
        }
    });
}

// --- Initial load ---
renderTasks();
window.toggleComplete = toggleComplete;
window.deleteTask = deleteTask;
window.startEditTask = startEditTask;
