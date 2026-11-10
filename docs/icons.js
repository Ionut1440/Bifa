'use strict';
/* MindMe – icon sets drawn for the app (24 × 24 grid, rounded ends). No emoji anywhere: every emoji that would appear
   on screen is swapped for one of these drawings (see emojiToGlyphs at the end).
   Styles (Setări → Iconițe): linie (thin line), plin (filled, details cut out), duo (outline + soft fill), insigna (white on a coloured square). */

// c = circle [cx, cy, r, closed], r = rounded rect [x, y, w, h, rx, transform], p = path [d, closed | transform]
const GLYPHS = {
  // bottom bar + lists
  azi:        [['c', 12, 12, 4, 1], ['p', 'M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4']],
  liste:      [['r', 3.5, 3.5, 7, 7, 2], ['r', 13.5, 3.5, 7, 7, 2], ['r', 3.5, 13.5, 7, 7, 2], ['r', 13.5, 13.5, 7, 7, 2]],
  remindere:  [['p', 'M6 16.5V11a6 6 0 0 1 12 0v5.5l1.6 2.1H4.4z', 1], ['p', 'M10 21a2.1 2.1 0 0 0 4 0']],
  setari:     [['p', 'M4 7h9M17.4 7H20M4 17h2.6M11 17h9'], ['c', 15.2, 7, 2.2, 1], ['c', 8.8, 17, 2.2, 1]],
  facut:      [['c', 12, 12, 8.5, 1], ['p', 'M8.4 12.3l2.5 2.5 4.8-5']],
  cumparaturi:[['p', 'M3 4.5h2.2l2.1 10.3a1.6 1.6 0 0 0 1.6 1.2h8.2a1.6 1.6 0 0 0 1.5-1.2L20 8.5H6.1'], ['c', 9.6, 19.6, 1.4, 1], ['c', 16.8, 19.6, 1.4, 1]],
  comenzi:    [['p', 'M12 3l8 4.5v9L12 21l-8-4.5v-9z', 1], ['p', 'M4 7.5l8 4.5 8-4.5M12 12v9']],
  plati:      [['r', 3, 5.5, 18, 13, 2.6], ['p', 'M3 10h18M7 14.8h4']],
  notite:     [['r', 5, 3.5, 14, 17, 2.6], ['p', 'M8.6 8.8h6.8M8.6 12.3h6.8M8.6 15.8h4']],
  medicamente:[['r', 8.5, 2.5, 7, 19, 3.5, 'rotate(45 12 12)'], ['p', 'M8.5 12h7', 'rotate(45 12 12)']],
  vacante:    [['p', 'M12 3c.8 0 1.5.7 1.5 1.5V10l7 4.5v2l-7-2.2V19l2 1.5V22L12 21l-3.5 1v-1.5l2-1.5v-4.7l-7 2.2v-2l7-4.5V4.5C10.5 3.7 11.2 3 12 3z', 1]],
  concediu:   [['p', 'M12 3.2a8.6 8.6 0 0 1 8.6 8.3H3.4A8.6 8.6 0 0 1 12 3.2z', 1], ['p', 'M12 11.5v7.2a2.1 2.1 0 0 1-4.2 0']],
  birou:      [['r', 5, 3.5, 14, 17, 1.8], ['p', 'M9 8h1.6M13.4 8H15M9 11.6h1.6M13.4 11.6H15M10.4 20.5v-4h3.2v4']],
  bilet:      [['p', 'M4 7.6A1.6 1.6 0 0 1 5.6 6h12.8A1.6 1.6 0 0 1 20 7.6V10a2 2 0 0 0 0 4v2.4a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 16.4V14a2 2 0 0 0 0-4z', 1], ['p', 'M14.6 8.2v1.4M14.6 11.3v1.4M14.6 14.4v1.4']],
  raion:      [['p', 'M3.5 12.6V5.1a1.6 1.6 0 0 1 1.6-1.6h7.5l7.9 7.9a1.6 1.6 0 0 1 0 2.2l-7.4 7.4a1.6 1.6 0 0 1-2.2 0z', 1], ['c', 8.1, 8.1, 1.5, 0]],
  bagaj:      [['r', 4, 7, 16, 13, 2.6], ['p', 'M9 7V5.1a1.6 1.6 0 0 1 1.6-1.6h2.8A1.6 1.6 0 0 1 15 5.1V7M4 12.5h16']],
  calendar:   [['r', 3.5, 5, 17, 15.5, 2.6], ['p', 'M3.5 10h17M8 3v4M16 3v4M8 14.2h2M14 14.2h2']],
  // actions and UI
  plus:       [['p', 'M12 5v14M5 12h14']],
  search:     [['c', 11, 11, 6.5, 1], ['p', 'M16 16l4.4 4.4']],
  trash:      [['p', 'M4.5 7h15M10 7V4.6h4V7'], ['p', 'M6.6 7l1 12.4a1.6 1.6 0 0 0 1.6 1.5h5.6a1.6 1.6 0 0 0 1.6-1.5l1-12.4z', 1], ['p', 'M10.2 11v5.8M13.8 11v5.8']],
  download:   [['p', 'M12 4v11M7.5 10.6L12 15l4.5-4.4M5 19.6h14']],
  upload:     [['p', 'M12 15V4M7.5 8.4L12 4l4.5 4.4M5 19.6h14']],
  ora:        [['c', 12, 12, 8.5, 1], ['p', 'M12 7.5V12l3 2']],
  harta:      [['p', 'M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z', 1], ['c', 12, 10, 2.3, 0]],
  repeat:     [['p', 'M4.5 11V9.5A3.5 3.5 0 0 1 8 6h11.5M16.5 3l3 3-3 3M19.5 13v1.5A3.5 3.5 0 0 1 16 18H4.5M7.5 21l-3-3 3-3']],
  alert:      [['p', 'M10.3 4.3a2 2 0 0 1 3.4 0l7.4 12.8a2 2 0 0 1-1.7 3H4.6a2 2 0 0 1-1.7-3z', 1], ['p', 'M12 9.5v4'], ['c', 12, 16.7, 1, 0]],
  flag:       [['p', 'M5.5 21V4.5'], ['p', 'M5.5 4.5h12l-2.6 4 2.6 4h-12z', 1]],
  money:      [['r', 2.5, 6.5, 19, 11, 2.2], ['c', 12, 12, 2.6, 0], ['p', 'M5.5 12h1M17.5 12h1']],
  install:    [['r', 6.5, 2.5, 11, 19, 2.6], ['p', 'M12 7.5v6M9.5 11l2.5 2.5 2.5-2.5M10.5 18.5h3']],
  folder:     [['p', 'M3.5 7.2a1.7 1.7 0 0 1 1.7-1.7h4.3l2 2.2h7.3a1.7 1.7 0 0 1 1.7 1.7v8.9a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7z', 1]],
  stack:      [['p', 'M12 3.5l8.5 4.5L12 12.5 3.5 8z', 1], ['p', 'M3.5 12L12 16.5l8.5-4.5M3.5 16l8.5 4.5 8.5-4.5']],
  palette:    [['p', 'M12 3.5a8.5 8.5 0 1 0 0 17c1.3 0 1.9-.8 1.9-1.7 0-1.2-1-1.6-1-2.6 0-1 .8-1.7 1.8-1.7h2.1a3.7 3.7 0 0 0 3.7-3.7c0-4.3-3.8-7.3-8.5-7.3z', 1], ['c', 8, 10.5, 1.1, 0], ['c', 11.5, 7.5, 1.1, 0], ['c', 15.5, 9, 1.1, 0]],
  contrast:   [['c', 12, 12, 8.5], ['p', 'M12 3.5v17a8.5 8.5 0 0 0 0-17z', 1]],
  clip:       [['p', 'M19 11.5l-7.6 7.6a4.8 4.8 0 0 1-6.8-6.8l8-8a3.2 3.2 0 0 1 4.5 4.5l-7.9 7.9a1.6 1.6 0 0 1-2.3-2.3l7.2-7.2']],
  pencil:     [['p', 'M4 20l1-4.2L15.6 5.2a2 2 0 0 1 2.8 0l.4.4a2 2 0 0 1 0 2.8L8.2 19z', 1], ['p', 'M13.8 7l3.2 3.2']],
  bulb:       [['p', 'M9 17.5h6M10 21h4'], ['p', 'M12 3a6 6 0 0 0-3.4 10.9c.6.5.9 1.1.9 1.8v.3h5v-.3c0-.7.3-1.3.9-1.8A6 6 0 0 0 12 3z', 1]],
  doc:        [['p', 'M6.5 3.5h7.5l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5.5 19V5a1.5 1.5 0 0 1 1-1.5z', 1], ['p', 'M13.5 3.7v4.8h4.8M8.5 12.5h7M8.5 16h5']],
  image:      [['r', 3.5, 4.5, 17, 15, 2.6], ['c', 9, 9.5, 1.6, 0], ['p', 'M4 17.5l4.6-4.6 3.4 3.4 2.6-2.6 5.4 5.4']],
  star:       [['p', 'M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z', 1]],
  heart:      [['p', 'M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z', 1]],
  gift:       [['r', 4, 9, 16, 11.5, 1.8], ['p', 'M3 9h18M12 9v11.5M12 9c-1.5-3.8-5.5-4.3-5.5-2 0 1.4 2.4 2 5.5 2zM12 9c1.5-3.8 5.5-4.3 5.5-2 0 1.4-2.4 2-5.5 2z']],
  home:       [['p', 'M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z', 1], ['p', 'M10 20.5V15h4v5.5']],
  briefcase:  [['r', 3.5, 7, 17, 13, 2.4], ['p', 'M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7M3.5 12.5h17']],
  car:        [['p', 'M5.5 16.5v2.5M18.5 16.5v2.5'], ['p', 'M3.5 16.5v-4l1.9-5a2 2 0 0 1 1.9-1.3h9.4a2 2 0 0 1 1.9 1.3l1.9 5v4z', 1], ['p', 'M3.5 12.5h17'], ['c', 7.5, 14.5, 1, 0], ['c', 16.5, 14.5, 1, 0]],
  taxi:       [['p', 'M9.5 6.2V4h5v2.2M5.5 16.5v2.5M18.5 16.5v2.5'], ['p', 'M3.5 16.5v-4l1.9-5a2 2 0 0 1 1.9-1.3h9.4a2 2 0 0 1 1.9 1.3l1.9 5v4z', 1], ['p', 'M3.5 12.5h17'], ['c', 7.5, 14.5, 1, 0], ['c', 16.5, 14.5, 1, 0]],
  book:       [['p', 'M5 4.5A1.5 1.5 0 0 1 6.5 3H19v15H6.5A1.5 1.5 0 0 0 5 19.5z', 1], ['p', 'M5 19.5A1.5 1.5 0 0 0 6.5 21H19v-3']],
  graduation: [['p', 'M12 4L2.5 9 12 14l9.5-5z', 1], ['p', 'M6.5 11.2V16c1.5 1.6 3.4 2.3 5.5 2.3s4-.7 5.5-2.3v-4.8M21.5 9v5']],
  dumbbell:   [['p', 'M6.5 7.5v9M17.5 7.5v9M3.5 10v4M20.5 10v4M6.5 12h11']],
  paw:        [['c', 6.8, 9.5, 1.8, 1], ['c', 10.2, 6, 1.8, 1], ['c', 13.8, 6, 1.8, 1], ['c', 17.2, 9.5, 1.8, 1], ['p', 'M12 11.5c-2.7 0-5 3.2-5 5.3 0 1.4 1 2.2 2.4 2.2 1 0 1.6-.6 2.6-.6s1.6.6 2.6.6c1.4 0 2.4-.8 2.4-2.2 0-2.1-2.3-5.3-5-5.3z', 1]],
  leaf:       [['p', 'M5 19c0-8.5 5.5-14 15-14 0 9.5-5.5 15-14 15z', 1], ['p', 'M5 19.5c3-5.5 6-8.5 10-10.5']],
  wrench:     [['p', 'M14.5 4.2a4.5 4.5 0 0 0-5.2 6l-5.6 5.6a1.9 1.9 0 0 0 2.7 2.7l5.6-5.6a4.5 4.5 0 0 0 6-5.2l-2.7 2.7-2.8-.7-.7-2.8z', 1]],
  bank:       [['p', 'M3.5 9L12 4l8.5 5z', 1], ['p', 'M5.5 10.5v6.5M9.8 10.5v6.5M14.2 10.5v6.5M18.5 10.5v6.5M3.5 19.5h17']],
  people:     [['c', 9, 8, 3.2, 1], ['p', 'M3.5 19.5c.3-3.4 2.6-5.5 5.5-5.5s5.2 2.1 5.5 5.5z', 1], ['c', 16.5, 8.5, 2.6, 1], ['p', 'M15.5 13.8c2.8-.2 4.8 1.8 5 5']],
  phone:      [['p', 'M6.6 3.5h2.6l1.5 4-2 1.4a10.6 10.6 0 0 0 6.4 6.4l1.4-2 4 1.5v2.6A2 2 0 0 1 18.4 20 15.4 15.4 0 0 1 4 5.6a2 2 0 0 1 2-2.1z', 1]],
  music:      [['p', 'M9 17.5V5.5l10-2v12'], ['c', 6.8, 17.5, 2.3, 1], ['c', 16.8, 15.5, 2.3, 1]],
  game:       [['p', 'M7.5 7.5h9a4.5 4.5 0 0 1 4.3 5.8l-1 3.4a2.4 2.4 0 0 1-4 1L14 16h-4l-1.8 1.7a2.4 2.4 0 0 1-4-1l-1-3.4A4.5 4.5 0 0 1 7.5 7.5z', 1], ['p', 'M7.5 10.5v3M6 12h3'], ['c', 15.5, 11, .9, 0], ['c', 17, 13, .9, 0]],
  shirt:      [['p', 'M8.5 3.5L3.5 6.5l1.8 3.6 2.2-1v11.4h9V9.1l2.2 1 1.8-3.6-5-3a3.5 3.5 0 0 1-7 0z', 1]],
  cake:       [['r', 4, 12, 16, 8.5, 1.8], ['p', 'M4 15.5c2 1.5 4 1.5 5.3 0 1.3 1.5 4 1.5 5.4 0 1.3 1.5 3.3 1.5 5.3 0M12 12V8.5'], ['p', 'M12 3.5c1 1 1 2 0 3-1-1-1-2 0-3z', 1]],
  receipt:    [['p', 'M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4z', 1], ['p', 'M9 8h6M9 11.5h6M9 15h3.5']],
  sparkle:    [['p', 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z', 1], ['p', 'M18.5 16v4M16.5 18h4']],
  check:      [['p', 'M5.5 12.5l4 4 9-9.5']],
  stop:       [['r', 6, 6, 12, 12, 2.5]],
  // shop aisles and products
  carrot:     [['p', 'M15.2 8.8a3 3 0 0 0-4.2 0L4.3 19.7l11-6.7a3 3 0 0 0-.1-4.2z', 1], ['p', 'M15 9l3.5-3.5M15.5 6.5V3.8M17.5 8.5h2.7']],
  bread:      [['p', 'M5 11.5A3.5 3.5 0 0 1 7.5 5h9a3.5 3.5 0 0 1 2.5 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 19z', 1]],
  milk:       [['p', 'M8.5 3.5h7M8.5 6h7'], ['p', 'M8.5 6l-2 3.5V19a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5V9.5l-2-3.5z', 1], ['p', 'M6.5 12.5h11']],
  meat:       [['p', 'M6 8.5C7.5 5 11.5 4 15 5s5.5 4 5 7.5-3.5 6-7.5 6.5S6 20 5 17.5 4.5 12 6 8.5z', 1], ['c', 15, 10.5, 1.6, 0]],
  drumstick:  [['p', 'M14.5 3.5a6 6 0 0 1 2.4 11.5c-1.6.7-3.3.6-4.6-.1l-3.2 3.2a1.8 1.8 0 1 1-2.6-.2 1.8 1.8 0 1 1-.2-2.6l3.2-3.2c-.7-1.3-.8-3-.1-4.6A6 6 0 0 1 14.5 3.5z', 1]],
  sausage:    [['r', 3, 8.8, 18, 6.4, 3.2, 'rotate(-35 12 12)'], ['p', 'M2.6 14.3l-1.2.8M21.4 9.7l1.2-.8']],
  snowflake:  [['p', 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5L12 17.5l2.5 2']],
  jar:        [['r', 6, 7, 12, 13.5, 2.4], ['p', 'M7 3.5h10V7H7z', 1], ['p', 'M9 13h6']],
  candy:      [['c', 12, 12, 4, 1], ['p', 'M8.5 10L4 7.5v9L8.5 14M15.5 10L20 7.5v9L15.5 14']],
  bottle:     [['p', 'M10 3.5h4'], ['p', 'M10.5 3.5v3.2L8.4 10a2.5 2.5 0 0 0-.4 1.4V19a1.5 1.5 0 0 0 1.5 1.5h5A1.5 1.5 0 0 0 16 19v-7.6a2.5 2.5 0 0 0-.4-1.4l-2.1-3.3V3.5z', 1], ['p', 'M8 13.5h8']],
  cup:        [['p', 'M5 8.5h11V15a4.5 4.5 0 0 1-4.5 4.5h-2A4.5 4.5 0 0 1 5 15z', 1], ['p', 'M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3.5v2M11.5 3.5v2']],
  spray:      [['p', 'M8 9.5h6.5l1 2.5V19a1.5 1.5 0 0 1-1.5 1.5H8.5A1.5 1.5 0 0 1 7 19v-7z', 1], ['p', 'M9.5 9.5v-3h3.5l2.5 1.5M9.5 6.5L7.5 5M18 6.5h2M18 9h2M18 4h2']],
  soap:       [['p', 'M10 3.5h4.5M12 3.5V7'], ['p', 'M8.5 7h7a2 2 0 0 1 2 2v9.5a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z', 1], ['p', 'M9.5 12.5h5']],
  baby:       [['p', 'M10 4.5h4V7h-4z', 1], ['p', 'M9 7h6l1 3v9a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 8 19v-9z', 1], ['p', 'M8.5 13h3M8.5 16h3']],
  cross:      [['r', 3.5, 3.5, 17, 17, 4], ['p', 'M12 8v8M8 12h8']],
  basket:     [['p', 'M3.5 9.5h17l-1.6 9a1.8 1.8 0 0 1-1.8 1.5H6.9a1.8 1.8 0 0 1-1.8-1.5z', 1], ['p', 'M8 9.5L11 4M16 9.5L13 4M9.5 13v4M14.5 13v4']],
  apple:      [['p', 'M12 7.5c-1-1-2.6-1.5-4-1.2C5 7 4 10 4.6 13.3 5.3 17 8 20.5 10.3 20.5c.8 0 1-.4 1.7-.4s.9.4 1.7.4c2.3 0 5-3.5 5.7-7.2.6-3.3-.4-6.3-3.4-7-1.4-.3-3 .2-4 1.2z', 1], ['p', 'M12 7.5c0-2 1-3.5 3-4']],
  cheese:     [['p', 'M3.5 15.5L17 6.5a5 5 0 0 1 3.5 4V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18z', 1], ['c', 9.5, 15, 1.2, 0], ['c', 15, 14, 1, 0]],
  egg:        [['p', 'M12 3.5c3.5 0 6.5 5.5 6.5 9.5a6.5 6.5 0 0 1-13 0c0-4 3-9.5 6.5-9.5z', 1]],
  fish:       [['p', 'M4 12c2.5-4 6-5.5 9.5-5.5 3.2 0 5.3 2.3 7 5.5-1.7 3.2-3.8 5.5-7 5.5C10 17.5 6.5 16 4 12z', 1], ['p', 'M4 12L2 8.5M4 12l-2 3.5'], ['c', 16, 11, 1, 0]],
  bowl:       [['p', 'M3.5 11h17a8.5 8.5 0 0 1-17 0z', 1], ['p', 'M8 8c0-1.5 1-2.5 2.5-2.5M12 7.5c0-2 1.3-3.5 3-3.5']],
  salt:       [['p', 'M8.5 8.5h7l1 11a1.5 1.5 0 0 1-1.5 1.5h-6a1.5 1.5 0 0 1-1.5-1.5z', 1], ['p', 'M9 8.5c0-2.5 1.2-4.5 3-4.5s3 2 3 4.5'], ['c', 11, 12.5, .8, 0], ['c', 13, 15, .8, 0]],
  chocolate:  [['r', 6, 3.5, 12, 17, 2], ['p', 'M6 9.2h12M6 14.8h12M12 3.5v17']],
  cookie:     [['c', 12, 12, 8.5, 1], ['c', 9, 9.5, 1.1, 0], ['c', 14.5, 8.5, 1.1, 0], ['c', 15, 14.5, 1.1, 0], ['c', 9.5, 15, 1.1, 0]],
  nut:        [['p', 'M12 3.5c2.5 0 4.5 2 4.5 4.3 0 1.5-.9 2.6-.9 4.2s.9 2.7.9 4.2c0 2.3-2 4.3-4.5 4.3s-4.5-2-4.5-4.3c0-1.5.9-2.6.9-4.2s-.9-2.7-.9-4.2C7.5 5.5 9.5 3.5 12 3.5z', 1]],
  juice:      [['p', 'M7 7.5h10V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19z', 1], ['p', 'M7 7.5L9 4h6l2 3.5M13.5 4l1-1.5H17']],
  wine:       [['p', 'M8 3.5h8l-.3 4.6a3.7 3.7 0 0 1-7.4 0z', 1], ['p', 'M12 11.8v8.7M8.5 20.5h7']],
  beer:       [['p', 'M6 7.5h10v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z', 1], ['p', 'M16 10h1.5a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H16M9.5 11v6M12.5 11v6M6 7.5C6 5.5 7.3 4 9 4h4c1.7 0 3 1.5 3 3.5']],
  roll:       [['c', 9, 9, 4.5, 1], ['p', 'M13.5 9h5.5v11.5h-10v-7'], ['c', 9, 9, 1.3, 0]],
  // trips
  train:      [['r', 5.5, 3.5, 13, 14, 3], ['p', 'M5.5 10.5h13M9 20.5l1.5-3M15 20.5l-1.5-3'], ['c', 9, 14, .9, 0], ['c', 15, 14, .9, 0]],
  bus:        [['r', 4.5, 3.5, 15, 15, 2.6], ['p', 'M4.5 10.5h15M7.5 18.5v2M16.5 18.5v2'], ['c', 8, 15, .9, 0], ['c', 16, 15, .9, 0]],
  metro:      [['r', 6, 3.5, 12, 13.5, 5], ['p', 'M6 10h12M8.5 20.5L10 17M15.5 20.5L14 17'], ['c', 9.5, 13.5, .9, 0], ['c', 14.5, 13.5, .9, 0]],
  ship:       [['p', 'M4 14.5h16l-2.2 4.4a2.5 2.5 0 0 1-2.2 1.6H8.4a2.5 2.5 0 0 1-2.2-1.6z', 1], ['p', 'M6.5 14.5v-5h11v5M10 9.5v-4h4v4']],
  bed:        [['p', 'M3 18.5v-11M3 14.5h18v4M21 14.5V12a2.5 2.5 0 0 0-2.5-2.5H11v5'], ['c', 7, 11.3, 1.7, 1]],
  boot:       [['p', 'M7 3.5h5.5V10l6 2.5a2.5 2.5 0 0 1 1.5 2.3v2.7H4.5V9z', 1], ['p', 'M4.5 20.5H20M12.5 6.5H10M12.5 9H10']],
  compass:    [['c', 12, 12, 8.5, 1], ['p', 'M15.5 8.5l-2 5-5 2 2-5z']],
  forkknife:  [['p', 'M7 3.5v17M5 3.5v5a2 2 0 0 0 4 0v-5M16.5 20.5v-17c-2 0-3.5 2.5-3.5 6.5v3.5h3.5']],
  cocktail:   [['p', 'M4.5 4.5h15L12 12.5z', 1], ['p', 'M12 12.5v8M8.5 20.5h7M15.5 4.5l2-2']],
  bag:        [['p', 'M5.5 8h13l-1 11.2a1.5 1.5 0 0 1-1.5 1.3H8a1.5 1.5 0 0 1-1.5-1.3z', 1], ['p', 'M9 10.5V7a3 3 0 0 1 6 0v3.5']],
  palm:       [['p', 'M12 21c.5-4 .5-8-1-11.5M7 21h10'], ['p', 'M11 9.5C9 6.5 5.5 6 3.5 7.5c2.5 0 5 .8 7.5 2zM11 9.5c1-3.5 4.5-5.5 7.5-4.5-2.5.5-5 2-7.5 4.5zM11 9.5c3-1 6.5 0 8 2.5-2.8-.8-5.5-1.2-8-2.5zM11 9.5C9 10 6 12 5.5 15c2-1.8 3.8-3.6 5.5-5.5z', 1]],
  mountain:   [['p', 'M3 19.5L9.5 7l4 7 2-3.5 5.5 9z', 1]],
  city:       [['r', 4, 8, 7, 12.5, 1.2], ['r', 11, 3.5, 9, 17, 1.2], ['p', 'M6.5 11.5h2M6.5 15h2M14 7.5h3M14 11h3M14 14.5h3']],
  tent:       [['p', 'M12 4L3 20h18z', 1], ['p', 'M12 4v16M12 20l-3-5.5']],
};
// strokes that sit on top of a filled shape: in "Plin" they are drawn in the background colour (cut out)
const GLYPH_CUT = new Set(['facut', 'comenzi', 'plati', 'notite', 'medicamente', 'concediu', 'birou', 'bilet', 'bagaj', 'calendar', 'trash', 'alert', 'money',
  'install', 'palette', 'pencil', 'doc', 'image', 'gift', 'home', 'briefcase', 'car', 'taxi', 'game', 'cake', 'receipt', 'milk', 'meat', 'jar', 'bottle', 'soap',
  'baby', 'cross', 'basket', 'cheese', 'salt', 'chocolate', 'cookie', 'beer', 'roll', 'train', 'bus', 'metro', 'ship', 'boot', 'compass', 'bag', 'city', 'tent', 'raion', 'harta', 'fish', 'leaf', 'stop']);
const ICON_STYLES = [['linie', 'Linie fină'], ['plin', 'Plin'], ['duo', 'Duoton'], ['insigna', 'Insignă']];   // no emoji style (the user didn't want emoji)

function iconStyle() {
  let st = 'insigna';
  try { st = (db.settings && db.settings.iconStyle) || 'insigna'; } catch (e) { /* data still loading */ }
  return ICON_STYLES.some(([k]) => k === st) ? st : 'insigna';
}

// one glyph as SVG in the given style; colours come from CSS: currentColor, and --cut for "Plin" cut-outs
function glyphSvg(key, style, cls = '') {
  const g = GLYPHS[key];
  if (!g) return '';
  const w = style === 'insigna' ? 2.1 : style === 'plin' ? 1.7 : 2;
  const inner = g.map(([t, ...a]) => {
    let el = '', closed = false, tr = '';
    if (t === 'c') { el = `<circle cx="${a[0]}" cy="${a[1]}" r="${a[2]}"`; closed = !!a[3]; }
    if (t === 'r') { el = `<rect x="${a[0]}" y="${a[1]}" width="${a[2]}" height="${a[3]}" rx="${a[4]}"`; closed = true; tr = a[5] || ''; }
    if (t === 'p') { el = `<path d="${a[0]}"`; closed = a[1] === 1; tr = typeof a[1] === 'string' ? a[1] : ''; }
    const tx = tr ? ` transform="${tr}"` : '';
    const dot = t === 'c' && a[3] === 0;
    if (style === 'plin') return closed ? `${el}${tx} fill="currentColor" stroke="currentColor" stroke-width="${w}"/>`
      : `${el}${tx} fill="${dot ? (GLYPH_CUT.has(key) ? 'var(--cut)' : 'currentColor') : 'none'}" stroke="${GLYPH_CUT.has(key) ? 'var(--cut)' : 'currentColor'}" stroke-width="${w}"/>`;
    if (style === 'duo') return closed ? `${el}${tx} fill="currentColor" fill-opacity=".2" stroke="currentColor" stroke-width="${w}"/>`
      : `${el}${tx} fill="${dot ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${w}"/>`;
    return `${el}${tx} fill="${dot ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="${w}"/>`;
  }).join('');
  return `<svg class="glyph ${cls}" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
}

// every emoji the app (or the user's old data) can show → its drawing. Unknown emoji are simply not shown.
const EMOJI_GLYPH = {
  '✅': 'facut', '✔️': 'check', '✔': 'check', '☑️': 'facut', '📦': 'comenzi', '💳': 'plati', '📝': 'notite', '🔔': 'remindere', '⏰': 'ora', '🛒': 'cumparaturi',
  '🛍️': 'bag', '🏠': 'home', '💼': 'briefcase', '❤️': 'heart', '⭐': 'star', '🎁': 'gift', '🚗': 'car', '✈️': 'vacante', '🍽️': 'forkknife', '💊': 'medicamente',
  '📚': 'book', '🎓': 'graduation', '🏋️': 'dumbbell', '🐾': 'paw', '🌿': 'leaf', '🔧': 'wrench', '📄': 'doc', '📅': 'calendar', '🗓️': 'calendar', '💰': 'money',
  '💶': 'money', '💵': 'money', '🏦': 'bank', '👥': 'people', '📞': 'phone', '💡': 'bulb', '🏷️': 'raion', '📁': 'folder', '🎵': 'music', '🎮': 'game', '👕': 'shirt',
  '🎂': 'cake', '🧾': 'receipt', '🏖️': 'concediu', '🏢': 'birou', '🌱': 'leaf', '🍎': 'apple', '🧀': 'cheese', '🥚': 'egg', '🍗': 'drumstick', '🐟': 'fish',
  '🥫': 'jar', '🍚': 'bowl', '🧂': 'salt', '🍬': 'candy', '🍪': 'cookie', '🥜': 'nut', '🧃': 'juice', '🍷': 'wine', '🍺': 'beer', '🧻': 'roll', '🧹': 'spray',
  '🐶': 'paw', '🛠️': 'wrench', '🥦': 'carrot', '🥖': 'bread', '🥛': 'milk', '🥩': 'meat', '🥓': 'sausage', '🧊': 'snowflake', '🍝': 'jar', '🍫': 'chocolate',
  '🥤': 'bottle', '☕': 'cup', '🧽': 'spray', '🧴': 'soap', '👶': 'baby', '🧺': 'basket', '🔁': 'repeat', '🗑': 'trash', '🗑️': 'trash', '🕐': 'ora', '📊': 'stack',
  '📲': 'install', '⬇️': 'download', '⬆️': 'upload', '🗂️': 'stack', '💾': 'stack', '🎨': 'palette', '🌗': 'contrast', '⚠️': 'alert', '⚠': 'alert', '🚩': 'flag',
  '🧳': 'bagaj', '🏛️': 'bank', '🎫': 'bilet', '🚆': 'train', '🏨': 'bed', '📎': 'clip', '✏️': 'pencil', '🗺️': 'harta', '🚌': 'bus', '🚇': 'metro', '🚕': 'taxi',
  '⛴️': 'ship', '🥾': 'boot', '🧭': 'compass', '🍸': 'cocktail', '🏝️': 'palm', '🏔️': 'mountain', '⛷️': 'snowflake', '🏙️': 'city', '🗼': 'city', '🗽': 'city',
  '🕌': 'city', '🌴': 'palm', '🚢': 'ship', '🏕️': 'tent', '🎡': 'star', '📍': 'harta', '🖼️': 'image', '🎉': 'sparkle', '😎': 'azi', '☀️': 'azi', '📋': 'liste',
  '⏹': 'stop', '⏹️': 'stop', '💸': 'money', '📆': 'calendar', '🔍': 'search', '➕': 'plus', '❗': 'alert', '‼️': 'alert', '🤷': 'search', '🍳': 'forkknife',
  '💉': 'medicamente', '🩹': 'cross', '🧼': 'soap', '🧷': 'clip', '🔑': 'raion', '🏃': 'boot', '🚲': 'boot', '🚉': 'train', '🛫': 'vacante', '🛬': 'vacante',
};
// the drawing a list gets (from its kind or its old emoji); never an emoji on screen
function catGlyph(c) {
  if (!c) return 'folder';
  if (c.glyph && GLYPHS[c.glyph]) return c.glyph;
  if (c.kind === 'meds') return 'medicamente';
  if (c.kind === 'shopping') return 'cumparaturi';
  if (c.kind === 'trips') return 'vacante';
  if (c.kind === 'app') return /birou/.test(c.appUrl || '') ? 'birou' : 'concediu';
  return EMOJI_GLYPH[c.icon] || EMOJI_GLYPH[String(c.icon || '').replace(/️/g, '')] || 'folder';
}
function catIconHtml(c, extraCls = '') {
  const st = iconStyle();
  return `<div class="caticon gl-${st} ${extraCls}" style="--c:${colorOf(c)}">${glyphSvg(catGlyph(c), st)}</div>`;
}
function catTitleIcon(c) {
  const st = iconStyle();
  return `<span class="emo glt gl-${st}" style="--c:${colorOf(c)}">${glyphSvg(catGlyph(c), st)}</span>`;
}
// bottom bar: the chosen style (Insignă uses the thin line there; coloured squares would be too loud in the bar)
const TAB_GLYPH = { today: 'azi', lists: 'liste', reminders: 'remindere', settings: 'setari' };
function tabIconHtml(id) {
  const st = iconStyle();
  return glyphSvg(TAB_GLYPH[id], st === 'insigna' ? 'linie' : st, 'tabglyph');
}

// ---------- no emoji on screen: every emoji in the page text becomes a small line drawing ----------
const EMOJI_RE = /(?:[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{2712}\u{2716}-\u{2753}\u{2755}-\u{27BF}\u{2B50}\u{2B06}\u{2B07}\u{23E9}-\u{23FF}\u{231A}\u{231B}\u{203C}])\u{FE0F}?/gu;
function inlineGlyph(doc, key) {
  const span = doc.createElement('span');
  span.className = 'ig';
  span.innerHTML = glyphSvg(key, 'linie');
  return span;
}
function emojiToGlyphs(root) {
  if (!root) return;
  const doc = root.ownerDocument || document;
  const w = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const hits = [];
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    EMOJI_RE.lastIndex = 0;
    if (EMOJI_RE.test(n.nodeValue) && !n.parentElement?.closest('input,textarea,script,style,svg,option,title')) hits.push(n);
  }
  for (const n of hits) {
    const frag = doc.createDocumentFragment();
    const text = n.nodeValue;
    let last = 0;
    EMOJI_RE.lastIndex = 0;
    for (let m = EMOJI_RE.exec(text); m; m = EMOJI_RE.exec(text)) {
      if (m.index > last) frag.appendChild(doc.createTextNode(text.slice(last, m.index)));
      const key = EMOJI_GLYPH[m[0]] || EMOJI_GLYPH[m[0].replace(/️/g, '')];
      if (key) frag.appendChild(inlineGlyph(doc, key));
      last = m.index + m[0].length;
    }
    if (last < text.length) frag.appendChild(doc.createTextNode(text.slice(last)));
    n.parentNode.replaceChild(frag, n);
  }
  // <option> texts can't hold drawings: the emoji is simply removed there
  root.querySelectorAll?.('option').forEach(o => { EMOJI_RE.lastIndex = 0; if (EMOJI_RE.test(o.textContent)) o.textContent = o.textContent.replace(EMOJI_RE, '').trim(); });
}
// watch the page: whatever gets drawn (screens, sheets, toasts, the bottom bar) has its emoji replaced right away
function watchEmoji(doc) {
  // runs right after each change, before the screen is painted, so an emoji never flashes on screen
  // (our own replacements trigger one more pass, which finds nothing and stops)
  emojiToGlyphs(doc.body);
  new MutationObserver(() => emojiToGlyphs(doc.body)).observe(doc.body, { childList: true, subtree: true, characterData: true });
}
if (document.body) watchEmoji(document); else document.addEventListener('DOMContentLoaded', () => watchEmoji(document));
