function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

async function loadDetail() {
  const savedName = getQueryParam("file"); // 与 index.html 保持一致
  if (!savedName) {
    document.getElementById("fileDetail").textContent = "缺少文件参数";
    return;
  }

  const res = await fetch(`/file/${encodeURIComponent(savedName)}`);
  const data = await res.json();

  if (!data.success) {
    document.getElementById("fileDetail").textContent = "未找到文件";
    return;
  }

  const f = data.file;
  let html = `
    <p><strong>文件名：</strong>${f.originalName}</p>
    <p><strong>保存名：</strong>${f.savedName}</p>
    <p><strong>上传者：</strong>${f.uploader}</p>
    <p><strong>上传时间：</strong>${new Date(f.uploadTime).toLocaleString("zh-CN", {hour12:false})}</p>
  `;

  if (f.torrentMeta) {
    const t = f.torrentMeta;
    html += `
      <h3>种子信息</h3>
      <p><strong>种子名：</strong>${t.name || "未知"}</p>
      <p><strong>Info Hash：</strong>${t.infoHash || "未知"}</p>
      <p><strong>创建时间：</strong>${t.created ? new Date(t.created).toLocaleString("zh-CN", {hour12:false}) : "未知"}</p>
      <p><strong>总大小：</strong>${t.length ? (t.prettyTotalSize || (t.length / 1024 / 1024).toFixed(2) + " MB") : "未知"}</p>
      <h4>文件列表：</h4>
      <ul class="file-list">
        ${t.files && t.files.length ? t.files.map(file =>
          `<li>${file.path} - ${file.length ? (file.length/1024/1024).toFixed(2)+" MB" : "未知"}</li>`).join("") : "<li>无文件信息</li>"}
      </ul>
    `;
  }

  document.getElementById("fileDetail").innerHTML = html;
}

document.addEventListener("DOMContentLoaded", loadDetail);
