// Pre-built vector SVG icons and presets for the Feature Grid system

export interface FeaturePreset {
  title: string;
  link: string;
  description?: string;
  order: number;
  icon_url: string;
}

export const DESTINATION_PRESETS = [
  { label: 'Free Courses (/courses?access=free)', value: '/courses?access=free' },
  { label: 'Paid Courses (/courses?access=paid)', value: '/courses?access=paid' },
  { label: 'All Courses (/courses)', value: '/courses' },
  { label: 'Free Test Series (/test-series)', value: '/test-series' },
  { label: 'Paid Test Series (/test-series/paid)', value: '/test-series/paid' },
  { label: 'Free PDFs (/courses?access=free)', value: '/courses?access=free' },
  { label: 'Paid PDFs (/courses?access=paid)', value: '/courses?access=paid' },
  { label: 'E-Book & PYQs (/courses)', value: '/courses' },
  { label: 'Timetable / My Learning (/dashboard)', value: '/dashboard' },
  { label: 'Syllabus Roadmap (/courses)', value: '/courses' },
  { label: 'Quiz Practice (/test-series)', value: '/test-series' },
  { label: 'Contact Us (/#contact)', value: '/#contact' },
  { label: 'About Us (/#about)', value: '/#about' },
];

export const createFeatureSvgIcon = (type: string): string => {
  let gradientA = '#2563eb';
  let gradientB = '#1d4ed8';
  let iconContent = '';

  switch (type) {
    case 'paid-courses':
      gradientA = '#1e40af';
      gradientB = '#3b82f6';
      // Graduation cap with star
      iconContent = `
        <path d="M40 18L14 30L40 42L66 30L40 18Z" fill="white" />
        <path d="M22 36.5V50C22 55.5 30 60 40 60C50 60 58 55.5 58 50V36.5L40 45L22 36.5Z" fill="white" fill-opacity="0.9" />
        <path d="M66 32V48" stroke="#fde047" stroke-width="3" stroke-linecap="round" />
        <circle cx="66" cy="51" r="3" fill="#fde047" />
      `;
      break;

    case 'free-courses':
      gradientA = '#059669';
      gradientB = '#10b981';
      // Open book with gift tag/sparkle
      iconContent = `
        <path d="M40 28C34 23 25 23 18 25V54C25 52 34 52 40 57C46 52 55 52 62 54V25C55 23 46 23 40 28Z" fill="none" stroke="white" stroke-width="3.5" stroke-linejoin="round" />
        <path d="M40 28V57" stroke="white" stroke-width="3" stroke-linecap="round" />
        <path d="M48 16L50 21L55 23L50 25L48 30L46 25L41 23L46 21L48 16Z" fill="#fef08a" />
      `;
      break;

    case 'free-test-series':
      gradientA = '#d97706';
      gradientB = '#f59e0b';
      // Clipboard with checkmarks
      iconContent = `
        <rect x="22" y="20" width="36" height="46" rx="6" fill="white" fill-opacity="0.2" stroke="white" stroke-width="3" />
        <rect x="32" y="15" width="16" height="8" rx="3" fill="white" />
        <path d="M30 33L36 39L50 25" stroke="#fef08a" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="30" y1="46" x2="50" y2="46" stroke="white" stroke-width="3" stroke-linecap="round" />
        <line x1="30" y1="54" x2="44" y2="54" stroke="white" stroke-width="3" stroke-linecap="round" />
      `;
      break;

    case 'paid-test-series':
      gradientA = '#6d28d9';
      gradientB = '#8b5cf6';
      // Golden Trophy cup
      iconContent = `
        <path d="M26 22H54V38C54 45.7 47.7 52 40 52C32.3 52 26 45.7 26 38V22Z" fill="#fbbf24" stroke="white" stroke-width="2" />
        <path d="M26 26H18C15.8 26 14 27.8 14 30C14 36.6 19.4 42 26 42V38V26Z" fill="white" fill-opacity="0.3" stroke="white" stroke-width="2" />
        <path d="M54 26H62C64.2 26 66 27.8 66 30C66 36.6 60.6 42 54 42V38V26Z" fill="white" fill-opacity="0.3" stroke="white" stroke-width="2" />
        <path d="M36 52H44V60H36V52Z" fill="white" />
        <path d="M28 60H52V64H28V60Z" rx="2" fill="white" />
      `;
      break;

    case 'paid-pdfs':
      gradientA = '#e11d48';
      gradientB = '#f43f5e';
      // Document with PDF badge and lock/star
      iconContent = `
        <path d="M22 18H46L58 30V62H22V18Z" fill="white" />
        <path d="M46 18V30H58" fill="#fecdd3" />
        <rect x="26" y="38" width="28" height="18" rx="4" fill="#e11d48" />
        <text x="40" y="51" fill="white" font-size="11" font-weight="900" font-family="sans-serif" text-anchor="middle">PDF</text>
      `;
      break;

    case 'free-pdfs':
      gradientA = '#0d9488';
      gradientB = '#14b8a6';
      // Document with download arrow
      iconContent = `
        <path d="M22 18H46L58 30V62H22V18Z" fill="white" />
        <path d="M46 18V30H58" fill="#ccfbf1" />
        <circle cx="40" cy="46" r="12" fill="#0d9488" />
        <path d="M40 40V49M40 49L36 45M40 49L44 45" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="34" y1="53" x2="46" y2="53" stroke="white" stroke-width="2" stroke-linecap="round" />
      `;
      break;

    case 'ebook-pyqs':
      gradientA = '#0284c7';
      gradientB = '#38bdf8';
      // Stack of books
      iconContent = `
        <path d="M20 54L40 60L60 54L40 48L20 54Z" fill="white" />
        <path d="M20 44L40 50L60 44L40 38L20 44Z" fill="#bae6fd" />
        <path d="M20 34L40 40L60 34L40 28L20 34Z" fill="#e0f2fe" />
        <path d="M20 34V54M60 34V54M40 40V60" stroke="#0284c7" stroke-width="2" />
      `;
      break;

    case 'timetable':
      gradientA = '#c026d3';
      gradientB = '#e879f9';
      // Calendar & clock
      iconContent = `
        <rect x="20" y="22" width="40" height="42" rx="7" fill="white" />
        <rect x="20" y="22" width="40" height="12" rx="7" fill="#a21caf" />
        <circle cx="28" cy="18" r="2.5" fill="white" stroke="#a21caf" stroke-width="2" />
        <circle cx="52" cy="18" r="2.5" fill="white" stroke="#a21caf" stroke-width="2" />
        <circle cx="48" cy="48" r="10" fill="#fdf4ff" stroke="#c026d3" stroke-width="2" />
        <polyline points="48,43 48,48 52,50" fill="none" stroke="#c026d3" stroke-width="2" stroke-linecap="round" />
      `;
      break;

    case 'syllabus':
      gradientA = '#4f46e5';
      gradientB = '#6366f1';
      // Flowchart / hierarchical roadmap
      iconContent = `
        <rect x="32" y="16" width="16" height="12" rx="3" fill="white" />
        <line x1="40" y1="28" x2="40" y2="38" stroke="white" stroke-width="3" />
        <line x1="22" y1="38" x2="58" y2="38" stroke="white" stroke-width="3" stroke-linecap="round" />
        <line x1="22" y1="38" x2="22" y2="46" stroke="white" stroke-width="3" />
        <line x1="58" y1="38" x2="58" y2="46" stroke="white" stroke-width="3" />
        <rect x="14" y="46" width="16" height="12" rx="3" fill="white" fill-opacity="0.9" />
        <rect x="50" y="46" width="16" height="12" rx="3" fill="white" fill-opacity="0.9" />
      `;
      break;

    case 'quiz':
    default:
      gradientA = '#ea580c';
      gradientB = '#fb923c';
      // High-voltage lightning badge
      iconContent = `
        <circle cx="40" cy="40" r="24" fill="white" fill-opacity="0.2" />
        <path d="M43 18L24 40H38L35 62L56 36H41L43 18Z" fill="#fef08a" stroke="white" stroke-width="2" stroke-linejoin="round" />
      `;
      break;
  }

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" width="80" height="80">
      <defs>
        <linearGradient id="grad-${type}" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${gradientA}" />
          <stop offset="100%" stop-color="${gradientB}" />
        </linearGradient>
        <filter id="shadow-${type}" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" flood-opacity="0.25" />
        </filter>
      </defs>
      <rect x="4" y="4" width="72" height="72" rx="20" fill="url(#grad-${type})" filter="url(#shadow-${type})" />
      ${iconContent}
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const INITIAL_FEATURE_GRID_ITEMS: FeaturePreset[] = [
  {
    title: 'Paid Courses',
    link: '/courses?access=paid',
    order: 0,
    icon_url: createFeatureSvgIcon('paid-courses'),
  },
  {
    title: 'Free Courses',
    link: '/courses?access=free',
    order: 1,
    icon_url: createFeatureSvgIcon('free-courses'),
  },
  {
    title: 'Free Test Series',
    link: '/test-series',
    order: 2,
    icon_url: createFeatureSvgIcon('free-test-series'),
  },
  {
    title: 'Paid Test Series',
    link: '/test-series/paid',
    order: 3,
    icon_url: createFeatureSvgIcon('paid-test-series'),
  },
  {
    title: 'Paid PDFs',
    link: '/courses?access=paid',
    order: 4,
    icon_url: createFeatureSvgIcon('paid-pdfs'),
  },
  {
    title: 'Free PDFs',
    link: '/courses?access=free',
    order: 5,
    icon_url: createFeatureSvgIcon('free-pdfs'),
  },
  {
    title: 'E-Book & PYQs',
    link: '/courses',
    order: 6,
    icon_url: createFeatureSvgIcon('ebook-pyqs'),
  },
  {
    title: 'Timetable',
    link: '/dashboard',
    order: 7,
    icon_url: createFeatureSvgIcon('timetable'),
  },
  {
    title: 'Syllabus',
    link: '/courses',
    order: 8,
    icon_url: createFeatureSvgIcon('syllabus'),
  },
  {
    title: 'Quiz',
    link: '/test-series',
    order: 9,
    icon_url: createFeatureSvgIcon('quiz'),
  },
];
