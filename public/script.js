const fileList = document.getElementById("fileList");
const uploadForm = document.getElementById("uploadForm");
const fileInput = document.getElementById("arquivo");
const progressBar = document.getElementById("progressBar");
const status = document.getElementById("status");
const searchInput = document.getElementById("searchInput");

// ---------- 上传文件类型校验 ----------
const allowedExtensions = [".torrent"];
const loginBtn = document.getElementById("loginBtn");
const registerBtn = document.getElementById("registerBtn");
const logoutBtn = document.getElementById("logoutBtn");
const authModal = document.getElementById("authModal");
const closeModal = document.querySelector(".close");
const authForm = document.getElementById("authForm");
const modalTitle = document.getElementById("modalTitle");
const authMsg = document.getElementById("authMsg");

let authMode = "login"; // login / register

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
    const usernameDisplay = document.getElementById("usernameDisplay");

    if (username) {
        currentUser = username;
        currentRole = role || "user";
        loginBtn.style.display = "none";
        registerBtn.style.display = "none";
        logoutBtn.style.display = "inline-block";
        uploadForm.style.display = "block";
        progressContainer.style.display = "block"; // 显示上传进度条
        // 显示用户名
        usernameDisplay.textContent = `欢迎, ${username}`;
        usernameDisplay.style.display = "inline";

    } else {
        currentUser = null;
        currentRole = null;
        loginBtn.style.display = "inline-block";
        registerBtn.style.display = "inline-block";
        logoutBtn.style.display = "none";
        uploadForm.style.display = "none";
        progressContainer.style.display = "none"; // 隐藏上传进度条
        // 隐藏用户名
        usernameDisplay.style.display = "none";
    }
    loadFiles(); // 确保每次状态变化都刷新文件列表
}

// ---------- 弹窗操作 ----------
loginBtn.onclick = () => { authMode="login"; modalTitle.textContent="登录"; authMsg.textContent=""; authModal.style.display="block";}
registerBtn.onclick = () => { authMode="register"; modalTitle.textContent="注册"; authMsg.textContent=""; authModal.style.display="block";}
closeModal.onclick = () => authModal.style.display="none";
window.onclick = e => { if(e.target==authModal) authModal.style.display="none";}

// ---------- 登录/注册表单提交 ----------
authForm.onsubmit = e => {
    e.preventDefault();
    const formData = new FormData(authForm);
    fetch(`/${authMode}`,{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ username: formData.get("username"), password: formData.get("password") })
    })
    .then(res=>res.json())
    .then(data => {
        if (data.success) {
            authModal.style.display = "none";
            checkLoginStatus(); // 刷新所有状态
        } else authMsg.textContent = data.message;
    });
};

// ---------- 登出 ----------
logoutBtn.onclick = () => {
    fetch("/logout",{method:"POST"}).then(()=>{
        checkLoginStatus(); // 刷新登录状态和上传表单
    });
};

// ---------- 文件选择校验 ----------
fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const ext = "." + file.name.split(".").pop().toLowerCase();
    if (!allowedExtensions.includes(ext)) {
        alert(`不允许的文件类型: ${ext}`);
        fileInput.value = "";
    }
});

// ---------- 上传 ----------
uploadForm.onsubmit = e => {
    e.preventDefault();
    if(!currentUser) { alert("请先登录"); return; }
    const file = fileInput.files[0];
    if(!file) return;

    // 新建临时按钮禁用状态
    const submitBtn = uploadForm.querySelector('input[type="submit"]');
    submitBtn.disabled = true;

    const formData = new FormData();
    formData.append("arquivo", file);

    const xhr = new XMLHttpRequest();
    xhr.open("POST","/upload",true);
    xhr.upload.onprogress = evt => { 
        if(evt.lengthComputable){ 
            const pct=Math.round((evt.loaded/evt.total)*100); 
            progressBar.style.width=pct+"%"; 
            status.textContent=`上传中: ${pct}%`; 
        }
    };
    xhr.onload = () => { 
        submitBtn.disabled = false;
        if(xhr.status===200){ 
            status.textContent="上传成功!";
            progressBar.style.width="100%"; 
            loadFiles(); // 上传成功后立即刷新文件列表
            setTimeout(()=>{
                progressBar.style.width = "0%";
                status.textContent = "";
                fileInput.value = "";
            },1000);
        } else {
            status.textContent="上传失败"; 
            setTimeout(()=>{ progressBar.style.width = "0%"; },1000);
        }
    };

    xhr.onerror = () => {
        status.textContent="上传失败";
        submitBtn.disabled = false;
        setTimeout(()=>{ progressBar.style.width = "0%"; },1000);
    };
    xhr.send(formData);
};

// ---------- 获取文件列表 ----------
function loadFiles() {
    fetch("/files").then(res => res.json()).then(files => {
        const searchValue = searchInput ? searchInput.value.trim().toLowerCase() : "";
        fileList.innerHTML = "";

        files
        .filter(f => {
            const nameMatch = f.originalName.toLowerCase().includes(searchValue);
            const uploaderMatch = f.uploader.toLowerCase().includes(searchValue);
            return nameMatch || uploaderMatch; // 文件名或上传者匹配
        })
        .forEach(f => {
            const li = document.createElement("li");

            // 文件名（点击跳转 detail.html）
            const span = document.createElement("span");
            span.textContent = `${f.originalName} (${f.uploader} / ${new Date(f.uploadTime).toLocaleString()})`;
            span.style.cursor = "pointer";
            span.style.textDecoration = "underline";
            span.onclick = () => {
                window.location.href = `detail.html?file=${encodeURIComponent(f.savedName)}`;
            };
            li.appendChild(span);

            // 下载按钮
            const downloadBtn = document.createElement("button");
            downloadBtn.className = "Btn";
            downloadBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" class="svgIcon">
                <path d="M169.4 470.6c12.5 12.5 32.8 12.5 45.3 0l160-160c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L224 370.8 224 64c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 306.7L54.6 265.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l160 160z"></path>
            </svg>
            <span class="icon2"></span>
            `;
            downloadBtn.onclick = () => {
                window.open(`/uploads/${encodeURIComponent(f.savedName)}`, "_blank");
            };
            li.appendChild(downloadBtn);

            // 删除按钮（仅上传者或管理员可见）
            if(currentUser && (currentUser===f.uploader || currentRole==="admin")){
                const delBtn = document.createElement("button");
                delBtn.className = "button";
                delBtn.innerHTML = `
                <svg viewBox="0 0 448 512" class="svgIcon">
                    <path d="M135.2 17.7L128 32H32C14.3 32 0 46.3 0 64S14.3 96 32 96H416c17.7 0 32-14.3 32-32s-14.3-32-32-32H320l-7.2-14.3C307.4 6.8 296.3 0 284.2 0H163.8c-12.1 0-23.2 6.8-28.6 17.7zM416 128H32L53.2 467c1.6 25.3 22.6 45 47.9 45H346.9c25.3 0 46.3-19.7 47.9-45L416 128z"></path>
                </svg>
                `;
                delBtn.onclick = () => {
                    fetch("/delete", {
                        method:"POST",
                        headers:{"Content-Type":"application/json"},
                        body: JSON.stringify({savedName:f.savedName})
                    }).then(res=>res.json()).then(d=>{
                        if(d.success) loadFiles(); else alert(d.message);
                    });
                };
                li.appendChild(delBtn);
            }

            li.style.display = "flex";
            li.style.alignItems = "center";
            li.style.gap = "10px"; // 两个按钮之间的间距

            fileList.appendChild(li);
        });
    });
}

// ---------- 搜索框输入监听 ----------
if (searchInput) {
    searchInput.addEventListener("input", loadFiles);
}

// ---------- 页面初始状态 ----------
document.addEventListener("DOMContentLoaded", () => {
    checkLoginStatus();
    
    // 确保搜索框事件监听
    if (searchInput) {
        searchInput.addEventListener("input", loadFiles);
    }
});

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', function() {
    checkLoginStatus();
    loadFileList();
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
    // 上传表单提交
    document.getElementById('uploadForm').addEventListener('submit', handleFileUpload);
    
    // 登出按钮
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
    
    // 搜索框
    document.getElementById('searchInput').addEventListener('input', function(e) {
        filterFileList(e.target.value);
    });
}

// 处理文件上传
async function handleFileUpload(e) {
    e.preventDefault();
    
    const fileInput = document.getElementById('arquivo');
    const statusEl = document.getElementById('status');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    
    if (!fileInput.files.length) {
        statusEl.innerHTML = '<div class="alert alert-error">请选择一个文件</div>';
        return;
    }
    
    const file = fileInput.files[0];
    if (!file.name.endsWith('.torrent')) {
        statusEl.innerHTML = '<div class="alert alert-error">只允许上传 .torrent 文件</div>';
        return;
    }
    
    const formData = new FormData();
    formData.append('arquivo', file);
    
    try {
        progressContainer.style.display = 'block';
        statusEl.innerHTML = '<div class="alert alert-success">正在上传...</div>';
        
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            progressBar.style.width = '100%';
            statusEl.innerHTML = '<div class="alert alert-success">文件上传成功</div>';
            fileInput.value = '';
            loadFileList();
            
            // 2秒后隐藏进度条
            setTimeout(() => {
                progressContainer.style.display = 'none';
                progressBar.style.width = '0%';
            }, 2000);
        } else {
            statusEl.innerHTML = `<div class="alert alert-error">上传失败: ${data.message}</div>`;
            progressContainer.style.display = 'none';
        }
    } catch (error) {
        statusEl.innerHTML = '<div class="alert alert-error">上传过程中发生错误</div>';
        progressContainer.style.display = 'none';
        console.error('上传错误:', error);
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
        
        // 重新加载文件列表
        loadFileList();
    } catch (error) {
        console.error('登出时出错:', error);
    }
}

// 加载文件列表
async function loadFileList() {
    try {
        const response = await fetch('/files');
        const files = await response.json();
        displayFileList(files);
    } catch (error) {
        console.error('加载文件列表时出错:', error);
        document.getElementById('fileList').innerHTML = '<li class="file-item">加载文件列表失败</li>';
    }
}

// 显示文件列表
function displayFileList(files) {
    const fileListEl = document.getElementById('fileList');
    const username = getCookie('username');
    const role = getCookie('role');
    
    if (!files.length) {
        fileListEl.innerHTML = '<li class="file-item">暂无文件</li>';
        return;
    }
    
    fileListEl.innerHTML = files.map(file => {
        const isOwner = file.uploader === username;
        const isAdmin = role === 'admin';
        const canDelete = isOwner || isAdmin;
        
        const uploadTime = new Date(file.uploadTime).toLocaleString('zh-CN');
        const fileSize = file.torrentMeta?.prettyTotalSize || '未知';
        const infoHash = file.torrentMeta?.infoHash || '未知';
        
        return `
            <li class="file-item">
                <div class="file-info">
                    <h3><a href="detail.html?file=${encodeURIComponent(file.savedName)}" class="link">${file.originalName}</a></h3>
                    <div class="file-meta">
                        上传者: ${file.uploader} | 
                        大小: ${fileSize} | 
                        时间: ${uploadTime} | 
                        Hash: ${infoHash.substring(0, 8)}...
                    </div>
                </div>
                <div class="file-actions">
                    <a href="detail.html?file=${encodeURIComponent(file.savedName)}" class="btn">详情</a>
                    ${canDelete ? `<button class="btn btn-danger" onclick="deleteFile('${file.savedName}')">删除</button>` : ''}
                </div>
            </li>
        `;
    }).join('');
}

// 过滤文件列表
function filterFileList(searchTerm) {
    const fileItems = document.querySelectorAll('.file-item');
    searchTerm = searchTerm.toLowerCase();
    
    fileItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        item.style.display = text.includes(searchTerm) ? 'flex' : 'none';
    });
}

// 删除文件
async function deleteFile(savedName) {
    if (!confirm('确定要删除这个文件吗？')) {
        return;
    }
    
    try {
        const response = await fetch('/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ savedName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            loadFileList();
        } else {
            alert(`删除失败: ${data.message}`);
        }
    } catch (error) {
        console.error('删除文件时出错:', error);
        alert('删除文件时发生错误');
    }
}
