/*
 * Portfolio copy of nsyte.com (Enright Design Foundry).
 * - Every demo / free-trial button opens a "glad you liked my work" popout with the contact form.
 * - The contact forms come to Jim instead of going to Webflow.
 * - The Resume link opens Jim's resume in a lightbox, like RESUME on the main site.
 * - The videos wait to be scrolled to, then play from the start (see "videos" below).
 */
(function () {
  'use strict'

  // Form delivery. Paste a form relay endpoint here to have messages arrive in the inbox directly.
  // Left empty, submitting opens the visitor's email app with the message already filled in.
  var FORM_ENDPOINT = ''
  var FORM_ACCESS_KEY = '' // only some relays need this (it is safe to be public)
  var EMAIL = 'pmenright@gmail.com'
  var POPOUT_TITLE = "I'm glad you liked my work. Let's talk about your project!"
  var ASSETS = (document.currentScript && document.currentScript.src || '').replace(/[^/]*$/, '')

  // ---------- forms ----------
  function labelFor(form, el) {
    var label = el.id && form.querySelector('label[for="' + el.id + '"]')
    var text = label ? label.textContent : el.getAttribute('data-name') || el.name || 'Field'
    return text.replace('*', '').trim()
  }

  function fieldsOf(form) {
    var out = []
    form.querySelectorAll('input, textarea, select').forEach(function (el) {
      if (el.type === 'submit' || el.type === 'button' || (el.type === 'hidden' && !el.value)) return
      if ((el.type === 'checkbox' || el.type === 'radio') && !el.checked) return
      out.push({ label: labelFor(form, el), value: el.value, type: el.type })
    })
    return out
  }

  function show(form, ok, note) {
    var block = form.closest('.w-form')
    var done = block.querySelector('.w-form-done')
    var fail = block.querySelector('.w-form-fail')
    if (ok) {
      if (note) done.firstElementChild.textContent = note
      form.style.display = 'none'
      done.style.display = 'block'
      fail.style.display = 'none'
    } else {
      fail.style.display = 'block'
    }
  }

  function sendByEmailApp(form, fields) {
    var name = fields.filter(function (f) { return /name/i.test(f.label) })[0]
    var subject = 'Portfolio (Nsyte) message' + (name && name.value ? ' from ' + name.value : '')
    var body = fields.map(function (f) { return f.label + ':\n' + f.value }).join('\n\n')
    window.location.href = 'mailto:' + EMAIL + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body)
    show(form, true, 'Thanks!')
  }

  function sendByRelay(form, fields) {
    var data = new FormData()
    if (FORM_ACCESS_KEY) data.append('access_key', FORM_ACCESS_KEY)
    data.append('subject', 'Portfolio (Nsyte) message')
    fields.forEach(function (f) {
      data.append(f.label, f.value)
      if (f.type === 'email') data.append('email', f.value) // lets you hit Reply
    })
    var button = form.querySelector('[type="submit"]')
    var label = button && button.value
    if (button) button.value = button.getAttribute('data-wait') || 'Please wait...'
    fetch(FORM_ENDPOINT, { method: 'POST', body: data, headers: { Accept: 'application/json' } })
      .then(function (r) { if (!r.ok) throw new Error(r.status); show(form, true, 'Thanks!') })
      .catch(function () { show(form, false) })
      .then(function () { if (button) button.value = label })
  }

  // Runs before Webflow's own form handler and stops it, so nothing is sent to Webflow.
  window.addEventListener('submit', function (e) {
    var form = e.target
    if (!form.closest || !form.closest('.w-form')) return
    e.preventDefault()
    e.stopImmediatePropagation()
    var fields = fieldsOf(form)
    if (FORM_ENDPOINT) sendByRelay(form, fields)
    else sendByEmailApp(form, fields)
  }, true)

  // ---------- popout ----------
  var popout, panel, lastFocus, hideTimer

  function build() {
    var source = document.getElementById('wf-form-Contact-Us')
    if (!source) return
    var block = source.closest('.w-form').cloneNode(true)
    block.querySelectorAll('[id]').forEach(function (el) { el.id = 'Popout-' + el.id })
    block.querySelectorAll('label[for]').forEach(function (el) { el.htmlFor = 'Popout-' + el.htmlFor })
    block.querySelectorAll('[data-wf-page-id],[data-wf-element-id]').forEach(function (el) {
      el.removeAttribute('data-wf-page-id')
      el.removeAttribute('data-wf-element-id')
    })

    popout = document.createElement('div')
    popout.className = 'mirror-popout'
    popout.hidden = true
    // Jim's anvil mark beside the form says plainly that this is the portfolio talking, not Nsyte.
    popout.innerHTML =
      '<div class="mirror-popout__panel" role="dialog" aria-modal="true" aria-labelledby="mirror-popout-title">' +
      '<button type="button" class="mirror-popout__close" aria-label="Close">×</button>' +
      '<div class="mirror-popout__brand"><img alt="Enright Design Foundry" width="67" height="82"></div>' +
      '<div class="mirror-popout__body"><h2 id="mirror-popout-title" class="heading-6 mirror-popout__title"></h2></div>' +
      '</div>'
    panel = popout.firstElementChild
    panel.querySelector('.mirror-popout__brand img').src = ASSETS + 'edf-logo.svg'
    panel.querySelector('h2').textContent = POPOUT_TITLE
    panel.querySelector('.mirror-popout__body').appendChild(block)
    document.body.appendChild(popout)

    popout.addEventListener('click', function (e) {
      if (e.target === popout || e.target.closest('.mirror-popout__close')) close()
    })
    // keep the page behind still while the popout is up (the panel itself can still scroll)
    var still = function (e) { if (!panel.contains(e.target)) e.preventDefault() }
    popout.addEventListener('wheel', still, { passive: false })
    popout.addEventListener('touchmove', still, { passive: false })
  }

  function setPageInert(on) {
    Array.prototype.forEach.call(document.body.children, function (el) {
      if (el === popout || el === resume || el.classList.contains('nopointerevents') || el.tagName === 'SCRIPT') return
      if (on) el.setAttribute('inert', '')
      else el.removeAttribute('inert')
    })
  }

  function open() {
    if (!popout) build()
    if (!popout) return
    // fresh form each time
    var form = panel.querySelector('form')
    form.reset()
    form.style.display = ''
    panel.querySelector('.w-form-done').style.display = 'none'
    panel.querySelector('.w-form-fail').style.display = 'none'

    clearTimeout(hideTimer) // reopening right after closing must not be undone by the close
    lastFocus = document.activeElement
    popout.hidden = false
    setPageInert(true)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { popout.classList.add('is-open') })
    })
    var first = panel.querySelector('input:not([type="submit"]), textarea')
    if (first) first.focus({ preventScroll: true })
  }

  function close() {
    if (!popout || popout.hidden) return
    popout.classList.remove('is-open')
    setPageInert(false)
    var done = function () { popout.hidden = true }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done()
    else hideTimer = setTimeout(done, 250)
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true })
  }

  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return
    if (resume && !resume.hidden) {
      if (!resumePopup.hidden) closeResumePopup()
      else closeResume()
    } else if (popout && !popout.hidden) close()
  })

  // Demo / trial buttons
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('[data-mirror-popout]')
    if (!link) return
    e.preventDefault()
    e.stopImmediatePropagation()
    open()
  }, true)

  // ---------- resume lightbox ----------
  // The footer's Resume link opens the resume over the page, like RESUME on the main site: its pages
  // scroll, DOWNLOAD opens a small "Download my resume" popup, × (or Esc, or a click beside the
  // pages) closes. The page list is media/resume/full/pages.json in the main site, written by
  // `npm run resume`. Without JavaScript, or if that list can't be loaded, the link opens the PDF.
  var SITE_ROOT = ASSETS + '../../' // the main site's root, from this page's assets folder
  var RESUME_PAGES = SITE_ROOT + 'media/resume/full/pages.json'
  var resume, resumeScroller, resumePopup, resumeLastFocus, resumeHideTimer
  var fromRoot = function (path) { return SITE_ROOT + path.replace(/^\//, '') }
  var srcset = function (list) {
    return list.split(',').map(function (s) { return fromRoot(s.trim()) }).join(', ')
  }

  function buildResume(data) {
    resume = document.createElement('div')
    resume.className = 'mirror-resume'
    resume.hidden = true
    resume.setAttribute('role', 'dialog')
    resume.setAttribute('aria-modal', 'true')
    resume.setAttribute('aria-label', 'Resume')
    var file = data.pdf.split('/').pop()
    var pages = data.pages.map(function (p, i) {
      return (
        '<picture>' +
        (p.avif ? '<source type="image/avif" sizes="(max-width: 1111px) 90vw, 1000px" srcset="' + srcset(p.avif) + '">' : '') +
        '<source type="image/webp" sizes="(max-width: 1111px) 90vw, 1000px" srcset="' + srcset(p.webp) + '">' +
        '<img class="mirror-resume__page" src="' + fromRoot(p.fallback) + '" width="' + p.width + '" height="' + p.height + '"' +
        ' alt="Resume, page ' + (i + 1) + ' of ' + data.pages.length + '"' + (i > 1 ? ' loading="lazy"' : '') + '>' +
        '</picture>'
      )
    }).join('')
    resume.innerHTML =
      '<div class="mirror-resume__backdrop"></div>' +
      '<div class="mirror-resume__scroller" tabindex="-1"><div class="mirror-resume__pages">' + pages + '</div></div>' +
      '<div class="mirror-resume__controls">' +
      '<button type="button" class="submit-button w-button mirror-resume__download" aria-haspopup="dialog">Download</button>' +
      '<button type="button" class="mirror-resume__close" aria-label="Close"><span aria-hidden="true">×</span></button>' +
      '</div>' +
      '<div class="mirror-resume__popup" hidden>' +
      '<div class="mirror-resume__popup-panel" role="dialog" aria-modal="true" aria-labelledby="mirror-resume-title">' +
      '<button type="button" class="mirror-popout__close mirror-resume__popup-close" aria-label="Close">×</button>' +
      '<h2 id="mirror-resume-title" class="heading-6 mirror-resume__popup-title">Download my resume</h2>' +
      '<a class="submit-button w-button mirror-resume__popup-download" download="' + file + '" href="' + fromRoot(data.pdf) + '">Download</a>' +
      '</div></div>'
    document.body.appendChild(resume)
    resumeScroller = resume.querySelector('.mirror-resume__scroller')
    resumePopup = resume.querySelector('.mirror-resume__popup')

    resume.querySelector('.mirror-resume__close').addEventListener('click', closeResume)
    resume.querySelector('.mirror-resume__download').addEventListener('click', openResumePopup)
    // a click in the dark space beside the pages closes, a click on a page doesn't
    resumeScroller.addEventListener('click', function (e) {
      if (!e.target.closest('.mirror-resume__page')) closeResume()
    })
    resumePopup.addEventListener('click', function (e) {
      if (e.target === resumePopup || e.target.closest('.mirror-resume__popup-close')) closeResumePopup()
    })
    resume.querySelector('.mirror-resume__popup-download').addEventListener('click', function () {
      setTimeout(closeResumePopup, 200) // the download has started; give it a beat, then step back
    })
    // keep the page behind still; only the pages scroll
    var still = function (e) { if (!resumeScroller.contains(e.target) || !resumePopup.hidden) e.preventDefault() }
    resume.addEventListener('wheel', still, { passive: false })
    resume.addEventListener('touchmove', still, { passive: false })
  }

  function openResume() {
    clearTimeout(resumeHideTimer)
    resumeLastFocus = document.activeElement
    resume.hidden = false
    resumePopup.hidden = true
    resumeScroller.scrollTop = 0
    setPageInert(true)
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { resume.classList.add('is-open') })
    })
    resumeScroller.focus({ preventScroll: true })
  }

  function closeResume() {
    if (!resume || resume.hidden) return
    resume.classList.remove('is-open')
    setPageInert(false)
    var done = function () { resume.hidden = true }
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) done()
    else resumeHideTimer = setTimeout(done, 400)
    if (resumeLastFocus && resumeLastFocus.focus) resumeLastFocus.focus({ preventScroll: true })
  }

  function openResumePopup() {
    resumePopup.hidden = false
    resume.querySelector('.mirror-resume__popup-download').focus({ preventScroll: true })
  }

  function closeResumePopup() {
    resumePopup.hidden = true
    resume.querySelector('.mirror-resume__download').focus({ preventScroll: true })
  }

  var resumeLoading = null
  document.addEventListener('click', function (e) {
    var link = e.target.closest && e.target.closest('[data-mirror-resume]')
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
    e.preventDefault()
    if (resume) return openResume()
    if (!resumeLoading) {
      resumeLoading = fetch(RESUME_PAGES)
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json() })
        .then(function (data) { buildResume(data); openResume() })
        .catch(function () { window.location.href = link.href }) // no page list: open the PDF
        .then(function () { resumeLoading = null })
    }
  }, true)

  // ---------- benefit icons: animate while hovered ----------
  // Hovering starts an icon's animation. The clock and the monitor (data-stop="pause") spin up to
  // speed and coast to a stop where they are when the pointer leaves, then carry on from there next
  // time. The others finish the loop they are in and stop where every part is back at rest, so they
  // never freeze mid-move.
  var SPIN_UP = 450 // ms to reach full speed
  var SPIN_DOWN = 700 // ms to coast to a stop

  // Ramps the speed (playback rate) of every animation inside an icon, with a smoothstep curve.
  // It plays and pauses them itself (Web Animations), which keeps each part exactly where it
  // stopped; handing the stop back to CSS made Chrome snap the clock hand.
  function speedControl(icon) {
    var rate = 0
    var raf = 0
    function anims() { return icon.getAnimations({ subtree: true }) }
    function set(r) {
      rate = r
      anims().forEach(function (a) { a.playbackRate = r })
    }
    function play() { anims().forEach(function (a) { a.playbackRate = rate; a.play() }) }
    function pause() { anims().forEach(function (a) { a.pause() }) }
    function ramp(to, ms, done) {
      cancelAnimationFrame(raf)
      var from = rate
      var t0 = performance.now()
      function step(now) {
        var k = Math.min(1, (now - t0) / ms)
        set(from + (to - from) * k * k * (3 - 2 * k))
        if (k < 1) raf = requestAnimationFrame(step)
        else if (done) done()
      }
      raf = requestAnimationFrame(step)
    }
    return { ramp: ramp, play: play, pause: pause }
  }

  function setUpIcons() {
    var still = window.matchMedia('(prefers-reduced-motion: reduce)')
    var canEase = typeof Element.prototype.getAnimations === 'function'
    document.querySelectorAll('.mirror-icon').forEach(function (icon) {
      var pauses = icon.getAttribute('data-stop') === 'pause'
      var master = icon.querySelector('[data-loop-master]')
      var speed = pauses && canEase ? speedControl(icon) : null
      var leaving = false
      icon.addEventListener('mouseenter', function () {
        leaving = false
        if (still.matches) return
        if (speed) {
          // start from standstill (or from wherever a coast-down got to), then spin up
          icon.classList.add('is-playing')
          speed.play()
          speed.ramp(1, SPIN_UP)
        } else {
          icon.classList.add('is-playing')
        }
      })
      icon.addEventListener('mouseleave', function () {
        if (speed) {
          speed.ramp(0, SPIN_DOWN, function () {
            speed.pause()
            icon.classList.remove('is-playing')
          })
        } else if (pauses || !master) {
          icon.classList.remove('is-playing')
        } else {
          leaving = true
        }
      })
      if (master) {
        master.addEventListener('animationiteration', function (e) {
          if (e.target === master && leaving) {
            icon.classList.remove('is-playing')
            leaving = false
          }
        })
      }
    })
  }

  // ---------- videos ----------
  // The two background videos used to autoplay on load, so by the time a visitor scrolled down to
  // one it was somewhere in the middle. Now each starts loading when it's about a screen away, plays
  // from the start once half of it is on screen, and pauses and rewinds once it's fully off screen,
  // so it starts over the next time it's reached. Its poster (behind it) is its first frame, so the
  // hand-off from still to playing doesn't show. Visitors who ask for reduced motion get the still
  // frame (Webflow paused all video for them already).
  function setUpVideos() {
    var videos = [].slice.call(document.querySelectorAll('video'))
    if (!videos.length) return
    var calm = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false }
    var play = function (v) {
      if (calm.matches) return
      var p = v.play()
      if (p && p.catch) p.catch(function () {})
    }
    if (!('IntersectionObserver' in window)) {
      videos.forEach(play)
      return
    }
    var near = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return
        e.target.preload = 'auto'
        near.unobserve(e.target)
      })
    }, { rootMargin: '100% 0px' })
    var inView = new Map()
    var watch = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target
        // Half of it on screen (or half the screen, for one taller than that).
        var shown = e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= window.innerHeight * 0.5)
        inView.set(v, shown)
        if (shown) {
          if (v.paused) play(v)
        } else if (!e.isIntersecting) {
          v.pause()
          if (v.currentTime) v.currentTime = 0
        }
      })
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] })
    videos.forEach(function (v) {
      v.autoplay = false
      v.pause()
      near.observe(v)
      watch.observe(v)
    })
    // Reduced motion switched while the page is open: stop, or pick up the one on screen. (After
    // Webflow's own handler, which pauses every video without autoplay.)
    if (calm.addEventListener) {
      calm.addEventListener('change', function () {
        setTimeout(function () {
          videos.forEach(function (v) {
            if (calm.matches) v.pause()
            else if (inView.get(v)) play(v)
          })
        }, 0)
      })
    }
  }

  function ready() {
    build()
    setUpIcons()
    setUpVideos()
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready)
  else ready()
})()
