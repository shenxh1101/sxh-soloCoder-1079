const StorageUtils = {
  STORAGE_KEY: 'time_capsule_data',

  getDefaultData() {
    return {
      capsules: {},
      myCapsules: [],
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
        return JSON.parse(data);
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

  addMyCapsule(capsuleId) {
    const data = this.getData();
    if (!data.myCapsules.includes(capsuleId)) {
      data.myCapsules.push(capsuleId);
      this.saveData(data);
    }
  },

  getMyCapsules() {
    const data = this.getData();
    return data.myCapsules || [];
  },

  exportAllData() {
    return this.getData();
  },

  importData(importedData) {
    try {
      const currentData = this.getData();
      
      if (importedData.capsules) {
        Object.keys(importedData.capsules).forEach(id => {
          if (!currentData.capsules[id]) {
            currentData.capsules[id] = importedData.capsules[id];
          } else {
            const existing = currentData.capsules[id];
            const imported = importedData.capsules[id];
            existing.likes = Math.max(existing.likes || 0, imported.likes || 0);
            existing.liked = existing.liked || imported.liked;
            if (imported.comments && imported.comments.length > 0) {
              const existingCommentIds = new Set((existing.comments || []).map(c => c.id));
              imported.comments.forEach(comment => {
                if (!existingCommentIds.has(comment.id)) {
                  existing.comments.push(comment);
                }
              });
            }
          }
        });
      }
      
      if (importedData.myCapsules) {
        importedData.myCapsules.forEach(id => {
          if (!currentData.myCapsules.includes(id)) {
            currentData.myCapsules.push(id);
          }
        });
      }
      
      return this.saveData(currentData);
    } catch (e) {
      console.error('导入数据失败:', e);
      return false;
    }
  },

  clearAllData() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

window.StorageUtils = StorageUtils;
