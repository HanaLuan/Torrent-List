// 新增全局变量：存储当前文件详情（用于下载时获取originalName）
let currentFile = null;

// 获取URL参数
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    loadFileDetail();
    setupEventListeners();
});

// 检查登录状态
async function checkLoginStatus() {
    try {
        const username = getCookie('username');
        const role = getCookie('role');
        
        if (username) {
            document.getElementById('userSection').style.display = 'flex';
            document.getElementById('usernameDisplay').textContent = `欢迎, ${username}${role === 'admin' ? ' (管理员)' : ''}`;
            // 彻底移除登录/注册按钮
            const loginElem = document.getElementById("loginLink");
            if (loginElem) loginElem.parentElement.remove();
            const registerElem = document.getElementById("registerLink");
            if (registerElem) registerElem.parentElement.remove();
        } else {
            document.getElementById('userSection').style.display = 'none';
        }
    } catch (error) {
        console.error('检查登录状态时出错:', error);
    }
}

// 获取cookie值
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// 设置事件监听器
function setupEventListeners() {
    // 登出按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 下载按钮
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) {
        downloadBtn.addEventListener('click', handleDownload);
    }
}

// 处理登出
async function handleLogout() {
    try {
        await fetch('/logout', {
            method: 'POST'
        });

        // 隐藏用户区域
        document.getElementById('userSection').style.display = 'none';

        // 如果登录/注册按钮已被移除，则动态添加回来
        const navbarNav = document.querySelector('.navbar-nav');
        if (!document.getElementById('loginLink')) {
            const loginLi = document.createElement('li');
            loginLi.className = 'nav-item';
            const loginA = document.createElement('a');
            loginA.href = 'login.html';
            loginA.className = 'nav-link';
            loginA.id = 'loginLink';
            loginA.textContent = '登录';
            loginLi.appendChild(loginA);
            navbarNav.insertBefore(loginLi, navbarNav.firstElementChild.nextElementSibling);
        }
        if (!document.getElementById('registerLink')) {
            const registerLi = document.createElement('li');
            registerLi.className = 'nav-item';
            const registerA = document.createElement('a');
            registerA.href = 'register.html';
            registerA.className = 'nav-link';
            registerA.id = 'registerLink';
            registerA.textContent = '注册';
            registerLi.appendChild(registerA);
            navbarNav.insertBefore(registerLi, navbarNav.firstElementChild.nextElementSibling.nextElementSibling);
        }
    } catch (error) {
        console.error('登出时出错:', error);
    }
}

// 修改下载逻辑：使用currentFile中的originalName作为下载文件名
function handleDownload() {
    if (currentFile && currentFile.savedName && currentFile.originalName) {
        const downloadUrl = `/uploads/${encodeURIComponent(currentFile.savedName)}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        // 关键修改：先编码再解码，还原特殊字符
        a.download = decodeURIComponent(encodeURIComponent(currentFile.originalName));
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    } else {
        alert('文件信息加载失败，无法下载');
    }
}

// 加载文件详情时，保存文件信息到全局变量currentFile
async function loadFileDetail() {
    const savedName = getUrlParameter('file');
    const detailEl = document.getElementById('fileDetail');
    
    if (!savedName) {
        detailEl.innerHTML = '<div class="alert alert-error">未指定文件</div>';
        return;
    }
    
    try {
        const response = await fetch(`/file/${encodeURIComponent(savedName)}`);
        const data = await response.json();
        
        if (data.success) {
            currentFile = data.file; // 保存文件详情到全局变量
            displayFileDetail(data.file);
        } else {
            detailEl.innerHTML = `<div class="alert alert-error">${data.message}</div>`;
        }
    } catch (error) {
        console.error('加载文件详情时出错:', error);
        detailEl.innerHTML = '<div class="alert alert-error">加载文件详情时发生错误</div>';
    }
}

// 显示文件详情
function displayFileDetail(file) {
    const detailEl = document.getElementById('fileDetail');
    const uploadTime = new Date(file.uploadTime).toLocaleString('zh-CN');
    
    let html = `
        <div class="detail-section">
            <h3>基本信息</h3>
            <div class="detail-info">
                <p><strong>文件名:</strong> ${file.originalName}</p>
                <p><strong>上传者:</strong> ${file.uploader}</p>
                <p><strong>上传时间:</strong> ${uploadTime}</p>
            </div>
        </div>
    `;
    
    if (file.torrentMeta && !file.torrentMeta.error) {
        html += `
            <div class="detail-section">
                <h3>种子信息</h3>
                <div class="detail-info">
                    <p><strong>名称:</strong> ${file.torrentMeta.name || '未知'}</p>
                    <p><strong>InfoHash:</strong> ${file.torrentMeta.infoHash || '未知'}</p>
                    <p><strong>总大小:</strong> ${file.torrentMeta.prettyTotalSize || '未知'}</p>
                    <p><strong>创建时间:</strong> ${file.torrentMeta.created ? new Date(file.torrentMeta.created).toLocaleString('zh-CN') : '未知'}</p>
                </div>
            </div>
        `;
        
        if (file.torrentMeta.files && file.torrentMeta.files.length > 0) {
            html += `
                <div class="detail-section">
                    <h3>文件列表</h3>
                    <div class="detail-info">
            `;
            
            file.torrentMeta.files.forEach(f => {
                html += `<p>${f.path} (${f.prettySize})</p>`;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
        
        if (file.torrentMeta.announce && file.torrentMeta.announce.length > 0) {
            html += `
                <div class="detail-section">
                    <h3>Tracker服务器</h3>
                    <div class="detail-info">
            `;
            
            file.torrentMeta.announce.forEach(tracker => {
                html += `<p>${tracker}</p>`;
            });
            
            html += `
                    </div>
                </div>
            `;
        }
    } else {
        html += `
            <div class="detail-section">
                <h3>种子信息</h3>
                <div class="alert alert-error">
                    无法解析种子信息
                </div>
            </div>
        `;
    }
    
    detailEl.innerHTML = html;
}
