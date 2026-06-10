const TimeUtils = {
  formatTimestamp(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  formatDateForInput(timestamp) {
    const date = new Date(timestamp * 1000);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  },

  getCurrentTimestamp() {
    return Math.floor(Date.now() / 1000);
  },

  parseDateInput(dateString) {
    return Math.floor(new Date(dateString).getTime() / 1000);
  },

  getCountdown(unlockAt) {
    const now = this.getCurrentTimestamp();
    const diff = unlockAt - now;

    if (diff <= 0) {
      return { days: 0, hours: 0, minutes: 0, seconds: 0, isUnlocked: true };
    }

    const days = Math.floor(diff / (24 * 60 * 60));
    const hours = Math.floor((diff % (24 * 60 * 60)) / (60 * 60));
    const minutes = Math.floor((diff % (60 * 60)) / 60);
    const seconds = diff % 60;

    return { days, hours, minutes, seconds, isUnlocked: false, totalSeconds: diff };
  },

  formatCountdown(countdown) {
    if (countdown.isUnlocked) {
      return '已解锁';
    }
    const parts = [];
    if (countdown.days > 0) parts.push(`${countdown.days}天`);
    if (countdown.hours > 0 || countdown.days > 0) parts.push(`${countdown.hours}时`);
    if (countdown.minutes > 0 || countdown.hours > 0 || countdown.days > 0) parts.push(`${countdown.minutes}分`);
    parts.push(`${countdown.seconds}秒`);
    return parts.join(' ');
  },

  isFutureDate(timestamp) {
    return timestamp > this.getCurrentTimestamp();
  },

  isDateUnlocked(unlockAt) {
    return this.getCurrentTimestamp() >= unlockAt;
  },

  generateRandomCode(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  },

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

window.TimeUtils = TimeUtils;
