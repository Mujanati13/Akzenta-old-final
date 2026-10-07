export interface ProjectQuestionLike {
  questionText?: string | null;
  text?: string | null;
  answerType?: { id?: number | null; name?: string | null } | null;
}

export function isEmptyProjectQuestion(question: ProjectQuestionLike | null | undefined): boolean {
  if (!question) {
    return true;
  }

  const text = (question.questionText ?? question.text ?? '').trim();
  const answerType = question.answerType;
  const hasAnswerType = answerType?.id != null || !!answerType?.name;

  return !text && !hasAnswerType;
}

export function getVisibleProjectQuestions<T extends ProjectQuestionLike>(questions: T[] | null | undefined): T[] {
  return (questions || []).filter((question) => !isEmptyProjectQuestion(question));
}

export function isEmptyQuestionOptionText(text: string | null | undefined): boolean {
  return !(text ?? '').trim();
}

export function getVisibleQuestionOptionTexts(options: Array<{ optionText?: string | null; text?: string | null } | string | null | undefined> | null | undefined): string[] {
  return (options || []).map((option) => (typeof option === 'string' ? option : (option?.optionText ?? option?.text ?? ''))).filter((text) => !isEmptyQuestionOptionText(text));
}
