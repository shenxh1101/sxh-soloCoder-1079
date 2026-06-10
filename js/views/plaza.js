const PlazaView = {
  capsules: [],
  countdownTimers: [],
  currentFilter: 'all',
  currentSort: 'newest',

  init() {
    this.bindEvents();
    this.loadMockData();
    this.loadAllPublicCapsules();
  },

  async loadMockData() {
    try {
      const response = await fetch('data/mock-capsules.json');
      if (response.ok) {
        const mockCapsules = await response.json();
        mockCapsules.forEach(capsule => {
          if (!this.capsules.find(c => c.id === capsule.id) && capsule.meta.isPublic) {
            this.capsules.push(capsule);
          }
        });
        this.render();
      }
    } catch (e) {
      console.log('没有找到mock数据，跳过');
    }
  },

  loadAllPublicCapsules() {
    this.capsules = this.capsules.filter(c => !c.id || !StorageUtils.getMyCapsules().includes(c.id));
    
    const allMyCapsules = StorageUtils.getAllMyCapsuleData();
    allMyCapsules.forEach(capsule => {
      if (capsule.meta && capsule.meta.isPublic && !this.capsules.find(c => c.id === capsule.id)) {
        this.capsules.push(capsule);
      }
    });
    
    const myCapsuleIds = StorageUtils.getMyCapsules();
    myCapsuleIds.forEach(id => {
      if (!this.capsules.find(c => c.id === id)) {
        const stored = localStorage.getItem(`capsule_${id}`);
        if (stored) {
          try {
            const capsule = JSON.parse(stored);
            if (capsule.meta.isPublic) {
              this.capsules.push(capsule);
            }
          } catch (e) {
            console.error('解析胶囊数据失败', e);
          }
        }
      }
    });
    
    this.render();
  },

  refresh() {
    this.loadAllPublicCapsules();
  },

  bindEvents() {
    const filterSelect = document.getElementById('filter-status');
    if (filterSelect) {
      filterSelect.addEventListener('change', (e) => {
        this.currentFilter = e.target.value;
        this.render();
      });
    }

    const sortSelect = document.getElementById('sort-by');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.currentSort = e.target.value;
        this.render();
      });
    }

    const searchInput = document.getElementById('search-capsules');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.render());
    }
  },

  getFilteredCapsules() {
    let filtered = [...this.capsules].filter(c => c.meta.isPublic);

    const searchTerm = document.getElementById('search-capsules')?.value.trim().toLowerCase() || '';
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.meta.title.toLowerCase().includes(searchTerm) ||
        c.meta.creator.toLowerCase().includes(searchTerm)
      );
    }

    const now = TimeUtils.getCurrentTimestamp();
    switch (this.currentFilter) {
      case 'unlocked':
        filtered = filtered.filter(c => now >= c.meta.unlockAt);
        break;
      case 'locked':
        filtered = filtered.filter(c => now < c.meta.unlockAt);
        break;
      case 'today':
        const endOfDay = new Date();
        endOfDay.setHours(23, 59, 59, 999);
        const endOfDayTimestamp = Math.floor(endOfDay.getTime() / 1000);
        filtered = filtered.filter(c => c.meta.unlockAt <= endOfDayTimestamp && c.meta.unlockAt > now);
        break;
    }

    switch (this.currentSort) {
      case 'newest':
        filtered.sort((a, b) => b.meta.createdAt - a.meta.createdAt);
        break;
      case 'oldest':
        filtered.sort((a, b) => a.meta.createdAt - b.meta.createdAt);
        break;
      case 'unlock-soon':
        filtered.sort((a, b) => a.meta.unlockAt - b.meta.unlockAt);
        break;
      case 'most-liked':
        filtered.sort((a, b) => {
          const likesA = StorageUtils.getLikes(a.id);
          const likesB = StorageUtils.getLikes(b.id);
          return likesB - likesA;
        });
        break;
    }

    return filtered;
  },

  render() {
    this.countdownTimers.forEach(timer => timer.destroy());
    this.countdownTimers = [];

    const container = document.getElementById('capsules-grid');
    const capsules = this.getFilteredCapsules();

    if (capsules.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="empty-state-icon">📭</span>
          <h3>没有找到胶囊</h3>
          <p>试试调整筛选条件，或者创建一个新的时间胶囊吧！</p>
          <button class="btn btn-primary" style="margin-top: var(--spacing-md);" onclick="window.app.switchView('create')">
            ✨ 创建胶囊
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = capsules.map(capsule => this.renderCapsuleCard(capsule)).join('');

    capsules.forEach(capsule => {
      const countdownElement = document.getElementById(`countdown-${capsule.id}`);
      if (countdownElement) {
        const timer = createCountdown(countdownElement, capsule.meta.unlockAt, {
          showLabels: false,
          large: false,
          onUnlock: () => this.render()
        });
        this.countdownTimers.push(timer);
      }
    });

    this.bindCardEvents();
  },

  renderCapsuleCard(capsule) {
    const isUnlocked = TimeUtils.isDateUnlocked(capsule.meta.unlockAt);
    const likes = StorageUtils.getLikes(capsule.id);
    const liked = StorageUtils.isLiked(capsule.id);
    const comments = StorageUtils.getComments(capsule.id);
    const status = CapsuleModel.getStatus(capsule);
    const statusText = CapsuleModel.getStatusText(status);

    const countdownContent = isUnlocked 
      ? '<span class="time">已解锁</span>'
      : '<div class="time" id="countdown-' + capsule.id + '"></div>';

    return `
      <div class="capsule-card" data-id="${capsule.id}">
        <div class="capsule-card-header">
          <h3>${this.escapeHtml(capsule.meta.title)}</h3>
          <div class="creator">by ${this.escapeHtml(capsule.meta.creator)}</div>
          <div style="position: absolute; top: var(--spacing-sm); right: var(--spacing-sm); background: rgba(0,0,0,0.3); padding: 2px 8px; border-radius: var(--radius-full); font-size: 0.75rem;">
            ${statusText}
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
            <button class="action-btn like-btn ${liked ? 'liked' : ''}" data-id="${capsule.id}">
              <span>❤️</span>
              <span class="like-count">${likes}</span>
            </button>
            <button class="action-btn comment-btn" data-id="${capsule.id}">
              <span>💬</span>
              <span class="comment-count">${comments.length}</span>
            </button>
            <button class="action-btn view-btn" data-id="${capsule.id}">
              <span>🔍</span>
              <span>详情</span>
            </button>
          </div>
          <div class="comments-section" id="comments-${capsule.id}" style="display: none;">
            <div class="comment-input">
              <input type="text" placeholder="写下你的评论..." id="comment-input-${capsule.id}" maxlength="200">
              <button class="btn btn-primary btn-sm submit-comment" data-id="${capsule.id}">发送</button>
            </div>
            <div class="comments-list" id="comments-list-${capsule.id}">
              ${this.renderComments(comments)}
            </div>
          </div>
        </div>
      </div>
    `;
  },

  renderComments(comments) {
    if (comments.length === 0) {
      return '<p style="color: var(--color-text-muted); font-size: 0.85rem; text-align: center;">暂无评论</p>';
    }

    return comments.slice().reverse().map(comment => `
      <div class="comment">
        <div class="comment-header">
          <span class="comment-author">${this.escapeHtml(comment.author)}</span>
          <span class="comment-time">${TimeUtils.formatTimestamp(comment.createdAt)}</span>
        </div>
        <div class="comment-content">${this.escapeHtml(comment.content)}</div>
      </div>
    `).join('');
  },

  bindCardEvents() {
    document.querySelectorAll('.like-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        const result = StorageUtils.likeCapsule(capsuleId);
        
        btn.classList.toggle('liked', result.liked);
        btn.querySelector('.like-count').textContent = result.likes;
        
        if (result.liked) {
          Notification.success('已点赞 ❤️');
        }
      });
    });

    document.querySelectorAll('.comment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        const commentsSection = document.getElementById(`comments-${capsuleId}`);
        const isHidden = commentsSection.style.display === 'none';
        commentsSection.style.display = isHidden ? 'block' : 'none';
      });
    });

    document.querySelectorAll('.submit-comment').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        const input = document.getElementById(`comment-input-${capsuleId}`);
        const content = input.value.trim();
        
        if (!content) {
          Notification.warning('请输入评论内容');
          return;
        }

        const comment = StorageUtils.addComment(capsuleId, '匿名用户', content);
        input.value = '';
        
        const commentsList = document.getElementById(`comments-list-${capsuleId}`);
        const currentComments = StorageUtils.getComments(capsuleId);
        commentsList.innerHTML = this.renderComments(currentComments);
        
        const card = document.querySelector(`.capsule-card[data-id="${capsuleId}"]`);
        if (card) {
          card.querySelector('.comment-count').textContent = currentComments.length;
        }
        
        Notification.success('评论已发送');
      });
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const capsuleId = btn.dataset.id;
        const capsule = this.capsules.find(c => c.id === capsuleId);
        if (capsule) {
          this.showCapsuleDetail(capsule);
        }
      });
    });

    document.querySelectorAll('.capsule-card').forEach(card => {
      card.addEventListener('click', () => {
        const capsuleId = card.dataset.id;
        const capsule = this.capsules.find(c => c.id === capsuleId);
        if (capsule) {
          this.showCapsuleDetail(capsule);
        }
      });
    });
  },

  showCapsuleDetail(capsule) {
    const isUnlocked = TimeUtils.isDateUnlocked(capsule.meta.unlockAt);
    const likes = StorageUtils.getLikes(capsule.id);
    const liked = StorageUtils.isLiked(capsule.id);
    const comments = StorageUtils.getComments(capsule.id);

    const countdownId = `detail-countdown-${capsule.id}`;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>${this.escapeHtml(capsule.meta.title)}</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div style="color: var(--color-text-muted); margin-bottom: var(--spacing-md);">
          by <strong style="color: var(--color-text-primary);">${this.escapeHtml(capsule.meta.creator)}</strong>
          · 创建于 ${TimeUtils.formatTimestamp(capsule.meta.createdAt)}
        </div>

        <div class="countdown-display">
          <div class="countdown-label">
            ${isUnlocked ? '🎉 胶囊已解锁' : '⏳ 距离解锁还有'}
          </div>
          <div id="${countdownId}"></div>
        </div>

        <div class="meta-info">
          <div class="meta-item">
            <div class="meta-item-label">解锁时间</div>
            <div class="meta-item-value">${TimeUtils.formatTimestamp(capsule.meta.unlockAt)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">加密算法</div>
            <div class="meta-item-value">${capsule.meta.encryption.algorithm}</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">接收者</div>
            <div class="meta-item-value">${capsule.recipients.length} 人</div>
          </div>
          <div class="meta-item">
            <div class="meta-item-label">互动数据</div>
            <div class="meta-item-value">❤️ ${likes} · 💬 ${comments.length}</div>
          </div>
        </div>

        <div class="recipients-display">
          <h4>👥 接收者</h4>
          ${capsule.recipients.map((r, i) => `
            <div class="recipient-item">
              <span class="recipient-email">${this.escapeHtml(r.email)}</span>
              <span class="recipient-status">#${i + 1}</span>
            </div>
          `).join('')}
        </div>

        <div style="display: flex; gap: var(--spacing-md); margin-top: var(--spacing-lg);">
          <button class="btn btn-secondary" style="flex: 1;" id="detail-like-btn">
            ${liked ? '❤️ 已点赞' : '🤍 点赞'} (${likes})
          </button>
          <button class="btn btn-primary" style="flex: 1;" id="go-to-decrypt">
            🔓 去解密
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const countdownElement = document.getElementById(countdownId);
    const detailTimer = createCountdown(countdownElement, capsule.meta.unlockAt, {
      showLabels: true,
      large: true
    });

    modal.querySelector('.modal-close').addEventListener('click', () => {
      detailTimer.destroy();
      document.body.removeChild(modal);
    });

    modal.querySelector('#detail-like-btn').addEventListener('click', () => {
      const result = StorageUtils.likeCapsule(capsule.id);
      const btn = modal.querySelector('#detail-like-btn');
      btn.innerHTML = `${result.liked ? '❤️ 已点赞' : '🤍 点赞'} (${result.likes})`;
      
      const card = document.querySelector(`.capsule-card[data-id="${capsule.id}"]`);
      if (card) {
        card.querySelector('.like-count').textContent = result.likes;
        card.querySelector('.like-btn').classList.toggle('liked', result.liked);
      }
    });

    modal.querySelector('#go-to-decrypt').addEventListener('click', () => {
      detailTimer.destroy();
      document.body.removeChild(modal);
      window.app.switchView('decrypt');
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        detailTimer.destroy();
        document.body.removeChild(modal);
      }
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  addCapsule(capsule) {
    if (capsule.meta.isPublic && !this.capsules.find(c => c.id === capsule.id)) {
      this.capsules.push(capsule);
      this.render();
    }
  },

  removeCapsule(capsuleId) {
    const initialLength = this.capsules.length;
    this.capsules = this.capsules.filter(c => c.id !== capsuleId);
    if (this.capsules.length !== initialLength) {
      this.render();
    }
  },

  destroy() {
    this.countdownTimers.forEach(timer => timer.destroy());
    this.countdownTimers = [];
  }
};

window.PlazaView = PlazaView;
