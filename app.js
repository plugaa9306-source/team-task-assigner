import "./components/task-select/task-select.js";
import "./components/team-builder/team-builder.js";
import "./components/whatsapp-share/whatsapp-share.js";

const load = (name) =>
  fetch(`data/${name}.json`).then((r) => {
    if (!r.ok) throw new Error(`${name}.json (${r.status})`);
    return r.json();
  });

async function init() {
  await customElements.whenDefined("whatsapp-share");

  const taskSelect = document.querySelector("task-select");
  const teamBuilder = document.querySelector("team-builder");
  const share = document.querySelector("whatsapp-share");

  try {
    const [people, tasks, roles, template] = await Promise.all(
      ["people", "tasks", "roles", "template"].map(load)
    );
    taskSelect.tasks = tasks;
    teamBuilder.setData({ people, roles });
    share.template = template;
  } catch (err) {
    const box = document.getElementById("app-error");
    box.textContent = `שגיאה בטעינת הנתונים: ${err.message}. יש להריץ את האתר משרת (ולא לפתוח את הקובץ ישירות).`;
    box.hidden = false;
    return;
  }

  teamBuilder.locked = !taskSelect.value;

  taskSelect.addEventListener("task-change", (e) => {
    teamBuilder.locked = !e.detail.task;
    share.update({ task: e.detail.task });
  });
  teamBuilder.addEventListener("team-change", (e) =>
    share.update({ members: e.detail.members, allComplete: e.detail.allComplete }));
  share.update({ task: taskSelect.value, members: teamBuilder.members, allComplete: teamBuilder.allComplete });
}

init();
