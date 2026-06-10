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
      
      const versionValidation = this.validateCapsuleVersion(data);
      if (!versionValidation.valid) {
        this.showCapsuleLoadError(versionValidation.errors);
        return;
      }

      const validation = CapsuleModel.validate(data);
      if (!validation.valid) {
        this.showCapsuleLoadError(validation.errors);
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

  validateCapsuleVersion(capsule) {
    const errors = [];
    
    if (!capsule) {
      errors.push('文件为空');
      return { valid: false, errors };
    }
    
    if (!capsule.version) {
      errors.push('缺少版本号，可能是不兼容的旧版本胶囊文件');
      return { valid: false, errors };
    }
    
    if (StorageUtils.compareVersions(capsule.version, StorageUtils.MIN_SUPPORTED_CAPSULE_VERSION) < 0) {
      errors.push(`胶囊文件版本(${capsule.version})过低，最低支持版本为v${StorageUtils.MIN_SUPPORTED_CAPSULE_VERSION}`);
      return { valid: false, errors };
    }
    
    if (StorageUtils.compareVersions(capsule.version, StorageUtils.CAPSULE_VERSION) > 0) {
      errors.push(`胶囊文件版本(${capsule.version})过高，请更新工具到最新版本`);
      return { valid: false, errors };
    }
    
    return { valid: true, errors };
  },

  showCapsuleLoadError(errors) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 style="color: var(--color-error);">❌ 无法加载胶囊文件</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: var(--radius-md); padding: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
          <h3 style="color: var(--color-error); margin-bottom: var(--spacing-md);">错误原因：</h3>
          <ul style="color: var(--color-text-primary); margin-left: var(--spacing-lg);">
            ${errors.map(e => `<li>${e}</li>`).join('')}
          </ul>
        </div>
        
        <div style="background: var(--color-bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-md);">
          <p style="color: var(--color-text-muted); font-size: 0.9rem;">
            💡 <strong>建议：</strong>请确保使用的是从本工具导出的胶囊文件，当前支持的胶囊文件版本为 v${StorageUtils.MIN_SUPPORTED_CAPSULE_VERSION} 到 v${StorageUtils.CAPSULE_VERSION}。
          </p>
        </div>

        <button class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-lg);" id="close-error-modal">
          知道了
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => document.body.removeChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#close-error-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
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
          <span class="recipient-email">${this.escapeHtml(r.email)}</span>
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
          接收者: <strong style="color: var(--color-text-primary);">${this.escapeHtml(recipient.email)}</strong>
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
