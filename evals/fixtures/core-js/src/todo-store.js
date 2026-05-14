export function updateTodo(todos, id, patch) {
  const todo = todos.find((item) => item.id === id);
  if (todo) {
    Object.assign(todo, patch);
  }
  return todos;
}

export function completedCount(todos) {
  return todos.length;
}
