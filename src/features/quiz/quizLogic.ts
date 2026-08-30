export function getAvailableQuestionIds(
  allQuestionIds: readonly string[],
  seenQuestionIds: readonly string[],
) {
  const seenIds = new Set(seenQuestionIds);
  return allQuestionIds.filter((id) => !seenIds.has(id));
}

export function selectRandomUnseenQuestionId(
  allQuestionIds: readonly string[],
  seenQuestionIds: readonly string[],
  random: () => number = Math.random,
): string | null {
  const availableQuestionIds = getAvailableQuestionIds(
    allQuestionIds,
    seenQuestionIds,
  );
  if (availableQuestionIds.length === 0) {
    return null;
  }

  const index = Math.floor(random() * availableQuestionIds.length);
  return availableQuestionIds[index] ?? null;
}

export function isAnswerCorrect(
  correctAnswers: readonly string[],
  selectedOptionIds: readonly string[],
) {
  const correct = new Set(correctAnswers);
  const selected = new Set(selectedOptionIds);

  return (
    correct.size === selected.size &&
    [...selected].every((optionId) => correct.has(optionId))
  );
}
