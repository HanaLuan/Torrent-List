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
        
        // 显示用户区域，隐藏登录/注册链接
        userSection.style.display = "flex";
        loginBtn.parentElement.style.display = "none";
        registerBtn.parentElement.style.display = "none";
        
        // 设置用户名显示
        usernameDisplay.textContent = `欢迎, ${username}${role === "admin" ? " (管理员)" : ""}`;
        
        // 显示上传表单
        uploadForm.style.display = "block";
        if (progressContainer) progressContainer.style.display = "block";
    } else {
        currentUser = null;
        currentRole = null;
        
        // 隐藏用户区域，显示登录/注册链接
        userSection.style.display = "none";
        loginBtn.parentElement.style.display = "block";
        registerBtn.parentElement.style.display = "block";
        
        // 隐藏上传表单
        uploadForm.style.display = "none";
        if (progressContainer) progressContainer.style.display = "none";
    }
    loadFiles();
}

// ---------- 登出 ----------
logoutBtn.onclick = () => {
    fetch("/logout", { method: "POST" }).then(() => {
        checkLoginStatus();
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
            progressBar.style.width = pct + "%";
            status.textContent = `上传中: ${pct}%`;
        }
    };
    
    xhr.onload = () => {
        submitBtn.disabled = false;
        if (xhr.status === 200) {
            status.textContent = "上传成功!";
            progressBar.style.width = "100%";
            loadFiles();
            setTimeout(() => {
                progressBar.style.width = "0%";
                status.textContent = "";
                fileInput.value = "";
            }, 1000);
        } else {
            status.textContent = "上传失败";
            setTimeout(() => {
                progressBar.style.width = "0%";
            }, 1000);
        }
    };

    xhr.onerror = () => {
        status.textContent = "上传失败";
        submitBtn.disabled = false;
        setTimeout(() => {
            progressBar.style.width = "0%";
        }, 1000);
    };
    
    xhr.send(formData);
};

// ---------- 获取文件列表 ----------
function loadFiles() {
    fetch("/files")
        .then(res => res.json())
        .then(files => {
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
                    
                    // 下载按钮逻辑（修改部分）
                    const downloadBtn = document.createElement("button");
                    downloadBtn.className = "btn";
                    downloadBtn.textContent = "下载";
                    // 在loadFiles()函数的下载按钮点击事件中
                    downloadBtn.onclick = () => {
                        const downloadUrl = `/uploads/${encodeURIComponent(f.savedName)}`;
                        const a = document.createElement("a");
                        a.href = downloadUrl;
                        // 关键修改：先编码再解码
                        a.download = decodeURIComponent(encodeURIComponent(f.originalName));
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
                                    if (data.success) loadFiles();
                                    else alert(data.message);
                                });
                            }
                        };
                        fileActions.appendChild(delBtn);
                    }

                    li.appendChild(fileActions);
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
    loadFiles();
});