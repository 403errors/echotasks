// npm: chrono-node
import * as chrono from 'chrono-node';

const URGENT_KEYWORDS = ['urgent','asap','immediately','right away','right now','as soon as possible'];
const IMPACT_KEYWORDS = ['tax','rent','bill','submit','application','deadline','payment','fine','due'];
const LOCATION_KEYWORDS = ['nearby','near','supermarket','market','store','grocery','groceries'];

function containsKeyword(text: string, arr: string[]) {
  // split-on-whitespace + simple set lookup is very fast
  const words = new Set(text.split(/\W+/));
  for (const k of arr) if (words.has(k) || text.includes(k)) return true;
  return false;
}

function hoursBetween(now: Date, then: Date) {
  return (then.getTime() - now.getTime()) / (1000 * 60 * 60);
}

type Priority = 'high'|'medium'|'low'|'none';
type Result = { priority: Priority, reason: string, score: number };

export function detectPriorityFast(raw: string, now = new Date()): Result {
  const text = raw.trim().toLowerCase();

  // 1) Early exit: explicit urgent words
  if (containsKeyword(text, URGENT_KEYWORDS)) {
    return { priority: 'high', reason: "explicit urgency word detected", score: 90 };
  }

  // 2) Parse date/time quickly
  const parsed = chrono.parse(text, now);
  let dateScore = 0;
  if (parsed && parsed.length > 0) {
    // take first parsed date
    const dt = parsed[0].start.date();
    const hrs = hoursBetween(now, dt);
    if (hrs <= 0.5) dateScore = 40;         // due very soon
    else if (hrs <= 4) dateScore = 40;      // within 4 hours
    else if (hrs <= 24) dateScore = 30;     // today
    else if (hrs <= 72) dateScore = 15;     // 1-3 days
    else dateScore = 5;
  }

  // 3) Keywords for impact and location
  const impact = containsKeyword(text, IMPACT_KEYWORDS) ? 15 : 0;
  const loc = containsKeyword(text, LOCATION_KEYWORDS) ? 10 : 0;

  // 4) Recurrence or routine de-bias
  const isRoutine = text.includes('every') || text.includes('daily') || text.includes('weekly');
  const routinePenalty = isRoutine ? -10 : 0;

  // 5) Score + map
  let score = dateScore + impact + loc + routinePenalty;
  if (score < 0) score = 0;
  if (score >= 70) return { priority: 'high', reason: `score ${score} (date:${dateScore} impact:${impact})`, score };
  if (score >= 30) return { priority: 'medium', reason: `score ${score}`, score };
  if (score >= 5) return { priority: 'low', reason: `score ${score}`, score };

  // 6) Default: none (no clear signals)
  return { priority: 'none', reason: 'no deadline or urgency detected', score };
}
