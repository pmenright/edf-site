/*
  /about/ used to be its own page. About and the resume are now a panel on the portfolio itself, so
  this address forwards there: "/about/" opens it on About, "/about/#resume" on the resume. (The
  page's meta refresh does the same without JavaScript.)
*/
const slide = window.location.hash === '#resume' ? '#about/resume' : '#about'
window.location.replace(import.meta.env.BASE_URL + slide)
