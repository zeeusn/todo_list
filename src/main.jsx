import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
  CalendarClock,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ListChecks,
  Plus,
  Search,
  Trash2,
  X
} from "lucide-react";
import "./styles.css";

const STORAGE_KEY = "todo-reminder-tool.tasks";

const initialTasks = [
  {
    id: crypto.randomUUID(),
    title: "整理本周任务清单",
    notes: "把工作、学习和生活事项分开排优先级。",
    dueAt: getDateTimeLocal(2),
    priority: "high",
    completed: false,
    reminded: false,
    createdAt: Date.now()
  },
  {
    id: crypto.randomUUID(),
    title: "喝水休息 5 分钟",
    notes: "离开屏幕活动一下。",
    dueAt: getDateTimeLocal(1),
    priority: "medium",
    completed: false,
    reminded: false,
    createdAt: Date.now()
  }
];

function getDateTimeLocal(hoursFromNow = 0) {
  const date = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function loadTasks() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : initialTasks;
  } catch {
    return initialTasks;
  }
}

function formatDueTime(value) {
  if (!value) return "未设置时间";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function getTaskState(task) {
  if (task.completed) return "done";
  if (!task.dueAt) return "open";
  const diff = new Date(task.dueAt).getTime() - Date.now();
  if (diff < 0) return "overdue";
  if (diff <= 60 * 60 * 1000) return "soon";
  return "open";
}

function App() {
  const [tasks, setTasks] = useState(loadTasks);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("active");
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState({
    title: "",
    notes: "",
    dueAt: getDateTimeLocal(3),
    priority: "medium"
  });
  const audioRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if (!("Notification" in window) || Notification.permission !== "default") return;
    Notification.requestPermission();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = Date.now();
      const dueTasks = tasks.filter((task) => {
        return !task.completed && !task.reminded && task.dueAt && new Date(task.dueAt).getTime() <= now;
      });

      if (!dueTasks.length) return;

      const task = dueTasks[0];
      setToast(`${task.title} 已到提醒时间`);
      playReminderTone(audioRef);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification("待办提醒", {
          body: task.title,
          tag: task.id
        });
      }

      setTasks((current) =>
        current.map((item) =>
          dueTasks.some((due) => due.id === item.id) ? { ...item, reminded: true } : item
        )
      );
    }, 15000);

    return () => window.clearInterval(timer);
  }, [tasks]);

  const stats = useMemo(() => {
    const active = tasks.filter((task) => !task.completed).length;
    const overdue = tasks.filter((task) => getTaskState(task) === "overdue").length;
    const done = tasks.length - active;
    return { active, overdue, done, total: tasks.length };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const matchesQuery = `${task.title} ${task.notes}`.toLowerCase().includes(query.toLowerCase());
        const state = getTaskState(task);
        if (!matchesQuery) return false;
        if (filter === "active") return !task.completed;
        if (filter === "done") return task.completed;
        if (filter === "overdue") return state === "overdue";
        return true;
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return Number(a.completed) - Number(b.completed);
        if (!a.dueAt) return 1;
        if (!b.dueAt) return -1;
        return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
      });
  }, [tasks, query, filter]);

  function handleSubmit(event) {
    event.preventDefault();
    const title = form.title.trim();
    if (!title) return;

    setTasks((current) => [
      {
        id: crypto.randomUUID(),
        ...form,
        title,
        notes: form.notes.trim(),
        completed: false,
        reminded: false,
        createdAt: Date.now()
      },
      ...current
    ]);

    setForm({
      title: "",
      notes: "",
      dueAt: getDateTimeLocal(3),
      priority: "medium"
    });
  }

  function toggleTask(id) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id ? { ...task, completed: !task.completed, reminded: task.completed ? false : task.reminded } : task
      )
    );
  }

  function removeTask(id) {
    setTasks((current) => current.filter((task) => task.id !== id));
  }

  function snoozeTask(id) {
    setTasks((current) =>
      current.map((task) =>
        task.id === id
          ? {
              ...task,
              dueAt: getDateTimeLocal(0.25),
              reminded: false,
              completed: false
            }
          : task
      )
    );
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <div className="brand">
            <ListChecks size={28} />
            <span>待办提醒</span>
          </div>
          <h1>今日待办提醒</h1>
        </div>
        <div className="summary-grid" aria-label="任务统计">
          <Stat label="进行中" value={stats.active} />
          <Stat label="已逾期" value={stats.overdue} accent="danger" />
          <Stat label="已完成" value={stats.done} />
        </div>
      </section>

      <section className="workspace">
        <form className="task-form" onSubmit={handleSubmit}>
          <div className="form-header">
            <CalendarClock size={22} />
            <h2>新增提醒</h2>
          </div>

          <label>
            <span>任务名称</span>
            <input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="例如：下午 4 点提交周报"
            />
          </label>

          <label>
            <span>备注</span>
            <textarea
              value={form.notes}
              onChange={(event) => setForm({ ...form, notes: event.target.value })}
              placeholder="补充地点、材料或完成标准"
            />
          </label>

          <div className="form-row">
            <label>
              <span>提醒时间</span>
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(event) => setForm({ ...form, dueAt: event.target.value })}
              />
            </label>
            <label>
              <span>优先级</span>
              <select
                value={form.priority}
                onChange={(event) => setForm({ ...form, priority: event.target.value })}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </label>
          </div>

          <button className="primary-button" type="submit">
            <Plus size={18} />
            <span>创建提醒</span>
          </button>
        </form>

        <section className="task-board">
          <div className="toolbar">
            <div className="searchbox">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索任务或备注"
              />
            </div>
            <div className="segments" aria-label="任务筛选">
              {[
                ["active", "未完成"],
                ["overdue", "逾期"],
                ["done", "完成"],
                ["all", "全部"]
              ].map(([value, label]) => (
                <button
                  key={value}
                  className={filter === value ? "active" : ""}
                  type="button"
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="task-list">
            {filteredTasks.length ? (
              filteredTasks.map((task) => (
                <TaskItem
                  key={task.id}
                  task={task}
                  onToggle={toggleTask}
                  onRemove={removeTask}
                  onSnooze={snoozeTask}
                />
              ))
            ) : (
              <div className="empty-state">
                <CheckCircle2 size={38} />
                <p>这里暂时没有匹配的任务</p>
              </div>
            )}
          </div>
        </section>
      </section>

      <audio ref={audioRef} />
      {toast && (
        <div className="toast" role="status">
          <Bell size={18} />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="关闭提醒">
            <X size={16} />
          </button>
        </div>
      )}
    </main>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div className={`stat ${accent || ""}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function TaskItem({ task, onToggle, onRemove, onSnooze }) {
  const state = getTaskState(task);
  const priorityLabel = {
    high: "高优先级",
    medium: "中优先级",
    low: "低优先级"
  }[task.priority];

  return (
    <article className={`task-item ${state} priority-${task.priority}`}>
      <button className="check-button" type="button" onClick={() => onToggle(task.id)} aria-label="切换完成状态">
        {task.completed ? <Check size={20} /> : <Circle size={20} />}
      </button>

      <div className="task-content">
        <div className="task-title-row">
          <h3>{task.title}</h3>
          <span className="priority-pill">{priorityLabel}</span>
        </div>
        {task.notes && <p>{task.notes}</p>}
        <div className="task-meta">
          <span>
            <Clock3 size={15} />
            {formatDueTime(task.dueAt)}
          </span>
          <span className={`state-label ${state}`}>{stateText(state)}</span>
        </div>
      </div>

      <div className="task-actions">
        <button type="button" onClick={() => onSnooze(task.id)} title="稍后提醒">
          <Bell size={18} />
        </button>
        <button type="button" onClick={() => onRemove(task.id)} title="删除">
          <Trash2 size={18} />
        </button>
      </div>
    </article>
  );
}

function stateText(state) {
  return {
    done: "已完成",
    overdue: "已逾期",
    soon: "即将到期",
    open: "待处理"
  }[state];
}

function playReminderTone(audioRef) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(740, context.currentTime);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.6);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.65);
  audioRef.current?.load();
}

createRoot(document.getElementById("root")).render(<App />);
