export function getTodoMoveAvailability(todos, todoId) {
  const list = Array.isArray(todos) ? todos : [];
  const current = list.find((item) => item?.id === todoId);
  if (!current) return { canMoveUp: false, canMoveDown: false };

  const group = list.filter((item) => Boolean(item?.done) === Boolean(current.done));
  const position = group.findIndex((item) => item?.id === todoId);
  return {
    canMoveUp: position > 0,
    canMoveDown: position >= 0 && position < group.length - 1,
  };
}

export function moveTodoItem(todos, todoId, direction) {
  const list = Array.isArray(todos) ? todos : [];
  if (direction !== "up" && direction !== "down") return list;

  const currentIndex = list.findIndex((item) => item?.id === todoId);
  if (currentIndex < 0) return list;

  const sameStateIndices = list.reduce((indices, item, index) => {
    if (Boolean(item?.done) === Boolean(list[currentIndex]?.done)) indices.push(index);
    return indices;
  }, []);
  const groupPosition = sameStateIndices.indexOf(currentIndex);
  const targetPosition = groupPosition + (direction === "up" ? -1 : 1);
  if (targetPosition < 0 || targetPosition >= sameStateIndices.length) return list;

  const targetIndex = sameStateIndices[targetPosition];
  const reordered = [...list];
  [reordered[currentIndex], reordered[targetIndex]] = [
    reordered[targetIndex],
    reordered[currentIndex],
  ];
  return reordered;
}
