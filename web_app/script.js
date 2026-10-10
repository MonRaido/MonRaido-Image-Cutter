const fileInput = document.getElementById('fileInput');
const fileCount = document.getElementById('fileCount');
const canvas = document.getElementById('workspace');
const ctx = canvas.getContext('2d');
const placeholder = document.getElementById('placeholder');
const canvasContainer = document.getElementById('canvasContainer');

let images = [];
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
    
    images = [];
    totalHeight = 0;
    maxWidth = 0;

    for (let file of files) {
        const img = await loadImage(file);
        images.push(img);
        if (img.width > maxWidth) maxWidth = img.width;
        totalHeight += img.height;
    }

    fileCount.textContent = `${files.length} dosya yüklendi`;
    
    canvas.width = maxWidth;
    canvas.height = totalHeight;
    
    // Çizgileri sıfırla
    cutLines = [];
    
    draw();
});

function loadImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function draw() {
    if (images.length === 0) return;
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    let currentY = 0;
    for (let img of images) {
        ctx.drawImage(img, 0, currentY);
        currentY += img.height;
    }
    
    // Çizgileri Çiz
    cutLines.sort((a, b) => a - b);
    ctx.lineWidth = 4;
    ctx.font = "bold 18px Inter";
    
    for (let i = 0; i < cutLines.length; i++) {
        let y = cutLines[i];
        
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.strokeStyle = '#ef4444'; // Kırmızı çizgi
        ctx.stroke();
        
        // Etiket arka planı ve metni (Görünür olması için)
        let prevY = i === 0 ? 0 : cutLines[i-1];
        let diff = Math.round(y - prevY);
        
        ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
        ctx.fillRect(5, y - 28, 100, 26);

        ctx.fillStyle = '#ef4444';
        ctx.fillText(`${diff} px`, 15, y - 8);
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
    draw();
});

document.getElementById('btnClearLines').addEventListener('click', () => {
    cutLines = [];
    draw();
});

document.getElementById('btnAddLine').addEventListener('click', () => {
    isAddMode = true;
    canvas.style.cursor = 'crosshair';
});

// Arayüz Etkileşimleri (Mouse Drag)
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const y = (e.clientY - rect.top) * scaleY;

    if (isAddMode) {
        cutLines.push(y);
        isAddMode = false;
        canvas.style.cursor = 'default';
        draw();
        return;
    }

    // Yakında bir çizgi var mı kontrol et
    for (let i = 0; i < cutLines.length; i++) {
        if (Math.abs(cutLines[i] - y) < 20 * scaleY) {
            isDragging = true;
            draggedLineIndex = i;
            canvas.style.cursor = 'ns-resize';
            return;
        }
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const y = (e.clientY - rect.top) * scaleY;

    if (isDragging && draggedLineIndex !== -1) {
        cutLines[draggedLineIndex] = Math.max(0, Math.min(totalHeight, y));
        draw();
    } else if (!isAddMode) {
        let hovering = false;
        for (let line of cutLines) {
            if (Math.abs(line - y) < 20 * scaleY) {
                hovering = true;
                break;
            }
        }
        canvas.style.cursor = hovering ? 'ns-resize' : 'default';
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
    draggedLineIndex = -1;
});

// Çift tıklama ile çizgi silme
canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleY = canvas.height / rect.height;
    const y = (e.clientY - rect.top) * scaleY;
    
    for (let i = 0; i < cutLines.length; i++) {
        if (Math.abs(cutLines[i] - y) < 20 * scaleY) {
            cutLines.splice(i, 1);
            draw();
            return;
        }
    }
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

    // Arayüzün güncellenmesi için ufak bir gecikme
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

        // Geçici gizli bir canvas oluşturup oradan render alıyoruz
        const sliceCanvas = document.createElement('canvas');
        const sliceCtx = sliceCanvas.getContext('2d');
        
        let segmentIndex = 1;

        for (let i = 0; i < cuts.length - 1; i++) {
            const yTop = cuts[i];
            const yBottom = cuts[i+1];
            const segHeight = yBottom - yTop;
            
            if (segHeight <= 0) continue;
            
            sliceCanvas.width = maxWidth;
            sliceCanvas.height = segHeight;
            
            if (format !== 'image/png') {
                sliceCtx.fillStyle = '#ffffff'; // Arkaplan beyaz
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
            
            // Canvas'ı Blob (dosya) formatına çevir ve ZIP'e at
            const blob = await new Promise(resolve => sliceCanvas.toBlob(resolve, format, quality));
            const fileName = `${String(segmentIndex).padStart(3, '0')}.${ext}`;
            zip.file(fileName, blob);
            
            segmentIndex++;
            status.textContent = `Dilimleniyor... (${segmentIndex - 1}/${cuts.length - 1})`;
        }
        
        status.textContent = "ZIP dosyası oluşturuluyor...";
        const zipBlob = await zip.generateAsync({type: "blob"});
        
        // Tarayıcı üzerinden otomatik indir
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
