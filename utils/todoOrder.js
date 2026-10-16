// Yapılacak maddelerinin sırası: "YAPILACAKLAR" ve "YAPILANLAR" aynı dizinin
// `done` süzgeçleridir, bu yüzden bir grubun görünen sırası dizideki sıradır.
//   · yeni madde → yapılacakların EN ÜSTÜ (dizinin başı)
//   · işaretlenen madde → hedef grubun EN ÜSTÜ (yapılanlarda son tamamlanan başta)
// Kartlardaki daire, editör ve bağlam (context) hep bu iki işlevi kullanır; yoksa
// aynı not iki yerde farklı sırada görünürdü.

/** Yeni maddeyi yapılacakların en üstüne koyar. */
export function addTodoOnTop(todos, item) {
  const list = Array.isArray(todos) ? todos : [];
  return [item, ...list];
}

/**
 * Maddenin `done` durumunu çevirir ve onu YENİ grubunun en üstüne taşır. Hedef
 * grup boşsa madde dizinin sonuna girer (grubun tek üyesi olur).
 */
export function toggleTodoItem(todos, todoId) {
  const list = Array.isArray(todos) ? todos : [];
  const index = list.findIndex((item) => item?.id === todoId);
  if (index < 0) return list;

  const toggled = { ...list[index], done: !list[index].done };
  const rest = list.filter((_, position) => position !== index);
  const firstOfTarget = rest.findIndex((item) => Boolean(item?.done) === toggled.done);
  const insertAt = firstOfTarget < 0 ? rest.length : firstOfTarget;
  return [...rest.slice(0, insertAt), toggled, ...rest.slice(insertAt)];
}

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
