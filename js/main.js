const App = {
  currentView: 'create',
  views: {},
  pendingImportData: null,

  init() {
    this.setupParticles();
    this.setupNavigation();
    this.setupExportButton();
    this.setupImportButton();
    this.initViews();
    this.switchView('create');
    this.testCryptoSupport();
    this.migrateOldData();
  },

  migrateOldData() {
    const data = StorageUtils.getData();
    if (data.myCapsules && !data.capsuleData) {
      data.capsuleData = {};
      data.myCapsules.forEach(id => {
        const stored = localStorage.getItem(`capsule_${id}`);
        if (stored) {
          try {
            data.capsuleData[id] = JSON.parse(stored);
          } catch (e) {
            console.error('迁移旧数据失败:', e);
          }
        }
      });
      StorageUtils.saveData(data);
    }
  },

  escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  setupParticles() {
    const particlesContainer = document.createElement('div');
    particlesContainer.className = 'particles';
    document.body.appendChild(particlesContainer);

    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'particle';
      particle.style.left = Math.random() * 100 + '%';
      particle.style.animationDelay = Math.random() * 15 + 's';
      particle.style.animationDuration = (15 + Math.random() * 10) + 's';
      if (Math.random() > 0.5) {
        particle.style.background = 'var(--color-accent-cyan)';
      }
      particlesContainer.appendChild(particle);
    }
  },

  setupNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
      link.addEventListener('click', () => {
        const view = link.dataset.view;
        this.switchView(view);
      });
    });
  },

  setupExportButton() {
    const exportBtn = document.getElementById('export-all-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportAllData());
    }
  },

  setupImportButton() {
    const importBtn = document.getElementById('import-backup-btn');
    if (importBtn) {
      importBtn.addEventListener('click', () => this.showImportModal());
    }
  },

  initViews() {
    if (window.CreateView) {
      this.views.create = window.CreateView;
      this.views.create.init();
    }
    if (window.DecryptView) {
      this.views.decrypt = window.DecryptView;
      this.views.decrypt.init();
    }
    if (window.PlazaView) {
      this.views.plaza = window.PlazaView;
      this.views.plaza.init();
    }
    if (window.LibraryView) {
      this.views.library = window.LibraryView;
      this.views.library.init();
    }
  },

  switchView(viewName) {
    if (!this.views[viewName]) return;

    Object.keys(this.views).forEach(key => {
      const viewElement = document.getElementById(`view-${key}`);
      const navLink = document.querySelector(`.nav-link[data-view="${key}"]`);
      
      if (viewElement) {
        viewElement.classList.remove('active');
      }
      if (navLink) {
        navLink.classList.remove('active');
      }

      if (key !== viewName && this.views[key].destroy) {
        this.views[key].destroy();
      }
    });

    const targetViewElement = document.getElementById(`view-${viewName}`);
    const targetNavLink = document.querySelector(`.nav-link[data-view="${viewName}"]`);
    
    if (targetViewElement) {
      targetViewElement.classList.add('active');
    }
    if (targetNavLink) {
      targetNavLink.classList.add('active');
    }

    this.currentView = viewName;

    const heroTitles = {
      create: '✨ 创建时间胶囊',
      decrypt: '🔓 解密时间胶囊',
      plaza: '🏛️ 胶囊广场',
      library: '📚 我的胶囊库'
    };

    const heroDescriptions = {
      create: '将你的消息封印在时间中，只有到达预设的未来时刻才能解锁',
      decrypt: '上传胶囊文件，等待时间到来，输入提取码解锁秘密',
      plaza: '探索公开的时间胶囊，点赞评论，一起等待时间的奇迹',
      library: '管理你创建的时间胶囊，重新下载、调整公开状态'
    };

    const heroTitle = document.querySelector('.hero h1');
    const heroDesc = document.querySelector('.hero p');
    
    if (heroTitle) {
      heroTitle.textContent = heroTitles[viewName];
      heroTitle.classList.remove('animate-fade-in-up');
      void heroTitle.offsetWidth;
      heroTitle.classList.add('animate-fade-in-up');
    }
    if (heroDesc) {
      heroDesc.textContent = heroDescriptions[viewName];
      heroDesc.classList.remove('animate-fade-in-up', 'delay-200');
      void heroDesc.offsetWidth;
      heroDesc.classList.add('animate-fade-in-up', 'delay-200');
    }

    if (viewName === 'plaza') {
      this.views.plaza.refresh();
    }
    if (viewName === 'library') {
      this.views.library.loadCapsules();
      this.views.library.render();
    }
  },

  async testCryptoSupport() {
    if (!window.crypto || !crypto.subtle) {
      Notification.error('您的浏览器不支持Web Crypto API，请使用现代浏览器');
      return;
    }

    try {
      const supported = await AESUtils.testEncryption();
      if (!supported) {
        Notification.warning('加密测试失败，部分功能可能无法正常使用');
      }
    } catch (e) {
      console.warn('加密测试:', e);
    }
  },

  async exportAllData() {
    try {
      const data = StorageUtils.exportAllData();
      
      const hasData = (data.myCapsules && data.myCapsules.length > 0) || 
                      (data.capsules && Object.keys(data.capsules).length > 0);
      
      if (!hasData) {
        Notification.warning('没有数据可以导出');
        return;
      }

      const exportData = {
        version: StorageUtils.BACKUP_VERSION,
        exportedAt: TimeUtils.getCurrentTimestamp(),
        exportedFrom: window.location.hostname,
        data: data
      };

      const filename = `time_capsules_backup_v${StorageUtils.BACKUP_VERSION}_${new Date().toISOString().split('T')[0]}.json`;
      FileUtils.downloadJSON(exportData, filename);
      
      const capsuleCount = data.myCapsules ? data.myCapsules.length : 0;
      Notification.success(`数据导出成功！共 ${capsuleCount} 个胶囊，备份版本 v${StorageUtils.BACKUP_VERSION}`);
    } catch (error) {
      console.error('导出失败:', error);
      Notification.error('导出失败: ' + error.message);
    }
  },

  async showImportModal() {
    try {
      const file = await FileUtils.triggerFileInput('.json');
      const data = await FileUtils.readJSONFile(file);

      const validation = StorageUtils.validateBackupFile(data);
      
      if (!validation.valid) {
        this.showImportErrorModal(validation.errors);
        return;
      }

      const preview = StorageUtils.getBackupPreview(data);
      this.pendingImportData = data;
      
      this.showImportPreviewModal(preview);
    } catch (error) {
      if (error.message !== '取消选择') {
        console.error('导入失败:', error);
        this.showImportErrorModal([error.message]);
      }
    }
  },

  showImportPreviewModal(preview) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2>📥 导入备份数据</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div class="import-preview" style="background: var(--color-bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
          <h3 style="color: var(--color-accent-cyan); margin-bottom: var(--spacing-md);">📊 备份内容预览</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
            <div class="meta-item">
              <div class="meta-item-label">备份版本</div>
              <div class="meta-item-value">v${this.escapeHtml(preview.version)}</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">导出时间</div>
              <div class="meta-item-value">${this.escapeHtml(preview.exportDate)}</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">胶囊总数</div>
              <div class="meta-item-value">${this.escapeHtml(String(preview.capsuleCount))} 个</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">公开/私密</div>
              <div class="meta-item-value">${this.escapeHtml(String(preview.publicCapsuleCount))} / ${this.escapeHtml(String(preview.privateCapsuleCount))}</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">总点赞数</div>
              <div class="meta-item-value">❤️ ${this.escapeHtml(String(preview.totalLikes))}</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">总评论数</div>
              <div class="meta-item-value">💬 ${this.escapeHtml(String(preview.totalComments))}</div>
            </div>
          </div>
          ${preview.hasExtractCodes ? '<p style="color: var(--color-success); margin-top: var(--spacing-md);">✅ 包含提取码记录</p>' : ''}
        </div>
        
        <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid var(--color-accent-purple); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-lg);">
          <p style="color: var(--color-text-primary); font-size: 0.9rem;">
            ⚠️ <strong>导入说明：</strong>
          </p>
          <ul style="color: var(--color-text-secondary); font-size: 0.85rem; margin: var(--spacing-sm) 0 0 var(--spacing-lg);">
            <li>重复的胶囊不会被重复导入</li>
            <li>已有点赞数会取较高值，不会被覆盖</li>
            <li>评论会按ID去重合并，不会删除已有评论</li>
            <li>公开胶囊导入后会自动显示在广场</li>
          </ul>
        </div>

        <div style="display: flex; gap: var(--spacing-md);">
          <button class="btn btn-secondary" style="flex: 1;" id="cancel-import">取消</button>
          <button class="btn btn-primary" style="flex: 2;" id="confirm-import">
            ✨ 确认导入
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector('.modal-close').addEventListener('click', () => {
      this.pendingImportData = null;
      document.body.removeChild(modal);
    });

    modal.querySelector('#cancel-import').addEventListener('click', () => {
      this.pendingImportData = null;
      document.body.removeChild(modal);
    });

    modal.querySelector('#confirm-import').addEventListener('click', () => {
      this.confirmImport(modal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.pendingImportData = null;
        document.body.removeChild(modal);
      }
    });
  },

  showImportErrorModal(errors) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 style="color: var(--color-error);">❌ 导入失败</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid var(--color-error); border-radius: var(--radius-md); padding: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
          <h3 style="color: var(--color-error); margin-bottom: var(--spacing-md);">错误原因：</h3>
          <ul style="color: var(--color-text-primary); margin-left: var(--spacing-lg);">
            ${errors.map(e => `<li>${this.escapeHtml(e)}</li>`).join('')}
          </ul>
        </div>
        
        <div style="background: var(--color-bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-md);">
          <p style="color: var(--color-text-muted); font-size: 0.9rem;">
            💡 <strong>建议：</strong>请确保使用的是从本工具导出的完整备份文件，最低支持版本为 v${StorageUtils.MIN_SUPPORTED_BACKUP_VERSION}。
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

  async confirmImport(modal) {
    try {
      if (!this.pendingImportData) {
        throw new Error('没有待导入的数据');
      }

      const importData = this.pendingImportData.data;
      const result = StorageUtils.importData(importData);
      
      if (result.success) {
        document.body.removeChild(modal);
        
        const reportData = {
          version: this.pendingImportData.version,
          exportedFrom: this.pendingImportData.exportedFrom || '未知',
          exportedAt: this.pendingImportData.exportedAt,
          importedAt: TimeUtils.getCurrentTimestamp(),
          stats: result.stats,
          details: result.details,
          errors: result.errors
        };
        
        const savedReport = StorageUtils.saveImportReport(reportData);
        
        this.showImportSuccessModal(result, savedReport);
        
        if (this.views.plaza) {
          this.views.plaza.refresh();
        }
        if (this.views.library) {
          this.views.library.loadCapsules();
          this.views.library.render();
        }
      } else {
        throw new Error(result.errors.join('，') || '导入失败');
      }
    } catch (error) {
      console.error('导入失败:', error);
      Notification.error('导入失败: ' + error.message);
    } finally {
      this.pendingImportData = null;
    }
  },

  showImportSuccessModal(result, report) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    
    const { capsulesAdded, capsulesSkipped, likesUpdated, commentsAdded, extractCodesAdded, publicCapsulesSynced } = result.stats;
    
    modal.innerHTML = `
      <div class="modal">
        <div class="modal-header">
          <h2 style="color: var(--color-success);">🎉 导入成功</h2>
          <button class="modal-close">&times;</button>
        </div>
        
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid var(--color-success); border-radius: var(--radius-md); padding: var(--spacing-lg); margin-bottom: var(--spacing-lg);">
          <h3 style="color: var(--color-success); margin-bottom: var(--spacing-md);">📊 导入统计</h3>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: var(--spacing-md);">
            <div class="meta-item">
              <div class="meta-item-label">新增胶囊</div>
              <div class="meta-item-value" style="color: var(--color-success);">${this.escapeHtml(String(capsulesAdded))} 个</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">跳过重复</div>
              <div class="meta-item-value" style="color: var(--color-text-muted);">${this.escapeHtml(String(capsulesSkipped))} 个</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">广场同步</div>
              <div class="meta-item-value" style="color: var(--color-accent-cyan);">${this.escapeHtml(String(publicCapsulesSynced))} 个</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">提取码记录</div>
              <div class="meta-item-value" style="color: var(--color-accent-purple);">${this.escapeHtml(String(extractCodesAdded))} 组</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">更新点赞</div>
              <div class="meta-item-value">❤️ ${this.escapeHtml(String(likesUpdated))}</div>
            </div>
            <div class="meta-item">
              <div class="meta-item-label">新增评论</div>
              <div class="meta-item-value">💬 ${this.escapeHtml(String(commentsAdded))}</div>
            </div>
          </div>
        </div>
        
        ${result.details.addedCapsules.length > 0 ? `
        <div style="background: var(--color-bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-md); max-height: 150px; overflow-y: auto;">
          <h4 style="color: var(--color-text-primary); margin-bottom: var(--spacing-sm);">📥 新增的胶囊：</h4>
          <ul style="color: var(--color-text-secondary); font-size: 0.85rem; margin-left: var(--spacing-lg);">
            ${result.details.addedCapsules.map(c => `<li>${this.escapeHtml(c.title)} (${this.escapeHtml(String(c.comments))}条评论, ${this.escapeHtml(String(c.likes))}个赞)</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${result.details.mergedComments.length > 0 ? `
        <div style="background: var(--color-bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-md); max-height: 150px; overflow-y: auto;">
          <h4 style="color: var(--color-text-primary); margin-bottom: var(--spacing-sm);">💬 合并的评论：</h4>
          <ul style="color: var(--color-text-secondary); font-size: 0.85rem; margin-left: var(--spacing-lg);">
            ${result.details.mergedComments.map(m => `<li>${this.escapeHtml(m.capsuleTitle)}: ${this.escapeHtml(m.action)} ${this.escapeHtml(String(m.count))}条</li>`).join('')}
          </ul>
        </div>
        ` : ''}
        
        ${result.details.skippedCapsules.length > 0 ? `
        <div style="background: var(--color-bg-secondary); border-radius: var(--radius-md); padding: var(--spacing-md); margin-bottom: var(--spacing-md); max-height: 150px; overflow-y: auto;">
          <h4 style="color: var(--color-text-primary); margin-bottom: var(--spacing-sm);">⏭️ 跳过的胶囊：</h4>
          <ul style="color: var(--color-text-muted); font-size: 0.85rem; margin-left: var(--spacing-lg);">
            ${result.details.skippedCapsules.map(c => `<li>${this.escapeHtml(c.title)} (${this.escapeHtml(c.reason)})</li>`).join('')}
          </ul>
        </div>
        ` : ''}

        <div style="display: flex; gap: var(--spacing-md);">
          <button class="btn btn-secondary" style="flex: 1;" id="close-success-modal">关闭</button>
          <button class="btn btn-primary" style="flex: 1;" id="download-report-btn">
            📄 下载报告
          </button>
          <button class="btn btn-primary" style="flex: 1;" id="go-to-plaza-btn">
            🏛️ 查看广场
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => document.body.removeChild(modal);
    
    modal.querySelector('.modal-close').addEventListener('click', closeModal);
    modal.querySelector('#close-success-modal').addEventListener('click', closeModal);
    
    modal.querySelector('#download-report-btn').addEventListener('click', () => {
      const filename = `import_report_${report.id}_${new Date().toISOString().split('T')[0]}.json`;
      FileUtils.downloadJSON(report, filename);
      Notification.success('导入报告已下载');
    });
    
    modal.querySelector('#go-to-plaza-btn').addEventListener('click', () => {
      closeModal();
      this.switchView('plaza');
    });
    
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });
  }
};

window.app = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
