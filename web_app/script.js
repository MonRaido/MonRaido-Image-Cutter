const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const workspace = document.getElementById('workspace');
const placeholder = document.getElementById('placeholder');
const canvasContainer = document.getElementById('canvasContainer');

let images = [];
let imageElements = [];
let cutLines = [];
let totalHeight = 0;
let maxWidth = 0;

let isDragging = false;
let draggedLineIndex = -1;
let isAddMode = false;

// 1. Dosya Yükleme (File Upload)
fileInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name));
    if (files.length === 0) return;

    fileCount.textContent = "Yükleniyor (Lütfen bekleyin)...";
    placeholder.style.display = 'none';
    workspace.style.display = 'block';
    
    // Clear previous
    images = [];
    imageElements = [];
    workspace.innerHTML = '';
    totalHeight = 0;
    maxWidth = 0;

    for (let file of files) {
        const imgUrl = URL.createObjectURL(file);
        const img = await loadImage(imgUrl);
        images.push(img);
        
        const imgEl = document.createElement('img');
        imgEl.src = imgUrl;
        workspace.appendChild(imgEl);
        imageElements.push(imgEl);

        if (img.width > maxWidth) maxWidth = img.width;
        totalHeight += img.height;
    }

    fileCount.textContent = `${files.length} dosya yüklendi`;
    workspace.style.width = maxWidth + 'px';
    workspace.style.height = totalHeight + 'px';
    
    // Çizgileri sıfırla
    cutLines = [];
    drawLines();
});

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function drawLines() {
    // Sadece .cut-line elemanlarını sil
    const existingLines = workspace.querySelectorAll('.cut-line');
    existingLines.forEach(el => el.remove());
    
    cutLines.sort((a, b) => a - b);
    
    for (let i = 0; i < cutLines.length; i++) {
        let y = cutLines[i];
        
        const line = document.createElement('div');
        line.className = 'cut-line';
        line.style.top = y + 'px';
        line.dataset.index = i;
        
        let prevY = i === 0 ? 0 : cutLines[i-1];
        let diff = Math.round(y - prevY);
        
        const label = document.createElement('div');
        label.className = 'cut-line-label';
        label.textContent = `${diff} px`;
        
        line.appendChild(label);
        
        // Sürükle bırak olayları çizgi üzerine de eklenebilir ama container üzerinden yakalamak daha akıcıdır
        workspace.appendChild(line);
    }
}

// 2. Çizgi Yönetimi
document.getElementById('btnAutoLine').addEventListener('click', () => {
    if (totalHeight === 0) return;
    const interval = parseInt(document.getElementById('intervalInput').value);
    
    cutLines = [];
    for (let y = interval; y < totalHeight; y += interval) {
        cutLines.push(y);
    }
    drawLines();
});

document.getElementById('btnClearLines').addEventListener('click', () => {
    cutLines = [];
    drawLines();
});

document.getElementById('btnAddLine').addEventListener('click', () => {
    isAddMode = true;
    workspace.style.cursor = 'crosshair';
});

// Arayüz Etkileşimleri (Mouse Drag)
workspace.addEventListener('mousedown', (e) => {
    // Ignore middle mouse scroll
    if (e.button === 1) return;
    
    const rect = workspace.getBoundingClientRect();
    const y = (e.clientY - rect.top); // since workspace height exactly matches pixel height, no scaleY needed

    if (isAddMode) {
        cutLines.push(y);
        isAddMode = false;
        workspace.style.cursor = 'default';
        drawLines();
        return;
    }

    // Yakında bir çizgi var mı kontrol et (Daha kolay tutmak için 15px tolerans)
    for (let i = 0; i < cutLines.length; i++) {
        if (Math.abs(cutLines[i] - y) < 15) {
            isDragging = true;
            draggedLineIndex = i;
            return;
        }
    }
});

document.addEventListener('mousemove', (e) => {
    if (isDragging && draggedLineIndex !== -1) {
        const rect = workspace.getBoundingClientRect();
        const y = (e.clientY - rect.top);
        cutLines[draggedLineIndex] = Math.max(0, Math.min(totalHeight, y));
        drawLines();
    }
});

document.addEventListener('mouseup', () => {
    isDragging = false;
    draggedLineIndex = -1;
});

// Çift tıklama ile çizgi silme
workspace.addEventListener('dblclick', (e) => {
    const rect = workspace.getBoundingClientRect();
    const y = (e.clientY - rect.top);
    
    for (let i = 0; i < cutLines.length; i++) {
        if (Math.abs(cutLines[i] - y) < 15) {
            cutLines.splice(i, 1);
            drawLines();
            return;
        }
    }
});

// Hover cursor
workspace.addEventListener('mousemove', (e) => {
    if (isDragging || isAddMode) return;
    const rect = workspace.getBoundingClientRect();
    const y = (e.clientY - rect.top);
    
    let hovering = false;
    for (let line of cutLines) {
        if (Math.abs(line - y) < 15) {
            hovering = true;
            break;
        }
    }
    workspace.style.cursor = hovering ? 'ns-resize' : 'default';
});


// Format değişince kalite panelini karart
const formatSelect = document.getElementById('formatSelect');
const qualityGroup = document.getElementById('qualityGroup');
const qualityInput = document.getElementById('qualityInput');

formatSelect.addEventListener('change', () => {
    if (formatSelect.value === 'image/png') {
        qualityGroup.style.opacity = '0.5';
        qualityGroup.style.pointerEvents = 'none';
    } else {
        qualityGroup.style.opacity = '1';
        qualityGroup.style.pointerEvents = 'auto';
    }
});

// 3. Kesme ve ZIP'leme İşlemi (Export)
document.getElementById('btnExport').addEventListener('click', async () => {
    if (images.length === 0) return alert("Önce resim yükleyin!");
    if (cutLines.length === 0) return alert("Lütfen kesim çizgilerini oluşturun!");

    const status = document.getElementById('exportStatus');
    const btn = document.getElementById('btnExport');
    
    btn.disabled = true;
    btn.textContent = "Bölünüyor...";
    status.textContent = "İşlem başladı, lütfen bekleyin...";

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const zip = new JSZip();
        
        let cuts = [...cutLines];
        cuts.sort((a, b) => a - b);
        if (cuts[0] !== 0) cuts.unshift(0);
        if (cuts[cuts.length - 1] < totalHeight) cuts.push(totalHeight);
        
        const format = formatSelect.value;
        const quality = parseFloat(qualityInput.value);
        let ext = format === 'image/jpeg' ? 'jpg' : (format === 'image/webp' ? 'webp' : 'png');

        const sliceCanvas = document.createElement('canvas');
        const sliceCtx = sliceCanvas.getContext('2d');
        
        let segmentIndex = 1;

        for (let i = 0; i < cuts.length - 1; i++) {
            const yTop = Math.round(cuts[i]);
            const yBottom = Math.round(cuts[i+1]);
            const segHeight = yBottom - yTop;
            
            if (segHeight <= 0) continue;
            
            sliceCanvas.width = maxWidth;
            sliceCanvas.height = segHeight;
            
            if (format !== 'image/png') {
                sliceCtx.fillStyle = '#ffffff'; 
                sliceCtx.fillRect(0, 0, maxWidth, segHeight);
            }
            
            let currentY = 0;
            for (let img of images) {
                const imgYStart = currentY;
                const imgYEnd = currentY + img.height;
                
                if (imgYEnd > yTop && imgYStart < yBottom) {
                    const overlapYStart = Math.max(yTop, imgYStart);
                    const overlapYEnd = Math.min(yBottom, imgYEnd);
                    
                    const srcY = overlapYStart - imgYStart;
                    const srcHeight = overlapYEnd - overlapYStart;
                    const destY = overlapYStart - yTop;
                    
                    sliceCtx.drawImage(img, 0, srcY, img.width, srcHeight, 0, destY, img.width, srcHeight);
                }
                currentY += img.height;
            }
            
            const blob = await new Promise(resolve => sliceCanvas.toBlob(resolve, format, quality));
            const fileName = `${String(segmentIndex).padStart(3, '0')}.${ext}`;
            zip.file(fileName, blob);
            
            segmentIndex++;
            status.textContent = `Dilimleniyor... (${segmentIndex - 1}/${cuts.length - 1})`;
        }
        
        status.textContent = "ZIP dosyası oluşturuluyor...";
        const zipBlob = await zip.generateAsync({type: "blob"});
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(zipBlob);
        link.download = `monraido_slices_${ext}.zip`;
        link.click();
        
        status.textContent = "✅ Başarıyla indirildi!";
        
    } catch (e) {
        console.error(e);
        status.textContent = "❌ Bir hata oluştu: " + e.message;
    } finally {
        btn.disabled = false;
        btn.textContent = "Böl ve İndir (ZIP)";
    }
});
