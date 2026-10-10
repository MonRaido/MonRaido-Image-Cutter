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
    // Sadece resim formatlarını al
    let allFiles = Array.from(e.target.files);
    let files = allFiles.filter(f => f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|bmp)$/i));
    
    if (files.length === 0 && allFiles.length > 0) {
        alert("Lütfen sadece resim (JPG, PNG, WEBP vb.) dosyaları seçin.");
        return;
    }
    if (files.length === 0) return;

    // İsme göre "Doğal Sıralama" (Natural Sort) yapar. Yani 2.jpg, 10.jpg'den önce gelir.
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, {numeric: true, sensitivity: 'base'}));

    fileCount.textContent = "Yükleniyor (Lütfen bekleyin)...";
    placeholder.style.display = 'none';
    workspace.style.display = 'flex';
    
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
    workspace.style.width = '100%';
    workspace.style.maxWidth = maxWidth + 'px';
    // workspace'in yüksekliği resimler tarafından otomatik belirlenecek
    
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
    cutLines.sort((a, b) => a - b);
    
    const existingLines = workspace.querySelectorAll('.cut-line');
    
    // Fazla çizgileri sil
    for (let i = cutLines.length; i < existingLines.length; i++) {
        existingLines[i].remove();
    }
    
    // Var olanları güncelle, eksik varsa oluştur
    for (let i = 0; i < cutLines.length; i++) {
        let y = cutLines[i];
        let prevY = i === 0 ? 0 : cutLines[i-1];
        let diff = Math.round(y - prevY);
        
        let line = existingLines[i];
        
        // Eğer DOM'da karşılığı yoksa yeni oluştur
        if (!line) {
            line = document.createElement('div');
            line.className = 'cut-line';
            
            const label = document.createElement('div');
            label.className = 'cut-line-label';
            
            const handle = document.createElement('div');
            handle.className = 'cut-line-handle';
            handle.innerHTML = '↕';
            
            line.appendChild(label);
            line.appendChild(handle);
            workspace.appendChild(line);
        }
        
        // Sadece pozisyonunu (yüzdelik olarak) ve metnini güncelle
        line.style.top = (y / totalHeight * 100) + '%';
        line.querySelector('.cut-line-label').textContent = `${diff} px`;
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

// Arayüz Etkileşimleri (Mouse & Touch Drag)
function getClientY(e) {
    return e.touches ? e.touches[0].clientY : e.clientY;
}

workspace.addEventListener('mousedown', handleDown);
workspace.addEventListener('touchstart', handleDown, {passive: false});

function handleDown(e) {
    if (!e.touches && e.button === 1) return;
    
    const rect = workspace.getBoundingClientRect();
    const scaleY = totalHeight / rect.height;
    const y = (getClientY(e) - rect.top) * scaleY;

    if (isAddMode) {
        cutLines.push(y);
        isAddMode = false;
        workspace.style.cursor = 'default';
        drawLines();
        if(e.touches && e.cancelable) e.preventDefault();
        return;
    }

    // Yakında bir çizgi var mı kontrol et (Mobilde daha rahat tutmak için 25px tolerans)
    for (let i = 0; i < cutLines.length; i++) {
        if (Math.abs(cutLines[i] - y) < 25) {
            isDragging = true;
            draggedLineIndex = i;
            if(e.touches && e.cancelable) e.preventDefault(); // Sürüklerken ekranın kaymasını engelle
            return;
        }
    }
}

document.addEventListener('mousemove', handleMove);
document.addEventListener('touchmove', handleMove, {passive: false});

function handleMove(e) {
    if (isDragging && draggedLineIndex !== -1) {
        const rect = workspace.getBoundingClientRect();
        const scaleY = totalHeight / rect.height;
        const y = (getClientY(e) - rect.top) * scaleY;
        cutLines[draggedLineIndex] = Math.max(0, Math.min(totalHeight, y));
        drawLines();
        if (e.cancelable) e.preventDefault();
    }
}

document.addEventListener('mouseup', handleUp);
document.addEventListener('touchend', handleUp);

function handleUp() {
    isDragging = false;
    draggedLineIndex = -1;
}

// Çift tıklama ile çizgi silme (Mouse)
workspace.addEventListener('dblclick', (e) => {
    const rect = workspace.getBoundingClientRect();
    const scaleY = totalHeight / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    
    for (let i = 0; i < cutLines.length; i++) {
        if (Math.abs(cutLines[i] - y) < 20) {
            cutLines.splice(i, 1);
            drawLines();
            return;
        }
    }
});

// Çift tıklama (Double Tap) ile çizgi silme (Mobil Touch)
let lastTap = 0;
workspace.addEventListener('touchend', (e) => {
    const currentTime = new Date().getTime();
    const tapLength = currentTime - lastTap;
    if (tapLength < 300 && tapLength > 0) {
        const rect = workspace.getBoundingClientRect();
        const scaleY = totalHeight / rect.height;
        const y = (e.changedTouches[0].clientY - rect.top) * scaleY;
        for (let i = 0; i < cutLines.length; i++) {
            if (Math.abs(cutLines[i] - y) < 25) {
                cutLines.splice(i, 1);
                drawLines();
                if(e.cancelable) e.preventDefault();
                return;
            }
        }
    }
    lastTap = currentTime;
});

// Hover cursor
workspace.addEventListener('mousemove', (e) => {
    if (isDragging || isAddMode) return;
    const rect = workspace.getBoundingClientRect();
    const scaleY = totalHeight / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    
    let hovering = false;
    for (let line of cutLines) {
        if (Math.abs(line - y) < 15) {
            hovering = true;
            break;
        }
    }
    workspace.style.cursor = hovering ? 'ns-resize' : 'default';
});


const formatSelect = document.getElementById('formatSelect');
const qualityGroup = document.getElementById('qualityGroup');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');

// Kalite barı değiştikçe yanındaki sayıyı güncelle
qualityInput.addEventListener('input', () => {
    qualityValue.textContent = qualityInput.value;
});

// 3. Kesme ve ZIP'leme İşlemi (Export)
document.getElementById('btnExport').addEventListener('click', async () => {
    if (images.length === 0) return alert("Önce resim yükleyin!");
    // Çizgi sınırı kaldırıldı, kullanıcı hiç çizgi eklemese bile birleştirme yapabilir.

    const status = document.getElementById('exportStatus');
    const btn = document.getElementById('btnExport');
    
    btn.disabled = true;
    btn.textContent = "İşleniyor...";
    status.textContent = "İşlem başladı, lütfen bekleyin...";

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
        const zip = new JSZip();
        
        let cuts = [...cutLines];
        cuts.sort((a, b) => a - b);
        if (cuts.length === 0 || cuts[0] !== 0) cuts.unshift(0);
        if (cuts[cuts.length - 1] < totalHeight) cuts.push(totalHeight);
        
        // 65500 piksel tarayıcı sınırı kontrolü
        let maxHeight = 0;
        for (let i = 0; i < cuts.length - 1; i++) {
            let h = Math.round(cuts[i+1] - cuts[i]);
            if (h > maxHeight) maxHeight = h;
        }

        if (maxHeight > 65500) {
            alert(`UYARI: Oluşacak resimlerden biri ${maxHeight} piksel yüksekliğinde!\n\nTarayıcı sınırı (65.500px) aşıldığı için işlem durduruldu. Lütfen araya kesim çizgisi ekleyerek parçaları küçültün.`);
            btn.disabled = false;
            btn.textContent = "Böl ve İndir (ZIP)";
            status.textContent = "İşlem iptal edildi (Boyut sınırı uyarısı).";
            return;
        }
        
        const format = formatSelect.value;
        const quality = parseInt(qualityInput.value) / 100;
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
