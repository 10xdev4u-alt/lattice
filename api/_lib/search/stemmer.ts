/**
 * Porter2 (Snowball English) stemmer — vendored, no dep.
 *
 * Minimal port from https://tartarus.org/martin/PorterStemmer/js.txt
 * (public domain). Used by search-index BM25 so "running", "runs",
 * "transformers" collapse to "run", "transform". Keeps recall high
 * for research queries like "attention" vs "self-attention".
 */

const step2list: Record<string, string> = {
  ational: 'ate', tional: 'tion', enci: 'ence', anci: 'ance',
  izer: 'ize', bli: 'ble', alli: 'al', entli: 'ent', eli: 'e',
  ousli: 'ous', ization: 'ize', ation: 'ate', ator: 'ate',
  alism: 'al', iveness: 'ive', fulness: 'ful', ousness: 'ous',
  aliti: 'al', iviti: 'ive', biliti: 'ble', logi: 'log',
};

const step3list: Record<string, string> = {
  icate: 'ic', ative: '', alize: 'al', iciti: 'ic', ical: 'ic', ful: '', ness: '',
};

const c = '[^aeiou]';
const v = '[aeiouy]';
const C = c + '[^aeiouy]*';
const V = v + '[aeiou]*';

const mgr0 = new RegExp('^(' + C + ')?' + V + C);
const meq1 = new RegExp('^(' + C + ')?' + V + C + '(' + V + ')?$');
const mgr1 = new RegExp('^(' + C + ')?' + V + C + V + C);

function consonant(word: string, i: number): boolean {
  const ch = word[i]!;
  if ('aeiou'.includes(ch)) return false;
  if (ch === 'y') return i === 0 ? true : !consonant(word, i - 1);
  return true;
}

function m(word: string): number {
  let n = 0;
  const len = word.length;
  let i = 0;
  // skip initial C
  while (i < len && consonant(word, i)) i++;
  while (i < len) {
    // skip V
    while (i < len && !consonant(word, i)) i++;
    if (i >= len) break;
    // skip C
    let j = i;
    while (j < len && consonant(word, j)) j++;
    n++;
    i = j;
  }
  return n;
}

function containsVowel(stem: string): boolean {
  for (let i = 0; i < stem.length; i++) if (!consonant(stem, i)) return true;
  return false;
}

function doubleConsonant(stem: string): boolean {
  const l = stem.length - 1;
  if (l < 1) return false;
  return stem[l] === stem[l - 1] && consonant(stem, l);
}

// Fix isCVC to proper definition
function cvc(word: string): boolean {
  if (word.length < 3) return false;
  const i = word.length - 1;
  if (consonant(word, i) || !consonant(word, i - 1) || consonant(word, i - 2)) return false;
  const ch = word[i]!;
  return !'wxy'.includes(ch);
}

export function stem(word: string): string {
  let w = word;
  if (w.length < 3) return w;
  // Step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2);
  else if (w.endsWith('ies')) w = w.slice(0, -2);
  else if (w.endsWith('ss')) { /* keep */ } else if (w.endsWith('s')) w = w.slice(0, -1);

  // Step 1b
  let flag = false;
  if (w.endsWith('eed')) {
    const stem = w.slice(0, -3);
    if (mgr0.test(stem)) w = stem + 'ee';
  } else if (w.endsWith('ed') && containsVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    flag = true;
  } else if (w.endsWith('ing') && containsVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    flag = true;
  }
  if (flag) {
    if (w.endsWith('at')) w += 'e';
    else if (w.endsWith('bl')) w += 'e';
    else if (w.endsWith('iz')) w += 'e';
    else if (doubleConsonant(w) && !'lsz'.includes(w[w.length - 1]!)) w = w.slice(0, -1);
    else if (m(w) === 1 && cvc(w)) w += 'e';
  }

  // Step 1c
  if (w.endsWith('y') && containsVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i';

  // Step 2
  for (const [suffix, rep] of Object.entries(step2list)) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      if (mgr0.test(stem)) { w = stem + rep; break; }
    }
  }

  // Step 3
  for (const [suffix, rep] of Object.entries(step3list)) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      if (mgr0.test(stem)) { w = stem + rep; break; }
    }
  }

  // Step 4
  const step4list = ['al','ance','ence','er','ic','able','ible','ant','ement','ment','ent','ou','ism','ate','iti','ous','ive','ize'];
  for (const suffix of step4list) {
    if (w.endsWith(suffix)) {
      const stem = w.slice(0, -suffix.length);
      if (mgr1.test(stem)) { w = stem; break; }
    }
  }
  if (w.endsWith('ion')) {
    const stem = w.slice(0, -3);
    if (mgr1.test(stem) && ('st'.includes(stem[stem.length - 1]!))) w = stem;
  }

  // Step 5a
  if (w.endsWith('e')) {
    const stem = w.slice(0, -1);
    if (mgr1.test(stem) || (meq1.test(stem) && !cvc(stem))) w = stem;
  }
  // Step 5b
  if (m(w) > 1 && doubleConsonant(w) && w.endsWith('l')) w = w.slice(0, -1);
  return w;
}
