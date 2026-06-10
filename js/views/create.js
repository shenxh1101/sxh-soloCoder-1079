const CreateView = {
  recipients: [],
  selectedEncryption: 'AES-GCM',
  countdownTimer: null,

  init() {
    this.bindEvents();
    this.setDefaultUnlockTime();
  },

  setDefaultUnlockTime() {
    const input = document.getElementById('unlock-time');
    if (input) {
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 7);
      input.min = TimeUtils.formatDateForInput(TimeUtils.getCurrentTimestamp());
      input.value = TimeUtils.formatDateForInput(defaultDate.getTime() / 1000);
    }
  },

  bindEvents() {
    const form = document.getElementById('create-form');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSubmit(e));
    }

    const addRecipientBtn = document.getElementById('add-recipient');
    if (addRecipientBtn) {
      addRecipientBtn.addEventListener('click', () => this.addRecipient());
    }

    const recipientInput = document.getElementById('recipient-email');
    if (recipientInput) {
      recipientInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          this.addRecipient();
        }
      });
    }

    const encryptionCards = document.querySelectorAll('.encryption-card');
    encryptionCards.forEach(card => {
      card.addEventListener('click', () => {
        encryptionCards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedEncryption = card.dataset.algorithm;
      });
    });

    const previewBtn = document.getElementById('preview-capsule');
    if (previewBtn) {
      previewBtn.addEventListener('click', () => this.previewCapsule());
    }
  },

  addRecipient() {
    const input = document.getElementById('recipient-email');
    const email = input.value.trim();

    if (!email) {
      Notification.warning('请输入邮箱地址');
      return;
    }

    if (!FileUtils.validateEmail(email)) {
      Notification.error('请输入有效的邮箱地址');
      return;
    }

    if (this.recipients.includes(email)) {
      Notification.warning('该邮箱已添加');
      return;
    }

    this.recipients.push(email);
    this.renderRecipients();
    input.value = '';
  },

  removeRecipient(email) {
    this.recipients = this.recipients.filter(r => r !== email);
    this.renderRecipients();
  },

  renderRecipients() {
    const container = document.getElementById('recipients-list');
    if (!container) return;

    if (this.recipients.length === 0) {
      container.innerHTML = '<p style="color: var(--color-text-muted); font-size: 0.9rem;">还没有添加接收者</p>';
      return;
    }

    container.innerHTML = this.recipients.map(email => `
      <div class="recipient-tag">
        <span>${this.escapeHtml(email)}</span>
        <button type="button" data-email="${this.escapeHtml(email)}" aria-label="移除">×</button>
      </div>
    `).join('');

    container.querySelectorAll('.recipient-tag button').forEach(btn => {
      btn.addEventListener('click', () => {
        this.removeRecipient(btn.dataset.email);
      });
    });
  },

  async handleSubmit(e) {
    e.preventDefault();

    const title = document.getElementById('capsule-title').value.trim();
    const message = document.getElementById('capsule-message').value.trim();
    const creator = document.getElementById('creator-name').value.trim();
    const unlockTimeStr = document.getElementById('unlock-time').value;
    const isPublic = document.getElementById('is-public').checked;

    if (!message) {
      Notification.error('请输入胶囊消息');
      return;
    }

    if (!unlockTimeStr) {
      Notification.error('请设置解锁时间');
      return;
    }

    const unlockAt = TimeUtils.parseDateInput(unlockTimeStr);

    if (!TimeUtils.isFutureDate(unlockAt)) {
      Notification.error('解锁时间必须是未来的时间');
      return;
    }

    if (this.recipients.length === 0) {
      Notification.error('请至少添加一个接收者');
      return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="loading-spinner"></span> 生成中...';

    try {
      const capsule = CapsuleModel.create({
        title: title || '时间胶囊',
        message,
        creator: creator || '匿名用户',
        unlockAt,
        isPublic,
        encryption: this.selectedEncryption
      });

      const { capsule: finalizedCapsule, recipientCodes } = await CapsuleModel.finalize(
        capsule,
        message,
        this.recipients
      );

      const filename = FileUtils.generateCapsuleFilename(finalizedCapsule);
      FileUtils.downloadJSON(finalizedCapsule, filename);

      StorageUtils.addMyCapsule(finalizedCapsule.id, finalizedCapsule, recipientCodes);
      localStorage.setItem(`capsule_${finalizedCapsule.id}`, JSON.stringify(finalizedCapsule));
      
      if (finalizedCapsule.meta.isPublic && window.PlazaView) {
        window.PlazaView.addCapsule(finalizedCapsule);
      }
      
      if (window.LibraryView) {
        window.LibraryView.addCapsule(finalizedCapsule);
      }

      this.showExtractedCodes(finalizedCapsule, recipientCodes, filename);

      Notification.success('胶囊创建成功！文件已下载');

    } catch (error) {
      console.error('创建胶囊失败:', error);
      Notification.error('创建失败: ' + error.message);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '✨ 创建时间胶囊';
    }
  },

  showExtractedCodes(capsule, recipientCodes, filename) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>🎉 胶囊创建成功！</h2>
          <button class="modal-close">&times;</button>
        </div>
        <p style="color: var(--color-text-secondary); margin-bottom: var(--spacing-md);">
          文件名: <code style="background: var(--color-bg-glass); padding: 2px 6px; border-radius: 4px;">${filename}</code>
        </p>
        <p style="color: var(--color-warning); margin-bottom: var(--spacing-lg); font-size: 0.9rem;">
          ⚠️ 请妥善保管以下提取码和下载的JSON文件，提取码只显示一次！
        </p>
        <div class="extract-codes-display">
          ${recipientCodes.map(rc => `
            <div class="extract-code-item">
              <div>
                <div class="extract-code-email">${rc.email}</div>
                <div class="extract-code">${rc.code}</div>
              </div>
              <button class="copy-btn" data-code="${rc.code}">复制</button>
            </div>
          `).join('')}
        </div>
        <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-lg);">
          <button class="btn btn-secondary" style="flex: 1;" id="download-again">重新下载</button>
          <button class="btn btn-primary" style="flex: 1;" id="go-to-plaza">前往广场</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.resetForm();
    });

    modal.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const success = await FileUtils.copyToClipboard(btn.dataset.code);
        if (success) {
          btn.textContent = '已复制';
          setTimeout(() => btn.textContent = '复制', 2000);
          Notification.success('提取码已复制');
        } else {
          Notification.error('复制失败');
        }
      });
    });

    modal.querySelector('#download-again').addEventListener('click', () => {
      FileUtils.downloadJSON(capsule, filename);
      Notification.success('文件已重新下载');
    });

    modal.querySelector('#go-to-plaza').addEventListener('click', () => {
      document.body.removeChild(modal);
      this.resetForm();
      window.app.switchView('plaza');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
        this.resetForm();
      }
    });
  },

  resetForm() {
    document.getElementById('create-form').reset();
    this.recipients = [];
    this.renderRecipients();
    this.setDefaultUnlockTime();
  },

  async previewCapsule() {
    const message = document.getElementById('capsule-message').value.trim();
    const unlockTimeStr = document.getElementById('unlock-time').value;
    const title = document.getElementById('capsule-title').value.trim() || '时间胶囊';

    if (!message || !unlockTimeStr) {
      Notification.warning('请填写消息内容和解锁时间');
      return;
    }

    const preview = {
      meta: {
        title,
        unlockAt: TimeUtils.parseDateInput(unlockTimeStr),
        recipientCount: this.recipients.length
      }
    };

    const previewHtml = `
      <div style="padding: var(--spacing-lg); background: var(--color-bg-secondary); border-radius: var(--radius-md); margin-top: var(--spacing-lg);">
        <h3 style="color: var(--color-accent-cyan); margin-bottom: var(--spacing-md);">📋 胶囊预览</h3>
        <div style="margin-bottom: var(--spacing-sm);">
          <span style="color: var(--color-text-muted);">标题：</span>
          <span style="font-family: var(--font-display);">${this.escapeHtml(preview.meta.title)}</span>
        </div>
        <div style="margin-bottom: var(--spacing-sm);">
          <span style="color: var(--color-text-muted);">解锁时间：</span>
          <span style="font-family: var(--font-display);">${TimeUtils.formatTimestamp(preview.meta.unlockAt)}</span>
        </div>
        <div style="margin-bottom: var(--spacing-sm);">
          <span style="color: var(--color-text-muted);">消息长度：</span>
          <span style="font-family: var(--font-display);">${message.length} 字符</span>
        </div>
        <div>
          <span style="color: var(--color-text-muted);">接收者：</span>
          <span style="font-family: var(--font-display);">${preview.meta.recipientCount} 人</span>
        </div>
      </div>
    `;

    const existingPreview = document.getElementById('capsule-preview');
    if (existingPreview) {
      existingPreview.innerHTML = previewHtml;
    }
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

window.CreateView = CreateView;
