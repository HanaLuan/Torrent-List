// 检查用户登录状态
function checkLoginStatus() {
  fetch('/files')
    .then(response => response.json())
    .then(files => {
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
        
        // 加载用户信息
        loadUserInfo(username);
        
        // 加载用户上传的文件
        loadUserUploads(username, files);
      } else {
        // 用户未登录，跳转到登录页面
        window.location.href = 'login.html';
      }
    });
}

// 获取Cookie值
function getCookie(name) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop().split(';').shift();
}

// 加载用户信息
function loadUserInfo(username) {
  const userInfoDiv = document.getElementById('userInfo');
  userInfoDiv.innerHTML = `
    <div class="detail-section">
      <h3>基本信息</h3>
      <div class="detail-info">
        <p><strong>用户名:</strong> ${username}</p>
        <p><strong>注册时间:</strong> ${new Date().toLocaleDateString('zh-CN')}</p>
      </div>
    </div>
  `;
}

// 加载用户上传的文件
function loadUserUploads(username, allFiles) {
  const userFiles = allFiles.filter(file => file.uploader === username);
  const fileList = document.getElementById('userUploads');
  
  if (userFiles.length === 0) {
    fileList.innerHTML = '<li class="file-item">暂无上传记录</li>';
    return;
  }
  
  fileList.innerHTML = userFiles.map(file => {
    const uploadTime = new Date(file.uploadTime).toLocaleString('zh-CN');
    return `
      <li class="file-item">
        <div class="file-info">
          <h3>${file.originalName}</h3>
          <div class="file-meta">
            <p>上传时间: ${uploadTime}</p>
            ${file.torrentMeta && file.torrentMeta.name ? `<p>种子名称: ${file.torrentMeta.name}</p>` : ''}
            ${file.torrentMeta && file.torrentMeta.prettyTotalSize ? `<p>文件大小: ${file.torrentMeta.prettyTotalSize}</p>` : ''}
          </div>
        </div>
        <div class="file-actions">
          <a href="/uploads/${file.savedName}" class="btn" download>下载</a>
          <button class="btn btn-danger" onclick="deleteFile('${file.savedName}')">删除</button>
        </div>
      </li>
    `;
  }).join('');
}

// 删除文件
function deleteFile(savedName) {
  if (!confirm('确定要删除这个文件吗？')) {
    return;
  }
  
  fetch('/delete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ savedName })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      alert('文件删除成功');
      // 重新加载页面以更新文件列表
      location.reload();
    } else {
      alert('删除失败: ' + data.message);
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert('删除失败，请稍后重试');
  });
}

// 修改密码
document.addEventListener('DOMContentLoaded', function() {
  checkLoginStatus();
  
  document.getElementById('changePasswordForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const oldPassword = document.getElementById('oldPassword').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmNewPassword = document.getElementById('confirmNewPassword').value;
    const messageEl = document.getElementById('passwordMessage');
    
    // 检查新密码和确认密码是否一致
    if (newPassword !== confirmNewPassword) {
      messageEl.innerHTML = '<div class="alert alert-error">新密码和确认密码不一致</div>';
      return;
    }
    
    // 发送修改密码请求
    fetch('/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ oldPassword, newPassword })
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        messageEl.innerHTML = '<div class="alert alert-success">密码修改成功</div>';
        // 清空表单
        document.getElementById('changePasswordForm').reset();
      } else {
        messageEl.innerHTML = `<div class="alert alert-error">${data.message}</div>`;
      }
    })
    .catch(error => {
      console.error('Error:', error);
      messageEl.innerHTML = '<div class="alert alert-error">修改密码失败，请稍后重试</div>';
    });
  });
  
  document.getElementById('logoutBtn').addEventListener('click', function() {
    fetch('/logout', {
      method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        window.location.href = 'index.html';
      }
    });
  });
});