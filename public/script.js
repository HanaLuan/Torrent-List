const fileList = document.getElementById("fileList");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("arquivo");
const progressBar = document.getElementById("progressBar");
const status = document.getElementById("status");
const searchInput = document.getElementById("searchInput");
const loginBtn = document.getElementById("loginLink");
const registerBtn = document.getElementById("registerLink");
const logoutBtn = document.getElementById("logoutBtn");
const userSection = document.getElementById("userSection");
const usernameDisplay = document.getElementById("usernameDisplay");
// 新增：获取管理员面板链接元素
const adminPanelItem = document.getElementById("adminPanelItem");

// ---------- 上传文件类型校验 ----------
const allowedExtensions = [".torrent"];
let currentUser = null;
let currentRole = null;

// ---------- cookie 操作 ----------
function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

// ---------- 初始登录状态检查 ----------
function checkLoginStatus() {
    const username = getCookie("username");
    const role = getCookie("role");
    const progressContainer = document.getElementById("progressContainer");

    if (username) {
        currentUser = username;
        currentRole = role || "user";
        
        // 显示用户区域，隐藏登录/注册链接（仅在元素存在时操作）
        if (userSection) userSection.style.display = "flex";
        if (loginBtn && loginBtn.parentElement) loginBtn.parentElement.style.display = "none";
        if (registerBtn && registerBtn.parentElement) registerBtn.parentElement.style.display = "none";
        
        // 设置用户名显示（区分管理员）
        if (usernameDisplay) {
            usernameDisplay.textContent = `欢迎, ${username}${role === "admin" ? " (管理员)" : ""}`;
        }
        
        // 显示上传表单（仅在元素存在时操作）
        if (uploadForm) uploadForm.style.display = "block";
        if (progressContainer) progressContainer.style.display = "block";

        // 管理员显示面板链接，普通用户隐藏（仅在元素存在时操作）
        if (role === "admin" && adminPanelItem) {
            adminPanelItem.style.display = "block";
        } else if (adminPanelItem) {
            adminPanelItem.style.display = "none";
        }
    } else {
        currentUser = null;
        currentRole = null;
        
        // 隐藏用户区域，显示登录/注册链接（仅在元素存在时操作）
        if (userSection) userSection.style.display = "none";
        if (loginBtn && loginBtn.parentElement) loginBtn.parentElement.style.display = "block";
        if (registerBtn && registerBtn.parentElement) registerBtn.parentElement.style.display = "block";
        
        // 隐藏上传表单和管理员面板链接（仅在元素存在时操作）
        if (uploadForm) uploadForm.style.display = "none";
        if (progressContainer) progressContainer.style.display = "none";
        if (adminPanelItem) adminPanelItem.style.display = "none";
    }
    // 仅在文件列表元素存在时加载文件（避免管理员面板等页面报错）
    if (fileList) loadFiles();
}

// ---------- 登出 ----------
// 关键修复：仅在登出按钮存在时绑定事件，避免在无此元素的页面报错
if (logoutBtn) {
    logoutBtn.onclick = () => {
        fetch("/logout", { method: "POST" }).then(() => {
            checkLoginStatus(); // 登出后重新检查状态，自动隐藏管理员链接
        });
    };
}

// ---------- 文件选择校验 ----------
// 仅在文件输入框存在时绑定事件
if (fileInput) {
    fileInput.addEventListener("change", () => {
        const file = fileInput.files[0];
        if (!file) return;
        const ext = "." + file.name.split(".").pop().toLowerCase();
        if (!allowedExtensions.includes(ext)) {
            alert(`不允许的文件类型: ${ext}`);
            fileInput.value = "";
        }
    });
}

// ---------- 上传 ----------
// 仅在上传表单存在时绑定事件
if (uploadForm) {
    uploadForm.onsubmit = e => {
        e.preventDefault();
        if (!currentUser) {
            alert("请先登录");
            return;
        }
        
        const file = fileInput.files[0];
        if (!file) return;

        // 禁用提交按钮
        const submitBtn = uploadForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

        const formData = new FormData();
        formData.append("arquivo", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/upload", true);
        
        xhr.upload.onprogress = evt => {
            if (evt.lengthComputable) {
                const pct = Math.round((evt.loaded / evt.total) * 100);
                if (progressBar) progressBar.style.width = pct + "%";
                if (status) status.textContent = `上传中: ${pct}%`;
            }
        };
        
        xhr.onload = () => {
            if (submitBtn) submitBtn.disabled = false;
            if (xhr.status === 200) {
                const data = JSON.parse(xhr.responseText);
                if (data.success) {
                    if (status) status.textContent = "上传成功!";
                    if (progressBar) progressBar.style.width = "100%";
                    if (fileList) loadFiles();
                    setTimeout(() => {
                        if (progressBar) progressBar.style.width = "0%";
                        if (status) status.textContent = "";
                        if (fileInput) fileInput.value = "";
                    }, 1000);
                } else {
                    if (status) status.textContent = `上传失败: ${data.message || "未知错误"}`;
                }
            } else {
                if (status) status.textContent = `上传失败 (${xhr.status}): 服务器错误`;
            }
            setTimeout(() => {
                if (progressBar) progressBar.style.width = "0%";
            }, 1000);
        };

        xhr.onerror = () => {
            if (status) status.textContent = "上传失败: 网络错误";
            if (submitBtn) submitBtn.disabled = false;
            setTimeout(() => {
                if (progressBar) progressBar.style.width = "0%";
            }, 1000);
        };
        
        xhr.send(formData);
    };
}

// ---------- 获取文件列表 ----------
function loadFiles() {
    fetch("/files")
        .then(res => res.json())
        .then(files => {
            if (!fileList) return; // 若文件列表元素不存在，直接返回
            const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
            fileList.innerHTML = "";

            files
                .filter(f => {
                    const nameMatch = f.originalName.toLowerCase().includes(searchValue);
                    const uploaderMatch = f.uploader.toLowerCase().includes(searchValue);
                    return nameMatch || uploaderMatch;
                })
                .forEach(f => {
                    const li = document.createElement("li");
                    li.className = "file-item";

                    // 文件信息
                    const fileInfo = document.createElement("div");
                    fileInfo.className = "file-info";
                    
                    const link = document.createElement("a");
                    link.href = `detail.html?file=${encodeURIComponent(f.savedName)}`;
                    link.className = "link";
                    link.textContent = f.originalName;
                    
                    const meta = document.createElement("div");
                    meta.className = "file-meta";
                    meta.textContent = `${f.uploader} | ${new Date(f.uploadTime).toLocaleString()}`;
                    
                    fileInfo.appendChild(link);
                    fileInfo.appendChild(meta);
                    li.appendChild(fileInfo);

                    // 文件操作
                    const fileActions = document.createElement("div");
                    fileActions.className = "file-actions";
                    
                    // 下载按钮
                    const downloadBtn = document.createElement("button");
                    downloadBtn.className = "btn";
                    downloadBtn.textContent = "下载";
                    downloadBtn.onclick = () => {
                        const downloadUrl = `/uploads/${encodeURIComponent(f.savedName)}`;
                        const a = document.createElement("a");
                        a.href = downloadUrl;
                        a.download = decodeURIComponent(encodeURIComponent(f.originalName)); // 处理特殊字符
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                    };
                    
                    fileActions.appendChild(downloadBtn);

                    // 删除按钮（仅上传者或管理员可见）
                    if (currentUser && (currentUser === f.uploader || currentRole === "admin")) {
                        const delBtn = document.createElement("button");
                        delBtn.className = "btn btn-danger";
                        delBtn.textContent = "删除";
                        delBtn.onclick = () => {
                            if (confirm("确定要删除此文件吗？")) {
                                fetch("/delete", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ savedName: f.savedName })
                                })
                                .then(res => res.json())
                                .then(data => {
                                    if (data.success && fileList) loadFiles();
                                    else alert(data.message || "删除失败");
                                });
                            }
                        };
                        fileActions.appendChild(delBtn);
                    }

                    li.appendChild(fileActions);
                    fileList.appendChild(li);
                });

            // 空列表提示
            if (fileList.children.length === 0) {
                const emptyLi = document.createElement("li");
                emptyLi.className = "file-item empty";
                emptyLi.textContent = "未找到匹配的文件";
                fileList.appendChild(emptyLi);
            }
        })
        .catch(err => {
            console.error("加载文件列表失败:", err);
            if (fileList) {
                fileList.innerHTML = '<li class="file-item empty">加载文件失败，请刷新页面</li>';
            }
        });
}

// ---------- 搜索框输入监听 ----------
if (searchInput) {
    searchInput.addEventListener("input", loadFiles);
}

// ---------- 页面初始状态 ----------
document.addEventListener('DOMContentLoaded', function() {
  // 检查登录状态
  checkLoginStatus();
  
  // 登出按钮事件监听器
  document.getElementById('logoutBtn').addEventListener('click', function() {
    fetch('/logout', {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // 清除用户界面
        document.getElementById('loginLink').style.display = 'block';
        document.getElementById('registerLink').style.display = 'block';
        document.getElementById('userSection').style.display = 'none';
        document.getElementById('adminPanelItem').style.display = 'none';
        // 跳转到首页
        window.location.href = 'index.html';
      }
    });
  });

  // 文件选择校验
  document.getElementById('arquivo').addEventListener('change', function() {
    const file = this.files[0];
    if (!file) return;
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
      alert(`不允许的文件类型: ${ext}`);
      this.value = '';
    }
  });

  // 上传表单提交
  document.getElementById('uploadForm').addEventListener('submit', function(e) {
    e.preventDefault();
    if (!currentUser) {
      alert('请先登录');
      return;
    }
    
    const file = document.getElementById('arquivo').files[0];
    if (!file) return;

    // 禁用提交按钮
    const submitBtn = this.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append('arquivo', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/upload', true);
    
    xhr.upload.onprogress = evt => {
      if (evt.lengthComputable) {
        const pct = Math.round((evt.loaded / evt.total) * 100);
        if (progressBar) progressBar.style.width = pct + '%';
        if (status) status.textContent = `上传中: ${pct}%`;
      }
    };
    
    xhr.onload = () => {
      if (submitBtn) submitBtn.disabled = false;
      if (xhr.status === 200) {
        const data = JSON.parse(xhr.responseText);
        if (data.success) {
          if (status) status.textContent = '上传成功!';
          if (progressBar) progressBar.style.width = '100%';
          if (fileList) loadFiles();
          setTimeout(() => {
            if (progressBar) progressBar.style.width = '0%';
            if (status) status.textContent = '';
            if (fileInput) fileInput.value = '';
          }, 1000);
        } else {
          if (status) status.textContent = `上传失败: ${data.message || '未知错误'}`;
        }
      } else {
        if (status) status.textContent = `上传失败 (${xhr.status}): 服务器错误`;
      }
      setTimeout(() => {
        if (progressBar) progressBar.style.width = '0%';
      }, 1000);
    };

    xhr.onerror = () => {
      if (status) status.textContent = '上传失败: 网络错误';
      if (submitBtn) submitBtn.disabled = false;
      setTimeout(() => {
        if (progressBar) progressBar.style.width = '0%';
      }, 1000);
    };
    
    xhr.send(formData);
  });

  // 获取文件列表
  function loadFiles() {
    fetch('/files')
      .then(res => res.json())
      .then(files => {
        if (!fileList) return; // 若文件列表元素不存在，直接返回
        const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : '';
        fileList.innerHTML = '';

        files
          .filter(f => {
            const nameMatch = f.originalName.toLowerCase().includes(searchValue);
            const uploaderMatch = f.uploader.toLowerCase().includes(searchValue);
            return nameMatch || uploaderMatch;
          })
          .forEach(f => {
            const li = document.createElement('li');
            li.className = 'file-item';

            // 文件信息
            const fileInfo = document.createElement('div');
            fileInfo.className = 'file-info';
            
            const link = document.createElement('a');
            link.href = `detail.html?file=${encodeURIComponent(f.savedName)}`;
            link.className = 'link';
            link.textContent = f.originalName;
            
            const meta = document.createElement('div');
            meta.className = 'file-meta';
            meta.textContent = `${f.uploader} | ${new Date(f.uploadTime).toLocaleString()}`;
            
            fileInfo.appendChild(link);
            fileInfo.appendChild(meta);
            li.appendChild(fileInfo);

            // 文件操作
            const fileActions = document.createElement('div');
            fileActions.className = 'file-actions';
            
            // 下载按钮
            const downloadBtn = document.createElement('button');
            downloadBtn.className = 'btn';
            downloadBtn.textContent = '下载';
            downloadBtn.onclick = () => {
              const downloadUrl = `/uploads/${encodeURIComponent(f.savedName)}`;
              const a = document.createElement('a');
              a.href = downloadUrl;
              a.download = decodeURIComponent(encodeURIComponent(f.originalName)); // 处理特殊字符
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
            };
            
            fileActions.appendChild(downloadBtn);

            // 删除按钮（仅上传者或管理员可见）
            if (currentUser && (currentUser === f.uploader || currentRole === 'admin')) {
              const delBtn = document.createElement('button');
              delBtn.className = 'btn btn-danger';
              delBtn.textContent = '删除';
              delBtn.onclick = () => {
                if (confirm('确定要删除此文件吗？')) {
                  fetch('/delete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ savedName: f.savedName })
                  })
                  .then(res => res.json())
                  .then(data => {
                    if (data.success && fileList) loadFiles();
                    else alert(data.message || '删除失败');
                  });
                }
              };
              fileActions.appendChild(delBtn);
            }

            li.appendChild(fileActions);
            fileList.appendChild(li);
          });

        // 空列表提示
        if (fileList.children.length === 0) {
          const emptyLi = document.createElement('li');
          emptyLi.className = 'file-item empty';
          emptyLi.textContent = '未找到匹配的文件';
          fileList.appendChild(emptyLi);
        }
      })
      .catch(err => {
        console.error('加载文件列表失败:', err);
        if (fileList) {
          fileList.innerHTML = '<li class="file-item empty">加载文件失败，请刷新页面</li>';
        }
      });
  }

  // 搜索框输入监听
  if (searchInput) {
    searchInput.addEventListener('input', loadFiles);
  }
});

// 检查用户登录状态
function checkLoginStatus() {
  const username = getCookie('username');
  const role = getCookie('role');
  
  if (username) {
    // 用户已登录
    document.getElementById('loginLink').style.display = 'none';
    document.getElementById('registerLink').style.display = 'none';
    document.getElementById('userSection').style.display = 'flex';
    document.getElementById('usernameDisplay').textContent = username;
    
    // 如果是管理员，显示管理员面板链接
    if (role === 'admin') {
      document.getElementById('adminPanelItem').style.display = 'block';
    }
  } else {
    // 用户未登录
    document.getElementById('userSection').style.display = 'none';
    document.getElementById('adminPanelItem').style.display = 'none';
  }
}

// 获取Cookie值
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}
