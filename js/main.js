const App = {
  currentView: 'create',
  views: {},

  init() {
    this.setupParticles();
    this.setupNavigation();
    this.setupExportButton();
    this.initViews();
    this.switchView('create');
    this.testCryptoSupport();
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
      plaza: '🏛️ 胶囊广场'
    };

    const heroDescriptions = {
      create: '将你的消息封印在时间中，只有到达预设的未来时刻才能解锁',
      decrypt: '上传胶囊文件，等待时间到来，输入提取码解锁秘密',
      plaza: '探索公开的时间胶囊，点赞评论，一起等待时间的奇迹'
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
      this.views.plaza.render();
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
      
      if (!data.capsules || Object.keys(data.capsules).length === 0) {
        Notification.warning('没有数据可以导出');
        return;
      }

      const exportData = {
        version: '1.0',
        exportedAt: TimeUtils.getCurrentTimestamp(),
        data: data
      };

      const filename = `time_capsules_backup_${new Date().toISOString().split('T')[0]}.json`;
      FileUtils.downloadJSON(exportData, filename);
      
      Notification.success('数据导出成功！共 ' + Object.keys(data.capsules).length + ' 条胶囊数据');
    } catch (error) {
      console.error('导出失败:', error);
      Notification.error('导出失败: ' + error.message);
    }
  },

  async importData() {
    try {
      const file = await FileUtils.triggerFileInput('.json');
      const data = await FileUtils.readJSONFile(file);

      if (!data || !data.data) {
        throw new Error('无效的备份文件格式');
      }

      const success = StorageUtils.importData(data.data);
      
      if (success) {
        Notification.success('数据导入成功！');
        if (this.views.plaza) {
          this.views.plaza.loadUserCapsules();
          this.views.plaza.render();
        }
      } else {
        throw new Error('导入失败');
      }
    } catch (error) {
      if (error.message !== '取消选择') {
        console.error('导入失败:', error);
        Notification.error('导入失败: ' + error.message);
      }
    }
  }
};

window.app = App;

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
