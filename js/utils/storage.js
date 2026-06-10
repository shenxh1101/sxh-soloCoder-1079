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
      shareLinks: {},
      importReports: [],
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
          capsules: parsed.capsules || defaults.capsules,
          myCapsules: parsed.myCapsules || defaults.myCapsules,
          capsuleData: parsed.capsuleData || defaults.capsuleData,
          extractCodes: parsed.extractCodes || defaults.extractCodes,
          shareLinks: parsed.shareLinks || defaults.shareLinks,
          importReports: parsed.importReports || defaults.importReports,
          settings: { ...defaults.settings, ...(parsed.settings || {}) }
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
    if (data.shareLinks) {
      delete data.shareLinks[capsuleId];
    }
    this.saveData(data);
  },

  getCapsuleMigrationStatus(capsuleId) {
    const data = this.getData();
    const capsule = data.capsuleData ? data.capsuleData[capsuleId] : null;
    const extractCodes = data.extractCodes ? data.extractCodes[capsuleId] : null;
    const storedCapsule = localStorage.getItem(`capsule_${capsuleId}`);

    const status = {
      capsuleId,
      capsule,
      hasCapsuleData: !!capsule,
      hasExtractCodes: !!extractCodes && extractCodes.length > 0,
      hasStoredFile: !!storedCapsule,
      isPublic: capsule && capsule.meta && capsule.meta.isPublic,
      issues: []
    };

    if (!capsule) {
      status.issues.push({ type: 'missing_data', message: '缺少胶囊完整数据', action: 'download' });
    }
    if (!extractCodes || extractCodes.length === 0) {
      status.issues.push({ type: 'missing_codes', message: '缺少提取码记录', action: 'recreate' });
    }
    if (!storedCapsule && capsule) {
      status.issues.push({ type: 'missing_file', message: '本地缺少胶囊JSON文件', action: 'redownload' });
    }
    if (capsule && capsule.meta && capsule.meta.isPublic) {
      status.isVisibleInPlaza = true;
    } else {
      status.isVisibleInPlaza = false;
      if (capsule && !capsule.meta.isPublic) {
        status.issues.push({ type: 'private', message: '胶囊为私密状态，仅本地可见', action: 'make_public' });
      }
    }

    return status;
  },

  getAllMigrationStatus() {
    const data = this.getData();
    const result = {
      capsules: [],
      summary: {
        total: 0,
        visibleInPlaza: 0,
        localOnly: 0,
        hasIssues: 0,
        missingData: 0,
        missingCodes: 0,
        missingFiles: 0
      }
    };

    if (data.myCapsules) {
      result.summary.total = data.myCapsules.length;
      data.myCapsules.forEach(id => {
        const status = this.getCapsuleMigrationStatus(id);
        result.capsules.push(status);
        
        if (status.isVisibleInPlaza) {
          result.summary.visibleInPlaza++;
        } else {
          result.summary.localOnly++;
        }
        
        if (status.issues.length > 0) {
          result.summary.hasIssues++;
          status.issues.forEach(issue => {
            if (issue.type === 'missing_data') result.summary.missingData++;
            if (issue.type === 'missing_codes') result.summary.missingCodes++;
            if (issue.type === 'missing_file') result.summary.missingFiles++;
          });
        }
      });
    }

    return result;
  },

  createShareLink(capsuleId) {
    const data = this.getData();
    const capsule = data.capsuleData ? data.capsuleData[capsuleId] : null;
    
    if (!capsule || !capsule.meta || !capsule.meta.isPublic) {
      return null;
    }

    const shareCode = TimeUtils.generateRandomCode(12);
    const shareLink = {
      id: shareCode,
      capsuleId,
      capsuleTitle: capsule.meta.title,
      createdAt: TimeUtils.getCurrentTimestamp(),
      lastSharedAt: TimeUtils.getCurrentTimestamp(),
      shareCount: 1,
      isActive: true,
      url: `${window.location.origin}${window.location.pathname}?share=${shareCode}`
    };

    if (!data.shareLinks) {
      data.shareLinks = {};
    }
    data.shareLinks[capsuleId] = shareLink;
    this.saveData(data);
    
    return shareLink;
  },

  getShareLinks() {
    const data = this.getData();
    return data.shareLinks || {};
  },

  getShareLink(capsuleId) {
    const data = this.getData();
    return data.shareLinks ? data.shareLinks[capsuleId] : null;
  },

  revokeShareLink(capsuleId) {
    const data = this.getData();
    if (data.shareLinks && data.shareLinks[capsuleId]) {
      data.shareLinks[capsuleId].isActive = false;
      data.shareLinks[capsuleId].revokedAt = TimeUtils.getCurrentTimestamp();
      this.saveData(data);
      return true;
    }
    return false;
  },

  reactivateShareLink(capsuleId) {
    const data = this.getData();
    if (data.shareLinks && data.shareLinks[capsuleId]) {
      data.shareLinks[capsuleId].isActive = true;
      data.shareLinks[capsuleId].revokedAt = null;
      data.shareLinks[capsuleId].lastSharedAt = TimeUtils.getCurrentTimestamp();
      data.shareLinks[capsuleId].shareCount = (data.shareLinks[capsuleId].shareCount || 0) + 1;
      this.saveData(data);
      return true;
    }
    return false;
  },

  updateShareLinkUsage(capsuleId) {
    const data = this.getData();
    if (data.shareLinks && data.shareLinks[capsuleId]) {
      data.shareLinks[capsuleId].lastSharedAt = TimeUtils.getCurrentTimestamp();
      data.shareLinks[capsuleId].shareCount++;
      this.saveData(data);
      return data.shareLinks[capsuleId];
    }
    return null;
  },

  saveImportReport(report) {
    const data = this.getData();
    if (!data.importReports) {
      data.importReports = [];
    }
    const reportWithId = {
      ...report,
      id: TimeUtils.generateRandomCode(8),
      createdAt: TimeUtils.getCurrentTimestamp()
    };
    data.importReports.unshift(reportWithId);
    if (data.importReports.length > 10) {
      data.importReports = data.importReports.slice(0, 10);
    }
    this.saveData(data);
    return reportWithId;
  },

  getImportReports() {
    const data = this.getData();
    return data.importReports || [];
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
        commentsAdded: 0,
        extractCodesAdded: 0,
        publicCapsulesSynced: 0
      },
      details: {
        addedCapsules: [],
        skippedCapsules: [],
        mergedComments: [],
        failedItems: []
      },
      errors: []
    };
    
    try {
      const currentData = this.getData();
      
      if (importedData.capsules) {
        Object.keys(importedData.capsules).forEach(id => {
          const imported = importedData.capsules[id];
          const capsuleTitle = imported.title || '未知胶囊';
          
          if (!currentData.capsules[id]) {
            currentData.capsules[id] = { ...imported };
            const commentCount = (imported.comments || []).length;
            const likeCount = imported.likes || 0;
            result.stats.commentsAdded += commentCount;
            result.stats.likesUpdated += likeCount;
            result.details.addedCapsules.push({
              id,
              title: capsuleTitle,
              comments: commentCount,
              likes: likeCount
            });
            
            if (commentCount > 0) {
              result.details.mergedComments.push({
                capsuleId: id,
                capsuleTitle,
                count: commentCount,
                action: '新增'
              });
            }
          } else {
            const existing = currentData.capsules[id];
            const oldLikes = existing.likes || 0;
            const likesBefore = existing.likes || 0;
            existing.likes = Math.max(oldLikes, imported.likes || 0);
            
            let likesDiff = 0;
            if (existing.likes > oldLikes) {
              likesDiff = existing.likes - oldLikes;
              result.stats.likesUpdated += likesDiff;
            }
            
            existing.liked = existing.liked || imported.liked;
            
            let commentsAddedThis = 0;
            if (imported.comments && imported.comments.length > 0) {
              const existingCommentIds = new Set((existing.comments || []).map(c => c.id));
              imported.comments.forEach(comment => {
                if (!existingCommentIds.has(comment.id)) {
                  if (!existing.comments) existing.comments = [];
                  existing.comments.push(comment);
                  commentsAddedThis++;
                }
              });
              result.stats.commentsAdded += commentsAddedThis;
              
              if (commentsAddedThis > 0) {
                result.details.mergedComments.push({
                  capsuleId: id,
                  capsuleTitle,
                  count: commentsAddedThis,
                  action: '合并'
                });
              }
            }
            
            if (existing.likes === likesBefore && commentsAddedThis === 0) {
              result.stats.capsulesSkipped++;
              result.details.skippedCapsules.push({
                id,
                title: capsuleTitle,
                reason: '无更新内容'
              });
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
            if (importedData.capsuleData[id].meta && importedData.capsuleData[id].meta.isPublic) {
              result.stats.publicCapsulesSynced++;
            }
          }
        });
      }
      
      if (importedData.extractCodes) {
        if (!currentData.extractCodes) currentData.extractCodes = {};
        Object.keys(importedData.extractCodes).forEach(id => {
          if (!currentData.extractCodes[id]) {
            currentData.extractCodes[id] = importedData.extractCodes[id];
            result.stats.extractCodesAdded++;
          }
        });
      }
      
      if (importedData.publicCapsulesData) {
        if (!currentData.capsuleData) currentData.capsuleData = {};
        Object.keys(importedData.publicCapsulesData).forEach(id => {
          if (!currentData.capsuleData[id]) {
            currentData.capsuleData[id] = importedData.publicCapsulesData[id];
            result.stats.publicCapsulesSynced++;
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
      result.details.failedItems.push({
        error: e.message,
        timestamp: Date.now()
      });
      return result;
    }
  },

  clearAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

window.StorageUtils = StorageUtils;
