const FileUtils = {
  downloadJSON(data, filename) {
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  readJSONFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || file.type !== 'application/json') {
        reject(new Error('请选择JSON文件'));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(new Error('JSON文件格式错误'));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  },

  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsArrayBuffer(file);
    });
  },

  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  },

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  },

  stringToArrayBuffer(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str).buffer;
  },

  arrayBufferToString(buffer) {
    const decoder = new TextDecoder();
    return decoder.decode(buffer);
  },

  copyToClipboard(text) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        return true;
      } catch (e) {
        return false;
      } finally {
        document.body.removeChild(textarea);
      }
    });
  },

  validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  },

  generateCapsuleFilename(capsule) {
    const date = new Date(capsule.meta.createdAt * 1000);
    const dateStr = `${date.getFullYear()}${date.getMonth() + 1}${date.getDate()}`;
    const title = capsule.meta.title ? capsule.meta.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_') : 'capsule';
    return `time_capsule_${title}_${dateStr}.json`;
  },

  triggerFileInput(accept = '.json') {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.style.display = 'none';
      
      input.onchange = (e) => {
        const file = e.target.files[0];
        if (file) {
          resolve(file);
        } else {
          reject(new Error('未选择文件'));
        }
        document.body.removeChild(input);
      };
      
      input.oncancel = () => {
        reject(new Error('取消选择'));
        document.body.removeChild(input);
      };
      
      document.body.appendChild(input);
      input.click();
    });
  }
};

window.FileUtils = FileUtils;
