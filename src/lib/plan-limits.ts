/** Free-plan ceilings. An active Pro subscription skips the entry, file, and monthly question caps. */
export const FREE_LEDGER_ENTRY_LIMIT = 50;
export const FREE_ATTACHMENT_LIMIT = 5;
export const FREE_QUESTIONS_PER_MONTH = 30;
/** Burst cap on tutor questions, counted per authenticated user, including Pro. */
export const FREE_QUESTION_RATE_LIMIT = 5;
export const FREE_QUESTION_RATE_WINDOW_SECONDS = 60;
/** Safety ceiling so a Pro account cannot run an unbounded month of model calls. */
export const PRO_QUESTIONS_PER_MONTH = 100_000;
/** One approved Wompi checkout covers this many days. Renewal is a new checkout. */
export const WOMPI_PRO_PERIOD_DAYS = 30;
