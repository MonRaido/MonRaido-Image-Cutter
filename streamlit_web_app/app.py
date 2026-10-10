import streamlit as st
from PIL import Image
import io
import zipfile
import pillow_avif  # Pillow'a AVIF desteği kazandırır

st.set_page_config(page_title="Monraido Picture Cutter", layout="wide", page_icon="✂️")

st.title("✂️ Monraido Webtoon Cutter (Streamlit)")
st.write("Webtoon görsellerinizi çoklu olarak yükleyin, kesim aralığını belirleyin ve otomatik olarak dilimlenmiş halini ZIP dosyası olarak indirin.")
st.info("💡 İpucu: Bu sürüm cep telefonunuzun tarayıcısından da rahatlıkla çalışabilir!")

# Yan Menü (Ayarlar)
with st.sidebar:
    st.header("⚙️ Kesim Ayarları")
    cut_interval = st.number_input("Kesim Aralığı (Yükseklik/Piksel)", min_value=100, max_value=65500, value=5000, step=100)
    
    st.markdown("---")
    st.header("🖼️ Çıktı Ayarları")
    img_format = st.selectbox("Çıktı Formatı", ["JPG", "PNG", "WEBP", "AVIF"])
    
    # Kalite ayarı PNG'de geçerli olmadığı için gizleyebiliriz
    if img_format != "PNG":
        quality = st.slider("Kalite", min_value=1, max_value=100, value=95)
    else:
        quality = 100
        st.write("*(PNG formatı kayıpsızdır, kalite ayarı yapılmaz)*")

# Dosya Yükleyici
uploaded_files = st.file_uploader(
    "Resimleri Yükle (Dosyaları buraya sürükleyip bırakabilirsiniz)", 
    accept_multiple_files=True, 
    type=['png', 'jpg', 'jpeg', 'webp', 'bmp']
)

if uploaded_files:
    # İsimlerine göre sırala ki sırası bozulmasın
    uploaded_files.sort(key=lambda x: x.name)
    
    st.write(f"📁 Toplam **{len(uploaded_files)}** dosya yüklendi.")
    
    if st.button("🚀 İşlemi Başlat ve Kes", type="primary", use_container_width=True):
        
        with st.spinner("Resimler işleniyor ve dilimleniyor..."):
            images = []
            max_width = 0
            total_height = 0
            
            # Tüm resimleri belleğe (RAM) yükle ve boyutlarını hesapla
            for f in uploaded_files:
                img = Image.open(f)
                images.append(img)
                if img.width > max_width:
                    max_width = img.width
                total_height += img.height
                
            # Kesim noktalarını belirle
            cuts = list(range(0, total_height, cut_interval))
            if not cuts or cuts[0] != 0:
                cuts.insert(0, 0)
            if cuts[-1] < total_height:
                cuts.append(total_height)
                
            # AVIF sınır kontrolü
            if img_format == "AVIF":
                max_height = max([cuts[i+1] - cuts[i] for i in range(len(cuts)-1)]) if len(cuts) > 1 else total_height
                max_pixels = max_height * max_width
                if max_pixels > 8912896 or max_height > 65536:
                    st.error(f"⚠️ AVIF formatı için parça boyutu çok büyük!\nEn büyük parça: {max_width}x{int(max_height)} ({max_pixels} piksel). Lütfen kesim aralığını küçültün.")
                    st.stop()
                
            # ZIP Dosyası için RAM'de bir tampon (buffer) oluştur
            zip_buffer = io.BytesIO()
            
            with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zip_file:
                segment_index = 1
                
                # Her bir dilim için döngü
                for i in range(len(cuts) - 1):
                    y_top = cuts[i]
                    y_bottom = cuts[i+1]
                    segment_height = y_bottom - y_top
                    
                    if segment_height <= 0:
                        continue
                        
                    # Dilim için boş bir zemin oluştur (JPG için beyaz, PNG için şeffaf olabilir ama webtoonda genelde beyazdır)
                    bg_color = (255, 255, 255)
                    segment_img = Image.new("RGB" if img_format != "PNG" else "RGBA", (max_width, segment_height), bg_color)
                    
                    current_y = 0
                    
                    # Orijinal resimlerin hangileri bu dilime denk geliyor?
                    for img in images:
                        img_y_start = current_y
                        img_y_end = current_y + img.height
                        
                        # Kesişim var mı?
                        if img_y_end > y_top and img_y_start < y_bottom:
                            overlap_y_start = max(y_top, img_y_start)
                            overlap_y_end = min(y_bottom, img_y_end)
                            
                            src_y = overlap_y_start - img_y_start
                            src_height = overlap_y_end - overlap_y_start
                            dest_y = overlap_y_start - y_top
                            
                            # Orijinal resimden kesişen kısmı kırp
                            crop_box = (0, src_y, img.width, src_y + src_height)
                            cropped_part = img.crop(crop_box)
                            
                            # Eğer şeffaf (RGBA) bir resmi JPG olarak kaydediyorsak arkaplanı beyaza boya
                            if img_format != "PNG" and cropped_part.mode == "RGBA":
                                background = Image.new("RGB", cropped_part.size, bg_color)
                                background.paste(cropped_part, mask=cropped_part.split()[3])
                                cropped_part = background
                                
                            # Kırpılan kısmı dilim zeminine yapıştır
                            segment_img.paste(cropped_part, (0, dest_y))
                            
                        current_y += img.height
                        
                    # Dilimi belleğe (bytes) olarak kaydet
                    img_buffer = io.BytesIO()
                    save_kwargs = {}
                    if img_format != "PNG":
                        save_kwargs["quality"] = quality
                        
                    format_str = img_format if img_format != "JPG" else "JPEG"
                    segment_img.save(img_buffer, format=format_str, **save_kwargs)
                    
                    # ZIP dosyasına ekle
                    ext = img_format.lower()
                    zip_file.writestr(f"{segment_index:03d}.{ext}", img_buffer.getvalue())
                    segment_index += 1
            
            st.success("✅ Tüm resimler başarıyla kesildi ve ZIP paketine eklendi!")
            
            # İndirme Butonu
            st.download_button(
                label="📦 Bütün Parçaları ZIP Olarak İndir",
                data=zip_buffer.getvalue(),
                file_name=f"monraido_webtoon_dilimleri_{img_format}.zip",
                mime="application/zip",
                type="primary",
                use_container_width=True
            )
