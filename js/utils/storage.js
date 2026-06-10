const StorageUtils = {
  STORAGE_KEY: 'time_capsule_data',
  BACKUP_VERSION: '2.0',
  MIN_SUPPORTED_BACKUP_VERSION: '1.0',
  CAPSULE_VERSION: '1.0',
  MIN_SUPPORTED_CAPSULE_VERSION: '1.0',

  getDefaultData() {
    return {
      capsules: {},
      myCapsules: [],
      capsuleData: {},
      extractCodes: {},
      settings: {
        theme: 'dark',
        notifications: true
      }
    };
  },

  getData() {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      if (data) {
        const parsed = JSON.parse(data);
        const defaults = this.getDefaultData();
        return {
          ...defaults,
          ...parsed,
          settings: { ...defaults.settings, ...parsed.settings }
        };
      }
    } catch (e) {
      console.error('读取本地存储失败:', e);
    }
    return this.getDefaultData();
  },

  saveData(data) {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('保存本地存储失败:', e);
      return false;
    }
  },

  getCapsuleData(capsuleId) {
    const data = this.getData();
    return data.capsules[capsuleId] || {
      likes: 0,
      liked: false,
      comments: []
    };
  },

  saveCapsuleData(capsuleId, capsuleData) {
    const data = this.getData();
    data.capsules[capsuleId] = capsuleData;
    return this.saveData(data);
  },

  likeCapsule(capsuleId) {
    const data = this.getData();
    if (!data.capsules[capsuleId]) {
      data.capsules[capsuleId] = { likes: 0, liked: false, comments: [] };
    }
    
    const capsule = data.capsules[capsuleId];
    if (capsule.liked) {
      capsule.likes--;
      capsule.liked = false;
    } else {
      capsule.likes++;
      capsule.liked = true;
    }
    
    this.saveData(data);
    return capsule;
  },

  addComment(capsuleId, author, content) {
    const data = this.getData();
    if (!data.capsules[capsuleId]) {
      data.capsules[capsuleId] = { likes: 0, liked: false, comments: [] };
    }
    
    const comment = {
      id: TimeUtils.generateUUID(),
      author: author || '匿名用户',
      content,
      createdAt: TimeUtils.getCurrentTimestamp()
    };
    
    data.capsules[capsuleId].comments.push(comment);
    this.saveData(data);
    return comment;
  },

  getComments(capsuleId) {
    const data = this.getCapsuleData(capsuleId);
    return data.comments || [];
  },

  getLikes(capsuleId) {
    const data = this.getCapsuleData(capsuleId);
    return data.likes || 0;
  },

  isLiked(capsuleId) {
    const data = this.getCapsuleData(capsuleId);
    return data.liked || false;
  },

  addMyCapsule(capsuleId, capsuleData, extractCodes) {
    const data = this.getData();
    if (!data.myCapsules.includes(capsuleId)) {
      data.myCapsules.push(capsuleId);
    }
    if (capsuleData) {
      data.capsuleData[capsuleId] = capsuleData;
    }
    if (extractCodes && extractCodes.length > 0) {
      data.extractCodes[capsuleId] = extractCodes;
    }
    this.saveData(data);
  },

  getMyCapsules() {
    const data = this.getData();
    return data.myCapsules || [];
  },

  getMyCapsuleData(capsuleId) {
    const data = this.getData();
    return data.capsuleData ? data.capsuleData[capsuleId] : null;
  },

  getAllMyCapsuleData() {
    const data = this.getData();
    const result = [];
    if (data.myCapsules) {
      data.myCapsules.forEach(id => {
        const capsule = data.capsuleData ? data.capsuleData[id] : null;
        if (capsule) {
          result.push(capsule);
        }
      });
    }
    return result;
  },

  getExtractCodes(capsuleId) {
    const data = this.getData();
    return data.extractCodes ? data.extractCodes[capsuleId] || [] : [];
  },

  updateCapsulePrivacy(capsuleId, isPublic) {
    const data = this.getData();
    if (data.capsuleData && data.capsuleData[capsuleId]) {
      data.capsuleData[capsuleId].meta.isPublic = isPublic;
      this.saveData(data);
      return true;
    }
    return false;
  },

  removeMyCapsule(capsuleId) {
    const data = this.getData();
    data.myCapsules = data.myCapsules.filter(id => id !== capsuleId);
    if (data.capsuleData) {
      delete data.capsuleData[capsuleId];
    }
    if (data.extractCodes) {
      delete data.extractCodes[capsuleId];
    }
    this.saveData(data);
  },

  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const p1 = parts1[i] || 0;
      const p2 = parts2[i] || 0;
      if (p1 > p2) return 1;
      if (p1 < p2) return -1;
    }
    return 0;
  },

  validateBackupFile(data) {
    const errors = [];
    
    if (!data) {
      errors.push('文件为空');
      return { valid: false, errors };
    }
    
    if (!data.version) {
      errors.push('缺少版本号，可能是不兼容的旧版本文件');
      return { valid: false, errors };
    }
    
    if (this.compareVersions(data.version, this.MIN_SUPPORTED_BACKUP_VERSION) < 0) {
      errors.push(`备份文件版本(${data.version})过低，最低支持版本为${this.MIN_SUPPORTED_BACKUP_VERSION}`);
      return { valid: false, errors };
    }
    
    if (!data.data) {
      errors.push('缺少数据内容');
      return { valid: false, errors };
    }
    
    if (!data.data.myCapsules || !Array.isArray(data.data.myCapsules)) {
      errors.push('数据格式错误：缺少胶囊列表');
      return { valid: false, errors };
    }
    
    return { valid: true, errors };
  },

  getBackupPreview(data) {
    const preview = {
      capsuleCount: 0,
      publicCapsuleCount: 0,
      privateCapsuleCount: 0,
      totalLikes: 0,
      totalComments: 0,
      hasExtractCodes: false,
      exportDate: data.exportedAt ? TimeUtils.formatTimestamp(data.exportedAt) : '未知',
      version: data.version
    };
    
    if (data.data && data.data.myCapsules) {
      preview.capsuleCount = data.data.myCapsules.length;
    }
    
    if (data.data && data.data.capsuleData) {
      Object.values(data.data.capsuleData).forEach(capsule => {
        if (capsule.meta && capsule.meta.isPublic) {
          preview.publicCapsuleCount++;
        } else {
          preview.privateCapsuleCount++;
        }
      });
    }
    
    if (data.data && data.data.capsules) {
      Object.values(data.data.capsules).forEach(capsuleData => {
        preview.totalLikes += capsuleData.likes || 0;
        preview.totalComments += (capsuleData.comments || []).length;
      });
    }
    
    if (data.data && data.data.extractCodes && Object.keys(data.data.extractCodes).length > 0) {
      preview.hasExtractCodes = true;
    }
    
    return preview;
  },

  exportAllData() {
    const data = this.getData();
    
    const publicCapsulesData = {};
    if (data.myCapsules && data.capsuleData) {
      data.myCapsules.forEach(id => {
        const capsule = data.capsuleData[id];
        if (capsule && capsule.meta && capsule.meta.isPublic) {
          publicCapsulesData[id] = capsule;
        }
      });
    }
    
    return {
      ...data,
      publicCapsulesData
    };
  },

  importData(importedData) {
    const result = {
      success: false,
      stats: {
        capsulesAdded: 0,
        capsulesSkipped: 0,
        likesUpdated: 0,
        commentsAdded: 0
      },
      errors: []
    };
    
    try {
      const currentData = this.getData();
      
      if (importedData.capsules) {
        Object.keys(importedData.capsules).forEach(id => {
          const imported = importedData.capsules[id];
          if (!currentData.capsules[id]) {
            currentData.capsules[id] = { ...imported };
            result.stats.commentsAdded += (imported.comments || []).length;
            result.stats.likesUpdated += imported.likes || 0;
          } else {
            const existing = currentData.capsules[id];
            const oldLikes = existing.likes || 0;
            existing.likes = Math.max(oldLikes, imported.likes || 0);
            if (existing.likes > oldLikes) {
              result.stats.likesUpdated += (existing.likes - oldLikes);
            }
            existing.liked = existing.liked || imported.liked;
            if (imported.comments && imported.comments.length > 0) {
              const existingCommentIds = new Set((existing.comments || []).map(c => c.id));
              let addedCount = 0;
              imported.comments.forEach(comment => {
                if (!existingCommentIds.has(comment.id)) {
                  if (!existing.comments) existing.comments = [];
                  existing.comments.push(comment);
                  addedCount++;
                }
              });
              result.stats.commentsAdded += addedCount;
            }
            if (existing.likes === oldLikes && result.stats.commentsAdded === 0) {
              result.stats.capsulesSkipped++;
            }
          }
        });
      }
      
      if (importedData.myCapsules) {
        importedData.myCapsules.forEach(id => {
          if (!currentData.myCapsules.includes(id)) {
            currentData.myCapsules.push(id);
            result.stats.capsulesAdded++;
          }
        });
      }
      
      if (importedData.capsuleData) {
        if (!currentData.capsuleData) currentData.capsuleData = {};
        Object.keys(importedData.capsuleData).forEach(id => {
          if (!currentData.capsuleData[id]) {
            currentData.capsuleData[id] = importedData.capsuleData[id];
          }
        });
      }
      
      if (importedData.extractCodes) {
        if (!currentData.extractCodes) currentData.extractCodes = {};
        Object.keys(importedData.extractCodes).forEach(id => {
          if (!currentData.extractCodes[id]) {
            currentData.extractCodes[id] = importedData.extractCodes[id];
          }
        });
      }
      
      if (importedData.publicCapsulesData) {
        if (!currentData.capsuleData) currentData.capsuleData = {};
        Object.keys(importedData.publicCapsulesData).forEach(id => {
          if (!currentData.capsuleData[id]) {
            currentData.capsuleData[id] = importedData.publicCapsulesData[id];
          }
          if (!currentData.myCapsules.includes(id) && importedData.publicCapsulesData[id].meta.isPublic) {
            currentData.myCapsules.push(id);
            result.stats.capsulesAdded++;
          }
        });
      }
      
      result.success = this.saveData(currentData);
      return result;
    } catch (e) {
      console.error('导入数据失败:', e);
      result.errors.push(e.message);
      return result;
    }
  },

  clearAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

window.StorageUtils = StorageUtils;
