class CountdownTimer {
  constructor(element, unlockAt, options = {}) {
    this.element = element;
    this.unlockAt = unlockAt;
    this.options = {
      showLabels: true,
      large: false,
      onUnlock: null,
      ...options
    };
    this.intervalId = null;
    this.isUnlocked = false;
  }

  start() {
    this.update();
    this.intervalId = setInterval(() => this.update(), 1000);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  update() {
    const countdown = TimeUtils.getCountdown(this.unlockAt);
    
    if (countdown.isUnlocked && !this.isUnlocked) {
      this.isUnlocked = true;
      this.renderUnlocked();
      if (this.options.onUnlock) {
        this.options.onUnlock();
      }
      this.stop();
      return;
    }
    
    this.render(countdown);
  }

  render(countdown) {
    const isUrgent = countdown.totalSeconds && countdown.totalSeconds < 3600;
    const largeClass = this.options.large ? 'countdown-number-large' : '';
    const urgentClass = isUrgent ? 'animate-countdown-urgent' : '';
    
    this.element.innerHTML = `
      <div class="countdown-timer ${largeClass}">
        <div class="countdown-unit">
          <span class="countdown-number ${urgentClass}">${String(countdown.days).padStart(2, '0')}</span>
          ${this.options.showLabels ? '<span>天</span>' : ''}
        </div>
        <div class="countdown-unit">
          <span class="countdown-number ${urgentClass}">${String(countdown.hours).padStart(2, '0')}</span>
          ${this.options.showLabels ? '<span>时</span>' : ''}
        </div>
        <div class="countdown-unit">
          <span class="countdown-number ${urgentClass}">${String(countdown.minutes).padStart(2, '0')}</span>
          ${this.options.showLabels ? '<span>分</span>' : ''}
        </div>
        <div class="countdown-unit">
          <span class="countdown-number ${urgentClass}">${String(countdown.seconds).padStart(2, '0')}</span>
          ${this.options.showLabels ? '<span>秒</span>' : ''}
        </div>
      </div>
    `;
  }

  renderUnlocked() {
    this.element.innerHTML = `
      <div style="text-align: center;">
        <div style="font-size: 3rem; margin-bottom: 8px;">🔓</div>
        <div style="color: var(--color-success); font-size: 1.5rem; font-weight: 600;" class="animate-unlock">
          胶囊已解锁！
        </div>
      </div>
    `;
  }

  destroy() {
    this.stop();
    this.element.innerHTML = '';
  }
}

function createCountdown(element, unlockAt, options) {
  const timer = new CountdownTimer(element, unlockAt, options);
  timer.start();
  return timer;
}

window.CountdownTimer = CountdownTimer;
window.createCountdown = createCountdown;
