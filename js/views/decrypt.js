const DecryptView = {
  currentCapsule: null,
  countdownTimer: null,
  integrityVerified: false,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('capsule-file');

    if (uploadArea) {
      uploadArea.addEventListener('click', () => fileInput.click());

      uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
      });

      uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
      });

      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        const file = e.dataTransfer.files[0];
        if (file) this.handleFile(file);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) this.handleFile(file);
      });
    }

    const decryptBtn = document.getElementById('decrypt-btn');
    if (decryptBtn) {
      decryptBtn.addEventListener('click', () => this.handleDecrypt());
    }

    const extractCodeInput = document.getElementById('extract-code');
    if (extractCodeInput) {
      extractCodeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.handleDecrypt();
        }
      });
    }

    const verifyBtn = document.getElementById('verify-integrity');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this.verifyIntegrity());
    }
  },

  async handleFile(file) {
    try {
      const data = await FileUtils.readJSONFile(file);
      
      const validation = CapsuleModel.validate(data);
      if (!validation.valid) {
        Notification.error('无效的胶囊文件: ' + validation.errors.join(', '));
        return;
      }

      this.currentCapsule = data;
      this.integrityVerified = false;
      
      await this.renderCapsuleInfo();
      Notification.success('胶囊文件加载成功');

    } catch (error) {
      console.error('加载文件失败:', error);
      Notification.error('加载失败: ' + error.message);
    }
  },

  async renderCapsuleInfo() {
    if (!this.currentCapsule) return;

    const capsule = this.currentCapsule;
    const infoSection = document.getElementById('capsule-info');
    const decryptSection = document.getElementById('decrypt-section');

    if (this.countdownTimer) {
      this.countdownTimer.destroy();
    }

    const isUnlocked = TimeUtils.isDateUnlocked(capsule.meta.unlockAt);

    infoSection.style.display = 'block';
    decryptSection.style.display = 'block';

    document.getElementById('capsule-title-display').textContent = capsule.meta.title;
    document.getElementById('capsule-creator').textContent = capsule.meta.creator;
    document.getElementById('capsule-created').textContent = TimeUtils.formatTimestamp(capsule.meta.createdAt);
    document.getElementById('capsule-unlock').textContent = TimeUtils.formatTimestamp(capsule.meta.unlockAt);
    document.getElementById('capsule-algorithm').textContent = capsule.meta.encryption.algorithm;

    const countdownElement = document.getElementById('decrypt-countdown');
    this.countdownTimer = createCountdown(countdownElement, capsule.meta.unlockAt, {
      showLabels: true,
      large: true,
      onUnlock: () => {
        Notification.success('🎉 胶囊已解锁！现在可以输入提取码解密');
        this.updateDecryptButtonState();
      }
    });

    this.renderRecipients();
    this.updateDecryptButtonState();
    this.updateIntegrityStatus();

    document.getElementById('extract-code').value = '';
    document.getElementById('message-display').innerHTML = `
      <div class="message-locked">
        <span class="lock-icon">🔒</span>
        <p>${isUnlocked ? '胶囊已解锁，请输入提取码查看消息' : '胶囊尚未解锁，耐心等待时间到来...'}</p>
      </div>
    `;
  },

  renderRecipients() {
    if (!this.currentCapsule) return;

    const container = document.getElementById('recipients-display');
    const recipients = this.currentCapsule.recipients;

    container.innerHTML = `
      <h4>👥 接收者列表 (${recipients.length}人)</h4>
      ${recipients.map((r, index) => `
        <div class="recipient-item">
          <span class="recipient-email">${r.email}</span>
          <span class="recipient-status">#${index + 1}</span>
        </div>
      `).join('')}
    `;
  },

  updateDecryptButtonState() {
    const btn = document.getElementById('decrypt-btn');
    const isUnlocked = this.currentCapsule && TimeUtils.isDateUnlocked(this.currentCapsule.meta.unlockAt);
    
    btn.disabled = !isUnlocked || !this.integrityVerified;
    
    if (!isUnlocked) {
      btn.innerHTML = '⏳ 等待解锁';
    } else if (!this.integrityVerified) {
      btn.innerHTML = '🔍 请先验证完整性';
    } else {
      btn.innerHTML = '🔓 解密消息';
    }
  },

  async verifyIntegrity() {
    if (!this.currentCapsule) {
      Notification.warning('请先加载胶囊文件');
      return;
    }

    const verifyBtn = document.getElementById('verify-integrity');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="loading-spinner"></span> 验证中...';

    try {
      const result = await HashUtils.verifyIntegrity(this.currentCapsule);
      this.integrityVerified = result.valid;
      
      this.updateIntegrityStatus(result);
      this.updateDecryptButtonState();

      if (result.valid) {
        Notification.success('完整性验证通过，文件未被篡改');
      } else {
        Notification.error(result.error);
      }

    } catch (error) {
      console.error('验证失败:', error);
      Notification.error('验证失败: ' + error.message);
      this.updateIntegrityStatus({ valid: false, error: error.message });
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '🔍 验证完整性';
    }
  },

  updateIntegrityStatus(result) {
    const statusElement = document.getElementById('integrity-status');
    
    if (!result) {
      statusElement.style.display = 'none';
      return;
    }

    statusElement.style.display = 'flex';
    statusElement.className = `integrity-status ${result.valid ? 'verified' : 'failed'}`;
    
    statusElement.innerHTML = `
      <span style="font-size: 1.2rem;">${result.valid ? '✓' : '✕'}</span>
      <span>${result.valid ? '完整性验证通过，文件未被篡改' : result.error}</span>
    `;
  },

  async handleDecrypt() {
    if (!this.currentCapsule) {
      Notification.warning('请先加载胶囊文件');
      return;
    }

    if (!this.integrityVerified) {
      Notification.warning('请先验证文件完整性');
      return;
    }

    if (!TimeUtils.isDateUnlocked(this.currentCapsule.meta.unlockAt)) {
      Notification.warning('尚未到达解锁时间');
      return;
    }

    const extractCode = document.getElementById('extract-code').value.trim().toUpperCase();

    if (!extractCode) {
      Notification.warning('请输入提取码');
      return;
    }

    const decryptBtn = document.getElementById('decrypt-btn');
    decryptBtn.disabled = true;
    decryptBtn.innerHTML = '<span class="loading-spinner"></span> 解密中...';

    try {
      const codeHash = await HashUtils.hashExtractCode(extractCode);
      const recipient = this.currentCapsule.recipients.find(r => r.codeHash === codeHash);

      if (!recipient) {
        throw new Error('提取码错误');
      }

      const message = await AESUtils.decryptCapsuleMessage(this.currentCapsule, extractCode);

      this.showDecryptedMessage(message, recipient);

      Notification.success('解密成功！');

    } catch (error) {
      console.error('解密失败:', error);
      Notification.error(error.message);
    } finally {
      decryptBtn.disabled = false;
      decryptBtn.innerHTML = '🔓 解密消息';
    }
  },

  showDecryptedMessage(message, recipient) {
    const messageContainer = document.getElementById('message-display');
    
    messageContainer.innerHTML = `
      <div style="margin-bottom: var(--spacing-md); padding: var(--spacing-sm); background: rgba(16, 185, 129, 0.1); border-radius: var(--radius-sm); border-left: 3px solid var(--color-success);">
        <span style="color: var(--color-success);">✓</span>
        <span style="margin-left: var(--spacing-xs); color: var(--color-text-secondary); font-size: 0.9rem;">
          接收者: <strong style="color: var(--color-text-primary);">${recipient.email}</strong>
        </span>
      </div>
      <div class="message-unlocked">${this.escapeHtml(message)}</div>
    `;

    messageContainer.querySelector('.message-unlocked').classList.add('animate-unlock');
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  destroy() {
    if (this.countdownTimer) {
      this.countdownTimer.destroy();
      this.countdownTimer = null;
    }
    this.currentCapsule = null;
    this.integrityVerified = false;
  },

  reset() {
    this.destroy();
    document.getElementById('capsule-info').style.display = 'none';
    document.getElementById('decrypt-section').style.display = 'none';
    document.getElementById('integrity-status').style.display = 'none';
    document.getElementById('capsule-file').value = '';
  }
};

window.DecryptView = DecryptView;
