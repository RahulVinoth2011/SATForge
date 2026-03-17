import https from 'https';
import http from 'http';

// Curated list of Project Gutenberg book IDs — all public domain 1800s literature
export const BOOKS = [
  { id: 1342, title: 'Pride and Prejudice',            author: 'Jane Austen',          year: 1813 },
  { id: 2701, title: 'Moby-Dick',                      author: 'Herman Melville',       year: 1851 },
  { id: 1400, title: 'Great Expectations',             author: 'Charles Dickens',       year: 1861 },
  { id: 25344,title: 'The Scarlet Letter',             author: 'Nathaniel Hawthorne',   year: 1850 },
  { id: 1260, title: 'Jane Eyre',                      author: 'Charlotte Bronte',      year: 1847 },
  { id: 76,   title: 'Adventures of Huckleberry Finn', author: 'Mark Twain',            year: 1884 },
  { id: 174,  title: 'The Picture of Dorian Gray',     author: 'Oscar Wilde',           year: 1890 },
  { id: 244,  title: 'A Study in Scarlet',             author: 'Arthur Conan Doyle',    year: 1887 },
  { id: 2009, title: 'The Origin of Species',          author: 'Charles Darwin',        year: 1859 },
  { id: 84,   title: 'Frankenstein',                   author: 'Mary Shelley',          year: 1818 },
  { id: 768,  title: 'Wuthering Heights',              author: 'Emily Bronte',          year: 1847 },
  { id: 158,  title: 'Emma',                           author: 'Jane Austen',           year: 1815 },
  { id: 730,  title: 'Oliver Twist',                   author: 'Charles Dickens',       year: 1839 },
  { id: 98,   title: 'A Tale of Two Cities',           author: 'Charles Dickens',       year: 1859 },
  { id: 46,   title: 'A Christmas Carol',              author: 'Charles Dickens',       year: 1843 },
  { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle', year: 1892 },
  { id: 345,  title: 'Dracula',                        author: 'Bram Stoker',           year: 1897 },
  { id: 43,   title: 'The Strange Case of Dr Jekyll',  author: 'Robert Louis Stevenson',year: 1886 },
  { id: 161,  title: 'Sense and Sensibility',          author: 'Jane Austen',           year: 1811 },
  { id: 1232, title: 'The Prince',                     author: 'Niccolo Machiavelli',   year: 1895 },
  { id: 2554, title: 'Crime and Punishment',           author: 'Fyodor Dostoevsky',     year: 1866 },
  { id: 1251, title: 'Le Morte d\'Arthur',             author: 'Thomas Malory',         year: 1893 },
  { id: 135,  title: 'Les Misérables',                 author: 'Victor Hugo',           year: 1862 },
  { id: 5200, title: 'Metamorphosis',                  author: 'Franz Kafka',           year: 1915 },
  { id: 2814, title: 'Dubliners',                      author: 'James Joyce',           year: 1914 },
  { id: 1952, title: 'The Yellow Wallpaper',           author: 'Charlotte Perkins Gilman', year: 1892 },
  { id: 514,  title: 'Little Women',                   author: 'Louisa May Alcott',     year: 1868 },
  { id: 74,   title: 'The Adventures of Tom Sawyer',   author: 'Mark Twain',            year: 1876 },
  { id: 219,  title: 'Heart of Darkness',              author: 'Joseph Conrad',         year: 1899 },
  { id: 1184, title: 'The Count of Monte Cristo',      author: 'Alexandre Dumas',       year: 1844 },
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchUrl(res.headers.location).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', reject);
    req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function cleanGutenbergText(raw) {
  // Strip Gutenberg header/footer
  const startMarkers = ['*** START OF', '***START OF', 'START OF THE PROJECT', 'START OF THIS PROJECT'];
  const endMarkers   = ['*** END OF',   '***END OF',   'END OF THE PROJECT',   'END OF THIS PROJECT'];

  let text = raw;
  for (const m of startMarkers) {
    const idx = text.indexOf(m);
    if (idx !== -1) { text = text.slice(text.indexOf('\n', idx) + 1); break; }
  }
  for (const m of endMarkers) {
    const idx = text.indexOf(m);
    if (idx !== -1) { text = text.slice(0, idx); break; }
  }
  return text.trim();
}

function extractPassage(text, minLen = 300, maxLen = 800) {
  // Split into paragraphs, find a good meaty one
  const paras = text
    .split(/\n\n+/)
    .map(p => p.replace(/\s+/g, ' ').trim())
    .filter(p => p.length >= minLen && p.length <= maxLen * 1.5)
    // Skip chapter headings, short lines, all-caps
    .filter(p => !/^(chapter|part|book|section|volume)/i.test(p))
    .filter(p => p.split(' ').length > 40);

  if (!paras.length) return null;

  // Pick a random paragraph from the middle of the book (skip intro)
  const start = Math.floor(paras.length * 0.1);
  const end   = Math.floor(paras.length * 0.9);
  const idx   = start + Math.floor(Math.random() * (end - start));
  let passage = paras[idx];

  // Trim to maxLen
  if (passage.length > maxLen) {
    passage = passage.slice(0, maxLen);
    const lastPeriod = passage.lastIndexOf('.');
    if (lastPeriod > minLen) passage = passage.slice(0, lastPeriod + 1);
  }

  return passage;
}

export async function fetchRandomPassage(book) {
  const url = `https://www.gutenberg.org/files/${book.id}/${book.id}-0.txt`;
  const fallbackUrl = `https://www.gutenberg.org/cache/epub/${book.id}/pg${book.id}.txt`;

  let raw;
  try {
    raw = await fetchUrl(url);
  } catch {
    try {
      raw = await fetchUrl(fallbackUrl);
    } catch (e) {
      throw new Error(`Could not fetch "${book.title}" from Gutenberg: ${e.message}`);
    }
  }

  const cleaned = cleanGutenbergText(raw);
  const passage = extractPassage(cleaned);

  if (!passage) throw new Error(`Could not extract a clean passage from "${book.title}"`);

  return {
    id:     `${book.id}_dynamic`,
    title:  book.title,
    author: book.author,
    year:   book.year,
    text:   passage,
  };
}

export function randomBook() {
  return BOOKS[Math.floor(Math.random() * BOOKS.length)];
}