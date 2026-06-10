const LibraryView = {
  capsules: [],
  countdownTimers: [],
  currentFilter: 'all',
  searchTerm: '',

  init() {
    this.loadCapsules();
    this.bindEvents();
  },

  loadCapsules() {
    this.capsules = StorageUtils.getAllMyCapsuleData();
  },

  bindEvents() {
    const filterSelect = document.getElementById('library-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('library-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        this.searchTerm = searchInput.value.trim().toLowerCase();
        this.render();
      });
    }
  },

  getFilteredCapsules() {
    let filtered = [...this.capsules];

    if (this.searchTerm) {
      filtered = filtered.filter(c => 
        c.meta.title.toLowerCase().includes(this.searchTerm) ||
        c.meta.creator.toLowerCase().includes(this.searchTerm)
      );
    }

    const now = TimeUtils.getCurrentTimestamp();
    switch (this.currentFilter) {
      case 'public':
        filtered = filtered.filter(c => c.meta.isPublic);
        break;
      case 'private':
        filtered = filtered.filter(c => !c.meta.isPublic);
        break;
      case 'unlocked':
        filtered = filtered.filter(c => now >= c.meta.unlockAt);
        break;
      case 'locked':
        filtered = filtered.filter(c => now < c.meta.unlockAt);
        break;
    }

    filtered.sort((a, b) => b.meta.createdAt - a.meta.createdAt);

    return filtered;
  },

  render() {
    this.countdownTimers.forEach(timer => timer.destroy());
    this.countdownTimers = [];

    const container = document.getElementById('library-grid');
    const capsules = this.getFilteredCapsules();

    if (capsules.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-state-icon">📭</span>
          <h3>还没有创建胶囊</h3>
          <p>创建你的第一个时间胶囊，将重要的消息封印在时间中！</p>
          <button class="btn btn-primary" style="margin-top: var(--spacing-md);" onclick="window.app.switchView('create')">
            ✨ 创建胶囊
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = capsules.map(capsule => this.renderCapsuleCard(capsule)).join('');

    capsules.forEach(capsule => {
      const countdownElement = document.getElementById(`lib-countdown-${capsule.id}`);
      if (countdownElement) {
        const timer = createCountdown(countdownElement, capsule.meta.unlockAt, {
          showLabels: false,
          large: false
        });
        this.countdownTimers.push(timer);
      }
    });

    this.bindCardEvents();
  },

  renderCapsuleCard(capsule) {
    const isUnlocked = TimeUtils.isDateUnlocked(capsule.meta.unlockAt);
    const status = CapsuleModel.getStatus(capsule);
    const statusText = CapsuleModel.getStatusText(status);
    const extractCodes = StorageUtils.getExtractCodes(capsule.id);

    const countdownContent = isUnlocked 
      ? '<span class="time">已解锁</span>'
      : '<div class="time" id="lib-countdown-' + capsule.id + '"></div>';

    return `
      <div class="capsule-card" data-id="${capsule.id}">
        <div class="capsule-card-header">
          <h3>${this.escapeHtml(capsule.meta.title)}</h3>
          <div class="creator">by ${this.escapeHtml(capsule.meta.creator)}</div>
          <div style="position: absolute; top: var(--spacing-sm); right: var(--spacing-sm); display: flex; gap: 4px; align-items: center;">
            <span class="badge ${capsule.meta.isPublic ? 'badge-success' : 'badge-muted'}">
              ${capsule.meta.isPublic ? '🌐 公开' : '🔒 私密'}
            </span>
            <span class="badge" style="background: rgba(0,0,0,0.3);">
              ${statusText}
            </span>
          </div>
        </div>
        <div class="capsule-card-body">
          <div class="capsule-card-countdown ${isUnlocked ? 'unlocked' : ''}">
            ${countdownContent}
          </div>
          <div style="display: flex; justify-content: space-between; color: var(--color-text-muted); font-size: 0.85rem; margin-bottom: var(--spacing-sm);">
            <span>📅 ${TimeUtils.formatTimestamp(capsule.meta.createdAt)}</span>
            <span>👥 ${capsule.recipients.length}人</span>
          </div>
          <div style="color: var(--color-text-muted); font-size: 0.85rem; margin-bottom: var(--spacing-sm);">
            🔐 解锁于 ${TimeUtils.formatTimestamp(capsule.meta.unlockAt)}
          </div>
          <div class="capsule-card-actions">
            <button class="action-btn download-btn" data-id="${capsule.id}" title="重新下载">
              <span>⬇️</span>
              <span>下载</span>
            </button>
            <button class="action-btn codes-btn" data-id="${capsule.id}" title="查看提取码">
              <span>🔑</span>
              <span>提取码</span>
            </button>
            <button class="action-btn privacy-btn" data-id="${capsule.id}" title="切换公开状态">
              <span>${capsule.meta.isPublic ? '🔒' : '🌐'}</span>
              <span>${capsule.meta.isPublic ? '设为私密' : '设为公开'}</span>
            </button>
            <button class="action-btn delete-btn" data-id="${capsule.id}" title="删除">
              <span>🗑️</span>
              <span>删除</span>
            </button>
          </div>
        </div>
      </div>
    `;
  },

  bindCardEvents() {
    document.querySelectorAll('.download-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        this.downloadCapsule(capsuleId);
      });
    });

    document.querySelectorAll('.codes-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        this.showExtractCodes(capsuleId);
      });
    });

    document.querySelectorAll('.privacy-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        this.togglePrivacy(capsuleId);
      });
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        this.confirmDelete(capsuleId);
      });
    });
  },

  downloadCapsule(capsuleId) {
    const capsule = StorageUtils.getMyCapsuleData(capsuleId);
    if (capsule) {
      const filename = FileUtils.generateCapsuleFilename(capsule);
      FileUtils.downloadJSON(capsule, filename);
      Notification.success('胶囊文件已下载');
    } else {
      Notification.error('找不到胶囊数据');
    }
  },

  showExtractCodes(capsuleId) {
    const capsule = StorageUtils.getMyCapsuleData(capsuleId);
    const extractCodes = StorageUtils.getExtractCodes(capsuleId);

    if (!capsule) {
      Notification.error('找不到胶囊数据');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    let codesHtml = '';
    if (extractCodes && extractCodes.length > 0) {
      codesHtml = extractCodes.map(rc => `
        <div class="extract-code-item">
          <div>
            <div class="extract-code-email">${this.escapeHtml(rc.email)}</div>
            <div class="extract-code">${rc.code}</div>
          </div>
          <button class="copy-btn" data-code="${rc.code}">复制</button>
        </div>
      `).join('');
    } else {
      codesHtml = `
        <div style="text-align: center; padding: var(--spacing-lg); color: var(--color-text-muted);">
          <p>⚠️ 没有找到提取码记录</p>
          <p style="font-size: 0.85rem; margin-top: var(--spacing-sm);">提取码仅在创建时显示一次，如果没有保存则无法恢复</p>
        </div>
      `;
    }

    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>🔑 提取码记录</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div style="color: var(--color-text-secondary); margin-bottom: var(--spacing-lg);">
          <strong>${this.escapeHtml(capsule.meta.title)}</strong> · ${capsule.recipients.length} 位接收者
        </div>

        <div class="extract-codes-display">
          ${codesHtml}
        </div>

        <div style="background: rgba(234, 179, 8, 0.1); border: 1px solid var(--color-warning); border-radius: var(--radius-md); padding: var(--spacing-md); margin-top: var(--spacing-lg);">
          <p style="color: var(--color-warning); font-size: 0.85rem;">
            ⚠️ 请妥善保管提取码，这是解锁胶囊的唯一凭证
          </p>
        </div>

        <button class="btn btn-primary" style="width: 100%; margin-top: var(--spacing-lg);" id="close-codes-modal">
          关闭
        </button>
      </div>
    `;

    document.body.appendChild(modal);

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

    const closeModal = () => document.body.removeChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#close-codes-modal').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  },

  togglePrivacy(capsuleId) {
    const capsule = StorageUtils.getMyCapsuleData(capsuleId);
    if (!capsule) {
      Notification.error('找不到胶囊数据');
      return;
    }

    const newIsPublic = !capsule.meta.isPublic;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>确认操作</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <p style="margin-bottom: var(--spacing-lg);">
          确定要将胶囊 <strong>"${this.escapeHtml(capsule.meta.title)}"</strong> 
          ${newIsPublic ? '设为公开' : '设为私密'} 吗？
        </p>
        
        ${newIsPublic ? `
          <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid var(--color-accent-purple); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
            <p style="color: var(--color-text-primary); font-size: 0.85rem;">
              🌐 设为公开后，胶囊将显示在胶囊广场中，所有人都可以看到元信息（标题、创建者、解锁时间等），但消息内容仍然是加密的。
            </p>
          </div>
        ` : `
          <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
            <p style="color: var(--color-text-primary); font-size: 0.85rem;">
              🔒 设为私密后，胶囊将从广场中移除，只有持有胶囊文件的人才能解密。
            </p>
          </div>
        `}

        <div style="display: flex; gap: var(--spacing-md);">
          <button class="btn btn-secondary" style="flex: 1;" id="cancel-privacy">取消</button>
          <button class="btn btn-primary" style="flex: 1;" id="confirm-privacy">
            确认${newIsPublic ? '公开' : '私密'}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => document.body.removeChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-privacy').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#confirm-privacy').addEventListener('click', () => {
      StorageUtils.updateCapsulePrivacy(capsuleId, newIsPublic);
      
      capsule.meta.isPublic = newIsPublic;
      localStorage.setItem(`capsule_${capsuleId}`, JSON.stringify(capsule));
      
      if (window.PlazaView) {
        if (newIsPublic) {
          window.PlazaView.addCapsule(capsule);
        } else {
          window.PlazaView.removeCapsule(capsuleId);
        }
      }
      
      this.loadCapsules();
      this.render();
      closeModal();
      Notification.success(`胶囊已${newIsPublic ? '设为公开' : '设为私密'}`);
    });
  },

  confirmDelete(capsuleId) {
    const capsule = StorageUtils.getMyCapsuleData(capsuleId);
    if (!capsule) {
      Notification.error('找不到胶囊数据');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 style="color: var(--color-error);">⚠️ 确认删除</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <p style="margin-bottom: var(--spacing-lg);">
          确定要删除胶囊 <strong>"${this.escapeHtml(capsule.meta.title)}"</strong> 吗？
        </p>
        
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
          <p style="color: var(--color-error); font-size: 0.85rem;">
            ⚠️ 此操作不可撤销！删除后将从本地移除胶囊数据和提取码记录。
            如果你已经下载了JSON文件，仍然可以用该文件解密消息。
          </p>
        </div>

        <div style="display: flex; gap: var(--spacing-md);">
          <button class="btn btn-secondary" style="flex: 1;" id="cancel-delete">取消</button>
          <button class="btn btn-primary" style="flex: 1; background: var(--color-error);" id="confirm-delete">
            确认删除
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => document.body.removeChild(modal);
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#cancel-delete').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    modal.querySelector('#confirm-delete').addEventListener('click', () => {
      StorageUtils.removeMyCapsule(capsuleId);
      localStorage.removeItem(`capsule_${capsuleId}`);
      
      if (window.PlazaView) {
        window.PlazaView.removeCapsule(capsuleId);
      }
      
      this.loadCapsules();
      this.render();
      closeModal();
      Notification.success('胶囊已删除');
    });
  },

  addCapsule(capsule) {
    this.loadCapsules();
    if (this.currentView === 'library') {
      this.render();
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  destroy() {
    this.countdownTimers.forEach(timer => timer.destroy());
    this.countdownTimers = [];
  }
};

window.LibraryView = LibraryView;
