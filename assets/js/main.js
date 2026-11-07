/* =====================================================================
   KOMANSU — "The Living Blueprint" interaction engine
   Vanilla JS, no build step. Every module is self-contained and
   no-ops when its markup is missing from the current page.

   Modules
     Boot ............ preloader (once per session) + iris page transitions
     Scroll .......... Lenis smooth scroll (optional) + header state
     Sentinel ........ spring-tracked CCTV camera, volumetric beam, spotlight
     IVA cursor ...... crosshair + AI detection box with typed labels
     Tripwires ....... section arming on scroll / cursor crossing
     Counters, Magnetic, Tilt, Topology, FireLoop, Gate, Morph,
     Process, Lightbox/Wall, Filters, Form, Tickers, Menu
   ===================================================================== */
(() => {
  'use strict';

  const d = document;
  const html = d.documentElement;
  const $ = (s, c = d) => c.querySelector(s);
  const $$ = (s, c = d) => Array.from(c.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const REDUCE = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const store = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();

  /** Shared pointer / scroll state read by the render loop */
  const S = {
    mx: innerWidth / 2, my: innerHeight * 0.55,
    pmy: innerHeight * 0.55,
    moved: false, lastMove: -1e9, pointerIn: false,
    tapX: null, tapY: null,
    vw: innerWidth, vh: innerHeight,
  };
  addEventListener('resize', () => { S.vw = innerWidth; S.vh = innerHeight; }, { passive: true });

  /* Arm (reveal) a section once */
  const arm = (el) => el && !el.classList.contains('armed') && el.classList.add('armed');

  /* ------------------------------------------------------------------
     BOOT: preloader + iris blades + page transitions
     ------------------------------------------------------------------ */
  function buildBlades(svg, n = 8) {
    if (!svg || svg.dataset.built) return;
    svg.dataset.built = '1';
    const ns = 'http://www.w3.org/2000/svg';
    const clipId = 'kmIrisClip' + Math.random().toString(36).slice(2, 6);
    const defs = d.createElementNS(ns, 'defs');
    defs.innerHTML = `<clipPath id="${clipId}"><circle r="95"/></clipPath>`;
    svg.appendChild(defs);
    const g = d.createElementNS(ns, 'g');
    g.setAttribute('clip-path', `url(#${clipId})`);
    for (let i = 0; i < n; i++) {
      const p = d.createElementNS(ns, 'path');
      p.setAttribute('class', 'blade');
      p.setAttribute('d', 'M-14 -110 L92 -70 L8 6 Z');
      p.style.transform = `rotate(${i * (360 / n)}deg)`;
      p.dataset.base = String(i * (360 / n));
      g.appendChild(p);
    }
    svg.appendChild(g);
  }
  const setBlades = (svg, open) =>
    $$('.blade', svg).forEach((b) => {
      const r = +b.dataset.base;
      b.style.transform = open ? `rotate(${r + 34}deg) translate(0px, -64px)` : `rotate(${r}deg)`;
    });

  let onBooted = [];
  const whenBooted = (fn) => (html.classList.contains('is-booting') ? onBooted.push(fn) : fn());

  function initBoot() {
    const pre = $('[data-preloader]');
    if (!pre || !html.classList.contains('is-booting')) return;
    const blades = $('[data-iris-blades]', pre);
    buildBlades(blades);
    const log = $('[data-boot-log]', pre);
    const lines = ['Initialising ELV systems…', 'CCTV ✓', 'FAS ✓', 'PAGA ✓', 'ACCESS ✓', 'NETWORK ✓'];
    let done = false, t0 = performance.now();

    const finish = () => {
      if (done) return;
      done = true;
      setBlades(blades, true);
      setTimeout(() => pre.classList.add('is-done'), 380);
      setTimeout(() => {
        html.classList.remove('is-booting');
        store && store.setItem('km-booted', '1');
        onBooted.forEach((f) => f()); onBooted = [];
      }, 1050);
    };

    // type the boot log (whole sequence ≈ 1.5s)
    let li = 0;
    const tick = () => {
      if (done) return;
      if (li < lines.length) {
        const l = lines[li++];
        log.innerHTML += (li === 1 ? '&gt; ' + l : `<span class="ok">  ${l}</span>`) + '\n';
        setTimeout(tick, li === 1 ? 380 : 170);
      } else setTimeout(finish, Math.max(120, 1500 - (performance.now() - t0)));
    };
    setTimeout(tick, 120);

    const skip = () => finish();
    $('[data-boot-skip]', pre).addEventListener('click', skip);
    pre.addEventListener('click', skip);
    addEventListener('keydown', function k(e) { if (e.key === 'Enter' || e.key === 'Escape' || e.key === ' ') { skip(); removeEventListener('keydown', k); } });
    setTimeout(finish, 2000); // hard cap: under 2 seconds
  }

  function initIris() {
    const iris = $('[data-iris]');
    if (!iris) return;
    const blades = $('[data-iris-blades]', iris);
    buildBlades(blades);

    if (html.classList.contains('iris-arrive')) {
      setBlades(blades, false);
      requestAnimationFrame(() => {
        iris.classList.add('is-opening');
        setBlades(blades, true);
      });
      iris.addEventListener('animationend', () => { html.classList.remove('iris-arrive'); iris.classList.remove('is-opening'); }, { once: true });
    }
    if (REDUCE) return;

    d.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || !/\.html$|\/$/.test(url.pathname)) return;
      if (url.pathname === location.pathname) return; // same-page anchors handled by scroll module
      e.preventDefault();
      setBlades(blades, true);
      iris.classList.remove('is-opening');
      iris.classList.add('is-closing');
      requestAnimationFrame(() => setBlades(blades, false));
      store && store.setItem('km-nav', '1');
      setTimeout(() => { location.href = url.href; }, 560);
    });
    // back/forward cache: never come back to a closed shutter
    addEventListener('pageshow', (e) => { if (e.persisted) iris.classList.remove('is-closing'); });
  }

  /* ------------------------------------------------------------------
     SCROLL: Lenis + header state + in-page anchors
     ------------------------------------------------------------------ */
  let lenis = null;
  function initScroll() {
    if (window.Lenis && !REDUCE && FINE) {
      lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true, wheelMultiplier: 1 });
      html.classList.add('lenis');
    }
    let scrolled = null;
    const onScroll = () => {
      const s = scrollY > 40;
      if (s !== scrolled) { scrolled = s; html.classList.toggle('is-scrolled', s); }
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    d.addEventListener('click', (e) => {
      const a = e.target.closest('a[href*="#"]');
      if (!a) return;
      const url = new URL(a.href, location.href);
      if (url.pathname !== location.pathname || !url.hash) return;
      const t = d.getElementById(decodeURIComponent(url.hash.slice(1)));
      if (!t) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(t, { offset: -90, duration: 1.4 });
      else t.scrollIntoView({ behavior: REDUCE ? 'auto' : 'smooth', block: 'start' });
      history.replaceState(null, '', url.hash);
    });
  }

  /* ------------------------------------------------------------------
     POINTER tracking (shared)
     ------------------------------------------------------------------ */
  function initPointer() {
    addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' && e.pointerType !== 'pen') return;
      S.mx = e.clientX; S.my = e.clientY; S.moved = true; S.lastMove = performance.now(); S.pointerIn = true;
    }, { passive: true });
    addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') { S.tapX = e.clientX; S.tapY = e.clientY; S.lastMove = performance.now(); }
      else html.classList.add('cursor-down');
    }, { passive: true });
    addEventListener('pointerup', () => html.classList.remove('cursor-down'), { passive: true });
    d.addEventListener('mouseleave', () => { S.pointerIn = false; });
  }

  /* ------------------------------------------------------------------
     SENTINEL camera + beam (spring physics)
     ------------------------------------------------------------------ */
  const Sentinel = {
    init() {
      this.root = $('[data-sentinel]');
      this.beam = $('[data-beam]');
      if (!this.root || !this.beam || REDUCE) return;
      this.head = $('.sentinel-head', this.root);
      this.svg = $('.sentinel-svg', this.root);
      this.cone = $('.beam-cone', this.beam);
      this.core = $('.beam-core', this.beam);
      this.spot = $('.beam-spot', this.beam);
      this.grad = $('#kmBeamGrad');
      this.lit = $('.bp-grid--lit');
      this.angle = 0; this.vel = 0; this.dist = S.vh * 0.5;
      this.end = { x: S.vw / 2, y: S.vh / 2 };
      html.classList.add('has-beam');
      this.on = true;
    },
    target(t) {
      const idle = t - S.lastMove > 3000;
      if (FINE && S.pointerIn && !idle) return { x: S.mx, y: S.my };
      if (!FINE && S.tapX != null && !idle) return { x: S.tapX, y: S.tapY };
      if (!FINE) {
        // touch: follow scroll position with a gentle sweep
        const k = scrollY / 420;
        return { x: S.vw / 2 + Math.sin(k) * S.vw * 0.32, y: S.vh * 0.62 };
      }
      // idle patrol: slow pan left ↔ right
      const p = Math.sin(t / 2200);
      return { x: S.vw / 2 + p * S.vw * 0.38, y: S.vh * 0.62 + Math.cos(t / 3100) * S.vh * 0.06 };
    },
    frame(t) {
      if (!this.on) return;
      const r = this.svg.getBoundingClientRect();
      const sc = r.width / 120;
      const px = r.left + 60 * sc, py = r.top + 30 * sc;
      const T = this.target(t);
      const goal = clamp(Math.atan2(T.x - px, Math.max(T.y - py, 8)), -1.38, 1.38);
      // critically-damped-ish spring with a little lag
      this.vel += (goal - this.angle) * 0.055;
      this.vel *= 0.8;
      this.angle += this.vel;
      this.dist = lerp(this.dist, clamp(Math.hypot(T.x - px, T.y - py), 120, S.vh * 1.3), 0.12);

      this.head.style.transform = `rotate(${-this.angle}rad)`;

      const sin = Math.sin(this.angle), cos = Math.cos(this.angle);
      const lx = px + sin * 87.5 * sc, ly = py + cos * 87.5 * sc;
      const ex = px + sin * this.dist, ey = py + cos * this.dist;
      const L = Math.max(this.dist - 87.5 * sc, 1);
      const w = clamp(L * 0.24, 46, 190);
      const nx = cos, ny = -sin; // perpendicular
      const lw = 7 * sc;
      const pts = (k) => `${lx + nx * lw * k},${ly + ny * lw * k} ${ex + nx * w * k},${ey + ny * w * k} ${ex - nx * w * k},${ey - ny * w * k} ${lx - nx * lw * k},${ly - ny * lw * k}`;
      this.cone.setAttribute('points', pts(1));
      this.core.setAttribute('points', pts(0.42));
      this.grad.setAttribute('x1', lx); this.grad.setAttribute('y1', ly);
      this.grad.setAttribute('x2', ex); this.grad.setAttribute('y2', ey);
      this.spot.setAttribute('cx', ex); this.spot.setAttribute('cy', ey);
      this.spot.setAttribute('rx', w * 1.15); this.spot.setAttribute('ry', w * 0.85);
      this.end.x = ex; this.end.y = ey;
      if (this.lit) { this.lit.style.setProperty('--mx', ex + 'px'); this.lit.style.setProperty('--my', ey + 'px'); }
    },
  };

  /* ------------------------------------------------------------------
     IVA cursor: crosshair + detection box
     ------------------------------------------------------------------ */
  const IVA = {
    init() {
      if (!FINE || REDUCE) return;
      this.cur = $('[data-cursor]');
      this.box = $('[data-iva-box]');
      this.label = $('[data-iva-label]');
      if (!this.cur || !this.box) return;
      html.classList.add('has-cursor');
      this.el = null;
      this.b = { x: 0, y: 0, w: 10, h: 10 };
      this.on = true;
      const sel = this.sel = '[data-iva], a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])';
      this.sy = scrollY;
      d.addEventListener('pointerover', (e) => {
        const el = e.target.closest(sel);
        if (el !== this.el) this.set(el);
      });
      d.addEventListener('focusin', (e) => { if (e.target.matches(sel)) this.set(e.target); });
      d.addEventListener('focusout', () => { if (!S.pointerIn) this.set(null); });
    },
    describe(el) {
      if (el.dataset.iva) return el.dataset.iva;
      const conf = (96 + Math.random() * 3.8).toFixed(1) + '%';
      const tag = el.tagName;
      if (tag === 'A') return `LINK · ${conf}`;
      if (tag === 'BUTTON') return `BUTTON · CONFIDENCE ${conf}`;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return `INPUT · ${(el.labels && el.labels[0] ? el.labels[0].textContent.replace('*', '').trim().toUpperCase() : 'FIELD')}`;
      if (tag === 'SELECT') return 'SELECT · OPTIONS';
      return `OBJECT · ${conf}`;
    },
    set(el) {
      this.el = el;
      clearInterval(this.typer);
      html.classList.toggle('cursor-locked', !!el);
      if (!el) { this.box.classList.remove('is-on'); this.label.textContent = ''; return; }
      this.box.classList.add('is-on');
      const txt = this.describe(el);
      let i = 0;
      this.label.textContent = '';
      this.typer = setInterval(() => {
        this.label.textContent = txt.slice(0, ++i);
        if (i >= txt.length) clearInterval(this.typer);
      }, 18);
    },
    frame() {
      if (!this.on) return;
      // content scrolled under a still pointer: re-detect what is beneath it
      if (scrollY !== this.sy) {
        this.sy = scrollY;
        if (S.pointerIn) {
          const hit = d.elementFromPoint(S.mx, S.my);
          const el = hit ? hit.closest(this.sel) : null;
          if (el !== this.el) this.set(el);
        }
      }
      this.cur.style.transform = `translate3d(${S.mx}px, ${S.my}px, 0)`;
      this.cur.style.opacity = S.pointerIn ? 1 : 0;
      let tx, ty, tw, th;
      if (this.el && this.el.isConnected) {
        const r = this.el.getBoundingClientRect();
        const pad = r.width > 300 ? 8 : 6;
        tx = r.left - pad; ty = r.top - pad; tw = r.width + pad * 2; th = r.height + pad * 2;
      } else {
        tx = S.mx - 14; ty = S.my - 14; tw = 28; th = 28;
      }
      const b = this.b, k = 0.24;
      b.x = lerp(b.x, tx, k); b.y = lerp(b.y, ty, k); b.w = lerp(b.w, tw, k); b.h = lerp(b.h, th, k);
      this.box.style.transform = `translate3d(${b.x}px, ${b.y}px, 0)`;
      this.box.style.width = b.w + 'px';
      this.box.style.height = b.h + 'px';
    },
  };

  /* ------------------------------------------------------------------
     TRIPWIRES + section arming
     ------------------------------------------------------------------ */
  const Tripwires = {
    visible: new Set(),
    init() {
      const wires = $$('[data-tripwire]');
      wires.forEach((w) => w.appendChild(d.createElement('i')));
      const nextArm = (w) => { let n = w.nextElementSibling; while (n && !n.hasAttribute('data-arm')) n = n.nextElementSibling; return n; };

      if (REDUCE || !('IntersectionObserver' in window)) { $$('[data-arm]').forEach(arm); return; }

      const trip = (w) => {
        w.classList.remove('is-tripped'); void w.offsetWidth;
        w.classList.add('is-tripped');
        clearTimeout(w._t); w._t = setTimeout(() => w.classList.remove('is-tripped'), 1500);
      };
      this.trip = trip;

      // scroll crossing: line reaches 78% of viewport height
      const io = new IntersectionObserver((es) => es.forEach((e) => {
        if (e.isIntersecting) { trip(e.target); arm(nextArm(e.target)); }
      }), { rootMargin: '-78% 0px -22% 0px' });
      wires.forEach((w) => io.observe(w));

      // which wires are on screen (for cursor crossing)
      const vis = new IntersectionObserver((es) => es.forEach((e) => (e.isIntersecting ? this.visible.add(e.target) : this.visible.delete(e.target))));
      wires.forEach((w) => vis.observe(w));

      // fallback arming for every section
      const secIO = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { arm(e.target); secIO.unobserve(e.target); } }), { rootMargin: '0px 0px -18% 0px', threshold: 0 });
      $$('[data-arm]').forEach((s) => { if (!s.matches('[data-hero], .page-hero')) secIO.observe(s); });

      // hero arms once the system has booted
      whenBooted(() => requestAnimationFrame(() => $$('[data-hero], .page-hero').forEach(arm)));
    },
    frame() {
      if (!this.trip || !S.moved || !this.visible.size) return;
      const a = Math.min(S.pmy, S.my), b = Math.max(S.pmy, S.my);
      if (b - a < 1) return;
      this.visible.forEach((w) => {
        const y = w.getBoundingClientRect().top;
        if (y > a && y <= b && !w.classList.contains('is-tripped')) this.trip(w);
      });
    },
  };

  /* ------------------------------------------------------------------
     COUNTERS
     ------------------------------------------------------------------ */
  function initCounters() {
    const els = $$('[data-count]');
    if (!els.length) return;
    const run = (el) => {
      const to = +el.dataset.count;
      if (REDUCE) { el.textContent = to; return; }
      const dur = 1600 + Math.min(to, 500);
      const t0 = performance.now();
      const step = (t) => {
        const p = clamp((t - t0) / dur, 0, 1);
        el.textContent = Math.round(to * (1 - Math.pow(2, -10 * p)));
        if (p < 1) requestAnimationFrame(step); else el.textContent = to;
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } }), { threshold: 0.6 });
    els.forEach((el) => io.observe(el));
  }

  /* ------------------------------------------------------------------
     MAGNETIC buttons + TILT cards
     ------------------------------------------------------------------ */
  function initMagnetic() {
    if (!FINE || REDUCE) return;
    $$('.magnetic').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left, y = e.clientY - r.top;
        el.style.setProperty('--bx', ((x - r.width / 2) * 0.22).toFixed(1) + 'px');
        el.style.setProperty('--by', ((y - r.height / 2) * 0.3).toFixed(1) + 'px');
        el.style.setProperty('--hx', x + 'px');
        el.style.setProperty('--hy', y + 'px');
      });
      el.addEventListener('pointerleave', () => { el.style.setProperty('--bx', '0px'); el.style.setProperty('--by', '0px'); });
    });
  }
  function initTilt() {
    if (!FINE || REDUCE) return;
    $$('.tilt').forEach((el) => {
      let raf = 0;
      el.addEventListener('pointermove', (e) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
          el.classList.add('is-tilting');
          el.style.setProperty('--rx', ((0.5 - py) * 7).toFixed(2) + 'deg');
          el.style.setProperty('--ry', ((px - 0.5) * 9).toFixed(2) + 'deg');
          el.style.setProperty('--lx', (px * 100).toFixed(1) + '%');
          el.style.setProperty('--ly', (py * 100).toFixed(1) + '%');
        });
      });
      el.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        el.classList.remove('is-tilting');
        el.style.setProperty('--rx', '0deg'); el.style.setProperty('--ry', '0deg');
      });
    });
  }

  /* ------------------------------------------------------------------
     NETWORK TOPOLOGY: hover a service → light its node + path to core
     ------------------------------------------------------------------ */
  function initTopology() {
    const svg = $('[data-topology]');
    if (!svg) return;
    const readout = $('[data-topo-readout]');
    const names = { cctv: 'CAM', iva: 'AI', fas: 'FACP', access: 'RDR', network: 'IDF', design: 'CAD' };
    const order = Object.keys(names);
    let idx = 0, hovering = false, timer = 0;

    const light = (id) => {
      $$('.is-lit', svg).forEach((n) => n.classList.remove('is-lit'));
      if (!id) { readout && (readout.textContent = 'TRACE · STANDBY'); return; }
      $(`[data-node="${id}"]`, svg)?.classList.add('is-lit');
      $(`[data-link="${id}"]`, svg)?.classList.add('is-lit');
      if (readout) readout.textContent = `TRACE · ${names[id]} → CORE · ${(0.3 + Math.random() * 0.9).toFixed(1)} MS`;
    };
    const auto = () => {
      clearInterval(timer);
      if (REDUCE) return;
      timer = setInterval(() => { if (!hovering) light(order[idx++ % order.length]); }, 2200);
    };
    $$('[data-node-link]').forEach((card) => {
      const id = card.dataset.nodeLink;
      const on = () => { hovering = true; light(id); };
      const off = () => { hovering = false; light(null); };
      card.addEventListener('pointerenter', on); card.addEventListener('focus', on);
      card.addEventListener('pointerleave', off); card.addEventListener('blur', off);
    });
    if (REDUCE) svg.pauseAnimations && svg.pauseAnimations();
    // only animate while visible
    new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { svg.unpauseAnimations && !REDUCE && svg.unpauseAnimations(); auto(); }
      else { clearInterval(timer); svg.pauseAnimations && svg.pauseAnimations(); }
    }).observe(svg);
  }

  /* ------------------------------------------------------------------
     FIRE ALARM loop test (point-by-point)
     ------------------------------------------------------------------ */
  function initFireLoops() {
    $$('[data-fa-loop]').forEach((svg) => {
      const devs = $$('.fa-dev', svg);
      const readout = svg.dataset.readout ? $(svg.dataset.readout) : null;
      let i = 0, timer = 0;
      const pad = (n) => String(n).padStart(2, '0');
      const step = () => {
        if (i < devs.length) {
          devs.forEach((dv, k) => { dv.classList.toggle('is-on', k === i); dv.classList.toggle('is-ok', k < i); });
          if (readout) readout.textContent = `DEV ${pad(i + 1)}/${pad(devs.length)} · TESTING`;
          i++;
          timer = setTimeout(step, 360);
        } else {
          devs.forEach((dv) => { dv.classList.remove('is-on'); dv.classList.add('is-ok'); });
          if (readout) readout.innerHTML = `DEV ${pad(devs.length)}/${pad(devs.length)} · <span class="ok">LOOP OK</span>`;
          timer = setTimeout(() => { devs.forEach((dv) => dv.classList.remove('is-ok')); i = 0; step(); }, 1800);
        }
      };
      if (REDUCE) { devs.forEach((dv) => dv.classList.add('is-ok')); return; }
      new IntersectionObserver(([e]) => { clearTimeout(timer); if (e.isIntersecting) step(); }, { threshold: 0.3 }).observe(svg);
    });
  }

  /* ------------------------------------------------------------------
     ACCESS GATE: card swipe → LED green → content slides open
     ------------------------------------------------------------------ */
  function initGates() {
    $$('[data-gate]').forEach((gate) => {
      const status = $('[data-gate-status]', gate);
      let started = false;
      const open = () => {
        if (started) return;
        started = true;
        if (REDUCE) { gate.classList.add('is-open'); status && (status.textContent = 'ACCESS GRANTED'); return; }
        status && (status.textContent = 'READING CREDENTIAL…');
        gate.classList.add('is-swiping');
        setTimeout(() => {
          gate.classList.remove('is-swiping');
          gate.classList.add('is-open');
          status && (status.innerHTML = '<i class="status-dot"></i> ACCESS GRANTED');
        }, 1150);
      };
      gate.addEventListener('pointerenter', open);
      gate.addEventListener('focusin', open);
      new IntersectionObserver(([e], o) => { if (e.isIntersecting) { open(); o.disconnect(); } }, { threshold: 0.45 }).observe(gate);
      // If someone deep-links straight into a form field, never keep it locked.
      if (gate.contains(d.activeElement)) open();
    });
  }

  /* ------------------------------------------------------------------
     MORPH: blueprint → photo (touch devices reveal on scroll)
     ------------------------------------------------------------------ */
  function initMorph() {
    $$('[data-morph]').forEach((fig) => {
      $$('img', fig).forEach((img) => {
        const fail = () => fig.classList.add('no-img');
        if (img.complete && img.naturalWidth === 0 && img.currentSrc) fail();
        img.addEventListener('error', fail, { once: true });
      });
      if (!FINE && !REDUCE) {
        new IntersectionObserver(([e]) => fig.classList.toggle('is-live', e.isIntersecting), { threshold: 0.6 }).observe(fig);
      }
    });
  }

  /* ------------------------------------------------------------------
     PROCESS: scroll-pinned horizontal timeline with self-drawing cable
     ------------------------------------------------------------------ */
  const Process = {
    init() {
      this.sec = $('[data-process]');
      if (!this.sec) return;
      this.track = $('[data-process-track]', this.sec);
      this.svg = $('[data-process-cable]', this.sec);
      this.paths = $$('path', this.svg);
      this.steps = $$('.step', this.sec);
      this.stepEl = $('[data-process-step]', this.sec);
      this.bar = $('[data-process-bar]', this.sec);
      this.mq = matchMedia('(max-width: 760px)');
      this.layout();
      addEventListener('resize', () => this.layout(), { passive: true });
      d.fonts && d.fonts.ready.then(() => this.layout());
    },
    layout() {
      if (!this.track) return;
      this.active = !this.mq.matches && !REDUCE;
      if (!this.active) { this.track.style.transform = ''; this.steps.forEach((s) => s.classList.add('is-on')); return; }
      const tr = this.track.getBoundingClientRect();
      this.svg.setAttribute('viewBox', `0 0 ${tr.width} ${tr.height}`);
      const nodes = this.steps.map((s) => {
        const r = $('.step-node', s).getBoundingClientRect();
        return { x: r.left - tr.left + r.width / 2, y: r.top - tr.top + r.height / 2 };
      });
      let dStr = `M0 ${nodes[0].y} L${nodes[0].x} ${nodes[0].y}`;
      for (let i = 1; i < nodes.length; i++) {
        const a = nodes[i - 1], b = nodes[i], mid = (a.x + b.x) / 2;
        dStr += ` C${mid} ${a.y + 46} ${mid} ${b.y + 46} ${b.x} ${b.y}`;
      }
      dStr += ` L${tr.width} ${nodes[nodes.length - 1].y}`;
      this.paths.forEach((p) => p.setAttribute('d', dStr));
      this.lit = this.paths[1];
      this.len = this.lit.getTotalLength();
      this.lit.style.strokeDasharray = this.len;
      this.nodeFrac = nodes.map((n) => this.lit ? n.x / tr.width : 0);
      this.maxX = Math.max(0, tr.width - S.vw);
      this.frame(true);
    },
    frame(force) {
      if (!this.active) return;
      const r = this.sec.getBoundingClientRect();
      if (!force && (r.bottom < -50 || r.top > S.vh + 50)) return;
      const total = r.height - S.vh;
      const p = clamp(-r.top / total, 0, 1);
      if (!force && Math.abs(p - (this.p ?? -1)) < 0.0005) return;
      this.p = p;
      this.track.style.transform = `translate3d(${-p * this.maxX}px,0,0)`;
      // cable lights up to the point that sits at ~62% of the viewport
      const litX = (p * this.maxX + S.vw * 0.62);
      const tw = this.maxX + S.vw;
      const frac = clamp(litX / tw, 0, 1);
      this.lit.style.strokeDashoffset = this.len * (1 - frac);
      let on = 0;
      this.steps.forEach((s, i) => { const v = this.nodeFrac[i] <= frac + 0.005; s.classList.toggle('is-on', v); if (v) on = i + 1; });
      if (this.stepEl) this.stepEl.textContent = String(Math.max(1, on)).padStart(2, '0');
      if (this.bar) this.bar.style.transform = `scaleX(${p})`;
    },
  };

  /* ------------------------------------------------------------------
     LIGHTBOX + video wall
     ------------------------------------------------------------------ */
  function initWall() {
    const tiles = $$('[data-demo]');
    if (!tiles.length) return;
    const dlg = $('[data-lightbox]');
    const stage = $('[data-lightbox-stage]', dlg);
    const title = $('[data-lightbox-title]', dlg);
    const ext = $('[data-lightbox-ext]', dlg);

    // lazy attach preview sources when near the viewport
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      const v = $('video', e.target);
      if (v && v.dataset.lazySrc) { v.src = v.dataset.lazySrc; v.preload = 'metadata'; delete v.dataset.lazySrc; }
      io.unobserve(e.target);
    }), { rootMargin: '200px' });

    tiles.forEach((t) => {
      io.observe(t);
      const v = $('video', t);
      if (v && FINE && !REDUCE) {
        t.addEventListener('pointerenter', () => { const p = v.play(); p && p.catch(() => {}); });
        t.addEventListener('pointerleave', () => v.pause());
      }
      t.addEventListener('click', () => {
        stage.innerHTML = '';
        const src = t.dataset.src;
        if (t.dataset.demo === 'video') {
          const vid = d.createElement('video');
          vid.src = src; vid.controls = true; vid.autoplay = true; vid.playsInline = true;
          vid.setAttribute('aria-label', t.dataset.title);
          stage.appendChild(vid);
        } else {
          const f = d.createElement('iframe');
          f.src = src; f.title = t.dataset.title; f.loading = 'lazy';
          stage.appendChild(f);
        }
        title.textContent = t.dataset.title;
        ext.href = src;
        dlg.showModal ? dlg.showModal() : dlg.setAttribute('open', '');
        lenis && lenis.stop();
      });
    });
    const close = () => dlg.close ? dlg.close() : dlg.removeAttribute('open');
    $('[data-lightbox-close]', dlg).addEventListener('click', close);
    dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
    dlg.addEventListener('close', () => { stage.innerHTML = ''; lenis && lenis.start(); });
  }

  /* ------------------------------------------------------------------
     PORTFOLIO filters
     ------------------------------------------------------------------ */
  function initFilters() {
    const wrap = $('[data-filters]');
    if (!wrap) return;
    const cards = $$('[data-proj-grid] [data-sector]');
    const status = $('[data-filter-status]');
    wrap.addEventListener('click', (e) => {
      const b = e.target.closest('[data-filter]');
      if (!b) return;
      $$('[data-filter]', wrap).forEach((x) => { const on = x === b; x.classList.toggle('is-active', on); x.setAttribute('aria-pressed', on); });
      const f = b.dataset.filter;
      let n = 0;
      cards.forEach((c) => {
        const show = f === 'all' || c.dataset.sector === f;
        clearTimeout(c._t);
        if (show) {
          n++;
          c.hidden = false;
          requestAnimationFrame(() => requestAnimationFrame(() => c.classList.remove('is-out')));
        } else {
          c.classList.add('is-out');
          c._t = setTimeout(() => { c.hidden = true; }, REDUCE ? 0 : 420);
        }
      });
      if (status) status.textContent = `Showing ${n} ${n === 1 ? 'sector' : 'sectors'}`;
    });
  }

  /* ------------------------------------------------------------------
     CONTACT FORM: validation + submit morph
     ------------------------------------------------------------------ */
  function initForm() {
    const form = $('[data-form]');
    if (!form) return;
    const btn = $('[data-submit]', form);
    const status = $('[data-form-status]', form);
    const rules = {
      first_name: (v) => (v.trim() ? '' : 'Please enter your first name.'),
      email: (v) => (!v.trim() ? 'Please enter your email.' : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? '' : 'That email doesn’t look right.'),
      phone: (v) => (!v.trim() || /^[0-9+()\-\s]{7,30}$/.test(v.trim()) ? '' : 'Use digits, spaces, + or - only.'),
      details: (v) => (v.trim().length >= 10 ? '' : 'Tell us a little about the project (10+ characters).'),
    };
    const check = (el) => {
      const rule = rules[el.name];
      if (!rule) return true;
      const msg = rule(el.value);
      const field = el.closest('.field');
      const err = $('.field-err', field);
      field.classList.toggle('is-invalid', !!msg);
      field.classList.toggle('is-valid', !msg && !!el.value.trim());
      if (err) err.textContent = msg;
      if (msg) { el.setAttribute('aria-invalid', 'true'); err && el.setAttribute('aria-describedby', err.id); }
      else el.removeAttribute('aria-invalid');
      return !msg;
    };
    $$('input, textarea', form).forEach((el) => {
      el.addEventListener('blur', () => el.value && check(el));
      el.addEventListener('input', () => el.closest('.field')?.classList.contains('is-invalid') && check(el));
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const els = $$('input[name], textarea[name]', form).filter((el) => rules[el.name]);
      const bad = els.filter((el) => !check(el));
      if (bad.length) { bad[0].focus(); status.className = 'form-status is-err'; status.textContent = 'Please check the highlighted fields.'; return; }
      status.className = 'form-status'; status.textContent = 'Sending…';
      btn.classList.add('is-loading'); btn.disabled = true;
      const minWait = new Promise((r) => setTimeout(r, 900));
      let ok = false;
      try {
        const res = await fetch(form.action, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => ({}));
        ok = res.ok && data.ok !== false;
      } catch (err) { ok = false; }
      await minWait;
      btn.classList.remove('is-loading');
      if (ok) {
        btn.classList.add('is-done');
        btn.setAttribute('aria-label', 'Enquiry sent');
        status.className = 'form-status is-ok';
        status.textContent = 'Thank you — we’ll be in touch within 24 hours.';
        form.reset();
        $$('.field', form).forEach((f) => f.classList.remove('is-valid'));
      } else {
        btn.disabled = false;
        status.className = 'form-status is-err';
        status.innerHTML = 'We couldn’t send that just now. Please email <a href="mailto:info@komansu.com" style="text-decoration:underline">info@komansu.com</a>.';
      }
    });
  }

  /* ------------------------------------------------------------------
     Small live tickers: clocks, feed log, people counter, portal boot
     ------------------------------------------------------------------ */
  function initTickers() {
    const clocks = $$('[data-clock]');
    const fmt = () => new Date().toLocaleTimeString('en-GB', { hour12: false });
    if (clocks.length) { const u = () => clocks.forEach((c) => (c.textContent = fmt())); u(); setInterval(u, 1000); }

    const log = $('[data-feed-log]');
    if (log && !REDUCE) {
      const ev = ['VEHICLE · GATE-2 · 18 KM/H · LOGGED', 'PERSON · TRIPWIRE A→B · ALERT RAISED', 'PAGA · ZONE 2 · ANNOUNCEMENT QUEUED', 'ANPR · DL 3C AB 1234 · WHITELIST', 'PERSON · ZONE CLEARED · OK'];
      let i = 0;
      setInterval(() => {
        const s = d.createElement('span');
        s.textContent = `${fmt()} · ${ev[i++ % ev.length]}`;
        log.prepend(s);
        while (log.children.length > 2) log.lastElementChild.remove();
      }, 2600);
    }

    const ppl = $('[data-people]');
    if (ppl && !REDUCE) { let n = 24; setInterval(() => { n = clamp(n + Math.round(Math.random() * 4 - 2), 16, 34); ppl.textContent = String(n).padStart(3, '0'); }, 1500); }

    const portal = $('[data-portal-log]');
    if (portal && !REDUCE) {
      const lines = ['> mounting portal.kms …', '  enquiries.module ......... ok', '  project-tracker.module ... ok', '  after-sales.module ....... building', '  auth.gateway ............. queued'];
      let i = 1;
      setInterval(() => {
        portal.textContent = lines.slice(0, i).join('\n');
        i = i >= lines.length ? 1 : i + 1;
      }, 900);
    }
  }

  /* ------------------------------------------------------------------
     Mobile menu
     ------------------------------------------------------------------ */
  function initMenu() {
    const btn = $('.menu-toggle');
    const menu = $('#mobile-menu');
    if (!btn || !menu) return;
    const set = (open) => {
      btn.setAttribute('aria-expanded', open);
      btn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (open) { menu.hidden = false; requestAnimationFrame(() => menu.classList.add('is-open')); lenis && lenis.stop(); d.body.style.overflow = 'hidden'; $('a', menu).focus(); }
      else { menu.classList.remove('is-open'); setTimeout(() => { menu.hidden = true; }, 300); lenis && lenis.start(); d.body.style.overflow = ''; }
    };
    btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
    addEventListener('keydown', (e) => { if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); } });
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  }

  /* ------------------------------------------------------------------
     Footer wordmark lit by the beam
     ------------------------------------------------------------------ */
  const Wordmark = {
    init() {
      this.el = $('[data-wordmark]');
      if (!this.el) return;
      new IntersectionObserver(([e]) => { this.vis = e.isIntersecting; }).observe(this.el);
    },
    frame(t) {
      if (!this.vis) return;
      const r = this.el.getBoundingClientRect();
      let x, y;
      if (Sentinel.on && FINE && S.pointerIn) { x = S.mx; y = S.my; }
      else if (Sentinel.on) { x = Sentinel.end.x; y = Sentinel.end.y; }
      else { x = r.left + r.width * (0.5 + Math.sin(t / 1800) * 0.4); y = r.top + r.height / 2; }
      this.el.style.setProperty('--wx', (x - r.left).toFixed(0) + 'px');
      this.el.style.setProperty('--wy', (y - r.top).toFixed(0) + 'px');
    },
  };

  /* ------------------------------------------------------------------
     Render loop
     ------------------------------------------------------------------ */
  function loop(t) {
    lenis && lenis.raf(t);
    Sentinel.frame(t);
    IVA.frame();
    Tripwires.frame();
    Process.frame();
    Wordmark.frame(t);
    S.pmy = S.my; S.moved = false;
    requestAnimationFrame(loop);
  }

  /* ------------------------------------------------------------------
     Boot sequence
     ------------------------------------------------------------------ */
  const start = () => {
    initBoot();
    initIris();
    initScroll();
    initPointer();
    Sentinel.init();
    IVA.init();
    Tripwires.init();
    initCounters();
    initMagnetic();
    initTilt();
    initTopology();
    initFireLoops();
    initGates();
    initMorph();
    Process.init();
    initWall();
    initFilters();
    initForm();
    initTickers();
    initMenu();
    Wordmark.init();
    requestAnimationFrame(loop);
  };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', start); else start();
})();
