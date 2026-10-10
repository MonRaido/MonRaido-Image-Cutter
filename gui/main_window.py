import os
from PyQt6.QtWidgets import (QMainWindow, QWidget, QVBoxLayout, QHBoxLayout, 
                             QPushButton, QLabel, QSpinBox, QFileDialog, QMessageBox, QFrame, QComboBox)
from PyQt6.QtCore import Qt, QThread, pyqtSignal

from core.settings_manager import load_settings, save_settings
from core.image_cutter import get_image_files, cut_and_save_images
from gui.canvas import Canvas
from gui.cut_line import CutLine

class ExportThread(QThread):
    finished = pyqtSignal()
    error = pyqtSignal(str)

    def __init__(self, image_items, cut_coords, output_dir, img_format, quality):
        super().__init__()
        # QGraphicsItem'i ayırmak için sadece yolu ve Y konumunu alıyoruz
        self.image_items_data = [(p, None, y) for p, item, y in image_items]
        self.cut_coords = cut_coords
        self.output_dir = output_dir
        self.img_format = img_format
        self.quality = quality

    def run(self):
        try:
            cut_and_save_images(self.image_items_data, self.cut_coords, self.output_dir, self.img_format, self.quality)
            self.finished.emit()
        except Exception as e:
            self.error.emit(str(e))

class MainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        
        self.setWindowTitle("Monraido Picture Cutter")
        self.resize(1200, 800)
        
        self.settings = load_settings()
        self.current_folder = self.settings.get("last_used_folder", "")
        
        self.init_ui()
        
    def init_ui(self):
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        main_layout = QHBoxLayout(central_widget)
        main_layout.setContentsMargins(0, 0, 0, 0)
        main_layout.setSpacing(0)
        
        # --- LEFT: Canvas ---
        self.canvas = Canvas()
        self.canvas.line_requested.connect(self.add_single_line)
        main_layout.addWidget(self.canvas, stretch=4)
        
        # --- RIGHT: Control Panel ---
        right_panel = QFrame()
        right_panel.setFixedWidth(280)
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(15, 15, 15, 15)
        right_layout.setSpacing(15)
        right_panel.setStyleSheet("background-color: #2b2b2b; border-left: 1px solid #444;")
        
        # Load Buttons
        btn_layout = QHBoxLayout()
        self.btn_load_image = QPushButton("Resim Yükle")
        self.btn_load_folder = QPushButton("Klasör Yükle")
        self.btn_load_image.clicked.connect(self.load_image_action)
        self.btn_load_folder.clicked.connect(self.load_folder_action)
        btn_layout.addWidget(self.btn_load_image)
        btn_layout.addWidget(self.btn_load_folder)
        right_layout.addLayout(btn_layout)
        
        # Cut Settings
        right_layout.addSpacing(20)
        lbl_interval = QLabel("Kesim Aralığı (Piksel):")
        self.spin_interval = QSpinBox()
        self.spin_interval.setRange(100, 65500)
        self.spin_interval.setSingleStep(100)
        self.spin_interval.setValue(self.settings.get("default_cut_interval", 5000))
        self.spin_interval.valueChanged.connect(self.save_interval_setting)
        
        right_layout.addWidget(lbl_interval)
        right_layout.addWidget(self.spin_interval)
        
        self.btn_generate_lines = QPushButton("Çizgileri Oluştur")
        self.btn_generate_lines.clicked.connect(self.generate_lines)
        right_layout.addWidget(self.btn_generate_lines)
        
        self.btn_add_line = QPushButton("Yeni Çizgi Ekle")
        self.btn_add_line.setStyleSheet("background-color: #4b6eaf;")
        self.btn_add_line.clicked.connect(self.enable_add_line_mode)
        right_layout.addWidget(self.btn_add_line)
        
        self.btn_delete_line = QPushButton("Seçili Çizgiyi Sil")
        self.btn_delete_line.clicked.connect(self.delete_selected_line)
        right_layout.addWidget(self.btn_delete_line)
        
        right_layout.addSpacing(20)
        
        # Export Settings
        lbl_format = QLabel("Çıktı Formatı:")
        self.combo_format = QComboBox()
        self.combo_format.addItems(["PNG", "JPG", "WEBP", "AVIF"])
        default_format = self.settings.get("default_image_format", "JPG")
        self.combo_format.setCurrentText(default_format)
        self.combo_format.currentTextChanged.connect(self.save_export_settings)
        
        lbl_quality = QLabel("Kalite (1-100):")
        self.spin_quality = QSpinBox()
        self.spin_quality.setRange(1, 100)
        self.spin_quality.setValue(self.settings.get("default_image_quality", 95))
        self.spin_quality.valueChanged.connect(self.save_export_settings)
        
        format_layout = QHBoxLayout()
        format_layout.addWidget(lbl_format)
        format_layout.addWidget(self.combo_format)
        
        quality_layout = QHBoxLayout()
        quality_layout.addWidget(lbl_quality)
        quality_layout.addWidget(self.spin_quality)
        
        right_layout.addLayout(format_layout)
        right_layout.addLayout(quality_layout)
        
        # Spacer
        right_layout.addStretch()
        
        # Export
        self.btn_export = QPushButton("Dışa Aktar ve Böl")
        self.btn_export.setStyleSheet("background-color: #d8435d; font-weight: bold; padding: 10px;")
        self.btn_export.clicked.connect(self.export_action)
        right_layout.addWidget(self.btn_export)
        
        main_layout.addWidget(right_panel)

    def load_image_action(self):
        path, _ = QFileDialog.getOpenFileName(self, "Resim Seç", self.current_folder, "Images (*.png *.jpg *.jpeg *.webp *.bmp)")
        if path:
            if not os.path.exists(path):
                QMessageBox.warning(self, "Hata", "Seçilen resim bulunamadı.")
                return
            self.current_folder = os.path.dirname(path)
            self.settings["last_used_folder"] = self.current_folder
            save_settings(self.settings)
            self.clear_lines()
            self.canvas.load_images([path])

    def load_folder_action(self):
        folder = QFileDialog.getExistingDirectory(self, "Klasör Seç", self.current_folder)
        if folder:
            if not os.path.exists(folder):
                QMessageBox.warning(self, "Hata", "Seçilen klasör bulunamadı veya silinmiş.")
                return
            self.current_folder = folder
            self.settings["last_used_folder"] = self.current_folder
            save_settings(self.settings)
            
            image_paths = get_image_files(folder)
            if not image_paths:
                QMessageBox.warning(self, "Hata", "Klasörde resim bulunamadı.")
                return
                
            self.clear_lines()
            self.canvas.load_images(image_paths)

    def clear_lines(self):
        for item in self.canvas.scene.items():
            if isinstance(item, CutLine):
                self.canvas.scene.removeItem(item)

    def generate_lines(self):
        self.clear_lines()
        if self.canvas.total_height <= 0:
            return
            
        interval = self.spin_interval.value()
        y = interval
        while y < self.canvas.total_height:
            line = CutLine(y, self.canvas.max_width)
            self.canvas.scene.addItem(line)
            y += interval
        self.canvas.update_line_labels()

    def enable_add_line_mode(self):
        self.canvas.add_line_mode = True
        self.canvas.setCursor(Qt.CursorShape.CrossCursor)

    def add_single_line(self, y):
        if self.canvas.total_height <= 0:
            return
        line = CutLine(y, self.canvas.max_width)
        self.canvas.scene.addItem(line)
        self.canvas.update_line_labels()
        # Cursor is reverted in canvas.py

    def delete_selected_line(self):
        selected_items = self.canvas.scene.selectedItems()
        for item in selected_items:
            if isinstance(item, CutLine):
                self.canvas.scene.removeItem(item)
        if selected_items:
            self.canvas.update_line_labels()

    def export_action(self):
        if not self.canvas.image_items:
            QMessageBox.information(self, "Bilgi", "Önce resim yüklemelisiniz.")
            return
            
        cut_lines = [item for item in self.canvas.scene.items() if isinstance(item, CutLine)]
        if not cut_lines:
            QMessageBox.information(self, "Bilgi", "Lütfen önce kesim çizgilerini oluşturun.")
            return

        # Always save to "output" folder inside current folder
        output_dir = os.path.join(self.current_folder, "output")
        
        # Collect final Y coordinates of all lines
        cut_coords = [line.get_absolute_y() for line in cut_lines]
        
        img_format = self.combo_format.currentText()
        quality = self.spin_quality.value()
        
        if img_format == "AVIF":
            cuts = sorted([int(c) for c in cut_coords])
            if not cuts or cuts[0] != 0:
                cuts.insert(0, 0)
            if cuts[-1] < self.canvas.total_height:
                cuts.append(self.canvas.total_height)
                
            max_height = max([cuts[i+1] - cuts[i] for i in range(len(cuts)-1)]) if len(cuts) > 1 else self.canvas.total_height
            max_pixels = max_height * self.canvas.max_width
            
            if max_pixels > 8912896 or max_height > 65536:
                QMessageBox.warning(self, "Uyarı", f"AVIF formatı için parça boyutu çok büyük!\nEn büyük parça yüksekliği: {int(max_height)} px ({max_pixels} piksel).\n\nAVIF için maksimum güvenli piksel sınırı ~8.9 Milyon'dur. Lütfen kesim aralığını küçültün (örn: maksimum 8000 px).")
                return
        
        self.btn_export.setText("Bölünüyor...")
        self.btn_export.setEnabled(False)
        
        # İşlemi arka plana taşıyoruz
        self.export_thread = ExportThread(self.canvas.image_items, cut_coords, output_dir, img_format, quality)
        self.export_thread.finished.connect(lambda: self.on_export_finished(output_dir))
        self.export_thread.error.connect(self.on_export_error)
        self.export_thread.start()

    def on_export_finished(self, output_dir):
        self.btn_export.setText("Dışa Aktar ve Böl")
        self.btn_export.setEnabled(True)
        QMessageBox.information(self, "Başarılı", f"Resimler başarıyla bölündü ve kaydedildi:\n{output_dir}")

    def on_export_error(self, error_msg):
        self.btn_export.setText("Dışa Aktar ve Böl")
        self.btn_export.setEnabled(True)
        QMessageBox.critical(self, "Hata", f"Bölme işlemi sırasında bir hata oluştu:\n{error_msg}")
            
    def save_interval_setting(self):
        self.settings["default_cut_interval"] = self.spin_interval.value()
        save_settings(self.settings)

    def save_export_settings(self):
        self.settings["default_image_format"] = self.combo_format.currentText()
        self.settings["default_image_quality"] = self.spin_quality.value()
        save_settings(self.settings)
