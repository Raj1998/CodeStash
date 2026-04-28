function loadTodos() {
  const todos = localStorage.getItem('todos');
  return todos ? JSON.parse(todos) : [];
}

function saveTodos(todos) {
  localStorage.setItem('todos', JSON.stringify(todos));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderTodos(todos) {
  const todoList = document.getElementById('todo-list');
  const emptyState = document.getElementById('empty-state');

  todoList.innerHTML = '';

  if (todos.length === 0) {
    emptyState.classList.add('show');
    return;
  }

  emptyState.classList.remove('show');

  todos.forEach((todo, index) => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.dataset.index = String(index);

    li.innerHTML = `
      <button class="toggle-btn" aria-label="${todo.completed ? 'Mark incomplete' : 'Mark complete'}" title="${todo.completed ? 'Mark incomplete' : 'Mark complete'}">
        ${todo.completed ? '✓' : '○'}
      </button>
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="delete-btn" aria-label="Delete todo" title="Delete">×</button>
    `;

    todoList.appendChild(li);
  });
}

function addTodo(text) {
  const trimmedText = text.trim();
  if (!trimmedText) {
    return false;
  }

  const todos = loadTodos();
  todos.push({ text: trimmedText, completed: false });
  saveTodos(todos);
  renderTodos(todos);
  return true;
}

function toggleTodo(index) {
  const todos = loadTodos();
  if (!todos[index]) {
    return;
  }

  todos[index].completed = !todos[index].completed;
  saveTodos(todos);
  renderTodos(todos);
}

function deleteTodo(index) {
  const todos = loadTodos();
  if (!todos[index]) {
    return;
  }

  const li = document.querySelector(`[data-index="${index}"]`);
  if (!li) {
    todos.splice(index, 1);
    saveTodos(todos);
    renderTodos(todos);
    return;
  }

  li.classList.add('removing');
  window.setTimeout(() => {
    todos.splice(index, 1);
    saveTodos(todos);
    renderTodos(todos);
  }, 200);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('todo-form');
  const input = document.getElementById('todo-input');
  const todoList = document.getElementById('todo-list');

  renderTodos(loadTodos());

  form.addEventListener('submit', (event) => {
    event.preventDefault();

    const wasAdded = addTodo(input.value);
    if (!wasAdded) {
      input.focus();
      return;
    }

    input.value = '';
    input.focus();
  });

  todoList.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const li = target.closest('.todo-item');
    if (!(li instanceof HTMLElement)) {
      return;
    }

    const index = Number.parseInt(li.dataset.index ?? '', 10);
    if (Number.isNaN(index)) {
      return;
    }

    if (target.closest('.toggle-btn')) {
      toggleTodo(index);
      return;
    }

    if (target.closest('.delete-btn')) {
      deleteTodo(index);
    }
  });
});
