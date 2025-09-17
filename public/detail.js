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
        // 这里我们模拟检查cookie
        const username = getCookie('username');
        const role = getCookie('role');
        
        if (username) {
            document.getElementById('userSection').style.display = 'flex';
            document.getElementById('usernameDisplay').textContent = `欢迎, ${username}${role === 'admin' ? ' (管理员)' : ''}`;
            document.getElementById('loginLink').style.display = 'none';
            document.getElementById('registerLink').style.display = 'none';
        } else {
            document.getElementById('userSection').style.display = 'none';
            document.getElementById('loginLink').style.display = 'block';
            document.getElementById('registerLink').style.display = 'block';
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
        
        // 清除显示的用户信息
        document.getElementById('userSection').style.display = 'none';
        document.getElementById('loginLink').style.display = 'block';
        document.getElementById('registerLink').style.display = 'block';
    } catch (error) {
        console.error('登出时出错:', error);
    }
}

// 处理下载
function handleDownload() {
    const savedName = getUrlParameter('file');
    if (savedName) {
        // 构造下载链接
        const downloadUrl = `/uploads/${savedName}`;
        // 创建一个隐藏的a标签来触发下载
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = savedName; // 使用原始文件名
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// 加载文件详情
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