/**
 * StudyPulse: Subtle Interactive Particle & Network Background
 * 
 * Minimal, performant, and accessible canvas-based particle network.
 * Features:
 * - Subtle ambient drift with faint organic connecting lines
 * - Gentle mouse proximity reaction (repulsion + faint connecting lines)
 * - HiDPI / Retina display crisp scaling
 * - Full accessibility: respects 'prefers-reduced-motion' (renders static constellations)
 * - Battery & CPU friendly: pauses animation when tab is inactive (document.hidden)
 * - Dynamic particle count scaled to viewport area
 */

export class ParticleNetwork {
  constructor(canvasId = 'particleNetworkCanvas') {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) {
      console.warn(`[ParticleNetwork] Canvas #${canvasId} not found in DOM.`);
      return;
    }

    this.ctx = this.canvas.getContext('2d', { alpha: true });
    if (!this.ctx) return;

    this.particles = [];
    this.animId = null;
    this.isRunning = false;
    this.width = 0;
    this.height = 0;
    this.dpr = 1;

    // Mouse tracking state
    this.mouse = {
      x: -9999,
      y: -9999,
      active: false,
      radius: 130
    };

    // Accessibility motion preference
    this.mediaQueryMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    this.reducedMotion = this.mediaQueryMotion.matches;

    // Harmonious StudyPulse palette [r, g, b]
    this.palette = [
      { rgb: '99, 102, 241', weight: 0.65 },  // Primary Electric Indigo (#6366F1)
      { rgb: '139, 92, 246', weight: 0.20 }, // Soft Violet (#8B5CF6)
      { rgb: '6, 182, 212',  weight: 0.15 }  // Subtle Cyan (#06B6D4)
    ];

    this.init();
  }

  init() {
    this.handleResize();
    this.bindEvents();
    this.createParticles();

    if (this.reducedMotion) {
      this.renderStaticFrame();
    } else {
      this.start();
    }
  }

  bindEvents() {
    // Resize with debouncing
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.handleResize();
        this.createParticles();
        if (this.reducedMotion) {
          this.renderStaticFrame();
        }
      }, 150);
    }, { passive: true });

    // Interactive mouse tracking
    window.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
      this.mouse.active = true;
    }, { passive: true });

    window.addEventListener('mouseleave', () => {
      this.mouse.active = false;
      this.mouse.x = -9999;
      this.mouse.y = -9999;
    }, { passive: true });

    // Page visibility to prevent CPU/battery drain on background tabs
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.pause();
      } else if (!this.reducedMotion) {
        this.resume();
      }
    });

    // Dynamic preference change listener
    this.mediaQueryMotion.addEventListener('change', (e) => {
      this.reducedMotion = e.matches;
      if (this.reducedMotion) {
        this.pause();
        this.renderStaticFrame();
      } else {
        this.start();
      }
    });
  }

  handleResize() {
    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);

    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;

    this.ctx.setTransform(1, 0, 0, 1, 0, 0); // reset scale
    this.ctx.scale(this.dpr, this.dpr);

    // Adjust interaction radius based on viewport width
    this.mouse.radius = this.width < 768 ? 95 : 135;
    this.maxConnectDist = this.width < 768 ? 95 : 125;
  }

  getRandomColor() {
    const rand = Math.random();
    let accumulated = 0;
    for (const item of this.palette) {
      accumulated += item.weight;
      if (rand <= accumulated) return item.rgb;
    }
    return this.palette[0].rgb;
  }

  createParticles() {
    // Dynamic density: ~1 particle per 26,000 px^2, clamped between 28 and 68
    const count = Math.min(68, Math.max(28, Math.floor((this.width * this.height) / 26000)));
    this.particles = [];

    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
        radius: Math.random() * 1.1 + 1.2, // 1.2px - 2.3px
        baseAlpha: Math.random() * 0.35 + 0.25, // 0.25 - 0.60
        pulseSpeed: Math.random() * 0.02 + 0.008,
        pulseVal: Math.random() * Math.PI * 2,
        rgb: this.getRandomColor()
      });
    }
  }

  renderStaticFrame() {
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawNetwork(false);
  }

  drawNetwork(isAnimated = true) {
    const pLen = this.particles.length;
    const maxDist = this.maxConnectDist;
    const mouseRadius = this.mouse.radius;
    const isMouseActive = this.mouse.active && !this.reducedMotion;

    // 1. Draw connecting lines between nearby particles
    for (let i = 0; i < pLen; i++) {
      const p1 = this.particles[i];

      for (let j = i + 1; j < pLen; j++) {
        const p2 = this.particles[j];
        const dx = p1.x - p2.x;
        const dy = p1.y - p2.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < maxDist * maxDist) {
          const dist = Math.sqrt(distSq);
          // Very soft line alpha (max ~0.14) so it stays purely ambient and non-distracting
          const alpha = (1 - dist / maxDist) * 0.14;

          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(p2.x, p2.y);
          this.ctx.strokeStyle = `rgba(99, 102, 241, ${alpha})`;
          this.ctx.lineWidth = 0.8;
          this.ctx.stroke();
        }
      }

      // 2. Faint connection and subtle physics with mouse cursor
      if (isMouseActive) {
        const mdx = p1.x - this.mouse.x;
        const mdy = p1.y - this.mouse.y;
        const mDistSq = mdx * mdx + mdy * mdy;

        if (mDistSq < mouseRadius * mouseRadius) {
          const mDist = Math.sqrt(mDistSq);
          const mouseLineAlpha = (1 - mDist / mouseRadius) * 0.22;

          this.ctx.beginPath();
          this.ctx.moveTo(p1.x, p1.y);
          this.ctx.lineTo(this.mouse.x, this.mouse.y);
          this.ctx.strokeStyle = `rgba(129, 140, 248, ${mouseLineAlpha})`;
          this.ctx.lineWidth = 1.0;
          this.ctx.stroke();

          // Subtle, smooth repulsion nudge to bring natural fluidity
          if (mDist > 1 && isAnimated) {
            const force = (1 - mDist / mouseRadius) * 0.35;
            p1.x += (mdx / mDist) * force;
            p1.y += (mdy / mDist) * force;
          }
        }
      }
    }

    // 3. Draw individual particle nodes
    for (let i = 0; i < pLen; i++) {
      const p = this.particles[i];

      // Update position & subtle pulsation if animating
      if (isAnimated) {
        p.x += p.vx;
        p.y += p.vy;
        p.pulseVal += p.pulseSpeed;

        // Wrap around viewport edges with subtle margin
        const pad = 12;
        if (p.x < -pad) p.x = this.width + pad;
        else if (p.x > this.width + pad) p.x = -pad;

        if (p.y < -pad) p.y = this.height + pad;
        else if (p.y > this.height + pad) p.y = -pad;
      }

      const pulseAlpha = p.baseAlpha + Math.sin(p.pulseVal) * 0.12;
      const finalAlpha = Math.max(0.12, Math.min(0.75, pulseAlpha));

      // Crisp circular node with soft ambient aura
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(${p.rgb}, ${finalAlpha})`;
      this.ctx.fill();
    }
  }

  animate() {
    if (!this.isRunning) return;

    this.ctx.clearRect(0, 0, this.width, this.height);
    this.drawNetwork(true);

    this.animId = requestAnimationFrame(() => this.animate());
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.animate();
  }

  pause() {
    this.isRunning = false;
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
  }

  resume() {
    if (!this.isRunning && !this.reducedMotion) {
      this.start();
    }
  }

  destroy() {
    this.pause();
    this.ctx.clearRect(0, 0, this.width, this.height);
    this.particles = [];
  }
}
